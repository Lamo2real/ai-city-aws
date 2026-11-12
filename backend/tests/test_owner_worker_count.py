"""The owner may say exactly how many workers a task gets ("use 5 agents"): VAIC passes it, the board's planner is told
to write that many parts that run at once, and each part gets its own worker straight away (decisions 283, 298)."""

from dataclasses import replace

from test_apps import city_deps as apps_city_deps
from test_apps import tool
from vaic.runtime.tools import TurnCtx
from vaic.shared.hierarchy.factory import Factory


def city_deps():  # type: ignore[no-untyped-def]
    d = apps_city_deps()
    return replace(d, factory=Factory(d.ledger, d.bus, d.settings))


VAIC = TurnCtx(agent_id="vaic", role="vaic", department=None, ticket_id="", task_id="")


async def test_the_owners_exact_worker_count_reaches_the_planner_and_every_part_starts_at_once() -> None:
    d = city_deps()
    await d.ledger.create_department("Writing", "Writes research reports.", "mgr-writing")
    delegate = tool(d, VAIC, "start_job")
    ask = await delegate({"goal": "Research five competitors in depth", "owner_words": "use 5 agents", "workers": 5})
    assert "with 5 agents working at once" in ask
    out = await delegate(
        {"goal": "Research five competitors in depth", "owner_words": "use 5 agents", "workers": 5, "confirm": True}
    )
    assert "5 workers" in out
    (task,) = [t for t in await d.ledger.list_tickets(("open", "in_progress")) if t.get("kind") == "task"]
    assert task["workers"] == 5 and task["planned"] and task["size_by_owner"]
    brief = d.queue.sent[-1]  # type: ignore[attr-defined]
    assert brief["role"] == "orchestrator" and "exactly 5 agents" in brief["body"]

    planner = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"], task_id=task["id"]
    )
    await tool(d, planner, "write_contract")({"summary": "Five one-page competitor profiles, same headings."})
    add = tool(d, planner, "add_part")
    for i in range(5):  # no ceiling (decision 288): every part that waits for nothing gets its worker now
        said = await add(
            {
                "name": f"Competitor {i + 1}",
                "goal": f"Profile competitor {i + 1}",
                "acceptance": "One page",
                "department": "Writing",
            }
        )
        assert said.endswith("its worker starts now.")
    workers = [a for a in await d.ledger.department_agents("Writing") if a["kind"] == "worker"]
    assert len(workers) == 5 and all(w["state"] == "active" for w in workers)
