"""The ``/mail/*`` routes (``docs/MAIL_CALENDAR.md`` §2, §4). Owner only, like every route.

Request bodies are never logged here (an IMAP app password passes through ``/mail/accounts/<id>/imap`` once,
over TLS, straight into Secrets Manager). Answers are ``(status, body)``."""

from __future__ import annotations

import asyncio
import contextlib
import json
import secrets as _secrets
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from aic.mail.accounts import PROVIDERS, SIGNIN_SECONDS, AccountStore, mail_config, public
from aic.mail.http import ProviderError, Unauthorized, call
from aic.mail.providers.caldav import CalDav
from aic.mail.providers.imap import Imap
from aic.mail.rules import RuleInvalid, RuleStore, check_rule
from aic.mail.service import MailError, MailService
from aic.shared.connectors import resource_tags
from aic.shared.log import log

Answer = tuple[int, Any]
_USERINFO = {
    "google": "https://openidconnect.googleapis.com/v1/userinfo",
    "microsoft": "https://graph.microsoft.com/v1.0/me",
}


def _mail_tags() -> dict[str, str]:
    return {**resource_tags(), "Component": "mail"}


@dataclass
class MailApi:
    service: MailService
    secrets: Any = None
    hud_origin: str | None = None
    kms_key: str | None = None
    bus_put: Callable[[dict[str, Any]], Awaitable[None]] | None = None
    tags: dict[str, str] = field(default_factory=_mail_tags)

    @property
    def store(self) -> AccountStore:
        return self.service.store

    async def tell(self, a: dict[str, Any]) -> None:
        if self.bus_put:
            await self.bus_put({"type": "mail.account", "account": public(a)})


def _err(status: int, message: str, fix: str | None = None) -> Answer:
    return status, {"error": message, "fix": fix}


def _str(v: Any, name: str, lo: int = 1, hi: int = 300) -> str:
    s = str(v or "").strip()
    if not lo <= len(s) <= hi:
        raise MailError(f"{name} is missing or too long.")
    return s


async def route(c: MailApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]]) -> Answer | None:
    try:
        return await _route(c, method, seg, body)
    except (MailError, RuleInvalid) as e:
        return _err(400, str(e))


async def _route(c: MailApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]]) -> Answer | None:
    if seg[:2] == ["mail", "accounts"]:
        if len(seg) == 2 and method == "GET":
            return 200, {"accounts": [public(a) for a in await c.store.all()]}
        if len(seg) == 2 and method == "POST":
            b = body()
            if b.get("provider") not in PROVIDERS:
                return _err(400, "Pick Google, Microsoft or another provider (IMAP).")
            a = await c.store.create(
                str(b["provider"]), _str(b.get("label") or b["provider"].capitalize(), "Label", 1, 40)
            )
            await c.tell(a)
            return 201, {"account": public(a)}
        if len(seg) < 3:
            return None
        got = await c.store.get(seg[2])
        if got is None:
            return _err(404, "That account doesn't exist.")
        a = got
        if len(seg) == 3 and method == "PUT":
            return await _edit(c, a, body())
        if len(seg) == 3 and method == "DELETE":
            return await _delete(c, a)
        if len(seg) == 4 and method == "POST" and seg[3] == "signin":
            return await _signin(c, a)
        if len(seg) == 4 and method == "POST" and seg[3] == "complete":
            return await _complete(c, a, body())
        if len(seg) == 4 and method == "POST" and seg[3] == "imap":
            return await _imap(c, a, body())
        return None
    if seg[:2] == ["mail", "rules"]:
        rules = RuleStore(c.store.table, c.store.now)
        if len(seg) == 2 and method == "GET":
            return 200, {"rules": await rules.all()}
        if len(seg) == 2 and method == "POST":
            ids = {a["id"] for a in await c.store.connected()}
            return 201, {"rule": await rules.add(check_rule(body(), ids))}
        if len(seg) == 3 and method == "DELETE":
            return (200, {"ok": True}) if await rules.delete(seg[2]) else _err(404, "That rule doesn't exist.")
    return None


async def _edit(c: MailApi, a: dict[str, Any], b: dict[str, Any]) -> Answer:
    patch: dict[str, Any] = {}
    if "label" in b:
        patch["label"] = _str(b["label"], "Label", 1, 40)
    if "color" in b:
        if b["color"] not in mail_config()["palette"]:
            return _err(400, "Pick one of the palette colours.")
        patch["color"] = b["color"]
    for k in ("mail", "calendar"):
        if isinstance(b.get(k), bool):
            patch[k] = b[k]
    if isinstance(b.get("calendars"), list):
        want = {str(x.get("id")): x for x in b["calendars"] if isinstance(x, dict)}
        patch["calendars"] = [
            {**cal, **({"hidden": bool(want[cal["id"]]["hidden"])} if "hidden" in want.get(cal["id"], {}) else {})}
            for cal in a.get("calendars") or []
        ]
    n = await c.store.update(a["id"], patch)
    assert n is not None
    await c.tell(n)
    return 200, {"account": public(n)}


async def _delete(c: MailApi, a: dict[str, Any]) -> Answer:
    if a.get("provider") == "imap" and c.secrets is not None:
        try:
            await asyncio.to_thread(
                c.secrets.delete_secret, SecretId=f"aic/prod/mail/{a['id']}", RecoveryWindowInDays=7
            )
        except Exception as e:
            if "ResourceNotFound" not in type(e).__name__ + str(e):
                raise
    await c.store.delete(a["id"])
    c.service.tokens.forget(a["id"])
    if c.bus_put:
        await c.bus_put({"type": "mail.account", "account": {**public(a), "status": "removed"}})
    revoke = {
        "google": "Also remove AI City's access at myaccount.google.com/permissions.",
        "microsoft": "Also remove AI City's access at myapps.microsoft.com (or account.live.com/consent/Manage).",
    }.get(a.get("provider", ""))
    return 200, {"ok": True, "note": revoke}


