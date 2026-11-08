"""The Chief of Staff: decides every item in the owner's Needs you inbox the moment it appears (decision 124).

An always-on Claude Fable 5.1 call (Opus 5.5 once on a refusal or an unavailable model, like the managers), no
AgentCore runtime: the ``chief-of-staff`` Lambda runs it on ``question.asked`` and ``approval.requested`` and
in a sweep every 5 minutes. It reads the item, its job and history, the owner's notes and agreed briefs, and
what it decided before on the same job, and answers with one JSON decision. The decision is carried out by the
api Lambda through the very code the HUD's buttons use (``api.steward_apply``), so departments continue
exactly as if the owner had clicked.

Items that need the owner's own hands (a sign-in, a key or password, a card, MFA) are left open and marked
``needs_owner_reason``; the inbox then holds only those. The model never sees a secret and never types one.
Every decision is written on the item (``decided_by``, ``decision``, ``reason``, ``decided_at``), kept in the
ledger for 8 days under ``STEWARD`` and sent on the bus as ``steward.decided``.
"""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Final, Literal

from .events import EventBus, now_iso
from .ledger import Ledger, Record
from .log import log
from .models import resolve_role_from_env
from .table import UpdateOptions
from .turn import GateDeps, GatedTurn, ModelRunner, run_gated_turn
from .utility import agents_dir

CHIEF: Final = "chief_of_staff"
Kind = Literal["question", "approval"]
KEEP_DAYS = 8
"""How long a decision stays listed (``GET /chief-of-staff`` shows the last 7 days)."""
CLAIM_S = 600
"""One review per item at a time; a failed review is tried again by a sweep once this runs out."""

Apply = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
"""Carries out one decision through the api Lambda (``api.steward_apply``); returns ``{"ok": bool, ...}``."""


def enabled(settings: dict[str, Any]) -> bool:
    return settings.get("chief_of_staff_enabled") is not False


def _prompt() -> str:
    return (agents_dir() / "chief_of_staff.md").read_text(encoding="utf-8").strip()


def title_of(kind: Kind, item: Record) -> str:
    t = str(item.get("text") if kind == "question" else item.get("title") or item.get("action") or "")
    t = " ".join(t.split())
    return t if len(t) <= 160 else t[:157] + "…"


# ---------- the decision ----------
@dataclass(frozen=True)
class Decision:
    decision: Literal["answer", "approve", "refuse", "stop_job", "needs_owner"]
    answer: str = ""
    reason: str = ""
    why: str = ""


_DECISIONS = ("answer", "approve", "refuse", "stop_job", "needs_owner")


