"""The board path for small jobs (decision 289, stage 2): no Orchestrator turn, no manager planning turn.

VAIC sizes the job; a small one goes straight onto the board: the department's goal and one part are written, one
Sonnet 5.5 worker is hired into the department's building and starts at once. When it reports, the tests run in
code in its own runtime (``part_checks``) and the app's draft must be staged; then a risky part goes to the
department's reviewer (its manager, on Opus 5.5 for this turn) and any other part is finished in code: the part,
the goal and the job are closed, the owner's publish approval is filed for an app, and VAIC is told, as the chain's
sign-off would. A part that fails twice (tests or review) is taken over by a fresh worker on the takeover model.

The no-model steps that a worker's runtime may not do (it can only message its manager's queue) run in the
dispatcher Lambda: a manager-queue message with ``board`` set is a code step, never a model turn.

The old chain stays behind one switch: the ``board_sizes`` setting (default: small) lists the sizes on this path.
"""

from __future__ import annotations

from typing import Any

from ..apps import drafts_of_ticket, request_publish_approvals
from ..build_models import models_for, needs_review, worker_model
from ..events import now_iso
from ..ledger import Record
from ..log import log
from .actions import FINAL, CityDeps, move, new_ticket, quote, send
from .factory import WORKER_TOOLS, Factory

DEFAULT_SIZES = ("small",)
APP_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "git"]
RISKY = (
    "delete", "remove all", "drop ", "wipe", "payment", "pay ", "stripe", "money", "invoice", "password", "secret",
    "token", "key", "auth", "login", "iam", "security", "permission", "infra", "terraform", "deploy", "database",
    "migration", "production", "email", "send ", "publish", "legal", "contract", "price",
)  # fmt: skip
SPEED = (
    "Speed (the owner's fixed rule): work straight away, change only what the goal needs, edit files in place with "
    "Edit (never rewrite a whole file), run only the checks your change touches, then report. Your part is yours "
    "alone: no one else edits your files."
)


def board_sizes(settings: dict[str, Any]) -> tuple[str, ...]:
    v = settings.get("board_sizes")
    if v is None:
        return DEFAULT_SIZES
    return tuple(str(x) for x in v) if isinstance(v, list | tuple) else ()


def on_board(settings: dict[str, Any], size: str) -> bool:
    """The single switch: is this size built on the board? (Settings ``board_sizes``; [] = the old chain only.)"""
    return size in board_sizes(settings)


def risky(*texts: Any) -> bool:
    low = " ".join(str(t or "") for t in texts).lower()
    return any(w in low for w in RISKY)


async def stage(d: CityDeps, task_id: str, name: str, edge: str, key: str = "job", ms: int | None = None) -> None:
    """A timing mark on the board, through the bus (every runtime may put events; the ledger writer files it)."""
    e: dict[str, Any] = {"type": "build.stage", "task_id": task_id, "stage": name, "edge": edge, "key": key}
    if ms is not None:
        e["ms"] = ms
    try:
        await d.bus.put(e)
    except Exception as err:  # a timing mark never stops a build
        log("warn", "board.stage_failed", stage=name, error=type(err).__name__)


async def board_department(d: CityDeps, app: Record | None, triage_department: str | None) -> Record | None:
    """The department a small job goes to: an app's home department (Application), else the one the triage named.
    None = not sure, so the job goes through the Orchestrator as before."""
    from ..apps import home_department

    name = home_department((app or {}).get("department") or "Application") if app else triage_department
    if not name:
        return None
    dept = await d.ledger.get_department(str(name))
    if not dept or dept.get("state") != "active":
        return None
    return dept


async def _manager(d: CityDeps, dept: Record) -> Record:
    """The department's manager (its reviewer on the board path), hired the first time like the chain does."""
    from ..models import model_name_for

    mgr = await d.ledger.get_agent(dept["manager_id"])
    if mgr:
        return mgr
    mgr = {
        "id": dept["manager_id"],
        "kind": "manager",
        "role": f"{dept['name']} Manager",
        "department": dept["name"],
        "model": model_name_for("manager", dept["name"]),
        "parent": "orchestrator",
        "state": "dormant",
        "worker_state": None,
        "total_cost_usd": 0,
        "hired_at": now_iso(d.ledger.now()),
    }
    await d.ledger.put_agent(mgr)
    await d.bus.put({"type": "agent.hired", "agent": mgr})
    return mgr


