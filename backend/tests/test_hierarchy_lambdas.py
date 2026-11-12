import asyncio
import json
from typing import Any

import pytest

from vaic.lambdas.dispatcher import AgentCoreInvoker, process_batch, session_id_for
from vaic.lambdas.factory import handle_factory
from vaic.lambdas.improve import barred, improvement_allowed, review_changes
from vaic.lambdas.ledger_writer import write_event
from vaic.lambdas.scheduler import run_job
from vaic.shared.caps import settings_with
from vaic.shared.events import MemoryBus, now_iso
from vaic.shared.hierarchy.factory import Factory, HireRefused
from vaic.shared.hierarchy.queue import MemoryQueue
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable


def msg(**over: Any) -> dict[str, Any]:
    return {
        "id": "m1",
        "role": "worker",
        "agentId": "w1",
        "department": "Eng",
        "ticketId": "t1",
        "taskId": "t0",
        "kind": "task",
        "from": "mgr",
        "body": "go",
        **over,
    }


# ---------- dispatcher Lambda ----------
async def test_reports_only_failed_records_for_retry_and_skips_unparseable_ones() -> None:
    class D:
        async def handle(self, m: Any) -> str:
            if m["id"] == "boom":
                raise RuntimeError("runtime down")
            return "started"

    r = await process_batch(
        {
            "Records": [
                {"messageId": "a", "body": json.dumps(msg())},
                {"messageId": "b", "body": "{"},
                {"messageId": "c", "body": json.dumps(msg(id="boom"))},
            ]
        },
        D(),
    )
    assert r["batchItemFailures"] == [{"itemIdentifier": "c"}]


async def test_a_batch_starts_its_messages_side_by_side() -> None:
    """One slow hand-off never holds up the other messages in its batch (decision 178)."""
    started: list[str] = []
    gate = asyncio.Event()

    class D:
        async def handle(self, m: Any) -> str:
            started.append(m["id"])
            if m["id"] == "slow":
                await gate.wait()
            return "started"

    run = asyncio.create_task(
        process_batch(
            {
                "Records": [
                    {"messageId": "a", "body": json.dumps(msg(id="slow"))},
                    {"messageId": "b", "body": json.dumps(msg(id="quick"))},
                ]
            },
            D(),
        )
    )
    for _ in range(5):
        await asyncio.sleep(0)
    assert started == ["slow", "quick"]  # the quick one began while the slow one was still running
    gate.set()
    assert (await run)["batchItemFailures"] == []


async def test_invokes_the_roles_agentcore_runtime_with_the_session_id_and_json_payload() -> None:
    sent: list[dict[str, Any]] = []

    class Client:
        def invoke_agent_runtime(self, **kw: Any) -> dict[str, Any]:
            sent.append(kw)
            return {"statusCode": 200}

    inv = AgentCoreInvoker(
        Client(), {"vaic": "arn:vaic", "orchestrator": "arn:o", "manager": "arn:m", "worker": "arn:w"}
    )
    await inv.invoke({**msg(), "sessionId": session_id_for(msg()), "async": True})  # type: ignore[arg-type]
    assert sent[0]["agentRuntimeArn"] == "arn:w"
    assert sent[0]["runtimeSessionId"].startswith("wkr-eng-w1")
    payload = json.loads(sent[0]["payload"])
    assert payload["id"] == "m1" and payload["async"] is True


def test_session_ids_per_role() -> None:
    assert session_id_for(msg(role="vaic", conversation="c9"), "me").startswith("vaic-me-c9")  # type: ignore[arg-type]
    assert session_id_for(msg(role="orchestrator", taskId="t-7")).startswith("orch-t-7")  # type: ignore[arg-type]
    assert session_id_for(msg(role="manager", department="Research", taskId="t-7")).startswith("mgr-research-t-7")  # type: ignore[arg-type]


# ---------- Agent Factory ----------
SPEC = {"specialty": "Dev", "instructions": "Write the code carefully.", "tools": ["Bash"]}


async def _setup(settings: dict[str, Any] | None = None) -> tuple[Ledger, MemoryBus, Factory]:
    ledger = Ledger(MemoryTable())
    bus = MemoryBus()
    await ledger.create_department("Engineering", "Build software.", "mgr-engineering")
    s = settings or settings_with()

    async def get() -> dict[str, Any]:
        return s

    return ledger, bus, Factory(ledger, bus, get)


async def test_hires_with_a_valid_spec_and_refuses_bad_tools_wrong_managers_and_missing_departments() -> None:
    _, bus, factory = await _setup()
    w = await factory.hire(SPEC, "mgr-engineering", "Engineering")
    assert (w["kind"], w["parent"], w["worker_state"], w["model"]) == ("worker", "mgr-engineering", "hired", "opus-5-5")
    assert len(bus.of_type("agent.hired")) == 1
    with pytest.raises(HireRefused):
        await factory.hire({**SPEC, "tools": ["Bash", "aws_cli"]}, "mgr-engineering", "Engineering")
    with pytest.raises(HireRefused, match="Only Engineering's manager"):
        await factory.hire(SPEC, "mgr-research", "Engineering")
    with pytest.raises(HireRefused, match="no active department"):
        await factory.hire(SPEC, "mgr-x", "Nope")
    # No department cap by default, so any budget hint is accepted.
    assert await factory.hire({**SPEC, "budget_hint_usd": 50}, "mgr-engineering", "Engineering")


