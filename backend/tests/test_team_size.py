"""Team sizing (decision 283): as many workers as parts that can run at the same time, and no more."""

from typing import Any

import pytest

from city_support import make_city, scripted_engine
from test_hire_caps import SPEC, manager
from vaic.shared.hierarchy.actions import status_summary
from vaic.shared.hierarchy.team_size import Part, PlanError, parse_parts, size_team


def size(parts: list[dict[str, Any]], ceiling: int = 3, hard_cap: int = 10, asked: int | None = None) -> Any:
    return size_team(parse_parts(parts), ceiling=ceiling, hard_cap=hard_cap, owner_asked=asked)


def test_a_tiny_edit_gets_one_worker() -> None:
    t = size([{"name": "change to 4 pairs", "size": "tiny"}])
    assert t.workers == 1 and t.reason.startswith("1 worker: a small change")


def test_several_tiny_edits_share_one_worker() -> None:
    assert size([{"name": f"edit {i}", "size": "tiny"} for i in range(6)]).workers == 1


def test_three_independent_parts_get_three_workers() -> None:
    t = size(
        [
            {"name": "UI", "size": "normal"},
            {"name": "game logic", "size": "normal"},
            {"name": "tests", "size": "normal"},
        ]
    )
    assert t.workers == 3 and t.reason == "3 workers: UI, game logic and tests run in parallel"


def test_a_dependent_chain_needs_fewer() -> None:
    t = size(
        [
            {"name": "schema", "size": "normal"},
            {"name": "API", "size": "normal", "after": ["schema"]},
            {"name": "UI", "size": "normal", "after": ["API"]},
        ]
    )
    assert t.workers == 1 and "one after another" in t.reason
    assert t.waves == (("schema",), ("API",), ("UI",))


def test_the_widest_wave_decides_and_tiny_parts_ride_along() -> None:
    t = size(
        [
            {"name": "data model", "size": "normal"},
            {"name": "bump version", "size": "tiny"},
            {"name": "UI", "size": "normal", "after": ["data model"]},
            {"name": "game logic", "size": "normal", "after": ["data model"]},
        ]
    )
    assert t.workers == 2 and t.reason.startswith("2 workers: UI and game logic run in parallel")


def test_the_owner_override_wins_over_the_parts() -> None:
    t = size([{"name": "change to 4 pairs", "size": "tiny"}], asked=5)
    assert t.workers == 5 and t.reason == "5 workers: the owner asked for 5"


def test_caps_are_respected() -> None:
    many = [{"name": f"part {i}", "size": "normal"} for i in range(8)]
    assert size(many, ceiling=3).workers == 3 and "capped at 3" in size(many, ceiling=3).reason
    assert size(many, ceiling=20, hard_cap=4).workers == 4
    over = size(many, hard_cap=10, asked=40)
    assert over.workers == 10 and "the owner asked for 40 (the ceiling is 10)" in over.reason


def test_bad_plans_are_refused() -> None:
    with pytest.raises(PlanError):
        parse_parts([])
    with pytest.raises(PlanError):
        parse_parts([{"name": "a", "after": ["nope"]}])
    with pytest.raises(PlanError):
        size_team([Part("a", after=("b",)), Part("b", after=("a",))], ceiling=3, hard_cap=10)


# ---------- the manager's planner ----------


async def goal(city: Any, mgr: str, workers: int | None = None) -> str:
    task = await city.ledger.create_ticket(
        {
            "goal": "memory game with 4 pairs",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
        }
    )
    await city.ledger.set_ticket_status(task["id"], "in_progress")
    g = await city.ledger.create_ticket(
        {
            "goal": "change the memory game to 4 pairs",
            "acceptance": "4 pairs",
            "from": "orchestrator",
            "to": mgr,
            "department": "Application",
            "parent_id": task["id"],
            "kind": "assignment",
            **({"workers": workers} if workers else {}),
        }
    )
    return str(g["id"]), str(task["id"])  # type: ignore[return-value]


