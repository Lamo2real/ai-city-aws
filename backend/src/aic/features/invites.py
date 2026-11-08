"""Meeting invitations that arrive by email as ``.ics`` (plain IMAP accounts), read into calendar events.

``parse`` turns an iCalendar text into invitation records (with the METHOD: REQUEST/PUBLISH add or update,
CANCEL removes). ``occurrences`` expands a repeating invitation (RRULE: DAILY, WEEKLY with BYDAY, MONTHLY by day
of month or by weekday like "2TU", YEARLY; INTERVAL, COUNT, UNTIL; EXDATE) into the import window, in the
invitation's own time zone, so a weekly 9:00 stays at 9:00 across daylight-saving changes."""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

from aic.mail.providers.caldav import parse_ics, zone

Json = dict[str, Any]
MAX_OCCURRENCES = 400
_WEEKDAYS = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
_METHOD = re.compile(r"^METHOD:\s*(\w+)", re.M | re.I)


def parse(text: str) -> list[Json]:
    """The VEVENTs of one invitation with its METHOD (upper case, REQUEST when absent)."""
    m = _METHOD.search(text or "")
    method = m.group(1).upper() if m else "REQUEST"
    out = []
    for v in parse_ics(text):
        if not v.get("uid") or not v.get("dtstart"):
            continue
        status = str(v.get("status") or "").upper()
        out.append({**v, "method": "CANCEL" if status == "CANCELLED" else method})
    return out


def _start_local(v: Json) -> datetime | date:
    raw = str(v.get("dtstart_raw") or "")
    if v.get("all_day"):
        return date.fromisoformat(str(v["dtstart"])[:10])
    if raw.endswith("Z") or not v.get("tzid"):
        return datetime.fromisoformat(str(v["dtstart"]).replace("Z", "+00:00"))
    naive = datetime.strptime(raw, "%Y%m%dT%H%M%S")
    return naive.replace(tzinfo=zone(str(v["tzid"])))


def _iso(d: datetime | date) -> str:
    if isinstance(d, datetime):
        return d.astimezone(UTC).isoformat().replace("+00:00", "Z")
    return d.isoformat()


def _rule(text: str) -> dict[str, str]:
    return dict(p.split("=", 1) for p in (text or "").split(";") if "=" in p)


def _until(v: str, tz: Any) -> datetime | date | None:
    if not v:
        return None
    if re.fullmatch(r"\d{8}", v):
        return date(int(v[:4]), int(v[4:6]), int(v[6:8]))
    d = datetime.strptime(v.rstrip("Z"), "%Y%m%dT%H%M%S")
    return d.replace(tzinfo=UTC if v.endswith("Z") else tz)


def _add_months(y: int, m: int, n: int) -> tuple[int, int]:
    t = y * 12 + (m - 1) + n
    return t // 12, t % 12 + 1


def _nth_weekday(y: int, m: int, wd: int, n: int) -> int | None:
    """The day of month of the n-th (1-based, negative from the end) weekday ``wd`` in a month."""
    first = date(y, m, 1)
    nxt_y, nxt_m = _add_months(y, m, 1)
    days = (date(nxt_y, nxt_m, 1) - first).days
    hits = [d for d in range(1, days + 1) if date(y, m, d).weekday() == wd]
    if not hits or abs(n) > len(hits):
        return None
    return hits[n - 1] if n > 0 else hits[n]


def _days_in(y: int, m: int) -> int:
    ny, nm = _add_months(y, m, 1)
    return (date(ny, nm, 1) - date(y, m, 1)).days


