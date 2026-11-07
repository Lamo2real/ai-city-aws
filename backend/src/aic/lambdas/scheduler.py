"""EventBridge Scheduler jobs. All are created DISABLED by Terraform; the owner enables them.

- sweep: re-send work whose lease ran out (a crashed turn), and expire nothing silently.
- retire_idle: managers with no open work go dormant (they cost nothing either way; this keeps the City tidy).
- reminders: due reminders become notifications.
- improve: the weekly self-improvement loop. Built, and refused here unless explicitly enabled.
- warm_ace: keeps AIC's runtime container running (a "warm" ping every few minutes on the owner's conversation
  session), so a message never pays the container's cold start. Created ENABLED: an idle container costs nothing.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal

from aic.shared.aws import aws_city
from aic.shared.events import EventBus, now_iso
from aic.shared.hierarchy.dispatch import resume_stale
from aic.shared.hierarchy.queue import Queue
from aic.shared.ledger import Ledger
from aic.shared.log import log
from aic.shared.table import UpdateOptions

from ._runtime import run
from .dispatcher import AgentCoreInvoker, AgentInvoker, session_id_for
from .improve import improvement_allowed

Job = Literal["sweep", "retire_idle", "reminders", "improve", "warm_ace"]

# The conversations the HUD talks to AIC on (see api.py: POST /messages uses "main").
WARM_CONVERSATIONS = ("main",)


async def warm_ace(invoker: AgentInvoker | None, env: Mapping[str, str]) -> dict[str, int | str]:
    """One "warm" invocation per owner conversation, on exactly the session id the dispatcher would use, so the
    container that answers the owner's next message is already running. A miss is logged, never raised."""
    if invoker is None:
        return {"skipped": "no runtime to warm"}
    owner, version = env.get("AIC_OWNER_ID", "owner"), env.get("AIC_RUNTIME_VERSION", "")
    warmed = failed = 0
    for c in WARM_CONVERSATIONS:
        sid = session_id_for({"role": "ace", "agentId": "ace", "conversation": c}, owner, version)  # type: ignore[typeddict-item]
        try:
            await invoker.invoke(
                {
                    "id": f"warm-{c}",
                    "kind": "warm",
                    "role": "ace",
                    "agentId": "ace",
                    "ticketId": f"conv-{c}",
                    "taskId": f"conv-{c}",
                    "conversation": c,
                    "sessionId": sid,
                    "async": False,
                }
            )
            warmed += 1
        except Exception as e:
            failed += 1
            log("warn", "warm.failed", conversation=c, error=type(e).__name__)
    return {"warmed": warmed, "failed": failed}


async def run_job(
    job: str,
    ledger: Ledger,
    queue: Queue,
    bus: EventBus,
    env: Mapping[str, str] | None = None,
    invoker: AgentInvoker | None = None,
) -> dict[str, int | str]:
    if job == "warm_ace":
        return await warm_ace(invoker, os.environ if env is None else env)
    if job == "sweep":
        return {"resent": await resume_stale(ledger, queue)}
    if job == "retire_idle":
        n = 0
        open_ = await ledger.list_tickets(["open", "in_progress", "in_review", "waiting_on_owner"])
        for a in await ledger.list_agents("active"):
            if a.get("kind") != "manager":
                continue
            if any(t["to"] == a["id"] or t["from"] == a["id"] for t in open_):
                continue
            await ledger.update_agent(a["id"], {"state": "dormant"})
            n += 1
        return {"dormant": n}
    if job == "reminders":
        now = now_iso(ledger.now())
        due = [r for r in await ledger.list_notes("reminder") if r.get("due_at") and r["due_at"] <= now]
        for r in due:
            await ledger.table.update(f"REMINDER#{r['id']}", "META", UpdateOptions(set={"gsi1pk": "REMINDER#sent"}))
        return {"due": len(due)}
    if job == "improve":
        ok, why = improvement_allowed(os.environ if env is None else env)
        if not ok:
            return {"skipped": why}
        return {"skipped": "the self-improvement loop has no runner in this build"}
    return {"skipped": f"unknown job {job}"}


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, int | str]:
    city = aws_city()
    invoker: AgentInvoker | None = None
    if event.get("job") == "warm_ace" and os.environ.get("AIC_RUNTIME_ARN_ACE"):
        invoker = AgentCoreInvoker(city.session.client("bedrock-agentcore"), {"ace": os.environ["AIC_RUNTIME_ARN_ACE"]})
    out = run(run_job(event["job"], city.ledger, city.queue, city.bus, invoker=invoker))
    log("info", f"job.{event['job']}", **out)
    return out
