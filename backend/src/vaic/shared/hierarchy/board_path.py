"""The board path for small jobs (decision 289, stage 2): no Orchestrator turn, no manager planning turn.

VAIC sizes the job; a small one goes straight onto the board: the department's goal and one part are written, one
Sonnet 5.5 worker is hired into the department's building and starts at once. When it reports, the tests run in
code in its own runtime (``part_checks``) and the app's draft must be staged; then a risky part goes to the
department's reviewer (its manager, on Opus 5.5 for this turn) and any other part is finished in code: the part,
the goal and the job are closed, the owner's publish approval is filed for an app, and VAIC is told, as the chain's
sign-off would. A part that fails twice (tests or review) is taken over by a fresh worker on the takeover model.

The no-model steps that a worker's runtime may not do (it can only message its manager's queue) run in the
dispatcher Lambda: a manager-queue message with ``board`` set is a code step, never a model turn.

Since decision 298 the board is the only path: the Orchestrator chain and its switch are gone.
"""

from __future__ import annotations

import re
from typing import Any

from ..apps import drafts_of_ticket, request_publish_approvals
from ..build_models import models_for, needs_review, worker_model
from ..events import now_iso
from ..ledger import Record
from ..log import log
from ..table import UpdateOptions
from .actions import FINAL, CityDeps, move, new_ticket, quote, send
from .factory import WORKER_TOOLS, Factory

AWS_REVIEW = (
    "This part changes AWS infrastructure: also check security (least-privilege IAM, no public data, encryption, "
    "no secrets in code) and cost (nothing left running or oversized, tags on every resource); FAIL with the exact "
    "fix for any gap.\n"
)
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
    return await _department(d, str(name))  # "Engineering" reaches Application, like the planner's parts


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
    d: CityDeps,
    task: Record,
    goal_t: Record,
    dept: Record,
    part_goal: str,
    acceptance: str,
    body: str,
    model: str,
    extra: Record | None = None,
) -> tuple[Record, Record]:
    """Hires one worker on ``model`` into the department and gives it the part, the same records and events the
    chain writes (the City drives its taxi to the building), then starts its turn."""
    app_job = bool(task.get("app_id"))
    spec: Record = {
        "specialty": f"{dept['name']} builder",
        "instructions": f"You do one part of the owner's job in the {dept['name']} department, fast and well.",
        "tools": APP_TOOLS if app_job else [t for t in WORKER_TOOLS if t != "browser"],
    }
    from ..connectors import ConnectorStore

    # The connectors the owner opened to workers ride with every worker (the chain's managers picked them per hire).
    spec["connectors"] = sorted(
        str(c["id"])
        for c in await ConnectorStore(d.ledger.table).list()
        if (c.get("roles") or {}).get("worker") and c.get("status") == "ready"
    )[:20]
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
            **(extra or {}),
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
    review = not part.get("check") and needs_review(size, trivial=bool(part.get("trivial")), risky=not checked or bool(
        part.get("risky") or part.get("aws")) or risky(part.get("goal"), part.get("acceptance"), (task or {}).get("owner_words")
    ))  # fmt: skip
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    mgr = str((goal or {}).get("to") or part.get("from"))
    if review:
        reviewer = models_for(size).reviewer
        await d.bus.put({"type": "worker.state", "id": str(part["to"]), "state": "reporting"})
        await stage(d, str(part["task_id"]), "review", "start", str(part["id"]))
        await d.bus.put(
            {
                "type": "review.started",
                "ticket_id": str(part["id"]),
                "task_id": str(part["task_id"]),
                "department": part.get("department"),
                "reviewer": mgr,
                "round": float(part.get("review_rounds") or 0) + 1,
            }
        )
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
                    + (AWS_REVIEW if part.get("aws") else "")
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
    task_t = await d.ledger.get_ticket(str(part.get("task_id") or ""))
    if task_t and task_t.get("planned"):
        await _planned_part_done(d, task_t, await d.ledger.get_ticket(part_id) or part)
        return
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
    m = models_for(size)
    model = m.takeover if part.get("check") else worker_model(size, bool(part.get("trivial")), len(reasons))
    listed = "; ".join(f"({i}) {r}" for i, r in enumerate(reasons, 1)) or "it did not pass"
    if part.get("plan_key"):  # not a stopped part: the board must not count it as dropped while it changes hands
        await d.ledger.table.update(
            f"TICKET#{task['id']}", str(part["plan_key"]), UpdateOptions(set={"status": "replacing"}, must_exist=True)
        )
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
        f"A first worker tried this part and failed {len(reasons)} time{'s' if len(reasons) != 1 else ''}. Every "
        f"reason so far: {listed}. Fix all of them.",
        app,
    )
    keep: Record = {k: part[k] for k in ("plan_key", "files", "trivial", "risky", "aws", "check") if k in part}
    w, new = await _hire_and_assign(
        d, task, goal, dept, str(part["goal"]), str(part.get("acceptance") or ""), body, model, keep
    )
    if part.get("plan_key"):
        await d.ledger.table.update(
            f"TICKET#{task['id']}",
            str(part["plan_key"]),
            UpdateOptions(set={"ticket_id": new["id"], "status": "started"}, must_exist=True),
        )
    await d.ledger.set_ticket_status(new["id"], new["status"], "", {"review_reasons": reasons, "takeover": True})
    log("info", "board.takeover", part=part["id"], new=new["id"], worker=w["id"], model=model, fails=len(reasons))
    return f"Taken over by a fresh worker on {model}."


