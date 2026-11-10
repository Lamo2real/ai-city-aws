"""The sales pipeline: AI City's own free deal board, and Sales' follow-ups on stale deals (decision 133).

When the business uses a CRM (HubSpot, Pipedrive, Salesforce, Attio, Close…), Sales works there through its
connector. Without one, this board is the CRM. Either way a standing order for Sales ("follow up on the sales
pipeline every day") runs as an ordinary job: Sales finds the deals nobody has touched for a while, follows up with
each contact, notes it on the deal and records it as handled for the day, so nobody is chased twice.

Ledger: ``DEALS`` / ``<deal id>``.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any

from .events import now_iso
from .ledger import Ledger, Record
from .table import UpdateOptions

STAGES = ("lead", "nurturing", "qualified", "contacted", "meeting", "proposal", "negotiation", "won", "lost")
OPEN = STAGES[:7]
MARKETING_STAGES = ("lead", "nurturing")
"""Marketing's part of the shared pipeline (decision 137); from "qualified" on, the deal is Sales'."""
TEAMS = ("Marketing", "Sales")
WORDS = {
    "lead": "New lead",
    "nurturing": "Being nurtured",
    "qualified": "Qualified for Sales",
    "contacted": "Contacted",
    "meeting": "Meeting booked",
    "proposal": "Proposal sent",
    "negotiation": "Negotiating",
    "won": "Won",
    "lost": "Lost",
}
STALE_DAYS = 7
MAX_HISTORY = 30
MAX_DEALS = 2000

_FIELDS = ("id", "name", "company", "contact", "email", "stage", "value", "currency", "next_step", "last_contact_at",
           "history", "created_at", "updated_at", "team")  # fmt: skip


class Invalid(ValueError):
    pass


def _line(v: Any, n: int) -> str:
    return " ".join(str(v or "").split())[:n]


def _clean(r: Record) -> Record:
    out = {k: r[k] for k in _FIELDS if k in r}
    out["words"] = WORDS.get(str(out.get("stage")), str(out.get("stage")))
    out.setdefault("team", team_of(str(out.get("stage"))))
    return out


def _stage(v: Any) -> str:
    s = _line(v, 20).lower()
    if s not in STAGES:
        raise Invalid(f"The stage must be one of: {', '.join(STAGES)}.")
    return s


def _value(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        n = float(re.sub(r"[^\d.\-]", "", str(v)))
    except ValueError:
        raise Invalid("The value must be a number.") from None
    if n < 0:
        raise Invalid("The value can't be negative.")
    return round(n, 2)


def team_of(stage: str) -> str:
    return "Marketing" if stage in MARKETING_STAGES else "Sales"


async def list_deals(
    ledger: Ledger, stale_days: int | None = None, stage: str | None = None, team: str | None = None
) -> list[Record]:
    rows = [_clean(r) for r in await ledger.table.query("DEALS")]
    if team:
        rows = [r for r in rows if str(r.get("team")).lower() == team.lower()]
    if stage == "open":
        rows = [r for r in rows if r.get("stage") in OPEN]
    elif stage:
        rows = [r for r in rows if r.get("stage") == stage]
    if stale_days is not None:
        cut = now_iso(ledger.now() - timedelta(days=stale_days))
        rows = [r for r in rows if r.get("stage") in OPEN and str(r.get("last_contact_at") or "") <= cut]
    return sorted(rows, key=lambda r: str(r.get("last_contact_at") or ""))


async def get_deal(ledger: Ledger, id: str) -> Record | None:
    r = await ledger.table.get("DEALS", id.strip())
    return _clean(r) if r else None


async def add_deal(ledger: Ledger, a: dict[str, Any], who: str) -> Record:
    name = _line(a.get("name") or a.get("company"), 120)
    if not name:
        raise Invalid("Say who the deal is with (name or company).")
    if len(await ledger.table.query("DEALS")) >= MAX_DEALS:
        raise Invalid(f"The board holds {MAX_DEALS} deals; close some first.")
    now = now_iso(ledger.now())
    rec: Record = {
        "id": f"deal-{ledger.now_ms() % 10**10:010d}",
        "name": name,
        "company": _line(a.get("company"), 120),
        "contact": _line(a.get("contact"), 120),
        "email": _line(a.get("email"), 200),
        "stage": _stage(a.get("stage") or "lead"),
        "team": team_of(_stage(a.get("stage") or "lead")),
        "value": _value(a.get("value")),
        "currency": _line(a.get("currency"), 8).upper(),
        "next_step": _line(a.get("next_step"), 300),
        "last_contact_at": _line(a.get("last_contact_at"), 40) or now,
        "history": [{"at": now, "who": who, "text": _line(a.get("note"), 400) or "Added."}],
        "created_at": now,
        "updated_at": now,
    }
    if not await ledger.table.put({"pk": "DEALS", "sk": rec["id"], **rec}, if_not_exists=True):
        rec["id"] += "b"
        await ledger.table.put({"pk": "DEALS", "sk": rec["id"], **rec})
    return _clean(rec)


async def update_deal(ledger: Ledger, id: str, a: dict[str, Any], who: str) -> Record | None:
    d = await get_deal(ledger, id)
    if not d:
        return None
    now = now_iso(ledger.now())
    patch: Record = {"updated_at": now}
    said: list[str] = []
    if a.get("stage"):
        patch["stage"] = _stage(a["stage"])
        patch["team"] = team_of(patch["stage"])
        said.append(f"Now {WORDS[patch['stage']].lower()}.")
    if "value" in a and a["value"] is not None:
        patch["value"] = _value(a["value"])
    if a.get("next_step"):
        patch["next_step"] = _line(a["next_step"], 300)
    if a.get("contacted"):
        patch["last_contact_at"] = now
        said.append("Followed up.")
    if a.get("note"):
        said.append(_line(a["note"], 400))
    if said:
        patch["history"] = [*(d.get("history") or []), {"at": now, "who": who, "text": " ".join(said)}][-MAX_HISTORY:]
    got = await ledger.table.update("DEALS", d["id"], UpdateOptions(set=patch, must_exist=True))
    return _clean(got) if got else None


async def qualify(ledger: Ledger, id: str, who: str) -> Record | None:
    """Marketing hands a lead to Sales (MQL → SQL, decision 137): the deal becomes Sales' and "qualified"."""
    d = await get_deal(ledger, id)
    if not d or d.get("stage") not in MARKETING_STAGES:
        return d
    return await update_deal(ledger, id, {"stage": "qualified", "note": "Qualified by Marketing; Sales takes it."}, who)


