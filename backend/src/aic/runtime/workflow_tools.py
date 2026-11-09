"""AIC's tools for AI workflows (decision 126, ``aic.shared.workflows``).

AIC recognises a workflow (the turn's prompt names it), the owner says yes (or asked for it directly), then AIC
either walks them through it page by page or, in ``do`` mode, hands it to the Orchestrator with a brief once every
input is known and the owner said yes to the money shown. Every tool answers with the one next thing AIC says, so
it never asks for something twice. All of them pass the policy gate like every city tool (``gate_tools``).
"""

from __future__ import annotations

from typing import Any

from aic.shared import workflows as wf
from aic.shared.connectors import ConnectorStore
from aic.shared.hierarchy.actions import CityDeps, new_ticket, running_jobs, send
from aic.shared.log import log

from .tools import ToolSpec, TurnCtx, _obj, _s

_MODE = {"type": "string", "enum": list(wf.MODES)}
_VALUES = {
    "type": "object",
    "description": 'input key → the owner\'s own words for it ("daily_budget": "300")',
}
CONFIRM_KEY = "__confirm__"


async def _conn(d: CityDeps, w: dict[str, Any]) -> dict[str, Any]:
    return wf.connector_info(w, await ConnectorStore(d.ledger.table).list())


async def emit(d: CityDeps, run: dict[str, Any], w: dict[str, Any], conn: dict[str, Any] | None = None) -> None:
    await d.bus.put({"type": "workflow.updated", "run": wf.public(run, w, conn or await _conn(d, w))})


async def next_words(d: CityDeps, c: TurnCtx, runs: wf.Runs, run: dict[str, Any], w: dict[str, Any]) -> str:
    """Records what is being asked, shows it on the owner's screen, and tells AIC the one thing to say."""
    conn = await _conn(d, w)
    need = wf.next_need(run, w, bool(conn["connected"]))
    kind = need["kind"]
    if kind in ("input", "mode", "confirm"):
        run = await wf.mark_asked(runs, run, need.get("key") or (CONFIRM_KEY if kind == "confirm" else kind))
    if kind == "confirm" and run.get("confirm_shown_in") != (c.message_id or "?"):
        # The yes to the money must come in a later message than the one the money was shown in.
        run = await runs.update(run["id"], {"confirm_shown_in": c.message_id or "?"}) or run
    await emit(d, run, w, conn)
    if need.get("options") and kind in ("input", "mode", "confirm", "step"):
        await d.bus.put(
            {
                "type": "ace.question",
                "conversation": c.conversation or "main",
                "question": str(need["question"])[:200],
                "options": [str(o)[:60] for o in need["options"]][:5],
            }
        )
    head = f"{w['name']} [{run['id']}]: "
    if kind == "input":
        return head + f"ask the owner exactly this, nothing else, and stop: “{need['question']}”"
    if kind == "mode":
        return (
            head
            + f"ask the owner exactly this and stop: “{need['question']}”"
            + (
                ""
                if conn["connected"]
                else f" (Doing it for them needs {conn['label']} connected first, in {conn['where']}; walking them "
                "through it works now.)"
            )
        )
    if kind == "connect":
        return head + (
            f"{conn['label']} isn't connected yet, so nothing was created. Tell the owner to switch on "
            f"{conn['label']} in {conn['where']} and sign in with their {conn['label']} account; then say "
            "“go on” and you carry on. Offer to walk them through it by hand meanwhile (update_workflow mode guide)."
        )
    if kind == "confirm":
        pub = wf.public(run, w, conn)
        answers = "; ".join(f"{i['label']}: {i['value']}" for i in pub["inputs"])
        money = f" What it spends: {pub['spend']['text']}." if pub["spend"] else ""
        return head + (
            f"everything is known. In two or three short sentences, read the owner the plan ({answers}).{money} "
            "Then ask “Shall I create it, Sir?” and stop. On their clear yes, call run_workflow with confirm=true."
        )
    if kind == "step":
        steps = w.get("steps") or []
        i = int(run.get("step") or 0)
        page = wf.public(run, w, conn)["steps"][i]
        last = i >= len(steps) - 1
        return head + (
            f"page {i + 1} of {len(steps)}, “{page['title']}” (it is on the owner's screen): {page['guide']} "
            "Tell the owner in one or two sentences what to do on this page, then stop. When they say it's done, "
            f"call workflow_step with to={'done' if last else 'next'}."
        )
    if run.get("status") == "done":
        return head + "the walkthrough is finished. Congratulate the owner in one sentence."
    if run.get("status") == "running":
        return head + f"the team is doing it as task {run.get('task_id')}."
    return head + f"this workflow is {run.get('status')}."


