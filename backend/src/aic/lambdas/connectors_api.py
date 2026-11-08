"""The ``/connectors*`` routes and the add-connector approval hook (``docs/CONNECTORS_SKILLS.md`` §1.3, §1.7).

Called from the api Lambda after its owner-group check. Keys and client secrets go straight to Secrets Manager
or AgentCore Identity: they are never logged, returned or written to the ledger. Answers are ``(status, body)``.
"""

from __future__ import annotations

import asyncio
import hmac
import json
import secrets as pysecrets
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from aic.shared import connector_packages
from aic.shared.connectors import (
    APPROVALS,
    GITHUB_MCP_URL,
    ConnectorStore,
    Record,
    Resolver,
    approval_hash,
    check_url,
    event,
    github_page_hint,
    is_github_server,
    make_id,
    name_from_url,
    public,
    resource_tags,
    system_resolver,
    valid_roles,
)
from aic.shared.events import EventBus
from aic.shared.log import log

from .connector_bridge import OWNER_USER
from .connectors import _provider_input

Answer = tuple[int, Any]
Invoke = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass
class ConnectorsApi:
    store: ConnectorStore
    bus: EventBus
    invoke: Invoke | None = None
    """Invokes the connectors Lambda asynchronously with ``{"action", "id"}``."""
    identity: Any = None
    control: Any = None
    secrets: Any = None
    workload: str | None = None
    hud_origin: str | None = None
    kms_key: str | None = None
    secret_prefix: str = "aic/prod/connectors"  # noqa: S105 (a name prefix, not a secret)
    resolve: Resolver = system_resolver
    tags: dict[str, str] = field(default_factory=resource_tags)
    github_token: Callable[[], Awaitable[str | None]] | None = None
    """The city's GitHub token (Settings → GitHub), so GitHub's MCP server connects without a sign-in."""


def _err(status: int, message: str, fix: str | None = None) -> Answer:
    return status, {"error": message, "fix": fix}


async def _invoke(c: ConnectorsApi, action: str, id: str) -> None:
    if c.invoke is None:
        raise RuntimeError("the connectors Lambda is not configured")
    await c.invoke({"action": action, "id": id})


async def _set(
    c: ConnectorsApi, id: str, patch: Mapping[str, Any], expect: Mapping[str, Any] | None = None
) -> Record | None:
    rec = await c.store.update(id, patch, expect)
    if rec:
        await c.bus.put(event(rec))
    return rec


# ---------- the approval hook (POST /approvals/<id> for kind connector.add) ----------
async def on_connector_approval(c: ConnectorsApi, approval: Mapping[str, Any], approved: bool) -> None:
    rec = await c.store.get(str(approval.get("connector_id") or ""))
    if not rec or rec.get("status") != "pending_approval":
        return
    if not approved:
        await c.store.delete(rec["id"])
        await c.bus.put({**event(rec), "status": "removed"})
        return
    if approval_hash(rec["id"], rec["url"], rec.get("roles") or {}) != approval.get("hash"):
        # The record no longer matches what the owner saw on the card: nothing is provisioned.
        await _set(c, rec["id"], {"status": "error", "error": "It changed after the card was made. Ask AIC again."})
        return
    if await _set(c, rec["id"], {"status": "provisioning"}, {"status": "pending_approval"}):
        await _start(c, rec)


async def _start(c: ConnectorsApi, rec: Record) -> None:
    """Provisions the connector; GitHub's server with the city's GitHub token already saved skips the sign-in and
    uses that token as its bearer key (docs/GITHUB_ACCESS.md §3)."""
    if is_github_server(str(rec.get("url", ""))) and c.github_token and c.secrets and c.control:
        token = await c.github_token()
        if token:
            try:
                await _bearer_key(c, rec, token)
                await _invoke(c, "sync", rec["id"])
                return
            except Exception as e:
                log("warn", "connector.github_token_failed", connector=rec["id"], error=type(e).__name__)
    await _invoke(c, "provision", rec["id"])


