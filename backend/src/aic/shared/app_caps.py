"""What an app may ask for (docs/APPS.md § v2 "data bridge"): the one capability catalogue, manifest checks,
params validation, plain labels, the proposal kinds, and the readers the bridge calls.

Nothing outside ``CATALOGUE`` is ever grantable. Every capability reads; none sends, deletes, accepts or
changes anything. An app may only *propose* one of ``PROPOSALS``, which becomes a normal owner approval.

The mail/calendar module and the connectors Gateway are reached through small injected interfaces. Until
those branches merge, the defaults answer ``unavailable``.
"""

from __future__ import annotations

import dataclasses
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast

from .ledger import Ledger, strip

Capability = dict[str, Any]
"""``{"id": ...}``, plus ``connector`` and ``tool`` for ``connector.read``."""

MANIFEST = "aic-app.json"
MANIFEST_MAX_BYTES = 16 * 1024
MAX_CAPABILITIES = 20
CALENDAR_MAX_DAYS = 366
CALENDAR_CHUNK_DAYS = 62
MAIL_LIMIT = 25
PARAMS_MAX_BYTES = 8 * 1024
CONNECTOR_CONTENT_MAX = 100 * 1024
_CONN_ID = re.compile(r"[a-z][a-z0-9-]{1,30}")
_TOOL = re.compile(r"[A-Za-z0-9_.-]{1,64}")
_ACCOUNT = re.compile(r"[\w.:-]{1,80}")


class Invalid(ValueError):
    """Params or a manifest that don't fit; the message is plain words for the owner or the worker."""


class Unavailable(RuntimeError):
    """The data source can't answer (not set up yet, or down)."""


class LoginExpired(RuntimeError):
    """The account needs the owner to sign in again."""


# ---------- the catalogue ----------
@dataclass(frozen=True)
class CapSpec:
    id: str
    label: str
    """Plain words for the publish card and Settings → Apps. ``connector.read`` is labelled per connector."""
    bridge: bool = True
    """False for ``propose``: granted like the others, used only through POST /apps/<id>/proposals."""


CATALOGUE: dict[str, CapSpec] = {
    c.id: c
    for c in (
        CapSpec("calendar.read", "Read your calendars (all accounts)"),
        CapSpec("calendar.calendars", "See the list of your calendars"),
        CapSpec("mail.search", "Search your mail (subjects and senders, not bodies)"),
        CapSpec("mail.accounts", "See which mail accounts you have"),
        CapSpec("connector.read", "Read from a connector"),
        CapSpec("propose", "Ask you to approve actions such as answering invitations", bridge=False),
        CapSpec("state", "Remember its own data, such as high scores and settings (up to 64 KB)"),
    )
}


def cap_key(cap: Capability) -> str:
    """One string per distinct capability (a connector read is per connector and tool)."""
    if cap.get("id") == "connector.read":
        return f"connector.read:{cap.get('connector')}:{cap.get('tool')}"
    return str(cap.get("id"))


def clean_cap(cap: Any) -> Capability:
    """Keeps only the known keys of a capability object (``{id, connector?, tool?}``, the grant shape
    ``app_call`` reads); raises Invalid on anything else."""
    if not isinstance(cap, dict) or not isinstance(cap.get("id"), str):
        raise Invalid("each capability must be an object with an id")
    cid = cap["id"]
    if cid not in CATALOGUE:
        raise Invalid(f"{cid[:40]} is not a capability an app can have")
    if cid != "connector.read":
        return {"id": cid}
    conn, tool = cap.get("connector"), cap.get("tool")
    if not isinstance(conn, str) or not _CONN_ID.fullmatch(conn):
        raise Invalid("connector.read needs a connector id")
    if not isinstance(tool, str) or not _TOOL.fullmatch(tool):
        raise Invalid("connector.read needs a tool name")
    return {"id": cid, "connector": conn, "tool": tool}


def label(cap: Capability, connector_label: str | None = None) -> str:
    if cap.get("id") == "connector.read":
        return f"Read from {connector_label or cap.get('connector')}: {cap.get('tool')}"
    return CATALOGUE[str(cap["id"])].label