def _assignment(task: Record, goal: str, acceptance: str, extra: str, app: Record | None) -> str:
    lines = [f"Assignment: {goal}", f"Acceptance: {acceptance}"]
    if task.get("owner_words"):
        lines.append(f"The owner's words: {task['owner_words']}")
    if app:
        lines.append(
            f"This changes the existing app “{app['title']}” ({app['app_id']}, version {app.get('version') or 1}): "
            "call load_app first, change only what is asked (keep its title and its saved-state keys), then "
            "submit_app with the same title, then report_to_manager."
        )
    if extra:
        lines.append(extra)
    lines.append(SPEED)
    lines.append(
        "When you call report_to_manager the city runs the tests for you; if they fail you get the output, fix it and "
        "report again."
    )
    return "\n".join(lines)


async def _hire_and_assign(
    d: CityDeps, task: Record, goal_t: Record, dept: Record, part_goal: str, acceptance: str, body: str, model: str
) -> tuple[Record, Record]:
    """Hires one worker on ``model`` into the department and gives it the part, the same records and events the
    chain writes (the City drives its taxi to the building), then starts its turn."""
    app_job = bool(task.get("app_id"))
    spec = {
        "specialty": f"{dept['name']} builder",
        "instructions": f"You do one part of the owner's job in the {dept['name']} department, fast and well.",
        "tools": APP_TOOLS if app_job else [t for t in WORKER_TOOLS if t != "browser"],
    }
    w = await Factory(d.ledger, d.bus, d.settings).hire(spec, dept["manager_id"], dept["name"], model)
    await d.ledger.update_agent(w["id"], {"goal_id": goal_t["id"]})
    part = await new_ticket(
        d,
        {
            "goal": part_goal,
            "acceptance": acceptance,
            "from": dept["manager_id"],
            "to": w["id"],
            "department": dept["name"],
            "parent_id": goal_t["id"],
            "task_id": task["id"],
            "kind": "assignment",
            "pace": task.get("pace") or "fastest",
            "path": "board",
            "size": task.get("size") or "small",
            "model": model,
        },
    )
    await d.ledger.update_agent(w["id"], {"ticket_id": part["id"], "worker_state": "working"})
    await d.bus.put({"type": "worker.state", "id": w["id"], "state": "working"})
    await send(
        d,
        {
            "role": "worker",
            "agentId": w["id"],
            "department": dept["name"],
            "ticketId": part["id"],
            "taskId": task["id"],
            "kind": "task",
            "from": dept["manager_id"],
            "body": body,
            "model": model,
        },
    )
    return w, part


async def start_small(d: CityDeps, task: Record, dept: Record, app: Record | None, extra: str = "") -> Record:
    """A small job on the board: the department's goal, one Sonnet worker, its part, its turn started. Returns the
    worker. VAIC's own turn calls this right after the job is written, so planning is a few ledger writes."""
    await _manager(d, dept)
    if dept.get("stood_down_at"):
        await d.ledger.stand_down_department(dept["name"], down=False)
    goal = str(task["goal"])
    acceptance = str(task.get("acceptance") or f"Done exactly as the owner asked: {task.get('owner_words') or goal}")
    goal_t = await new_ticket(
        d,
        {
            "goal": goal,
            "acceptance": acceptance,
            "from": "orchestrator",
            "to": dept["manager_id"],
            "department": dept["name"],
            "parent_id": task["id"],
            "task_id": task["id"],
            "kind": "assignment",
            "pace": task.get("pace") or "fastest",
            "path": "board",
            **({"app_id": task["app_id"]} if task.get("app_id") else {}),
        },
    )
    await move(d, task["id"], "in_progress", "on the board", {"path": "board"})
    await move(d, goal_t["id"], "in_progress", "one worker on it")
    model = worker_model(str(task.get("size") or "small"))
    w, _ = await _hire_and_assign(
        d, task, goal_t, dept, goal, acceptance, _assignment(task, goal, acceptance, extra, app), model
    )
    log("info", "board.small_started", task=task["id"], department=dept["name"], worker=w["id"], model=model)
    return w


