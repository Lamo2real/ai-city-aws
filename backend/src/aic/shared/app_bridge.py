"""The server side of the apps data bridge (docs/APPS.md § v2): ``POST /apps/<id>/bridge`` and
``POST /apps/<id>/proposals``.

A bridge call reads, and only what the owner granted that app: the grant check, params validation, the
policy gate as role ``app`` (audited, never with args or data), a per-app rate limit, then the read, cut to
256 KB. A proposal never acts: it files a normal owner approval that the API runs once on approve.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from .app_caps import (
    CONNECTOR_CONTENT_MAX,
    PROPOSALS,
    PROPOSALS_PER_HOUR,
    Capability,
    ConnectorReads,
    Invalid,
    LoginExpired,
    MailCalendar,
    NoConnectorReads,
    NoMailCalendar,
    Unavailable,
    calendar_chunks,
    cap_key,
    check_args_against_schema,
    check_params,
    connector_tool,
    gate_name,
    is_read_only,
)
from .events import EventBus
from .ledger import Ledger, Record
from .policy import action_hash, gate
from .table import AddLimit, UpdateOptions

BRIDGE_PER_MINUTE = 120
RESPONSE_MAX_BYTES = 256 * 1024
_LISTS = ("events", "messages", "calendars", "accounts")


@dataclass
class Readers:
    mail: MailCalendar = field(default_factory=NoMailCalendar)
    connectors: ConnectorReads = field(default_factory=NoConnectorReads)


@dataclass(frozen=True)
class Answer:
    status: int
    body: dict[str, Any]


def _err(status: int, error: str, message: str) -> Answer:
    return Answer(status, {"ok": False, "error": error, "message": message})


async def _take(ledger: Ledger, key: str, window_s: int, limit: int) -> bool:
    slot = int(ledger.now().timestamp()) // window_s
    it = await ledger.table.update(
        f"RATE#{key}",
        str(slot),
        UpdateOptions(add={"n": 1}, add_limit=AddLimit("n", limit), set={"ttl": (slot + 2) * window_s}),
    )
    return it is not None


def fit(data: dict[str, Any], max_bytes: int = RESPONSE_MAX_BYTES) -> dict[str, Any]:
    """Cuts the list fields until the JSON fits, marking ``truncated: true``."""
    out = dict(data)
    while len(json.dumps(out, default=str).encode()) > max_bytes:
        lists = [k for k in _LISTS if isinstance(out.get(k), list) and out[k]]
        if not lists:
            return {"truncated": True}
        k = max(lists, key=lambda k: len(json.dumps(out[k], default=str)))
        out[k] = out[k][: len(out[k]) // 2]
        out["truncated"] = True
    return out


def _granted(app: Record, cap_name: str, params: Any) -> Capability | None:
    grants: list[Capability] = list(app.get("grants") or [])
    if cap_name == "connector.read":
        p = params if isinstance(params, dict) else {}
        want = cap_key({"id": "connector.read", "connector": p.get("connector"), "tool": p.get("tool")})
    else:
        want = cap_name
    return next((g for g in grants if cap_key(g) == want and g.get("id") != "propose"), None)


async def _read(cap: Capability, p: dict[str, Any], ledger: Ledger, r: Readers) -> dict[str, Any]:
    cid = cap["id"]
    if cid == "calendar.read":
        events: dict[str, Any] = {}
        errors: list[Any] = []
        for a, b in calendar_chunks(p["from"], p["to"]):
            got = await r.mail.calendar_events(a, b, p.get("calendar_ids"))
            for e in got.get("events") or []:
                events.setdefault(f"{e.get('account_id')}:{e.get('id')}:{e.get('start')}", e)
            errors += got.get("errors") or []
        cals = await r.mail.calendar_list()
        return {"events": list(events.values()), "calendars": cals.get("calendars") or [], "errors": errors}
    if cid == "calendar.calendars":
        return {"calendars": (await r.mail.calendar_list()).get("calendars") or []}
    if cid == "mail.search":
        got = await r.mail.mail_search(p)
        msgs = [
            {k: v for k, v in m.items() if k not in ("body_text", "body", "attachments")}
            for m in got.get("messages") or []
        ]
        return {"messages": msgs}
    if cid == "mail.accounts":
        keep = ("id", "label", "provider", "address")
        return {"accounts": [{k: a.get(k) for k in keep} for a in (await r.mail.mail_accounts()).get("accounts") or []]}
    if cid == "connector.read":
        found = await connector_tool(ledger, cap["connector"], cap["tool"])
        if not found or not is_read_only(found[1]):
            raise PermissionError("That connector tool is not a read-only tool.")
        rec, tool = found
        if rec.get("status") == "login_expired":
            raise LoginExpired(f"{rec.get('label') or rec['id']} needs you to sign in again.")
        if rec.get("status") != "ready":
            raise Unavailable(f"{rec.get('label') or rec['id']} is not ready.")
        check_args_against_schema(p["args"], tool.get("input_schema") or tool.get("inputSchema"))
        parts = await r.connectors.call(cap["connector"], cap["tool"], p["args"])
        text = "\n".join(str(x.get("text", "")) for x in parts if isinstance(x, dict) and x.get("type") == "text")
        cut = text.encode()[:CONNECTOR_CONTENT_MAX].decode("utf-8", "ignore")
        out: dict[str, Any] = {"content": cut}
        if len(cut) < len(text):
            out["truncated"] = True
        return out
    raise Invalid(f"{cid} can't be requested this way")


async def bridge_call(ledger: Ledger, app: Record, cap_name: Any, params: Any, readers: Readers) -> Answer:
    """One read for one app. The app id comes from the route, never from the app's message."""
    if not isinstance(cap_name, str) or len(cap_name) > 40:
        return _err(400, "invalid", "That request could not be read.")
    cap = _granted(app, cap_name, params)
    if cap is None:
        return _err(403, "not_granted", "You haven't given this app that permission.")
    try:
        p = check_params(cap, params)
    except Invalid as e:
        return _err(400, "invalid", str(e))
    agent = f"app-{app['app_id']}"
    name = gate_name(cap)
    started = time.monotonic()
    g = await gate(name, p, "app", agent)  # no consume_approval: apps can't ask, so "ask" stays a deny
    await ledger.audit_tool(agent, name, g.decision, g.reason)
    if g.decision != "allow":
        return _err(403, "not_granted", "The city's policy doesn't allow that.")
    if not await _take(ledger, agent, 60, BRIDGE_PER_MINUTE):
        return _err(429, "rate_limited", "Too many requests; try again in a minute.")
    try:
        data = await _read(cap, p, ledger, readers)
    except Invalid as e:
        return _err(400, "invalid", str(e))
    except PermissionError as e:
        return _err(403, "not_granted", str(e))
    except LoginExpired as e:
        return _err(200, "login_expired", str(e) or "An account needs you to sign in again.")
    except Unavailable as e:
        return _err(200, "unavailable", str(e) or "That data isn't available right now.")
    await ledger.audit_tool(agent, name, "done", f"{round((time.monotonic() - started) * 1000)} ms")
    return Answer(200, {"ok": True, "data": fit(data)})