async def _bearer_key(c: ConnectorsApi, rec: Record, key: str) -> None:
    """Stores ``key`` as the connector's ``Authorization: Bearer`` credential (an API-key provider over our secret)."""
    id = rec["id"]
    name = f"{c.secret_prefix}/{id}"
    provider = f"aic-conn-{id}-key" if rec.get("auth") == "oauth" else f"aic-conn-{id}"
    arn = await asyncio.to_thread(_store_secret, c, name, json.dumps({"api_key": key}))
    await asyncio.to_thread(_api_key_provider, c, provider, arn)
    if rec.get("auth") == "oauth":  # the owner chose a token over the sign-in: the OAuth provider goes
        try:
            await asyncio.to_thread(
                c.control.delete_oauth2_credential_provider, name=rec.get("provider_name") or f"aic-conn-{id}"
            )
        except Exception as e:
            log("warn", "connector.oauth_provider_delete_failed", connector=id, error=type(e).__name__)
    await _set(
        c,
        id,
        {
            "auth": "api_key",
            "oauth": None,
            "provider_name": provider,
            "secret_name": name,
            "key_header": "Authorization",
            "key_prefix": "Bearer ",
            "status": "syncing",
            "needs": None,
            "error": None,
        },
    )


# ---------- routes ----------
def _roles(v: Any) -> dict[str, str]:
    r = valid_roles(v)
    if r is None:
        raise ValueError("Roles must map AIC, Orchestrator, Managers or Workers to read or all.")
    return r


def _owner_secret(v: Any, name: str, lo: int = 1, hi: int = 4096) -> str:
    if not isinstance(v, str) or not lo <= len(v.strip()) <= hi:
        raise ValueError(f"{name} is missing or the wrong length.")
    return v.strip()


async def route(c: ConnectorsApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]]) -> Answer | None:
    """The answer for a ``/connectors…`` request, or None when the path isn't one of these routes."""
    if not seg or seg[0] != "connectors":
        return None
    try:
        return await _route(c, method, seg, body)
    except ValueError as e:
        return _err(400, str(e))


async def _route(c: ConnectorsApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]]) -> Answer | None:
    n = len(seg)
    if n == 1 and method == "GET":
        return 200, {"connectors": [public(r) for r in sorted(await c.store.list(), key=lambda r: r["id"])]}
    if n == 1 and method == "POST":
        return await _add_direct(c, body())
    if n < 2:
        return None
    rec = await c.store.get(seg[1])
    if not rec:
        return _err(404, "That connector does not exist.")
    id = rec["id"]
    tail = (method, *seg[2:])
    if tail == ("PUT",):
        return await _edit(c, rec, body())
    if tail == ("DELETE",):
        await _set(c, id, {"status": "removing"})
        await _invoke(c, "remove", id)
        return 200, {"ok": True}
    if tail == ("POST", "refresh"):
        if rec.get("status") in ("pending_approval", "removing"):
            return _err(409, "That connector can't be refreshed now.")
        await _set(c, id, {"status": "syncing"})
        await _invoke(c, "sync", id)
        return 200, {"connector": public(await c.store.get(id) or rec)}
    if tail == ("POST", "login"):
        return await _login(c, rec)
    if tail == ("POST", "login", "complete"):
        return await _complete(c, rec, body())
    if tail == ("PUT", "key"):
        return await _key(c, rec, body())
    return None


async def _add_direct(c: ConnectorsApi, b: dict[str, Any]) -> Answer:
    """The owner adds one in Settings: their own action, so it goes straight to provisioning."""
    url = _owner_secret(b.get("url"), "The link", 8, 2000)
    if hint := github_page_hint(url):
        return _err(400, hint, f"Add {GITHUB_MCP_URL} instead.")
    if bad := check_url(url, c.resolve):
        return _err(400, bad)
    label = str(b["label"]).strip()[:40] if b.get("label") else None
    roles = _roles(b.get("roles"))
    id = make_id(name_from_url(url), label)
    rec: Record = {
        "id": id,
        "label": label or name_from_url(url).capitalize(),
        "url": url,
        "source": "owner_url",
        "auth": None,
        "status": "provisioning",
        "roles": roles,
        "approval": "destructive",
        "tools": [],
        "target_id": None,
        "provider_name": f"aic-conn-{id}",
        "requested_by": "owner:settings",
    }
    if not await c.store.create(rec):
        return _err(409, f"There is already a connector called {id}.", "Give it a different label.")
    await c.bus.put(event(rec))
    await _start(c, rec)
    return 201, {"connector": public(await c.store.get(id) or rec)}


