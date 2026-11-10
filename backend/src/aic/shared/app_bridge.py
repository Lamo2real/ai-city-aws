"""The server side of the apps data bridge (docs/APPS.md § v2).

Two halves:
- ``api_bridge`` runs in the api Lambda (``POST /apps/<id>/bridge``): grant, params, 120/min per app, then a
  synchronous invoke of the app-bridge Lambda with ``{app_id, cap, params}``. The api role reaches no data.
- ``serve_bridge`` runs in that Lambda (``aic-prod-app-bridge``): it loads the app again and re-checks the grant,
  gates mail/calendar reads as role ``app`` (``mcp__app__<cap>``, audited without args or data), reads through
  ``MailService``'s read methods, and leaves connector reads to ``app_call`` (which gates them as
  ``mcp__gateway__<id>___<tool>``). Answers are cut to 256 KB.

Proposals (``POST /apps/<id>/proposals``) never act: the mail module files a normal approval that the API runs
once on approve.
"""

from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from .app_caps import (
    CONNECTOR_CONTENT_MAX,
    PROPOSALS,
    PROPOSALS_PER_HOUR,
    AppCall,
    Capability,
    Invalid,
    LoginExpired,
    MailProposals,
    MailReads,
    NoMail,
    NoProposals,
    Unavailable,
    calendar_chunks,
    cap_key,
    check_args_against_schema,
    check_params,
    connector_tool,
    gate_name,
    mail_error,
    no_app_call,
    plain,
)
from .app_state import STATE_CAPS, serve_state
from .apps import get_app
from .events import EventBus
from .ledger import Ledger, Record
from .policy import action_hash, gate
from .table import AddLimit, UpdateOptions

BRIDGE_PER_MINUTE = 120
RESPONSE_MAX_BYTES = 256 * 1024
_LISTS = ("events", "messages", "calendars", "accounts")
ERRORS = ("not_granted", "preview", "invalid", "rate_limited", "unavailable", "login_expired")
STATUS = {"not_granted": 403, "invalid": 400, "rate_limited": 429}

Invoke = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
"""Calls the app-bridge Lambda synchronously with ``{app_id, cap, params}``."""


@dataclass(frozen=True)
class Answer:
    status: int
    body: dict[str, Any]


