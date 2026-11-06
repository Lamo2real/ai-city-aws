"""The dispatcher's decisions, without AWS.

Before any turn starts it checks the pause flag, the spend caps, the concurrency ceilings and the new-session
rate. Work above a ceiling waits in the queue and starts when a slot frees. Nothing is dropped.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol, cast

from ..caps import check_caps
from ..events import EventBus
from ..ledger import Ledger, day_key
from .queue import Queue, WorkMessage

DispatchOutcome = Literal[
    "started", "duplicate", "deferred:paused", "deferred:cap", "deferred:ceiling", "deferred:rate"
]
DEFER_SECONDS = {"paused": 60, "cap": 900, "ceiling": 15, "rate": 1}


class AgentInvoker(Protocol):
    async def invoke(self, inv: dict[str, Any]) -> None:
        """``inv`` is the WorkMessage plus ``sessionId`` and ``async`` (workers run as AgentCore async jobs)."""
        ...


@dataclass
class DispatcherDeps:
    ledger: Ledger
    bus: EventBus
    queue: Queue
    invoker: AgentInvoker
    settings: Callable[[], Awaitable[dict[str, Any]]]
    session_id_for: Callable[[WorkMessage], str]
    lease_ms: int = 16 * 60_000
    """Lease on a message while its turn runs: the turn timeout plus a minute."""


def _deferred(m: WorkMessage) -> WorkMessage:
    return cast(WorkMessage, {**m, "deferrals": m.get("deferrals", 0) + 1})


class Dispatcher:
    def __init__(self, d: DispatcherDeps) -> None:
        self.d = d

    async def _defer(self, m: WorkMessage, seconds: int) -> None:
        await self.d.queue.send(_deferred(m), seconds)

    async def handle(self, m: WorkMessage) -> DispatchOutcome:
        ledger = self.d.ledger
        if await ledger.is_work_done(m["id"]):
            return "duplicate"
        s = await self.d.settings()
        if await ledger.is_paused():
            await self._defer(m, DEFER_SECONDS["paused"])
            return "deferred:paused"
        cap = await check_caps(ledger, s, m["role"], m["department"])
        if not cap.ok:
            await self.d.bus.put(
                {
                    "type": "spend.cap_reached",
                    "cap": cap.cap,
                    "department": cap.department,
                    "spent": cap.spent,
                    "limit": cap.limit,
                }
            )
            # Ace asks the owner once per cap per day whether to raise it; the work waits meanwhile.
            if await ledger.claim(f"cap-question:{cap.cap}:{cap.department or 'all'}:{day_key(ledger.now())}"):
                q = await ledger.ask_question(
                    {
                        "asked_by": "ace",
                        "path": "Ace",
                        "ticket_id": None,
                        "text": f"{cap.message} Raise the cap so waiting work can continue?",
                        "options": ["Keep the cap (work waits)", "Raise the cap in Settings"],
                        "default_answer": "Keep the cap (work waits)",
                    }
                )
                await self.d.bus.put({"type": "question.asked", "question": q})
            await self._defer(m, DEFER_SECONDS["cap"])
            return "deferred:cap"
        is_worker = m["role"] == "worker"
        dept = m["department"]
        if (
            is_worker
            and dept
            and not await ledger.acquire_worker_slot(
                dept, s["max_concurrent_workers_per_department"], s["max_concurrent_workers_global"]
            )
        ):
            await self._defer(m, DEFER_SECONDS["ceiling"])
            return "deferred:ceiling"

        async def release() -> None:
            if is_worker and dept:
                await ledger.release_worker_slot(dept)

        if not await ledger.take_session_token(s["max_new_sessions_per_second"]):
            await release()
            await self._defer(m, DEFER_SECONDS["rate"])
            return "deferred:rate"
        if not await ledger.begin_work(m["id"], self.d.lease_ms, dict(m)):
            await release()
            return "duplicate"
        try:
            await self.d.invoker.invoke({**m, "sessionId": self.d.session_id_for(m), "async": is_worker})
        except Exception:
            # The runtime never started the turn: give the slot back and let SQS deliver it again.
            await release()
            await ledger.abandon_work(m["id"])
            raise
        return "started"


async def resume_stale(ledger: Ledger, queue: Queue) -> int:
    """The crash sweep (run on a schedule): a message whose lease ran out without finishing is sent again.

    Its agent's next turn reads the ledger and carries on from there.
    """
    n = 0
    for w in await ledger.stale_work():
        if not w.get("message"):
            continue
        m = cast(WorkMessage, w["message"])
        await ledger.abandon_work(w["key"])
        # A dead worker turn never gave its slot back.
        if m["role"] == "worker" and m.get("department"):
            await ledger.release_worker_slot(cast(str, m["department"]))
        await queue.send(_deferred(m))
        n += 1
    return n
