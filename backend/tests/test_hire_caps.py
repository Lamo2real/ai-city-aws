"""hire_worker enforces the hard caps: at most max_workers_per_goal live workers on one goal, and at most
max_concurrent_workers_per_department live workers in the department (the owner's choice after a
50-sentence request hired 21 workers)."""

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
            "model": "fable-5-2",
            "parent": "orchestrator",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    return mgr


def hire_tool(city: City, mgr: str, dept: str, ticket: str) -> Any:
    ctx = TurnCtx(agent_id=mgr, role="manager", department=dept, ticket_id=ticket, task_id="task-1", conversation=None)
    return next(t for t in tools_for(city.deps, ctx) if t.name == "hire_worker").handler


async def test_a_fourth_worker_on_the_same_goal_is_refused_but_another_goal_may_hire() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    for _ in range(3):
        assert (await hire(SPEC)).startswith("Hired ")
    refused = await hire(SPEC)
    assert refused.startswith("Hire refused") and "3 workers on this goal" in refused and "cap is 3" in refused
    live = [a for a in await city.ledger.department_agents("Writing") if a.get("kind") == "worker"]
    assert len(live) == 3 and all(a.get("goal_id") == "goal-1" for a in live)
    # The same manager's next goal starts fresh.
    assert (await hire_tool(city, mgr, "Writing", "goal-2")(SPEC)).startswith("Hired ")


async def test_a_released_worker_frees_its_place_on_the_goal() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    ids = [(await hire(SPEC)).split()[1] for _ in range(3)]
    await city.ledger.update_agent(ids[0], {"state": "retired"})
    assert (await hire(SPEC)).startswith("Hired ")


async def test_the_department_ceiling_is_enforced_at_hire_time() -> None:
    city = make_city(scripted_engine({}), max_workers_per_goal=10, max_concurrent_workers_per_department=4)
    mgr = await manager(city)
    for goal in ("goal-1", "goal-2"):
        for _ in range(2):
            assert (await hire_tool(city, mgr, "Writing", goal)(SPEC)).startswith("Hired ")
    refused = await hire_tool(city, mgr, "Writing", "goal-3")(SPEC)
    assert "4 workers at once" in refused and "ceiling is 4" in refused


async def test_the_owner_can_raise_the_goal_cap_in_settings() -> None:
    city = make_city(scripted_engine({}), max_workers_per_goal=5)
    mgr = await manager(city)
    hire = hire_tool(city, mgr, "Writing", "goal-1")
    for _ in range(5):
        assert (await hire(SPEC)).startswith("Hired ")
    assert "cap is 5" in await hire(SPEC)


def manager_tool(city: City, mgr: str, dept: str, ticket: str, name: str) -> Any:
    ctx = TurnCtx(agent_id=mgr, role="manager", department=dept, ticket_id=ticket, task_id="task-1", conversation=None)
    return next(t for t in tools_for(city.deps, ctx) if t.name == name).handler


async def test_idle_leftover_workers_without_a_goal_never_block_a_new_goal() -> None:
    # The Research bug (2026-11-08): three idle workers from earlier work, with no goal recorded, made every
    # new goal "full", and the manager had no way to see or free them.
    city = make_city(scripted_engine({}))
    mgr = await manager(city, "Research")
    hire = hire_tool(city, mgr, "Research", "goal-1")
    for _ in range(3):
        wid = (await hire(SPEC)).split()[1]
        await city.ledger.update_agent(wid, {"goal_id": None, "worker_state": "hired"})
    assert (await hire_tool(city, mgr, "Research", "goal-2")(SPEC)).startswith("Hired ")


async def test_a_refusal_names_the_workers_and_the_manager_can_list_and_release_them() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
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
