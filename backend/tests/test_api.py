import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qsl

import pytest

from aic.lambdas.api import ROUTES, ApiDeps, handle_http, is_owner
from aic.lambdas.approvals import on_approval_step
from aic.lambdas.notifier import notice_for, stale_questions
from aic.lambdas.ws import authorize, broadcast, on_connection
from aic.shared.caps import default_settings
from aic.shared.cost import Usage
from aic.shared.events import MemoryBus
from aic.shared.hierarchy.queue import MemoryQueue
from aic.shared.ledger import Ledger
from aic.shared.table import MemoryTable, UpdateOptions
from aic.shared.turn import TurnInput, TurnOutput
from aic.shared.utility import wake_match


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


class Deps(ApiDeps):
    bus: MemoryBus  # type: ignore[assignment]
    queue: MemoryQueue  # type: ignore[assignment]


def make(clock: Clock | None = None, **extra: Any) -> Any:
    ledger = Ledger(MemoryTable(), clock or Clock())

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    return ApiDeps(ledger=ledger, bus=MemoryBus(), queue=MemoryQueue(), settings=settings, **extra)


def ev(method: str, path: str, body: Any = None, groups: Any = "[owner]") -> dict[str, Any]:
    p, _, qs = path.partition("?")
    return {
        "rawPath": p,
        "requestContext": {
            "http": {"method": method},
            "authorizer": {"jwt": {"claims": {} if groups is None else {"cognito:groups": groups}}},
        },
        "queryStringParameters": dict(parse_qsl(qs)) if qs else None,
        "body": None if body is None else json.dumps(body),
    }