async def _edit(c: ConnectorsApi, rec: Record, b: dict[str, Any]) -> Answer:
    patch: dict[str, Any] = {}
    if "roles" in b:
        patch["roles"] = _roles(b["roles"])
    if "approval" in b:
        if b["approval"] not in APPROVALS:
            raise ValueError("Approval must be destructive, writes or none.")
        patch["approval"] = b["approval"]
    if "label" in b:
        patch["label"] = _owner_secret(b["label"], "The label", 1, 40)
    if not patch:
        raise ValueError("Nothing to change.")
    out = await _set(c, rec["id"], patch)
    if "roles" in patch and patch["roles"] != rec.get("roles") and rec.get("status") == "ready":
        await _invoke(c, "refresh", rec["id"])  # re-runs the Cedar rewrite with the new roles
    return 200, {"connector": public(out or rec)}


def _workload_token(c: ConnectorsApi) -> str:
    token: str = c.identity.get_workload_access_token_for_user_id(workloadName=c.workload, userId=OWNER_USER)[
        "workloadAccessToken"
    ]
    return token


async def _login(c: ConnectorsApi, rec: Record) -> Answer:
    if rec.get("auth") != "oauth" or rec.get("status") not in ("needs_login", "login_expired", "ready"):
        return _err(409, "That connector doesn't need a sign-in now.")
    if not (c.identity and c.workload and c.hud_origin):
        return _err(503, "Sign-in isn't set up yet.", "The owner deploys the connectors infrastructure first.")
    state = pysecrets.token_urlsafe(24)
    oauth = dict(rec.get("oauth") or {})

    def ask() -> dict[str, Any]:
        r: dict[str, Any] = c.identity.get_resource_oauth2_token(
            workloadIdentityToken=_workload_token(c),
            resourceCredentialProviderName=rec.get("provider_name") or f"aic-conn-{rec['id']}",
            scopes=list(oauth.get("scopes") or []),
            oauth2Flow="USER_FEDERATION",
            resourceOauth2ReturnUrl=f"{c.hud_origin.rstrip('/')}/?connect=return",  # type: ignore[union-attr]
            forceAuthentication=True,
            customState=state,
        )
        return r

    try:
        r = await asyncio.to_thread(ask)
    except Exception as e:
        log("warn", "connector.login_failed", connector=rec["id"], error=type(e).__name__)
        return _err(502, "AgentCore Identity didn't start the sign-in.", "Try again in a moment.")
    url = r.get("authorizationUrl")
    if not isinstance(url, str):
        return _err(502, "AgentCore Identity didn't give a sign-in link.", "Try again in a moment.")
    session = r.get("sessionUri")
    await c.store.update(
        rec["id"],
        {"oauth": {**oauth, "state": state, **({"session_uri": session} if isinstance(session, str) else {})}},
    )
    # The HUD keeps ``state`` in sessionStorage for the shared ``?connect=return`` handler (MAIL_CALENDAR.md §7).
    return 200, {"url": url, "state": state}


async def _complete(c: ConnectorsApi, rec: Record, b: dict[str, Any]) -> Answer:
    state = (rec.get("oauth") or {}).get("state")
    given = b.get("state")
    if not (isinstance(state, str) and isinstance(given, str) and hmac.compare_digest(state, given)):
        return _err(400, "That sign-in doesn't match the one started here.", "Start the sign-in again.")
    stored = (rec.get("oauth") or {}).get("session_uri")
    session_uri = _owner_secret(b.get("session_uri") or stored, "The session", 1, 2048)
    try:
        await asyncio.to_thread(
            c.identity.complete_resource_token_auth, sessionUri=session_uri, userIdentifier={"userId": OWNER_USER}
        )
    except Exception as e:
        log("warn", "connector.login_complete_failed", connector=rec["id"], error=type(e).__name__)
        return _err(502, "The sign-in couldn't be finished.", "Start the sign-in again.")
    oauth = {k: v for k, v in (rec.get("oauth") or {}).items() if k not in ("state", "session_uri")}
    out = await _set(c, rec["id"], {"oauth": oauth, "status": "syncing", "error": None})
    await _invoke(c, "sync", rec["id"])
    return 200, {"connector": public(out or rec)}


def _exists(e: Exception) -> bool:
    return any(w in type(e).__name__ for w in ("Exists", "Conflict"))