async def _signin(c: MailApi, a: dict[str, Any]) -> Answer:
    if a.get("provider") not in ("google", "microsoft"):
        return _err(400, "This account uses an app password, not a sign-in.")
    if not c.hud_origin:
        return _err(503, "Sign-in isn't set up yet (no HUD address).", "The owner adds it with the next deploy.")
    state = _secrets.token_urlsafe(16)
    url, session_uri = await c.service.tokens.start_signin(a, f"{c.hud_origin.rstrip('/')}/?connect=return", state)
    if not url:
        return await _finish(c, a)
    n = await c.store.update(
        a["id"],
        {
            "status": "signing_in",
            "session_uri": session_uri,
            "state": state,
            "session_expires_at": int(time.time()) + SIGNIN_SECONDS,
            "error": None,
        },
    )
    assert n is not None
    return 200, {"url": url, "state": state}


async def _complete(c: MailApi, a: dict[str, Any], b: dict[str, Any]) -> Answer:
    if a.get("status") != "signing_in" or not a.get("session_uri"):
        return _err(409, "There's no sign-in waiting for this account.", "Tap Sign in again.")
    if int(a.get("session_expires_at") or 0) < time.time():
        return _err(409, "That sign-in took too long.", "Tap Sign in again.")
    if b.get("state") and b["state"] != a.get("state"):
        return _err(400, "That sign-in doesn't belong to this account.")
    await c.service.tokens.complete_signin(a, str(a["session_uri"]))
    return await _finish(c, a)


async def _finish(c: MailApi, a: dict[str, Any]) -> Answer:
    """Fetches a token, reads the address and the calendars, and marks the account connected."""
    try:
        token = await c.service.tokens.access_token(a)
        me = await call(c.service.http, "GET", _USERINFO[a["provider"]], token)
        address = (
            (me.get("email") or me.get("mail") or me.get("userPrincipalName") or "") if isinstance(me, dict) else ""
        )
    except Exception as e:
        n = await c.store.update(a["id"], {"status": "error", "error": "The sign-in didn't give AI City access."})
        log("warn", "mail.signin_failed", account=a["id"], error=type(e).__name__)
        if n:
            await c.tell(n)
        return _err(502, "The sign-in didn't give AI City access.", "Try Sign in again.")
    n = await c.store.update(
        a["id"],
        {
            "status": "connected",
            "address": str(address)[:200],
            "session_uri": None,
            "state": None,
            "session_expires_at": None,
            "error": None,
        },
    )
    assert n is not None
    with contextlib.suppress(Exception):
        await c.service.calendars()
    n = await c.store.get(a["id"]) or n
    await c.tell(n)
    return 200, {"account": public(n)}


async def _imap(c: MailApi, a: dict[str, Any], b: dict[str, Any]) -> Answer:
    if a.get("provider") != "imap":
        return _err(400, "Only IMAP accounts take an app password.")
    password = str(b.get("password") or "")
    if not 1 <= len(password) <= 500:
        return _err(400, "Add the app password.")
    address = _str(b.get("address"), "Address", 3, 200)
    conf: dict[str, Any] = {
        "imap_host": _str(b.get("imap_host"), "IMAP server", 3, 200),
        "imap_port": int(b.get("imap_port") or 993),
        "smtp_host": _str(b.get("smtp_host"), "SMTP server", 3, 200),
        "smtp_port": int(b.get("smtp_port") or 465),
        "smtp_starttls": bool(b.get("smtp_starttls")),
        "username": str(b.get("username") or address)[:200],
    }
    if b.get("caldav_url"):
        conf["caldav_url"] = _str(b["caldav_url"], "CalDAV address", 10, 500)

    async def pw() -> str:
        return password

    try:
        await Imap(conf, address, pw, c.service.imap_factory, c.service.smtp_factory).check()
        if conf.get("caldav_url"):
            await CalDav(c.service.http, conf["caldav_url"], conf["username"], pw).calendars()
    except Unauthorized as e:
        return _err(400, str(e), "Check the app password (not your normal password) and the server names.")
    except (ProviderError, OSError, ValueError) as e:
        return _err(
            400,
            f"Couldn't reach the mail server: {str(e)[:200] or type(e).__name__}.",
            "Check the server names and ports.",
        )
    name = f"aic/prod/mail/{a['id']}"
    value = json.dumps({"password": password})
    kw: dict[str, Any] = {"KmsKeyId": c.kms_key} if c.kms_key else {}
    try:
        await asyncio.to_thread(
            c.secrets.create_secret,
            Name=name,
            SecretString=value,
            Tags=[{"Key": k, "Value": v} for k, v in c.tags.items()],
            **kw,
        )
    except Exception as e:
        if "ResourceExists" not in type(e).__name__ + str(e):
            raise
        await asyncio.to_thread(c.secrets.put_secret_value, SecretId=name, SecretString=value)
    c.service.tokens.forget(a["id"])
    n = await c.store.update(
        a["id"], {"status": "connected", "address": address, "imap": conf, "secret_name": name, "error": None}
    )
    assert n is not None
    await c.tell(n)
    return 200, {"account": public(n)}
