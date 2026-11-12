"""One push notification to the owner's iPhone per finished job, and nothing else. No email.

The owner's words: "I don't want a thousand emails per agent… one per large feature… remove emails fully."
EventBridge sends this Lambda only ``ticket.status`` events for top-level jobs (``kind: task``) reaching
``done``, ``failed`` or ``cancelled``; a ledger claim makes each job notify at most once. Parts, reviews, hires
and partial results never notify. Without the owner's Apple key deployed, the push is skipped and logged.

It also places VAIC's calls (decision 245, ``vaic.shared.calls``): an ``approval.requested`` of kind ``ad.spend`` or a
``call.requested`` rings the owner's iPhone once, and sends one message only if the call isn't answered.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import ValidationError

from vaic.shared import calls
from vaic.shared.aws import aws_city
from vaic.shared.caps import default_settings
from vaic.shared.clients import client
from vaic.shared.cost import format_usd
from vaic.shared.events import parse_event
from vaic.shared.hierarchy.tasks import job_cost, short_name
from vaic.shared.ledger import Ledger
from vaic.shared.log import log
from vaic.shared.push import DeviceStore, PushApps

from ._runtime import run

FINAL = ("done", "failed", "cancelled")


def finished_job(detail: Any) -> dict[str, Any] | None:
    """The top-level job that just reached its final state, or None for anything else."""
    try:
        e = parse_event(detail)
    except (ValidationError, TypeError):
        return None
    if e["type"] != "ticket.status":
        return None
    ticket = e["ticket"]
    if ticket.get("kind", "task") != "task" or ticket["status"] not in FINAL:
        return None
    if e.get("previous") in FINAL:
        return None  # already final before: a no-op move, not a second finish
    if ticket.get("standing_order"):
        return None  # a standing order's round (every 15 minutes): what it handled is in the away summary
    return dict(ticket)


async def push_text(ledger: Ledger, job: dict[str, Any]) -> tuple[str, str]:
    """Plain words: the job's name, what happened, what it cost."""
    name = short_name(job)
    cost = format_usd(await job_cost(ledger, job))
    status = job["status"]
    if status == "done":
        return "Done", f"{name} is ready, bro. About {cost}."
    if status == "cancelled":
        return "Stopped", f"{name} got stopped. About {cost} so far."
    return "Didn't finish", f"{name} failed, my bad. About {cost} so far. Open AI City to see why."


async def notify(detail: Any, ledger: Ledger, store: DeviceStore, sns: Any, apps: PushApps) -> dict[str, Any]:
    job = finished_job(detail)
    if not job:
        return {"sent": 0, "reason": "not a finished job"}
    settings = await ledger.settings(default_settings())
    if settings.get("notify_push") is False:
        return {"sent": 0, "reason": "push off in settings"}
    if not await ledger.claim(f"push:{job['id']}", 30 * 86_400):
        return {"sent": 0, "reason": "already notified"}
    title, body = await push_text(ledger, job)
    if not apps.configured:
        log("info", "push.skipped", job=job["id"], reason="apns not configured")
        return {"sent": 0, "reason": "apns not configured"}
    counts = await store.push_all(sns, title, body, {"job": job["id"], "status": job["status"]})
    log("info", "push.sent", job=job["id"], **counts)
    return {**counts, "reason": "sent"}


async def call(detail: Any, ledger: Ledger, d: calls.CallDeps) -> dict[str, Any] | None:
    """VAIC's call about this event; None when the event doesn't call the owner."""
    try:
        e = parse_event(detail)
    except (ValidationError, TypeError):
        return None
    why = calls.reason_for(e)
    if why is None:
        return None
    reason, approval = why
    key = f"call:{approval or e['at']}"
    if not await ledger.claim(key, 7 * 86_400):
        return {"called": False, "reason": "already called"}
    if not d.apps.configured:
        log("info", "call.skipped", reason="apns not configured")
        return {"called": False, "reason": "apns not configured"}
    settings = await ledger.settings(default_settings())
    if settings.get("call_owner") is False:  # the owner said not to ring: the message only
        c = await calls.Calls(d.table, d.now).create(reason, approval)
        await calls.missed(d, c["id"])
        return {"called": False, "reason": "calls off", "messaged": True}
    c = await calls.place(d, reason, approval)
    return {"called": True, "state": c.get("state"), "call": c["id"]}


def push_apps() -> PushApps:
    env = os.environ.get
    return PushApps(
        env("VAIC_APNS_ARN", ""),
        env("VAIC_APNS_SANDBOX_ARN", ""),
        env("VAIC_APNS_VOIP_ARN", ""),
        env("VAIC_APNS_VOIP_SANDBOX_ARN", ""),
    )


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    city = aws_city()
    apps = push_apps()
    sns = client(city.session, "sns") if apps.configured else None
    store = DeviceStore(city.ledger.table, city.ledger.now)
    detail = event.get("detail")
    if isinstance(detail, dict) and detail.get("type") in ("approval.requested", "call.requested"):
        deps = calls.CallDeps(city.ledger.table, city.ledger.now, store, sns, apps)
        return run(call(detail, city.ledger, deps)) or {"called": False, "reason": "not a call"}
    return run(notify(detail, city.ledger, store, sns, apps))
