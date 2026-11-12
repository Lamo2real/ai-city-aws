"""The small path on the project board (decision 289, stage 2): VAIC → board → one Sonnet worker → tests in code →
Opus review only when risky → the job finished in code and VAIC told. No Orchestrator turn, no planning turn."""

# ruff: noqa: ASYNC240 (test workers write their files like a real worker does)
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from city_support import Call, City, make_city, scripted_engine
from test_hire_caps import manager as make_department
from vaic.lambdas.ledger_writer import write_event
from vaic.runtime import tools as tools_mod
from vaic.runtime.engine import EngineRequest
from vaic.shared.board import Board
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.utility import Triage

SMALL = "fix the typo on the about page"


def city_with(worker: Any, reviewer: Any | None = None, **settings: Any) -> City:
    async def vaic(req: EngineRequest, call: Call) -> str:
        if "(task) from owner" in req.turn.prompt:
            words = req.ctx.owner_text
            return await call("delegate_to_orchestrator", {"goal": words, "owner_words": words, "confirm": True})
        return "Done, Sir."

    async def orchestrator(req: EngineRequest, call: Call) -> str:
        return "the chain"  # the chain's turn: these tests only count that it ran

    async def no_manager(req: EngineRequest, call: Call) -> str:
        return "nothing"

    city = make_city(
        scripted_engine(
            {"vaic": vaic, "orchestrator": orchestrator, "manager": reviewer or no_manager, "worker": worker}
        ),
        **settings,
    )
    city.deps.utility_runner = object()  # the triage below stands in for the Haiku call

    async def project(e: dict[str, Any]) -> None:
        await write_event({"detail": e}, city.ledger)

    city.bus.on(project)
    return city


@pytest.fixture(autouse=True)
def triage_builders(monkeypatch: pytest.MonkeyPatch) -> None:
    async def triage(*_: Any, **__: Any) -> Triage:
        return Triage("department", "Builders", "test")

    monkeypatch.setattr(tools_mod, "triage", triage)


def writes(content: str) -> Any:
    async def worker(req: EngineRequest, call: Call) -> str:
        assert req.cwd
        Path(req.cwd, "about.json").write_text(content)
        out = await call("report_to_manager", {"summary": "Fixed the typo.", "artifacts": [], "checks": "-"})
        return out

    return worker


async def run(city: City, words: str = SMALL) -> dict[str, Any]:
    await make_department(city, "Builders")
    await city.owner_says(words)
    await city.run()
    return next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")


def roles(city: City) -> list[str]:
    return [i["role"] for i in city.invocations]


async def test_a_small_job_runs_on_the_board_with_one_sonnet_worker_and_no_planning_turn() -> None:
    city = city_with(writes('{"title": "About"}'))
    task = await run(city)
    assert task["status"] == "done" and task["path"] == "board" and task["size"] == "small"
    assert "orchestrator" not in roles(city) and "manager" not in roles(city)  # no planner, no review: not risky
    (w,) = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    assert w["model"] == "sonnet-5-5" and w["department"] == "Builders" and w["state"] == "retired"
    (inv,) = [i for i in city.invocations if i["role"] == "worker"]
    assert inv["model"] == "sonnet-5-5"
    (turn,) = await city.ledger.turns_of(w["id"])
    assert turn["model"] == "sonnet-5-5"
    # The same records and events the chain writes, so the City, Work and the project chat read it unchanged.
    every = await city.ledger.list_tickets(ALL_STATUSES)
    goal = next(t for t in every if t.get("parent_id") == task["id"])
    part = next(t for t in every if t.get("parent_id") == goal["id"])
    assert (goal["status"], goal["department"], goal["to"]) == ("done", "Builders", "mgr-builders")
    assert (part["status"], part["to"]) == ("done", w["id"])
    hired = city.bus.of_type("agent.hired")
    assert [h["agent"]["department"] for h in hired if h["agent"]["kind"] == "worker"] == ["Builders"]
    assert any(e["state"] == "working" for e in city.bus.of_type("worker.state"))
    assert city.bus.of_type("agent.retired")
    assert [r["verdict"] for r in city.bus.of_type("review.result")] == ["PASS"]
    assert city.bus.of_type("result") and city.bus.of_type("signoff.result")
    # VAIC was told, and answered the owner in its own turn, in the job's conversation.
    reports = [i for i in city.invocations if i["role"] == "vaic" and i["kind"] == "report"]
    assert len(reports) == 1 and reports[0]["conversation"] == "c1"
    # The board has every stage, tests included.
    b = await Board(city.ledger.table, city.ledger.get_ticket).read(task["id"])
    assert b and b["path"] == "board" and b["status"] == "done"
    for stage in ("sizing", "planning", "spinup", "work", "tests"):
        assert stage in b["timings"]["stages"], stage