def _candidates(start: datetime | date, rule: dict[str, str]) -> Iterator[datetime | date]:
    """Every occurrence of the rule from the start, in order (unbounded; the caller stops)."""
    freq = rule.get("FREQ", "").upper()
    step = max(1, int(rule.get("INTERVAL", "1") or 1))
    byday = [x for x in rule.get("BYDAY", "").upper().split(",") if x]
    bymonthday = [int(x) for x in rule.get("BYMONTHDAY", "").split(",") if x.lstrip("-").isdigit()]

    def at(d: date) -> datetime | date:
        if isinstance(start, datetime):
            return datetime.combine(d, start.timetz().replace(tzinfo=None)).replace(tzinfo=start.tzinfo)
        return d

    day0 = start.date() if isinstance(start, datetime) else start
    if freq == "DAILY":
        i = 0
        while True:
            yield at(day0 + timedelta(days=i * step))
            i += 1
    elif freq == "WEEKLY":
        wds = sorted({_WEEKDAYS.index(x[-2:]) for x in byday if x[-2:] in _WEEKDAYS}) or [day0.weekday()]
        monday = day0 - timedelta(days=day0.weekday())
        w = 0
        while True:
            for wd in wds:
                d = monday + timedelta(weeks=w * step, days=wd)
                if d >= day0:
                    yield at(d)
            w += 1
    elif freq == "MONTHLY":
        k = 0
        while True:
            y, m = _add_months(day0.year, day0.month, k * step)
            days: list[int] = []
            if byday:
                for x in byday:
                    mm = re.fullmatch(r"([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)", x)
                    if mm:
                        n = int(mm.group(1) or 0)
                        wd = _WEEKDAYS.index(mm.group(2))
                        if n:
                            if (nd := _nth_weekday(y, m, wd, n)) is not None:
                                days.append(nd)
                        else:
                            days += [x2 for x2 in range(1, _days_in(y, m) + 1) if date(y, m, x2).weekday() == wd]
            else:
                for md in bymonthday or [day0.day]:
                    md2 = md if md > 0 else _days_in(y, m) + md + 1
                    if 1 <= md2 <= _days_in(y, m):
                        days.append(md2)
            for dom in sorted(set(days)):
                if date(y, m, dom) >= day0:
                    yield at(date(y, m, dom))
            k += 1
    elif freq == "YEARLY":
        k = 0
        while True:
            y = day0.year + k * step
            if day0.month != 2 or day0.day != 29 or _days_in(y, 2) == 29:
                yield at(date(y, day0.month, day0.day))
            k += 1
    else:
        yield start


def occurrences(v: Json, w0: datetime, w1: datetime) -> list[tuple[str, str]]:
    """``(start, end)`` ISO pairs (UTC ``Z``, or dates for whole days) of an invitation inside the window."""
    try:
        start = _start_local(v)
        end_iso = str(v.get("dtend") or v["dtstart"])
        if v.get("all_day"):
            dur: timedelta = date.fromisoformat(end_iso[:10]) - date.fromisoformat(str(v["dtstart"])[:10])
        else:
            dur = datetime.fromisoformat(end_iso.replace("Z", "+00:00")) - datetime.fromisoformat(
                str(v["dtstart"]).replace("Z", "+00:00")
            )
        dur = max(dur, timedelta(0))
        rule = _rule(str(v.get("rrule") or ""))
        tz = start.tzinfo if isinstance(start, datetime) else None
        until = _until(rule.get("UNTIL", ""), tz)
        count = int(rule["COUNT"]) if rule.get("COUNT", "").isdigit() else None
    except (ValueError, KeyError, TypeError):
        return []
    skip = set(v.get("exdate") or [])
    lo, hi = w0.date(), w1.date()
    out: list[tuple[str, str]] = []
    seen = 0
    for occ in _candidates(start, rule) if rule else iter([start]):
        seen += 1
        if count is not None and seen > count:
            break
        if until is not None and _cmp_key(occ) > _cmp_key(until):
            break
        occ_day = occ.date() if isinstance(occ, datetime) else occ
        if occ_day > hi or seen > 20_000:
            break
        end = occ + dur
        end_day = end.date() if isinstance(end, datetime) else end
        if end_day < lo or _iso(occ) in skip:
            continue
        out.append((_iso(occ), _iso(end)))
        if len(out) >= MAX_OCCURRENCES:
            break
    return out


def _cmp_key(d: datetime | date) -> datetime:
    if isinstance(d, datetime):
        return d.astimezone(UTC)
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=UTC)


__all__ = ["occurrences", "parse"]
