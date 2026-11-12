"""The ledger: tickets, turns, costs, departments, agents, hires, specialists, questions, approvals, notes,
reminders and events, in one DynamoDB table.

Every unit of work is a ticket with a status history, so work resumes after any crash. Days are UTC calendar
days. Records are plain dicts with the same keys as before (the HUD reads them through the API).
"""

from __future__ import annotations

import asyncio
import itertools
import re
import time
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from typing import Any, Literal

from .chat_text import no_ids
from .events import now_iso
from .ids import department_key, new_id
from .table import ABSENT, AddLimit, Item, Table, UpdateOptions

RESET_KINDS = frozenset(
    {
        "AGENT",
        "DEPT",
        "TICKET",
        "TURN",
        "TOOL",
        "EVENT",
        "CONV",
        "Q",
        "APPROVAL",
        "WORK",
        "APPDRAFTS",
        "SLOTS",
        "IDEMP",
        "RATE",
        "STEWARD",
        "EXECREC",
        "LOT",
        "BOARD",
    }
)
"""The key kinds (the part of ``pk`` before ``#``) that ``Ledger.reset_city`` removes. Anything else is kept."""

Record = dict[str, Any]
TurnKind = Literal[
    "vaic", "orchestrator", "manager", "worker", "utility", "compaction", "eval", "chief_of_staff", "executive"
]
TURN_KINDS: tuple[TurnKind, ...] = (
    "vaic",
    "orchestrator",
    "manager",
    "worker",
    "utility",
    "compaction",
    "eval",
    "chief_of_staff",
    "executive",
)


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
    async def create_department(
        self, name: str, mission: str, manager_id: str, extra: Record | None = None
    ) -> tuple[Record, bool]:
        """Creates the department, or returns the one already there (``False``), demolished ones included."""
        key = department_key(name)
        dept: Record = {
            "key": key,
            "name": name.strip(),
            "mission": mission,
            "manager_id": manager_id,
            "state": "active",
            "created_at": self._iso(),
            **(extra or {}),
        }
        created = await self.table.put(
            {"pk": f"DEPT#{key}", "sk": "META", "gsi1pk": "DEPT", "gsi1sk": dept["created_at"], **dept},
            if_not_exists=True,
        )
        if created:
            return {**dept, **await self.claim_lot(key)}, True
        existing = await self.get_department(name)
        assert existing is not None
        return existing, False

    async def get_department(self, name: str) -> Record | None:
        return strip(await self.table.get(f"DEPT#{department_key(name)}", "META"))

    async def stand_down_department(self, name: str, down: bool = True) -> None:
        """The owner sent everyone home: the department hires and assigns nothing until a new goal arrives
        (`down=False` clears it, which a new job on the board does)."""
        await self.table.update(
            f"DEPT#{department_key(name)}",
            "META",
            UpdateOptions(set={"stood_down_at": self._iso() if down else ""}),
        )

    async def list_departments(self, include_demolished: bool = False) -> list[Record]:
        """The standing departments; ``include_demolished`` adds the ones the owner demolished (kept as history)."""
        rows = [_strip(i) for i in await self.table.query_index("gsi1", "DEPT")]
        return rows if include_demolished else [r for r in rows if r.get("state") != "demolished"]

    async def demolish_department(self, name: str) -> None:
        """The record stays (history, and so a demolished preset is not put back by ``ensure_presets``). Its lot
        in the City stands empty until another department takes it (decision 248); its ``slot`` stays on the
        record, so a rebuild goes back to the same lot if it is still free."""
        await self.table.update(
            f"DEPT#{department_key(name)}",
            "META",
            UpdateOptions(set={"state": "demolished", "demolished_at": self._iso()}),
        )
        await self.release_lot(department_key(name))

    async def rebuild_department(self, name: str, mission: str, extra: Record | None = None) -> Record:
        """A demolished department built again by the owner: standing, with its new mission and choices."""
        it = await self.table.update(
            f"DEPT#{department_key(name)}",
            "META",
            UpdateOptions(
                set={
                    "state": "active",
                    "mission": mission,
                    "demolished_at": "",
                    "stood_down_at": "",
                    "rebuilt_at": self._iso(),
                    "worker_model": (extra or {}).get("worker_model") or "",
                    **{k: v for k, v in (extra or {}).items() if k != "worker_model"},
                },
                must_exist=True,
            ),
        )
        if it is None:
            raise KeyError(f"no department {name}")
        rec = _strip(it)
        prefer = rec.get("slot")
        return {**rec, **await self.claim_lot(rec["key"], int(prefer) if prefer is not None else None)}

    # ---------- the City's lots (decision 248) ----------
    # Every tower stands on a lot of its own, numbered from 0, for good: lot n is always the same block of the City's
    # grid; the City places the lots nearest HQ first, with a seeded jitter (decisions 250, 259). A department takes a lot once, when it is built; demolishing it leaves the lot empty
    # (a FREE LOT) until a new department takes it, so no tower, road or home ever moves. A lot's footprint is fixed
    # with it: ``size`` is the name the City sizes it by (the department that stood there when the lots were first
    # numbered), "" for every lot opened later (the City sizes those by their number).
    async def list_lots(self) -> list[Record]:
        return sorted(
            ({**_strip(i), "slot": int(i["slot"])} for i in await self.table.query_index("gsi1", "LOT")),
            key=lambda lot: lot["slot"],
        )

    def _lot_item(self, slot: int, holder: str, size: str) -> Item:
        return {
            "pk": f"LOT#{slot:05d}",
            "sk": "META",
            "gsi1pk": "LOT",
            "gsi1sk": f"{slot:05d}",
            "slot": slot,
            "holder": holder,
            "size": size,
        }

    async def _set_slot(self, key: str, slot: int) -> None:
        await self.table.update(f"DEPT#{key}", "META", UpdateOptions(set={"slot": slot}, must_exist=True))

    async def ensure_lots(self) -> list[Record]:
        """The lots, numbered for the first time if they never were: the standing departments in the order the
        City has always drawn them (oldest first), each lot as big as its tower. Then any standing department
        without a lot (built by an older version) takes one. Safe to run twice at once: the same numbers come out."""
        lots = await self.ensure_lots_numbered()
        held = {str(lot.get("holder")) for lot in lots}
        standing = sorted(await self.list_departments(), key=lambda r: str(r.get("created_at", "")))
        missing = [dep for dep in standing if str(dep["key"]) not in held]
        for dep in missing:
            await self.claim_lot(str(dep["key"]))
        return await self.list_lots() if missing else lots

    async def claim_lot(self, key: str, prefer: int | None = None) -> Record:
        """The department's lot: the one it holds, else ``prefer`` (its old lot) if free, else the first free lot,
        else a new one at the edge (a new row of the City). Returns ``{"slot", "lot"}`` (``lot``: its size name)."""
        for _ in range(20):  # another department claiming at the same moment: read again and retry
            lots = await self.ensure_lots_numbered()
            by_slot = {lot["slot"]: lot for lot in lots}
            mine = next((lot for lot in lots if lot.get("holder") == key), None)
            if mine:
                await self._set_slot(key, mine["slot"])
                return {"slot": mine["slot"], "lot": str(mine.get("size") or "")}
            top = max(by_slot, default=-1) + 1
            # The town's lots are the ones ever numbered (decision 259): the City lays them out nearest HQ first, so
            # the lowest free one is the most central; with none free, the next new lot.
            n = top
            free = [s for s in range(n) if not (by_slot.get(s) or {}).get("holder")]
            order = ([prefer] if prefer is not None and prefer in free else []) + free + [n]
            for s in dict.fromkeys(order):
                if s in by_slot:
                    ok = (
                        await self.table.update(
                            f"LOT#{s:05d}", "META", UpdateOptions(set={"holder": key}, expect={"holder": ""})
                        )
                        is not None
                    )
                    size = str(by_slot[s].get("size") or "")
                else:
                    ok = await self.table.put(self._lot_item(s, key, ""), if_not_exists=True)
                    size = ""
                if ok:
                    await self._set_slot(key, s)
                    return {"slot": s, "lot": size}
        raise RuntimeError(f"no lot for department {key}")

    async def ensure_lots_numbered(self) -> list[Record]:
        """The lots, after the first numbering (``ensure_lots`` without claiming for anyone)."""
        lots = await self.list_lots()
        if lots:
            return lots
        standing = sorted(await self.list_departments(), key=lambda r: str(r.get("created_at", "")))
        for i, dep in enumerate(standing):
            await self.table.put(self._lot_item(i, str(dep["key"]), str(dep["name"])), if_not_exists=True)
            await self._set_slot(str(dep["key"]), i)
        return await self.list_lots()

    async def release_lot(self, key: str) -> None:
        """The demolished department's lot stands empty, and saplings grow there from ``freed_at`` (decision 259):
        nothing else changes."""
        for lot in await self.list_lots():
            if lot.get("holder") == key:
                await self.table.update(
                    f"LOT#{lot['slot']:05d}",
                    "META",
                    UpdateOptions(set={"holder": "", "freed_at": self._iso()}, expect={"holder": key}),
                )

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

    async def withdraw_question(self, id: str) -> Record | None:
        """Closes an open question nobody needs answered any more (its job stopped or finished)."""
        it = await self.table.update(
            f"Q#{id}",
            "META",
            UpdateOptions(set={"status": "withdrawn", "gsi1pk": "Q#withdrawn"}, expect={"status": "open"}),
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

    async def withdraw_approval(self, id: str) -> Record | None:
        """Closes a pending approval whose job stopped or finished: the action will never run."""
        it = await self.table.update(
            f"APPROVAL#{id}",
            "META",
            UpdateOptions(set={"status": "withdrawn", "gsi1pk": "APPROVAL#withdrawn"}, expect={"status": "pending"}),
        )
        return strip(it)

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
    async def acquire_worker_slot(
        self, department: str, per_dept: int | None = None, global_: int | None = None
    ) -> bool:
        """Takes a worker slot in the department and globally, or returns False when a ceiling is reached. The city
        sets no ceiling any more (decision 288): the counts only feed "workers busy"."""
        if per_dept is None and global_ is None:
            await self.table.update("SLOTS", "GLOBAL", UpdateOptions(add={"active": 1}))
            await self.table.update("SLOTS", f"DEPT#{department_key(department)}", UpdateOptions(add={"active": 1}))
            return True
        assert per_dept is not None and global_ is not None
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

    # ---------- the owner's "start over" ----------
    async def reset_city(self, budget_s: float | None = None) -> dict[str, Any]:
        """Empties the city: every agent (VAIC and the Orchestrator are recreated on the next message),
        department, ticket with its history, turn, tool call, event, conversation line, question, approval,
        work lease, app draft, worker-slot counter, idempotency key and rate record. Everything the owner set
        up stays: settings (CONFIG), spend history, devices, connectors, skills, knowledge, apps and their
        state, mail, notes, reminders, specialists, voice and notification flags.

        Works page by page and stops after ``budget_s`` seconds (a Lambda has 30; the first reset of a
        400-agent city ran out of time halfway and left three departments standing). Returns ``gone`` (what
        went, per kind) and ``done``: ``False`` means "call again, there is more", and every call picks up
        where the table stands now."""
        started = time.monotonic()
        counts: dict[str, int] = {}
        start: Any = None
        while True:
            keys, start = await self.table.scan_keys(start)
            gone = [(pk, sk) for pk, sk in keys if pk.split("#", 1)[0] in RESET_KINDS]
            if gone:
                await self.table.delete_many(gone)
            for pk, _ in gone:
                kind = pk.split("#", 1)[0]
                counts[kind] = counts.get(kind, 0) + 1
            if start is None:
                return {"gone": dict(sorted(counts.items())), "done": True}
            if budget_s is not None and time.monotonic() - started >= budget_s:
                return {"gone": dict(sorted(counts.items())), "done": False}

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
            "slot_released": False,
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

    async def worker_turn_ended(self, key: str, failed: bool) -> None:
        """The worker's turn is over and its slot is given back, so the crash sweep must not give it back again.

        A failed turn also ends its lease now: the sweep sends it again within minutes, not after the long lease.
        """
        s: Record = {"slot_released": True}
        if failed:
            s.update(lease_until=0, gsi1sk="0")
        await self.table.update(
            f"WORK#{key}", "META", UpdateOptions(set=s, must_exist=True, expect={"state": "started"})
        )

    async def stale_work(self) -> list[Record]:
        """Units of work whose lease ran out without finishing: the turn crashed or its microVM died."""
        now = self.now_ms()
        return [
            {"key": i["pk"][5:], "message": i.get("message"), "slot_released": bool(i.get("slot_released"))}
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

    async def add_conversation_line(self, conversation: str, who: Literal["owner", "vaic"], text: str) -> None:
        """VAIC's conversation: typed and spoken turns share it. Kept 30 days; the prompt uses the last few lines."""
        at = self._iso()
        await self.table.put(
            {
                "pk": f"CONV#{conversation}",
                "sk": f"{at}#{_seq()}",
                "who": who,
                "text": (no_ids(text) if who == "vaic" else text)[:4000],
                "at": at,
                # A project's chat (``app-…``) is the project's record and stays (decision 299).
                **({} if conversation.startswith("app-") else {"ttl": self.now_ms() // 1000 + 30 * 86_400}),
            }
        )

    async def conversation_lines(self, conversation: str, n: int = 200) -> list[Record]:
        """The last ``n`` lines of a conversation for the owner's devices: ``id`` (the sort key), who, text, at."""
        out: list[Record] = []
        for i in (await self.table.query(f"CONV#{conversation}"))[-n:]:
            if i.get("who") not in ("owner", "vaic") or not str(i.get("text") or "").strip():
                continue
            out.append({"id": str(i["sk"]), "who": i["who"], "text": str(i["text"]), "at": str(i.get("at") or "")})
        return out

    async def import_conversation_lines(self, conversation: str, lines: list[Record]) -> int:
        """Lines a device kept before chats lived here (decision 299). The sort key comes from the line's own time
        and id, so uploading the same line twice writes it once."""
        n = 0
        for line in lines[:200]:
            who = "vaic" if line.get("who") in ("vaic", "ace") else "owner" if line.get("who") == "owner" else None
            text = line.get("text")
            at, id = line.get("at"), line.get("id")
            if not who or not isinstance(text, str) or not text.strip():
                continue
            if not isinstance(at, int) or at <= 0 or not isinstance(id, str) or not re.fullmatch(r"[\w-]{1,64}", id):
                continue
            iso = now_iso(datetime.fromtimestamp(at / 1000, UTC))
            item: Record = {
                "pk": f"CONV#{conversation}",
                "sk": f"{iso}#c-{id}",
                "who": who,
                "text": (no_ids(text) if who == "vaic" else text)[:4000],
                "at": iso,
            }
            if not conversation.startswith("app-"):
                item["ttl"] = at // 1000 + 30 * 86_400
            await self.table.put(item)
            n += 1
        return n

    async def save_project(self, key: str, idea: str, title: str, at: int) -> Record:
        """A project the owner started that isn't published yet (decision 299): one record per project."""
        rec: Record = {"key": key, "idea": idea[:2000], "title": title[:40], "at": at}
        await self.table.put({"pk": "PROJECTS", "sk": key, **rec})
        return rec

    async def projects(self) -> list[Record]:
        return [
            {"key": i["sk"], "idea": i.get("idea", ""), "title": i.get("title", ""), "at": int(i.get("at") or 0)}
            for i in await self.table.query("PROJECTS")
        ]

    async def remove_project(self, key: str) -> bool:
        return await self.table.delete_if_exists("PROJECTS", key)

    async def recent_conversation(self, conversation: str, n: int = 12) -> list[Record]:
        return [_strip(i) for i in (await self.table.query(f"CONV#{conversation}"))[-n:]]

    async def stop_turn(self, message_id: str) -> None:
        """The owner pressed Stop on a message to VAIC: its turn is dropped (decision 183). Kept a day."""
        await self.table.put({"pk": f"STOP#{message_id}", "sk": "META", "ttl": self.now_ms() // 1000 + 86_400})

    async def turn_stopped(self, message_id: str) -> bool:
        return await self.table.get(f"STOP#{message_id}", "META") is not None

    async def claim(self, key: str, ttl_seconds: int = 86_400) -> bool:
        """True the first time a key is seen (within its TTL), False for a duplicate delivery."""
        return await self.table.put(
            {"pk": f"IDEMP#{key}", "sk": "META", "ttl": self.now_ms() // 1000 + ttl_seconds}, if_not_exists=True
        )

    async def unclaim(self, key: str) -> None:
        """Gives a claim back, so the next delivery of the same thing runs (it failed before doing anything)."""
        await self.table.delete(f"IDEMP#{key}", "META")
