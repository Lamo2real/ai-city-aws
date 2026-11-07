"""CalDAV over HTTPS with an app password: list calendars, read a time range, create, update and delete
events (``docs/MAIL_CALENDAR.md`` §1). A small iCalendar reader/writer is included, so no extra package is
needed in the Lambda zip. Answering invitations over CalDAV (iTIP) isn't supported: the tool says so."""

from __future__ import annotations

import base64
import re
import urllib.parse
import uuid
import xml.etree.ElementTree as ET
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from ..http import Http, ProviderError, call
from .base import Json, addr, event

NS = {"d": "DAV:", "c": "urn:ietf:params:xml:ns:caldav", "a": "http://apple.com/ns/ical/"}


def unfold(text: str) -> list[str]:
    out: list[str] = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        elif line:
            out.append(line)
    return out


def _unescape(v: str) -> str:
    return v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace(r"\;", ";").replace("\\\\", "\\")


def _escape(v: str) -> str:
    return v.replace("\\", "\\\\").replace(";", r"\;").replace(",", "\\,").replace("\n", "\\n")


def _when(params: dict[str, str], value: str) -> tuple[str, bool]:
    """An ISO string (UTC with ``Z`` when the time has a zone) and whether it's a whole day."""
    if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
        return date(int(value[:4]), int(value[4:6]), int(value[6:8])).isoformat(), True
    d = datetime.strptime(value.rstrip("Z"), "%Y%m%dT%H%M%S")
    if value.endswith("Z"):
        d = d.replace(tzinfo=UTC)
    elif params.get("TZID"):
        try:
            d = d.replace(tzinfo=ZoneInfo(params["TZID"]))
        except Exception:
            d = d.replace(tzinfo=UTC)
    else:
        return d.isoformat(), False
    return d.astimezone(UTC).isoformat().replace("+00:00", "Z"), False


def parse_ics(text: str) -> list[Json]:
    """The VEVENTs of an iCalendar text, as plain fields."""
    events: list[Json] = []
    cur: dict[str, Any] | None = None
    depth = 0
    for line in unfold(text):
        name, _, value = line.partition(":")
        key, *ps = name.split(";")
        params = dict(p.split("=", 1) for p in ps if "=" in p)
        key = key.upper()
        if key == "BEGIN" and value.upper() == "VEVENT":
            cur, depth = {"attendees": []}, 0
            continue
        if cur is None:
            continue
        if key == "BEGIN":
            depth += 1
        elif key == "END" and depth:
            depth -= 1
        elif key == "END" and value.upper() == "VEVENT":
            events.append(cur)
            cur = None
            continue
        if depth:
            continue
        if key in ("DTSTART", "DTEND"):
            cur[key.lower()], cur["all_day"] = _when(params, value)
        elif key in ("SUMMARY", "LOCATION", "DESCRIPTION", "UID"):
            cur[key.lower()] = _unescape(value)
        elif key == "ORGANIZER":
            cur["organizer"] = addr(
                params.get("CN", "").strip('"'), value.removeprefix("mailto:").removeprefix("MAILTO:")
            )
        elif key == "ATTENDEE":
            cur["attendees"].append(
                {
                    **addr(params.get("CN", "").strip('"'), value.removeprefix("mailto:").removeprefix("MAILTO:")),
                    "response": params.get("PARTSTAT", "").lower(),
                }
            )
        elif key in ("RRULE", "RECURRENCE-ID"):
            cur["recurring"] = True
    return events