def gate_name(cap: Capability) -> str:
    """The tool name the policy gate sees for a bridge call (role ``app``). Connector reads use the agents' own
    name, so every connector rule applies to apps too (``app_call`` gates those)."""
    if cap.get("id") == "connector.read":
        return f"mcp__gateway__{cap['connector']}___{cap['tool']}"
    return f"mcp__app__{cap['id']}"


def subset(wanted: list[Capability], allowed: list[Capability]) -> bool:
    keys = {cap_key(c) for c in allowed}
    return all(cap_key(c) in keys for c in wanted)


# ---------- connectors (records written by the connectors feature, docs/CONNECTORS_SKILLS.md §1.2) ----------
async def connector_tool(ledger: Ledger, connector_id: str, tool: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """(connector record, tool entry) when the connector exists and lists that tool, else None."""
    rec = strip(await ledger.table.get("CONNECTORS", f"CONN#{connector_id}"))
    if not rec:
        return None
    t = next((t for t in rec.get("tools") or [] if isinstance(t, dict) and t.get("name") == tool), None)
    return (rec, t) if t else None


def is_read_only(tool: dict[str, Any]) -> bool:
    """Unknown counts as a write: only ``read_only: true`` and ``destructive: false`` is a read."""
    return tool.get("read_only") is True and tool.get("destructive") is False


# ---------- the manifest ----------
async def check_manifest(raw: bytes, ledger: Ledger) -> tuple[list[Capability], bool]:
    """``aic-app.json`` → (capabilities, pin suggestion). Raises Invalid with the reason."""
    if len(raw) > MANIFEST_MAX_BYTES:
        raise Invalid(f"{MANIFEST} is over 16 KB")
    try:
        m = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as e:
        raise Invalid(f"{MANIFEST} is not valid JSON") from e
    if not isinstance(m, dict):
        raise Invalid(f"{MANIFEST} must be a JSON object")
    unknown = set(m) - {"capabilities", "pin"}
    if unknown:
        raise Invalid(f"{MANIFEST} has unknown keys: {', '.join(sorted(unknown))[:80]}")
    raw_caps = m.get("capabilities", [])
    if not isinstance(raw_caps, list) or len(raw_caps) > MAX_CAPABILITIES:
        raise Invalid(f"capabilities must be a list of at most {MAX_CAPABILITIES}")
    pin = m.get("pin", False)
    if not isinstance(pin, bool):
        raise Invalid("pin must be true or false")
    caps: list[Capability] = []
    seen: set[str] = set()
    for c in raw_caps:
        cap = clean_cap(c)
        if cap_key(cap) in seen:
            continue
        if cap["id"] == "connector.read":
            found = await connector_tool(ledger, cap["connector"], cap["tool"])
            if not found:
                raise Invalid(f"there is no connector {cap['connector']} with a tool {cap['tool']}")
            if not is_read_only(found[1]):
                raise Invalid(f"{cap['connector']}: {cap['tool']} is not a read-only tool")
        seen.add(cap_key(cap))
        caps.append(cap)
    return caps, pin


async def labelled(ledger: Ledger, caps: list[Capability]) -> list[Capability]:
    """Capabilities with their plain ``label`` added, for the publish card and Settings."""
    out = []
    for c in caps:
        name = None
        if c.get("id") == "connector.read":
            rec = strip(await ledger.table.get("CONNECTORS", f"CONN#{c['connector']}"))
            name = (rec or {}).get("label")
        out.append({**c, "label": label(c, name)})
    return out


# ---------- params ----------
def _iso(v: Any, name: str) -> datetime:
    if not isinstance(v, str) or len(v) > 40:
        raise Invalid(f"{name} must be an ISO date")
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError as e:
        raise Invalid(f"{name} must be an ISO date") from e
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def _opt_str(p: dict[str, Any], k: str, max_len: int, pattern: re.Pattern[str] | None = None) -> str | None:
    v = p.get(k)
    if v is None:
        return None
    if not isinstance(v, str) or not v or len(v) > max_len or (pattern and not pattern.fullmatch(v)):
        raise Invalid(f"{k} is not valid")
    return v


def _only(p: dict[str, Any], keys: set[str]) -> None:
    extra = set(p) - keys
    if extra:
        raise Invalid(f"unknown params: {', '.join(sorted(extra))[:80]}")


def check_params(cap: Capability, params: Any) -> dict[str, Any]:
    """Validates a bridge request's params for one capability. Returns the clean params or raises Invalid."""
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise Invalid("params must be an object")
    if len(json.dumps(params, default=str)) > PARAMS_MAX_BYTES:
        raise Invalid("params are too big")
    cid = cap["id"]
    if cid == "calendar.read":
        _only(params, {"from", "to", "calendar_ids"})
        start, end = _iso(params.get("from"), "from"), _iso(params.get("to"), "to")
        if end <= start:
            raise Invalid("to must be after from")
        if end - start > timedelta(days=CALENDAR_MAX_DAYS):
            raise Invalid(f"at most {CALENDAR_MAX_DAYS} days at a time")
        out: dict[str, Any] = {"from": start.isoformat(), "to": end.isoformat()}
        ids = params.get("calendar_ids")
        if ids is not None:
            if (
                not isinstance(ids, list)
                or len(ids) > 50
                or not all(isinstance(i, str) and _ACCOUNT.fullmatch(i) for i in ids)
            ):
                raise Invalid("calendar_ids must be a list of calendar ids")
            out["calendar_ids"] = ids
        return out
    if cid in ("calendar.calendars", "mail.accounts"):
        _only(params, set())
        return {}
    if cid == "mail.search":
        _only(params, {"query", "account_id", "unread_only", "after", "before", "limit"})
        q = params.get("query", "")
        if not isinstance(q, str) or len(q) > 200:
            raise Invalid("query must be text of at most 200 characters")
        out = {"query": q}
        acct = _opt_str(params, "account_id", 80, _ACCOUNT)
        if acct:
            out["account_id"] = acct
        if "unread_only" in params:
            if not isinstance(params["unread_only"], bool):
                raise Invalid("unread_only must be true or false")
            out["unread_only"] = params["unread_only"]
        for k in ("after", "before"):
            if params.get(k) is not None:
                out[k] = _iso(params[k], k).isoformat()
        limit = params.get("limit", MAIL_LIMIT)
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= MAIL_LIMIT:
            raise Invalid(f"limit must be 1 to {MAIL_LIMIT}")
        out["limit"] = limit
        return out
    if cid == "connector.read":
        _only(params, {"connector", "tool", "args"})
        args = params.get("args", {})
        if not isinstance(args, dict):
            raise Invalid("args must be an object")
        return {"connector": cap["connector"], "tool": cap["tool"], "args": args}
    raise Invalid(f"{cid} can't be requested this way")


def check_args_against_schema(args: dict[str, Any], schema: Any) -> None:
    """A small check of a connector tool's input schema (required keys, no unknown keys when closed, types)."""
    if not isinstance(schema, dict):
        return
    props = schema.get("properties") or {}
    for k in schema.get("required") or []:
        if k not in args:
            raise Invalid(f"args.{k} is required")
    if schema.get("additionalProperties") is False:
        extra = set(args) - set(props)
        if extra:
            raise Invalid(f"unknown args: {', '.join(sorted(extra))[:80]}")
    types = {"string": str, "boolean": bool, "object": dict, "array": list}
    for k, v in args.items():
        t = (props.get(k) or {}).get("type")
        if t in types and not isinstance(v, types[t]):
            raise Invalid(f"args.{k} must be a {t}")
        if t in ("number", "integer") and (isinstance(v, bool) or not isinstance(v, int | float)):
            raise Invalid(f"args.{k} must be a number")


def calendar_chunks(start: str, end: str) -> list[tuple[str, str]]:
    """Splits a range into calls of at most 62 days (the mail/calendar module's limit)."""
    a, b = datetime.fromisoformat(start), datetime.fromisoformat(end)
    out = []
    while a < b:
        nxt = min(a + timedelta(days=CALENDAR_CHUNK_DAYS), b)
        out.append((a.isoformat(), nxt.isoformat()))
        a = nxt
    return out


# ---------- proposals: the only outward actions, each a normal owner approval ----------
@dataclass(frozen=True)
class Proposal:
    kind: str
    tool: str
    """The mail/calendar city tool it runs once on approve."""
    check: Callable[[dict[str, Any]], dict[str, Any]]


def _respond(p: dict[str, Any]) -> dict[str, Any]:
    _only(p, {"id", "response", "comment"})
    eid = _opt_str(p, "id", 300)
    if not eid:
        raise Invalid("id is required")
    if p.get("response") not in ("accept", "decline", "tentative"):
        raise Invalid("response must be accept, decline or tentative")
    out = {"id": eid, "response": p["response"]}
    comment = _opt_str(p, "comment", 1000)
    if comment:
        out["comment"] = comment
    return out


def _create(p: dict[str, Any]) -> dict[str, Any]:
    _only(p, {"calendar_id", "title", "start", "end", "all_day", "location", "description", "attendees"})
    cal, title = _opt_str(p, "calendar_id", 300), _opt_str(p, "title", 200)
    if not cal or not title:
        raise Invalid("calendar_id and title are required")
    start, end = _iso(p.get("start"), "start"), _iso(p.get("end"), "end")
    if end < start:
        raise Invalid("end must not be before start")
    out: dict[str, Any] = {"calendar_id": cal, "title": title, "start": p["start"], "end": p["end"]}
    if "all_day" in p:
        if not isinstance(p["all_day"], bool):
            raise Invalid("all_day must be true or false")
        out["all_day"] = p["all_day"]
    for k, n in (("location", 300), ("description", 4000)):
        v = _opt_str(p, k, n)
        if v:
            out[k] = v
    att = p.get("attendees")
    if att is not None:
        if (
            not isinstance(att, list)
            or len(att) > 50
            or not all(isinstance(a, str) and "@" in a and len(a) <= 254 for a in att)
        ):
            raise Invalid("attendees must be a list of email addresses")
        out["attendees"] = att
    return out


def _draft(p: dict[str, Any]) -> dict[str, Any]:
    _only(p, {"account_id", "to", "cc", "bcc", "subject", "body", "reply_to_id"})
    acct = _opt_str(p, "account_id", 80, _ACCOUNT)
    if not acct:
        raise Invalid("account_id is required")
    out: dict[str, Any] = {"account_id": acct}
    for k in ("to", "cc", "bcc"):
        v = p.get(k)
        if v is None and k != "to":
            continue
        if (
            not isinstance(v, list)
            or len(v) > 50
            or not all(isinstance(a, str) and "@" in a and len(a) <= 254 for a in v)
        ):
            raise Invalid(f"{k} must be a list of email addresses")
        out[k] = v
    subject = p.get("subject", "")
    body = p.get("body", "")
    if not isinstance(subject, str) or len(subject) > 300 or not isinstance(body, str) or len(body) > 20_000:
        raise Invalid("subject or body is too long")
    out["subject"], out["body"] = subject, body
    reply = _opt_str(p, "reply_to_id", 300)
    if reply:
        out["reply_to_id"] = reply
    return out


PROPOSALS: dict[str, Proposal] = {
    p.kind: p
    for p in (
        Proposal("calendar.respond", "mcp__city__calendar_respond", _respond),
        Proposal("calendar.create", "mcp__city__calendar_create", _create),
        Proposal("mail.draft", "mcp__city__mail_draft", _draft),
    )
}
PROPOSALS_PER_HOUR = 10


# ---------- what the bridge reads through (injected; defaults answer "unavailable") ----------
class MailReads(Protocol):
    """The read methods of ``aic.mail.service.MailService`` (docs/MAIL_CALENDAR.md §11 on connectors-skills)."""

    async def accounts(self) -> Any: ...
    async def calendars(self) -> Any: ...
    async def events(
        self, start: str, end: str, calendar_ids: list[str] | None = None, query: str | None = None
    ) -> Any: ...
    async def search(
        self,
        query: str,
        account_id: str | None = None,
        folder: str | None = None,
        unread_only: bool = False,
        after: str | None = None,
        before: str | None = None,
        limit: int = 25,
    ) -> Any: ...


NOT_SET_UP = "Mail and calendar are not set up yet."


class NoMail:
    """Until the mail module (branch connectors-skills) is merged."""

    async def accounts(self) -> Any:
        raise Unavailable(NOT_SET_UP)

    async def calendars(self) -> Any:
        raise Unavailable(NOT_SET_UP)

    async def events(
        self, start: str, end: str, calendar_ids: list[str] | None = None, query: str | None = None
    ) -> Any:
        raise Unavailable(NOT_SET_UP)

    async def search(
        self,
        query: str,
        account_id: str | None = None,
        folder: str | None = None,
        unread_only: bool = False,
        after: str | None = None,
        before: str | None = None,
        limit: int = 25,
    ) -> Any:
        raise Unavailable(NOT_SET_UP)


AppCall = Callable[..., Awaitable[dict[str, Any]]]
"""``aic.shared.connector_calls.app_call(d, *, app_id, connector_id, tool, args)`` →
``{ok, data: [{type: "text", text} | {type: "json", json}], truncated, error}`` (docs/CONNECTORS_SKILLS.md §1.9)."""


async def no_app_call(_d: Any, **_: Any) -> dict[str, Any]:
    """Until the connectors module (branch connectors-skills) is merged."""
    return {"ok": False, "data": [], "truncated": False, "error": "unavailable"}


class MailProposals(Protocol):
    """``aic.mail.approvals.file`` / ``execute`` with the service bound (docs/MAIL_CALENDAR.md §11)."""

    async def file(self, tool: str, args: dict[str, Any], requested_by: str) -> dict[str, Any]: ...
    async def execute(self, approval: dict[str, Any]) -> Any: ...


class NoProposals:
    async def file(self, tool: str, args: dict[str, Any], requested_by: str) -> dict[str, Any]:
        raise Unavailable(NOT_SET_UP)

    async def execute(self, approval: dict[str, Any]) -> Any:
        raise Unavailable(NOT_SET_UP)


def plain(v: Any) -> Any:
    """The mail module's dataclasses as the same JSON they have on the wire."""
    if dataclasses.is_dataclass(v) and not isinstance(v, type):
        return plain(dataclasses.asdict(v))
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [plain(x) for x in v]
    return v


def mail_from_env(ledger: Ledger) -> MailReads:
    """``MailService.from_env(ledger)`` once the mail module is in this package; NoMail before that."""
    try:
        from aic.mail.service import MailService  # type: ignore[import-not-found,unused-ignore]
    except ImportError:
        return NoMail()
    try:
        return cast(MailReads, MailService.from_env(ledger))
    except Exception:  # not configured in this function's env
        return NoMail()


def app_call_from_env() -> AppCall:
    try:
        from aic.shared.connector_calls import app_call  # type: ignore[import-not-found,unused-ignore]
    except ImportError:
        return no_app_call
    return cast(AppCall, app_call)


class _BoundProposals:
    def __init__(self, ledger: Ledger, service: Any, approvals: Any) -> None:
        self._ledger, self._service, self._approvals = ledger, service, approvals

    async def file(self, tool: str, args: dict[str, Any], requested_by: str) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            plain(await self._approvals.file(self._ledger, self._service, tool, args, requested_by=requested_by)),
        )

    async def execute(self, approval: dict[str, Any]) -> Any:
        return plain(await self._approvals.execute(self._ledger, self._service, approval))


def proposals_from_env(ledger: Ledger) -> MailProposals:
    try:
        from aic.mail import approvals  # type: ignore[import-not-found,unused-ignore]
    except ImportError:
        return NoProposals()
    service = mail_from_env(ledger)
    return NoProposals() if isinstance(service, NoMail) else _BoundProposals(ledger, service, approvals)
