"""The ledger: tickets, turns, costs, departments, agents, hires, specialists, questions, approvals, notes,
reminders and events, in one DynamoDB table.

Every unit of work is a ticket with a status history, so work resumes after any crash. Days are UTC calendar
days. Records are plain dicts with the same keys as before (the HUD reads them through the API).
"""

from __future__ import annotations

import asyncio
import itertools
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from typing import Any, Literal

from .events import now_iso
from .ids import department_key, new_id
from .table import ABSENT, AddLimit, Item, Table, UpdateOptions

Record = dict[str, Any]
TurnKind = Literal["ace", "orchestrator", "manager", "worker", "utility", "compaction", "eval"]
TURN_KINDS: tuple[TurnKind, ...] = ("ace", "orchestrator", "manager", "worker", "utility", "compaction", "eval")
ALL_STATUSES = ("open", "in_progress", "in_review", "waiting_on_owner", "parked", "done", "failed", "cancelled")
_KEY_ATTRS = {"pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk", "ttl"}

# Orders items written in the same millisecond by this process; ids keep different processes apart.
_counter = itertools.count(1)


def _seq() -> str:
    return f"{next(_counter) % 1_000_000:06d}#{new_id('x')[2:]}"


def day_key(d: datetime) -> str:
    return d.astimezone(UTC).strftime("%Y-%m-%d")


def month_key(d: datetime) -> str:
    return d.astimezone(UTC).strftime("%Y-%m")


def strip(it: Item | None) -> Record | None:
    if it is None:
        return None
    return {k: v for k, v in it.items() if k not in _KEY_ATTRS}


def _strip(it: Item) -> Record:
    return {k: v for k, v in it.items() if k not in _KEY_ATTRS}


def _num(v: Any) -> float:
    n = float(v or 0)
    return int(n) if n.is_integer() else n


def _spend(it: Item | None, savings: bool = False) -> dict[str, float]:
    i = it or {}
    out = {"usd": _num(i.get("usd")), "turns": _num(i.get("turns")), "tokens": _num(i.get("tokens"))}
    if savings:
        out["cache_savings_usd"] = _num(i.get("cache_savings_usd"))
    return out


