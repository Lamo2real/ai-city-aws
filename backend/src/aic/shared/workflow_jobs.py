"""Where workflows meet the team (decisions 126, 127): handing a run to the Orchestrator, and taste questions.

Shared by VAIC's tools (``aic.runtime.workflow_tools``), the team's ``ask_taste`` and the HUD's routes, so a run
handed over or an answer applied is the same whichever way it came.
"""

from __future__ import annotations

from typing import Any

from . import workflows as wf
from .connectors import ConnectorStore
from .hierarchy.actions import CityDeps, instruct_agent, new_ticket, running_jobs, send
from .log import log

Record = dict[str, Any]
FINAL = ("done", "failed", "cancelled")


async def conn_of(d: CityDeps, w: Record) -> Record:
    return wf.connector_info(w, await ConnectorStore(d.ledger.table).list())


async def shown(d: CityDeps, run: Record, w: Record, conn: Record | None = None) -> Record:
    """The run's public form with its taste questions."""
    taste = await wf.Taste(d.ledger.table, d.ledger.now).of_run(run["id"])
    return wf.public(wf.strip(run), w, conn or await conn_of(d, w), taste)


async def emit(d: CityDeps, run: Record, w: Record, conn: Record | None = None) -> None:
    await d.bus.put({"type": "workflow.updated", "run": await shown(d, run, w, conn)})


async def hand_off(d: CityDeps, runs: wf.Runs, run: Record, w: Record) -> tuple[Record, str]:
    """Gives the run to the Orchestrator (the department the workflow names) with its brief; files a taste question
    for every input that was assumed while the owner is away. Returns the run and VAIC's next words."""
    open_cap = int((await d.settings()).get("max_open_jobs") or 3)
    open_jobs = len([j for j in await running_jobs(d) if not j.get("standing_order")])
    if open_jobs >= open_cap:
        return run, (
            f"Not started: {open_jobs} jobs already running (the limit is {open_cap}). Tell the owner; they can "
            "stop one, or raise the limit in Settings."
        )
    # A double tap on Start (or the button and VAIC together) starts one job, not two.
    if run.get("status") == "running" or not await d.ledger.claim(f"wfrun:{run['id']}", 120):
        return run, "That workflow has already started: one job is running for it."
    values = run.get("values") or {}
    conversation = run.get("conversation") or "main"
    goal = f"{w['name']}: {(values.get('offer') or values.get('idea') or {}).get('text') or w['summary']}"[:300]
    t = await new_ticket(
        d,
        {
            "goal": goal,
            "from": "ace",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            "conversation": conversation,
            "brief": wf.brief(run, w),
            "owner_words": str(run.get("owner_words") or "")[:500],
            "workflow_run": run["id"],
        },
    )
    tools = f", with the {w['connector']} connector for the worker" if w.get("connector") else ""
    yes = (
        "The owner's yes to the spend in the brief is their approval of exactly that spend: sign off when the "
        "result matches it."
        if wf.spend(w, values)
        else "The owner is away: finish it end to end without waiting for them; taste questions never block."
        if not run.get("present")
        else "The owner said yes to the plan in the brief."
    )
    await send(
        d,
        {
            "role": "orchestrator",
            "agentId": "orchestrator",
            "department": None,
            "ticketId": t["id"],
            "taskId": t["id"],
            "kind": "task",
            "from": "ace",
            "conversation": conversation,
            "body": (
                f"New task from the owner: the {w['name']} workflow.\nGoal: {goal}\n"
                f"Owner's words: {run.get('owner_words', '')}\n"
                f"Send it to the {w['department']} department{tools}. {yes}"
            ),
        },
    )
    run = await runs.update(run["id"], {"status": "running", "task_id": t["id"]}) or run
    taste = wf.Taste(d.ledger.table, d.ledger.now)
    inputs = {i["key"]: i for i in w.get("inputs") or []}
    assumed = [k for k, v in values.items() if isinstance(v, dict) and v.get("assumed") and k in inputs]
    for k in assumed:
        inp = inputs[k]
        default = str(values[k]["text"])
        options = [o["label"] for o in inp.get("options") or []] or [default, "Something else (tell VAIC)"]
        await taste.add(
            {
                "task_id": t["id"],
                "run_id": run["id"],
                "conversation": conversation,
                "question": inp["question"],
                "options": options,
                "default": default,
                "asked_by": "ace",
            }
        )
    await emit(d, run, w)
    log("info", "workflow.handed", workflow=w["id"], run=run["id"], task=t["id"], assumed=len(assumed))
    went = (
        " Say in one more sentence what you went with for "
        + ", ".join(inputs[k]["label"].lower() for k in assumed)
        + ", and that they can change it any time."
        if assumed
        else ""
    )
    return run, (
        f"Handed to the {w['department']} department as task {t['id']}. Tell the owner, Sir, in one sentence that "
        f"the team is on it and will finish it on its own.{went}"
    )


