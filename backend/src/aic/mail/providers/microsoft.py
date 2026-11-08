"""Microsoft Graph v1.0 mail and calendar (``docs/MAIL_CALENDAR.md`` §1)."""

from __future__ import annotations

import urllib.parse
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from ..http import Http, call, qs
from ..joinlinks import find_join
from .base import BODY_MAX, Json, addr, cap, event, html_to_text, summary

GRAPH = "https://graph.microsoft.com/v1.0/me"
_FOLDER = {"inbox": "inbox", "sent": "sentitems", "drafts": "drafts", "archive": "archive"}
_RESP = {"accept": "accept", "decline": "decline", "tentative": "tentativelyAccept"}
_MY = {
    "accepted": "accepted",
    "declined": "declined",
    "tentativelyAccepted": "tentative",
    "notResponded": "needs_action",
    "none": None,
    "organizer": None,
}
_SELECT = "id,conversationId,from,toRecipients,ccRecipients,subject,receivedDateTime,bodyPreview,isRead,categories,hasAttachments"


def _a(x: Json | None) -> Json:
    e = (x or {}).get("emailAddress", {})
    return addr(e.get("name"), e.get("address"))


def _recips(xs: list[Any] | None) -> list[Json]:
    out = []
    for x in xs or []:
        email = x if isinstance(x, str) else x["email"]
        out.append({"emailAddress": {"address": email}})
    return out


def _body_join(e: Json) -> str | None:
    """A Zoom, Meet or Webex link in the event's body (Teams has its own field)."""
    body = (e.get("body") or {}).get("content") or ""
    j = find_join(html_to_text(body) if "<" in body else body)
    return j["url"] if j else None


def utc_naive(iso: str) -> str:
    """Graph takes a wall time plus a zone: ISO with an offset becomes UTC without one."""
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if d.tzinfo is not None:
        d = d.astimezone(UTC).replace(tzinfo=None)
    return d.isoformat(timespec="seconds")


def _q(id: str) -> str:
    return urllib.parse.quote(id, safe="")


def search_params(query: str, unread_only: bool, after: str | None, before: str | None, limit: int) -> Json:
    """Graph can't combine $search with $filter on messages, so the date and unread limits go into KQL."""
    kql = [query.strip()] if query.strip() else []
    if after:
        kql.append(f"received>={after[:10]}")
    if before:
        kql.append(f"received<{before[:10]}")
    if kql:
        return {"$search": '"' + " ".join(kql).replace('"', "") + '"', "$top": limit, "$select": _SELECT}
    p: Json = {"$top": limit, "$select": _SELECT, "$orderby": "receivedDateTime desc"}
    if unread_only:
        p["$filter"] = "isRead eq false"
    return p