def parse_decision(text: str, kind: Kind) -> Decision | None:
    """The model's one JSON object (fences and stray words around it tolerated). None when it doesn't fit."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        j = json.loads(m.group(0))
    except ValueError:
        return None
    if not isinstance(j, dict) or j.get("decision") not in _DECISIONS:
        return None
    d = str(j["decision"])
    if (kind == "question" and d in ("approve", "refuse")) or (kind == "approval" and d == "answer"):
        return None
    out = Decision(
        decision=d,  # type: ignore[arg-type]
        answer=str(j.get("answer") or "").strip()[:4000],
        reason=" ".join(str(j.get("reason") or "").split())[:240],
        why=" ".join(str(j.get("why") or "").split())[:240],
    )
    if d == "answer" and not out.answer:
        return None
    if d == "needs_owner" and not out.why:
        return None
    return out


# ---------- context ----------
async def _root(ledger: Ledger, ticket: Record | None) -> Record | None:
    t = ticket
    for _ in range(20):
        if not t or t.get("kind", "task") == "task" or not t.get("parent_id"):
            return t
        up = await ledger.get_ticket(str(t["parent_id"]))
        if not up:
            return t
        t = up
    return t


def _brief(t: Record) -> dict[str, Any]:
    keep = ("id", "kind", "goal", "owner_words", "brief", "status", "department", "to", "from", "updated_at")
    return {k: t[k] for k in keep if t.get(k) not in (None, "")}


async def context(ledger: Ledger, kind: Kind, item: Record) -> dict[str, Any]:
    """What the Chief of Staff reads besides the item: the job, its history, notes, briefs, past decisions."""
    ctx: dict[str, Any] = {}
    asker = await ledger.get_agent(str(item.get("asked_by") or item.get("agent") or ""))
    if asker:
        ctx["asked_by"] = {k: asker.get(k) for k in ("id", "kind", "role", "department", "specialty")}
    ticket = await ledger.get_ticket(str(item["ticket_id"])) if item.get("ticket_id") else None
    if ticket:
        ctx["part"] = _brief(ticket)
        ctx["part_history"] = [
            {k: h.get(k) for k in ("at", "from", "to", "note") if h.get(k) is not None}
            for h in (await ledger.ticket_history(ticket["id"]))[-15:]
        ]
        root = await _root(ledger, ticket)
        if root and root["id"] != ticket["id"]:
            ctx["job"] = _brief(root)
    notes = await ledger.list_notes("note")
    ctx["owner_notes"] = [str(n.get("text", ""))[:500] for n in notes[-30:]]
    job_ids = {str(ticket["id"]), str((ctx.get("job") or {}).get("id") or ticket["id"])} if ticket else set()
    if job_ids:
        ctx["my_earlier_decisions_on_this_job"] = [
            {k: r.get(k) for k in ("at", "kind", "title", "choice", "reason")}
            for r in await recent_decisions(ledger)
            if r.get("ticket_id") in job_ids or r.get("job_id") in job_ids
        ][:20]
    return ctx


def _item_view(kind: Kind, item: Record) -> dict[str, Any]:
    keep = (
        ("id", "text", "options", "default_answer", "asked_by", "created_at")
        if kind == "question"
        else ("id", "agent", "kind", "action", "reason", "cost_hint", "title", "description", "preview", "created_at")
    )
    return {"type": kind, **{k: item[k] for k in keep if item.get(k) not in (None, "", [])}}


# ---------- records ----------
async def recent_decisions(ledger: Ledger, days: int = 7) -> list[Record]:
    since = now_iso(ledger.now() - timedelta(days=days))
    rows = [r for r in await ledger.table.query("STEWARD") if str(r.get("at", "")) >= since]
    return [{k: v for k, v in r.items() if k not in ("pk", "sk", "ttl")} for r in reversed(rows)]


async def record_decision(ledger: Ledger, bus: EventBus, kind: Kind, item: Record, choice: str, reason: str) -> None:
    """Writes the decision on the item and in the ``STEWARD`` log, and tells the HUD (``steward.decided``)."""
    at = now_iso(ledger.now())
    pk = f"Q#{item['id']}" if kind == "question" else f"APPROVAL#{item['id']}"
    await ledger.table.update(
        pk,
        "META",
        UpdateOptions(set={"decided_by": CHIEF, "decision": choice, "reason": reason, "decided_at": at}),
    )
    asker = await ledger.get_agent(str(item.get("asked_by") or item.get("agent") or ""))
    ticket = await ledger.get_ticket(str(item["ticket_id"])) if item.get("ticket_id") else None
    root = await _root(ledger, ticket)
    row: Record = {
        "pk": "STEWARD",
        "sk": f"{at}#{item['id']}",
        "id": item["id"],
        "kind": kind,
        "title": title_of(kind, item),
        "choice": choice,
        "reason": reason,
        "at": at,
        "department": str(item.get("department") or (asker or {}).get("department") or ""),
        "ttl": ledger.now_ms() // 1000 + KEEP_DAYS * 86_400,
    }
    if ticket:
        row["ticket_id"] = ticket["id"]
    if root:
        row["job_id"] = root["id"]
    await ledger.table.put(row)
    await bus.put({"type": "steward.decided", "id": item["id"], "kind": kind, "choice": choice, "reason": reason})


async def mark_needs_owner(ledger: Ledger, kind: Kind, item: Record, why: str) -> None:
    pk = f"Q#{item['id']}" if kind == "question" else f"APPROVAL#{item['id']}"
    await ledger.table.update(
        pk, "META", UpdateOptions(set={"needs_owner_reason": why, "needs_owner_at": now_iso(ledger.now())})
    )


async def status(ledger: Ledger, settings: dict[str, Any]) -> dict[str, Any]:
    """``GET /chief-of-staff``: on or off, what it decided in the last 7 days, what it left for the owner."""
    decided = [
        {k: r.get(k, "") for k in ("id", "kind", "title", "choice", "reason", "at", "department")}
        for r in await recent_decisions(ledger)
    ][:200]
    left: list[dict[str, str]] = []
    for kind, items in (("question", await ledger.open_questions()), ("approval", await ledger.pending_approvals())):
        for it in items:
            if it.get("needs_owner_reason"):
                left.append(
                    {"id": it["id"], "title": title_of(kind, it), "why": str(it["needs_owner_reason"])}  # type: ignore[arg-type]
                )
    return {"enabled": enabled(settings), "decided": decided, "needs_owner": left}


# ---------- the review ----------
@dataclass
class ChiefDeps:
    ledger: Ledger
    bus: EventBus
    runner: ModelRunner
    settings: Callable[[], Awaitable[dict[str, Any]]]
    apply: Apply
    env: dict[str, str] | None = None


def _op(kind: Kind, item: Record, d: Decision) -> dict[str, Any]:
    base = {"kind": kind, "id": item["id"], "reason": d.reason or "Keeps the work moving."}
    if d.decision == "stop_job":
        return {**base, "op": "stop_job"}
    if d.decision == "answer":
        is_default = d.answer.strip().lower() == str(item.get("default_answer", "")).strip().lower()
        return {**base, "op": "default" if is_default else "answer", "answer": d.answer}
    return {**base, "op": d.decision}


async def decide(d: ChiefDeps, kind: Kind, item: Record) -> dict[str, Any]:
    """One item: the model's decision, then carried out (or left for the owner). Never raises for a bad reply."""
    settings = await d.settings()
    prompt = (
        f"{_prompt()}\n\n<item>\n{json.dumps(_item_view(kind, item), ensure_ascii=False)}\n</item>\n\n"
        f"<context>\n{json.dumps(await context(d.ledger, kind, item), ensure_ascii=False, default=str)}\n</context>"
    )
    r = await run_gated_turn(
        GatedTurn(
            kind=CHIEF,
            role=CHIEF,
            agent_id=CHIEF,
            session_id="chief-of-staff-calls-are-stateless",
            department=None,
            ticket_id=item.get("ticket_id"),
            models=resolve_role_from_env(CHIEF, d.env),
            prompt=prompt,
            prefix=settings.get("profile_prefix"),
            timeout_ms=120_000,
            max_tokens=1024,
        ),
        GateDeps(ledger=d.ledger, bus=d.bus, settings=settings, runner=d.runner),
    )
    dec = parse_decision(r.output.text, kind)
    if dec is None:
        log("warn", "chief.unparsed", id=item["id"], kind=kind)
        return {"id": item["id"], "result": "unparsed"}
    if dec.decision == "needs_owner":
        await mark_needs_owner(d.ledger, kind, item, dec.why)
        return {"id": item["id"], "result": "needs_owner"}
    out = await d.apply(_op(kind, item, dec))
    log("info", "chief.decided", id=item["id"], kind=kind, decision=dec.decision, ok=bool(out.get("ok")))
    return {"id": item["id"], "result": dec.decision if out.get("ok") else "not_applied"}