async def task_of(d: CityDeps, ticket_id: str) -> Record | None:
    """The top-level job a ticket belongs to."""
    t = await d.ledger.get_ticket(ticket_id)
    for _ in range(10):
        if not t or not t.get("parent_id"):
            return t
        t = await d.ledger.get_ticket(str(t["parent_id"]))
    return t


async def ask(d: CityDeps, agent_id: str, ticket_id: str, a: Record) -> str:
    """A manager's or worker's taste question: filed, shown to the owner, never waited on."""
    task = await task_of(d, ticket_id)
    run_id = (task or {}).get("workflow_run")
    try:
        q = await wf.Taste(d.ledger.table, d.ledger.now).add(
            {
                **a,
                "task_id": (task or {}).get("id") or ticket_id,
                "run_id": run_id,
                "conversation": (task or {}).get("conversation") or "main",
                "asked_by": agent_id,
            }
        )
    except wf.Invalid as e:
        return str(e)
    if run_id:
        run = await wf.Runs(d.ledger.table, d.ledger.now).get(str(run_id))
        w = wf.definition(str((run or {}).get("workflow_id")))
        if run and w:
            await emit(d, run, w)
    return (
        f"Asked the owner (taste question {q['id']}). Don't wait: go on with “{q['default']}” now. If they choose "
        "something else, you get a message saying what to change."
    )


async def answer(d: CityDeps, id: str, said: str) -> str:
    """The owner's answer to a taste question. When it differs from what the team went with, it goes to the agent
    who asked (or the Orchestrator when that one has gone home) while the job runs; after the job, VAIC offers a
    change."""
    store = wf.Taste(d.ledger.table, d.ledger.now)
    q = await store.get(id)
    if not q or q.get("status") != "open":
        return "That question was already answered or does not exist."
    picked = next((o for o in q.get("options") or [] if wf.same_choice(o, said)), said)
    q = await store.answer(id, picked)
    if not q:
        return "That question was already answered or does not exist."
    run = await wf.Runs(d.ledger.table, d.ledger.now).get(str(q.get("run_id") or ""))
    w = wf.definition(str((run or {}).get("workflow_id")))
    if run and w:
        await emit(d, run, w)
    if wf.same_choice(picked, str(q["default"])):
        return f"Kept “{picked}”: that is what the team went with."
    task = await d.ledger.get_ticket(str(q.get("task_id") or ""))
    change = (
        f"The owner answered your question “{q['question']}”: “{picked}” (you went with “{q['default']}”). "
        "Change it to match."
    )
    if task and task.get("status") not in FINAL:
        asker = await d.ledger.get_agent(str(q.get("asked_by") or ""))
        if asker and asker.get("state") != "retired" and asker.get("kind") in ("worker", "manager"):
            await instruct_agent(d, asker["id"], change)
            return f"Sent to {asker['id']}: they change it to “{picked}”."
        await send(
            d,
            {
                "role": "orchestrator",
                "agentId": "orchestrator",
                "department": None,
                "ticketId": task["id"],
                "taskId": task["id"],
                "kind": "instruction",
                "from": "owner",
                "body": f"Direct instruction from the owner for task {task['id']}: {change} Pass it to the team "
                "doing it.",
            },
        )
        return f"Sent to the team: they change it to “{picked}”."
    return (
        f"Noted “{picked}”, but the job has finished. Offer the owner to have the team change it (for an app, "
        "delegate_to_orchestrator with its app_id)."
    )