def _err(error: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": error, "message": message}


def _answer(body: dict[str, Any]) -> Answer:
    if body.get("ok") is True:
        return Answer(200, {"ok": True, "data": body.get("data")})
    error = body.get("error") if body.get("error") in ERRORS else "unavailable"
    return Answer(STATUS.get(str(error), 200), _err(str(error), str(body.get("message") or "")[:300]))


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


def granted(app: Record, cap_name: str, params: Any) -> Capability | None:
    """The app's grant for this request, or None. ``propose`` is never a bridge read."""
    if cap_name == "connector.read":
        p = params if isinstance(params, dict) else {}
        want = cap_key({"id": "connector.read", "connector": p.get("connector"), "tool": p.get("tool")})
    elif cap_name in STATE_CAPS:
        want = "state"
    else:
        want = cap_name
    return next((g for g in app.get("grants") or [] if cap_key(g) == want and g.get("id") != "propose"), None)


# ---------- the api Lambda's half ----------
async def api_bridge(ledger: Ledger, app: Record, cap_name: Any, params: Any, invoke: Invoke | None) -> Answer:
    """The app id comes from the route, never from the app's message."""
    if not isinstance(cap_name, str) or len(cap_name) > 40:
        return Answer(400, _err("invalid", "That request could not be read."))
    cap = granted(app, cap_name, params)
    if cap is None:
        return Answer(403, _err("not_granted", "You haven't given this app that permission."))
    if cap["id"] == "state":  # the app's own keys: served here, in the ledger, without the app-bridge Lambda
        if cap_name not in STATE_CAPS:
            return Answer(400, _err("invalid", "Ask for state.get or state.set."))
        if not await _take(ledger, f"app-{app['app_id']}", 60, BRIDGE_PER_MINUTE):
            return Answer(429, _err("rate_limited", "Too many requests; try again in a minute."))
        return _answer(await serve_state(ledger, app, cap_name, params))
    try:
        p = check_params(cap, params)
        if cap["id"] == "connector.read":
            found = await connector_tool(ledger, cap["connector"], cap["tool"])
            if found:
                check_args_against_schema(p["args"], found[1].get("input_schema") or found[1].get("inputSchema"))
    except Invalid as e:
        return Answer(400, _err("invalid", str(e)))
    if not await _take(ledger, f"app-{app['app_id']}", 60, BRIDGE_PER_MINUTE):
        return Answer(429, _err("rate_limited", "Too many requests; try again in a minute."))
    if invoke is None:
        return Answer(200, _err("unavailable", "The app bridge is not set up yet."))
    try:
        body = await invoke({"app_id": app["app_id"], "cap": cap_name, "params": p})
    except Exception:
        return Answer(200, _err("unavailable", "That data isn't available right now."))
    return _answer(body)


# ---------- the app-bridge Lambda's half ----------
@dataclass
class BridgeDeps:
    ledger: Ledger
    city: Any = None
    """The ``aic.shared.connector_calls.AppCallDeps`` (ledger + the Gateway signed with the bridge's role) handed to
    ``app_call``; the name is historical."""
    mail: MailReads = field(default_factory=NoMail)
    app_call: AppCall = no_app_call


async def _mail_read(cap: Capability, p: dict[str, Any], mail: MailReads) -> dict[str, Any]:
    cid = cap["id"]
    if cid == "calendar.read":
        events: dict[str, Any] = {}
        errors: list[Any] = []
        for a, b in calendar_chunks(p["from"], p["to"]):
            got = plain(await mail.events(a, b, calendar_ids=p.get("calendar_ids")))
            for e in got.get("events") or []:
                events.setdefault(f"{e.get('account_id')}:{e.get('id')}:{e.get('start')}", e)
            errors += got.get("errors") or []
        cals = plain(await mail.calendars())
        return {
            "events": list(events.values()),
            "calendars": cals.get("calendars") or [],
            "errors": errors + (cals.get("errors") or []),
        }
    if cid == "calendar.calendars":
        cals = plain(await mail.calendars())
        return {"calendars": cals.get("calendars") or [], "errors": cals.get("errors") or []}
    if cid == "mail.search":
        got = plain(
            await mail.search(
                p["query"],
                account_id=p.get("account_id"),
                unread_only=bool(p.get("unread_only", False)),
                after=p.get("after"),
                before=p.get("before"),
                limit=int(p.get("limit", 25)),
            )
        )
        drop = ("body_text", "body", "attachments")
        msgs = [{k: v for k, v in m.items() if k not in drop} for m in got.get("messages") or []]
        return {"messages": msgs, "errors": got.get("errors") or []}
    if cid == "mail.accounts":
        keep = ("id", "label", "provider", "address", "color")
        raw = plain(await mail.accounts())
        rows = raw.get("accounts") if isinstance(raw, dict) else raw
        return {"accounts": [{k: a.get(k) for k in keep if k in a} for a in rows or []]}
    raise Invalid(f"{cid} can't be requested this way")


def _connector_data(r: dict[str, Any]) -> dict[str, Any]:
    parts = r.get("data") or []
    text = "\n".join(str(x.get("text", "")) for x in parts if isinstance(x, dict) and x.get("type") == "text")
    cut = text.encode()[:CONNECTOR_CONTENT_MAX].decode("utf-8", "ignore")
    out: dict[str, Any] = {"content": cut}
    js = [x.get("json") for x in parts if isinstance(x, dict) and x.get("type") == "json"]
    if js:
        out["json"] = js
    if r.get("truncated") or len(cut) < len(text):
        out["truncated"] = True
    return out


async def serve_bridge(event: dict[str, Any], d: BridgeDeps) -> dict[str, Any]:
    """``{app_id, cap, params}`` → ``{ok: true, data}`` or ``{ok: false, error, message}``."""
    app_id = str(event.get("app_id") or "")
    app = await get_app(d.ledger, app_id) if app_id else None
    if not app:
        return _err("not_granted", "That app does not exist.")
    cap_name = str(event.get("cap") or "")
    cap = granted(app, cap_name, event.get("params"))
    if cap is None:  # revoked between the api's check and now
        return _err("not_granted", "You haven't given this app that permission.")
    try:
        p = check_params(cap, event.get("params"))
    except Invalid as e:
        return _err("invalid", str(e))
    agent = f"app-{app_id}"
    if cap["id"] == "connector.read":
        r = await d.app_call(d.city, app_id=app_id, connector_id=cap["connector"], tool=cap["tool"], args=p["args"])
        if r.get("ok"):
            return {"ok": True, "data": _connector_data(r)}
        err = str(r.get("error") or "unavailable")
        return _err(err if err in ERRORS else "unavailable", "" if err in ERRORS else err[:300])
    name = gate_name(cap)
    started = time.monotonic()
    g = await gate(name, p, "app", agent)  # no consume_approval: apps can't ask, so "ask" stays a deny
    await d.ledger.audit_tool(agent, name, g.decision, g.reason)
    if g.decision != "allow":
        return _err("not_granted", "The city's policy doesn't allow that.")
    try:
        data = await _mail_read(cap, p, d.mail)
    except Invalid as e:
        return _err("invalid", str(e))
    except LoginExpired as e:
        return _err("login_expired", str(e) or "An account needs you to sign in again.")
    except (Unavailable, mail_error()) as e:
        return _err("unavailable", str(e) or "That data isn't available right now.")
    await d.ledger.audit_tool(agent, name, "done", f"{round((time.monotonic() - started) * 1000)} ms")
    return {"ok": True, "data": fit(data)}


# ---------- proposals (api Lambda) ----------
def _action(kind: str, args: dict[str, Any]) -> str:
    if kind == "calendar.respond":
        return f"{args['response'].capitalize()} a calendar invitation"
    if kind == "calendar.create":
        who = f" and invite {len(args['attendees'])} people" if args.get("attendees") else ""
        return f"Create the event “{str(args['title'])[:80]}”{who}"
    return f"Save a draft email to {', '.join(args['to'])[:120]}"


async def file_proposal(
    ledger: Ledger, bus: EventBus, app: Record, body: dict[str, Any], proposals: MailProposals | None = None
) -> Answer:
    """``POST /apps/<id>/proposals``: a normal approval in Needs you, filed by the mail module with its preview."""
    proposals = proposals or NoProposals()
    if not any(g.get("id") == "propose" for g in app.get("grants") or []):
        return Answer(403, _err("not_granted", "You haven't let this app propose actions."))
    prop = PROPOSALS.get(str(body.get("kind")))
    if prop is None:
        return Answer(400, _err("invalid", "An app can propose only calendar.respond, calendar.create or mail.draft."))
    params = body.get("params")
    if not isinstance(params, dict) or len(json.dumps(params, default=str)) > 24_000:
        return Answer(400, _err("invalid", "params must be an object."))
    try:
        args = prop.check(params)
    except Invalid as e:
        return Answer(400, _err("invalid", str(e)))
    if any(a.get("hash") == action_hash(prop.tool, args) for a in await ledger.pending_approvals()):
        return Answer(200, {"ok": True, "status": "waiting_for_you"})
    if not await _take(ledger, f"app-{app['app_id']}-proposals", 3600, PROPOSALS_PER_HOUR):
        return Answer(429, _err("rate_limited", "This app has proposed enough for this hour."))
    try:
        a = await proposals.file(prop.tool, args, f"app:{app['app_id']}")
    except LoginExpired as e:
        return Answer(200, _err("login_expired", str(e)))
    except Unavailable as e:
        return Answer(200, _err("unavailable", str(e) or "That isn't available right now."))
    action = str(a.get("action") or _action(prop.kind, args))
    reason = str(a.get("reason") or f"The app “{app['title']}” asks for this. Apps never act for you on their own.")
    await bus.put(
        {
            "type": "approval.requested",
            "id": a["id"],
            "agent": str(a.get("agent") or f"app-{app['app_id']}"),
            "action": action,
            "reason": reason,
            "kind": "tool",
        }
    )
    return Answer(200, {"ok": True, "status": "waiting_for_you"})


async def run_proposal(approval: Record, proposals: MailProposals | None = None) -> dict[str, Any]:
    """On the owner's approve: the mail module re-checks the policy and the hash and runs it exactly once."""
    proposals = proposals or NoProposals()
    if str(approval.get("tool")) not in {p.tool for p in PROPOSALS.values()}:
        return _err("invalid", "That is not an action an app can propose.")
    try:
        return {"ok": True, "result": plain(await proposals.execute(approval))}
    except LoginExpired as e:
        return _err("login_expired", str(e))
    except Unavailable as e:
        return _err("unavailable", str(e))
