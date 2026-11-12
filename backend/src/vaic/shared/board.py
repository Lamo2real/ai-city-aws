"""The project board (decision 289): one shared record per job holding the owner's exact words, the size, the
spec, the parts (department, worker, files, status, result) and timing marks for every stage of the build.

Stage 1 of the migration: the board is written alongside the current chain, as a projection of the city's events
(``project``, called by the ledger writer for every event), so nothing in the chain waits on it. Status questions are
answered from it with no model call (``status_text``). Later stages write parts to it directly.

Storage, in the ledger table under ``BOARD#<task_id>``:
- ``META``: the job (owner's words, goal, size and why, pace, status, conversation, app, result).
- ``PART#<ticket_id>``: one per goal (to a manager) or part (to a worker).
- ``MARK#<at>#<stage>#<edge>#<key>``: one timing mark each, written once (a replayed event writes the same key), so
  parallel events never race on one item. Timings are worked out on read.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from .table import Item, Table

Record = dict[str, Any]
GetTicket = Callable[[str], Awaitable[Record | None]]

STAGES = ("vaic", "sizing", "planning", "spinup", "work", "tests", "review", "publish")
STAGE_WORDS = {
    "vaic": "VAIC handing it over",
    "sizing": "sizing",
    "planning": "planning",
    "spinup": "workers starting",
    "work": "work",
    "tests": "tests",
    "review": "review",
    "publish": "publishing",
}
FINAL = ("done", "failed", "cancelled")
_KEYS = {"pk", "sk"}


def _pk(task_id: str) -> str:
    return f"BOARD#{task_id}"


def _ms(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return int(datetime.fromisoformat(str(iso).replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


def _iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _is_worker(agent_id: Any) -> bool:
    return str(agent_id or "").startswith("wkr-")


class Board:
    def __init__(self, table: Table, get_ticket: GetTicket | None = None) -> None:
        self.table = table
        self._get_ticket = get_ticket

    # ---------- writing ----------
    async def mark(self, task_id: str, stage: str, edge: str, at: str, key: str = "job", ms: int | None = None) -> None:
        """One timing mark: ``edge`` is start, end or dur (a measured duration in ``ms``)."""
        item: Item = {
            "pk": _pk(task_id),
            "sk": f"MARK#{at}#{stage}#{edge}#{key}",
            "stage": stage,
            "edge": edge,
            "key": key,
            "at": at,
        }
        if ms is not None:
            item["ms"] = int(ms)
        await self.table.put(item, if_not_exists=True)

    async def _put_newer(self, pk: str, sk: str, rec: Record, at: str) -> None:
        """Writes ``rec`` unless what is stored came from a later event (events can arrive out of order)."""
        cur = await self.table.get(pk, sk)
        if cur and str(cur.get("at") or "") > at:
            return
        await self.table.put({**(cur or {}), **rec, "pk": pk, "sk": sk, "at": at})

    async def task_of(self, ticket: Record) -> str | None:
        """The job a ticket belongs to: its own ``task_id``, else up its parents (at most a few reads)."""
        if ticket.get("task_id"):
            return str(ticket["task_id"])
        t: Record | None = ticket
        for _ in range(6):
            if t is None:
                return None
            if not t.get("parent_id"):
                return str(t["id"]) if t.get("kind") == "task" else None
            if self._get_ticket is None:
                return None
            t = await self._get_ticket(str(t["parent_id"]))
        return None

    async def project(self, e: Record) -> bool:
        """Folds one city event into its job's board. Returns True when the board changed."""
        t = e.get("type")
        at = str(e.get("at") or "")
        if t == "ticket.status":
            return await self._ticket(e["ticket"], e.get("previous"), at)
        if t == "review.result":
            tk = await self._ticket_by_id(str(e["ticket_id"]))
            task = await self.task_of(tk) if tk else None
            if not task:
                return False
            await self.mark(task, "review", "end", at, str(e["ticket_id"]))
            pk, sk = _pk(task), f"PART#{e['ticket_id']}"
            cur = await self.table.get(pk, sk)
            verdicts = [*((cur or {}).get("verdicts") or []), {"verdict": e["verdict"], "why": e.get("summary", "")}]
            await self.table.put({**(cur or {"pk": pk, "sk": sk, "at": at}), "verdicts": verdicts[-6:]})
            return True
        if t == "build.stage":
            await self.mark(str(e["task_id"]), str(e["stage"]), str(e["edge"]), at, str(e.get("key") or "job"),
                            int(e["ms"]) if e.get("ms") is not None else None)  # fmt: skip
            return True
        if t == "app.submitted":
            await self.mark(str(e["task_id"]), "publish", "start", at, str(e["ticket_id"]))
            await self._files(
                str(e["task_id"]), str(e["ticket_id"]), [str(f.get("path")) for f in e.get("files") or []]
            )
            return True
        if t == "app.draft" and e.get("status") != "staging":
            await self.mark(str(e["task_id"]), "publish", "end", at, str(e["ticket_id"]))
            return True
        if t == "app.preview":
            # Which files a worker touched (decision 278's pointers); the part is found from the worker's hire.
            await self._preview_files(str(e["task_id"]), str(e["hire_id"]), [str(p) for p in e.get("paths") or []])
            return True
        return False

    async def _ticket_by_id(self, id: str) -> Record | None:
        return await self._get_ticket(id) if self._get_ticket else None

    async def _files(self, task: str, part: str, paths: list[str]) -> None:
        pk, sk = _pk(task), f"PART#{part}"
        cur = await self.table.get(pk, sk)
        if cur is None:
            return
        files = sorted({*map(str, cur.get("files") or []), *paths})[:200]
        await self.table.put({**cur, "files": files})

    async def _preview_files(self, task: str, hire: str, paths: list[str]) -> None:
        for p in await self.table.query(_pk(task), "PART#"):
            if p.get("worker") == hire and p.get("status") not in FINAL:
                await self._files(task, str(p["id"]), paths)

    async def _ticket(self, tk: Record, previous: str | None, at: str) -> bool:
        task = await self.task_of(tk)
        if not task:
            return False
        status = str(tk["status"])
        if tk["id"] == task:
            meta: Record = {
                "task_id": task,
                "goal": tk.get("goal", ""),
                "owner_words": tk.get("owner_words") or "",
                "status": status,
                "path": tk.get("path") or "chain",
                "created_at": tk.get("created_at"),
                "updated_at": tk.get("updated_at"),
            }
            if tk.get("path") is None and previous is not None:
                meta.pop("path")  # an event without the field never turns a board job back into a chain one
            for k in ("size", "size_reason", "size_by_owner", "workers", "pace", "conversation", "app_id", "result",
                      "acceptance", "standing_order"):  # fmt: skip
                if tk.get(k) is not None:
                    meta[k] = tk[k]
            await self._put_newer(_pk(task), "META", meta, at)
            if previous is None:
                start = str(tk.get("created_at") or at)
                await self.mark(task, "job", "start", start)
                await self.mark(task, "planning", "start", start)
                if tk.get("sizing_ms") is not None:
                    await self.mark(task, "sizing", "dur", start, ms=int(tk["sizing_ms"]))
                if tk.get("vaic_ms") is not None:
                    await self.mark(task, "vaic", "dur", start, ms=int(tk["vaic_ms"]))
            if status in FINAL:
                await self.mark(task, "job", "end", at)
            return True
        worker = _is_worker(tk.get("to"))
        part: Record = {
            "id": tk["id"],
            "parent_id": tk.get("parent_id"),
            "role": "part" if worker else "goal",
            "department": tk.get("department"),
            "goal": str(tk.get("goal") or "")[:2000],
            "acceptance": str(tk.get("acceptance") or "")[:2000],
            "status": status,
            "review_rounds": tk.get("review_rounds") or 0,
            "created_at": tk.get("created_at"),
            "updated_at": tk.get("updated_at"),
        }
        if worker:
            part["worker"] = tk["to"]
        if tk.get("result"):
            part["result"] = str(tk["result"])[:2000]
        await self._put_newer(_pk(task), f"PART#{tk['id']}", part, at)
        if not worker:
            return True
        key = str(tk["id"])
        if previous is None:
            created = str(tk.get("created_at") or at)
            await self.mark(task, "planning", "end", created)  # the first part handed to a worker ends planning
            await self.mark(task, "spinup", "start", created, key)
        if status == "in_progress" and previous == "open":
            await self.mark(task, "spinup", "end", at, key)
            await self.mark(task, "work", "start", at, key)
        elif status == "in_progress" and previous == "in_review":
            await self.mark(task, "work", "start", at, key)  # fixing after a failed review
        elif status == "in_review":
            await self.mark(task, "work", "end", at, key)
            await self.mark(task, "review", "start", at, key)
        if status in FINAL:
            await self.mark(task, "work", "end", at, key)
            await self.mark(task, "review", "end", at, key)
        return True

    # ---------- reading ----------
    async def read(self, task_id: str) -> Record | None:
        """The whole board of one job: meta, parts and timings; None when the job has no board."""
        items = await self.table.query(_pk(task_id))
        meta = next((i for i in items if i["sk"] == "META"), None)
        if meta is None:
            return None
        parts = sorted(
            ({k: v for k, v in i.items() if k not in _KEYS} for i in items if str(i["sk"]).startswith("PART#")),
            key=lambda p: str(p.get("created_at") or ""),
        )
        marks = [i for i in items if str(i["sk"]).startswith("MARK#")]
        return {
            **{k: v for k, v in meta.items() if k not in _KEYS},
            "parts": parts,
            "timings": timings(marks),
        }


