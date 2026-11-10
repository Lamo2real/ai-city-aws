"""The owner's jobs, in plain words: find one by what the owner calls it, say how it is going, stop it.

VAIC uses this for "how's the Porsche thing going?" and "stop it". Nothing here returns ids or the word
"ticket": the text is meant to be read out as it is.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from ..cost import format_usd
from ..ledger import ALL_STATUSES, Ledger
from ..log import log
from .actions import LIVE, CityDeps, move

Record = dict[str, Any]

DONE_OR_GONE = ("done", "failed", "cancelled")
_STOP = {
    "the", "a", "an", "on", "of", "for", "to", "and", "or", "job", "task", "thing", "that", "this", "my", "please",
    "it", "one", "about", "with", "in", "is", "how", "going", "status", "check", "stop", "cancel", "me", "you",
}  # fmt: skip
STUCK_AFTER_MINUTES = 20


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOP and len(w) > 1}


def _at(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def _ago(now: datetime, s: str | None) -> str:
    t = _at(s)
    if t is None:
        return "a while ago"
    m = max(0, int((now - t).total_seconds() // 60))
    if m < 1:
        return "just now"
    if m < 60:
        return f"{m} minute{'s' if m != 1 else ''} ago"
    h = m // 60
    return f"{h} hour{'s' if h != 1 else ''} ago"


def short_name(task: Record) -> str:
    """What to call the job in a sentence: the goal, trimmed."""
    goal = re.sub(r"\s+", " ", str(task.get("goal", ""))).strip().rstrip(".")
    return goal if len(goal) <= 70 else goal[:67].rsplit(" ", 1)[0] + "…"


async def recent_tasks(ledger: Ledger, limit: int = 20) -> list[Record]:
    """The owner's top-level jobs, running ones first, newest first within that."""
    tasks = [t for t in await ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task" and not t.get("parent_id")]
    live = sorted((t for t in tasks if t["status"] in LIVE), key=lambda t: str(t.get("updated_at", "")), reverse=True)
    rest = sorted(
        (t for t in tasks if t["status"] not in LIVE), key=lambda t: str(t.get("updated_at", "")), reverse=True
    )
    return [*live, *rest][:limit]


async def find_task(ledger: Ledger, query: str) -> tuple[Record | None, list[Record]]:
    """The job the owner means, by the words they used. Returns (match, candidates): a match when one job
    clearly fits; otherwise no match and up to five candidates for VAIC to ask about (empty = nothing fits)."""
    tasks = await recent_tasks(ledger)
    live = [t for t in tasks if t["status"] in LIVE]
    q = _words(query)
    if not q:
        return (live[0], []) if len(live) == 1 else (None, live[:5])
    scored: list[tuple[float, Record]] = []
    for t in tasks:
        text = _words(f"{t.get('goal', '')} {t.get('owner_words', '')} {t.get('result', '')} {t.get('department', '')}")
        hits = len(q & text)
        if hits:
            scored.append((hits + (0.5 if t["status"] in LIVE else 0), t))
    if not scored:
        return None, live[:5]
    scored.sort(key=lambda x: -x[0])
    best = scored[0][0]
    top = [t for s, t in scored if s >= best - 0.25]
    if len(top) > 1:
        return None, top[:5]
    return top[0], []


def _capital(s: str) -> str:
    return s[:1].upper() + s[1:]


JOB_WORDS = {
    "open": "Not started yet",
    "in_progress": "Working on it",
    "in_review": "Being checked",
    "waiting_on_owner": "Waiting for you",
    "parked": "On hold",
    "done": "Done",
    "failed": "Did not finish",
    "cancelled": "Stopped",
}


async def job_rows(ledger: Ledger, finished: bool = False, limit: int = 50) -> list[Record]:
    """The Work screen: one row per job of the owner's, in plain words. Status says what matters most across the
    job's parts (waiting for you, then being checked); progress counts the parts a worker does (the leaves)."""
    tickets = await ledger.list_tickets(ALL_STATUSES)
    kids: dict[str, list[Record]] = {}
    for t in tickets:
        if t.get("parent_id"):
            kids.setdefault(str(t["parent_id"]), []).append(t)
    rows: list[Record] = []
    for job in tickets:
        if job.get("kind") != "task" or job.get("parent_id") or (job["status"] in DONE_OR_GONE) != finished:
            continue
        tree: list[Record] = []
        frontier = [job["id"]]
        while frontier and len(tree) < 500:
            nxt = [k for pid in frontier for k in kids.get(pid, [])]
            tree += nxt
            frontier = [k["id"] for k in nxt]
        parts = [t for t in tree if not kids.get(t["id"])]
        live = {t["status"] for t in tree}
        status = job["status"]
        if status not in DONE_OR_GONE:
            status = next((s for s in ("waiting_on_owner", "in_review", "in_progress") if s in live), status)
        rows.append(
            {
                "id": job["id"],
                "name": _capital(short_name({"goal": job.get("owner_words") or job.get("goal", "")})),
                "status": status,
                "words": JOB_WORDS.get(status, status.replace("_", " ")),
                "parts_done": sum(1 for p in parts if p["status"] == "done"),
                "parts_total": len(parts),
                "started_at": job.get("created_at"),
                "updated_at": max([str(t.get("updated_at") or "") for t in [job, *tree]]),
                "result": job.get("result"),
            }
        )
    rows.sort(key=lambda r: str(r["updated_at"]), reverse=True)
    return rows[:limit]


async def task_tree(ledger: Ledger, task_id: str) -> list[Record]:
    """The job and everything under it (department goals, worker assignments)."""
    root = await ledger.get_ticket(task_id)
    if root is None:
        return []
    out = [root]
    frontier = [task_id]
    seen = {task_id}
    while frontier:
        nxt: list[str] = []
        for pid in frontier:
            for k in await ledger.child_tickets(pid):
                if k["id"] not in seen:
                    seen.add(k["id"])
                    out.append(k)
                    nxt.append(k["id"])
        frontier = nxt
    return out


def _workers_of(agents: list[Record], ids: set[str]) -> list[Record]:
    return [a for a in agents if a.get("kind") == "worker" and (a.get("ticket_id") in ids or a.get("goal_id") in ids)]


async def job_cost(ledger: Ledger, task: Record) -> float:
    """What a job has cost so far: every worker that was hired for any part of it."""
    tree = await task_tree(ledger, task["id"])
    ids = {t["id"] for t in tree}
    return sum(float(w.get("total_cost_usd") or 0) for w in _workers_of(await ledger.list_agents(), ids))


async def describe_task(ledger: Ledger, task: Record) -> str:
    """Plain-language progress of one job, for VAIC to say as it is."""
    now = ledger.now()
    tree = await task_tree(ledger, task["id"])
    ids = {t["id"] for t in tree}
    parents = {t.get("parent_id") for t in tree}
    assignments = [t for t in tree if t.get("kind") == "assignment" and t["id"] not in parents]  # the leaf parts
    departments = sorted({str(t["department"]) for t in tree if t.get("department")})
    agents = await ledger.list_agents()
    all_workers = _workers_of(agents, ids)
    busy = [w for w in all_workers if w.get("state") != "retired"]
    cost = sum(float(w.get("total_cost_usd") or 0) for w in all_workers)
    done = sum(1 for a in assignments if a["status"] == "done")
    name = short_name(task)
    status = task["status"]
    lines = [f"The job: {name}."]
    if status in DONE_OR_GONE:
        word = {"done": "finished", "failed": "failed", "cancelled": "was stopped"}[status]
        lines.append(f"It {word} {_ago(now, task.get('updated_at'))}.")
        if status == "done" and task.get("result"):
            lines.append(f"Result: {str(task['result'])[:300]}")
        lines.append(f"It cost about {format_usd(cost)}.")
        return " ".join(lines)
    lines.append(f"Started {_ago(now, task.get('created_at'))}.")
    if departments:
        lines.append(f"Team: {', '.join(departments)}.")
    else:
        lines.append("The planner is still deciding who does it.")
    if busy:
        lines.append(f"{len(busy)} worker{'s' if len(busy) != 1 else ''} on it right now.")
    if assignments:
        lines.append(f"{done} of {len(assignments)} part{'s' if len(assignments) != 1 else ''} done.")
    statuses = {t["status"] for t in tree if t["status"] in LIVE}
    if "waiting_on_owner" in statuses:
        lines.append("It is waiting for you: there is something to answer or approve in Needs you.")
    elif "in_review" in statuses:
        lines.append("A finished part is being checked before it comes back.")
    lines.append(f"Cost so far: about {format_usd(cost)}.")
    last = max((str(t.get("updated_at", "")) for t in tree), default="")
    quiet = _at(last)
    if quiet is not None and (now - quiet).total_seconds() > STUCK_AFTER_MINUTES * 60:
        lines.append(f"Nothing has happened for {_ago(now, last).replace(' ago', '')}; it may be stuck.")
    lines.append("Say stop if you want me to cancel it.")
    return " ".join(lines)


async def cancel_preview(ledger: Ledger, task: Record) -> str:
    """One line for VAIC to confirm with the owner before stopping a job."""
    tree = await task_tree(ledger, task["id"])
    ids = {t["id"] for t in tree}
    workers = _workers_of(await ledger.list_agents(), ids)
    busy = [w for w in workers if w.get("state") != "retired"]
    cost = sum(float(w.get("total_cost_usd") or 0) for w in workers)
    return (
        f"Stop the job “{short_name(task)}”? {len(busy)} worker{'s' if len(busy) != 1 else ''} on it, "
        f"about {format_usd(cost)} so far."
    )


async def cancel_task(d: CityDeps, task: Record) -> dict[str, int]:
    """Stops a job: every open part becomes cancelled (the city hears each one), its workers are released,
    and the dispatcher ignores anything still queued for it."""
    tree = await task_tree(d.ledger, task["id"])
    ids = {t["id"] for t in tree}
    # The workers on the job before anything moves: cancelling a part sends its worker home on its own
    # (`move`), so they are counted here and the explicit release below is a no-op for most of them.
    workers = [w for w in _workers_of(await d.ledger.list_agents(), ids) if w.get("state") != "retired"]
    stopped = 0  # parts under the job; the job itself is not a part
    for t in tree:
        if t["status"] not in DONE_OR_GONE:
            await move(d, t["id"], "cancelled", "stopped by the owner")
            stopped += t["id"] != task["id"]
    released = 0
    for w in workers:
        try:
            await d.factory.release(w["id"], str(w.get("parent")))
            released += 1
        except Exception as e:  # a worker already gone is fine; the rest still stop
            log("info", "cancel.release_skipped", worker=w["id"], error=type(e).__name__)
    return {"jobs": stopped, "workers": released}


def which_one(candidates: list[Record]) -> str:
    if not candidates:
        return "I can't find a job like that. Nothing with those words is running or recent."
    names = "; ".join(f"“{short_name(t)}”" for t in candidates)
    return f"Which one do you mean? {names}"
