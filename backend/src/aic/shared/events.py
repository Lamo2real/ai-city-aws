"""Every state change in the city is one of these events on the EventBridge bus ``aic-prod``.

The City view, the ledger writer and notifications all read the same events. Events travel as plain dicts
(the same JSON the HUD reads); they are validated against these models before they leave, unknown keys are
dropped and defaults filled in, like the zod schemas of the TypeScript version.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated, Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

TicketStatus = Literal["open", "in_progress", "in_review", "waiting_on_owner", "parked", "done", "failed", "cancelled"]
TERMINAL: tuple[str, ...] = ("done", "failed", "cancelled")
AgentKind = Literal["core", "manager", "worker"]
WorkerState = Literal["hired", "working", "waiting", "reporting", "review", "completed", "released", "failed"]


class _M(BaseModel):
    model_config = ConfigDict(extra="ignore")


class AgentRecord(_M):
    id: str
    kind: AgentKind
    role: str
    department: str | None
    model: str
    parent: str | None
    state: Literal["active", "dormant", "retired"]
    worker_state: WorkerState | None = None
    specialty: str | None = None
    session_id: str | None = None
    ticket_id: str | None = None
    specialist_id: str | None = None
    total_cost_usd: float = 0
    hired_at: str | None = None
    last_active_at: str | None = None


class TicketRecord(_M):
    id: str
    goal: str
    from_: str = Field(alias="from")
    to: str
    status: TicketStatus
    department: str | None
    parent_id: str | None
    kind: Literal["task", "assignment", "instruction", "report", "fix"] = "task"
    acceptance: str | None = None
    result: str | None = None
    review_rounds: float = 0
    conversation: str | None = None
    """Ace's conversation the task came from, so the result is spoken back there."""
    created_at: str
    updated_at: str


class QuestionRecord(_M):
    id: str
    asked_by: str
    path: str
    ticket_id: str | None
    text: str
    options: list[str] = Field(default_factory=list)
    default_answer: str
    status: Literal["open", "answered", "expired"]
    answer: str | None = None
    answered_by: str | None = None
    created_at: str


class _E(_M):
    at: str


class AgentHired(_E):
    type: Literal["agent.hired"]
    agent: AgentRecord


class AgentRetired(_E):
    type: Literal["agent.retired"]
    id: str


class WorkerStateEvent(_E):
    type: Literal["worker.state"]
    id: str
    state: WorkerState
    detail: str | None = None


class Activity(_E):
    type: Literal["activity"]
    id: str
    activity: str
    detail: str | None = None


class TicketStatusEvent(_E):
    type: Literal["ticket.status"]
    ticket: TicketRecord
    previous: TicketStatus | None


class DepartmentCreated(_E):
    type: Literal["department.created"]
    name: str
    mission: str
    manager_id: str


class QuestionAsked(_E):
    type: Literal["question.asked"]
    question: QuestionRecord


class QuestionAnswered(_E):
    type: Literal["question.answered"]
    id: str
    answer: str
    answered_by: str


class ReviewResult(_E):
    type: Literal["review.result"]
    ticket_id: str
    agent: str
    reviewer: str
    verdict: Literal["PASS", "FAIL"]
    summary: str
    round: float


class SignoffResult(_E):
    type: Literal["signoff.result"]
    ticket_id: str
    verdict: Literal["PASS", "FAIL"]
    summary: str


class Today(_M):
    usd: float
    turns: float
    tokens: float


class CostUpdate(_E):
    type: Literal["cost.update"]
    agent: str
    role: str
    department: str | None
    model: str
    usd: float
    tokens: float
    today: Today


class Result(_E):
    type: Literal["result"]
    ticket_id: str
    summary: str


class Instruction(_E):
    type: Literal["instruction"]
    to: str
    cc: list[str]
    text: str
    ticket_id: str


class ApprovalRequested(_E):
    type: Literal["approval.requested"]
    id: str
    agent: str
    action: str
    reason: str
    cost_hint: str | None = None


class ApprovalDecided(_E):
    type: Literal["approval.decided"]
    id: str
    approved: bool


class CityState(_E):
    type: Literal["city.state"]
    paused: bool
    reason: str | None


class SpendCapReachedEvent(_E):
    type: Literal["spend.cap_reached"]
    cap: Literal["daily_global", "daily_department", "monthly"]
    department: str | None
    spent: float
    limit: float


class AceReply(_E):
    type: Literal["ace.reply"]
    conversation: str
    text: str
    done: bool


class KnowledgeUpdated(_E):
    """A knowledge item's status or scope changed (``docs/KNOWLEDGE.md`` §6)."""

    type: Literal["knowledge.updated"]
    id: str
    status: Literal["uploading", "processing", "ready", "failed", "unsupported"]
    title: str
    scope: Literal["always", "relevant", "on_request"]
    kind: Literal["text", "document", "image", "audio", "video", "link", "other"]
    error: str | None = None


CityEventModel = Annotated[
    AgentHired
    | AgentRetired
    | WorkerStateEvent
    | Activity
    | TicketStatusEvent
    | DepartmentCreated
    | QuestionAsked
    | QuestionAnswered
    | ReviewResult
    | SignoffResult
    | CostUpdate
    | Result
    | Instruction
    | ApprovalRequested
    | ApprovalDecided
    | CityState
    | SpendCapReachedEvent
    | AceReply
    | KnowledgeUpdated,
    Field(discriminator="type"),
]
_ADAPTER: TypeAdapter[Any] = TypeAdapter(CityEventModel)

CityEvent = dict[str, Any]
"""An event as it travels: the validated JSON dict."""


def _dump(m: BaseModel) -> dict[str, Any]:
    """Like zod's output: provided fields and filled-in defaults; optional fields that were never given stay absent."""
    out: dict[str, Any] = {}
    for name, field in type(m).model_fields.items():
        key = field.alias or name
        val = getattr(m, name)
        given = name in m.model_fields_set
        if not given and val is None:
            continue
        if isinstance(val, BaseModel):
            out[key] = _dump(val)
        elif isinstance(val, float) and val.is_integer():
            out[key] = int(val)
        else:
            out[key] = val
    return out


def parse_event(data: dict[str, Any]) -> CityEvent:
    """Validates an event and returns its clean dict (raises pydantic.ValidationError when it doesn't fit)."""
    return _dump(_ADAPTER.validate_python(data))


def now_iso(now: datetime | None = None) -> str:
    d = now or datetime.now(UTC)
    return d.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class EventBus(Protocol):
    async def put(self, event: dict[str, Any]) -> None: ...


Listener = Callable[[CityEvent], Awaitable[None] | None]


class MemoryBus:
    """In-memory bus for tests and local runs."""

    def __init__(self, now: Callable[[], datetime] | None = None) -> None:
        self.events: list[CityEvent] = []
        self._listeners: list[Listener] = []
        self._now = now or (lambda: datetime.now(UTC))

    async def put(self, event: dict[str, Any]) -> None:
        e = parse_event({**event, "at": now_iso(self._now())})
        self.events.append(e)
        for listener in self._listeners:
            r = listener(e)
            if r is not None:
                await r

    def on(self, listener: Listener) -> None:
        self._listeners.append(listener)

    def of_type(self, type_: str) -> list[CityEvent]:
        return [e for e in self.events if e["type"] == type_]
