"""Every build runs the fastest way by default (decision 287)."""

from datetime import UTC, datetime, timedelta
from typing import Any

from city_support import make_city, scripted_engine
from test_hire_caps import SPEC, manager
from vaic.lambdas.scheduler import run_job
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared.speed import DEFAULT_PACE, FASTEST, UNHURRIED, overdue, pace_from_words, policy_for, speed_brief

MIN = 60_000


def test_the_default_pace_is_the_fastest() -> None:
    assert DEFAULT_PACE == FASTEST
    for words in ("build me a memory game", "change it to 4 pairs", "make a complex CRM with 12 screens", ""):
        assert pace_from_words(words) == FASTEST
    assert policy_for(None).pace == FASTEST and policy_for("nonsense").pace == FASTEST
    fastest = policy_for(FASTEST)
    assert fastest.review_fails_before_escalation == 2 and fastest.part_budget_minutes == 10
    assert "fastest" in speed_brief(None) and "at the same time" in speed_brief(None)


def test_only_the_owners_words_slow_it_down() -> None:
    for words in ("take your time on this", "no rush, build a game", "Take as long as you need"):
        assert pace_from_words(words) == UNHURRIED
    assert policy_for(UNHURRIED).review_fails_before_escalation == 3


def test_a_part_over_its_budget_is_overdue_once() -> None:
    now = datetime(2026, 11, 12, 12, 0, tzinfo=UTC)
    part = {
        "kind": "assignment",
        "status": "in_progress",
        "to": "wkr-a-1",
        "updated_at": (now - timedelta(minutes=11)).isoformat(),
    }
    assert overdue(part, FASTEST, now)
    assert not overdue(part, UNHURRIED, now)
    assert not overdue({**part, "stuck_reported_at": "x"}, FASTEST, now)
    assert not overdue({**part, "status": "in_review"}, FASTEST, now)


# ---------- the city ----------


def ctx(mgr: str, ticket: str, task: str) -> TurnCtx:
    return TurnCtx(
        agent_id=mgr, role="manager", department="Writing", ticket_id=ticket, task_id=task, conversation=None
    )


def tool(city: Any, c: TurnCtx, name: str) -> Any:
    return next(t for t in tools_for(city.deps, c) if t.name == name).handler


async def setup(city: Any, pace: str | None = None) -> tuple[str, str, str, str]:
    mgr = await manager(city)
    task = await city.ledger.create_ticket(
        {
            "goal": "game",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            **({"pace": pace} if pace else {}),
        }
    )
    goal = await city.ledger.create_ticket(
        {
            "goal": "4 pairs",
            "acceptance": "4 pairs",
            "from": "orchestrator",
            "to": mgr,
            "department": "Writing",
            "parent_id": task["id"],
            "kind": "assignment",
            **({"pace": pace} if pace else {}),
        }
    )
    c = ctx(mgr, goal["id"], task["id"])
    wid = (await tool(city, c, "hire_worker")(SPEC)).split()[1]
    out = await tool(city, c, "assign")({"worker_id": wid, "goal": "change to 4 pairs", "acceptance": "4 pairs show"})
    part = out.split()[1]
    return mgr, str(goal["id"]), wid, part


async def test_a_fail_sends_the_real_reason_and_the_second_fail_goes_back_to_the_manager() -> None:
    city = make_city(scripted_engine({}))
    mgr, gid, wid, part = await setup(city)
    t = await city.ledger.get_ticket(gid)
    review = tool(city, ctx(mgr, gid, str(t["parent_id"])), "review")
    await city.ledger.set_ticket_status(part, "in_review")
    sent = len(city.queue.sent)
    first = await review({"ticket_id": part, "verdict": "FAIL", "reasons": "Still 6 pairs on the board."})
    assert first == "FAIL recorded; sent back to the worker."
    fix = [m for m in city.queue.sent[sent:] if m["agentId"] == wid]
    assert len(fix) == 1 and "Still 6 pairs on the board." in fix[0]["body"]
    await city.ledger.set_ticket_status(part, "in_review")
    out = await review({"ticket_id": part, "verdict": "FAIL", "reasons": "The score counter still expects 6."})
    assert out.startswith("Escalated:") and "Still 6 pairs" in out and "score counter" in out and "don't ask" in out
    p = await city.ledger.get_ticket(part)
    assert p["status"] == "cancelled" and p["escalated"] == "review" and len(p["review_reasons"]) == 2
    assert not await city.ledger.open_questions()  # nobody asked the owner
    w = await city.ledger.get_agent(wid)
    assert w and w["state"] == "retired"  # the worker went home and freed its place


async def test_take_your_time_keeps_the_longer_review_loop() -> None:
    city = make_city(scripted_engine({}))
    mgr, gid, _wid, part = await setup(city, UNHURRIED)
    t = await city.ledger.get_ticket(gid)
    review = tool(city, ctx(mgr, gid, str(t["parent_id"])), "review")
    for _ in range(2):
        await city.ledger.set_ticket_status(part, "in_review")
        assert not (await review({"ticket_id": part, "verdict": "FAIL", "reasons": "Wrong count."})).startswith(
            "Escalated"
        )
    assert (await city.ledger.get_ticket(part))["status"] == "in_progress"


async def test_the_orchestrator_passes_the_fastest_pace_to_every_goal() -> None:
    city = make_city(scripted_engine({}))
    await manager(city)
    task = await city.ledger.create_ticket(
        {"goal": "game", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task"}
    )
    orch = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"], task_id=task["id"]
    )
    assign = next(t for t in tools_for(city.deps, orch) if t.name == "assign_to_department").handler
    await assign({"department": "Writing", "goal": "4 pairs", "acceptance": "4 pairs"})
    (goal,) = await city.ledger.child_tickets(task["id"])
    assert goal["pace"] == FASTEST
    brief = next(m for m in city.queue.sent if m["ticketId"] == goal["id"])
    assert "Pace: fastest" in brief["body"]


async def test_a_part_over_its_time_budget_is_reported_to_its_manager_once() -> None:
    city = make_city(scripted_engine({}))
    mgr, _gid, _wid, part = await setup(city)
    sent = len(city.queue.sent)
    city.advance(9 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["stuck"] == 0
    city.advance(2 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["stuck"] == 1
    told = [m for m in city.queue.sent[sent:] if m["agentId"] == mgr]
    assert len(told) == 1 and "10-minute budget" in told[0]["body"] and part in told[0]["body"]
    assert (await city.ledger.get_ticket(part))["stuck_reported_at"]
    assert any("manager told" in h["note"] for h in await city.ledger.ticket_history(part))
    city.advance(2 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["stuck"] == 0