# ---------- after the worker reports ----------
async def after_tests(d: CityDeps, part: Record, summary: str, checked: bool) -> str:
    """The worker's runtime, once the tests passed: the part goes to review when it needs one, else it is finished
    by the dispatcher in code. Returns what the worker is told."""
    task = await d.ledger.get_ticket(str(part.get("task_id") or ""))
    size = str(part.get("size") or (task or {}).get("size") or "small")
    review = needs_review(size, trivial=bool(part.get("trivial")), risky=not checked or risky(
        part.get("goal"), part.get("acceptance"), (task or {}).get("owner_words")
    ))  # fmt: skip
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    mgr = str((goal or {}).get("to") or part.get("from"))
    if review:
        reviewer = models_for(size).reviewer
        await d.bus.put({"type": "worker.state", "id": str(part["to"]), "state": "reporting"})
        await stage(d, str(part["task_id"]), "review", "start", str(part["id"]))
        await send(
            d,
            {
                "role": "manager",
                "agentId": mgr,
                "department": part.get("department"),
                "ticketId": str(part["id"]),
                "taskId": str(part["task_id"]),
                "kind": "report",
                "from": str(part["to"]),
                "body": (
                    "Board review (decision 289): you are this department's reviewer for one part. Its tests passed. "
                    "Read the result, check it against the acceptance, then call review once on this assignment: "
                    "PASS, or FAIL with exactly what to change. Do nothing else: no hires, no reports.\n"
                    f"Assignment {part['id']}: {part.get('goal')}\nAcceptance: {part.get('acceptance')}\n"
                    + quote(str(part["to"]), summary)
                ),
                "model": reviewer,
            },
        )
        return "Reported: the tests passed and the department's reviewer checks it now. End your turn."
    await send(
        d,
        {
            "role": "manager",
            "agentId": mgr,
            "department": part.get("department"),
            "ticketId": str(part["id"]),
            "taskId": str(part["task_id"]),
            "kind": "report",
            "from": str(part["to"]),
            "body": "board: finish",
            "board": "finish",
        },
    )
    return "Done: your part passed its tests and is finished. End your turn."


async def finish_part(d: CityDeps, part_id: str, why: str) -> None:
    """A part passed (tests, or tests and review): close it, and when its goal and job have nothing else open,
    close them too, file the owner's publish approval for an app and tell VAIC, as the chain's sign-off does."""
    part = await d.ledger.get_ticket(part_id)
    if not part:
        return
    if part["status"] not in FINAL:
        await d.bus.put(
            {
                "type": "review.result",
                "ticket_id": part["id"],
                "agent": str(part["to"]),
                "reviewer": str(part.get("from")),
                "verdict": "PASS",
                "summary": why[:300],
                "round": float(part.get("review_rounds") or 0) + 1,
            }
        )
        await d.ledger.update_agent(str(part["to"]), {"worker_state": "completed"})
        await d.bus.put({"type": "worker.state", "id": str(part["to"]), "state": "completed"})
        await move(d, part["id"], "done", why[:200])  # sends the worker home
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    if not goal:
        return
    if any(k["status"] not in FINAL for k in await d.ledger.child_tickets(goal["id"])):
        return
    if goal["status"] not in FINAL:
        await move(d, goal["id"], "done", "every part passed", {"result": part.get("result")})
    task = await d.ledger.get_ticket(str(goal.get("parent_id") or ""))
    if not task or task["status"] in FINAL:
        return
    if any(k["status"] not in FINAL for k in await d.ledger.child_tickets(task["id"])):
        return
    await finish_job(d, task, str(part.get("result") or ""))


