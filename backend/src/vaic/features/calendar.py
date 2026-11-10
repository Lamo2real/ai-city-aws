"""The owner's one calendar: every meeting from every connected account, imported on a schedule, the same meeting
merged across accounts, kept in the ledger (``docs/MAIL_CALENDAR.md`` §12).

Read-only by design: the import reads the providers and the invitation emails; nothing here accepts, declines or
changes a meeting. Rows (``CALENDAR``):

- ``EV#<start>#<id>``: one merged meeting (``start`` is UTC ``…Z``, or a date for a whole day), TTL 120 days after it ends.
- ``ICS#<account>#<uid hash>#<instance hash>``: an invitation read from a plain IMAP inbox (kept, because the
  email is read once), ``IMAP#<account>``: how far that inbox was read, ``STATE``: the last import."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from vaic.mail.joinlinks import find_join
from vaic.shared.events import now_iso
from vaic.shared.log import log
from vaic.shared.table import Table

from . import invites

Json = dict[str, Any]
PK = "CALENDAR"
PAST_DAYS = 31
FUTURE_DAYS = 92
CHUNK_DAYS = 61  # the mail service answers at most 62 days per call
KEEP_DAYS = 120
INVITE_SECONDS = 25.0
_RANK = {"google": 0, "microsoft": 0, "caldav": 1, "imap": 1, "invite": 2}
_PREFIX = re.compile(r"^\s*(fw|fwd|re|aw|wg|sv|updated invitation|invitation|updated|accepted|tentative)\s*:\s*", re.I)


# ---------- normalizing ----------
def utc_key(iso: str, all_day: bool) -> str:
    """The sort and compare form of a time: ``YYYY-MM-DDTHH:MMZ`` in UTC, or ``YYYY-MM-DD`` for a whole day.
    A time without a zone counts as UTC."""
    if all_day or re.fullmatch(r"\d{4}-\d{2}-\d{2}", iso or ""):
        return (iso or "")[:10]
    d = datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=UTC)
    return d.astimezone(UTC).strftime("%Y-%m-%dT%H:%MZ")


def title_key(title: str) -> str:
    t = title or ""
    while (s := _PREFIX.sub("", t)) != t:
        t = s
    return re.sub(r"[\W_]+", "", t.casefold())


def from_provider(ev: Json, account: Json, kind: str | None = None) -> Json | None:
    """One account's event, in the import's shape (``None`` when its times can't be read)."""
    all_day = bool(ev.get("all_day"))
    try:
        start, end = (
            utc_key(str(ev.get("start", "")), all_day),
            utc_key(str(ev.get("end") or ev.get("start", "")), all_day),
        )
    except ValueError:
        return None
    if not start:
        return None
    return {
        "title": str(ev.get("title") or "(no title)")[:300],
        "start": start,
        "end": max(end, start),
        "all_day": all_day,
        "time_zone": str(ev.get("time_zone") or "")[:64],
        "organizer": ev.get("organizer") or {"name": "", "email": ""},
        "attendees": list(ev.get("attendees") or [])[:100],
        "location": str(ev.get("location") or "")[:500],
        "description": str(ev.get("description") or "")[:4000],
        "my_response": ev.get("my_response") or "",
        "recurring": bool(ev.get("recurring")),
        "uid": str(ev.get("uid") or "")[:500],
        "join": find_join(ev.get("join_url"), ev.get("location"), ev.get("description")),
        "sources": [
            {
                "account_id": account["id"],
                "label": account.get("label", ""),
                "address": account.get("address", ""),
                "provider": kind or account.get("provider", ""),
                "event_id": str(ev.get("id", "")),
                "url": ev.get("url") or "",
                "color": account.get("color") or "",
            }
        ],
    }


# ---------- merging the same meeting across accounts ----------
def _org(it: Json) -> str:
    return str((it.get("organizer") or {}).get("email") or "").casefold()


def dedupe(items: list[Json]) -> list[Json]:
    """The same meeting seen in several accounts (or as both a calendar event and an invitation email) becomes one.
    Two items are the same meeting when they share the iCalendar UID and start, or the same title (ignoring
    "Fwd:", "Updated invitation:", case and punctuation), start and end and no different organizers."""
    parent = list(range(len(items)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    by_uid: dict[str, int] = {}
    by_title: dict[str, list[int]] = {}
    for i, it in enumerate(items):
        if it.get("uid"):
            k = f"{it['uid'].casefold()}|{it['start']}"
            if k in by_uid:
                parent[find(i)] = find(by_uid[k])
            else:
                by_uid[k] = i
    for i, it in enumerate(items):
        k = f"{title_key(it['title'])}|{it['start']}|{it['end']}"
        for j in by_title.get(k, []):
            if find(i) != find(j) and (not _org(it) or not _org(items[j]) or _org(it) == _org(items[j])):
                parent[find(i)] = find(j)
        by_title.setdefault(k, []).append(i)
    groups: dict[int, list[Json]] = {}
    for i, it in enumerate(items):
        groups.setdefault(find(i), []).append(it)
    return sorted((_merge(g) for g in groups.values()), key=lambda e: (e["start"], e["title"]))


def _merge(group: list[Json]) -> Json:
    group = sorted(group, key=lambda it: _RANK.get(it["sources"][0]["provider"], 1))
    first = group[0]
    out: Json = {k: v for k, v in first.items() if k != "sources"}
    for it in group[1:]:
        for k in ("time_zone", "location", "description", "my_response", "uid"):
            if not out.get(k) and it.get(k):
                out[k] = it[k]
        if not out.get("join") and it.get("join"):
            out["join"] = it["join"]
        if not _org(out) and _org(it):
            out["organizer"] = it["organizer"]
        out["recurring"] = out["recurring"] or it["recurring"]
    people: dict[str, Json] = {}
    for it in group:
        for a in it.get("attendees") or []:
            people.setdefault(str(a.get("email") or a.get("name") or "").casefold(), a)
    out["attendees"] = list(people.values())[:100]
    sources: list[Json] = []
    for it in group:
        for s in it["sources"]:
            if not any(x["account_id"] == s["account_id"] and x["event_id"] == s["event_id"] for x in sources):
                sources.append(s)
    out["sources"] = sources
    key = (
        f"u:{out['uid'].casefold()}|{out['start']}" if out.get("uid") else f"t:{title_key(out['title'])}|{out['start']}"
    )
    out["id"] = "ev-" + hashlib.sha256(key.encode()).hexdigest()[:16]
    out["color"] = sources[0].get("color", "")
    return out


def _hash(ev: Json) -> str:
    return hashlib.sha256(json.dumps(ev, sort_keys=True, default=str).encode()).hexdigest()[:16]


# ---------- storage ----------
def _months(start: date, end: date) -> list[str]:
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _day(key: str) -> date:
    return date.fromisoformat(key[:10])


def _ttl(ev: Json) -> int:
    end = datetime.combine(_day(ev["end"]), datetime.min.time(), tzinfo=UTC)
    return int((end + timedelta(days=KEEP_DAYS)).timestamp())


class CalendarStore:
    def __init__(self, table: Table, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self.now = now or (lambda: datetime.now(UTC))

    async def rows(self, start: date, end: date) -> list[Json]:
        """Meeting rows starting from a month before ``start`` up to ``end`` (a multi-day meeting is found too)."""
        first = (start.replace(day=1) - timedelta(days=1)).replace(day=1)
        months = _months(first, end)
        got = await asyncio.gather(*(self.table.query(PK, f"EV#{m}") for m in months))
        return [r for rs in got for r in rs]

    async def events(self, start: date, end: date) -> list[Json]:
        """The meetings that overlap ``[start, end)`` (days), sorted."""
        lo, hi = start.isoformat(), end.isoformat()
        out = [
            _public(r)
            for r in await self.rows(start, end)
            if r["start"][:10] < hi and (r["end"] > lo or r["start"][:10] >= lo)
        ]
        return sorted(out, key=lambda e: (e["start"], e["title"]))

    async def state(self) -> Json:
        return _public(await self.table.get(PK, "STATE") or {})

    async def set_time_zone(self, tz: str) -> None:
        cur = await self.table.get(PK, "STATE") or {"pk": PK, "sk": "STATE"}
        if cur.get("time_zone") != tz:
            await self.table.put({**cur, "time_zone": tz})

    async def invites(self) -> list[Json]:
        return await self.table.query(PK, "ICS#")

    async def save_invite(self, account_id: str, v: Json, received_at: str) -> None:
        """Adds or updates one invitation; a CANCEL (or an older SEQUENCE) never revives what a newer one changed."""
        sk = (
            f"ICS#{account_id}#{hashlib.sha256(v['uid'].encode()).hexdigest()[:16]}"
            f"#{hashlib.sha256(str(v.get('recurrence_id') or '').encode()).hexdigest()[:8]}"
        )
        cur = await self.table.get(PK, sk)
        seq = int(v.get("sequence") or 0)
        if cur and int(cur.get("sequence") or 0) > seq:
            return
        keep = {k: v[k] for k in v if k not in ("pk", "sk")}
        row: Json = {"pk": PK, "sk": sk, **keep, "account_id": account_id, "sequence": seq, "received_at": received_at}
        if not v.get("rrule"):
            row["ttl"] = _ttl({"end": utc_key(str(v.get("dtend") or v["dtstart"]), bool(v.get("all_day")))})
        await self.table.put(row)

    async def drop_invites(self, account_id: str) -> None:
        rows = await self.table.query(PK, f"ICS#{account_id}#")
        await self.table.delete_many([(PK, r["sk"]) for r in rows] + [(PK, f"IMAP#{account_id}")])

    async def imap_state(self, account_id: str) -> Json | None:
        return await self.table.get(PK, f"IMAP#{account_id}")

    async def put_imap_state(self, account_id: str, st: Json) -> None:
        await self.table.put({"pk": PK, "sk": f"IMAP#{account_id}", **st})


def _public(r: Json) -> Json:
    return {k: v for k, v in r.items() if k not in ("pk", "sk", "ttl", "h")}


# ---------- the import ----------
def _invite_items(rows: list[Json], accounts: dict[str, Json], w0: datetime, w1: datetime) -> list[Json]:
    """Invitation rows as import items inside the window: repeating ones expanded, cancelled ones left out,
    a moved or cancelled single occurrence (RECURRENCE-ID) replacing that occurrence."""
    rows = [r for r in rows if r.get("account_id") in accounts]
    overrides: dict[str, set[str]] = {}
    for r in rows:
        if r.get("recurrence_id"):
            overrides.setdefault(r["uid"], set()).add(str(r["recurrence_id"]))
    out: list[Json] = []
    for r in rows:
        if r.get("method") == "CANCEL":
            continue
        skip = overrides.get(r["uid"], set()) if not r.get("recurrence_id") else set()
        for i, (s, e) in enumerate(invites.occurrences(r, w0, w1)):
            if s in skip:
                continue
            ev = {
                **r,
                "id": f"{r['uid']}#{i}",
                "title": r.get("summary"),
                "start": s,
                "end": e,
                "time_zone": r.get("tzid"),
                "recurring": bool(r.get("rrule") or r.get("recurrence_id")),
                "url": "",
            }
            it = from_provider(ev, accounts[r["account_id"]], "invite")
            if it:
                out.append(it)
    return out


async def import_calendar(store: CalendarStore, service: Any, bus_put: Any = None) -> Json:
    """Reads every connected calendar account (and the invitation emails of plain IMAP accounts), merges the same
    meeting across accounts, and writes what changed. A failing account keeps its meetings as they were."""
    now = store.now()
    w0 = datetime.combine(now.date() - timedelta(days=PAST_DAYS), datetime.min.time(), tzinfo=UTC)
    w1 = datetime.combine(now.date() + timedelta(days=FUTURE_DAYS), datetime.min.time(), tzinfo=UTC)
    accounts = {a["id"]: a for a in await service.store.connected() if a.get("calendar", True)}
    items: list[Json] = []
    errors: list[Json] = []
    s = w0
    while s < w1:
        e = min(s + timedelta(days=CHUNK_DAYS), w1)
        r = await service.events(_z(s), _z(e))
        for ev in r["events"]:
            a = accounts.get(ev.get("account_id", ""))
            if a and (it := from_provider(ev, a)):
                items.append(it)
        errors += r["errors"]
        s = e
    for a in accounts.values():
        if a.get("provider") != "imap" or not a.get("mail", True):
            continue
        try:
            texts, st = await asyncio.wait_for(
                service.provider(a).invitations(await store.imap_state(a["id"])), INVITE_SECONDS
            )
        except Exception as ex:  # an inbox that can't be read now is tried again next time
            errors.append({"account_id": a["id"], "label": a.get("label", ""), "message": _plain(ex)})
            continue
        for t in texts:
            try:
                for v in invites.parse(t):
                    await store.save_invite(a["id"], v, now_iso(now))
            except Exception as ex:  # one unreadable invitation never stops the others
                log("warn", "calendar.invite_unreadable", account=a["id"], error=type(ex).__name__)
        await store.put_imap_state(a["id"], st)
    rows = await store.invites()
    known = {a["id"] for a in await service.store.all()}
    for gone_account in {str(r.get("account_id")) for r in rows} - known:  # disconnected: its invitations go too
        await store.drop_invites(gone_account)
    items += _invite_items(rows, accounts, w0, w1)
    merged = [
        m for m in dedupe(items) if m["end"][:10] >= w0.date().isoformat() and m["start"][:10] < w1.date().isoformat()
    ]
    written, removed = await _write(
        store, merged, w0.date(), w1.date(), {x["account_id"] for x in errors}, set(accounts)
    )
    state: Json = {
        "last_import_at": now_iso(now),
        "accounts": len(accounts),
        "events": len(merged),
        "errors": errors[:20],
    }
    cur = await store.table.get(PK, "STATE") or {}
    await store.table.put({"pk": PK, "sk": "STATE", **{k: v for k, v in cur.items() if k == "time_zone"}, **state})
    if bus_put and (written or removed):
        await bus_put({"type": "calendar.changed", "calendar_ids": []})  # the HUD reloads the Calendar
    log("info", "calendar.imported", accounts=len(accounts), events=len(merged), written=written, removed=removed,
        failed=len(errors))  # fmt: skip
    return {**state, "written": written, "removed": removed}


async def _write(
    store: CalendarStore, merged: list[Json], lo: date, hi: date, failed: set[str], connected: set[str]
) -> tuple[int, int]:
    existing = {r["sk"]: r for r in await store.rows(lo, hi) if lo.isoformat() <= r["start"][:10] < hi.isoformat()}
    wanted: dict[str, Json] = {}
    for ev in merged:
        wanted[f"EV#{ev['start']}#{ev['id']}"] = ev
    written = 0
    for sk, ev in wanted.items():
        h = _hash(ev)
        if existing.get(sk, {}).get("h") == h:
            continue
        await store.table.put({"pk": PK, "sk": sk, **ev, "h": h, "ttl": _ttl(ev)})
        written += 1
    gone = []
    for sk, r in existing.items():
        if sk in wanted:
            continue
        accts = {s.get("account_id") for s in r.get("sources") or []}
        if accts & failed and accts & connected:
            continue  # its account didn't answer this time: keep it until it does
        gone.append((PK, sk))
    if gone:
        await store.table.delete_many(gone)
    return written, len(gone)


def _z(d: datetime) -> str:
    return d.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _plain(ex: BaseException) -> str:
    if isinstance(ex, TimeoutError):
        return "The inbox took too long to answer."
    return str(ex)[:300] or type(ex).__name__


# ---------- what VAIC reads ----------
def agenda_lines(events: Iterable[Json], tz: Any) -> list[Json]:
    """Meetings in the owner's time zone, short: what VAIC answers "what's on my calendar tomorrow" from."""
    out = []
    for e in events:
        if e.get("all_day"):
            when = {"day": e["start"][:10], "all_day": True}
        else:
            s = datetime.fromisoformat(e["start"].replace("Z", "+00:00")).astimezone(tz)
            en = datetime.fromisoformat(e["end"].replace("Z", "+00:00")).astimezone(tz)
            when = {"start": s.isoformat(timespec="minutes"), "end": en.isoformat(timespec="minutes")}
        row: Json = {
            "title": e["title"],
            **when,
            "location": e.get("location") or "",
            "organizer": (e.get("organizer") or {}).get("name") or (e.get("organizer") or {}).get("email") or "",
            "join": (e.get("join") or {}).get("kind", ""),
            "accounts": [s.get("label") for s in e.get("sources") or []],
        }
        if e.get("my_response"):
            row["my_response"] = e["my_response"]
        out.append(row)
    return out


__all__ = ["CalendarStore", "agenda_lines", "dedupe", "from_provider", "import_calendar", "title_key", "utc_key"]
