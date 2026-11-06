import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import ValidationError

from aic.shared.events import MemoryBus, parse_event
from aic.shared.ids import session_ids
from aic.shared.ledger import Ledger
from aic.shared.table import AddLimit, DynamoTable, MemoryTable, UpdateOptions


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def ledger(clock: Clock) -> Ledger:
    return Ledger(MemoryTable(), clock)


def _task(**kw: Any) -> dict[str, Any]:
    return {
        "goal": "add power()",
        "from": "ace",
        "to": "orchestrator",
        "department": None,
        "parent_id": None,
        "kind": "task",
        **kw,
    }


async def test_keeps_every_tickets_status_history_and_is_idempotent_on_id(ledger: Ledger) -> None:
    t = await ledger.create_ticket(_task(id="t-1"))
    await ledger.set_ticket_status(t["id"], "in_progress", "picked up")
    await ledger.set_ticket_status(t["id"], "done", "signed off", {"result": "merged"})
    assert [h["to"] for h in await ledger.ticket_history("t-1")] == ["open", "in_progress", "done"]
    assert (await ledger.get_ticket("t-1") or {})["result"] == "merged"
    again = await ledger.create_ticket(_task(id="t-1", goal="other", to="y"))
    assert again["goal"] == "add power()"
    assert len(await ledger.list_tickets(["done"])) == 1


async def test_finds_a_department_case_and_space_insensitively_and_refuses_duplicates(ledger: Ledger) -> None:
    assert (await ledger.create_department("Engineering", "Build software", "mgr-engineering"))[1] is True
    assert (await ledger.create_department(" engineering ", "dup", "x"))[1] is False
    assert (await ledger.get_department("ENGINEERING") or {})["mission"] == "Build software"


async def test_answers_a_question_once(ledger: Ledger) -> None:
    q = await ledger.ask_question(
        {
            "asked_by": "w1",
            "path": "mgr › w1",
            "ticket_id": None,
            "text": "Which DB?",
            "options": ["a", "b"],
            "default_answer": "a",
        }
    )
    r = await ledger.answer_question(q["id"], "b", "owner")
    assert r and r["status"] == "answered" and r["answer"] == "b"
    assert await ledger.answer_question(q["id"], "a", "owner") is None
    assert await ledger.open_questions() == []


async def test_uses_an_approval_once_for_the_exact_action_only(ledger: Ledger) -> None:
    a = await ledger.request_approval(
        {
            "agent": "w1",
            "ticket_id": None,
            "tool": "Bash",
            "action": "npm publish",
            "hash": "h1",
            "reason": "publishing",
        }
    )
    assert await ledger.consume_approval("h1") is False  # still pending
    await ledger.decide_approval(a["id"], True)
    assert await ledger.consume_approval("h2") is False
    assert await ledger.consume_approval("h1") is True
    assert await ledger.consume_approval("h1") is False


async def test_counts_a_turn_once_even_if_it_is_recorded_twice(ledger: Ledger) -> None:
    t = {
        "id": "turn-1",
        "agent": "a",
        "role": "worker",
        "department": "Eng",
        "ticket_id": None,
        "kind": "worker",
        "model": "opus-5-5",
        "fallback": False,
        "input": 1,
        "output": 1,
        "cache_read": 0,
        "cache_write_5m": 0,
        "cache_write_1h": 0,
        "usd": 0.5,
        "cache_savings_usd": 0,
        "outcome": "ok",
    }
    await ledger.record_turn(t)
    await ledger.record_turn(t)
    s = await ledger.spend("day", "GLOBAL")
    assert s["usd"] == 0.5 and s["turns"] == 1
    assert (await ledger.spend_breakdown("month"))["MODEL#opus-5-5"]["usd"] == 0.5


async def test_worker_slots_respect_the_department_and_global_ceilings(ledger: Ledger) -> None:
    assert await ledger.acquire_worker_slot("Eng", 2, 3)
    assert await ledger.acquire_worker_slot("Eng", 2, 3)
    assert not await ledger.acquire_worker_slot("Eng", 2, 3)  # department full
    assert await ledger.acquire_worker_slot("Ops", 2, 3)
    assert not await ledger.acquire_worker_slot("Ops", 2, 3)  # global full, and the dept slot is not leaked
    assert await ledger.active_workers() == 3
    await ledger.release_worker_slot("Eng")
    assert await ledger.acquire_worker_slot("Ops", 2, 3)


