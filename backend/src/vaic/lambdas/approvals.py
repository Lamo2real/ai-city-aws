"""Step Functions approval workflow (Standard).

approval.requested → state machine → this Lambda with waitForTaskToken stores the token on the approval →
the owner decides in the HUD → the API sends the task result → the "resume" step wakes the agent to try the
exact action again (or not).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, cast

from vaic.shared.aws import aws_city
from vaic.shared.clients import client
from vaic.shared.events import EventBus
from vaic.shared.hierarchy.actions import role_of
from vaic.shared.hierarchy.queue import Queue, WorkMessage
from vaic.shared.ids import new_id
from vaic.shared.ledger import Ledger
from vaic.shared.log import log
from vaic.shared.table import UpdateOptions

from ._runtime import run

DECIDED = ("approved", "denied", "used")


async def on_approval_step(
    event: dict[str, Any], ledger: Ledger, queue: Queue, sfn: Any = None, bus: EventBus | None = None
) -> dict[str, bool]:
    a = await ledger.get_approval(event["approvalId"])
    if not a:
        return {"ok": False}
    if event["step"] == "store_token":
        await ledger.table.update(f"APPROVAL#{a['id']}", "META", UpdateOptions(set={"task_token": event["taskToken"]}))
        # Decided before the token was stored (the Chief of Staff answers within seconds): the decider found no
        # token, so send the result here. Token first, then status: one of the two always sees the other.
        now = await ledger.get_approval(a["id"])
        if now and now.get("status") in DECIDED and sfn is not None:
            try:
                if now["status"] == "denied":
                    await asyncio.to_thread(
                        sfn.send_task_failure, taskToken=event["taskToken"], error="Refused", cause="Refused."
                    )
                else:
                    await asyncio.to_thread(
                        sfn.send_task_success,
                        taskToken=event["taskToken"],
                        output=json.dumps({"approved": True, "id": a["id"]}),
                    )
            except Exception as e:  # the decider got there too; the workflow already moved on
                log("info", "approval.token_late", id=a["id"], error=type(e).__name__)
        return {"ok": True}
    # The workflow also ends up here, as "not approved", when nobody answered within its day or its job stopped.
    # That is not a refusal: the card closes (so a late tap cannot approve something nobody is waiting for) and
    # the agent is told what really happened.
    expired = False
    if not event.get("approved") and a.get("status") in ("pending", "withdrawn"):
        if a.get("kind") == "app.publish" and a["status"] == "pending":
            return {"ok": True}  # the API publishes on a late yes with no agent waiting: the card simply stays
        if a["status"] == "withdrawn" or not await ledger.withdraw_approval(a["id"]):
            return {"ok": True}  # its job stopped, or the owner decided this very moment: nothing to tell
        expired = True
        try:
            if bus is not None:
                await bus.put({"type": "approval.withdrawn", "id": a["id"]})
        except Exception as e:  # the card then closes on the next load; the agent is still told
            log("error", "approval.event_failed", id=a["id"], error=f"{type(e).__name__}: {e}")
    agent = await ledger.get_agent(a["agent"])
    if not agent or agent.get("state") == "retired" or not a.get("ticket_id"):
        return {"ok": True}
    if expired:
        body = (
            f"The owner did not answer this request in time, so it has closed: {a.get('action') or a.get('title', '')}. "
            "It was not refused. Do not run it; continue without it or report, and ask again only if it is still needed."
        )
    elif a.get("kind") == "app.publish":
        if event.get("approved"):
            return {"ok": True}  # published by the API; app.published tells the city, nothing to resume
        body = (
            f"The owner chose not to publish the app “{a.get('title', '')}”. It stays unpublished; "
            "do not submit or publish it another way."
        )
    else:
        body = (
            f"The owner approved exactly this action once: {a['action']}. You may run it now, unchanged."
            if event.get("approved")
            else f"The owner refused this action: {a['action']}. Do not try it another way; continue without it or report."
        )
    await queue.send(
        cast(
            WorkMessage,
            {
                "id": new_id("m"),
                "role": role_of(agent),
                "agentId": agent["id"],
                "department": agent.get("department"),
                "ticketId": a["ticket_id"],
                "taskId": a["ticket_id"],
                "kind": "answer",
                "from": "owner",
                "body": body,
            },
        )
    )
    return {"ok": True}


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, bool]:
    city = aws_city()
    sfn = client(city.session, "stepfunctions") if event.get("step") == "store_token" else None
    return run(on_approval_step(event, city.ledger, city.queue, sfn, city.bus))