def timings(marks: list[Item]) -> Record:
    """Where the time went: per stage, the wall-clock span from its first start to its last end (``ms``), the time
    summed over parts (``busy_ms``) and how many parts it covered; plus the whole job (``total_ms``). A stage with
    nothing measured is left out."""
    by: dict[tuple[str, str], list[tuple[int, str, int | None]]] = {}
    for m in marks:
        at = _ms(str(m.get("at")))
        if at is None:
            continue
        by.setdefault((str(m["stage"]), str(m["key"])), []).append((at, str(m["edge"]), m.get("ms")))
    out: Record = {}
    spans: dict[str, list[tuple[int, int]]] = {}
    for (stage, _key), ms in by.items():
        ms.sort(key=lambda x: (x[0], 0 if x[1] == "start" else 1))
        open_at: int | None = None
        for at, edge, dur in ms:
            if edge == "dur" and dur is not None:
                spans.setdefault(stage, []).append((at, at + int(dur)))
            elif edge == "start" and open_at is None:
                open_at = at
            elif edge == "end" and open_at is not None:
                spans.setdefault(stage, []).append((open_at, at))
                open_at = None
    job = spans.pop("job", [])
    if job:
        out["total_ms"] = max(e for _, e in job) - min(s for s, _ in job)
        out["started_at"] = _iso(min(s for s, _ in job))
    stages: Record = {}
    for stage in STAGES:
        s = spans.get(stage)
        if not s:
            continue
        stages[stage] = {
            "ms": max(e for _, e in s) - min(b for b, _ in s),
            "busy_ms": sum(e - b for b, e in s),
            "parts": len({k for (st, k) in by if st == stage}),
        }
    out["stages"] = stages
    return out


