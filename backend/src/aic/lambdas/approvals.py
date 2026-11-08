"""Step Functions approval workflow (Standard).

approval.requested → state machine → this Lambda with waitForTaskToken stores the token on the approval →
the owner decides in the HUD → the API sends the task result → the "resume" step wakes the agent to try the
exact action again (or not).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, cast

from aic.shared.aws import aws_city
from aic.shared.clients import client
from aic.shared.hierarchy.actions import role_of
from aic.shared.hierarchy.queue import Queue, WorkMessage
from aic.shared.ids import new_id
from aic.shared.ledger import Ledger
from aic.shared.log import log
from aic.shared.table import UpdateOptions

from ._runtime import run

DECIDED = ("approved", "denied", "used")


async def on_approval_step(event: dict[str, Any], ledger: Ledger, queue: Queue, sfn: Any = None) -> dict[str, bool]:
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
    agent = await ledger.get_agent(a["agent"])
    if not agent or agent.get("state") == "retired" or not a.get("ticket_id"):
        return {"ok": True}
    if a.get("kind") == "app.publish":
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
    return run(on_approval_step(event, city.ledger, city.queue, sfn))
