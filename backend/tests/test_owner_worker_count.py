"""The owner may say exactly how many workers a task gets ("use 5 agents"): VAIC passes it, the Orchestrator
hands it to the department, and the manager hires exactly that many, beyond the usual caps (2026-11-08)."""

from dataclasses import replace

from test_apps import city_deps as apps_city_deps
from test_apps import tool
from vaic.runtime.tools import TurnCtx
from vaic.shared.hierarchy.factory import Factory


def city_deps():  # type: ignore[no-untyped-def]
    d = apps_city_deps()
    return replace(d, factory=Factory(d.ledger, d.bus, d.settings))


VAIC = TurnCtx(agent_id="vaic", role="vaic", department=None, ticket_id="", task_id="")
SPEC = {"specialty": "Researcher", "instructions": "Research one competitor.", "tools": ["WebSearch"]}


async def test_the_owners_exact_worker_count_reaches_the_manager_and_is_hired_exactly() -> None:
    d = city_deps()
    delegate = tool(d, VAIC, "delegate_to_orchestrator")
    ask = await delegate({"goal": "Research five competitors in depth", "owner_words": "use 5 agents", "workers": 5})
    assert "with 5 agents working at once" in ask
    out = await delegate(
        {"goal": "Research five competitors in depth", "owner_words": "use 5 agents", "workers": 5, "confirm": True}
    )
    assert "(5 workers)" in out
    (task,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert task["workers"] == 5
    assert "exactly 5 workers on this task" in d.queue.sent[-1]["body"]  # type: ignore[attr-defined]

    orch = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"], task_id=task["id"]
    )
    await tool(d, orch, "create_department")({"name": "Writing", "mission": "Writes research reports."})
    sent = await tool(d, orch, "assign_to_department")(
        {"department": "Writing", "goal": "Five competitor profiles", "acceptance": "One page each"}
    )
    assert "(5 workers)" in sent  # one department: the task's number
    (goal,) = await d.ledger.child_tickets(task["id"])
    assert goal["workers"] == 5
    assert "hire exactly that many" in d.queue.sent[-1]["body"]  # type: ignore[attr-defined]

    mgr = goal["to"]
    hire = tool(
        d,
        TurnCtx(agent_id=mgr, role="manager", department="Writing", ticket_id=goal["id"], task_id=task["id"]),
        "hire_worker",
    )
    for _ in range(5):  # above the default cap of 3
        assert (await hire(SPEC)).startswith("Hired ")
    refused = await hire(SPEC)
    assert "the owner asked for exactly 5" in refused


async def test_without_a_number_the_planned_team_applies() -> None:
    d = city_deps()
    await d.ledger.create_ticket({"id": "t-task", "goal": "g", "from": "vaic", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    orch = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t-task", task_id="t-task")
    await tool(d, orch, "create_department")({"name": "Writing", "mission": "Writes research reports."})
    await tool(d, orch, "assign_to_department")({"department": "Writing", "goal": "A report", "acceptance": "Done"})
    (goal,) = await d.ledger.child_tickets("t-task")
    assert "workers" not in goal
    hire = tool(
        d,
        TurnCtx(agent_id=goal["to"], role="manager", department="Writing", ticket_id=goal["id"], task_id="t-task"),
        "hire_worker",
    )
    plan = tool(
        d,
        TurnCtx(agent_id=goal["to"], role="manager", department="Writing", ticket_id=goal["id"], task_id="t-task"),
        "plan_team",
    )
    await plan({"parts": [{"name": f"chapter {i}", "size": "normal"} for i in range(5)]})
    for _ in range(5):  # five parallel parts, five workers: no ceiling (decision 288)
        assert (await hire(SPEC)).startswith("Hired ")
    assert "the team for this goal is 5" in await hire(SPEC)


async def test_assignments_of_released_workers_never_block_the_goal() -> None:
    # The stuck Research goal (2026-11-08): assignments held by released workers stayed open forever, so the
    # manager could never report the goal and kept asking the owner to "purge orphan tickets".
    d = city_deps()
    await d.ledger.create_ticket({"id": "t-task", "goal": "g", "from": "vaic", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    orch = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t-task", task_id="t-task")
    await tool(d, orch, "create_department")({"name": "Writing", "mission": "Writes research reports."})
    await tool(d, orch, "assign_to_department")({"department": "Writing", "goal": "A report", "acceptance": "Done"})
    (goal,) = await d.ledger.child_tickets("t-task")
    mctx = TurnCtx(agent_id=goal["to"], role="manager", department="Writing", ticket_id=goal["id"], task_id="t-task")
    await tool(d, mctx, "plan_team")(
        {"parts": [{"name": "part a", "size": "normal"}, {"name": "part b", "size": "normal"}]}
    )
    w1 = (await tool(d, mctx, "hire_worker")(SPEC)).split()[1]
    w2 = (await tool(d, mctx, "hire_worker")(SPEC)).split()[1]
    for w in (w1, w2):
        await tool(d, mctx, "assign")({"worker_id": w, "goal": "Part", "acceptance": "One page"})
    assert "Not yet" in await tool(d, mctx, "report_to_orchestrator")({"summary": "All done here."})
    # Releasing a worker stops its unfinished assignment; the manager can stop the other one itself.
    assert "1 unfinished assignment stopped" in await tool(d, mctx, "release_worker")({"worker_id": w1})
    left = [k for k in await d.ledger.child_tickets(goal["id"]) if k["status"] not in ("done", "failed", "cancelled")]
    assert len(left) == 1
    assert (await tool(d, mctx, "cancel_assignment")({"ticket_id": left[0]["id"]})).startswith("Stopped")
    assert (
        await tool(d, mctx, "report_to_orchestrator")({"summary": "All done here."}) == "Reported to the Orchestrator."
    )
