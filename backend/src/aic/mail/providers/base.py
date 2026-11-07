"""The provider protocol and the normalized types (``docs/MAIL_CALENDAR.md`` §3), as plain JSON dicts.

Provider ids are the provider's own; the service adds the account (``<account_id>:<provider id>``)."""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from typing import Any, Protocol

Json = dict[str, Any]
BODY_MAX = 20_000
DESCRIPTION_MAX = 4_000
SNIPPET_MAX = 200
FOLDERS = ("inbox", "sent", "drafts", "archive", "all")
RESPONSES = ("accept", "decline", "tentative")


def addr(name: str | None, email: str | None) -> Json:
    return {"name": (name or "").strip(), "email": (email or "").strip()}


_ADDR = re.compile(r'^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$')


def parse_addr(s: str) -> Json:
    m = _ADDR.match(s or "")
    return addr(m.group(1), m.group(2)) if m else addr("", (s or "").strip())


def parse_addrs(s: str | None) -> list[Json]:
    if not s:
        return []
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch == '"':
            depth ^= 1
        if ch == "," and not depth:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [parse_addr(p) for p in parts if p.strip()]


def fmt_addrs(xs: list[str] | list[Json] | None) -> str:
    out = []
    for x in xs or []:
        if isinstance(x, dict):
            out.append(f'"{x.get("name")}" <{x["email"]}>' if x.get("name") else str(x["email"]))
        else:
            out.append(str(x))
    return ", ".join(out)


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in ("script", "style", "head"):
            self.skip += 1
        elif tag in ("br", "p", "div", "tr", "li", "h1", "h2", "h3", "table"):
            self.out.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "head") and self.skip:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.out.append(data)


def html_to_text(s: str) -> str:
    p = _Text()
    try:
        p.feed(s)
        p.close()
    except Exception:
        return html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\n{3,}", "\n\n", "".join(p.out)).strip()


def cap(s: str | None, n: int) -> str:
    s = s or ""
    return s if len(s) <= n else s[: n - 1] + "…"


def summary(
    id: str,
    thread_id: str,
    frm: Json,
    to: list[Json],
    cc: list[Json],
    subject: str,
    date: str,
    snippet: str,
    unread: bool,
    labels: list[str],
    has_attachments: bool,
) -> Json:
    return {
        "id": id,
        "thread_id": thread_id,
        "from": frm,
        "to": to,
        "cc": cc,
        "subject": subject or "",
        "date": date or "",
        "snippet": cap(re.sub(r"\s+", " ", snippet or "").strip(), SNIPPET_MAX),
        "unread": unread,
        "labels": labels,
        "has_attachments": has_attachments,
    }


def event(**kw: Any) -> Json:
    e: Json = {
        "id": kw["id"],
        "calendar_id": kw.get("calendar_id", ""),
        "title": kw.get("title") or "(no title)",
        "start": kw.get("start", ""),
        "end": kw.get("end", ""),
        "all_day": bool(kw.get("all_day")),
        "location": kw.get("location") or "",
        "description": cap(kw.get("description"), DESCRIPTION_MAX),
        "organizer": kw.get("organizer") or addr("", ""),
        "attendees": kw.get("attendees") or [],
        "recurring": bool(kw.get("recurring")),
    }
    if kw.get("my_response"):
        e["my_response"] = kw["my_response"]
    if kw.get("url"):
        e["url"] = kw["url"]
    return e


class Provider(Protocol):
    """One connected account. Every method may raise ``ProviderError`` (``Unauthorized`` = sign in again)."""

    async def search(
        self, query: str, folder: str | None, unread_only: bool, after: str | None, before: str | None, limit: int
    ) -> list[Json]: ...
    async def read(self, id: str) -> Json: ...
    async def draft(self, f: Json) -> str: ...
    async def send(self, draft_id: str) -> str: ...
    async def label(
        self, ids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None
    ) -> int: ...
    async def trash(self, ids: list[str]) -> int: ...
    async def calendars(self) -> list[Json]: ...
    async def events(self, start: str, end: str, calendar_ids: list[str] | None, query: str | None) -> list[Json]: ...
    async def get_event(self, id: str) -> Json: ...
    async def create_event(self, calendar_id: str, f: Json) -> Json: ...
    async def update_event(self, id: str, f: Json) -> Json: ...
    async def respond(self, id: str, response: str, comment: str | None) -> None: ...
    async def delete_event(self, id: str) -> None: ...
