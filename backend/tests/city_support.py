"""An in-process city for tests.

Memory ledger, memory bus, memory queue, the real Factory, the real Dispatcher and the real AgentHost, with a
scripted fake engine instead of a model. No AWS, no Bedrock.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from vaic.runtime.engine import AgentEngine, EngineRequest
from vaic.runtime.host import AgentHost, HostOptions
from vaic.shared.caps import settings_with
from vaic.shared.cost import Usage
from vaic.shared.events import MemoryBus
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.hierarchy.dispatch import Dispatcher, DispatcherDeps
from vaic.shared.hierarchy.factory import Factory
from vaic.shared.hierarchy.queue import MemoryQueue, WorkMessage
from vaic.shared.ids import session_ids
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable
from vaic.shared.turn import BackoffOptions, TurnOutput

USAGE = Usage(input=400, output=200, cache_read=3000, cache_write_5m=100, cache_write_1h=0)

Call = Callable[[str, dict[str, Any]], Awaitable[str]]
Script = Callable[[EngineRequest, Call], Awaitable[str]]


def scripted_engine(scripts: dict[str, Script]) -> AgentEngine:
    """A fake engine: each role's script decides which tools to call, like a model would."""

    async def engine(req: EngineRequest) -> TurnOutput:
        script = scripts.get(req.ctx.role)
        if not script:
            return TurnOutput(text="", usage=USAGE)

        async def call(tool: str, args: dict[str, Any]) -> str:
            t = next((x for x in req.tools if x.name == tool), None)
            if not t:
                raise RuntimeError(f"{req.ctx.role} has no tool {tool}")
            return await t.handler(args)

        return TurnOutput(text=await script(req, call), usage=USAGE)

    return engine


def session_id_for(m: WorkMessage) -> str:
    role = m["role"]
    if role == "vaic":
        return session_ids.vaic("owner", m.get("conversation") or "default")
    if role == "orchestrator":
        return session_ids.orchestrator(m["taskId"])
    if role == "manager":
        return session_ids.manager(m.get("department") or "x", m["taskId"])
    return session_ids.worker(m.get("department") or "x", m["agentId"])


async def _no_sleep(_: float) -> None:
    return None


@dataclass
class City:
    ledger: Ledger
    bus: MemoryBus
    queue: MemoryQueue
    host: AgentHost
    dispatcher: Dispatcher
    factory: Factory
    deps: CityDeps
    table: MemoryTable
    clock: dict[str, float]
    invocations: list[dict[str, Any]] = field(default_factory=list)

    def advance(self, ms: float) -> None:
        self.clock["t"] += ms

    async def run(self, max_steps: int = 500) -> None:
        """Delivers queued messages like SQS + the dispatcher Lambda would, until the city is quiet."""
        for _ in range(max_steps):
            ready = self.queue.take_ready()
            if not ready:
                nxt = self.queue.next_available_at()
                if nxt is None:
                    return
                self.clock["t"] = max(self.clock["t"] + 1, nxt)
                continue
            for m in ready:
                try:
                    await self.dispatcher.handle(m)
                except Exception:
                    # SQS would deliver it again after the visibility timeout.
                    await self.queue.send(m, 60)
            self.clock["t"] += 1000
        raise RuntimeError("the city did not settle")

    async def owner_says(self, text: str, conversation: str = "c1") -> None:
        await self.host.ensure_core()
        await self.queue.send(
            cast(
                WorkMessage,
                {
                    "id": f"owner-{len(text)}-{conversation}",
                    "role": "vaic",
                    "agentId": "vaic",
                    "department": None,
                    "ticketId": f"conv-{conversation}",
                    "taskId": f"conv-{conversation}",
                    "kind": "task",
                    "from": "owner",
                    "body": text,
                    "conversation": conversation,
                },
            )
        )


def make_city(engine: AgentEngine, **settings: Any) -> City:
    clock = {"t": datetime(2026, 11, 6, 9, 0, tzinfo=UTC).timestamp() * 1000}

    def now() -> datetime:
        return datetime.fromtimestamp(clock["t"] / 1000, UTC)

    table = MemoryTable()
    ledger = Ledger(table, now)
    bus = MemoryBus(now)
    queue = MemoryQueue(lambda: clock["t"])
    s = settings_with(**settings)

    async def get_settings() -> dict[str, Any]:
        return await ledger.settings(s)

    factory = Factory(ledger, bus, get_settings)
    deps = CityDeps(ledger=ledger, bus=bus, queue=queue, factory=factory, settings=get_settings, max_review_rounds=3)
    host = AgentHost(deps, HostOptions(engine=engine, backoff=BackoffOptions(sleep=_no_sleep, random=lambda: 0)))
    invocations: list[dict[str, Any]] = []

    class Invoker:
        async def invoke(self, inv: dict[str, Any]) -> None:
            invocations.append(inv)
            await host.run_turn(inv)

    dispatcher = Dispatcher(
        DispatcherDeps(
            ledger=ledger, bus=bus, queue=queue, invoker=Invoker(), settings=get_settings, session_id_for=session_id_for
        )
    )
    return City(
        ledger=ledger,
        bus=bus,
        queue=queue,
        host=host,
        dispatcher=dispatcher,
        factory=factory,
        deps=deps,
        table=table,
        clock=clock,
        invocations=invocations,
    )
