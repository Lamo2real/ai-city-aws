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

from vaic.shared.aws import aws_city
from vaic.shared.clients import client
from vaic.shared.config import caps_config
from vaic.shared.hierarchy.dispatch import AgentInvoker, Dispatcher, DispatcherDeps
from vaic.shared.hierarchy.queue import WorkMessage
from vaic.shared.ids import session_ids
from vaic.shared.log import log

from ._runtime import run


def session_id_for(m: WorkMessage, owner: str = "owner", version: str = "") -> str:
    """VAIC's session also carries the runtime version (the image tag), so after a deploy the next message
    starts a fresh session on the new code instead of reusing a container that still runs the old one.
    VAIC's conversation lives in the ledger, so nothing is lost. Other roles keep their sessions: a
    worker's checkout lives in its session."""
    role = m["role"]
    if role == "vaic":
        conversation = m.get("conversation") or "default"
        return session_ids.vaic(owner, f"{conversation}-{version}" if version else conversation)
    if role == "orchestrator":
        return session_ids.orchestrator(m["taskId"])
    if role == "manager":
        return session_ids.manager(m.get("department") or "none", m["taskId"])
    return session_ids.worker(m.get("department") or "none", m["agentId"])


class AgentCoreInvoker:
    """``client`` is a boto3 ``bedrock-agentcore`` client."""

    def __init__(self, client: Any, arns: Mapping[str, str], live: Mapping[str, str] | None = None) -> None:
        self._client = client
        self._arns = arns
        # Where VAIC streams its reply straight to the HUD (the WebSocket endpoint and connections table).
        # Passed per invocation because the runtime is created before the WebSocket API.
        self._live = dict(live or {})

    async def invoke(self, inv: dict[str, Any]) -> None:
        arn = self._arns.get(inv["role"])
        if not arn:
            raise RuntimeError(f"no runtime for {inv['role']}")
        if inv["role"] == "vaic" and self._live.get("wsEndpoint") and self._live.get("connectionsTable"):
            inv = {**inv, **self._live}
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
    """The batch's messages start side by side, not one after another: a task never waits for another task's
    hand-off (decision 178)."""

    async def one(r: dict[str, Any]) -> str | None:
        """The message id when it has to be retried, else None."""
        try:
            m: WorkMessage = json.loads(r["body"])
        except ValueError:
            log("error", "dispatch.bad_message", messageId=r.get("messageId"))
            return None  # unparseable: nothing to retry; it is visible in the logs
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
            return None
        except Exception as e:
            log(
                "error",
                "dispatch.failed",
                messageId=r["messageId"],
                role=m.get("role"),
                ticket=m.get("ticketId"),
                error=type(e).__name__,
            )
            return str(r["messageId"])

    failed = await asyncio.gather(*(one(r) for r in event.get("Records", [])))
    return {"batchItemFailures": [{"itemIdentifier": f} for f in failed if f]}


_cached: Dispatcher | None = None


def _dispatcher() -> Dispatcher:
    global _cached
    if _cached:
        return _cached
    city = aws_city()
    env = os.environ
    invoker: AgentInvoker = AgentCoreInvoker(
        client(city.session, "bedrock-agentcore"),
        {
            "vaic": env.get("VAIC_RUNTIME_ARN_VAIC", ""),
            "orchestrator": env.get("VAIC_RUNTIME_ARN_ORCHESTRATOR", ""),
            "manager": env.get("VAIC_RUNTIME_ARN_MANAGER", ""),
            "worker": env.get("VAIC_RUNTIME_ARN_WORKER", ""),
        },
        {"wsEndpoint": env.get("VAIC_WS_ENDPOINT", ""), "connectionsTable": env.get("VAIC_CONNECTIONS_TABLE", "")},
    )
    owner = env.get("VAIC_OWNER_ID", "owner")
    version = env.get("VAIC_RUNTIME_VERSION", "")
    _cached = Dispatcher(
        DispatcherDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            invoker=invoker,
            settings=city.settings,
            session_id_for=lambda m: session_id_for(m, owner, version),
            # A worker's turn may run for the whole long-job limit; its lease outlasts that by a minute.
            worker_lease_ms=(caps_config()["async_job_soft_limit_minutes"] + 1) * 60_000,
        )
    )
    return _cached


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    return run(process_batch(event, _dispatcher()))
