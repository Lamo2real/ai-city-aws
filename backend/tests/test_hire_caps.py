"""hire_worker hires up to the goal's planned team (decision 283) and has no other ceiling: the owner removed every
agent-count limit (decision 288)."""

from typing import Any

from city_support import City, make_city, scripted_engine
from vaic.runtime.tools import TurnCtx, tools_for

SPEC = {"specialty": "Writer", "instructions": "Write the piece.", "tools": ["Read"], "budget_hint_usd": 1}


async def manager(city: City, name: str = "Writing") -> str:
    mgr = f"mgr-{name.lower()}"
    await city.ledger.create_department(name, f"{name} work.", mgr)
    await city.ledger.put_agent(
        {
            "id": mgr,
            "kind": "manager",
            "role": f"{name} Manager",
            "department": name,
            "model": "fable-5-1",
            "parent": "orchestrator",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    return mgr


def hire_tool(city: City, mgr: str, dept: str, ticket: str) -> Any:
    ctx = TurnCtx(agent_id=mgr, role="manager", department=dept, ticket_id=ticket, task_id="task-1", conversation=None)
    return next(t for t in tools_for(city.deps, ctx) if t.name == "hire_worker").handler


async def goal(city: City, mgr: str, gid: str, team: int) -> None:
    await city.ledger.create_ticket(
        {
            "id": gid,
            "goal": "g",
            "from": "orchestrator",
            "to": mgr,
            "department": "Writing",
            "parent_id": None,
            "kind": "assignment",
            "team_size": team,
            "team_parts": [f"p{i}" for i in range(team)],
        }
    )


async def test_a_hire_beyond_the_planned_team_is_refused_but_another_goal_may_hire() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    await goal(city, mgr, "goal-1", 3)
    await goal(city, mgr, "goal-2", 1)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    for _ in range(3):
        assert (await hire(SPEC)).startswith("Hired ")
    refused = await hire(SPEC)
    assert (
        refused.startswith("Hire refused")
        and "3 workers on this goal" in refused
        and "team for this goal is 3" in refused
    )
    assert (await hire_tool(city, mgr, "Writing", "goal-2")(SPEC)).startswith("Hired ")


async def test_a_released_worker_frees_its_place_on_the_goal() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    await goal(city, mgr, "goal-1", 3)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    ids = [(await hire(SPEC)).split()[1] for _ in range(3)]
    await city.ledger.update_agent(ids[0], {"state": "retired"})
    assert (await hire(SPEC)).startswith("Hired ")


async def test_a_wide_goal_gets_every_worker_it_planned_with_no_department_ceiling() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    await goal(city, mgr, "goal-1", 150)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    for _ in range(150):
        assert (await hire(SPEC)).startswith("Hired ")
    live = [a for a in await city.ledger.department_agents("Writing") if a.get("kind") == "worker"]
    assert len(live) == 150


def manager_tool(city: City, mgr: str, dept: str, ticket: str, name: str) -> Any:
    ctx = TurnCtx(agent_id=mgr, role="manager", department=dept, ticket_id=ticket, task_id="task-1", conversation=None)
    return next(t for t in tools_for(city.deps, ctx) if t.name == name).handler


async def test_idle_leftover_workers_without_a_goal_never_block_a_new_goal() -> None:
    # The Research bug (2026-11-08): three idle workers from earlier work, with no goal recorded, made every
    # new goal "full", and the manager had no way to see or free them.
    city = make_city(scripted_engine({}))
    mgr = await manager(city, "Research")
    for g in ("goal-1", "goal-2"):
        await city.ledger.create_ticket({"id": g, "goal": "g", "from": "orchestrator", "to": mgr, "department": "Research",
                                         "parent_id": None, "kind": "assignment", "team_size": 3, "team_parts": ["a"]})  # fmt: skip
    hire = hire_tool(city, mgr, "Research", "goal-1")
    for _ in range(3):
        wid = (await hire(SPEC)).split()[1]
        await city.ledger.update_agent(wid, {"goal_id": None, "worker_state": "hired"})
    assert (await hire_tool(city, mgr, "Research", "goal-2")(SPEC)).startswith("Hired ")


async def test_a_refusal_names_the_workers_and_the_manager_can_list_and_release_them() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    await goal(city, mgr, "goal-1", 3)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    ids = [(await hire(SPEC)).split()[1] for _ in range(3)]
    refused = await hire(SPEC)
    assert all(i in refused for i in ids) and "release_worker" in refused
    listed = await manager_tool(city, mgr, "Writing", "goal-1", "my_workers")({})
    assert all(i in listed for i in ids) and "this goal" in listed
    assert (await manager_tool(city, mgr, "Writing", "goal-1", "release_worker")({"worker_id": ids[0]})).startswith(
        "Released"
    )
    assert (await hire(SPEC)).startswith("Hired ")


def test_hire_worker_offers_only_real_tool_names() -> None:
    city = make_city(scripted_engine({}))
    ctx = TurnCtx(agent_id="mgr-x", role="manager", department="X", ticket_id="g", task_id="t", conversation=None)
    spec = next(t for t in tools_for(city.deps, ctx) if t.name == "hire_worker")
    from vaic.shared.hierarchy.factory import WORKER_TOOLS

    assert spec.schema["properties"]["tools"]["items"]["enum"] == list(WORKER_TOOLS)