async def finish_job(d: CityDeps, task: Record, result: str) -> None:
    await d.ledger.table.put(
        {"pk": f"TICKET#{task['id']}", "sk": "SIGNOFF", "verdict": "PASS", "at": now_iso(d.ledger.now())}
    )
    apps = await request_publish_approvals(d.ledger, d.bus, task["id"], "orchestrator")
    await d.bus.put({"type": "signoff.result", "ticket_id": task["id"], "verdict": "PASS", "summary": "Checked."})
    summary = result.strip() or "Done."
    if apps:
        summary += (
            "\nThe owner is asked to publish the new version in Needs you; it appears under Apps once they approve it "
            "(it is not live yet)."
        )
    done = await move(d, task["id"], "done", "finished on the board", {"result": summary[:4000]})
    await stage(d, task["id"], "report", "start")
    await d.bus.put({"type": "result", "ticket_id": task["id"], "summary": summary[:500]})
    msg: dict[str, Any] = {
        "role": "vaic",
        "agentId": "vaic",
        "department": None,
        "ticketId": task["id"],
        "taskId": task["id"],
        "kind": "report",
        "from": "orchestrator",
        "body": quote("the Orchestrator", summary),
    }
    if done.get("conversation"):
        msg["conversation"] = done["conversation"]
    await send(d, msg)
    log("info", "board.job_done", task=task["id"], apps=len(apps))


async def take_over(d: CityDeps, part_id: str, reasons: list[str]) -> str:
    """A part that failed twice: its worker goes home and a fresh worker on the takeover model gets the part again
    with every reason so far (decision 287's rule: the real reasons travel)."""
    part = await d.ledger.get_ticket(part_id)
    if not part or part["status"] in FINAL:
        return "Nothing to take over."
    task = await d.ledger.get_ticket(str(part.get("task_id") or ""))
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    dept = await d.ledger.get_department(str(part.get("department") or ""))
    if not task or not goal or not dept:
        return "Nothing to take over."
    size = str(part.get("size") or task.get("size") or "small")
    model = models_for(size).takeover
    listed = "; ".join(f"({i}) {r}" for i, r in enumerate(reasons, 1)) or "it did not pass"
    await move(
        d,
        part["id"],
        "cancelled",
        f"failed {len(reasons)} times; taken over",
        {"review_reasons": reasons, "escalated": "takeover"},
    )
    app = None
    if task.get("app_id"):
        from ..apps import get_app

        app = await get_app(d.ledger, str(task["app_id"]))
    body = _assignment(
        task,
        str(part["goal"]),
        str(part.get("acceptance") or ""),
        f"A first worker tried this part and failed {len(reasons)} times. Every reason so far: {listed}. Fix all of them.",
        app,
    )
    w, new = await _hire_and_assign(
        d, task, goal, dept, str(part["goal"]), str(part.get("acceptance") or ""), body, model
    )
    await d.ledger.set_ticket_status(new["id"], new["status"], "", {"review_reasons": reasons, "takeover": True})
    log("info", "board.takeover", part=part["id"], new=new["id"], worker=w["id"], model=model, fails=len(reasons))
    return f"Taken over by a fresh worker on {model}."


async def board_step(d: CityDeps, m: dict[str, Any]) -> None:
    """A code step on the board (the dispatcher runs it instead of a model turn)."""
    step = m.get("board")
    if step == "finish":
        await finish_part(d, str(m["ticketId"]), "The tests passed.")
    elif step == "takeover":
        part = await d.ledger.get_ticket(str(m["ticketId"]))
        await take_over(d, str(m["ticketId"]), [str(r) for r in (part or {}).get("review_reasons") or []])
    else:
        log("warn", "board.unknown_step", step=step)


async def draft_verdict(d: CityDeps, ticket_id: str) -> str | None:
    """An app part's submitted draft: None when none was submitted or it is ready, else why it can't go on
    (still staging is waited for by the caller)."""
    drafts = await drafts_of_ticket(d.ledger, ticket_id)
    if not drafts:
        return None
    last = max(drafts, key=lambda x: str(x.get("created_at") or ""))
    if last.get("status") == "rejected":
        return f"The city rejected the app: {last.get('reason') or 'no reason given'}"
    if last.get("status") == "staging":
        return "staging"
    return None