async def test_refuses_a_budget_hint_above_a_department_cap_the_owner_set() -> None:
    _, _, capped = await _setup(settings_with(daily_department_usd=5))
    with pytest.raises(HireRefused, match="above Engineering's daily cap"):
        await capped.hire({**SPEC, "budget_hint_usd": 50}, "mgr-engineering", "Engineering")


async def test_re_hires_a_saved_specialist_with_its_saved_instructions_and_tools() -> None:
    ledger, _, factory = await _setup()
    sp = await ledger.save_specialist(
        {
            "department": "Engineering",
            "specialty": "Tester",
            "instructions": "Write thorough tests.",
            "tools": ["Read", "Bash"],
        }
    )
    w = await factory.hire({**SPEC, "specialist_id": sp["id"]}, "mgr-engineering", "Engineering")
    assert (await ledger.table.get(f"AGENT#{w['id']}", "SPEC") or {})["instructions"] == "Write thorough tests."


async def test_the_factory_lambda_returns_errors_as_data_never_raises() -> None:
    _, _, factory = await _setup()
    assert await handle_factory({"action": "release", "workerId": "nobody", "managerId": "m"}, factory) == {
        "ok": False,
        "error": "No worker nobody.",
    }


# ---------- ledger writer and scheduled jobs ----------
async def test_appends_ticket_events_to_the_trace_and_ignores_invalid_ones() -> None:
    ledger = Ledger(MemoryTable())
    e = {"type": "result", "ticket_id": "t1", "summary": "done", "at": now_iso()}
    assert await write_event({"detail-type": "result", "detail": e}, ledger) is True
    assert await write_event({"detail-type": "x", "detail": {"type": "nope"}}, ledger) is False
    assert len(await ledger.trace("t1")) == 1


async def test_retire_idle_puts_managers_without_open_work_to_sleep_and_improve_stays_off() -> None:
    ledger = Ledger(MemoryTable())
    await ledger.put_agent(
        {
            "id": "mgr-a",
            "kind": "manager",
            "role": "A",
            "department": "A",
            "model": "fable-5-1",
            "parent": "orchestrator",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    q, bus = MemoryQueue(), MemoryBus()
    assert await run_job("retire_idle", ledger, q, bus, {}) == {"dormant": 1, "sent_home": 0}
    assert await run_job("improve", ledger, q, bus, {}) == {"skipped": "the self-improvement loop is disabled"}
    assert await run_job("sweep", ledger, q, bus, {}) == {"resent": 0, "sent_home": 0, "stuck": 0}


# ---------- self-improvement fence ----------
def test_self_improvement_is_off_unless_explicitly_enabled() -> None:
    assert improvement_allowed({})[0] is False
    assert improvement_allowed({"VAIC_SELF_IMPROVE": "on"})[0] is True


@pytest.mark.parametrize(
    "path",
    [
        "infra/modules/agents/main.tf",
        "infra/envs/prod/main.tf",
        "config/policy.json",
        "config/caps.json",
        "config/mail.json",
        "backend/src/vaic/shared/policy.py",
        "backend/src/vaic/shared/caps.py",
        ".github/workflows/deploy.yml",
        "infra/modules/security/iam.tf",
        "package.json",
        "backend/pyproject.toml",
        "backend/uv.lock",
        "scripts/check_iam.py",
    ],
)
def test_the_fence_refuses(path: str) -> None:
    assert barred("M", path)


def test_allows_prompt_and_code_changes_and_new_tests_but_not_edits_to_existing_tests() -> None:
    assert review_changes(
        [{"status": "M", "path": "agents/worker.md"}, {"status": "A", "path": "backend/tests/test_new.py"}]
    )[0]
    ok, refused = review_changes([{"status": "M", "path": "backend/tests/test_hierarchy_e2e.py"}])
    assert not ok
    assert refused == ["backend/tests/test_hierarchy_e2e.py"]


def test_vaic_gets_a_fresh_session_per_runtime_version_other_roles_keep_theirs() -> None:
    from vaic.lambdas.dispatcher import session_id_for

    vaic: Any = {"role": "vaic", "conversation": "main"}
    old, new = session_id_for(vaic, "owner", "rt-aaaa"), session_id_for(vaic, "owner", "rt-bbbb")
    assert old != new and len(old) >= 33
    assert session_id_for(vaic, "owner", "rt-aaaa") == old  # same version, same session
    worker: Any = {"role": "worker", "department": "eng", "agentId": "w1"}
    assert session_id_for(worker, "owner", "rt-aaaa") == session_id_for(worker, "owner", "rt-bbbb")
