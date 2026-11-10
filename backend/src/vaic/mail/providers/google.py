"""Gmail REST v1 and Google Calendar v3 (``docs/MAIL_CALENDAR.md`` §1)."""

from __future__ import annotations

import base64
import urllib.parse
from collections.abc import Awaitable, Callable
from email.message import EmailMessage
from typing import Any

from ..http import Http, ProviderError, call, qs
from .base import (
    BODY_MAX,
    Json,
    addr,
    cap,
    event,
    fmt_addrs,
    html_to_text,
    parse_addr,
    parse_addrs,
    summary,
)

GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
CAL = "https://www.googleapis.com/calendar/v3"
_FOLDER_Q = {
    "inbox": "in:inbox",
    "sent": "in:sent",
    "drafts": "in:drafts",
    "archive": "-in:inbox -in:sent -in:drafts",
    "all": "",
}
_RESP = {"accept": "accepted", "decline": "declined", "tentative": "tentative"}


def _b64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def event_pid(calendar_id: str, event_id: str) -> str:
    """Google needs the calendar to find an event: ``<calendar id, base64url>.<event id>``."""
    return base64.urlsafe_b64encode(calendar_id.encode()).decode().rstrip("=") + "." + event_id


def split_event_pid(pid: str) -> tuple[str, str]:
    cal, _, ev = pid.partition(".")
    if not ev:
        raise ProviderError("That isn't a Google Calendar event id.")
    return _b64(cal).decode(), ev


def _video(e: Json) -> str | None:
    """The video entry point of an event's conference (Meet, or a Zoom/Teams add-on)."""
    for p in (e.get("conferenceData") or {}).get("entryPoints") or []:
        if p.get("entryPointType") == "video" and p.get("uri"):
            return str(p["uri"])
    return None


def _date(d: str) -> str:
    return d[:10].replace("-", "/")


def gmail_query(query: str, folder: str | None, unread_only: bool, after: str | None, before: str | None) -> str:
    parts = [query.strip()] if query.strip() else []
    if folder and _FOLDER_Q.get(folder):
        parts.append(_FOLDER_Q[folder])
    if unread_only:
        parts.append("is:unread")
    if after:
        parts.append(f"after:{_date(after)}")
    if before:
        parts.append(f"before:{_date(before)}")
    return " ".join(parts)


def _headers(payload: Json) -> dict[str, str]:
    return {h["name"].lower(): h.get("value", "") for h in payload.get("headers", [])}


def _walk(part: Json) -> list[Json]:
    out = [part]
    for p in part.get("parts", []) or []:
        out += _walk(p)
    return out


def _body(payload: Json) -> tuple[str, list[Json]]:
    plain, htm, files = "", "", []
    for p in _walk(payload):
        mime = p.get("mimeType", "")
        data = (p.get("body") or {}).get("data")
        if p.get("filename"):
            files.append({"name": p["filename"], "size": int((p.get("body") or {}).get("size", 0)), "mime": mime})
        elif data and mime == "text/plain" and not plain:
            plain = _b64(data).decode("utf-8", "replace")
        elif data and mime == "text/html" and not htm:
            htm = _b64(data).decode("utf-8", "replace")
    return (plain or html_to_text(htm)), files


