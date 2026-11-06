"""SQS → Dispatcher → AgentCore. One function serves the four role queues.

Partial batch failure: a message whose turn could not start is retried by SQS; deferred messages are re-sent
with a delay.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Mapping
from typing import Any, Protocol

from aic.shared.aws import aws_city
from aic.shared.hierarchy.dispatch import AgentInvoker, Dispatcher, DispatcherDeps
from aic.shared.hierarchy.queue import WorkMessage
from aic.shared.ids import session_ids
from aic.shared.log import log

from ._runtime import run


def session_id_for(m: WorkMessage, owner: str = "owner") -> str:
    role = m["role"]
    if role == "ace":
        return session_ids.ace(owner, m.get("conversation") or "default")
    if role == "orchestrator":
        return session_ids.orchestrator(m["taskId"])
    if role == "manager":
        return session_ids.manager(m.get("department") or "none", m["taskId"])
    return session_ids.worker(m.get("department") or "none", m["agentId"])


class AgentCoreInvoker:
    """``client`` is a boto3 ``bedrock-agentcore`` client."""

    def __init__(self, client: Any, arns: Mapping[str, str]) -> None:
        self._client = client
        self._arns = arns

    async def invoke(self, inv: dict[str, Any]) -> None:
        arn = self._arns.get(inv["role"])
        if not arn:
            raise RuntimeError(f"no runtime for {inv['role']}")
        r = await asyncio.to_thread(
            self._client.invoke_agent_runtime,
            agentRuntimeArn=arn,
            runtimeSessionId=inv["sessionId"],
            contentType="application/json",
            accept="application/json",
            payload=json.dumps(inv).encode(),
        )
        status = r.get("statusCode") or r.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status and status >= 400:
            raise RuntimeError(f"runtime answered {status}")


class _Handles(Protocol):
    async def handle(self, m: WorkMessage) -> str: ...


async def process_batch(event: dict[str, Any], dispatcher: _Handles) -> dict[str, list[dict[str, str]]]:
    failures: list[dict[str, str]] = []
    for r in event.get("Records", []):
        try:
            m: WorkMessage = json.loads(r["body"])
        except ValueError:
            log("error", "dispatch.bad_message", messageId=r.get("messageId"))
            continue  # unparseable: nothing to retry; it is visible in the logs
        try:
            outcome = await dispatcher.handle(m)
            log(
                "info",
                "dispatch",
                messageId=r["messageId"],
                role=m.get("role"),
                ticket=m.get("ticketId"),
                outcome=outcome,
            )
        except Exception as e:
            log(
                "error",
                "dispatch.failed",
                messageId=r["messageId"],
                role=m.get("role"),
                ticket=m.get("ticketId"),
                error=type(e).__name__,
            )
            failures.append({"itemIdentifier": r["messageId"]})
    return {"batchItemFailures": failures}


_cached: Dispatcher | None = None


def _dispatcher() -> Dispatcher:
    global _cached
    if _cached:
        return _cached
    city = aws_city()
    env = os.environ
    invoker: AgentInvoker = AgentCoreInvoker(
        city.session.client("bedrock-agentcore"),
        {
            "ace": env.get("AIC_RUNTIME_ARN_ACE", ""),
            "orchestrator": env.get("AIC_RUNTIME_ARN_ORCHESTRATOR", ""),
            "manager": env.get("AIC_RUNTIME_ARN_MANAGER", ""),
            "worker": env.get("AIC_RUNTIME_ARN_WORKER", ""),
        },
    )
    owner = env.get("AIC_OWNER_ID", "owner")
    _cached = Dispatcher(
        DispatcherDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            invoker=invoker,
            settings=city.settings,
            session_id_for=lambda m: session_id_for(m, owner),
        )
    )
    return _cached


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    return run(process_batch(event, _dispatcher()))
