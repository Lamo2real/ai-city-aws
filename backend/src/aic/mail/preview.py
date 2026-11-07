"""What Needs you shows before the owner approves an email or a calendar change (§5.5)."""

from __future__ import annotations

from typing import Any

from .service import MailService, split_id


async def build(s: MailService, tool: str, args: dict[str, Any]) -> dict[str, Any] | None:
    name = tool.rsplit("__", 1)[-1]
    try:
        if name == "mail_send":
            if args.get("draft_id"):
                acc, _ = split_id(str(args["draft_id"]))
                return {
                    "kind": "email",
                    "account": await s.label_of(acc),
                    "draft_id": args["draft_id"],
                    "note": "Sends the saved draft shown in the mailbox.",
                }
            return {
                "kind": "email",
                "account": await s.label_of(str(args.get("account_id", ""))),
                "to": args.get("to") or [],
                "cc": args.get("cc") or [],
                "bcc": args.get("bcc") or [],
                "subject": args.get("subject", ""),
                "body": args.get("body", ""),
            }
        if name == "mail_trash":
            return {"kind": "email", "action": "trash", "ids": list(args.get("ids") or [])[:50]}
        if name.startswith("calendar_"):
            action = {"calendar_create": "invite", "calendar_update": "update", "calendar_delete": "delete"}.get(name)
            if name == "calendar_respond":
                action = str(args.get("response", ""))
            p: dict[str, Any] = {"kind": "event", "action": action}
            if args.get("id"):
                acct, ev = await s.get_event(str(args["id"]))
                p.update(
                    calendar=acct.get("label", ""),
                    title=ev["title"],
                    start=ev["start"],
                    end=ev["end"],
                    location=ev["location"],
                    attendees=ev["attendees"],
                    organizer=ev["organizer"],
                )
            else:
                acc, _ = split_id(str(args.get("calendar_id", "")))
                p["calendar"] = await s.label_of(acc)
            for k in ("title", "start", "end", "location", "attendees", "comment"):
                if args.get(k) is not None:
                    p[k] = args[k]
            return p
    except Exception:
        return {
            "kind": "unavailable",
            "note": "The preview couldn't be loaded; the exact input is bound to this approval.",
        }
    return None
