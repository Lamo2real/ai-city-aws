"""The company brief: the owner says once what the business is, and the city runs it (decision 136).

"We are an e-commerce business like Zalando; run it." The brief is stored once (``COMPANY`` / ``brief``) and:

- every Orchestrator, manager and worker turn reads it at the end of its system prompt, with the department's own job
  in that business and who it hands work to (``file_handoff``, decision 135);
- "run it" turns on the operating mode: three standing orders with fixed ids (decision 125), so Autopilot keeps the
  business going with no owner input: Customer Support watches the support channels (the support desk, decision
  131), Marketing nurtures leads in the shared CRM and hands qualified ones to Sales (decision 137), and Sales
  follows up on its pipeline (decision 133). Turning the mode off turns those orders off; nothing else changes.
"""

from __future__ import annotations

from typing import Any

from . import standing_orders as standing
from .events import now_iso
from .ledger import Ledger, Record
from .presets import preset_for

MAX_TEXT = 2000

HANDS_TO: dict[str, list[tuple[str, str]]] = {
    "Customer Support": [
        ("Application", "errors on the website, app or checkout, bugs"),
        ("IT Infrastructure", "outages, slow or unreachable systems, accounts and access"),
        ("Finance", "refunds, payments, invoices, chargebacks"),
        ("Operations", "orders, deliveries, returns, stock"),
        ("Sales", "questions from someone who wants to buy or buy more"),
        ("Product", "feature requests and repeated complaints"),
    ],
    "Marketing": [("Sales", "leads that qualify (an MQL becomes an SQL)"), ("Media", "videos and social content")],
    "Sales": [
        ("Finance", "quotes, invoices and payment terms"),
        ("Legal", "contracts and terms"),
        ("Marketing", "leads that aren't ready yet, to nurture"),
        ("Customer Support", "a customer's problem after the sale"),
    ],
    "Operations": [("Finance", "supplier payments"), ("Customer Support", "telling customers about delays")],
    "Product": [("Application", "building what was decided"), ("Marketing", "launch messages")],
    "Application": [("IT Infrastructure", "servers, hosting and deploys"), ("Product", "what to build next")],
    "IT Infrastructure": [("Application", "a fix in the code")],
    "Finance": [("Legal", "tax and contract questions"), ("Sales", "unpaid invoices to chase with the customer")],
    "Media": [("Marketing", "content ready for campaigns")],
}

OPERATING: list[dict[str, Any]] = [
    {
        "id": "so-company-support",
        "department": "Customer Support",
        "source": "Slack and the support inbox",
        "instructions": "Every new customer message: answer what you can, file the rest as a ticket for the "
        "department responsible, and tell the customer when it's fixed.",
        "every_minutes": 15,
    },
    {
        "id": "so-company-marketing",
        "department": "Marketing",
        "source": "the shared CRM's leads and campaigns",
        "instructions": "Nurture new and warm leads (one useful message each, logged on the lead); when a lead "
        "qualifies (it asked for a price, a demo or a call, or matches the ideal customer and engaged twice), mark "
        "it qualified and hand it to Sales with file_handoff (to_department Sales, ref = the lead's id).",
        "every_minutes": 1440,
    },
    {
        "id": "so-company-sales",
        "department": "Sales",
        "source": "the sales pipeline in the shared CRM",
        "instructions": "Follow up on stale deals and on new qualified leads from Marketing.",
        "every_minutes": 1440,
    },
]


class Invalid(ValueError):
    pass


async def get_brief(ledger: Ledger) -> Record | None:
    r = await ledger.table.get("COMPANY", "brief")
    if not r or not r.get("text"):
        return None
    return {k: r.get(k) for k in ("text", "running", "support_source", "set_at", "running_since")}


async def running(ledger: Ledger) -> bool:
    b = await get_brief(ledger)
    return bool(b and b.get("running"))


async def operating_orders(ledger: Ledger) -> list[Record]:
    ids = {o["id"] for o in OPERATING}
    return [o for o in await standing.list_orders(ledger) if o["id"] in ids]


async def set_brief(ledger: Ledger, b: dict[str, Any]) -> Record:
    """Stores the brief and turns the operating mode on or off (``running``, default on)."""
    old = await ledger.table.get("COMPANY", "brief") or {}
    text = " ".join(str(b.get("text") if "text" in b else old.get("text") or "").split())[:MAX_TEXT]
    if not text:
        raise Invalid("Say what the business is and what it sells, in a sentence or two.")
    # Off unless the owner switched it on (decision 138): describing the business doesn't start anything.
    running = b.get("running", old.get("running", False))
    if not isinstance(running, bool):
        raise Invalid("running must be true or false.")
    support_source = " ".join(str(b.get("support_source") or old.get("support_source") or "").split())[:120]
    now = now_iso(ledger.now())
    since = old.get("running_since") if (running and old.get("running")) else (now if running else None)
    rec = {"text": text, "running": running, "support_source": support_source, "set_at": now,
           "running_since": since}  # fmt: skip
    await ledger.table.put({"pk": "COMPANY", "sk": "brief", **rec})
    for o in OPERATING:
        cur = await standing.get_order(ledger, o["id"])
        source = support_source if (support_source and o["department"] == "Customer Support") else o["source"]
        if cur:
            await standing.update_order(ledger, o["id"], {"enabled": running, "source": source})
        elif running:
            await standing.add_order(ledger, {**o, "source": source}, id=o["id"])
    return rec


async def clear_brief(ledger: Ledger) -> bool:
    if not await ledger.table.get("COMPANY", "brief"):
        return False
    await ledger.table.delete("COMPANY", "brief")
    for o in OPERATING:
        if await standing.get_order(ledger, o["id"]):
            await standing.update_order(ledger, o["id"], {"enabled": False})
    return True


def context(brief: Record | None, role: str, department: str | None) -> str:
    """The lines every non-VAIC agent reads at the end of its system prompt."""
    if not brief:
        return ""
    lines = [
        "",
        "## The business you work for (the owner's company brief, decision 136)",
        str(brief["text"]),
        "The owner is away: run it well without asking them. Work stays inside the departments; when another "
        "department must do part of it, its manager files a handoff (file_handoff) and the result comes back.",
    ]
    if role in ("manager", "worker") and department:
        p = preset_for(department)
        department = str(p["name"]) if p else department
        hands = HANDS_TO.get(department)
        if hands:
            lines.append(f"{department} hands work to: " + "; ".join(f"{d} ({why})" for d, why in hands) + ".")
    if role == "orchestrator":
        lines.append(
            "Handoffs: " + " | ".join(f"{k} → " + ", ".join(d for d, _ in v) for k, v in HANDS_TO.items()) + "."
        )
    return "\n".join(lines)