async def board_step(d: CityDeps, m: dict[str, Any]) -> None:
    """A code step on the board (the dispatcher runs it instead of a model turn)."""
    step = m.get("board")
    if step == "finish":
        await finish_part(d, str(m["ticketId"]), "The tests passed.")
    elif step == "escalate":
        await escalate(d, str(m["ticketId"]), str(m.get("body") or ""))
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


def fails_allowed(part: Record) -> int:
    """Failures before a part changes hands: the size's takeover count (2; decision 300 removed Haiku workers)."""
    return models_for(str(part.get("size") or "small")).fails_before_takeover


# ---------- medium, large and extreme jobs: a planner writes parts to the board (stage 3) ----------
PLAN = "PLAN#"
CHECK_NAME = "Whole-app check"


def shared_hire(task_id: str) -> str:
    """The workspace prefix every worker of one planned job shares (``hires/<this>/app/``); ``wkr-`` so the workspace
    role's session-tag rule admits it unchanged."""
    return f"wkr-shared-{task_id}"[:64]


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "part"


async def plan_items(d: CityDeps, task_id: str) -> list[Record]:
    items = [{k: v for k, v in i.items() if k != "pk"} for i in await d.ledger.table.query(f"TICKET#{task_id}", PLAN)]
    return sorted(items, key=lambda i: int(i.get("order") or 0))


def planner_brief(task: Record, app: Record | None, departments: list[str], notes: str = "") -> str:
    size = str(task.get("size") or "medium")
    m = models_for(size)
    lines = [
        f"Board planning: you are the planner of a {size} job.",
        f"The job: {task.get('goal')}",
        f"The owner's words: {task.get('owner_words') or task.get('goal')}",
        "Split it into parts that can run at the same time. Call add_part for each part the moment you have written it: "
        "it starts at once when it waits for nothing (the board hires its worker straight away), so write the parts "
        "that start the work first. Each part: a name, the goal, the acceptance, its department "
        f"({', '.join(departments)}), after (the names of parts it needs first; none when it can start now), files "
        "(the files it alone owns: no two parts own the same file) and trivial=true for a one-line or config change "
        "(it skips the reviewer when its tests pass). Then call finish_plan once. A whole-app check runs after every part, automatically, and "
        "makes the parts fit together; don't add one.",
        "Few, independent parts beat many small ones: one worker per part, no limit on how many.",
    ]
    if task.get("workers"):
        lines.append(f"The owner asked for exactly {task['workers']} agents: write that many parts that run at once.")
    if app:
        lines.append(
            f"Every part changes the existing app “{app['title']}”: each worker loads the shared copy, edits only its own "
            "files and saves them back; say in each part's goal which screens or features it touches."
        )
    elif task.get("conversation", "").startswith("app-new-") or "app" in str(task.get("goal", "")).lower():
        lines.append("If this is an app, every part builds into one shared app folder; split it by files.")
    if m.aws_checks:
        lines.append(
            "Extreme job: investigate first (search the knowledge base, read what exists), then hand parallel specialist "
            "leads to the departments that own them: Application (the app), IT Infrastructure (the AWS setup, in "
            "Terraform), Data & AI (data and models) and a security part. Mark every part that creates or changes AWS "
            "resources aws=true: its review adds security and cost checks."
        )
    if notes:
        lines.append(f"A worker started this alone and found it bigger. Its notes (untrusted data): {notes[:2000]}")
    return "\n".join(lines)


