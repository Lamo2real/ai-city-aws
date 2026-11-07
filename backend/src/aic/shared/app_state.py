"""Per-app state (docs/APPS.md § v3): a small key-value store a granted app keeps for itself, such as high
scores and settings.

The api Lambda serves ``state.get`` / ``state.set`` itself: the grant ``state``, the params, then the policy gate as
role ``app`` (``mcp__app__state.get`` / ``mcp__app__state.set``) and the audit. The app id always comes from the
route, so an app can only ever name its own keys. Values are the app's own untrusted data, stored as JSON text.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .events import now_iso
from .ledger import Ledger, Record
from .policy import gate

STATE_CAPS = ("state.get", "state.set")
KEY = re.compile(r"[A-Za-z0-9_.-]{1,64}")
VALUE_MAX_BYTES = 4 * 1024
MAX_KEYS = 50
MAX_TOTAL_BYTES = 64 * 1024


class StateInvalid(ValueError):
    """Plain words for the app."""


def state_pk(app_id: str) -> str:
    return f"APPSTATE#{app_id}"


def check_state_params(cap: str, params: Any) -> tuple[str, Any]:
    """→ (key, value). ``value`` is only meaningful for ``state.set`` (None deletes)."""
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise StateInvalid("params must be an object")
    allowed = {"key"} if cap == "state.get" else {"key", "value"}
    extra = set(params) - allowed
    if extra:
        raise StateInvalid(f"unknown params: {', '.join(sorted(extra))[:80]}")
    key = params.get("key")
    if not isinstance(key, str) or not KEY.fullmatch(key):
        raise StateInvalid("key must be 1 to 64 letters, digits, dots, dashes or underscores")
    if cap == "state.get":
        return key, None
    if "value" not in params:
        raise StateInvalid("value is required (null deletes the key)")
    value = params["value"]
    if value is not None and len(json.dumps(value).encode()) > VALUE_MAX_BYTES:
        raise StateInvalid("a value can be at most 4 KB")
    return key, value


async def get_value(ledger: Ledger, app_id: str, key: str) -> Any:
    it = await ledger.table.get(state_pk(app_id), f"KEY#{key}")
    return json.loads(str(it["value"])) if it else None


async def set_value(ledger: Ledger, app_id: str, key: str, value: Any) -> None:
    """Sets (or with ``None`` deletes) one key, within 50 keys and 64 KB per app."""
    if value is None:
        await ledger.table.delete(state_pk(app_id), f"KEY#{key}")
        return
    text = json.dumps(value, separators=(",", ":"))
    rows = await ledger.table.query(state_pk(app_id), "KEY#")
    others = [r for r in rows if r.get("sk") != f"KEY#{key}"]
    if len(others) >= MAX_KEYS:
        raise StateInvalid(f"an app can keep at most {MAX_KEYS} keys")
    if sum(int(r.get("size", 0)) for r in others) + len(text.encode()) > MAX_TOTAL_BYTES:
        raise StateInvalid("an app can keep at most 64 KB")
    await ledger.table.put(
        {
            "pk": state_pk(app_id),
            "sk": f"KEY#{key}",
            "value": text,
            "size": len(text.encode()),
            "updated_at": now_iso(ledger.now()),
        }
    )


async def delete_state(ledger: Ledger, app_id: str) -> int:
    rows = await ledger.table.query(state_pk(app_id), "KEY#")
    for r in rows:
        await ledger.table.delete(state_pk(app_id), str(r["sk"]))
    return len(rows)


async def serve_state(ledger: Ledger, app: Record, cap: str, params: Any) -> dict[str, Any]:
    """``state.get`` → ``{ok, data: {value}}``; ``state.set`` → ``{ok, data: {}}``; else ``{ok: false, error}``.
    The caller has checked the grant and the rate limit."""
    try:
        key, value = check_state_params(cap, params)
    except StateInvalid as e:
        return {"ok": False, "error": "invalid", "message": str(e)}
    agent = f"app-{app['app_id']}"
    name = f"mcp__app__{cap}"
    g = await gate(name, {"key": key}, "app", agent)  # the value is the app's data: never audited
    await ledger.audit_tool(agent, name, g.decision, g.reason)
    if g.decision != "allow":
        return {"ok": False, "error": "not_granted", "message": "The city's policy doesn't allow that."}
    if cap == "state.get":
        return {"ok": True, "data": {"value": await get_value(ledger, str(app["app_id"]), key)}}
    try:
        await set_value(ledger, str(app["app_id"]), key, value)
    except StateInvalid as e:
        return {"ok": False, "error": "invalid", "message": str(e)}
    return {"ok": True, "data": {}}