class Google:
    def __init__(self, http: Http, token: Callable[[], Awaitable[str]], address: str = "") -> None:
        self.http = http
        self.token = token
        self.address = address

    async def _g(self, method: str, url: str, body: Any = None) -> Any:
        return await call(self.http, method, url, await self.token(), body)

    def _summary(self, m: Json) -> Json:
        h = _headers(m.get("payload", {}))
        labels = list(m.get("labelIds", []))
        _, files = _body(m.get("payload", {}))
        return summary(
            m["id"],
            m.get("threadId", ""),
            parse_addr(h.get("from", "")),
            parse_addrs(h.get("to")),
            parse_addrs(h.get("cc")),
            h.get("subject", ""),
            h.get("date", ""),
            m.get("snippet", ""),
            "UNREAD" in labels,
            labels,
            bool(files),
        )

    async def search(
        self, query: str, folder: str | None, unread_only: bool, after: str | None, before: str | None, limit: int
    ) -> list[Json]:
        q = gmail_query(query, folder, unread_only, after, before)
        r = await self._g("GET", f"{GMAIL}/messages{qs({'q': q, 'maxResults': limit})}") or {}
        out = []
        for ref in r.get("messages", [])[:limit]:
            m = await self._g(
                "GET",
                f"{GMAIL}/messages/{urllib.parse.quote(ref['id'])}?format=metadata"
                "&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc"
                "&metadataHeaders=Subject&metadataHeaders=Date",
            )
            out.append(self._summary(m))
        return out

    async def read(self, id: str) -> Json:
        m = await self._g("GET", f"{GMAIL}/messages/{urllib.parse.quote(id)}?format=full")
        text, files = _body(m.get("payload", {}))
        s = self._summary(m)
        h = _headers(m.get("payload", {}))
        s.update(body_text=cap(text, BODY_MAX), attachments=files)
        if h.get("list-unsubscribe"):
            s["list_unsubscribe"] = h["list-unsubscribe"][:500]
        return s

    async def _raw(self, f: Json) -> tuple[str, str | None]:
        msg = EmailMessage()
        msg["From"] = self.address
        msg["To"] = fmt_addrs(f.get("to"))
        if f.get("cc"):
            msg["Cc"] = fmt_addrs(f["cc"])
        if f.get("bcc"):
            msg["Bcc"] = fmt_addrs(f["bcc"])
        msg["Subject"] = f.get("subject", "")
        thread = None
        if f.get("reply_to_id"):
            orig = await self._g(
                "GET",
                f"{GMAIL}/messages/{urllib.parse.quote(f['reply_to_id'])}?format=metadata&metadataHeaders=Message-ID",
            )
            mid = _headers(orig.get("payload", {})).get("message-id")
            if mid:
                msg["In-Reply-To"] = mid
                msg["References"] = mid
            thread = orig.get("threadId")
        msg.set_content(f.get("body", ""))
        return base64.urlsafe_b64encode(msg.as_bytes()).decode(), thread

    async def draft(self, f: Json) -> str:
        raw, thread = await self._raw(f)
        message: Json = {"raw": raw}
        if thread:
            message["threadId"] = thread
        r = await self._g("POST", f"{GMAIL}/drafts", {"message": message})
        return str(r["id"])

    async def send(self, draft_id: str) -> str:
        r = await self._g("POST", f"{GMAIL}/drafts/send", {"id": draft_id})
        return str(r.get("id", ""))

    async def label(self, ids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None) -> int:
        add_ids, remove_ids = list(add), list(remove)
        if archive:
            remove_ids.append("INBOX")
        if read is True:
            remove_ids.append("UNREAD")
        elif read is False:
            add_ids.append("UNREAD")
        await self._g(
            "POST", f"{GMAIL}/messages/batchModify", {"ids": ids, "addLabelIds": add_ids, "removeLabelIds": remove_ids}
        )
        return len(ids)

    async def trash(self, ids: list[str]) -> int:
        for i in ids:
            await self._g("POST", f"{GMAIL}/messages/{urllib.parse.quote(i)}/trash")
        return len(ids)

    async def calendars(self) -> list[Json]:
        r = await self._g("GET", f"{CAL}/users/me/calendarList") or {}
        return [
            {
                "id": c["id"],
                "name": c.get("summaryOverride") or c.get("summary", ""),
                "color": c.get("backgroundColor"),
                "writable": c.get("accessRole") in ("owner", "writer"),
                "primary": bool(c.get("primary")),
            }
            for c in r.get("items", [])
        ]

    def _event(self, cal: str, e: Json) -> Json:
        start, end = e.get("start", {}), e.get("end", {})
        mine = next((a.get("responseStatus") for a in e.get("attendees", []) if a.get("self")), None)
        org = e.get("organizer", {})
        return event(
            id=event_pid(cal, e["id"]),
            calendar_id=cal,
            title=e.get("summary"),
            start=start.get("dateTime") or start.get("date", ""),
            end=end.get("dateTime") or end.get("date", ""),
            all_day="date" in start,
            location=e.get("location"),
            description=html_to_text(e.get("description") or ""),
            organizer=addr(org.get("displayName"), org.get("email")),
            attendees=[
                {**addr(a.get("displayName"), a.get("email")), "response": a.get("responseStatus", "")}
                for a in e.get("attendees", [])
            ],
            my_response={"needsAction": "needs_action"}.get(mine or "", mine),
            recurring=bool(e.get("recurringEventId") or e.get("recurrence")),
            url=e.get("htmlLink"),
            uid=e.get("iCalUID"),
            join_url=e.get("hangoutLink") or _video(e),
            time_zone=start.get("timeZone"),
        )

    async def events(self, start: str, end: str, calendar_ids: list[str] | None, query: str | None) -> list[Json]:
        cals = calendar_ids or [c["id"] for c in await self.calendars()]
        out: list[Json] = []
        for cal in cals:
            p = {
                "timeMin": start,
                "timeMax": end,
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 250,
                "q": query,
            }
            r = await self._g("GET", f"{CAL}/calendars/{urllib.parse.quote(cal)}/events{qs(p)}") or {}
            out += [self._event(cal, e) for e in r.get("items", []) if e.get("status") != "cancelled"]
        return out

    async def get_event(self, id: str) -> Json:
        cal, ev = split_event_pid(id)
        e = await self._g("GET", f"{CAL}/calendars/{urllib.parse.quote(cal)}/events/{urllib.parse.quote(ev)}")
        return self._event(cal, e)

    @staticmethod
    def _body_of(f: Json) -> Json:
        b: Json = {}
        if "title" in f:
            b["summary"] = f["title"]
        for k, g in (("location", "location"), ("description", "description")):
            if k in f:
                b[g] = f[k]
        if "start" in f or "end" in f:
            key = "date" if f.get("all_day") else "dateTime"
            if "start" in f:
                b["start"] = {key: f["start"][:10] if key == "date" else f["start"]}
            if "end" in f:
                b["end"] = {key: f["end"][:10] if key == "date" else f["end"]}
        if "attendees" in f:
            b["attendees"] = [{"email": a if isinstance(a, str) else a["email"]} for a in f["attendees"] or []]
        return b

    async def create_event(self, calendar_id: str, f: Json) -> Json:
        send = "all" if f.get("attendees") else "none"
        e = await self._g(
            "POST", f"{CAL}/calendars/{urllib.parse.quote(calendar_id)}/events?sendUpdates={send}", self._body_of(f)
        )
        return self._event(calendar_id, e)

    async def update_event(self, id: str, f: Json) -> Json:
        cal, ev = split_event_pid(id)
        e = await self._g(
            "PATCH",
            f"{CAL}/calendars/{urllib.parse.quote(cal)}/events/{urllib.parse.quote(ev)}?sendUpdates=all",
            self._body_of(f),
        )
        return self._event(cal, e)

    async def respond(self, id: str, response: str, comment: str | None) -> None:
        cal, ev = split_event_pid(id)
        url = f"{CAL}/calendars/{urllib.parse.quote(cal)}/events/{urllib.parse.quote(ev)}"
        e = await self._g("GET", url)
        attendees = e.get("attendees", [])
        me = next((a for a in attendees if a.get("self")), None)
        if me is None:
            raise ProviderError("You're not on that event's guest list.")
        me["responseStatus"] = _RESP[response]
        if comment:
            me["comment"] = comment[:500]
        await self._g("PATCH", f"{url}?sendUpdates=all", {"attendees": attendees})

    async def delete_event(self, id: str) -> None:
        cal, ev = split_event_pid(id)
        await self._g(
            "DELETE", f"{CAL}/calendars/{urllib.parse.quote(cal)}/events/{urllib.parse.quote(ev)}?sendUpdates=all"
        )
