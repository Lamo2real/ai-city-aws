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
AgentKind = Literal["core", "manager", "worker", "executive"]
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
    """VAIC's conversation the task came from, so the result is spoken back there."""
    standing_order: str | None = None
    """The standing order that started this job (decision 125); None for the owner's own jobs."""
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
    worker_model: str | None = None
    """Set when the owner chose the workers' model for a department they built (decision 134)."""


class DepartmentDemolished(_E):
    """The owner demolished a department (decision 134): its workers went home, its open parts were cancelled
    and handed back to the Orchestrator; the City plays the demolition and the lot stands empty."""

    type: Literal["department.demolished"]
    name: str
    workers: int = 0
    parts: int = 0


class QuestionAsked(_E):
    type: Literal["question.asked"]
    question: QuestionRecord


class QuestionAnswered(_E):
    type: Literal["question.answered"]
    id: str
    answer: str
    answered_by: str


class QuestionWithdrawn(_E):
    """The job the question belonged to stopped or finished: nobody needs the answer any more."""

    type: Literal["question.withdrawn"]
    id: str


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
    kind: Literal["tool", "app.publish", "connector.add"] = "tool"
    """``connector.add`` for an add-connector approval (the chat shows a connector card)."""
    connector_id: str | None = None
    preview: dict[str, Any] | None = None
    """An email or event the owner sees before approving (``docs/MAIL_CALENDAR.md`` §5.5)."""
    draft_id: str | None = None
    preview_url: str | None = None
    title: str | None = None
    description: str | None = None
    capabilities: list[dict[str, Any]] | None = None
    pin: bool | None = None
    replaces: str | None = None
    """app.publish, v3: the app this is a new version of."""
    version: int | None = None


class ApprovalDecided(_E):
    type: Literal["approval.decided"]
    id: str
    approved: bool


class ApprovalWithdrawn(_E):
    """The job the approval belonged to stopped or finished: the action will never run."""

    type: Literal["approval.withdrawn"]
    id: str


class StewardDecided(_E):
    """The Chief of Staff decided a Needs you item (``kind`` question or approval) for the owner."""

    type: Literal["steward.decided"]
    id: str
    kind: Literal["question", "approval"]
    choice: str
    reason: str


class AppFile(_M):
    path: str
    size: float


class AppSubmitted(_E):
    type: Literal["app.submitted"]
    hire_id: str
    ticket_id: str
    task_id: str
    department: str
    title: str
    description: str
    icon: str | None = None
    files: list[AppFile]


class AppDraft(_E):
    type: Literal["app.draft"]
    draft_id: str
    ticket_id: str
    task_id: str
    department: str
    title: str
    status: Literal["staging", "ready", "rejected", "awaiting_owner", "published", "refused"]
    reason: str | None = None
    preview_url: str | None = None


class AppPublished(_E):
    type: Literal["app.published"]
    app_id: str
    slug: str
    title: str
    icon_url: str | None = None
    url: str
    task_id: str
    department: str
    conversation: str | None = None
    """The ``app-new-…`` project chat it was built from; the chat goes on as ``app-<app_id>``."""


class AppUpdated(_E):
    type: Literal["app.updated"]
    app: dict[str, Any]


class AppRemoved(_E):
    type: Literal["app.removed"]
    app_id: str
    slug: str


class ConnectorUpdated(_E):
    type: Literal["connector.updated"]
    id: str
    label: str
    status: str
    """A record status (``docs/CONNECTORS_SKILLS.md`` §1.2), or ``removed``."""
    auth: str
    needs: str | None = None
    error: str | None = None


class ConnectSignin(_E):
    """A mail or calendar account waits for the owner's sign-in (or app password): the HUD shows a card.
    No URL here: the HUD fetches it when the owner taps (``docs/MAIL_CALENDAR.md`` §6)."""

    type: Literal["connect.signin"]
    account_id: str
    provider: str
    label: str


class MailAccountEvent(_E):
    type: Literal["mail.account"]
    account: dict[str, Any]
    """The public account (no session URI, no secret name); status ``removed`` when it was disconnected."""


class CalendarChanged(_E):
    type: Literal["calendar.changed"]
    calendar_ids: list[str]


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