async def test_limits_new_sessions_per_second(ledger: Ledger, clock: Clock) -> None:
    got = await asyncio.gather(*(ledger.take_session_token(20) for _ in range(25)))
    assert sum(got) == 20
    clock.t += timedelta(seconds=1)
    assert await ledger.take_session_token(20)


async def test_claims_an_idempotency_key_once(ledger: Ledger) -> None:
    assert await ledger.claim("msg-1") is True
    assert await ledger.claim("msg-1") is False


def test_session_ids_follow_the_agreed_shapes_and_meet_agentcores_33_char_minimum() -> None:
    ids = [
        session_ids.ace("owner", "c1"),
        session_ids.orchestrator("t-1"),
        session_ids.manager("Engineering", "t-1"),
        session_ids.worker("Engineering", "h-1"),
    ]
    assert ids[0].startswith("ace-owner-c1")
    assert ids[1].startswith("orch-t-1")
    assert ids[2].startswith("mgr-engineering-t-1")
    assert ids[3].startswith("wkr-engineering-h-1")
    assert all(len(i) >= 33 for i in ids)


async def test_the_bus_validates_events_and_stamps_the_time() -> None:
    bus = MemoryBus()
    await bus.put({"type": "agent.retired", "id": "w1"})
    assert bus.events[0]["at"][:4].isdigit()
    with pytest.raises(ValidationError):
        await bus.put({"type": "agent.retired"})
    with pytest.raises(ValidationError):
        parse_event({"type": "nope", "at": "x"})


def test_events_keep_given_nulls_drop_unknown_keys_and_fill_defaults() -> None:
    e = parse_event(
        {
            "type": "agent.hired",
            "at": "x",
            "agent": {
                "id": "w1",
                "kind": "worker",
                "role": "Dev",
                "department": None,
                "model": "opus-5-5",
                "parent": "m",
                "state": "active",
                "pk": "AGENT#w1",
            },
        }
    )
    assert e["agent"]["department"] is None
    assert "pk" not in e["agent"]
    assert e["agent"]["total_cost_usd"] == 0
    assert "specialty" not in e["agent"]


class _FakeDynamo:
    def __init__(self, fail_on: int | None = None, always_fail: bool = False) -> None:
        self.calls: list[dict[str, Any]] = []
        self._fail_on = fail_on
        self._always = always_fail

    def _maybe_fail(self) -> None:
        if self._always or len(self.calls) == self._fail_on:
            e = Exception("no")
            e.response = {"Error": {"Code": "ConditionalCheckFailedException"}}  # type: ignore[attr-defined]
            raise e

    def update_item(self, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        self._maybe_fail()
        return {"Attributes": {"pk": "SLOTS", "sk": "GLOBAL", "active": 1}}

    def put_item(self, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        self._maybe_fail()
        return {}


async def test_dynamo_table_builds_conditional_add_with_a_limit_and_maps_failures_to_none() -> None:
    fake = _FakeDynamo(fail_on=2)
    t = DynamoTable(fake)
    opts = UpdateOptions(add={"active": 1}, add_limit=AddLimit("active", 10))
    assert (await t.update("SLOTS", "GLOBAL", opts) or {})["active"] == 1
    assert await t.update("SLOTS", "GLOBAL", opts) is None
    kw = fake.calls[0]
    import re

    assert re.fullmatch(r"ADD #a\d+ :v\d+", kw["UpdateExpression"])
    assert re.search(r"attribute_not_exists\(#a\d+\) OR #a\d+ <= :v\d+", kw["ConditionExpression"])
    assert 9 in kw["ExpressionAttributeValues"].values()


async def test_dynamo_table_puts_with_attribute_not_exists_and_reports_duplicates_as_false() -> None:
    fake = _FakeDynamo(always_fail=True)
    assert await DynamoTable(fake).put({"pk": "a", "sk": "b"}, if_not_exists=True) is False
    assert fake.calls[0]["ConditionExpression"] == "attribute_not_exists(pk)"
