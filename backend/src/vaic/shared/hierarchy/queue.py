"""Work moves between agents as queue messages, one SQS queue per role level.

A turn issues work and ends; the next turn starts when a message arrives. Nobody pays for session time while
waiting. Messages are dicts with the same JSON keys as the TypeScript version (``agentId``, ``ticketId``...).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Literal, NotRequired, Protocol, TypedDict

AgentRole = Literal["vaic", "orchestrator", "manager", "worker"]
MessageKind = Literal["task", "report", "answer", "question", "instruction", "fix", "review_result"]


# Functional form because "from" is a Python keyword.
#   id            idempotency key: the same message delivered twice runs once
#   ticketId      the ticket this message is about; taskId: the owner's original task (sessions are keyed by it)
#   body          plain text for the agent; reports and answers from other agents are untrusted data
#   conversation  VAIC's conversation id; deferrals: how many times the dispatcher deferred it
#   voice         the owner said it out loud (the HUD reads VAIC's answer aloud)
WorkMessage = TypedDict(
    "WorkMessage",
    {
        "id": str,
        "role": AgentRole,
        "agentId": str,
        "department": str | None,
        "ticketId": str,
        "taskId": str,
        "kind": MessageKind,
        "from": str,
        "body": str,
        "conversation": NotRequired[str],
        "deferrals": NotRequired[int],
        "voice": NotRequired[bool],
    },
)


class Queue(Protocol):
    async def send(self, message: WorkMessage, delay_seconds: float = 0) -> None: ...
    async def purge(self) -> None:
        """Drops every waiting message on every level (the owner's "start over"); nothing else ever purges."""
        ...


class MemoryQueue:
    """In-memory queue with simulated delays, for tests and local runs."""

    def __init__(self, now: Callable[[], float] | None = None) -> None:
        self.pending: list[tuple[WorkMessage, float]] = []
        self.sent: list[WorkMessage] = []
        self.purged = 0
        self._now = now or (lambda: time.time() * 1000)

    async def send(self, message: WorkMessage, delay_seconds: float = 0) -> None:
        self.sent.append(message)
        self.pending.append((message, self._now() + delay_seconds * 1000))

    async def purge(self) -> None:
        self.pending = []
        self.purged += 1

    def take_ready(self) -> list[WorkMessage]:
        """Takes every message available now, oldest first."""
        t = self._now()
        ready = [p for p in self.pending if p[1] <= t]
        self.pending = [p for p in self.pending if p[1] > t]
        return [m for m, _ in ready]

    def next_available_at(self) -> float | None:
        return min((p[1] for p in self.pending), default=None)