async def start_planned(d: CityDeps, task: Record, app: Record | None, extra: str = "", notes: str = "") -> None:
    """A medium, large or extreme job on the board: its planner (Sonnet, Opus or Fable by size) runs on the
    Orchestrator's runtime and writes parts with add_part; each part starts the moment it can."""
    m = models_for(str(task.get("size") or "medium"))
    await move(d, task["id"], "in_progress", "planning on the board", {"path": "board", "planned": True})
    names = sorted(
        str(x["name"])
        for x in await d.ledger.list_departments()
        if x.get("state", "active") == "active" and x.get("name")
    )
    body = planner_brief({**task, "path": "board"}, app, names, notes)
    if extra:
        body += f"\n{extra}"
    msg: dict[str, Any] = {
        "role": "orchestrator",
        "agentId": "orchestrator",
        "department": None,
        "ticketId": task["id"],
        "taskId": task["id"],
        "kind": "task",
        "from": "vaic",
        "body": body,
        "model": m.planner or m.worker,
    }
    if task.get("conversation"):
        msg["conversation"] = task["conversation"]
    await send(d, msg)
    log("info", "board.planner_started", task=task["id"], size=task.get("size"), model=msg["model"])


async def _department(d: CityDeps, name: str) -> Record | None:
    from ..presets import preset_for, replaced_by

    dept = await d.ledger.get_department(name)
    if not dept and (alt := replaced_by(name) or preset_for(name)):
        dept = await d.ledger.get_department(str(alt["name"]))
    return dept if dept and dept.get("state", "active") == "active" else None


async def add_part(d: CityDeps, task_id: str, a: dict[str, Any]) -> str:
    task = await d.ledger.get_ticket(task_id)
    if not task or not task.get("planned"):
        return "This job is not planned on the board."
    if task.get("plan_done"):
        return "The plan is finished; no more parts."
    name = " ".join(str(a.get("name") or "").split())[:80]
    if not name or name.lower() == CHECK_NAME.lower():
        return "Give the part a name (not the whole-app check, which runs by itself)."
    dept = await _department(d, str(a.get("department") or ""))
    if not dept:
        names = [str(x["name"]) for x in await d.ledger.list_departments() if x.get("state", "active") == "active"]
        return f"There is no department called {a.get('department')}. Use one of: {', '.join(names)}."
    items = await plan_items(d, task_id)
    known = {str(i["name"]).lower(): i for i in items}
    if name.lower() in known:
        return f"There is already a part called {name}."
    after = [" ".join(str(x).split()) for x in a.get("after") or [] if str(x).strip()]
    missing = [x for x in after if x.lower() not in known]
    if missing:
        return f"Add these parts first (after names an earlier part): {', '.join(missing)}."
    files = sorted({str(f).strip() for f in a.get("files") or [] if str(f).strip()})[:200]
    for i in items:
        taken = set(files) & set(i.get("files") or [])
        if taken:
            return f"{', '.join(sorted(taken))} already belong to {i['name']}: every file has one owner."
    item = {
        "pk": f"TICKET#{task_id}",
        "sk": f"{PLAN}{len(items):04d}#{_key(name)}",
        "name": name,
        "goal": str(a.get("goal") or name)[:4000],
        "acceptance": str(a.get("acceptance") or "Done as the goal says, tested.")[:2000],
        "department": dept["name"],
        "after": [str(known[x.lower()]["name"]) for x in after],
        "files": files,
        "trivial": bool(a.get("trivial")),
        "risky": bool(a.get("risky")),
        "aws": bool(a.get("aws")),
        "check": False,
        "order": len(items),
        "status": "waiting",
    }
    if not await d.ledger.table.put(item, if_not_exists=True):
        return f"There is already a part called {name}."
    started = await advance(d, task_id)
    await stage(d, task_id, "plan", "dur", _key(name), 0)
    if name in started:
        return f"Added {name}: its worker starts now."
    return f"Added {name}: it starts when {', '.join(item['after'])} {'is' if len(after) == 1 else 'are'} done."