def js(r: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = json.loads(r["body"])
    return out


# ---------- every route requires the owner group ----------
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_every_route_rejects_a_token_without_the_owner_group(method: str, path: str) -> None:
    for groups in (None, "[]", "[friends]", ["admins"], "ownerish"):
        r = await handle_http(ev(method, path, {}, groups), make())
        assert r["statusCode"] == 403, groups
        assert "Only the owner" in js(r)["error"]


def test_accepts_the_group_in_each_shape_api_gateway_can_send() -> None:
    for g in ("[owner]", "owner", "[admins owner]", ["owner"]):
        assert is_owner(ev("GET", "/city", None, g))


# ---------- HTTP routes ----------
async def test_post_messages_queues_the_owners_message_for_ace_keyed_by_the_client_id() -> None:
    d = make()
    r = await handle_http(
        ev("POST", "/messages", {"text": "yo Ace, what's 9 + 9?", "conversation": "c1", "client_id": "abcd1234"}), d
    )
    assert r["statusCode"] == 202
    m = d.queue.sent[0]
    assert (m["id"], m["role"], m["conversation"], m["from"]) == ("owner-abcd1234", "ace", "c1", "owner")
    assert (await handle_http(ev("POST", "/messages", {"text": ""}), d))["statusCode"] == 400
    assert (await handle_http({**ev("POST", "/messages"), "body": "{"}, d))["statusCode"] == 400


async def test_get_city_returns_the_snapshot_the_city_view_starts_from() -> None:
    d = make()
    await d.ledger.create_department("Engineering", "Build software.", "mgr-engineering")
    r = js(await handle_http(ev("GET", "/city"), d))
    assert r["departments"][0]["name"] == "Engineering"
    assert r["usage"] == {"usd": 0, "turns": 0, "tokens": 0}
    assert r["city"]["paused"] is False
    assert r["caps"] == {"daily_global_usd": None, "monthly_budget_usd": None, "daily_department_usd": None}


async def test_answers_a_question_with_the_default_in_one_tap_once() -> None:
    d = make()
    q = await d.ledger.ask_question(
        {
            "asked_by": "w1",
            "path": "mgr › w1",
            "ticket_id": None,
            "text": "Which DB?",
            "options": ["Postgres", "SQLite"],
            "default_answer": "SQLite",
        }
    )
    r = await handle_http(ev("POST", f"/questions/{q['id']}/default", {}), d)
    assert js(r) == {"answered": True, "answer": "SQLite"}
    a = d.bus.of_type("question.answered")[0]
    assert (a["answer"], a["answered_by"]) == ("SQLite", "owner")
    assert (await handle_http(ev("POST", f"/questions/{q['id']}/default", {}), d))["statusCode"] == 409


class FakeSfn:
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    def send_task_success(self, **kw: Any) -> dict[str, Any]:
        self.sent.append(("success", kw))
        return {}

    def send_task_failure(self, **kw: Any) -> dict[str, Any]:
        self.sent.append(("failure", kw))
        return {}


async def test_decides_an_approval_and_sends_the_step_functions_task_result() -> None:
    sfn = FakeSfn()
    d = make(sfn=sfn)
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "npm publish", "hash": "h", "reason": "publishing"}
    )
    await d.ledger.table.update(f"APPROVAL#{a['id']}", "META", UpdateOptions(set={"task_token": "tok"}))
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d)
    assert r["statusCode"] == 200
    assert len(sfn.sent) == 1 and sfn.sent[0][0] == "success"
    assert await d.ledger.consume_approval("h") is True
    assert (await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": False}), d))["statusCode"] == 409


async def test_put_settings_caps_are_optional_impossible_values_refused_null_clears() -> None:
    d = make()
    assert "zero or more" in js(await handle_http(ev("PUT", "/settings", {"daily_global_usd": -5}), d))["error"]
    # No daily cap: a department cap of any size is fine.
    assert (await handle_http(ev("PUT", "/settings", {"department_caps": {"Eng": 9999}}), d))["statusCode"] == 200
    assert (await handle_http(ev("PUT", "/settings", {"daily_global_usd": 500}), d))["statusCode"] == 200
    assert (await d.settings())["daily_global_usd"] == 500
    # With a daily cap, a department cap above it is refused.
    assert (await handle_http(ev("PUT", "/settings", {"department_caps": {"Eng": 9999}}), d))["statusCode"] == 400
    assert (await handle_http(ev("PUT", "/settings", {"max_new_sessions_per_second": 40}), d))["statusCode"] == 400
    assert (await handle_http(ev("PUT", "/settings", {"daily_global_usd": None}), d))["statusCode"] == 200
    assert (await d.settings())["daily_global_usd"] is None


async def test_pauses_and_resumes_the_city() -> None:
    d = make()
    await handle_http(ev("POST", "/city/pause"), d)
    assert await d.ledger.is_paused()
    await handle_http(ev("POST", "/city/resume"), d)
    assert not await d.ledger.is_paused()
    assert [e["paused"] for e in d.bus.of_type("city.state")] == [True, False]


async def test_costs_are_labelled_as_estimates_split_by_department_role_and_model() -> None:
    d = make()
    await d.ledger.record_turn(
        {
            "agent": "w1",
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
            "usd": 1.5,
            "cache_savings_usd": 0.3,
            "outcome": "ok",
        }
    )
    c = js(await handle_http(ev("GET", "/costs"), d))
    assert c["estimate"] is True
    assert c["by_department"]["eng"]["usd"] == 1.5
    assert c["by_role"]["worker"]["usd"] == 1.5
    assert c["by_model"]["Claude Opus 5.5"]["usd"] == 1.5


async def test_hides_internal_errors_behind_plain_words() -> None:
    d = make()

    async def boom(*_: Any) -> Any:
        raise RuntimeError("DynamoDB exploded: arn:aws:...")

    d.ledger.list_agents = boom
    r = await handle_http(ev("GET", "/city"), d)
    assert r["statusCode"] == 500
    assert "arn:" not in r["body"] and "DynamoDB" not in r["body"]
    assert "Nothing was lost" in js(r)["error"]


async def test_wake_check_plain_matching_first_haiku_only_for_unclear_transcripts() -> None:
    calls = 0

    async def runner(_: TurnInput) -> TurnOutput:
        nonlocal calls
        calls += 1
        return TurnOutput(text="YES", usage=Usage(input=50, output=1))

    d = make(utility_runner=runner)
    assert js(await handle_http(ev("POST", "/wake-check", {"transcript": "yo Ace, status?"}), d))["addressed"] is True
    assert js(await handle_http(ev("POST", "/wake-check", {"transcript": "pass the salt"}), d))["addressed"] is False
    assert calls == 0
    assert (
        js(await handle_http(ev("POST", "/wake-check", {"transcript": "so I told ace about it"}), d))["addressed"]
        is True
    )
    assert calls == 1
    assert (await d.ledger.spend("day", "ROLE#utility"))["turns"] == 1  # utility turns are costed and capped


# ---------- wake word ----------
@pytest.mark.parametrize(
    ("t", "want"),
    [
        ("yo Ace", "yes"),
        ("hi Ace, how are things", "yes"),
        ("hey ace", "yes"),
        ("what's up Ace", "yes"),
        ("how's it going Ace", "yes"),
        ("Ace, pause everything", "yes"),
        ("what's the status of the product, Ace?", "yes"),
        ("AIC what time is it", "yes"),
        ("the race was fun", "no"),
        ("I placed an ace in the deck", "unclear"),
        ("", "no"),
    ],
)
def test_wake_word(t: str, want: str) -> None:
    assert wake_match(t) == want


# ---------- WebSocket ----------
class Verifier:
    def __init__(self, groups: list[str] | None) -> None:
        self.groups = groups

    def verify(self, token: str) -> dict[str, Any]:
        if token == "bad.bad.bad":
            raise ValueError("invalid")
        return {"sub": "u1", **({"cognito:groups": self.groups} if self.groups is not None else {})}


def _effect(r: dict[str, Any]) -> str:
    return str(r["policyDocument"]["Statement"][0]["Effect"])


def test_the_connect_authorizer_allows_only_a_valid_owner_token() -> None:
    e = {"methodArn": "arn:ws", "queryStringParameters": {"token": "a.b.c"}}
    assert _effect(authorize(e, Verifier(["owner"]))) == "Allow"
    assert _effect(authorize(e, Verifier(["guest"]))) == "Deny"
    assert _effect(authorize(e, Verifier(None))) == "Deny"
    bad = {"methodArn": "arn:ws", "queryStringParameters": {"token": "bad.bad.bad"}}
    assert _effect(authorize(bad, Verifier(["owner"]))) == "Deny"
    assert _effect(authorize({"methodArn": "arn:ws"}, Verifier(["owner"]))) == "Deny"
    proto = {"methodArn": "arn:ws", "headers": {"Sec-WebSocket-Protocol": "aic, a.b.c"}}
    assert _effect(authorize(proto, Verifier(["owner"]))) == "Allow"


async def test_stores_connections_with_a_ttl_broadcasts_and_drops_gone_connections() -> None:
    table = MemoryTable()
    await on_connection({"requestContext": {"routeKey": "$connect", "connectionId": "c1"}}, table, 0)
    await on_connection({"requestContext": {"routeKey": "$connect", "connectionId": "c2"}}, table, 0)
    assert (await table.get("CONN#c1", "META") or {})["ttl"] == 7200
    posted: list[str] = []

    class P:
        async def post(self, cid: str, data: str) -> Any:
            posted.append(cid)
            return "gone" if cid == "c2" else "ok"

    class Ok:
        async def post(self, cid: str, data: str) -> Any:
            return "ok"

    r = await broadcast({"type": "agent.retired", "id": "w1", "at": "2026-11-06T12:00:00.000Z"}, table, P())
    assert r == {"sent": 1, "gone": 1}
    assert await table.get("CONN#c2", "META") is None
    assert (await broadcast({"type": "nope"}, table, Ok()))["sent"] == 0
    await on_connection({"requestContext": {"routeKey": "$disconnect", "connectionId": "c1"}}, table)
    assert await table.query_index("gsi1", "CONN") == []


# ---------- notifications and approval steps ----------
async def test_emails_results_and_cap_alerts_and_nudges_questions_waiting_over_15_minutes_once() -> None:
    at = "2026-11-06T12:00:00.000Z"
    n = notice_for({"type": "result", "ticket_id": "t", "summary": "done", "at": at})
    assert n and "done" in n.subject
    cap = notice_for(
        {"type": "spend.cap_reached", "cap": "daily_global", "department": None, "spent": 10.2, "limit": 10, "at": at}
    )
    assert cap and "$10" in cap.message
    clock = Clock()
    d = make(clock)
    await d.ledger.ask_question(
        {
            "asked_by": "w1",
            "path": "mgr › w1",
            "ticket_id": None,
            "text": "Which DB?",
            "options": [],
            "default_answer": "SQLite",
        }
    )
    assert await stale_questions(d.ledger) == []
    clock.t += timedelta(minutes=16)
    assert len(await stale_questions(d.ledger)) == 1
    assert await stale_questions(d.ledger) == []


async def test_stores_the_task_token_and_wakes_the_agent_with_the_owners_decision() -> None:
    d = make()
    await d.ledger.put_agent(
        {
            "id": "w1",
            "kind": "worker",
            "role": "Dev",
            "department": "Eng",
            "model": "opus-5-5",
            "parent": "mgr-eng",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "npm publish", "hash": "h", "reason": "publishing"}
    )
    await on_approval_step({"step": "store_token", "approvalId": a["id"], "taskToken": "tok"}, d.ledger, d.queue)
    assert (await d.ledger.get_approval(a["id"]) or {})["task_token"] == "tok"
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": False}, d.ledger, d.queue)
    m = d.queue.sent[0]
    assert (m["role"], m["agentId"], m["kind"]) == ("worker", "w1", "answer")
    assert "refused" in m["body"]
