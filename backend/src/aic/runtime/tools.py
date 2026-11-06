"""The custom tools each role gets, exposed in-process to the Agent SDK.

Each handler is plain code over the ledger, the bus and the queue; the policy gate wraps every call (see
``gate_tools``). Input schemas are JSON Schema; ``validate_args`` checks them before a handler runs.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

from aic.shared.events import now_iso
from aic.shared.hierarchy.actions import (
    CityDeps,
    answer_question,
    instruct_agent,
    move,
    new_ticket,
    quote,
    send,
    status_summary,
)
from aic.shared.hierarchy.factory import worker_spec
from aic.shared.ids import department_key, manager_id
from aic.shared.policy import gate

CITY_SERVER = "city"
DONE_OR_GONE = ("done", "failed", "cancelled")

Handler = Callable[[dict[str, Any]], Awaitable[str]]


def mcp_name(tool: str) -> str:
    return f"mcp__{CITY_SERVER}__{tool}"


@dataclass(frozen=True)
class TurnCtx:
    agent_id: str
    role: str
    department: str | None
    ticket_id: str
    task_id: str
    conversation: str | None = None


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    schema: dict[str, Any]
    handler: Handler


# ---------- schema helpers ----------
def _s(min_len: int | None = None, max_len: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"type": "string"}
    if min_len is not None:
        out["minLength"] = min_len
    if max_len is not None:
        out["maxLength"] = max_len
    return out


def _obj(props: dict[str, dict[str, Any]], optional: tuple[str, ...] = ()) -> dict[str, Any]:
    return {"type": "object", "properties": props, "required": [k for k in props if k not in optional]}


_STRS = {"type": "array", "items": {"type": "string"}}
_VERDICT = {"type": "string", "enum": ["PASS", "FAIL"]}


def validate_args(schema: dict[str, Any], args: dict[str, Any]) -> str | None:
    """A small JSON Schema check (required, type, minLength/maxLength, enum, minItems). Returns a problem or None."""
    for k in schema.get("required", []):
        if args.get(k) is None:
            return f"{k} is required"
    for k, p in schema.get("properties", {}).items():
        v = args.get(k)
        if v is None:
            continue
        t = p.get("type")
        if t == "string":
            if not isinstance(v, str):
                return f"{k} must be text"
            if len(v) < p.get("minLength", 0) or len(v) > p.get("maxLength", 10**9):
                return f"{k} has the wrong length"
            if "enum" in p and v not in p["enum"]:
                return f"{k} must be one of {', '.join(p['enum'])}"
        elif t == "number" and (isinstance(v, bool) or not isinstance(v, int | float)):
            return f"{k} must be a number"
        elif t == "array":
            if not isinstance(v, list):
                return f"{k} must be a list"
            if len(v) < p.get("minItems", 0):
                return f"{k} needs at least {p['minItems']} item(s)"
    return None


# ---------- Ace ----------
def _ace_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    async def delegate(a: dict[str, Any]) -> str:
        cons = a.get("constraints")
        t = await new_ticket(
            d,
            {
                "goal": str(a["goal"]),
                "from": "ace",
                "to": "orchestrator",
                "department": None,
                "parent_id": None,
                "kind": "task",
                **({"acceptance": str(cons)} if cons else {}),
                **({"conversation": c.conversation} if c.conversation else {}),
            },
        )
        body = f"New task from the owner.\nGoal: {a['goal']}\nOwner's words: {a.get('owner_words', '')}"
        if cons:
            body += f"\nConstraints: {cons}"
        msg: dict[str, Any] = {
            "role": "orchestrator",
            "agentId": "orchestrator",
            "department": None,
            "ticketId": t["id"],
            "taskId": t["id"],
            "kind": "task",
            "from": "ace",
            "body": body,
        }
        if c.conversation:
            msg["conversation"] = c.conversation
        await send(d, msg)
        return f"Handed to the Orchestrator as task {t['id']}."

    async def get_status(_: dict[str, Any]) -> str:
        import json

        return json.dumps(await status_summary(d))

    async def answer(a: dict[str, Any]) -> str:
        r = await answer_question(d, str(a["question_id"]), str(a["answer"]), "owner")
        return r or "That question was already answered or does not exist."

    async def instruct(a: dict[str, Any]) -> str:
        return await instruct_agent(d, str(a["agent_id"]), str(a["text"]))

    async def add_note(a: dict[str, Any]) -> str:
        return f"Saved note {(await d.ledger.add_note(str(a['text']), 'note'))['id']}."

    async def list_notes(_: dict[str, Any]) -> str:
        import json

        return json.dumps(
            {"notes": await d.ledger.list_notes("note"), "reminders": await d.ledger.list_notes("reminder")}
        )

    async def add_reminder(a: dict[str, Any]) -> str:
        try:
            datetime.fromisoformat(str(a["due_at"]).replace("Z", "+00:00"))
        except ValueError:
            return "That due time is not a valid date."
        return f"Reminder {(await d.ledger.add_note(str(a['text']), 'reminder', str(a['due_at'])))['id']} saved."

    async def pause(a: dict[str, Any]) -> str:
        reason = str(a["reason"]) if a.get("reason") else "Paused by the owner"
        await d.ledger.update_settings({"paused": True, "pause_reason": reason})
        await d.bus.put({"type": "city.state", "paused": True, "reason": reason})
        return "The city is paused. Work already running will finish; nothing new starts."

    async def resume(_: dict[str, Any]) -> str:
        await d.ledger.update_settings({"paused": False, "pause_reason": None})
        await d.bus.put({"type": "city.state", "paused": False, "reason": None})
        return "The city is running again."

    return [
        ToolSpec(
            "delegate_to_orchestrator",
            "Hand real work to the Orchestrator. Use for anything beyond a quick answer.",
            _obj({"goal": _s(3), "owner_words": _s(), "constraints": _s()}, ("constraints",)),
            delegate,
        ),
        ToolSpec("get_status", "Tickets, departments, live agents and spend, in one summary.", _obj({}), get_status),
        ToolSpec(
            "answer_question",
            "Send the owner's answer to a waiting question.",
            _obj({"question_id": _s(), "answer": _s(1)}),
            answer,
        ),
        ToolSpec(
            "instruct_agent",
            "Send the owner's instruction to one agent (the @agent feature). Its manager is copied.",
            _obj({"agent_id": _s(), "text": _s(1)}),
            instruct,
        ),
        ToolSpec("add_note", "Save a note for the owner.", _obj({"text": _s(1)}), add_note),
        ToolSpec("list_notes", "List the owner's notes and pending reminders.", _obj({}), list_notes),
        ToolSpec(
            "add_reminder",
            "Add a reminder with a due time (ISO 8601).",
            _obj({"text": _s(1), "due_at": _s()}),
            add_reminder,
        ),
        ToolSpec(
            "pause_city",
            "Pause the city: no new turns start; running turns finish.",
            _obj({"reason": _s()}, ("reason",)),
            pause,
        ),
        ToolSpec("resume_city", "Resume the city.", _obj({}), resume),
    ]


# ---------- shared ----------
def _ask_owner(d: CityDeps, c: TurnCtx) -> ToolSpec:
    async def ask(a: dict[str, Any]) -> str:
        agent = await d.ledger.get_agent(c.agent_id)
        parent = (agent or {}).get("parent")
        path = f"{parent} › {c.agent_id}" if parent and parent != "orchestrator" else c.agent_id
        q = await d.ledger.ask_question(
            {
                "asked_by": c.agent_id,
                "path": path,
                "ticket_id": c.ticket_id,
                "text": str(a["question"]),
                "options": [str(o) for o in a["options"]],
                "default_answer": str(a["default_answer"]),
            }
        )
        await move(d, c.ticket_id, "waiting_on_owner", "question for the owner")
        await d.bus.put({"type": "question.asked", "question": q})
        return f"Asked the owner (question {q['id']}). End your turn; the answer arrives as a new message."

    return ToolSpec(
        "ask_owner",
        "Ask the owner a question through Ace. Always give options and a default.",
        _obj({"question": _s(3), "options": {**_STRS, "minItems": 1}, "default_answer": _s(1)}),
        ask,
    )


# ---------- Orchestrator ----------
def _orchestrator_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    async def create_department(a: dict[str, Any]) -> str:
        name = str(a["name"]).strip()
        dept, created = await d.ledger.create_department(name, str(a["mission"]), manager_id(name))
        if not created:
            return f"{dept['name']} already exists; use it."
        mgr = {
            "id": dept["manager_id"],
            "kind": "manager",
            "role": f"{dept['name']} Manager",
            "department": dept["name"],
            "model": "fable-5-1",
            "parent": "orchestrator",
            "state": "dormant",
            "worker_state": None,
            "total_cost_usd": 0,
            "hired_at": now_iso(d.ledger.now()),
        }
        await d.ledger.put_agent(mgr)
        await d.bus.put(
            {"type": "department.created", "name": dept["name"], "mission": dept["mission"], "manager_id": mgr["id"]}
        )
        await d.bus.put({"type": "agent.hired", "agent": mgr})
        return f"Created {dept['name']}, managed by {mgr['id']}."

    async def assign(a: dict[str, Any]) -> str:
        dept = await d.ledger.get_department(str(a["department"]))
        if not dept:
            return f"There is no department called {a['department']}. Create it first."
        t = await new_ticket(
            d,
            {
                "goal": str(a["goal"]),
                "acceptance": str(a["acceptance"]),
                "from": "orchestrator",
                "to": dept["manager_id"],
                "department": dept["name"],
                "parent_id": c.task_id,
                "kind": "assignment",
            },
        )
        task = await d.ledger.get_ticket(c.task_id)
        if task and task["status"] == "open":
            await move(d, c.task_id, "in_progress", "sent to departments")
        await send(
            d,
            {
                "role": "manager",
                "agentId": dept["manager_id"],
                "department": dept["name"],
                "ticketId": t["id"],
                "taskId": c.task_id,
                "kind": "task",
                "from": "orchestrator",
                "body": f"Goal for {dept['name']}: {a['goal']}\nAcceptance: {a['acceptance']}",
            },
        )
        return f"Sent to {dept['name']} as {t['id']}."

    async def get_reports(_: dict[str, Any]) -> str:
        import json

        kids = await d.ledger.child_tickets(c.task_id)
        return json.dumps(
            [
                {
                    "ticket": k["id"],
                    "department": k.get("department"),
                    "status": k["status"],
                    "report": quote(k["to"], k["result"]) if k.get("result") else None,
                }
                for k in kids
                if k.get("kind") == "assignment"
            ]
        )

    async def sign_off(a: dict[str, Any]) -> str:
        verdict = a["verdict"]
        kids = [k for k in await d.ledger.child_tickets(c.task_id) if k.get("kind") == "assignment"]
        if verdict == "PASS":
            pending = [k for k in kids if k["status"] != "in_review" and k["status"] not in DONE_OR_GONE]
            if pending:
                return f"Not yet: {', '.join(str(k.get('department')) for k in pending)} has not reported."
            for k in kids:
                if k["status"] == "in_review":
                    await move(d, k["id"], "done", "signed off")
            await d.ledger.table.put(
                {"pk": f"TICKET#{c.task_id}", "sk": "SIGNOFF", "verdict": verdict, "at": now_iso(d.ledger.now())}
            )
        else:
            target = None
            if a.get("department"):
                target = next(
                    (
                        k
                        for k in kids
                        if department_key(str(k.get("department"))) == department_key(str(a["department"]))
                    ),
                    None,
                )
            target = target or next((k for k in kids if k["status"] == "in_review"), None)
            if not target:
                return "Name the department that must fix it."
            await move(
                d, target["id"], "in_progress", "sign-off failed", {"review_rounds": target.get("review_rounds", 0) + 1}
            )
            await send(
                d,
                {
                    "role": "manager",
                    "agentId": target["to"],
                    "department": target.get("department"),
                    "ticketId": target["id"],
                    "taskId": c.task_id,
                    "kind": "fix",
                    "from": "orchestrator",
                    "body": f"The Orchestrator did not sign off. Fix and report again: {a['reasons']}",
                },
            )
        await d.bus.put(
            {"type": "signoff.result", "ticket_id": c.task_id, "verdict": verdict, "summary": str(a["reasons"])[:300]}
        )
        return "Signed off. Now report to Ace." if verdict == "PASS" else "Sent back for fixes."

    async def report_to_ace(a: dict[str, Any]) -> str:
        signed = await d.ledger.table.get(f"TICKET#{c.task_id}", "SIGNOFF")
        if (signed or {}).get("verdict") != "PASS":
            return "Sign off with PASS before reporting."
        task = await move(d, c.task_id, "done", "reported to Ace", {"result": str(a["summary"])})
        await d.bus.put({"type": "result", "ticket_id": c.task_id, "summary": str(a["summary"])[:500]})
        msg: dict[str, Any] = {
            "role": "ace",
            "agentId": "ace",
            "department": None,
            "ticketId": c.task_id,
            "taskId": c.task_id,
            "kind": "report",
            "from": "orchestrator",
            "body": quote("the Orchestrator", str(a["summary"])),
        }
        if task.get("conversation"):
            msg["conversation"] = task["conversation"]
        await send(d, msg)
        return "Reported to Ace."

    return [
        ToolSpec(
            "create_department",
            "Create a department (data). Its manager is created dormant and costs nothing until work arrives.",
            _obj({"name": _s(2, 40), "mission": _s(10)}),
            create_department,
        ),
        ToolSpec(
            "assign_to_department",
            "Send one goal to a department's manager.",
            _obj({"department": _s(), "goal": _s(3), "acceptance": _s(3)}),
            assign,
        ),
        ToolSpec(
            "get_reports",
            "The departments' tickets for this task, with their status and reports.",
            _obj({}),
            get_reports,
        ),
        ToolSpec(
            "sign_off",
            "Final sign-off on the task: PASS, or FAIL with reasons (the work goes back to the department).",
            _obj({"verdict": _VERDICT, "reasons": _s(3), "department": _s()}, ("department",)),
            sign_off,
        ),
        _ask_owner(d, c),
        ToolSpec(
            "report_to_ace",
            "Report the finished task to Ace. Only after a PASS sign-off.",
            _obj({"summary": _s(3)}),
            report_to_ace,
        ),
    ]


# ---------- Manager ----------
def _manager_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    dept = c.department or ""

    async def mine(worker_id: str) -> dict[str, Any] | None:
        w = await d.ledger.get_agent(worker_id)
        return w if w and w.get("kind") == "worker" and w.get("parent") == c.agent_id else None

    async def hire(a: dict[str, Any]) -> str:
        try:
            w = await d.factory.hire(a, c.agent_id, dept)
            return f"Hired {w['id']} ({w['role']})."
        except Exception as e:
            return f"Hire refused: {e}"

    async def assign(a: dict[str, Any]) -> str:
        w = await mine(str(a["worker_id"]))
        if not w or w.get("state") == "retired":
            return f"{a['worker_id']} is not one of your workers."
        t = await new_ticket(
            d,
            {
                "goal": str(a["goal"]),
                "acceptance": str(a["acceptance"]),
                "from": c.agent_id,
                "to": w["id"],
                "department": dept,
                "parent_id": c.ticket_id,
                "kind": "assignment",
            },
        )
        await d.ledger.update_agent(w["id"], {"ticket_id": t["id"], "worker_state": "working"})
        await d.bus.put({"type": "worker.state", "id": w["id"], "state": "working"})
        await send(
            d,
            {
                "role": "worker",
                "agentId": w["id"],
                "department": dept,
                "ticketId": t["id"],
                "taskId": c.task_id,
                "kind": "task",
                "from": c.agent_id,
                "body": f"Assignment: {a['goal']}\nAcceptance: {a['acceptance']}",
            },
        )
        return f"Assigned {t['id']} to {w['id']}."

    async def answer_worker(a: dict[str, Any]) -> str:
        w = await mine(str(a["worker_id"]))
        if not w or not w.get("ticket_id"):
            return f"{a['worker_id']} is not one of your working workers."
        await d.ledger.update_agent(w["id"], {"worker_state": "working"})
        await d.bus.put({"type": "worker.state", "id": w["id"], "state": "working"})
        await send(
            d,
            {
                "role": "worker",
                "agentId": w["id"],
                "department": dept,
                "ticketId": w["ticket_id"],
                "taskId": c.task_id,
                "kind": "answer",
                "from": c.agent_id,
                "body": f"Your manager answered: {a['answer']}",
            },
        )
        return "Answer sent."

    async def review(a: dict[str, Any]) -> str:
        t = await d.ledger.get_ticket(str(a["ticket_id"]))
        if not t or t["from"] != c.agent_id:
            return "That is not one of your assignments."
        if t["status"] != "in_review":
            return "That assignment has not been reported yet."
        verdict = a["verdict"]
        rnd = int(t.get("review_rounds", 0)) + 1
        await d.bus.put(
            {
                "type": "review.result",
                "ticket_id": t["id"],
                "agent": t["to"],
                "reviewer": c.agent_id,
                "verdict": verdict,
                "summary": str(a["reasons"])[:300],
                "round": rnd,
            }
        )
        if verdict == "PASS":
            await move(d, t["id"], "done", "review passed", {"review_rounds": rnd})
            await d.ledger.update_agent(t["to"], {"worker_state": "completed"})
            await d.bus.put({"type": "worker.state", "id": t["to"], "state": "completed"})
            return f"PASS recorded. Release {t['to']} when you no longer need it."
        if rnd >= d.max_review_rounds:
            await move(d, t["id"], "waiting_on_owner", "too many review rounds", {"review_rounds": rnd})
            q = await d.ledger.ask_question(
                {
                    "asked_by": c.agent_id,
                    "path": c.agent_id,
                    "ticket_id": t["id"],
                    "text": f"{t['to']}'s work failed review {rnd} times. Latest reasons: {a['reasons']}. What should happen?",
                    "options": ["Try once more", "Stop this assignment"],
                    "default_answer": "Stop this assignment",
                }
            )
            await d.bus.put({"type": "question.asked", "question": q})
            return "Review limit reached; asked the owner."
        await move(d, t["id"], "in_progress", "review failed", {"review_rounds": rnd})
        await d.ledger.update_agent(t["to"], {"worker_state": "working"})
        await d.bus.put({"type": "worker.state", "id": t["to"], "state": "working", "detail": "fixing after review"})
        await send(
            d,
            {
                "role": "worker",
                "agentId": t["to"],
                "department": dept,
                "ticketId": t["id"],
                "taskId": c.task_id,
                "kind": "fix",
                "from": c.agent_id,
                "body": f"Your manager's review: FAIL. Fix exactly this and report again: {a['reasons']}",
            },
        )
        return "FAIL recorded; sent back to the worker."

    async def release(a: dict[str, Any]) -> str:
        try:
            w = await d.factory.release(str(a["worker_id"]), c.agent_id)
            return f"Released {w['id']}."
        except Exception as e:
            return f"Not released: {e}"

    async def save_specialist(a: dict[str, Any]) -> str:
        w = await mine(str(a["worker_id"]))
        spec = await worker_spec(d.ledger, w["id"]) if w else None
        if not w or not spec:
            return f"{a['worker_id']} is not one of your workers."
        s = await d.ledger.save_specialist(
            {
                "department": dept,
                "specialty": w.get("specialty") or w["role"],
                "instructions": spec["instructions"],
                "tools": spec["tools"],
            }
        )
        return f"Saved as specialist {s['id']}."

    async def report(a: dict[str, Any]) -> str:
        kids = [k for k in await d.ledger.child_tickets(c.ticket_id) if k.get("kind") == "assignment"]
        unreviewed = [k for k in kids if k["status"] not in DONE_OR_GONE]
        if unreviewed:
            return f"Not yet: {', '.join(k['id'] for k in unreviewed)} has not passed review."
        await move(d, c.ticket_id, "in_review", "reported to the Orchestrator", {"result": str(a["summary"])})
        await send(
            d,
            {
                "role": "orchestrator",
                "agentId": "orchestrator",
                "department": None,
                "ticketId": c.task_id,
                "taskId": c.task_id,
                "kind": "report",
                "from": c.agent_id,
                "body": quote(c.agent_id, str(a["summary"])),
            },
        )
        return "Reported to the Orchestrator."

    return [
        ToolSpec(
            "hire_worker",
            "Hire a worker consultant for one assignment.",
            _obj(
                {
                    "specialty": _s(),
                    "instructions": _s(),
                    "tools": _STRS,
                    "budget_hint_usd": {"type": "number"},
                    "specialist_id": _s(),
                },
                ("budget_hint_usd", "specialist_id"),
            ),
            hire,
        ),
        ToolSpec(
            "assign",
            "Give one of your workers its assignment.",
            _obj({"worker_id": _s(), "goal": _s(3), "acceptance": _s(3)}),
            assign,
        ),
        ToolSpec(
            "answer_worker", "Answer a worker's question.", _obj({"worker_id": _s(), "answer": _s(1)}), answer_worker
        ),
        ToolSpec(
            "review",
            "Review a worker's reported deliverable: PASS, or FAIL with exact reasons (it goes back to the worker).",
            _obj({"ticket_id": _s(), "verdict": _VERDICT, "reasons": _s(3)}),
            review,
        ),
        ToolSpec("release_worker", "Release a worker whose work passed review.", _obj({"worker_id": _s()}), release),
        ToolSpec(
            "save_specialist",
            "Save a worker's spec so it can be hired again later.",
            _obj({"worker_id": _s()}),
            save_specialist,
        ),
        _ask_owner(d, c),
        ToolSpec(
            "report_to_orchestrator",
            "Report the department's finished goal to the Orchestrator.",
            _obj({"summary": _s(3)}),
            report,
        ),
    ]


# ---------- Worker ----------
def _worker_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    async def manager() -> str:
        a = await d.ledger.get_agent(c.agent_id)
        return str((a or {}).get("parent") or manager_id(c.department or ""))

    async def mgr_ticket() -> str:
        t = await d.ledger.get_ticket(c.ticket_id)
        return str((t or {}).get("parent_id") or c.ticket_id)

    async def ask_manager(a: dict[str, Any]) -> str:
        m = await manager()
        await d.ledger.update_agent(c.agent_id, {"worker_state": "waiting"})
        await d.bus.put(
            {"type": "worker.state", "id": c.agent_id, "state": "waiting", "detail": "waiting for an answer"}
        )
        await send(
            d,
            {
                "role": "manager",
                "agentId": m,
                "department": c.department,
                "ticketId": await mgr_ticket(),
                "taskId": c.task_id,
                "kind": "question",
                "from": c.agent_id,
                "body": f"{c.agent_id} asks: {a['question']}",
            },
        )
        return "Question sent to your manager."

    async def report(a: dict[str, Any]) -> str:
        m = await manager()
        artifacts = a.get("artifacts") or []
        checks = a.get("checks") or ""
        body = f"{a['summary']}\nArtifacts: {', '.join(map(str, artifacts)) or 'none'}\nChecks: {checks or 'none'}"
        await move(d, c.ticket_id, "in_review", "reported", {"result": body})
        await d.ledger.update_agent(c.agent_id, {"worker_state": "review"})
        await d.bus.put({"type": "worker.state", "id": c.agent_id, "state": "reporting"})
        await send(
            d,
            {
                "role": "manager",
                "agentId": m,
                "department": c.department,
                "ticketId": await mgr_ticket(),
                "taskId": c.task_id,
                "kind": "report",
                "from": c.agent_id,
                "body": f"{c.agent_id} reported assignment {c.ticket_id}.\n{quote(c.agent_id, body)}",
            },
        )
        return "Reported to your manager. End your turn."

    return [
        ToolSpec(
            "ask_manager",
            "Ask your manager a question. Keep working on a sensible default meanwhile.",
            _obj({"question": _s(3)}),
            ask_manager,
        ),
        ToolSpec(
            "report_to_manager",
            "Report your finished assignment: status, summary, artifacts, checks and results.",
            _obj({"summary": _s(3), "artifacts": _STRS, "checks": _s()}, ("artifacts", "checks")),
            report,
        ),
    ]


def tools_for(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    return {
        "ace": _ace_tools,
        "orchestrator": _orchestrator_tools,
        "manager": _manager_tools,
        "worker": _worker_tools,
    }[c.role](d, c)


async def file_approval(d: CityDeps, c: TurnCtx, tool: str, input: dict[str, Any], hash: str, reason: str) -> None:
    """Files an owner approval bound to this exact action (once per action while it is pending)."""
    if any(a.get("hash") == hash for a in await d.ledger.pending_approvals()):
        return
    cmd = input.get("command")
    action = cmd[:200] if isinstance(cmd, str) else f"{tool} {', '.join(input)}"
    a = await d.ledger.request_approval(
        {"agent": c.agent_id, "ticket_id": c.ticket_id, "tool": tool, "action": action, "hash": hash, "reason": reason}
    )
    await d.bus.put(
        {"type": "approval.requested", "id": a["id"], "agent": c.agent_id, "action": action, "reason": reason}
    )


def gate_tools(d: CityDeps, c: TurnCtx, specs: list[ToolSpec]) -> list[ToolSpec]:
    """Every custom tool call passes the policy gate and is written to the ledger."""

    def wrap(s: ToolSpec) -> ToolSpec:
        async def handler(args: dict[str, Any]) -> str:
            name = mcp_name(s.name)
            r = await gate(name, args, c.role, c.agent_id, consume_approval=d.ledger.consume_approval)
            await d.ledger.audit_tool(c.agent_id, name, r.decision, r.reason)
            if r.needs_approval:
                await file_approval(d, c, name, args, r.needs_approval.hash, r.needs_approval.reason)
            if r.decision == "deny":
                return f"Denied by policy: {r.reason}"
            bad = validate_args(s.schema, args)
            if bad:
                return f"Invalid input: {bad}."
            return await s.handler(args)

        return replace(s, handler=handler)

    return [wrap(s) for s in specs]