def tool(city: Any, mgr: str, goal_id: str, task_id: str, name: str) -> Any:
    from vaic.runtime.tools import TurnCtx, tools_for

    ctx = TurnCtx(
        agent_id=mgr, role="manager", department="Application", ticket_id=goal_id, task_id=task_id, conversation=None
    )
    return next(t for t in tools_for(city.deps, ctx) if t.name == name).handler


async def test_the_planner_sizes_a_tiny_change_to_one_worker_and_logs_why() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city, "Application")
    gid, tid = await goal(city, mgr)  # type: ignore[misc]
    hire = tool(city, mgr, gid, tid, "hire_worker")
    said = await tool(city, mgr, gid, tid, "plan_team")({"parts": [{"name": "change to 4 pairs", "size": "tiny"}]})
    assert "Hire exactly 1" in said
    g = await city.ledger.get_ticket(gid)
    assert g["team_size"] == 1 and g["team_reason"].startswith("1 worker:")
    notes = [h["note"] for h in await city.ledger.ticket_history(gid)]
    assert any(n.startswith("Team for Application: 1 worker") for n in notes)
    assert any("1 worker" in line for line in (await status_summary(city.deps))["teams"])
    assert (await hire(SPEC)).startswith("Hired ")
    refused = await hire(SPEC)
    assert refused.startswith("Hire refused") and "the team for this goal is 1" in refused


async def test_three_parallel_parts_hire_three_and_a_new_part_mid_build_adds_one() -> None:
    city = make_city(scripted_engine({}), max_workers_per_goal=5)
    mgr = await manager(city, "Application")
    gid, tid = await goal(city, mgr)  # type: ignore[misc]
    plan = tool(city, mgr, gid, tid, "plan_team")
    parts = [{"name": n, "size": "normal"} for n in ("UI", "game logic", "tests")]
    assert "3 workers: UI, game logic and tests run in parallel" in await plan({"parts": parts})
    hire = tool(city, mgr, gid, tid, "hire_worker")
    for _ in range(3):
        assert (await hire(SPEC)).startswith("Hired ")
    assert (await hire(SPEC)).startswith("Hire refused")
    # The same plan again changes nothing; a new independent part grows the team by one, logged.
    assert "The team stays at 3" in await plan({"parts": parts})
    assert "Team grows to 4" in await plan({"parts": [*parts, {"name": "sound effects", "size": "normal"}]})
    notes = [h["note"] for h in await city.ledger.ticket_history(gid)]
    assert any("added 1 for the new part sound effects" in n for n in notes)
    assert (await hire(SPEC)).startswith("Hired ")


async def test_the_owners_number_is_used_without_a_plan_and_logged() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city, "Application")
    gid, tid = await goal(city, mgr, workers=5)  # type: ignore[misc]
    hire = tool(city, mgr, gid, tid, "hire_worker")
    for _ in range(5):
        assert (await hire(SPEC)).startswith("Hired ")
    assert "the owner asked for exactly 5" in await hire(SPEC)
    g = await city.ledger.get_ticket(gid)
    assert g["team_size"] == 5 and g["team_reason"] == "5 workers: the owner asked for 5"


async def test_without_a_plan_a_goal_gets_one_worker_and_says_why() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city, "Application")
    gid, tid = await goal(city, mgr)  # type: ignore[misc]
    hire = tool(city, mgr, gid, tid, "hire_worker")
    assert (await hire(SPEC)).startswith("Hired ")
    assert "the team for this goal is 1" in await hire(SPEC)
    assert (await city.ledger.get_ticket(gid))["team_reason"].startswith("1 worker: no parts were listed")
    # Planning afterwards sizes it from the parts.
    parts = [{"name": n, "size": "normal"} for n in ("UI", "game logic")]
    assert "Hire exactly 2" in await tool(city, mgr, gid, tid, "plan_team")({"parts": parts})
    assert (await hire(SPEC)).startswith("Hired ")