async def finish_plan(d: CityDeps, task_id: str) -> str:
    task = await d.ledger.get_ticket(task_id)
    if not task or not task.get("planned"):
        return "This job is not planned on the board."
    items = await plan_items(d, task_id)
    if not items:
        return "Add at least one part first."
    if task.get("plan_done"):
        return "The plan is already finished."
    from collections import Counter

    home = None
    if task.get("app_id"):
        from ..apps import home_department

        home = home_department("Application")
    dept = home or Counter(str(i["department"]) for i in items).most_common(1)[0][0]
    size = str(task.get("size") or "medium")
    check = {
        "pk": f"TICKET#{task_id}",
        "sk": f"{PLAN}{len(items):04d}#{_key(CHECK_NAME)}",
        "name": CHECK_NAME,
        "goal": "Check that every part fits together as one finished whole, fix what doesn't, and deliver it.",
        "acceptance": "Everything the owner asked works together; nothing a part did breaks another.",
        "department": dept,
        "after": [str(i["name"]) for i in items],
        "files": [],
        "trivial": False,
        "risky": False,
        "aws": False,
        "check": True,
        "order": len(items),
        "status": "waiting",
    }
    await d.ledger.table.put(check, if_not_exists=True)
    await d.ledger.set_ticket_status(task_id, task["status"], "plan written", {"plan_done": True})
    await stage(d, task_id, "planning", "end")
    started = await advance(d, task_id)
    log("info", "board.plan_done", task=task_id, parts=len(items), size=size)
    return (
        f"Plan finished: {len(items)} part{'s' if len(items) != 1 else ''} and the whole-app check. "
        + (f"Starting now: {', '.join(started)}. " if started else "")
        + "End your turn; the board runs the rest."
    )


async def advance(d: CityDeps, task_id: str) -> list[str]:
    """Starts every part whose parts-before are done (each one once), and finishes the job when the plan is written
    and every part, the whole-app check last, is done. Returns the names it started."""
    task = await d.ledger.get_ticket(task_id)
    if not task or task["status"] in FINAL:
        return []
    items = await plan_items(d, task_id)
    for i in items:
        # A part stopped outside the board (the owner sent its worker home, a reviewer cancelled it) is dropped, so
        # the job can still finish with the rest (decision 298).
        if i.get("status") == "started" and i.get("ticket_id"):
            t = await d.ledger.get_ticket(str(i["ticket_id"]))
            if t and t.get("status") in ("cancelled", "failed"):
                i["status"], i["result"] = "done", f"Stopped: {t.get('status')}."
                await d.ledger.table.update(
                    f"TICKET#{task_id}", str(i["sk"]), UpdateOptions(set={"status": "done", "result": i["result"]})
                )
    done = {str(i["name"]) for i in items if i.get("status") == "done"}
    started: list[str] = []
    for i in items:
        if i.get("status") != "waiting" or not all(a in done for a in i.get("after") or []):
            continue
        claimed = await d.ledger.table.update(
            f"TICKET#{task_id}", str(i["sk"]), UpdateOptions(set={"status": "starting"}, expect={"status": "waiting"})
        )
        if claimed is None:
            continue  # another step started it
        try:
            part = await _start_item(d, task, i, items)
        except Exception:
            await d.ledger.table.update(f"TICKET#{task_id}", str(i["sk"]), UpdateOptions(set={"status": "waiting"}))
            raise
        await d.ledger.table.update(
            f"TICKET#{task_id}", str(i["sk"]), UpdateOptions(set={"status": "started", "ticket_id": part["id"]})
        )
        started.append(str(i["name"]))
    if task.get("plan_done") and items and all(i.get("status") == "done" for i in items):
        check = next((i for i in items if i.get("check")), items[-1])
        await finish_job(d, task, str(check.get("result") or ""))
    return started