async def test_a_risky_small_job_gets_the_opus_review_then_finishes() -> None:
    reviewed: list[str] = []

    async def reviewer(req: EngineRequest, call: Call) -> str:
        reviewed.append(req.ctx.ticket_id)
        assert "Board review" in req.turn.prompt
        return await call("review", {"ticket_id": req.ctx.ticket_id, "verdict": "PASS", "reasons": "Matches the ask."})

    city = city_with(writes("{}"), reviewer)
    task = await run(city, "fix the password reset link text")
    assert task["status"] == "done"
    (inv,) = [i for i in city.invocations if i["role"] == "manager"]
    assert inv["model"] == "opus-5-5" and reviewed
    turns = await city.ledger.turns_of("mgr-builders")
    assert [t["model"] for t in turns] == ["opus-5-5"]
    # The City walks the reviewer in and out on these (decision 297): the department, the reviewer and the part.
    (started,) = city.bus.of_type("review.started")
    (finished,) = city.bus.of_type("review.finished")
    part_id = city.bus.of_type("review.result")[0]["ticket_id"]
    assert (started["ticket_id"], started["department"], started["reviewer"], started["task_id"]) == (
        part_id,
        "Builders",
        "mgr-builders",
        task["id"],
    )
    assert (finished["ticket_id"], finished["department"], finished["reviewer"], finished["verdict"]) == (
        part_id,
        "Builders",
        "mgr-builders",
        "PASS",
    )
    assert "orchestrator" not in roles(city)


async def test_failing_tests_twice_hands_the_part_to_a_fresh_opus_worker() -> None:
    async def worker(req: EngineRequest, call: Call) -> str:
        assert req.cwd
        took_over = "failed 1 times" in req.turn.prompt or "failed 2 times" in req.turn.prompt
        if took_over:
            Path(req.cwd, "about.json").write_text("{}")
            return await call("report_to_manager", {"summary": "Fixed it properly.", "artifacts": [], "checks": "-"})
        Path(req.cwd, "about.json").write_text("{broken")
        first = await call("report_to_manager", {"summary": "try 1", "artifacts": [], "checks": "-"})
        assert first.startswith("Not reported: the tests failed") and "about.json" in first
        second = await call("report_to_manager", {"summary": "try 2", "artifacts": [], "checks": "-"})
        assert "fresh worker" in second
        return second

    city = city_with(worker)
    task = await run(city)
    assert task["status"] == "done"
    workers = sorted((a for a in await city.ledger.list_agents() if a["kind"] == "worker"), key=lambda a: a["hired_at"])
    assert [w["model"] for w in workers] == ["sonnet-5-5", "opus-5-5"]
    every = await city.ledger.list_tickets(ALL_STATUSES)
    first = next(t for t in every if t.get("to") == workers[0]["id"])
    second = next(t for t in every if t.get("to") == workers[1]["id"])
    assert first["status"] == "cancelled" and second["status"] == "done"
    assert all("Tests failed" in r for r in second["review_reasons"])  # the real reasons travel
    (opus_inv,) = [i for i in city.invocations if i.get("agentId") == workers[1]["id"]]
    assert opus_inv["model"] == "opus-5-5" and "about.json" in opus_inv["body"]


async def test_failing_review_twice_hands_the_part_over_with_every_reason() -> None:
    async def reviewer(req: EngineRequest, call: Call) -> str:
        part = await req.ledger.get_ticket(req.ctx.ticket_id)
        assert part
        if part.get("takeover"):
            return await call("review", {"ticket_id": part["id"], "verdict": "PASS", "reasons": "Good now."})
        return await call(
            "review",
            {
                "ticket_id": part["id"],
                "verdict": "FAIL",
                "reasons": f"The link still points to /old ({part['review_rounds']}).",
            },
        )

    city = city_with(writes("{}"), reviewer)
    task = await run(city, "fix the payment link text on the shop page")
    assert task["status"] == "done"
    workers = sorted((a for a in await city.ledger.list_agents() if a["kind"] == "worker"), key=lambda a: a["hired_at"])
    assert [w["model"] for w in workers] == ["sonnet-5-5", "opus-5-5"]
    fixes = [i for i in city.invocations if i["role"] == "worker" and i["kind"] == "fix"]
    assert fixes and fixes[0]["model"] == "sonnet-5-5"  # a fix stays on the part's model
    last = next(i for i in city.invocations if i.get("agentId") == workers[1]["id"])
    assert last["body"].count("The link still points to /old") == 2


async def test_the_switch_sends_small_jobs_through_the_old_chain() -> None:
    city = city_with(writes("{}"), board_sizes=[])
    task = await run(city)
    assert "orchestrator" in roles(city)
    assert task.get("path") is None and not [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]


async def test_a_board_step_runs_once_in_code_with_no_model_turn() -> None:
    city = city_with(writes("{}"))
    await run(city)
    steps = [m for m in city.queue.sent if m.get("board")]
    assert [m["board"] for m in steps] == ["finish"]
    assert not [i for i in city.invocations if i.get("board")]  # never handed to a runtime
    assert await city.dispatcher.handle(steps[0]) == "duplicate"