def say_ms(ms: float) -> str:
    """'2 min 41 s', '8 s', '0.4 s'."""
    s = ms / 1000
    if s < 1:
        return f"{s:.1f} s"
    if s < 60:
        return f"{round(s)} s"
    m, sec = divmod(round(s), 60)
    if m < 60:
        return f"{m} min {sec} s" if sec else f"{m} min"
    h, m = divmod(m, 60)
    return f"{h} h {m} min"


def timing_line(t: Record) -> str:
    """'It took 2 min 41 s: planning 40 s, workers starting 12 s, work 1 min 30 s, review 19 s.'"""
    total = t.get("total_ms")
    parts = [f"{STAGE_WORDS[k]} {say_ms(v['ms'])}" for k, v in (t.get("stages") or {}).items() if v.get("ms")]
    if total is None:
        return ""
    return f"It took {say_ms(total)}" + (f": {', '.join(parts)}." if parts else ".")


_GENERIC = (
    r"(?:status|update|updates|any updates?|any news|news|progress|eta|how far along|"
    r"how(?:'?s| is| are)? (?:it|that|this|things|we|everything|the (?:job|build|app|work|project|game|change))"
    r"(?: (?:going|doing|coming along|looking|getting on))?(?: so far)?|"
    r"is (?:it|that|the (?:job|build|app|change)) (?:done|finished|ready|live)(?: yet)?|"
    r"are (?:you|we|they) (?:done|finished)(?: yet)?|what'?s the (?:status|progress|eta|update)|where are we(?: at)?(?: with it)?|"
    r"how long (?:did it take|is it taking|has it been|will it take)|still (?:working|going|building)(?: on it)?|"
    r"what(?:'?s| is) (?:happening|going on)(?: with it)?)"
)
_ADDR = r"(?:(?:hey |ok |okay )?(?:vaic|vice|sir)[,!]?\s+)?"
_STATUS = re.compile(rf"^{_ADDR}{_GENERIC}(?:,? (?:vaic|vice))?[\s?.!]*$", re.I)
_NAMED = re.compile(
    rf"^{_ADDR}(?:how(?:'?s| is) (?:the |my )?(?P<a>[\w '\-]{{2,40}}?) (?:going|doing|coming along|looking)|"
    r"(?:what'?s the )?(?:status|progress|update) (?:of|on) (?:the |my )?(?P<b>[\w '\-]{2,40}?)|"
    r"is (?:the |my )?(?P<c>[\w '\-]{2,40}?) (?:done|finished|ready|live)(?: yet)?)[\s?.!]*$",
    re.I,
)


def status_question(text: str) -> tuple[bool, str]:
    """Whether the owner's message is only a status question, and the job words in it ("" = whichever is running).
    Only short, plain questions qualify; anything else goes to VAIC's model as before."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    if not s or len(s) > 80 or "\n" in (text or "").strip():
        return False, ""
    if _STATUS.match(s):
        return True, ""
    m = _NAMED.match(s)
    if m:
        what = (m.group("a") or m.group("b") or m.group("c") or "").strip()
        if what.lower() in ("it", "that", "this", "things", "everything", "we"):
            return True, ""
        return True, what
    return False, ""
