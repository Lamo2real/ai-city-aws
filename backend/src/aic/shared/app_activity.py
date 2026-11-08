"""``GET /apps/<id>/activity``: what happened to one app, in plain words for the Projects studio.

Built from the ledger only: the app's jobs (tickets, their history and trace), its drafts, its versions and the
approvals about it (publishing and the app's own proposals). Newest last, at most 100. Every line is written
for a non-technical owner: no ids, links, code or inside words.
"""

from __future__ import annotations

import re
from typing import Any

from .apps import get_app, list_drafts
from .ledger import ALL_STATUSES, Ledger

Record = dict[str, Any]
MAX_ITEMS = 100
TEXT_MAX = 220

_IDS = re.compile(r"\b(?:t|wkr|mgr|app|drf|ap|turn|k|q|conv|hire)-[\w-]+\b|\b[0-9a-f]{12,}\b", re.I)
_URLS = re.compile(r"https?://\S+")
_CODE = re.compile(r"```.*?```|`[^`]*`", re.S)
_WORDS = (("ticket", "job"), ("orchestrator", "planner"), ("ledger", "records"), ("assignment", "part"))

# An app's proposals (docs/APPS.md § v2), said the owner's way.
_PROPOSALS = {
    "calendar.respond": "answer a calendar invitation",
    "calendar.create": "add an event to your calendar",
    "mail.draft": "write an email draft",
}
_DECIDED = {
    "approved": " You said yes.",
    "used": " You said yes.",
    "denied": " You said no.",
    "withdrawn": " It was dropped.",
}


def plain(text: Any, cap: int = TEXT_MAX) -> str:
    """Owner-facing words: no code, links or ids; inside words swapped; one short line."""
    s = _CODE.sub("", str(text or ""))
    s = _URLS.sub("", s)
    s = _IDS.sub("", s)
    for inside, outside in _WORDS:
        s = re.sub(rf"\b{inside}(s?)\b", rf"{outside}\1", s, flags=re.I)
    s = re.sub(r"\(\s*[,;]?\s*\)", "", s)
    s = re.sub(r"\s+", " ", s).strip(" ,;:-")
    return s if len(s) <= cap else s[: cap - 1].rstrip() + "…"


def _who_asked(agent_id: str) -> str:
    if agent_id.startswith("wkr-"):
        return "Builder"
    if agent_id.startswith("mgr-") or agent_id.startswith("manager"):
        return "Manager"
    if agent_id == "orchestrator":
        return "Planner"
    return "AIC"


def _status_line(t: Record, to: str) -> tuple[str, str] | None:
    """One ticket's move to ``to``, said by whoever made it."""
    kind = t.get("kind") or "task"
    dept = str(t.get("department") or "the")
    goal = plain(t.get("goal"))
    if kind == "task":
        return {
            "open": ("AIC", f"Passed your request to the team: {goal}"),
            "waiting_on_owner": ("AIC", "The team is waiting for you."),
            "done": ("AIC", "The job is finished."),
            "failed": ("AIC", "The job ran into a problem and stopped."),
            "cancelled": ("AIC", "The job was stopped."),
        }.get(to)
    if t.get("from") == "orchestrator":  # a department's part
        return {
            "open": ("Planner", f"Asked the {dept} team: {goal}"),
            "done": ("Manager", f"The {dept} team finished its part."),
            "failed": ("Manager", f"The {dept} team could not finish its part."),
        }.get(to)
    # A worker's part (or a fix for one)
    return {
        "open": ("Manager", f"Asked a builder to fix: {goal}" if kind == "fix" else f"Gave a builder the work: {goal}"),
        "in_progress": ("Builder", "Started working."),
        "in_review": ("Builder", "Finished a version and sent it for a check."),
        "done": ("Reviewer", "Approved the builder's work."),
        "failed": ("Builder", "Could not finish this part."),
        "cancelled": ("Builder", "Stopped."),
    }.get(to)