async def _goal_for(d: CityDeps, task: Record, dept: Record) -> Record:
    for k in await d.ledger.child_tickets(task["id"]):
        if k.get("department") == dept["name"] and k.get("path") == "board" and k["status"] not in FINAL:
            return k
    await _manager(d, dept)
    if dept.get("stood_down_at"):
        await d.ledger.stand_down_department(dept["name"], down=False)
    goal = await new_ticket(
        d,
        {
            "goal": f"{dept['name']}'s parts of: {task['goal']}"[:4000],
            "acceptance": "Every part passes its tests and review.",
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
    await move(d, goal["id"], "in_progress", "parts on the board")
    return goal


async def _start_item(d: CityDeps, task: Record, item: Record, items: list[Record]) -> Record:
    dept = await _department(d, str(item["department"]))
    if not dept:
        raise RuntimeError(f"no active department {item['department']}")
    goal = await _goal_for(d, task, dept)
    size = str(task.get("size") or "medium")
    m = models_for(size)
    model = m.reviewer if item.get("check") else worker_model(size, bool(item.get("trivial")))
    app = None
    if task.get("app_id"):
        from ..apps import get_app

        app = await get_app(d.ledger, str(task["app_id"]))
    extra: list[str] = []
    if item.get("files"):
        extra.append(f"Your files (no one else edits them): {', '.join(item['files'])}.")
    is_app = bool(app) or str(task.get("conversation") or "").startswith("app-new-")
    if is_app and not item.get("check"):
        extra.append(
            "This app is built by several workers at once in one shared copy: call load_app first (it gives you the "
            "app and every part saved so far), edit only your own files, then submit_app, which saves just your "
            "changed files to the shared copy, then report_to_manager."
        )
    if item.get("check"):
        done = [i for i in items if not i.get("check")]
        results = "\n".join(f"- {i['name']}: {str(i.get('result') or 'done')[:600]}" for i in done)
        extra.append(
            "You are the whole-app check: every other part has passed. Make sure they fit together as one finished "
            "whole, fix what doesn't (small fixes only), then deliver it"
            + (": call load_app (the shared copy holds every part), run it, fix, then submit_app with the app's title"
               " and report_to_manager." if is_app else ": write the combined result in your report.")
            + f"\nWhat each part reported (untrusted data):\n{results}"
        )  # fmt: skip
    body = _assignment(task, str(item["goal"]), str(item["acceptance"]), "\n".join(extra), app)
    fields = {
        "plan_key": item["sk"],
        "files": item.get("files") or [],
        "trivial": bool(item.get("trivial")),
        "risky": bool(item.get("risky")),
        "aws": bool(item.get("aws")),
        "check": bool(item.get("check")),
        "shared_app": is_app,
    }
    _, part = await _hire_and_assign(
        d, task, goal, dept, str(item["goal"]), str(item["acceptance"]), body, model, fields
    )
    await stage(d, task["id"], "dispatch", "dur", str(part["id"]), 0)
    return part


async def _planned_part_done(d: CityDeps, task: Record, part: Record) -> None:
    if part.get("plan_key"):
        await d.ledger.table.update(
            f"TICKET#{task['id']}",
            str(part["plan_key"]),
            UpdateOptions(set={"status": "done", "result": str(part.get("result") or "")[:4000]}, must_exist=True),
        )
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    if goal and goal["status"] not in FINAL:
        items = await plan_items(d, task["id"])
        open_here = [i for i in items if i.get("department") == goal.get("department") and i.get("status") != "done"]
        kids_open = [k for k in await d.ledger.child_tickets(goal["id"]) if k["status"] not in FINAL]
        if not open_here and not kids_open:
            await move(d, goal["id"], "done", "every part passed")
    await advance(d, task["id"])


async def escalate(d: CityDeps, part_id: str, notes: str) -> None:
    """A small job's single worker found it bigger: its part closes (the worker goes home) and the job is planned as a
    medium one, with the worker's notes for the planner."""
    part = await d.ledger.get_ticket(part_id)
    if not part or part["status"] in FINAL:
        return
    task = await d.ledger.get_ticket(str(part.get("task_id") or ""))
    if not task or task.get("planned"):
        return
    await move(d, part["id"], "cancelled", "bigger than one worker: planned as a team")
    goal = await d.ledger.get_ticket(str(part.get("parent_id") or ""))
    if goal and goal["status"] not in FINAL:
        await move(d, goal["id"], "cancelled", "re-planned as a team")
    await d.ledger.set_ticket_status(
        task["id"], task["status"], "grown to a team", {"size": "medium", "size_reason": "the worker found it bigger"}
    )
    app = None
    if task.get("app_id"):
        from ..apps import get_app

        app = await get_app(d.ledger, str(task["app_id"]))
    await start_planned(d, {**task, "size": "medium"}, app, notes=notes)
    log("info", "board.escalated", task=task["id"], part=part_id)


# ---------- one way in for every job (decision 298: the Orchestrator chain is gone) ----------
async def launch(
    d: CityDeps,
    task: Record,
    *,
    department: str | None = None,
    app: Record | None = None,
    extra: str = "",
    notes: str = "",
) -> str:
    """Starts a job on the board: a small one with a known department gets one worker straight away, anything else
    a planner (Sonnet, Opus or Fable by size; a small job whose department isn't clear gets the Sonnet planner).
    Every caller that starts a job comes here: VAIC, standing orders, workflows, the ticket desk, adoption."""
    from ..sizing import size_job

    size = str(task.get("size") or "")
    if not size:
        # A caller that names the department (a standing order, a workflow, the ticket desk) writes a long goal for
        # one department's routine work: it is sized from the owner's own words only.
        goal = "" if department else str(task.get("goal") or "")
        sized = size_job(str(task.get("owner_words") or ""), goal, existing_app=bool(app))
        size = sized.size
        await d.ledger.set_ticket_status(
            task["id"], task["status"], "sized", {"size": size, "size_reason": sized.reason, "path": "board"}
        )
        task = {**task, "size": size, "size_reason": sized.reason}
    dept = await board_department(d, app, department) if (app or department) else None
    if size == "small" and dept and not notes:
        await start_small(d, task, dept, app, extra)
        return f"Started: one worker in {dept['name']} is on it now (a small job, no planning needed)."
    if department and not app:
        extra = "\n".join(x for x in (extra, f"Give every part to the {department} department unless one clearly "
                                      "belongs elsewhere.") if x)  # fmt: skip
    await start_planned(d, task, app, extra, notes)
    return f"Started: a {size} job; the planner splits it into parts and each starts as it is written."


async def adopt_chain_jobs(d: CityDeps) -> int:
    """The drain (decision 298): a job still live on the old Orchestrator chain moves onto the board once. Its old
    goals and parts are closed (their workers go home) and it is planned again from the owner's words, with what the
    chain had done so far as notes. Run by the sweep; idempotent."""
    from ..apps import get_app
    from .actions import LIVE

    moved = 0
    for t in await d.ledger.list_tickets(LIVE):
        if t.get("kind") != "task" or t.get("parent_id") or t.get("path") == "board":
            continue
        if not await d.ledger.claim(f"adopt:{t['id']}"):
            continue
        done: list[str] = []
        frontier = [t["id"]]
        while frontier:
            nxt: list[str] = []
            for pid in frontier:
                for k in await d.ledger.child_tickets(pid):
                    nxt.append(k["id"])
                    if k["status"] == "done" and k.get("result"):
                        done.append(f"{k.get('department') or ''}: {str(k['result'])[:300]}")
                    if k["status"] not in FINAL:
                        await move(d, k["id"], "cancelled", "moved onto the project board")
            frontier = nxt
        app = await get_app(d.ledger, str(t["app_id"])) if t.get("app_id") else None
        await d.ledger.set_ticket_status(t["id"], t["status"], "moved onto the board", {"path": "board"})
        fresh = await d.ledger.get_ticket(t["id"]) or t
        notes = "This job was running on the old chain and moved onto the board." + (
            " Already done: " + "; ".join(done)[:1800] if done else ""
        )
        await launch(d, fresh, app=app, notes=notes)
        log("info", "board.adopted", task=t["id"], done=len(done))
        moved += 1
    return moved


async def hand_over_department(d: CityDeps, old: str, instead: str) -> int:
    """A department was demolished: the board parts it still owned that had not started go to ``instead`` (or are
    dropped, so the job can still finish). Its started parts were cancelled by the demolition and return to waiting."""
    from .actions import LIVE

    n = 0
    for t in await d.ledger.list_tickets(LIVE):
        if t.get("kind") != "task" or not t.get("planned"):
            continue
        for i in await plan_items(d, t["id"]):
            if i.get("department") != old or i.get("status") == "done":
                continue
            patch = (
                {"department": instead, "status": "waiting", "ticket_id": None}
                if instead
                else {"status": "done", "result": f"Dropped: the owner demolished {old}."}
            )
            await d.ledger.table.update(f"TICKET#{t['id']}", str(i["sk"]), UpdateOptions(set=patch))
            n += 1
        await advance(d, t["id"])
    return n


async def instruct_job(d: CityDeps, task: Record, text: str) -> str:
    """The owner's change for a running board job: every worker on it hears it (no planner turn to relay it)."""
    from .actions import instruct_agent

    told = []
    for k in await d.ledger.list_tickets(("open", "in_progress", "in_review")):
        if k.get("task_id") == task["id"] and str(k.get("to") or "").startswith("wkr-"):
            await instruct_agent(d, str(k["to"]), text)
            told.append(str(k["to"]))
    return (
        f"Sent to {len(told)} worker{'s' if len(told) != 1 else ''} on the job."
        if told
        else "Nobody is working on it right now."
    )
