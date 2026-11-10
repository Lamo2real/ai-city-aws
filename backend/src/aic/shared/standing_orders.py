"""Standing orders: work the city does on its own while the owner is away (decision 125).

A standing order is "watch this source, do this with what is new": ``{id, source, instructions, department,
every_minutes (15), enabled}``. The scheduler starts each due order as an ordinary job for its department (one
live job per order at a time). The job checks the source through the city's connectors, handles what is new, and
calls ``record_handled`` for each item, so nothing is handled twice; the job is told the keys it already did.

Ledger: ``STANDING`` / ``<id>`` for the orders, ``HANDLED#<order id>`` / ``<item key>`` for what was handled
(kept 90 days).
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from .events import now_iso
from .hierarchy.actions import FINAL, CityDeps, new_ticket, send
from .ids import new_id
from .ledger import Ledger, Record
from .log import log
from .sales_pipeline import followup_instructions, nurture_instructions
from .support_desk import intake_instructions
from .table import UpdateOptions

DEFAULT_MINUTES = 15
MIN_MINUTES = 5
HANDLED_DAYS = 90
MAX_ORDERS = 20
SKIP_SHOWN = 100
"""How many already-handled keys the job is told about (the newest)."""

_FIELDS = ("id", "source", "instructions", "department", "every_minutes", "enabled", "created_at", "last_run_at",
           "last_job_id")  # fmt: skip


class Invalid(ValueError):
    pass


def _clean(r: Record) -> Record:
    return {k: r[k] for k in _FIELDS if k in r}


def _text(v: Any, name: str, n: int) -> str:
    t = " ".join(str(v or "").split())
    if not t:
        raise Invalid(f"Say {name}.")
    return t[:n]


def _minutes(v: Any) -> int:
    if v is None:
        return DEFAULT_MINUTES
    if isinstance(v, bool) or not isinstance(v, int | float) or v != int(v) or v < MIN_MINUTES or v > 7 * 1440:
        raise Invalid(f"How often must be a whole number of minutes, at least {MIN_MINUTES}.")
    return int(v)


async def list_orders(ledger: Ledger) -> list[Record]:
    return [_clean(r) for r in await ledger.table.query("STANDING")]


async def get_order(ledger: Ledger, id: str) -> Record | None:
    r = await ledger.table.get("STANDING", id)
    return _clean(r) if r else None


async def add_order(ledger: Ledger, b: dict[str, Any], id: str | None = None) -> Record:
    if len(await list_orders(ledger)) >= MAX_ORDERS:
        raise Invalid(f"There are already {MAX_ORDERS} standing orders. Stop one first.")
    rec: Record = {
        "id": id or new_id("so"),
        "source": _text(b.get("source"), "what to watch (a connector, channel or inbox)", 120),
        "instructions": _text(b.get("instructions"), "what to do with what is new", 2000),
        "department": " ".join(str(b.get("department") or "Customer Support").split())[:60],
        "every_minutes": _minutes(b.get("every_minutes")),
        "enabled": b.get("enabled") is not False,
        "created_at": now_iso(ledger.now()),
    }
    await ledger.table.put({"pk": "STANDING", "sk": rec["id"], **rec})
    return rec


async def update_order(ledger: Ledger, id: str, b: dict[str, Any]) -> Record | None:
    if not await get_order(ledger, id):
        return None
    patch: Record = {}
    if "source" in b:
        patch["source"] = _text(b["source"], "what to watch", 120)
    if "instructions" in b:
        patch["instructions"] = _text(b["instructions"], "what to do", 2000)
    if "department" in b:
        patch["department"] = _text(b["department"], "the department", 60)
    if "every_minutes" in b:
        patch["every_minutes"] = _minutes(b["every_minutes"])
    if "enabled" in b:
        if not isinstance(b["enabled"], bool):
            raise Invalid("enabled must be true or false.")
        patch["enabled"] = b["enabled"]
    if patch:
        await ledger.table.update("STANDING", id, UpdateOptions(set=patch, must_exist=True))
    return await get_order(ledger, id)


async def delete_order(ledger: Ledger, id: str) -> bool:
    return await ledger.table.delete_if_exists("STANDING", id)


# ---------- what was handled ----------
def item_key(item: str) -> str:
    return re.sub(r"\s+", " ", str(item)).strip()[:200]


async def record_handled(ledger: Ledger, order_id: str, item: str, summary: str, job_id: str | None) -> bool:
    """False when this item was already handled (the job should skip it)."""
    key = item_key(item)
    if not key:
        raise Invalid("Say which item (its key, message id or email id).")
    return await ledger.table.put(
        {
            "pk": f"HANDLED#{order_id}",
            "sk": key,
            "order_id": order_id,
            "item": key,
            "summary": " ".join(str(summary).split())[:300],
            "job_id": job_id,
            "at": now_iso(ledger.now()),
            "ttl": ledger.now_ms() // 1000 + HANDLED_DAYS * 86_400,
        },
        if_not_exists=True,
    )


async def handled(ledger: Ledger, order_id: str) -> list[Record]:
    rows = await ledger.table.query(f"HANDLED#{order_id}")
    return sorted(
        ({k: r.get(k) for k in ("order_id", "item", "summary", "at")} for r in rows),
        key=lambda r: str(r["at"]),
        reverse=True,
    )


async def handled_since(ledger: Ledger, since: str) -> list[Record]:
    out: list[Record] = []
    for o in await list_orders(ledger):
        out += [{**h, "source": o["source"]} for h in await handled(ledger, o["id"]) if str(h["at"]) >= since]
    return sorted(out, key=lambda r: str(r["at"]), reverse=True)


# ---------- running them ----------
def goal_text(order: Record, done: list[str], today: datetime | None = None) -> str:
    skip = ", ".join(done[:SKIP_SHOWN]) if done else "none yet"
    return (
        f"Standing order {order['id']} (the owner set this up to run while they are away): check "
        f"{order['source']} for anything new and handle it: {order['instructions']}\n"
        f"Use the city's connector tools for {order['source']}. Already handled, skip these: {skip}.\n"
        f"For every item you handle, call record_handled with order_id {order['id']}, the item's own key "
        "(ticket key, message id or email id) and one line of what you did; if it answers that the item was "
        "already handled, skip it. If nothing is new, finish at once and report 'Nothing new'. If the source "
        "can't be reached (not connected, signed out), report that in one line and finish: don't ask anyone."
        + (intake_instructions(order["id"]) if _is_support(order) else "")
        + (followup_instructions(order["id"], today or datetime.now(UTC)) if _is_sales(order) else "")
        + (nurture_instructions(order["id"], today or datetime.now(UTC)) if _dept_is(order, "marketing") else "")
    )


def _dept_is(order: Record, name: str) -> bool:
    return " ".join(str(order.get("department") or "").lower().split()) == name


def _is_sales(order: Record) -> bool:
    """Sales' orders follow up on stale deals (decision 133)."""
    return " ".join(str(order.get("department") or "").lower().split()) == "sales"