async def _key(c: ConnectorsApi, rec: Record, b: dict[str, Any]) -> Answer:
    if not (c.secrets and c.control):
        return _err(503, "Keys can't be stored yet.", "The owner deploys the connectors infrastructure first.")
    id = rec["id"]
    if "env" in b:  # §1.10: a package connector's variables, stored as {"env": {…}} (no Identity provider)
        return await _store_env(c, rec, connector_packages.env_secret(rec, b["env"]))
    if "api_key" in b:
        if rec.get("auth") not in ("api_key", "oauth"):
            return _err(409, "That connector doesn't use an API key.")
        key = _owner_secret(b.get("api_key"), "The key", 8, 4096)
        if rec.get("auth") == "oauth":  # "I have a token instead": the token becomes the bearer key
            try:
                await _bearer_key(c, rec, key)
            except Exception as e:
                log("warn", "connector.key_failed", connector=id, error=type(e).__name__)
                return _err(502, "The token couldn't be stored.", "Try again in a moment.")
            await _invoke(c, "sync", id)
            return 200, {"ok": True}
        name = f"{c.secret_prefix}/{id}"
        try:
            arn = await asyncio.to_thread(_store_secret, c, name, json.dumps({"api_key": key}))
            await asyncio.to_thread(_api_key_provider, c, rec.get("provider_name") or f"aic-conn-{id}", arn)
        except Exception as e:
            log("warn", "connector.key_failed", connector=id, error=type(e).__name__)
            return _err(502, "The key couldn't be stored.", "Try again in a moment.")
        await _set(c, id, {"secret_name": name, "status": "syncing", "needs": None, "error": None})
        await _invoke(c, "sync", id)
        return 200, {"ok": True}
    if "client_id" in b:
        oauth = rec.get("oauth") or {}
        if rec.get("auth") != "oauth" or not oauth.get("metadata"):
            return _err(409, "That connector doesn't take an OAuth client.")
        cid = _owner_secret(b.get("client_id"), "The client id", 1, 512)
        csecret = _owner_secret(b.get("client_secret"), "The client secret", 1, 4096)
        vendor, cfg = _provider_input(oauth["metadata"], cid, csecret)
        try:
            await asyncio.to_thread(
                c.control.update_oauth2_credential_provider,
                name=rec.get("provider_name") or f"aic-conn-{id}",
                credentialProviderVendor=vendor,
                oauth2ProviderConfigInput=cfg,
            )
        except Exception as e:
            log("warn", "connector.client_failed", connector=id, error=type(e).__name__)
            return _err(502, "The client couldn't be stored.", "Try again in a moment.")
        m2m = oauth.get("flow") == "client_credentials"  # §1.11: no sign-in, Identity runs the M2M flow
        status = "syncing" if m2m else "needs_login"
        await _set(c, id, {"oauth": {**oauth, "registered": "owner"}, "status": status, "needs": None})
        if m2m:
            await _invoke(c, "sync", id)
        return 200, {"ok": True}
    raise ValueError("Send api_key, or client_id and client_secret.")


async def _store_env(c: ConnectorsApi, rec: Record, value: str) -> Answer:
    name = f"{c.secret_prefix}/{rec['id']}"
    try:
        await asyncio.to_thread(_store_secret, c, name, value)
    except Exception as e:
        log("warn", "connector.key_failed", connector=rec["id"], error=type(e).__name__)
        return _err(502, "The settings couldn't be stored.", "Try again in a moment.")
    await _set(c, rec["id"], {"secret_name": name, "status": "syncing", "needs": None, "error": None})
    await _invoke(c, "sync", rec["id"])
    return 200, {"ok": True}


def _store_secret(c: ConnectorsApi, name: str, value: str) -> str:
    try:
        r = c.secrets.create_secret(
            Name=name,
            SecretString=value,
            **({"KmsKeyId": c.kms_key} if c.kms_key else {}),
            Tags=[{"Key": k, "Value": v} for k, v in c.tags.items()],
        )
    except Exception as e:
        if not _exists(e):
            raise
        r = c.secrets.put_secret_value(SecretId=name, SecretString=value)
    arn: str = r["ARN"]
    return arn


def _api_key_provider(c: ConnectorsApi, name: str, secret_arn: str) -> None:
    """The API-key provider reads the key from our secret (EXTERNAL), so Identity never holds a copy."""
    kw = {"apiKeySecretSource": "EXTERNAL", "apiKeySecretConfig": {"secretId": secret_arn, "jsonKey": "api_key"}}
    try:
        c.control.create_api_key_credential_provider(name=name, tags=c.tags, **kw)
    except Exception as e:
        if not _exists(e):
            raise
        c.control.update_api_key_credential_provider(name=name, **kw)