def _event_line(e: Record) -> tuple[str, str] | None:
    """A step from a ticket's trace (``ledger_writer``); status moves come from the ticket's own history."""
    t = e.get("type")
    if t == "review.result":
        ok = e.get("verdict") == "PASS"
        return ("Reviewer", "Checked the work: it passes." if ok else f"Asked for changes: {plain(e.get('summary'))}")
    if t == "signoff.result":
        ok = e.get("verdict") == "PASS"
        return ("Manager", "Signed off the finished app." if ok else f"Not happy yet: {plain(e.get('summary'))}")
    if t == "app.draft":
        if e.get("status") == "ready":
            return ("Builder", "Handed in a version for you to try.")
        if e.get("status") == "rejected" and e.get("reason") != "replaced":
            return ("Builder", f"A version did not pass the city's checks: {plain(e.get('reason'))}")
        return None
    if t == "question.asked":
        q = e.get("question") or {}
        return (_who_asked(str(q.get("asked_by") or "")), f"Asked you: {plain(q.get('text'))}")
    if t == "instruction":
        return ("You", f"Told the team: {plain(e.get('text'))}")
    return None


async def app_activity(ledger: Ledger, app_id: str) -> list[Record] | None:
    """The app's story, oldest first, the newest ``MAX_ITEMS``. None if there is no such app."""
    app = await get_app(ledger, app_id)
    if not app:
        return None
    versions = [app, *(app.get("history") or [])]
    draft_ids = {str(v["draft_id"]) for v in versions if v.get("draft_id")}
    drafts = [dr for dr in await list_drafts(ledger) if dr["draft_id"] in draft_ids or dr.get("replaces") == app_id]
    draft_ids |= {str(dr["draft_id"]) for dr in drafts}

    tickets = await ledger.list_tickets(ALL_STATUSES)
    by_id = {str(t["id"]): t for t in tickets}
    roots = {str(t["id"]) for t in tickets if t.get("kind", "task") == "task" and t.get("app_id") == app_id}
    roots |= {str(x) for x in [app.get("task_id"), *(dr.get("task_id") for dr in drafts)] if x and str(x) in by_id}
    mine, frontier = set(roots), set(roots)
    while frontier:  # a job's parts and their parts (three levels at most in practice)
        frontier = {str(t["id"]) for t in tickets if t.get("parent_id") in frontier} - mine
        mine |= frontier

    items: list[Record] = []

    def add(at: Any, who: str, text: str) -> None:
        if at and text:
            items.append({"at": str(at), "who": who, "text": text})

    for tid in mine:
        t = by_id[tid]
        for h in await ledger.ticket_history(tid):
            line = _status_line(t, str(h.get("to")))
            if line:
                add(h.get("at"), *line)
        for e in await ledger.trace(tid):
            line = _event_line(e)
            if line:
                add(e.get("at"), *line)

    for v in versions:
        add(v.get("published_at"), "AIC", f"Version {int(v.get('version') or 1)} went live.")

    approvals = [
        a
        for status in ("pending", "approved", "used", "denied", "withdrawn")
        for a in await ledger.table.query_index("gsi1", f"APPROVAL#{status}")
    ]
    for a in approvals:
        status = str(a.get("status") or "")
        if a.get("kind") == "app.publish" and str(a.get("draft_id")) in draft_ids:
            waiting = " It is waiting for you in Needs you." if status == "pending" else _DECIDED.get(status, "")
            add(a.get("created_at"), "AIC", f"Asked you to approve: {plain(a.get('action'))}.{waiting}")
        elif a.get("requested_by") == f"app:{app_id}":
            what = _PROPOSALS.get(str(a.get("tool")), "do something for you")
            waiting = " It is waiting for you in Needs you." if status == "pending" else _DECIDED.get(status, "")
            add(a.get("created_at"), "App", f"Asked to {what}.{waiting}")

    items.sort(key=lambda i: i["at"])
    return items[-MAX_ITEMS:]
