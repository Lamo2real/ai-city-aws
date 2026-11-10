"""What each mail and calendar tool does once the gate allowed it (``docs/MAIL_CALENDAR.md`` §5.2).

The same functions run for an agent's tool call and for an owner-approved app proposal (§11). Answers are
plain text for the model; mail and calendar content is wrapped as untrusted data."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from . import wrap
from .service import MailError, MailService, split_id

Action = Callable[[MailService, dict[str, Any]], Awaitable[str]]
SEND_FIELDS = ("account_id", "to", "cc", "bcc", "subject", "body", "reply_to_id")


def _emails(xs: Any) -> list[str]:
    out = []
    for x in xs or []:
        e = x.get("email") if isinstance(x, dict) else x
        e = str(e or "").strip()
        if "@" not in e or any(c in e for c in "\r\n,<>"):
            raise MailError(f"Not an email address: {e[:80]!r}")
        out.append(e)
    return out


def mail_fields(a: dict[str, Any]) -> dict[str, Any]:
    f = {
        "to": _emails(a.get("to")),
        "cc": _emails(a.get("cc")),
        "bcc": _emails(a.get("bcc")),
        "subject": str(a.get("subject", ""))[:500].replace("\r", " ").replace("\n", " "),
        "body": str(a.get("body", ""))[:100_000],
    }
    if not f["to"] and not f["cc"] and not f["bcc"]:
        raise MailError("Say who the email is for.")
    if a.get("reply_to_id"):
        f["reply_to_id"] = str(a["reply_to_id"])
    return f


async def accounts(s: MailService, a: dict[str, Any]) -> str:
    return json.dumps({"accounts": await s.accounts()})


async def search(s: MailService, a: dict[str, Any]) -> str:
    r = await s.search(
        str(a.get("query", "")),
        a.get("account_id"),
        a.get("folder"),
        bool(a.get("unread_only")),
        a.get("after"),
        a.get("before"),
        int(a.get("limit", 10)),
    )
    return wrap.mail("search results", "search", r)


async def read(s: MailService, a: dict[str, Any]) -> str:
    acct, m = await s.read(str(a["id"]))
    return wrap.mail(f"{acct.get('label')} {acct.get('address', '')}".strip(), m["id"], m)


async def draft(s: MailService, a: dict[str, Any]) -> str:
    acc = str(a["account_id"])
    did = await s.draft(acc, mail_fields(a))
    return f"Saved as a draft in {await s.label_of(acc)} (draft_id {did}). Nothing was sent."


async def send(s: MailService, a: dict[str, Any]) -> str:
    did = a.get("draft_id")
    if not did:
        did = await s.draft(str(a["account_id"]), mail_fields(a))
    await s.send(str(did))
    return "Sent."


async def label(s: MailService, a: dict[str, Any]) -> str:
    ids = [str(i) for i in a.get("ids") or []]
    if not ids:
        raise MailError("Say which messages.")
    read_ = a.get("read")
    n = await s.label(
        ids,
        [str(x) for x in a.get("add") or []],
        [str(x) for x in a.get("remove") or []],
        bool(a.get("archive")),
        read_ if isinstance(read_, bool) else None,
    )
    return f"Updated {n} message(s)."


async def trash(s: MailService, a: dict[str, Any]) -> str:
    n = await s.trash([str(i) for i in a.get("ids") or []])
    return f"Moved {n} message(s) to Trash."


async def calendars(s: MailService, a: dict[str, Any]) -> str:
    return wrap.calendar("calendar list", await s.calendars())


async def events(s: MailService, a: dict[str, Any]) -> str:
    r = await s.events(str(a["from"]), str(a["to"]), a.get("calendar_ids"), a.get("query"))
    return wrap.calendar("events", r)


def event_fields(a: dict[str, Any], create: bool) -> dict[str, Any]:
    f: dict[str, Any] = {}
    for k in ("title", "start", "end", "location", "description"):
        if a.get(k) is not None:
            f[k] = str(a[k])[:4000]
    if "all_day" in a:
        f["all_day"] = bool(a["all_day"])
    if a.get("attendees") is not None:
        f["attendees"] = _emails(a["attendees"])
    if create and not (f.get("title") and f.get("start") and f.get("end")):
        raise MailError("An event needs a title, a start and an end.")
    return f


async def create_event(s: MailService, a: dict[str, Any]) -> str:
    ev = await s.create_event(str(a["calendar_id"]), event_fields(a, True))
    return f"Created {ev['title']!r} ({ev['start']}), id {ev['id']}."


async def update_event(s: MailService, a: dict[str, Any]) -> str:
    ev = await s.update_event(str(a["id"]), event_fields(a, False))
    return f"Updated {ev['title']!r} ({ev['start']})."


async def respond(s: MailService, a: dict[str, Any]) -> str:
    if a.get("response") not in ("accept", "decline", "tentative"):
        raise MailError("response must be accept, decline or tentative.")
    await s.respond(str(a["id"]), str(a["response"]), a.get("comment"))
    return f"Answered: {a['response']}."


async def delete_event(s: MailService, a: dict[str, Any]) -> str:
    split_id(str(a["id"]))
    await s.delete_event(str(a["id"]))
    return "Deleted the event."


ACTIONS: dict[str, Action] = {
    "mail_accounts": accounts,
    "mail_search": search,
    "mail_read": read,
    "mail_draft": draft,
    "mail_send": send,
    "mail_label": label,
    "mail_trash": trash,
    "calendar_list": calendars,
    "calendar_events": events,
    "calendar_create": create_event,
    "calendar_update": update_event,
    "calendar_respond": respond,
    "calendar_delete": delete_event,
}
READ_TOOLS = ("mail_accounts", "mail_search", "mail_read", "calendar_list", "calendar_events")