class Microsoft:
    def __init__(self, http: Http, token: Callable[[], Awaitable[str]]) -> None:
        self.http = http
        self.token = token

    async def _g(self, method: str, url: str, body: Any = None, headers: dict[str, str] | None = None) -> Any:
        return await call(self.http, method, url, await self.token(), body, headers)

    @staticmethod
    def _summary(m: Json) -> Json:
        return summary(
            m["id"],
            m.get("conversationId", ""),
            _a(m.get("from")),
            [_a(x) for x in m.get("toRecipients", [])],
            [_a(x) for x in m.get("ccRecipients", [])],
            m.get("subject", ""),
            m.get("receivedDateTime", ""),
            m.get("bodyPreview", ""),
            not m.get("isRead", True),
            list(m.get("categories", [])),
            bool(m.get("hasAttachments")),
        )

    async def search(
        self, query: str, folder: str | None, unread_only: bool, after: str | None, before: str | None, limit: int
    ) -> list[Json]:
        base = f"{GRAPH}/mailFolders/{_FOLDER[folder]}/messages" if folder in _FOLDER else f"{GRAPH}/messages"
        p = search_params(query, unread_only, after, before, limit)
        h = {"ConsistencyLevel": "eventual"} if "$search" in p else None
        r = await self._g("GET", base + qs(p), headers=h) or {}
        out = [self._summary(m) for m in r.get("value", [])]
        return [m for m in out if m["unread"]] if unread_only else out

    async def read(self, id: str) -> Json:
        m = await self._g("GET", f"{GRAPH}/messages/{_q(id)}?$select={_SELECT},body,internetMessageHeaders")
        s = self._summary(m)
        b = m.get("body", {})
        text = b.get("content", "") if b.get("contentType") == "text" else html_to_text(b.get("content", ""))
        files = []
        if m.get("hasAttachments"):
            r = await self._g("GET", f"{GRAPH}/messages/{_q(id)}/attachments?$select=name,size,contentType") or {}
            files = [
                {"name": x.get("name", ""), "size": x.get("size", 0), "mime": x.get("contentType", "")}
                for x in r.get("value", [])
            ]
        s.update(body_text=cap(text, BODY_MAX), attachments=files)
        unsub = next(
            (
                h["value"]
                for h in m.get("internetMessageHeaders", []) or []
                if h.get("name", "").lower() == "list-unsubscribe"
            ),
            None,
        )
        if unsub:
            s["list_unsubscribe"] = unsub[:500]
        return s

    async def draft(self, f: Json) -> str:
        fields: Json = {
            "subject": f.get("subject", ""),
            "body": {"contentType": "text", "content": f.get("body", "")},
            "toRecipients": _recips(f.get("to")),
            "ccRecipients": _recips(f.get("cc")),
            "bccRecipients": _recips(f.get("bcc")),
        }
        if f.get("reply_to_id"):
            r = await self._g("POST", f"{GRAPH}/messages/{_q(f['reply_to_id'])}/createReply")
            await self._g("PATCH", f"{GRAPH}/messages/{_q(r['id'])}", fields)
            return str(r["id"])
        r = await self._g("POST", f"{GRAPH}/messages", fields)
        return str(r["id"])

    async def send(self, draft_id: str) -> str:
        await self._g("POST", f"{GRAPH}/messages/{_q(draft_id)}/send")
        return draft_id

    async def label(self, ids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None) -> int:
        for i in ids:
            if add or remove:
                m = await self._g("GET", f"{GRAPH}/messages/{_q(i)}?$select=categories")
                cats = [c for c in m.get("categories", []) if c not in remove] + [c for c in add]
                await self._g("PATCH", f"{GRAPH}/messages/{_q(i)}", {"categories": list(dict.fromkeys(cats))})
            if read is not None:
                await self._g("PATCH", f"{GRAPH}/messages/{_q(i)}", {"isRead": read})
            if archive:
                await self._g("POST", f"{GRAPH}/messages/{_q(i)}/move", {"destinationId": "archive"})
        return len(ids)

    async def trash(self, ids: list[str]) -> int:
        for i in ids:
            await self._g("POST", f"{GRAPH}/messages/{_q(i)}/move", {"destinationId": "deleteditems"})
        return len(ids)

    async def calendars(self) -> list[Json]:
        r = await self._g("GET", f"{GRAPH}/calendars") or {}
        return [
            {
                "id": c["id"],
                "name": c.get("name", ""),
                "color": c.get("hexColor") or None,
                "writable": bool(c.get("canEdit")),
                "primary": bool(c.get("isDefaultCalendar")),
            }
            for c in r.get("value", [])
        ]

    @staticmethod
    def _event(e: Json, calendar_id: str = "") -> Json:
        def when(x: Json | None) -> str:
            x = x or {}
            dt = x.get("dateTime", "")
            if dt and x.get("timeZone", "UTC").upper() == "UTC" and not dt.endswith("Z"):
                dt = dt.split(".")[0] + "Z"
            return str(dt)

        all_day = bool(e.get("isAllDay"))
        start, end = when(e.get("start")), when(e.get("end"))
        if all_day:
            start, end = start[:10], end[:10]
        org = _a(e.get("organizer"))
        return event(
            id=e["id"],
            calendar_id=calendar_id or (e.get("calendar") or {}).get("id", ""),
            title=e.get("subject"),
            start=start,
            end=end,
            all_day=all_day,
            location=(e.get("location") or {}).get("displayName"),
            description=e.get("bodyPreview", ""),
            organizer=org,
            attendees=[
                {**_a(a), "response": (a.get("status") or {}).get("response", "")} for a in e.get("attendees", [])
            ],
            my_response=_MY.get((e.get("responseStatus") or {}).get("response", "none")),
            recurring=e.get("type") in ("occurrence", "exception", "seriesMaster"),
            url=e.get("webLink"),
            uid=e.get("iCalUId"),
            join_url=(e.get("onlineMeeting") or {}).get("joinUrl") or e.get("onlineMeetingUrl") or _body_join(e),
            time_zone=e.get("originalStartTimeZone"),
        )

    async def events(self, start: str, end: str, calendar_ids: list[str] | None, query: str | None) -> list[Json]:
        cals = calendar_ids or [c["id"] for c in await self.calendars()]
        out: list[Json] = []
        h = {"Prefer": 'outlook.timezone="UTC"'}
        for cal in cals:
            p = {"startDateTime": start, "endDateTime": end, "$top": 250}
            r = await self._g("GET", f"{GRAPH}/calendars/{_q(cal)}/calendarView{qs(p)}", headers=h) or {}
            items = [self._event(e, cal) for e in r.get("value", []) if not e.get("isCancelled")]
            if query:
                q = query.lower()
                items = [e for e in items if q in (e["title"] + " " + e["location"] + " " + e["description"]).lower()]
            out += items
        return out

    async def get_event(self, id: str) -> Json:
        e = await self._g(
            "GET", f"{GRAPH}/events/{_q(id)}?$expand=calendar($select=id)", headers={"Prefer": 'outlook.timezone="UTC"'}
        )
        return self._event(e)

    @staticmethod
    def _body_of(f: Json) -> Json:
        b: Json = {}
        if "title" in f:
            b["subject"] = f["title"]
        if "location" in f:
            b["location"] = {"displayName": f["location"]}
        if "description" in f:
            b["body"] = {"contentType": "text", "content": f["description"]}
        if "all_day" in f:
            b["isAllDay"] = bool(f["all_day"])
        for k in ("start", "end"):
            if k in f:
                v = utc_naive(f[k]) if not f.get("all_day") else f[k][:10] + "T00:00:00"
                b[k] = {"dateTime": v, "timeZone": "UTC"}
        if "attendees" in f:
            b["attendees"] = [
                {"emailAddress": {"address": a if isinstance(a, str) else a["email"]}, "type": "required"}
                for a in f["attendees"] or []
            ]
        return b

    async def create_event(self, calendar_id: str, f: Json) -> Json:
        e = await self._g("POST", f"{GRAPH}/calendars/{_q(calendar_id)}/events", self._body_of(f))
        return self._event(e, calendar_id)

    async def update_event(self, id: str, f: Json) -> Json:
        e = await self._g("PATCH", f"{GRAPH}/events/{_q(id)}", self._body_of(f))
        return self._event(e)

    async def respond(self, id: str, response: str, comment: str | None) -> None:
        await self._g(
            "POST",
            f"{GRAPH}/events/{_q(id)}/{_RESP[response]}",
            {"comment": (comment or "")[:500], "sendResponse": True},
        )

    async def delete_event(self, id: str) -> None:
        await self._g("DELETE", f"{GRAPH}/events/{_q(id)}")