def _ics_time(iso: str, all_day: bool) -> str:
    if all_day:
        return ";VALUE=DATE:" + iso[:10].replace("-", "")
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=UTC)
    return ":" + d.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def build_ics(uid: str, f: Json) -> str:
    all_day = bool(f.get("all_day"))
    end = f.get("end") or f["start"]
    if all_day and end[:10] == f["start"][:10]:
        end = (date.fromisoformat(f["start"][:10]) + timedelta(days=1)).isoformat()
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AI City//EN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        "DTSTAMP" + _ics_time(datetime.now(UTC).isoformat(), False),
        "DTSTART" + _ics_time(f["start"], all_day),
        "DTEND" + _ics_time(end, all_day),
        f"SUMMARY:{_escape(f.get('title', ''))}",
    ]
    if f.get("location"):
        lines.append(f"LOCATION:{_escape(f['location'])}")
    if f.get("description"):
        lines.append(f"DESCRIPTION:{_escape(f['description'])}")
    for a in f.get("attendees") or []:
        lines.append(f"ATTENDEE;RSVP=TRUE:mailto:{a if isinstance(a, str) else a['email']}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(lines) + "\r\n"


class CalDav:
    def __init__(self, http: Http, url: str, username: str, password: Callable[[], Awaitable[str]]) -> None:
        if not url.startswith("https://"):
            raise ProviderError("The CalDAV address must start with https://.")
        self.http = http
        self.url = url.rstrip("/") + "/"
        self.username = username
        self.password = password

    async def _auth(self) -> dict[str, str]:
        tok = base64.b64encode(f"{self.username}:{await self.password()}".encode()).decode()
        return {"Authorization": f"Basic {tok}"}

    async def _dav(
        self,
        method: str,
        url: str,
        xml: str = "",
        depth: str | None = None,
        extra: dict[str, str] | None = None,
        raw: bytes | None = None,
    ) -> Any:
        h = await self._auth()
        if depth is not None:
            h["Depth"] = depth
        if xml:
            h["Content-Type"] = "application/xml; charset=utf-8"
        h.update(extra or {})
        return await call(self.http, method, url, None, headers=h, raw=raw if raw is not None else xml.encode())

    def _abs(self, href: str) -> str:
        return urllib.parse.urljoin(self.url, href)

    async def calendars(self) -> list[Json]:
        body = (
            '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:a="http://apple.com/ns/ical/">'
            "<d:prop><d:resourcetype/><d:displayname/><a:calendar-color/>"
            "<d:current-user-privilege-set/></d:prop></d:propfind>"
        )
        text = await self._dav("PROPFIND", self.url, body, depth="1")
        out = []
        for r in ET.fromstring(str(text)).findall("d:response", NS):  # noqa: S314
            href = r.findtext("d:href", "", NS)
            if r.find(".//d:resourcetype/c:calendar", NS) is None:
                continue
            privs = ET.tostring(r.find(".//d:current-user-privilege-set", NS) or ET.Element("x"), encoding="unicode")
            out.append(
                {
                    "id": self._abs(href),
                    "name": r.findtext(".//d:displayname", "", NS) or href.rstrip("/").rsplit("/", 1)[-1],
                    "color": (r.findtext(".//a:calendar-color", "", NS) or None),
                    "writable": ("write" in privs) or not privs.strip("<x />"),
                    "primary": False,
                }
            )
        if out:
            out[0]["primary"] = True
        return out

    async def events(self, start: str, end: str, calendar_ids: list[str] | None, query: str | None) -> list[Json]:
        def z(iso: str) -> str:
            d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            return (d if d.tzinfo else d.replace(tzinfo=UTC)).astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")

        body = (
            '<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            '<d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR">'
            f'<c:comp-filter name="VEVENT"><c:time-range start="{z(start)}" end="{z(end)}"/></c:comp-filter>'
            "</c:comp-filter></c:filter></c:calendar-query>"
        )
        cals = calendar_ids or [c["id"] for c in await self.calendars()]
        out: list[Json] = []
        for cal in cals:
            text = await self._dav("REPORT", cal, body, depth="1")
            for r in ET.fromstring(str(text)).findall("d:response", NS):  # noqa: S314
                href = self._abs(r.findtext("d:href", "", NS))
                for e in parse_ics(r.findtext(".//c:calendar-data", "", NS)):
                    ev = self._event(href, cal, e)
                    if not query or query.lower() in (ev["title"] + " " + ev["description"]).lower():
                        out.append(ev)
        return out

    @staticmethod
    def _event(href: str, cal: str, e: Json) -> Json:
        return event(
            id=href,
            calendar_id=cal,
            title=e.get("summary"),
            start=e.get("dtstart", ""),
            end=e.get("dtend", ""),
            all_day=e.get("all_day"),
            location=e.get("location"),
            description=e.get("description"),
            organizer=e.get("organizer"),
            attendees=e.get("attendees"),
            recurring=e.get("recurring"),
        )

    async def _get(self, href: str) -> tuple[Json, str]:
        text = await self._dav("GET", href)
        events = parse_ics(str(text))
        if not events:
            raise ProviderError("That event is gone.")
        return events[0], href.rsplit("/", 1)[0] + "/"

    async def get_event(self, id: str) -> Json:
        e, cal = await self._get(id)
        return self._event(id, cal, e)

    async def create_event(self, calendar_id: str, f: Json) -> Json:
        uid = f"{uuid.uuid4()}@aicity"
        href = calendar_id.rstrip("/") + f"/{uid}.ics"
        await self._dav(
            "PUT",
            href,
            extra={"Content-Type": "text/calendar; charset=utf-8", "If-None-Match": "*"},
            raw=build_ics(uid, f).encode(),
        )
        return self._event(
            href,
            calendar_id,
            {
                "summary": f.get("title"),
                "dtstart": f["start"],
                "dtend": f.get("end"),
                "all_day": f.get("all_day"),
                "location": f.get("location"),
                "description": f.get("description"),
            },
        )

    async def update_event(self, id: str, f: Json) -> Json:
        e, _cal = await self._get(id)
        merged = {
            "title": e.get("summary", ""),
            "start": e.get("dtstart"),
            "end": e.get("dtend"),
            "all_day": e.get("all_day"),
            "location": e.get("location"),
            "description": e.get("description"),
            "attendees": [a["email"] for a in e.get("attendees", [])],
        }
        merged.update({k: v for k, v in f.items() if v is not None})
        await self._dav(
            "PUT",
            id,
            extra={"Content-Type": "text/calendar; charset=utf-8"},
            raw=build_ics(e.get("uid") or str(uuid.uuid4()), merged).encode(),
        )
        return await self.get_event(id)

    async def respond(self, id: str, response: str, comment: str | None) -> None:
        raise ProviderError("Answering invitations isn't supported for CalDAV calendars. Answer it in the mail app.")

    async def delete_event(self, id: str) -> None:
        await self._dav("DELETE", id)
