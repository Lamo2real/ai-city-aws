"""Every build runs the fastest way by default (decision 287)."""

from datetime import UTC, datetime, timedelta
from typing import Any

from city_support import SPEC, make_city, make_department, scripted_engine
from vaic.lambdas.scheduler import run_job
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared.hierarchy.factory import Factory
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
    """A small job on the board in Writing: its goal and one Sonnet worker's part, under way."""
    mgr = await make_department(city)
    task = await city.ledger.create_ticket(
        {
            "goal": "game",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            "path": "board",
            "size": "small",
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
            "task_id": task["id"],
            "kind": "assignment",
            "path": "board",
            **({"pace": pace} if pace else {}),
        }
    )
    w = await Factory(city.ledger, city.bus, city.deps.settings).hire(SPEC, mgr, "Writing", "sonnet-5-5")
    part = await city.ledger.create_ticket(
        {
            "goal": "change to 4 pairs",
            "acceptance": "4 pairs show",
            "from": mgr,
            "to": w["id"],
            "department": "Writing",
            "parent_id": goal["id"],
            "task_id": task["id"],
            "kind": "assignment",
            "path": "board",
            "size": "small",
            "model": "sonnet-5-5",
            "pace": pace or FASTEST,
        }
    )
    await city.ledger.set_ticket_status(part["id"], "in_progress")
    await city.ledger.update_agent(w["id"], {"ticket_id": part["id"], "worker_state": "working"})
    return mgr, str(goal["id"]), str(w["id"]), str(part["id"])


async def test_a_fail_sends_the_real_reason_and_the_second_fail_hands_the_part_to_a_fresh_worker() -> None:
    city = make_city(scripted_engine({}))
    mgr, gid, wid, part = await setup(city)
    t = await city.ledger.get_ticket(gid)
    review = tool(city, ctx(mgr, gid, str(t["parent_id"])), "review")
    await city.ledger.set_ticket_status(part, "in_review")
    sent = len(city.queue.sent)
    first = await review({"ticket_id": part, "verdict": "FAIL", "reasons": "Still 6 pairs on the board."})
    assert first == "FAIL recorded; sent back to the worker."
    fix = [m for m in city.queue.sent[sent:] if m["agentId"] == wid]
    assert len(fix) == 1 and "Still 6 pairs on the board." in fix[0]["body"] and fix[0]["model"] == "sonnet-5-5"
    await city.ledger.set_ticket_status(part, "in_review")
    out = await review({"ticket_id": part, "verdict": "FAIL", "reasons": "The score counter still expects 6."})
    assert out.startswith("FAIL recorded. Taken over")
    p = await city.ledger.get_ticket(part)
    assert p["status"] == "cancelled" and p["escalated"] == "takeover" and len(p["review_reasons"]) == 2
    assert not await city.ledger.open_questions()  # nobody asked the owner
    w = await city.ledger.get_agent(wid)
    assert w and w["state"] == "retired"  # the worker went home and freed its place
    # The fresh worker on the takeover model gets every reason (decision 287's rule).
    fresh = next(k for k in await city.ledger.child_tickets(gid) if k.get("takeover"))
    assert fresh["model"] == "opus-5-5" and len(fresh["review_reasons"]) == 2
    brief = next(m for m in city.queue.sent if m["ticketId"] == fresh["id"])
    assert "Still 6 pairs" in brief["body"] and "score counter" in brief["body"] and brief["model"] == "opus-5-5"


async def test_the_board_gives_every_goal_and_part_the_fastest_pace() -> None:
    from vaic.shared.hierarchy.board_path import start_small

    city = make_city(scripted_engine({}))
    await make_department(city)
    task = await city.ledger.create_ticket(
        {
            "goal": "game",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            "size": "small",
        }
    )
    dept = await city.ledger.get_department("Writing")
    assert dept
    await start_small(city.deps, task, dept, None)
    (goal,) = await city.ledger.child_tickets(task["id"])
    (part,) = await city.ledger.child_tickets(goal["id"])
    assert goal["pace"] == FASTEST and part["pace"] == FASTEST
    brief = next(m for m in city.queue.sent if m["ticketId"] == part["id"])
    assert "Speed (the owner's fixed rule)" in brief["body"]


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