def _is_support(order: Record) -> bool:
    """Customer Support's orders run the support desk (decision 131): intake becomes a ticket."""
    return " ".join(str(order.get("department") or "").lower().split()) in ("customer support", "support")


def _due(order: Record, now_dt: Any) -> bool:
    if not order.get("enabled"):
        return False
    last = order.get("last_run_at")
    every = int(order.get("every_minutes") or DEFAULT_MINUTES)
    return not last or str(last) <= now_iso(now_dt - timedelta(minutes=every))


async def run_due(d: CityDeps) -> dict[str, int]:
    """Starts each due, enabled order whose last job has finished. Called by the scheduler every 5 minutes."""
    started = skipped = 0
    now_dt = d.ledger.now()
    now = now_iso(now_dt)
    for o in await list_orders(d.ledger):
        if not _due(o, now_dt):
            continue
        last = await d.ledger.get_ticket(str(o["last_job_id"])) if o.get("last_job_id") else None
        if last and last.get("status") not in FINAL:
            skipped += 1  # the previous run is still going: one at a time per order
            continue
        done = [str(h["item"]) for h in await handled(d.ledger, o["id"])]
        t = await new_ticket(
            d,
            {
                "goal": goal_text(o, done, now_dt),
                "from": "ace",
                "to": "orchestrator",
                "department": None,
                "parent_id": None,
                "kind": "task",
                "standing_order": o["id"],
                "owner_words": f"standing order: {o['source']}"[:500],
            },
        )
        try:
            # must_exist: an order the owner removed a moment ago is never written back as an empty row.
            await d.ledger.table.update(
                "STANDING", o["id"], UpdateOptions(set={"last_run_at": now, "last_job_id": t["id"]}, must_exist=True)
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
                    "body": f"New task from the owner's standing order {o['id']}.\nGoal: {t['goal']}\n"
                    f"Send it to the {o['department']} department.",
                },
            )
        except Exception as e:
            # The job never reached the Orchestrator: close it and put the order's last run back, so the order is
            # not left waiting for a job nobody is doing and the next beat starts it again. The other orders still run.
            log("error", "standing.start_failed", order=o["id"], job=t["id"], error=f"{type(e).__name__}: {e}")
            try:
                await d.ledger.set_ticket_status(t["id"], "cancelled", "The standing order could not start this run.")
                back = {"last_run_at": o.get("last_run_at"), "last_job_id": o.get("last_job_id")}
                await d.ledger.table.update("STANDING", o["id"], UpdateOptions(set=back, must_exist=True))
            except Exception as e2:
                log("error", "standing.undo_failed", order=o["id"], job=t["id"], error=f"{type(e2).__name__}: {e2}")
            continue
        log("info", "standing.started", order=o["id"], job=t["id"])
        started += 1
    return {"started": started, "still_running": skipped}