def _waiting(item: Record) -> bool:
    return not item.get("needs_owner_reason") and item.get("decided_by") != CHIEF


async def review(d: ChiefDeps, only: str | None = None) -> dict[str, Any]:
    """Every open item (or just ``only``) not yet decided and not left for the owner. Off = nothing happens."""
    if not enabled(await d.settings()):
        return {"skipped": "chief of staff is off"}
    items: list[tuple[Kind, Record]] = [
        *(("question", q) for q in await d.ledger.open_questions()),
        *(("approval", a) for a in await d.ledger.pending_approvals()),
    ]
    results: list[dict[str, Any]] = []
    for kind, item in items:
        if (only and item["id"] != only) or not _waiting(item):
            continue
        if not await d.ledger.claim(f"chief:{item['id']}", CLAIM_S):
            continue
        try:
            results.append(await decide(d, kind, item))
        except Exception as e:  # one bad item never stops the rest; the next sweep tries it again
            log("warn", "chief.failed", id=item["id"], error=type(e).__name__)
            results.append({"id": item["id"], "result": "error"})
    return {"reviewed": len(results), "results": results}


# ---------- the daily digest ----------
def digest_text(rows: list[Record]) -> str:
    n = len(rows)
    picks = "; ".join(f"{r.get('title', '')[:80]} → {str(r.get('choice', ''))[:60]}" for r in rows[:6])
    more = f", and {n - 6} more" if n > 6 else ""
    return (
        f"Chief of Staff, last 24 hours: I decided {n} item{'s' if n != 1 else ''} in Needs you so the work kept "
        f"moving: {picks}{more}. Open Needs you to see each one and why."
    )


async def digest(ledger: Ledger, bus: EventBus) -> dict[str, Any]:
    """One paragraph to AIC's conversation (``main``) about what was decided in the last day; nothing if nothing."""
    rows = await recent_decisions(ledger, days=1)
    if not rows:
        return {"digest": "nothing decided"}
    if not await ledger.claim(f"chief-digest:{now_iso(ledger.now())[:10]}", 2 * 86_400):
        return {"digest": "already sent"}
    text = digest_text(rows)
    await ledger.add_conversation_line("main", "ace", text)
    await bus.put({"type": "ace.reply", "conversation": "main", "text": text, "done": True})
    return {"digest": "sent", "decided": len(rows)}