class Ledger:
    def __init__(self, table: Table, clock: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self._clock = clock or (lambda: datetime.now(UTC))

    def now(self) -> datetime:
        return self._clock()

    def now_ms(self) -> int:
        return int(self.now().timestamp() * 1000)

    def _iso(self) -> str:
        return now_iso(self._clock())

    # ---------- tickets ----------
    async def create_ticket(self, t: Record) -> Record:
        at = self._iso()
        ticket: Record = {"review_rounds": 0, "status": "open", **t}
        ticket["id"] = t.get("id") or new_id("t")
        ticket["created_at"] = at
        ticket["updated_at"] = at
        created = await self.table.put(self._ticket_item(ticket), if_not_exists=True)
        if not created:  # idempotent: same id, same ticket
            existing = await self.get_ticket(ticket["id"])
            assert existing is not None
            return existing
        await self._history(ticket["id"], None, ticket["status"], "created")
        return ticket

    @staticmethod
    def _ticket_item(t: Record) -> Item:
        item: Item = {
            "pk": f"TICKET#{t['id']}",
            "sk": "META",
            "gsi1pk": f"TICKET#{t['status']}",
            "gsi1sk": t["updated_at"],
        }
        if t.get("department"):
            item.update(gsi2pk=f"DEPT#{department_key(t['department'])}", gsi2sk=f"TICKET#{t['id']}")
        return {**item, **t}

    async def get_ticket(self, id: str) -> Record | None:
        return strip(await self.table.get(f"TICKET#{id}", "META"))

    async def set_ticket_status(
        self, id: str, status: str, note: str = "", patch: Record | None = None
    ) -> tuple[Record, str] | None:
        """Moves a ticket, keeping its history. Returns (ticket, previous), or None if it was already there."""
        p = patch or {}
        while True:
            cur = await self.get_ticket(id)
            if cur is None:
                raise KeyError(f"no ticket {id}")
            if cur["status"] == status and not p:
                return None
            at = self._iso()
            nxt = {**cur, **p, "status": status, "updated_at": at}
            ok = await self.table.update(
                f"TICKET#{id}",
                "META",
                UpdateOptions(
                    set={**p, "status": status, "updated_at": at, "gsi1pk": f"TICKET#{status}", "gsi1sk": at},
                    expect={"status": cur["status"]},  # two writers racing: one wins, the other re-reads
                ),
            )
            if ok:
                await self._history(id, cur["status"], status, note)
                return nxt, cur["status"]

    async def _history(self, id: str, from_: str | None, to: str, note: str) -> None:
        at = self._iso()
        await self.table.put(
            {"pk": f"TICKET#{id}", "sk": f"HIST#{at}#{_seq()}", "from": from_, "to": to, "note": note, "at": at}
        )

    async def ticket_history(self, id: str) -> list[Record]:
        return [_strip(i) for i in await self.table.query(f"TICKET#{id}", "HIST#")]

    async def list_tickets(self, statuses: Iterable[str]) -> list[Record]:
        groups = await asyncio.gather(*(self.table.query_index("gsi1", f"TICKET#{s}") for s in statuses))
        return [_strip(i) for g in groups for i in g]

    async def tickets_of(self, agent_id: str, statuses: Iterable[str]) -> list[Record]:
        return [t for t in await self.list_tickets(statuses) if t["to"] == agent_id]

    async def child_tickets(self, parent_id: str) -> list[Record]:
        return [t for t in await self.list_tickets(ALL_STATUSES) if t.get("parent_id") == parent_id]

    # ---------- departments ----------
    async def create_department(self, name: str, mission: str, manager_id: str) -> tuple[Record, bool]:
        key = department_key(name)
        dept: Record = {
            "key": key,
            "name": name.strip(),
            "mission": mission,
            "manager_id": manager_id,
            "state": "active",
            "created_at": self._iso(),
        }
        created = await self.table.put(
            {"pk": f"DEPT#{key}", "sk": "META", "gsi1pk": "DEPT", "gsi1sk": dept["created_at"], **dept},
            if_not_exists=True,
        )
        if created:
            return dept, True
        existing = await self.get_department(name)
        assert existing is not None
        return existing, False

    async def get_department(self, name: str) -> Record | None:
        return strip(await self.table.get(f"DEPT#{department_key(name)}", "META"))

    async def stand_down_department(self, name: str, down: bool = True) -> None:
        """The owner sent everyone home: the department hires and assigns nothing until a new goal arrives
        (`down=False` clears it, which `assign_to_department` does)."""
        await self.table.update(
            f"DEPT#{department_key(name)}",
            "META",
            UpdateOptions(set={"stood_down_at": self._iso() if down else ""}),
        )

    async def list_departments(self) -> list[Record]:
        return [_strip(i) for i in await self.table.query_index("gsi1", "DEPT")]

    # ---------- agents (hires) ----------
    async def put_agent(self, a: Record) -> None:
        item: Item = {"pk": f"AGENT#{a['id']}", "sk": "META", "gsi1pk": f"AGENT#{a['state']}", "gsi1sk": a["id"]}
        if a.get("department"):
            item.update(gsi2pk=f"DEPT#{department_key(a['department'])}", gsi2sk=f"AGENT#{a['id']}")
        await self.table.put({**item, **a})

    async def get_agent(self, id: str) -> Record | None:
        return strip(await self.table.get(f"AGENT#{id}", "META"))

    async def update_agent(self, id: str, patch: Record) -> Record:
        s: Record = {**patch, "last_active_at": self._iso()}
        if patch.get("state"):
            s["gsi1pk"] = f"AGENT#{patch['state']}"
        it = await self.table.update(f"AGENT#{id}", "META", UpdateOptions(set=s, must_exist=True))
        if it is None:
            raise KeyError(f"no agent {id}")
        return _strip(it)

    async def list_agents(self, state: str | None = None) -> list[Record]:
        states = [state] if state else ["active", "dormant", "retired"]
        groups = await asyncio.gather(*(self.table.query_index("gsi1", f"AGENT#{s}") for s in states))
        return [_strip(i) for g in groups for i in g]

    async def department_agents(self, department: str) -> list[Record]:
        return [_strip(i) for i in await self.table.query_index("gsi2", f"DEPT#{department_key(department)}", "AGENT#")]

    # ---------- specialists (saved worker specs) ----------
    async def save_specialist(self, s: Record) -> Record:
        sp: Record = {**s, "id": s.get("id") or new_id("spec"), "created_at": self._iso()}
        await self.table.put(
            {
                "pk": f"SPEC#{sp['id']}",
                "sk": "META",
                "gsi1pk": "SPEC",
                "gsi1sk": sp["id"],
                "gsi2pk": f"DEPT#{department_key(sp['department'])}",
                "gsi2sk": f"SPEC#{sp['id']}",
                **sp,
            }
        )
        return sp

    async def get_specialist(self, id: str) -> Record | None:
        return strip(await self.table.get(f"SPEC#{id}", "META"))

    async def list_specialists(self) -> list[Record]:
        return [_strip(i) for i in await self.table.query_index("gsi1", "SPEC")]

    # ---------- questions ----------
    async def ask_question(self, q: Record) -> Record:
        rec: Record = {
            "options": [],
            **q,
            "id": q.get("id") or new_id("q"),
            "status": "open",
            "created_at": self._iso(),
        }
        await self.table.put(
            {"pk": f"Q#{rec['id']}", "sk": "META", "gsi1pk": "Q#open", "gsi1sk": rec["created_at"], **rec}
        )
        return rec

    async def answer_question(self, id: str, answer: str, answered_by: str) -> Record | None:
        it = await self.table.update(
            f"Q#{id}",
            "META",
            UpdateOptions(
                set={"status": "answered", "answer": answer, "answered_by": answered_by, "gsi1pk": "Q#answered"},
                expect={"status": "open"},  # answered once; a second answer is refused
            ),
        )
        return strip(it)

    async def get_question(self, id: str) -> Record | None:
        return strip(await self.table.get(f"Q#{id}", "META"))

    async def open_questions(self) -> list[Record]:
        return [_strip(i) for i in await self.table.query_index("gsi1", "Q#open")]

    # ---------- approvals, bound to one exact action ----------
    async def request_approval(self, a: Record) -> Record:
        rec: Record = {**a, "id": new_id("ap"), "status": "pending", "created_at": self._iso()}
        await self.table.put(
            {
                "pk": f"APPROVAL#{rec['id']}",
                "sk": "META",
                "gsi1pk": "APPROVAL#pending",
                "gsi1sk": f"{rec['hash']}#{rec['id']}",
                **rec,
            }
        )
        return rec

    async def get_approval(self, id: str) -> Record | None:
        return strip(await self.table.get(f"APPROVAL#{id}", "META"))

    async def decide_approval(self, id: str, approved: bool) -> Record | None:
        """The owner's decision. An approval also writes APPROVED#<hash>, which only the API may write and an
        agent's turn consumes by deleting it once. IAM lets workers delete it, never write it."""
        cur = await self.get_approval(id)
        if cur is None:
            return None
        status = "approved" if approved else "denied"
        r = strip(
            await self.table.update(
                f"APPROVAL#{id}",
                "META",
                UpdateOptions(set={"status": status, "gsi1pk": f"APPROVAL#{status}"}, expect={"status": "pending"}),
            )
        )
        if r and approved:
            await self.table.put(
                {"pk": f"APPROVED#{cur['hash']}", "sk": id, "at": self._iso(), "ttl": self.now_ms() // 1000 + 86_400}
            )
        return r

    async def pending_approvals(self) -> list[Record]:
        return [_strip(i) for i in await self.table.query_index("gsi1", "APPROVAL#pending")]

    async def consume_approval(self, hash: str) -> bool:
        """Uses an owner approval for this exact action once."""
        for it in await self.table.query(f"APPROVED#{hash}"):
            if await self.table.delete_if_exists(it["pk"], it["sk"]):
                await self.table.update(
                    f"APPROVAL#{it['sk']}", "META", UpdateOptions(set={"status": "used", "gsi1pk": "APPROVAL#used"})
                )
                return True
        return False

    # ---------- turns, costs and spend counters ----------
    async def record_turn(self, t: Record) -> tuple[Record, dict[str, float]]:
        turn: Record = {**t, "id": t.get("id") or new_id("turn"), "at": self._iso()}
        # Idempotent per turn id: a retried Lambda never counts a turn twice.
        fresh = await self.claim(f"turn:{turn['id']}", 7 * 86_400)
        today: dict[str, float] = {"usd": 0, "turns": 0, "tokens": 0}
        if not fresh:
            return turn, today
        now = self.now()
        await self.table.put(
            {
                "pk": f"TURN#{turn['agent']}",
                "sk": f"{turn['at']}#{_seq()}#{turn['id']}",
                "gsi1pk": f"TURNDAY#{day_key(now)}",
                "gsi1sk": f"{turn['at']}#{turn['id']}",
                **turn,
            }
        )
        tokens = turn["input"] + turn["output"] + turn["cache_read"] + turn["cache_write_5m"] + turn["cache_write_1h"]
        d, m = day_key(now), month_key(now)
        add = {"usd": turn["usd"], "turns": 1, "tokens": tokens, "cache_savings_usd": turn["cache_savings_usd"]}
        keys = [
            (f"SPEND#DAY#{d}", "GLOBAL"),
            (f"SPEND#MONTH#{m}", "GLOBAL"),
            (f"SPEND#DAY#{d}", f"ROLE#{turn['role']}"),
            (f"SPEND#MONTH#{m}", f"ROLE#{turn['role']}"),
            (f"SPEND#DAY#{d}", f"MODEL#{turn['model']}"),
            (f"SPEND#MONTH#{m}", f"MODEL#{turn['model']}"),
        ]
        if turn.get("department"):
            dept = department_key(turn["department"])
            keys += [(f"SPEND#DAY#{d}", f"DEPT#{dept}"), (f"SPEND#MONTH#{m}", f"DEPT#{dept}")]
        for pk, sk in keys:
            it = await self.table.update(pk, sk, UpdateOptions(add=add))
            if pk.startswith("SPEND#DAY#") and sk == "GLOBAL":
                today = _spend(it)
        if await self.get_agent(turn["agent"]):
            await self.table.update(
                f"AGENT#{turn['agent']}", "META", UpdateOptions(add={"total_cost_usd": turn["usd"]})
            )
        return turn, today

    def _spend_pk(self, scope: str, at: datetime | None) -> str:
        a = at or self.now()
        return f"SPEND#DAY#{day_key(a)}" if scope == "day" else f"SPEND#MONTH#{month_key(a)}"

    async def spend(self, scope: Literal["day", "month"], sk: str, at: datetime | None = None) -> dict[str, float]:
        return _spend(await self.table.get(self._spend_pk(scope, at), sk), savings=True)

    async def spend_breakdown(
        self, scope: Literal["day", "month"], at: datetime | None = None
    ) -> dict[str, dict[str, float]]:
        return {it["sk"]: _spend(it, savings=True) for it in await self.table.query(self._spend_pk(scope, at))}

    async def turns_of(self, agent_id: str) -> list[Record]:
        return [_strip(i) for i in await self.table.query(f"TURN#{agent_id}")]

    # ---------- concurrency slots and the session rate limit ----------
    async def acquire_worker_slot(self, department: str, per_dept: int, global_: int) -> bool:
        """Takes a worker slot in the department and globally, or returns False when a ceiling is reached."""
        g = await self.table.update(
            "SLOTS", "GLOBAL", UpdateOptions(add={"active": 1}, add_limit=AddLimit("active", global_))
        )
        if g is None:
            return False
        d = await self.table.update(
            "SLOTS",
            f"DEPT#{department_key(department)}",
            UpdateOptions(add={"active": 1}, add_limit=AddLimit("active", per_dept)),
        )
        if d is None:
            await self.table.update("SLOTS", "GLOBAL", UpdateOptions(add={"active": -1}))
            return False
        return True

    async def release_worker_slot(self, department: str) -> None:
        await self.table.update("SLOTS", "GLOBAL", UpdateOptions(add={"active": -1}))
        await self.table.update("SLOTS", f"DEPT#{department_key(department)}", UpdateOptions(add={"active": -1}))

    async def active_workers(self, department: str | None = None) -> int:
        it = await self.table.get("SLOTS", f"DEPT#{department_key(department)}" if department else "GLOBAL")
        return int((it or {}).get("active", 0))

    async def take_session_token(self, per_second: int) -> bool:
        """At most ``per_second`` new sessions in any one second."""
        sec = self.now_ms() // 1000
        it = await self.table.update(
            "RATE", str(sec), UpdateOptions(add={"n": 1}, add_limit=AddLimit("n", per_second), set={"ttl": sec + 120})
        )
        return it is not None

    # ---------- city settings ----------
    async def settings(self, defaults: Record) -> Record:
        it = strip(await self.table.get("CONFIG", "city"))
        return {**defaults, **(it or {})}

    async def update_settings(self, patch: Record) -> None:
        await self.table.update("CONFIG", "city", UpdateOptions(set=patch))

    # ---------- events (ticket trace), notes, reminders, idempotency ----------
    async def append_event(self, ticket_id: str, e: Record) -> None:
        await self.table.put({"pk": f"EVENT#{ticket_id}", "sk": f"{e['at']}#{_seq()}", **e})

    async def trace(self, ticket_id: str) -> list[Record]:
        return [_strip(i) for i in await self.table.query(f"EVENT#{ticket_id}")]

    async def add_note(self, text: str, kind: Literal["note", "reminder"], due_at: str | None = None) -> dict[str, str]:
        id = new_id("n" if kind == "note" else "r")
        await self.table.put(
            {
                "pk": f"{kind.upper()}#{id}",
                "sk": "META",
                "gsi1pk": "NOTE" if kind == "note" else "REMINDER#pending",
                "gsi1sk": due_at or self._iso(),
                "id": id,
                "text": text,
                "due_at": due_at,
                "created_at": self._iso(),
            }
        )
        return {"id": id}

    async def list_notes(self, kind: Literal["note", "reminder"]) -> list[Record]:
        return [
            _strip(i) for i in await self.table.query_index("gsi1", "NOTE" if kind == "note" else "REMINDER#pending")
        ]

    async def begin_work(self, key: str, lease_ms: int, message: Any = None) -> bool:
        """Takes a lease on one unit of work (a queue message). False when it is done, or running under a live lease."""
        cur = await self.table.get(f"WORK#{key}", "META")
        now = self.now_ms()
        if cur and cur.get("state") == "done":
            return False
        if cur and cur.get("state") == "started" and float(cur.get("lease_until", 0)) > now:
            return False
        s: Record = {
            "state": "started",
            "lease_until": now + lease_ms,
            "ttl": now // 1000 + 7 * 86_400,
            "gsi1pk": "WORK#started",
            "gsi1sk": str(now + lease_ms),
        }
        if message:
            s["message"] = message
        expect = {
            "state": (cur or {}).get("state", ABSENT),
            "lease_until": (cur or {}).get("lease_until", ABSENT),
        }
        return await self.table.update(f"WORK#{key}", "META", UpdateOptions(set=s, expect=expect)) is not None

    async def finish_work(self, key: str) -> None:
        await self.table.update(f"WORK#{key}", "META", UpdateOptions(set={"state": "done", "gsi1pk": "WORK#done"}))

    async def abandon_work(self, key: str) -> None:
        """Lets a failed unit of work be picked up again at once instead of after its lease."""
        await self.table.update(
            f"WORK#{key}",
            "META",
            UpdateOptions(set={"state": "abandoned", "lease_until": 0, "gsi1pk": "WORK#abandoned"}),
        )

    async def stale_work(self) -> list[Record]:
        """Units of work whose lease ran out without finishing: the turn crashed or its microVM died."""
        now = self.now_ms()
        return [
            {"key": i["pk"][5:], "message": i.get("message")}
            for i in await self.table.query_index("gsi1", "WORK#started")
            if float(i.get("lease_until", 0)) <= now
        ]

    async def is_work_done(self, key: str) -> bool:
        return (await self.table.get(f"WORK#{key}", "META") or {}).get("state") == "done"

    async def audit_tool(self, agent_id: str, tool: str, decision: str, reason: str) -> None:
        """Every tool call, with the gate's decision. Tool input itself is not stored (it can hold outside content)."""
        at = self._iso()
        await self.table.put(
            {
                "pk": f"TOOL#{agent_id}",
                "sk": f"{at}#{_seq()}",
                "agent": agent_id,
                "tool": tool,
                "decision": decision,
                "reason": reason[:300],
                "at": at,
                "ttl": self.now_ms() // 1000 + 90 * 86_400,
            }
        )

    async def tool_calls(self, agent_id: str) -> list[Record]:
        return [_strip(i) for i in await self.table.query(f"TOOL#{agent_id}")]

    async def add_conversation_line(self, conversation: str, who: Literal["owner", "ace"], text: str) -> None:
        """AIC's conversation: typed and spoken turns share it. Kept 30 days; the prompt uses the last few lines."""
        at = self._iso()
        await self.table.put(
            {
                "pk": f"CONV#{conversation}",
                "sk": f"{at}#{_seq()}",
                "who": who,
                "text": text[:4000],
                "at": at,
                "ttl": self.now_ms() // 1000 + 30 * 86_400,
            }
        )

    async def recent_conversation(self, conversation: str, n: int = 12) -> list[Record]:
        return [_strip(i) for i in (await self.table.query(f"CONV#{conversation}"))[-n:]]

    async def claim(self, key: str, ttl_seconds: int = 86_400) -> bool:
        """True the first time a key is seen (within its TTL), False for a duplicate delivery."""
        return await self.table.put(
            {"pk": f"IDEMP#{key}", "sk": "META", "ttl": self.now_ms() // 1000 + ttl_seconds}, if_not_exists=True
        )
