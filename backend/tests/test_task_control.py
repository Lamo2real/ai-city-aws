"""VAIC can look at one of the owner's jobs and stop it, in plain words (the owner's "idiot-proof" ask):
find the job by the owner's own words, describe its progress without ids or inside words, confirm before
stopping, and when stopping: cancel every open part, send the workers home, drop what is still queued."""

from typing import Any

from city_support import City, make_city, scripted_engine
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared.hierarchy.actions import status_summary
from vaic.shared.hierarchy.tasks import cancel_preview, describe_task, find_task, which_one

SPEC = {"specialty": "Writer", "instructions": "Write the piece well.", "tools": ["Read"], "budget_hint_usd": 1}


async def city() -> City:
    c = make_city(scripted_engine({}))
    await c.host.ensure_core()
    return c


async def department(c: City, name: str = "Writing") -> str:
    mgr = f"mgr-{name.lower()}"
    await c.ledger.create_department(name, f"{name} work.", mgr)
    await c.ledger.put_agent(
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


async def job(
    c: City, goal: str, owner_words: str, department_name: str = "Writing", workers: int = 2
) -> dict[str, Any]:
    """A task from the owner → a department goal → `workers` assignments with live workers on them."""
    mgr = await department(c, department_name)
    task = await c.ledger.create_ticket(
        {"goal": goal, "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task",
         "owner_words": owner_words, "status": "in_progress"}
    )  # fmt: skip
    goal_t = await c.ledger.create_ticket(
        {"goal": goal, "from": "orchestrator", "to": mgr, "department": department_name, "parent_id": task["id"],
         "kind": "assignment", "status": "in_progress"}
    )  # fmt: skip
    for i in range(workers):
        w = await c.factory.hire(SPEC, mgr, department_name)
        a = await c.ledger.create_ticket(
            {"goal": f"part {i + 1}", "from": mgr, "to": w["id"], "department": department_name,
             "parent_id": goal_t["id"], "kind": "assignment", "status": "in_progress"}
        )  # fmt: skip
        await c.ledger.update_agent(w["id"], {"ticket_id": a["id"], "worker_state": "working", "total_cost_usd": 0.4})
    return task


def vaic_tools(c: City) -> dict[str, Any]:
    ctx = TurnCtx(agent_id="vaic", role="vaic", department=None, ticket_id="conv-main", task_id="conv-main")
    return {t.name: t for t in tools_for(c.host.d, ctx)}


async def test_finds_the_job_by_the_owners_words_and_describes_it_plainly() -> None:
    c = await city()
    await job(c, "Write 50 sentences comparing the GT3 and GT3 RS flat-six engines", "porsche gt3 vs gt3 rs sentences")
    await job(c, "Build a snake game for the owner", "I'm bored, make me a snake game", "Apps", workers=1)
    task, candidates = await find_task(c.ledger, "the Porsche sentences")
    assert task is not None and "GT3" in task["goal"] and candidates == []
    text = await describe_task(c.ledger, task)
    assert "2 workers on it right now" in text
    assert "0 of 2 parts done" in text
    assert "Team: Writing" in text
    assert "about $0.80" in text
    assert text.endswith("Say stop if you want me to cancel it.")
    ids = [t["id"] for t in await c.ledger.list_tickets(["in_progress"])] + [
        a["id"] for a in await c.ledger.list_agents()
    ]
    assert ids and not any(i in text for i in ids) and "ticket" not in text  # nothing the owner shouldn't hear


async def test_a_vague_question_asks_which_job_and_nothing_matching_says_so() -> None:
    c = await city()
    await job(c, "Write 50 sentences about the GT3", "porsche sentences")
    await job(c, "Write 50 sentences about the Cayman", "porsche cayman sentences", "Marketing", workers=1)
    task, candidates = await find_task(c.ledger, "the Porsche sentences")
    assert task is None and len(candidates) == 2
    assert which_one(candidates).startswith("Which one do you mean?")
    none, _ = await find_task(c.ledger, "the lasagna recipe")
    assert none is None and which_one([]).startswith("I can't find a job like that")
    # With one job running and no words, that's the one.
    one = await city()
    await job(one, "Write the thing", "the thing")
    only, _ = await find_task(one.ledger, "")
    assert only is not None


async def test_cancelling_asks_first_then_stops_parts_sends_workers_home_and_tells_the_city() -> None:
    c = await city()
    task = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences")
    tools = vaic_tools(c)
    ask = await tools["cancel_task"].handler({"query": "the Porsche sentences", "confirm": False})
    assert ask.startswith("Stop the job “Write 50 sentences") and "2 workers on it, about $0.80 so far" in ask
    assert (await c.ledger.get_ticket(task["id"]))["status"] == "in_progress"  # nothing stopped yet

    said = await tools["cancel_task"].handler({"query": "the Porsche sentences", "confirm": True})
    assert "3 parts cancelled" in said and "2 workers sent home" in said
    assert (await c.ledger.get_ticket(task["id"]))["status"] == "cancelled"
    kids = await c.ledger.child_tickets(task["id"])
    assert kids and all(k["status"] == "cancelled" for k in kids)
    workers = [a for a in await c.ledger.list_agents() if a["kind"] == "worker"]
    assert workers and all(w["state"] == "retired" for w in workers)
    assert len(c.bus.of_type("agent.retired")) == 2  # the City view sees them leave
    cancelled = [e for e in c.bus.of_type("ticket.status") if e["ticket"]["status"] == "cancelled"]
    assert len(cancelled) == 4  # the job and its three parts
    again = await tools["cancel_task"].handler({"query": "the Porsche sentences", "confirm": True})
    assert "not running" in again
    assert "was stopped" in await tools["get_task_status"].handler({"query": "porsche"})


async def test_queued_work_for_a_cancelled_job_is_dropped_by_the_dispatcher() -> None:
    c = await city()
    task = await job(c, "Write 50 sentences about the GT3", "porsche sentences", workers=1)
    kids = await c.ledger.child_tickets(task["id"])
    goal = kids[0]
    await c.queue.send(
        {"id": "m-late", "role": "manager", "agentId": goal["to"], "department": "Writing", "ticketId": goal["id"],
         "taskId": task["id"], "kind": "report", "from": "wkr-x", "body": "done"}  # type: ignore[arg-type]
    )  # fmt: skip
    await vaic_tools(c)["cancel_task"].handler({"query": "porsche", "confirm": True})
    before = len(c.invocations)
    await c.run()
    assert len(c.invocations) == before  # the late message never reaches a runtime


async def test_status_summary_speaks_of_jobs_and_says_when_no_limit_is_set() -> None:
    c = await city()
    await job(c, "Write 50 sentences", "sentences", workers=1)
    s = await status_summary(c.host.d)
    assert s["jobs_running"] == 3 and s["jobs_waiting_for_owner"] == 0
    assert "tickets_running" not in s
    assert s["spend_today"].startswith("about $") and "no spending limit is set" in s["spend_today"]


async def test_a_quiet_job_is_called_stuck() -> None:
    c = await city()
    task = await job(c, "Write 50 sentences", "sentences", workers=1)
    c.advance(40 * 60_000)
    text = await describe_task(c.ledger, task)
    assert "may be stuck" in text and "Nothing has happened for 40 minutes" in text
    assert "Stop the job" in await cancel_preview(c.ledger, task)


async def test_stopping_a_job_withdraws_its_questions_and_approvals_and_a_sweep_clears_old_leftovers() -> None:
    from vaic.shared.hierarchy.actions import sweep_stale_asks

    c = await city()
    task = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences")
    part = (await c.ledger.child_tickets(task["id"]))[0]
    q = await c.ledger.ask_question(
        {"asked_by": "mgr-writing", "path": "mgr-writing", "ticket_id": part["id"], "text": "Which engine first?",
         "options": ["GT3", "GT3 RS"], "default_answer": "GT3"}
    )  # fmt: skip
    ap = await c.ledger.request_approval(
        {"agent": "mgr-writing", "ticket_id": part["id"], "tool": "Bash", "action": "rm x", "hash": "h1",
         "reason": "r", "kind": "tool"}
    )  # fmt: skip
    app_ap = await c.ledger.request_approval(  # an app's approval belongs to no job: it stays
        {"agent": "app", "tool": "calendar", "action": "accept", "hash": "h2", "reason": "r", "kind": "tool"}
    )
    await vaic_tools(c)["cancel_task"].handler({"query": "the Porsche sentences", "confirm": True})
    assert await c.ledger.open_questions() == []
    assert [a["id"] for a in await c.ledger.pending_approvals()] == [app_ap["id"]]
    assert (await c.ledger.get_question(q["id"]))["status"] == "withdrawn"
    assert [e["id"] for e in c.bus.of_type("question.withdrawn")] == [q["id"]]
    assert [e["id"] for e in c.bus.of_type("approval.withdrawn")] == [ap["id"]]

    # Left behind before this fix: asks on a finished ticket and on one that no longer exists are swept.
    done = await c.ledger.create_ticket(
        {"goal": "old", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task",
         "status": "done"}
    )  # fmt: skip
    live = await c.ledger.create_ticket(
        {"goal": "live", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task",
         "status": "waiting_on_owner"}
    )  # fmt: skip
    for tid in (done["id"], "t-gone", live["id"]):
        await c.ledger.ask_question({"asked_by": "x", "path": "x", "ticket_id": tid, "text": "?", "options": [],
                                     "default_answer": "ok"})  # fmt: skip
    assert await sweep_stale_asks(c.ledger, c.bus) == 2
    assert [x["ticket_id"] for x in await c.ledger.open_questions()] == [live["id"]]  # the live job's stays
    assert await sweep_stale_asks(c.ledger, c.bus) == 0


async def test_the_work_screen_lists_jobs_not_parts_in_plain_words_with_progress() -> None:
    from vaic.shared.hierarchy.tasks import job_rows

    c = await city()
    task = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences", workers=3)
    goal = (await c.ledger.child_tickets(task["id"]))[0]
    parts = await c.ledger.child_tickets(goal["id"])
    await c.ledger.set_ticket_status(parts[0]["id"], "done", "")
    await c.ledger.set_ticket_status(parts[1]["id"], "in_review", "")
    (row,) = await job_rows(c.ledger)
    assert (row["id"], row["name"], row["words"]) == (task["id"], "Porsche sentences", "Being checked")
    assert (row["parts_done"], row["parts_total"]) == (1, 3)
    await c.ledger.set_ticket_status(parts[2]["id"], "waiting_on_owner", "")
    assert (await job_rows(c.ledger))[0]["words"] == "Waiting for you"  # what needs the owner wins
    assert await job_rows(c.ledger, finished=True) == []
    await c.ledger.set_ticket_status(task["id"], "done", "")
    assert [r["words"] for r in await job_rows(c.ledger, finished=True)] == ["Done"]
