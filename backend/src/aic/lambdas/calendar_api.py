"""The ``/features`` and ``/calendar/*`` routes (City → Features, ``docs/MAIL_CALENDAR.md`` §12). Owner only,
like every route. Read-only for meetings: nothing here accepts, declines or changes one. Answers ``(status, body)``."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from aic.features import FEATURES, FeatureStore
from aic.features.calendar import CalendarStore
from aic.mail.accounts import AccountStore
from aic.shared.table import Table

Answer = tuple[int, Any]
MAX_DAYS = 62
REFRESH_EVERY_S = 20
_TZ = re.compile(r"^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$")


@dataclass
class CalendarApi:
    table: Table
    now: Callable[[], datetime] = lambda: datetime.now(UTC)
    refresh: Callable[[], Awaitable[None]] | None = None
    """Starts an import now (async-invokes the scheduler Lambda with ``calendar_import``); None = not deployed."""
    claim: Callable[[str, int], Awaitable[bool]] | None = None
    """The ledger's once-only claim, so a double tap starts one import."""


def _err(status: int, message: str, fix: str | None = None) -> Answer:
    return status, {"error": message, "fix": fix}


def _day(v: Any, name: str) -> date:
    try:
        return date.fromisoformat(str(v or "")[:10])
    except ValueError as e:
        raise ValueError(f"{name} must be a date like 2026-11-08.") from e


async def route(
    c: CalendarApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]], q: dict[str, Any]
) -> Answer | None:
    try:
        return await _route(c, method, seg, body, q)
    except ValueError as e:
        return _err(400, str(e))


async def _route(
    c: CalendarApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]], q: dict[str, Any]
) -> Answer | None:
    features = FeatureStore(c.table, c.now)
    if seg == ["features"] and method == "GET":
        return 200, {"features": await features.all()}
    if len(seg) == 2 and seg[0] == "features" and method == "PUT":
        if seg[1] not in FEATURES:
            return _err(404, "That feature doesn't exist.")
        on = body().get("enabled")
        if not isinstance(on, bool):
            return _err(400, "Say enabled: true or false.")
        f = await features.set_enabled(seg[1], on)
        if on and c.refresh:
            await c.refresh()
        return 200, {"feature": f}
    if seg == ["calendar", "events"] and method == "GET":
        start = _day(q.get("from"), "from")
        end = _day(q.get("to"), "to") if q.get("to") else start + timedelta(days=7)
        if end <= start or (end - start).days > MAX_DAYS:
            return _err(400, f"Ask for 1 to {MAX_DAYS} days, with to after from.")
        store = CalendarStore(c.table, c.now)
        tz = str(q.get("tz") or "")
        if tz and len(tz) <= 64 and _TZ.match(tz):
            await store.set_time_zone(tz)  # what AIC answers in ("what's on tomorrow")
        accounts = [
            {k: a.get(k) for k in ("id", "label", "provider", "address", "status", "color")}
            for a in await AccountStore(c.table).all()
            if a.get("calendar", True)
        ]
        return 200, {
            "enabled": await features.enabled("calendar"),
            "events": await store.events(start, end),
            "state": await store.state(),
            "accounts": accounts,
        }
    if seg == ["calendar", "refresh"] and method == "POST":
        if not await features.enabled("calendar"):
            return _err(409, "The Calendar is off.", "Turn it on in City → Features.")
        if c.refresh is None:
            return _err(503, "The calendar import isn't deployed yet.", "It arrives with the next deploy.")
        window = int(c.now().timestamp()) // REFRESH_EVERY_S
        if c.claim is None or await c.claim(f"calendar-refresh:{window}", REFRESH_EVERY_S * 3):
            await c.refresh()
        return 202, {"started": True}
    return None


__all__ = ["CalendarApi", "route"]
