"""Connector reads for apps (``docs/CONNECTORS_SKILLS.md`` §1.9; ``docs/APPS.md`` v2, capability ``connector.read``).

The apps bridge route (``POST /apps/<app_id>/bridge``, in the api Lambda) calls ``app_call``. It checks, in
order: the app's grant, that the connector is ready and the tool read-only (outward or destructive tools never,
whatever the grant says), and the policy gate as role ``app`` (an "ask" is a deny: apps can't ask). Only then
does it call the Gateway, with the api Lambda's own role, which Cedar limits to read-only tools. The data is
returned for code, not a model, and is still untrusted.
"""

from __future__ import annotations

import json
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol, TypedDict

from .connectors import ConnectorStore, gateway_name, is_read_only, record_tool
from .ledger import Ledger
from .log import log
from .policy import gate

MAX_CHARS = 100_000
"""The apps contract's 100 KB of text."""


class AppCallPart(TypedDict, total=False):
    type: str
    text: str
    json: Any


class AppCallResult(TypedDict):
    ok: bool
    data: list[AppCallPart]
    truncated: bool
    error: str | None


class GatewayCaller(Protocol):
    async def call_tool(self, name: str, args: dict[str, Any], wait_s: float = ...) -> dict[str, Any]: ...


@dataclass
class AppCallDeps:
    ledger: Ledger
    gateway: GatewayCaller | None
    """``aic.runtime.gateway.GatewayClient`` signed with the api Lambda's role; None = not configured."""


def _no(error: str) -> AppCallResult:
    return {"ok": False, "data": [], "truncated": False, "error": error}


async def _app_grants(ledger: Ledger, app_id: str) -> list[Mapping[str, Any]]:
    """The app's current grants, read from the APP record that the apps contract owns (``APPS`` /
    ``APP#<app_id>``, field ``grants``). The one place that knows the record's shape: if the apps contract
    changes it, change this function."""
    rec = await ledger.table.get("APPS", f"APP#{app_id}")
    grants = (rec or {}).get("grants") or []
    return [g for g in grants if isinstance(g, Mapping)]


def _granted(grants: list[Mapping[str, Any]], connector_id: str, tool: str) -> bool:
    return any(
        g.get("id") == "connector.read"
        and g.get("connector") == connector_id
        and g.get("tool") == tool
        and not g.get("revoked")
        for g in grants
    )


def _parts(result: Mapping[str, Any]) -> tuple[list[AppCallPart], bool, str | None]:
    """Text and JSON parts only, capped at 100,000 characters in all."""
    raw = [p for p in result.get("content") or [] if isinstance(p, Mapping)]
    err: str | None = None
    if len(raw) == 1 and raw[0].get("type") == "text":  # the Gateway's wrapping of the bridge's answer
        try:
            inner = json.loads(str(raw[0].get("text", "")))
        except json.JSONDecodeError:
            inner = None
        if isinstance(inner, dict) and isinstance(inner.get("content"), list):
            raw = [p for p in inner["content"] if isinstance(p, Mapping)]
            err = inner.get("aic_error")
    out: list[AppCallPart] = []
    left, cut = MAX_CHARS, False
    for p in (p for p in raw if p.get("type") == "text"):
        if left <= 0:
            cut = True
            break
        text = str(p.get("text", ""))
        if len(text) > left:
            text, cut = text[:left], True
        left -= len(text)
        out.append(_json_or_text(text, cut))
    return out, cut, err


def _json_or_text(text: str, cut: bool) -> AppCallPart:
    if not cut and text[:1] in ("[", "{"):
        try:
            return {"type": "json", "json": json.loads(text)}
        except json.JSONDecodeError:
            pass
    return {"type": "text", "text": text}


async def app_call(d: AppCallDeps, *, app_id: str, connector_id: str, tool: str, args: dict[str, Any]) -> AppCallResult:
    # 1. The grant: owner-approved at publish, not revoked since.
    if not _granted(await _app_grants(d.ledger, app_id), connector_id, tool):
        return _no("not_granted")
    # 2. Ready, and read-only by the server's own annotations. Unknown counts as a write.
    rec = await ConnectorStore(d.ledger.table).get(connector_id)
    if not rec or rec.get("status") != "ready":
        return _no("login_expired" if rec and rec.get("status") == "login_expired" else "unavailable")
    t = record_tool(rec, tool)
    if not t or not is_read_only(t):
        return _no("not_read_only")
    # 3. The policy gate as role "app"; an ask is a deny, because apps can't ask.
    name = f"mcp__app__connector___{gateway_name(connector_id, tool)}"
    t0 = time.monotonic()
    r = await gate(name, args, "app", f"app-{app_id}")
    await d.ledger.audit_tool(f"app-{app_id}", name, r.decision, r.reason)
    if r.decision != "allow":
        return _no("denied")
    if d.gateway is None:
        return _no("unavailable")
    try:
        result = await d.gateway.call_tool(gateway_name(connector_id, tool), dict(args))
    except Exception as e:
        log("warn", "app_call.failed", app=app_id, connector=connector_id, error=type(e).__name__)
        return _no("unavailable")
    parts, cut, err = _parts(result)
    log("info", "app_call", app=app_id, connector=connector_id, ms=round((time.monotonic() - t0) * 1000))
    if err:
        return _no("login_expired" if err == "login_expired" else "unavailable")
    if result.get("isError"):
        return {"ok": False, "data": parts, "truncated": cut, "error": "tool_error"}
    return {"ok": True, "data": parts, "truncated": cut, "error": None}
