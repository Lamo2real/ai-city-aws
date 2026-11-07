"""One push notification to the owner's iPhone per finished job, and nothing else. No email.

The owner's words: "I don't want a thousand emails per agent… one per large feature… remove emails fully."
EventBridge sends this Lambda only ``ticket.status`` events for top-level jobs (``kind: task``) reaching
``done``, ``failed`` or ``cancelled``; a ledger claim makes each job notify at most once. Parts, reviews, hires
and partial results never notify. Without the owner's Apple key deployed, the push is skipped and logged.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import ValidationError

from aic.shared.aws import aws_city
from aic.shared.caps import default_settings
from aic.shared.clients import client
from aic.shared.cost import format_usd
from aic.shared.events import parse_event
from aic.shared.hierarchy.tasks import job_cost, short_name
from aic.shared.ledger import Ledger
from aic.shared.log import log
from aic.shared.push import DeviceStore, PushApps

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
    return dict(ticket)


async def push_text(ledger: Ledger, job: dict[str, Any]) -> tuple[str, str]:
    """Plain words: the job's name, what happened, what it cost."""
    name = short_name(job)
    cost = format_usd(await job_cost(ledger, job))
    status = job["status"]
    if status == "done":
        return "Done", f"{name} is ready. About {cost}."
    if status == "cancelled":
        return "Stopped", f"{name} was stopped. About {cost} so far."
    return "Could not finish", f"{name} failed. About {cost} so far. Open AI City to see why."


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


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    city = aws_city()
    apps = PushApps(os.environ.get("AIC_APNS_ARN", ""), os.environ.get("AIC_APNS_SANDBOX_ARN", ""))
    sns = client(city.session, "sns") if apps.configured else None
    store = DeviceStore(city.ledger.table, city.ledger.now)
    return run(notify(event.get("detail"), city.ledger, store, sns, apps))
