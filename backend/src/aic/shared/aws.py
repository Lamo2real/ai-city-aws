"""AWS implementations of the queue and the factory client, plus the production wiring from env."""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any

from .bus import EventBridgeBus
from .caps import default_settings
from .hierarchy.queue import WorkMessage
from .ledger import Ledger, Record
from .table import DynamoTable


class SqsQueue:
    """One SQS queue per role level; the URL for each comes from the environment."""

    def __init__(self, sqs: Any, urls: Mapping[str, str]) -> None:
        self._sqs = sqs
        self._urls = urls

    async def send(self, message: WorkMessage, delay_seconds: float = 0) -> None:
        url = self._urls.get(message["role"])
        if not url:
            raise RuntimeError(f"no queue for {message['role']}")
        await asyncio.to_thread(
            self._sqs.send_message,
            QueueUrl=url,
            MessageBody=json.dumps(message),
            DelaySeconds=min(900, max(0, round(delay_seconds))),
            MessageAttributes={
                "department": {"DataType": "String", "StringValue": message.get("department") or "-"},
                "ticket": {"DataType": "String", "StringValue": message["ticketId"]},
            },
        )


class LambdaFactoryClient:
    """The runtime calls the Agent Factory Lambda; the Lambda holds the logic and the ledger rights."""

    def __init__(self, lambda_client: Any, function_name: str) -> None:
        self._lambda = lambda_client
        self._fn = function_name

    async def _call(self, body: dict[str, Any]) -> Record:
        r = await asyncio.to_thread(self._lambda.invoke, FunctionName=self._fn, Payload=json.dumps(body).encode())
        out = json.loads(r["Payload"].read())
        if r.get("FunctionError") or not out.get("ok"):
            raise RuntimeError(out.get("error") or "the Agent Factory failed")
        agent: Record = out["agent"]
        return agent

    async def hire(self, spec: dict[str, Any], manager_id: str, department: str) -> Record:
        return await self._call({"action": "hire", "spec": spec, "managerId": manager_id, "department": department})

    async def release(self, worker_id: str, manager_id: str) -> Record:
        return await self._call({"action": "release", "workerId": worker_id, "managerId": manager_id})


def require_env(name: str, env: Mapping[str, str] | None = None) -> str:
    v = (os.environ if env is None else env).get(name)
    if not v:
        raise RuntimeError(f"missing environment variable {name}")
    return v


@dataclass
class AwsCity:
    region: str
    ledger: Ledger
    bus: EventBridgeBus
    queue: SqsQueue
    settings: Callable[[], Awaitable[dict[str, Any]]]
    session: Any
    """The boto3 session, for other clients."""


def aws_city(env: Mapping[str, str] | None = None) -> AwsCity:
    """Production wiring shared by Lambdas and the runtime."""
    import boto3

    e = os.environ if env is None else env
    region = e.get("AWS_REGION") or e.get("AWS_DEFAULT_REGION") or require_env("AIC_REGION", e)
    session = boto3.session.Session(region_name=region)
    table = session.resource("dynamodb").Table(require_env("AIC_LEDGER_TABLE", e))
    ledger = Ledger(DynamoTable(table))
    bus = EventBridgeBus(session.client("events"), require_env("AIC_EVENT_BUS", e))
    queue = SqsQueue(
        session.client("sqs"),
        {
            "ace": e.get("AIC_QUEUE_ACE", ""),
            "orchestrator": e.get("AIC_QUEUE_ORCHESTRATOR", ""),
            "manager": e.get("AIC_QUEUE_MANAGER", ""),
            "worker": e.get("AIC_QUEUE_WORKER", ""),
        },
    )

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    return AwsCity(region=region, ledger=ledger, bus=bus, queue=queue, settings=settings, session=session)