def _values(a: dict[str, Any]) -> dict[str, Any]:
    v = a.get("values")
    return v if isinstance(v, dict) else {}


async def _pick(runs: wf.Runs, c: TurnCtx, run_id: Any) -> dict[str, Any] | None:
    if run_id:
        return await runs.get(str(run_id))
    return await runs.live_in(c.conversation or "main")


def workflow_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    runs = wf.Runs(d.ledger.table, d.ledger.now)

    async def start(a: dict[str, Any]) -> str:
        w = wf.definition(str(a.get("workflow_id") or ""))
        if not w:
            return "There is no such workflow. Known: " + ", ".join(
                f"{x['id']} ({x['name']})" for x in wf.definitions()
            )
        words = str(a.get("owner_words") or "")
        direct = any(m["id"] == w["id"] and m["direct"] for m in wf.recognise(words))
        if not c.from_owner or not (direct or a.get("owner_confirmed") is True):
            return (
                f"Not started. Ask the owner first: “Is this what you mean, Sir: the {w['name']} workflow?” and start "
                "it only after their yes (owner_confirmed=true)."
            )
        conversation = c.conversation or "main"
        if live := await runs.live_in(conversation):
            if live["workflow_id"] == w["id"]:
                return await next_words(d, c, runs, live, w)
            await wf.cancel(runs, live)  # one workflow at a time per conversation: the owner moved on
        values = wf.extract(w, words, runs.today())
        run = await runs.create(w, conversation, words, values, a.get("mode") or wf.mode_in(words))
        run, problems = await wf.set_values(runs, run, w, _values(a))
        log(
            "info", "workflow.started", workflow=w["id"], run=run["id"], known=",".join(sorted(run.get("values") or {}))
        )
        return (" ".join(problems) + " " if problems else "") + await next_words(d, c, runs, run, w)

    async def update(a: dict[str, Any]) -> str:
        run = await _pick(runs, c, a.get("run_id"))
        if not run or run.get("status") not in wf.LIVE:
            return "No workflow is in progress here."
        w = wf.definition(run["workflow_id"])
        if not w:
            return "That workflow no longer exists."
        try:
            if a.get("mode"):
                run = await wf.set_mode(runs, run, str(a["mode"]))
        except wf.Invalid as e:
            return str(e)
        run, problems = await wf.set_values(runs, run, w, _values(a))
        prefix = ("Tell the owner: " + " ".join(problems) + " Then ") if problems else ""
        return prefix + await next_words(d, c, runs, run, w)

    async def step(a: dict[str, Any]) -> str:
        run = await _pick(runs, c, a.get("run_id"))
        if not run:
            return "No workflow is in progress here."
        w = wf.definition(run["workflow_id"])
        if not w:
            return "That workflow no longer exists."
        try:
            run = await wf.move(runs, run, w, str(a.get("to") or "next"))
        except wf.Invalid as e:
            return str(e)
        return await next_words(d, c, runs, run, w)

    async def go(a: dict[str, Any]) -> str:
        run = await _pick(runs, c, a.get("run_id"))
        if not run or run.get("status") != "active":
            return "No workflow is waiting to be created here."
        w = wf.definition(run["workflow_id"])
        if not w:
            return "That workflow no longer exists."
        conn = await _conn(d, w)
        need = wf.next_need(run, w, bool(conn["connected"]))
        if need["kind"] != "confirm":
            return "Not yet: " + await next_words(d, c, runs, run, w)
        shown = run.get("confirm_shown_in")
        if not a.get("confirm") or not c.from_owner or not shown or shown == (c.message_id or "?"):
            return await next_words(d, c, runs, run, w)
        open_cap = int((await d.settings()).get("max_open_jobs") or 3)
        open_jobs = len([j for j in await running_jobs(d) if not j.get("standing_order")])
        if open_jobs >= open_cap:
            return (
                f"Not started: {open_jobs} jobs already running (the limit is {open_cap}). Tell the owner; they can "
                "stop one, or raise the limit in Settings."
            )
        brief = wf.brief(run, w)
        goal = f"{w['name']}: {(run.get('values') or {}).get('offer', {}).get('text') or w['summary']}"
        t = await new_ticket(
            d,
            {
                "goal": goal,
                "from": "ace",
                "to": "orchestrator",
                "department": None,
                "parent_id": None,
                "kind": "task",
                "conversation": run.get("conversation") or "main",
                "brief": brief,
                "owner_words": str(run.get("owner_words") or "")[:500],
                "workflow_run": run["id"],
            },
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
                "conversation": run.get("conversation") or "main",
                "body": (
                    f"New task from the owner: the {w['name']} workflow, which they confirmed with the money shown.\n"
                    f"Goal: {goal}\nOwner's words: {run.get('owner_words', '')}\n"
                    f"Send it to the {w['department']} department, with the {w['connector']} connector for the worker. "
                    "The owner's yes to the spend in the brief is their approval of exactly that spend: sign off "
                    "when the result matches it."
                ),
            },
        )
        run = await runs.update(run["id"], {"status": "running", "task_id": t["id"]}) or run
        await emit(d, run, w, conn)
        log("info", "workflow.handed", workflow=w["id"], run=run["id"], task=t["id"])
        return (
            f"Handed to the {w['department']} department as task {t['id']}. Tell the owner, Sir, in one sentence "
            "that it is being created and you'll report when it is live."
        )

    async def stop(a: dict[str, Any]) -> str:
        run = await _pick(runs, c, a.get("run_id"))
        if not run:
            return "No workflow is in progress here."
        w = wf.definition(run["workflow_id"])
        if run.get("status") == "running":
            return f"The team is already doing it as task {run.get('task_id')}: stop that with cancel_task."
        run = await wf.cancel(runs, run)
        if w:
            await emit(d, run, w)
        return "Stopped. Nothing was created."

    async def listing(_: dict[str, Any]) -> str:
        records = await ConnectorStore(d.ledger.table).list()
        out = []
        for w in wf.definitions():
            conn = wf.connector_info(w, records)
            out.append(
                f"{w['id']}: {w['name']}: {w['summary']} Needs {conn['label']} "
                f"({'connected' if conn['connected'] else 'not connected; ' + conn['where']})."
            )
        return "\n".join(out)

    return [
        ToolSpec(
            "start_workflow",
            "Start one of the known workflows (list_workflows) for the owner. Only when they asked for it directly "
            "(“let's create Meta ads”) or said yes to “Is this what you mean, Sir: the … workflow?” "
            "(owner_confirmed=true). owner_words: their message; values: input key → their words for anything they "
            "already said; mode: guide (walk me through it) or do (do it for me) when they said which. The answer "
            "is the one thing to say next.",
            _obj(
                {
                    "workflow_id": _s(2, 60),
                    "owner_words": _s(),
                    "values": _VALUES,
                    "mode": _MODE,
                    "owner_confirmed": {"type": "boolean"},
                },
                ("values", "mode", "owner_confirmed"),
            ),
            start,
        ),
        ToolSpec(
            "update_workflow",
            "Pass the owner's answers to the workflow in progress: values = input key → their own words "
            "(“300” for daily_budget), every answer they gave at once; mode = guide or do when they chose. "
            "run_id: leave out for the one in this chat. The answer is the one thing to say next.",
            _obj({"run_id": _s(), "values": _VALUES, "mode": _MODE}, ("run_id", "values", "mode")),
            update,
        ),
        ToolSpec(
            "workflow_step",
            "Walkthrough pages: to=next when the owner finished this page, back to go back, done on the last page.",
            _obj({"run_id": _s(), "to": {"type": "string", "enum": ["next", "back", "done"]}}, ("run_id",)),
            step,
        ),
        ToolSpec(
            "run_workflow",
            "Do-it-for-me: once everything is known, call with confirm=false to get the summary (with the money) "
            "to read the owner; on their clear yes, call again with confirm=true and the team creates it.",
            _obj({"run_id": _s(), "confirm": {"type": "boolean"}}, ("run_id", "confirm")),
            go,
        ),
        ToolSpec(
            "cancel_workflow",
            "Stop the workflow in progress (before the team takes it).",
            _obj({"run_id": _s()}, ("run_id",)),
            stop,
        ),
        ToolSpec(
            "list_workflows", "The workflows AIC knows, and whether their connector is set up.", _obj({}), listing
        ),
    ]