def followup_instructions(order_id: str, today: datetime, days: int = STALE_DAYS) -> str:
    """Added to a Sales standing order's goal: what a follow-up round does (decision 133)."""
    day = today.strftime("%Y-%m-%d")
    return (
        f"\nSales pipeline follow-ups: find the open deals with no contact for {days} days or more. If a CRM is "
        "connected (HubSpot, Pipedrive, Salesforce, Attio, Close: you have its tools), use its deals and their last "
        f"activity; otherwise AI City's own board with list_deals (stale_days {days}, team Sales). Deals that Marketing just "
        "qualified come to you as handoffs: contact those first. For each stale deal: write a "
        "short, personal follow-up that moves it to its next step (book a call, answer what they asked, send the "
        "proposal), send it through the connected mail or the CRM, log it on the deal (in the CRM, or update_deal "
        "with contacted true, the note and the next step), then call record_handled with order_id "
        f"{order_id} and item '<deal id>#{day}'. One follow-up per deal per round; never chase a deal that is won "
        "or lost, and never the same person twice in a day. Report how many deals you followed up, in one line."
    )


def nurture_instructions(order_id: str, today: datetime) -> str:
    """Added to a Marketing standing order's goal: nurturing leads in the shared CRM and handing qualified ones to
    Sales (decision 137)."""
    day = today.strftime("%Y-%m-%d")
    return (
        "\nShared CRM, Marketing's part: Marketing owns leads and campaigns, Sales owns opportunities. In "
        "Salesforce: Leads and Campaigns (add each lead to the campaign it came from); in HubSpot: contacts in the "
        "lead and marketing-qualified lifecycle stages; otherwise AI City's own board (list_deals with team "
        "Marketing; add_deal for new leads, update_deal with stage nurturing and a note). For each lead with no "
        "touch in 7 days: one useful message (an answer, a case study, an offer that fits), logged on the lead. A "
        "lead qualifies when it asked for a price, a demo or a call, or fits the ideal customer and engaged twice: "
        "then hand it to Sales with file_handoff (to_department Sales, ref = the lead or deal id, details = why it "
        "qualified and what they asked). In Salesforce, convert the lead into an opportunity for Sales; in "
        "HubSpot, move it to sales-qualified. Record each lead you touched with record_handled (order_id "
        f"{order_id}, item '<lead id>#{day}')."
    )
