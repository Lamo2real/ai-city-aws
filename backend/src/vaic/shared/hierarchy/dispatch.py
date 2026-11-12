"""The dispatcher's decisions, without AWS.

Before any turn starts it checks the spend caps and the new-session rate. There is no ceiling on how many agents
work (the owner, decision 288); when AWS throttles a start (AgentCore's session quota or rate, a busy runtime), the
message waits in the queue with a growing, jittered delay and starts later. Nothing is dropped.
"""

from __future__ import annotations

import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol, cast

from ..caps import check_caps
from ..events import EventBus
from ..ledger import Ledger, day_key
from .queue import Queue, WorkMessage

DispatchOutcome = Literal[
    "started", "duplicate", "cancelled", "deferred:cap", "deferred:ceiling", "deferred:rate", "deferred:throttled"
]
DEFER_SECONDS = {"cap": 900, "ceiling": 15, "rate": 1}
THROTTLE_MAX_SECONDS = 120
_THROTTLED = (
    "ThrottlingException",
    "ServiceQuotaExceededException",
    "TooManyRequestsException",
    "LimitExceededException",
    "ConcurrentInvocationLimitExceeded",
)


def throttled(e: BaseException) -> bool:
    """AWS said "not now" (a quota or a rate), not "no": the turn should simply start a little later."""
    code = str(getattr(e, "response", {}).get("Error", {}).get("Code", "")) if hasattr(e, "response") else ""
    text = f"{type(e).__name__} {code} {e}"
    return any(t in text for t in _THROTTLED) or "Rate exceeded" in text or "throttl" in text.lower()


def throttle_delay(deferrals: int, rnd: random.Random | None = None) -> int:
    """Exponential with full jitter: 2, 4, 8 … seconds, at most two minutes, never zero."""
    top = min(THROTTLE_MAX_SECONDS, 2 ** (1 + min(deferrals, 10)))
    return max(1, round((rnd or random).uniform(top / 2, top)))


class AgentInvoker(Protocol):
    async def invoke(self, inv: dict[str, Any]) -> None:
        """``inv`` is the WorkMessage plus ``sessionId`` and ``async``: every role but VAIC runs as an AgentCore
        async job (the runtime accepts it at once and runs the turn in the background), so the dispatcher never
        waits on a planning turn (decision 178)."""
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
    worker_lease_ms: int | None = None
    """A worker's turn is a long job with its own, much longer limit; its lease has to outlast it, or the crash
    sweep sends the same work again while it is still running. None means ``lease_ms``."""


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
        if await self._cancelled(m):
            return "cancelled"
        s = await self.d.settings()
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
            # VAIC asks the owner once per cap per day whether to raise it; the work waits meanwhile.
            if await ledger.claim(f"cap-question:{cap.cap}:{cap.department or 'all'}:{day_key(ledger.now())}"):
                q = await ledger.ask_question(
                    {
                        "asked_by": "vaic",
                        "path": "VAIC",
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
        if is_worker and dept:
            await ledger.acquire_worker_slot(dept)  # counted for "workers busy"; no ceiling (decision 288)

        async def release() -> None:
            if is_worker and dept:
                await ledger.release_worker_slot(dept)

        if not await ledger.take_session_token(s["max_new_sessions_per_second"]):
            await release()
            await self._defer(m, DEFER_SECONDS["rate"])
            return "deferred:rate"
        lease_ms = (self.d.worker_lease_ms if is_worker else None) or self.d.lease_ms
        if not await ledger.begin_work(m["id"], lease_ms, dict(m)):
            await release()
            return "duplicate"
        try:
            # Not VAIC: its reply streams to the HUD from the call itself and is quick. Everyone else is handed
            # off and left to run: an Orchestrator or Manager turn can take minutes, longer than this Lambda may
            # wait (120 s); a wait cut short put the message, and the rest of its batch, back on the queue for
            # 16 minutes, so the owner saw jobs open with nobody working (decision 178).
            await self.d.invoker.invoke({**m, "sessionId": self.d.session_id_for(m), "async": m["role"] != "vaic"})
        except Exception as e:
            # The runtime never started the turn: give the slot back.
            await release()
            await ledger.abandon_work(m["id"])
            if throttled(e):
                # A quota or rate said "not now": try again shortly, with back-off, instead of failing the build.
                await self._defer(m, throttle_delay(int(m.get("deferrals", 0))))
                return "deferred:throttled"
            raise  # anything else: SQS delivers it again
        return "started"

    async def _cancelled(self, m: WorkMessage) -> bool:
        """The owner stopped the job: whatever is still queued for it is dropped, not run."""
        for key in {m.get("ticketId"), m.get("taskId")}:
            if key:
                t = await self.d.ledger.get_ticket(str(key))
                if t and t.get("status") == "cancelled":
                    return True
        return False


async def resume_stale(ledger: Ledger, queue: Queue) -> int:
    """The crash sweep (run on a schedule): a message whose lease ran out without finishing is sent again.

    Its agent's next turn reads the ledger and carries on from there.
    """
    n = 0
    for w in await ledger.stale_work():
        if not w.get("message"):
            continue
        m = cast(WorkMessage, w["message"])
        # Sent before the lease is dropped: if sending fails, the next sweep finds the work again.
        await queue.send(_deferred(m))
        await ledger.abandon_work(w["key"])
        # A dead worker turn never gave its slot back; a turn that failed but lived already did.
        if m["role"] == "worker" and m.get("department") and not w.get("slot_released"):
            await ledger.release_worker_slot(cast(str, m["department"]))
        n += 1
    return n