def _action(kind: str, args: dict[str, Any]) -> str:
    if kind == "calendar.respond":
        return f"{args['response'].capitalize()} a calendar invitation"
    if kind == "calendar.create":
        who = f" and invite {len(args['attendees'])} people" if args.get("attendees") else ""
        return f"Create the event “{str(args['title'])[:80]}”{who}"
    return f"Save a draft email to {', '.join(args['to'])[:120]}"


async def file_proposal(ledger: Ledger, bus: EventBus, app: Record, body: dict[str, Any], readers: Readers) -> Answer:
    """``POST /apps/<id>/proposals``: a normal approval in Needs you, with the mail/calendar preview."""
    if not any(g.get("id") == "propose" for g in app.get("grants") or []):
        return _err(403, "not_granted", "You haven't let this app propose actions.")
    prop = PROPOSALS.get(str(body.get("kind")))
    if prop is None:
        return _err(400, "invalid", "An app can propose only calendar.respond, calendar.create or mail.draft.")
    params = body.get("params")
    if not isinstance(params, dict) or len(json.dumps(params, default=str)) > 24_000:
        return _err(400, "invalid", "params must be an object.")
    try:
        args = prop.check(params)
    except Invalid as e:
        return _err(400, "invalid", str(e))
    agent = f"app-{app['app_id']}"
    if not await _take(ledger, f"{agent}-proposals", 3600, PROPOSALS_PER_HOUR):
        return _err(429, "rate_limited", "This app has proposed enough for this hour.")
    try:
        preview = await readers.mail.preview(prop.tool, args)
    except Unavailable as e:
        return _err(200, "unavailable", str(e) or "That isn't available right now.")
    except LoginExpired as e:
        return _err(200, "login_expired", str(e))
    h = action_hash(prop.tool, args)
    if any(a.get("hash") == h for a in await ledger.pending_approvals()):
        return Answer(200, {"ok": True, "status": "waiting_for_you"})
    action = _action(prop.kind, args)
    reason = f"The app “{app['title']}” asks for this. Apps never act for you on their own."
    a = await ledger.request_approval(
        {
            "agent": agent,
            "ticket_id": None,
            "tool": prop.tool,
            "action": action,
            "hash": h,
            "reason": reason,
            "kind": "tool",
            "input": args,
            "preview": preview,
            "requested_by": f"app:{app['app_id']}",
        }
    )
    await bus.put(
        {
            "type": "approval.requested",
            "id": a["id"],
            "agent": agent,
            "action": action,
            "reason": reason,
            "kind": "tool",
        }
    )
    return Answer(200, {"ok": True, "status": "waiting_for_you"})


async def run_proposal(ledger: Ledger, approval: Record, readers: Readers) -> dict[str, Any]:
    """On the owner's approve: runs the proposed tool once, exactly as stored on the approval."""
    agent = str(approval.get("agent"))
    tool = str(approval.get("tool"))
    if tool not in {p.tool for p in PROPOSALS.values()}:
        raise ValueError("That is not an action an app can propose.")
    try:
        result = await readers.mail.run(tool, dict(approval.get("input") or {}))
    except (Unavailable, LoginExpired) as e:
        await ledger.audit_tool(agent, tool, "failed", type(e).__name__)
        return {
            "ok": False,
            "error": "unavailable" if isinstance(e, Unavailable) else "login_expired",
            "message": str(e),
        }
    await ledger.audit_tool(agent, tool, "approved", "run once on the owner's approval")
    return {"ok": True, "result": result}
