"""The Agent Factory and Registry.

Validates a hire spec against policy and department ceilings, writes the agent record, and releases workers.
There is no limit on how many workers a department hires; only concurrency ceilings, AWS quotas and spend
caps limit how many run at once.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..caps import department_cap
from ..connectors import ConnectorStore
from ..events import EventBus, now_iso
from ..ids import department_key, new_id
from ..ledger import Ledger, Record

WORKER_TOOLS: tuple[str, ...] = (
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "code_interpreter",
    "browser",
    "git",
)
WorkerTool = Literal[
    "Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "code_interpreter", "browser", "git"
]


class HireSpec(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    specialty: str = Field(min_length=3, max_length=80)
    instructions: str = Field(min_length=10, max_length=8000)
    tools: list[WorkerTool] = Field(min_length=1, max_length=len(WORKER_TOOLS))
    budget_hint_usd: float | None = Field(default=None, gt=0, le=1000)
    specialist_id: str | None = None
    """Hire a saved specialist again: its instructions and tools are used, the spec's specialty names it."""
    connectors: list[str] = Field(default_factory=list, max_length=20)
    """Connector ids this worker may use (``docs/CONNECTORS_SKILLS.md`` §1.4); each must be open to workers."""


class HireRefused(RuntimeError):
    pass


class FactoryClient(Protocol):
    async def hire(self, spec: dict[str, Any], manager_id: str, department: str) -> Record: ...
    async def release(self, worker_id: str, manager_id: str) -> Record: ...


def _fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(v)


class Factory:
    def __init__(self, ledger: Ledger, bus: EventBus, settings: Callable[[], Awaitable[dict[str, Any]]]) -> None:
        self._ledger = ledger
        self._bus = bus
        self._settings = settings

    async def hire(self, raw: dict[str, Any], manager_id: str, department: str) -> Record:
        try:
            spec = HireSpec.model_validate(raw)
        except ValidationError as e:
            issues = "; ".join(f"{'.'.join(str(p) for p in i['loc'])} {i['msg']}" for i in e.errors())
            raise HireRefused(f"The hire spec is not valid: {issues}") from e
        dept = await self._ledger.get_department(department)
        if not dept or dept.get("state") != "active":
            raise HireRefused(f"There is no active department called {department}.")
        if dept["manager_id"] != manager_id:
            raise HireRefused(f"Only {dept['name']}'s manager can hire for it.")
        s = await self._settings()
        cap = department_cap(s, dept["name"])
        if spec.budget_hint_usd and cap is not None and spec.budget_hint_usd > cap:
            raise HireRefused(
                f"The budget hint of ${_fmt(spec.budget_hint_usd)} is above {dept['name']}'s daily cap of ${_fmt(cap)}."
            )
        instructions, tools, connectors = spec.instructions, list(spec.tools), list(dict.fromkeys(spec.connectors))
        if spec.specialist_id:
            saved = await self._ledger.get_specialist(spec.specialist_id)
            if not saved:
                raise HireRefused(f"No saved specialist {spec.specialist_id}.")
            instructions = saved["instructions"]
            tools = [t for t in saved.get("tools", []) if t in WORKER_TOOLS]
            connectors = list(saved.get("connectors") or [])
        if connectors:
            open_to_workers = {
                r["id"] for r in await ConnectorStore(self._ledger.table).list() if (r.get("roles") or {}).get("worker")
            }
            unknown = [c for c in connectors if c not in open_to_workers]
            if unknown:
                ok = ", ".join(sorted(open_to_workers)) or "none yet"
                raise HireRefused(
                    f"These connectors aren't open to workers: {', '.join(unknown)}. Open to workers: {ok}. "
                    "Hire again without them, or with only those."
                )
        at = now_iso(self._ledger.now())
        agent: Record = {
            "id": new_id(f"wkr-{department_key(dept['name'])}"),
            "kind": "worker",
            "role": spec.specialty,
            "specialty": spec.specialty,
            "department": dept["name"],
            "model": "opus-5-5",
            "parent": manager_id,
            "state": "active",
            "worker_state": "hired",
            "ticket_id": None,
            "specialist_id": spec.specialist_id,
            "total_cost_usd": 0,
            "hired_at": at,
            "last_active_at": at,
        }
        await self._ledger.put_agent(agent)
        # The spec is stored beside the record, so the worker's turns and save_specialist can read it.
        await self._ledger.table.put(
            {
                "pk": f"AGENT#{agent['id']}",
                "sk": "SPEC",
                "instructions": instructions,
                "tools": tools,
                "connectors": connectors,
                "budget_hint_usd": spec.budget_hint_usd,
            }
        )
        await self._bus.put({"type": "agent.hired", "agent": agent})
        return agent

    async def release(self, worker_id: str, manager_id: str) -> Record:
        a = await self._ledger.get_agent(worker_id)
        if not a or a.get("kind") != "worker":
            raise HireRefused(f"No worker {worker_id}.")
        if a.get("parent") != manager_id:
            raise HireRefused(f"Only {a.get('parent')} can release {worker_id}.")
        if a.get("state") == "retired":
            return a
        released = await self._ledger.update_agent(worker_id, {"state": "retired", "worker_state": "released"})
        await self._bus.put({"type": "agent.retired", "id": worker_id})
        return released


async def worker_spec(ledger: Ledger, worker_id: str) -> dict[str, Any] | None:
    it = await ledger.table.get(f"AGENT#{worker_id}", "SPEC")
    if not it:
        return None
    return {
        "instructions": str(it.get("instructions", "")),
        "tools": list(it.get("tools") or []),
        "connectors": list(it.get("connectors") or []),
    }