class AceQuestion(_E):
    """VAIC asks the owner a multiple-choice question: the HUD shows the options as tappable chips, and a tap
    comes back as an ordinary owner message in the same conversation."""

    type: Literal["ace.question"]
    conversation: str
    question: str
    options: list[str]


class HudAction(_E):
    """VAIC changes something that lives on the owner's device (decision 143): ``theme`` (light, dark, system) or
    ``open`` (bring a HUD page up). Every open HUD applies it."""

    type: Literal["hud.action"]
    action: Literal["theme", "open"]
    conversation: str = "main"
    value: str | None = None
    page: str | None = None


class WorkflowUpdated(_E):
    """A workflow run changed (decision 126): the HUD's walkthrough card redraws from ``run`` (its public form)."""

    type: Literal["workflow.updated"]
    run: dict[str, Any]


class ExecutiveOffice(_E):
    """An executive was called in to HQ (``at_hq`` true) or went home after advising (decision 140)."""

    type: Literal["executive.office"]
    id: str
    at_hq: bool
    agent: AgentRecord


class ExecutiveRecommended(_E):
    """An executive's recommendation was filed (decision 140): advice only, never work. Settings → Executives shows it."""

    type: Literal["executive.recommended"]
    recommendation: dict[str, Any]


class SupportTicket(_E):
    """A customer ticket on the support desk changed (decision 131): the HUD's board redraws that row."""

    type: Literal["support.ticket"]
    ticket: dict[str, Any]


class KnowledgeUpdated(_E):
    """A knowledge item's status or scope changed (``docs/KNOWLEDGE.md`` §6)."""

    type: Literal["knowledge.updated"]
    id: str
    status: Literal["uploading", "processing", "ready", "failed", "unsupported"]
    title: str
    scope: Literal["always", "relevant", "on_request"]
    kind: Literal["text", "document", "image", "audio", "video", "link", "other"]
    error: str | None = None


class FileCard(BaseModel):
    """What VAIC's chat keeps of one file (docs/FILES.md §8); the addresses are fetched fresh when shown."""

    id: str
    name: str
    kind: Literal["image", "video", "audio", "document", "text", "other"]
    content_type: str = ""
    size_bytes: int = 0
    description: str = ""
    department: str = ""
    taken_at: str = ""
    created_at: str = ""


class FilesUpdated(_E):
    """A file in Files arrived, changed, was described or was deleted (``docs/FILES.md`` §7)."""

    type: Literal["files.updated"]
    id: str
    status: Literal["uploading", "processing", "ready", "failed", "deleted"]
    name: str = ""
    kind: str = ""
    folder: str = ""
    department: str = ""
    error: str | None = None


class AceFiles(_E):
    """VAIC put files in the chat (``show_files``): a preview and a Download button each; ``ask`` = VAIC asks which."""

    type: Literal["ace.files"]
    conversation: str = "main"
    message_id: str = ""
    files: list[FileCard]
    ask: bool = False
    label: str = ""
    """A heading over the cards ("References for this build"); empty for files VAIC simply shows."""


CityEventModel = Annotated[
    AgentHired
    | AgentRetired
    | WorkerStateEvent
    | Activity
    | TicketStatusEvent
    | DepartmentCreated
    | DepartmentDemolished
    | QuestionAsked
    | QuestionAnswered
    | QuestionWithdrawn
    | ReviewResult
    | SignoffResult
    | CostUpdate
    | Result
    | Instruction
    | ApprovalRequested
    | ApprovalDecided
    | ApprovalWithdrawn
    | StewardDecided
    | ExecutiveRecommended
    | ExecutiveOffice
    | ConnectorUpdated
    | ConnectSignin
    | MailAccountEvent
    | CalendarChanged
    | SpendCapReachedEvent
    | AceReply
    | AceQuestion
    | HudAction
    | AppSubmitted
    | AppDraft
    | AppPublished
    | AppUpdated
    | AppRemoved
    | KnowledgeUpdated
    | FilesUpdated
    | AceFiles
    | WorkflowUpdated
    | SupportTicket,
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
        elif isinstance(val, list):
            out[key] = [_dump(v) if isinstance(v, BaseModel) else v for v in val]
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
