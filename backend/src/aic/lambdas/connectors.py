"""Lambda ``aic-prod-connectors``: the admin side of connectors (``docs/CONNECTORS_SKILLS.md`` §1.3, §1.5).

Invoked asynchronously by the api Lambda, only after the owner said yes (or acted in Settings):
- ``provision``: probe the server and find out how it signs in (none, API key, OAuth with discovery, dynamic
  client registration and an AgentCore Identity provider).
- ``sync`` / ``refresh``: list the server's tools with the credential, map them to Gateway tool schemas, create
  or update the Lambda target ``<id>``, and rewrite the Cedar policies.
- ``remove``: delete the target, the provider, the secret (7-day recovery), the policies' entries and the record.
- ``policies``: only rewrite the Cedar policies (the apps code calls it after a publish, a removal or a grant change).
Every step emits ``connector.updated``. Errors are plain words on the record; credentials are never logged.
"""

from __future__ import annotations

import asyncio
import json
import re
import urllib.parse
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from aic.connectors import openapi_admin
from aic.shared import connector_packages
from aic.shared.connectors import (
    LEVELS,
    ROLES,
    ConnectorStore,
    Record,
    Resolver,
    check_url,
    gateway_name,
    is_read_only,
    resource_tags,
    system_resolver,
    tool_entry,
)
from aic.shared.events import EventBus
from aic.shared.log import log
from aic.shared.mcp_http import HttpResponse, McpError, McpHttp, Transport, urllib_transport

from ._runtime import run
from .connector_bridge import NeedsKey, NeedsLogin, credential_headers, remote_client

PROBE_TIMEOUT = 10
VENDORS: dict[str, tuple[str, str]] = {
    # issuer host -> (credentialProviderVendor, config key)
    "github.com": ("GithubOauth2", "githubOauth2ProviderConfig"),
    "slack.com": ("SlackOauth2", "slackOauth2ProviderConfig"),
    "accounts.google.com": ("GoogleOauth2", "googleOauth2ProviderConfig"),
    "login.microsoftonline.com": ("MicrosoftOauth2", "microsoftOauth2ProviderConfig"),
    "auth.atlassian.com": ("AtlassianOauth2", "atlassianOauth2ProviderConfig"),
    "login.salesforce.com": ("SalesforceOauth2", "salesforceOauth2ProviderConfig"),
    "www.linkedin.com": ("LinkedinOauth2", "linkedinOauth2ProviderConfig"),
}
PENDING_CLIENT = "pending"
"""Placeholder client id/secret while the real client is registered (the provider must exist to get its
callback URL first)."""


@dataclass
class ConnectorsDeps:
    store: ConnectorStore
    bus: EventBus
    control: Any
    """boto3 ``bedrock-agentcore-control``."""
    identity: Any
    """boto3 ``bedrock-agentcore`` (data plane)."""
    secrets: Any
    """boto3 ``secretsmanager``."""
    gateway_id: str
    policy_engine_id: str
    bridge_arn: str
    workload: str
    app_role: str = "aic-prod-fn-app-bridge"
    name_prefix: str = "aic-prod"
    transport: Transport = urllib_transport
    resolve: Resolver = system_resolver
    tags: dict[str, str] = field(default_factory=resource_tags)
    mcp_host_arn: str = ""


async def _emit(d: ConnectorsDeps, rec: Record | None) -> None:
    from aic.shared.connectors import event

    if rec:
        await d.bus.put(event(rec))


async def _set(d: ConnectorsDeps, id: str, patch: Mapping[str, Any]) -> Record | None:
    rec = await d.store.update(id, patch)
    await _emit(d, rec)
    return rec


async def _fail(d: ConnectorsDeps, id: str, reason: str) -> Record | None:
    log("warn", "connector.error", connector=id, reason=reason[:120])
    return await _set(d, id, {"status": "error", "error": reason})


async def _get_json(d: ConnectorsDeps, url: str) -> dict[str, Any] | None:
    if check_url(url, d.resolve):
        return None
    r: HttpResponse = await asyncio.to_thread(d.transport, url, {"accept": "application/json"}, b"", PROBE_TIMEOUT)
    if r.status != 200:
        return None
    try:
        body = json.loads(r.body)
    except json.JSONDecodeError:
        return None
    return body if isinstance(body, dict) else None


# ---------- provision ----------
_RM = re.compile(r'resource_metadata="?([^",\s]+)"?', re.I)


async def provision(d: ConnectorsDeps, id: str) -> Record | None:
    rec = await d.store.get(id)
    if not rec or rec.get("status") != "provisioning":
        return rec
    if rec.get("transport") == "package":  # §1.10
        return await connector_packages.provision(d, rec, _set, sync)
    if bad := check_url(str(rec.get("url", "")), d.resolve):
        return await _fail(d, id, bad)
    try:
        await McpHttp(rec["url"], d.transport, timeout=PROBE_TIMEOUT).initialize(PROBE_TIMEOUT)
        await _set(d, id, {"auth": "none", "status": "syncing", "error": None, "needs": None})
        return await sync(d, id)
    except McpError as e:
        status, headers = e.status, e.headers
    except Exception as e:
        return await _fail(d, id, f"The server could not be reached ({type(e).__name__}).")
    if status == 401:
        meta = await _discover(d, rec, headers.get("www-authenticate", ""))
        if meta:
            return await _oauth(d, rec, *meta)
    if status in (401, 403) or rec.get("key_header"):
        return await _set(
            d,
            id,
            {
                "auth": "api_key",
                "status": "needs_key",
                "needs": "api_key",
                "error": None,
                "key_header": rec.get("key_header") or "Authorization",
                "key_prefix": None if rec.get("key_header") else "Bearer ",
            },
        )
    return await _fail(d, id, f"The server answered HTTP {status}; it may not be an MCP server.")


async def _discover(d: ConnectorsDeps, rec: Record, www: str) -> tuple[dict[str, Any], list[str]] | None:
    """(authorization server metadata, scopes) from the MCP authorization spec's discovery, or None."""
    p = urllib.parse.urlsplit(rec["url"])
    m = _RM.search(www)
    candidates = [m.group(1)] if m else []
    candidates.append(f"{p.scheme}://{p.netloc}/.well-known/oauth-protected-resource{p.path.rstrip('/')}")
    candidates.append(f"{p.scheme}://{p.netloc}/.well-known/oauth-protected-resource")
    prm = None
    for url in candidates:
        prm = await _get_json(d, url)
        if prm and prm.get("authorization_servers"):
            break
    if not prm or not prm.get("authorization_servers"):
        return None
    issuer = str(prm["authorization_servers"][0]).rstrip("/")
    ip = urllib.parse.urlsplit(issuer)
    path = ip.path.rstrip("/")
    for url in (
        f"{ip.scheme}://{ip.netloc}/.well-known/oauth-authorization-server{path}",
        f"{ip.scheme}://{ip.netloc}/.well-known/openid-configuration{path}",
        f"{issuer}/.well-known/openid-configuration",
    ):
        asm = await _get_json(d, url)
        if asm and asm.get("authorization_endpoint") and asm.get("token_endpoint"):
            scopes = [str(s) for s in prm.get("scopes_supported") or asm.get("scopes_supported") or []][:20]
            return asm, scopes
    return None


def _provider_input(asm: Mapping[str, Any], client_id: str, client_secret: str) -> tuple[str, dict[str, Any]]:
    host = urllib.parse.urlsplit(str(asm.get("issuer", ""))).hostname or ""
    if host in VENDORS:
        vendor, key = VENDORS[host]
        return vendor, {key: {"clientId": client_id, "clientSecret": client_secret}}
    return "CustomOauth2", {
        "customOauth2ProviderConfig": {
            "oauthDiscovery": {
                "authorizationServerMetadata": {
                    "issuer": str(asm.get("issuer") or ""),
                    "authorizationEndpoint": str(asm["authorization_endpoint"]),
                    "tokenEndpoint": str(asm["token_endpoint"]),
                    "responseTypes": ["code"],
                }
            },
            "clientId": client_id,
            "clientSecret": client_secret,
        }
    }


async def _oauth(d: ConnectorsDeps, rec: Record, asm: dict[str, Any], scopes: list[str]) -> Record | None:
    id = rec["id"]
    name = f"aic-conn-{id}"
    vendor, cfg = _provider_input(asm, PENDING_CLIENT, PENDING_CLIENT)
    try:
        created = await asyncio.to_thread(
            d.control.create_oauth2_credential_provider,
            name=name,
            credentialProviderVendor=vendor,
            oauth2ProviderConfigInput=cfg,
            tags=d.tags,
        )
    except Exception as e:
        return await _fail(d, id, f"AgentCore Identity refused the sign-in setup ({type(e).__name__}).")
    callback = str(created.get("callbackUrl") or "")
    oauth: dict[str, Any] = {
        "authorization_server": str(asm.get("issuer") or ""),
        "scopes": scopes,
        "registered": "owner",
        "vendor": vendor,
        "metadata": {
            "issuer": str(asm.get("issuer") or ""),
            "authorization_endpoint": str(asm["authorization_endpoint"]),
            "token_endpoint": str(asm["token_endpoint"]),
        },
        "callback_url": callback,
    }
    reg = asm.get("registration_endpoint")
    if isinstance(reg, str) and callback and not check_url(reg, d.resolve):
        client = await _register(d, reg, callback, scopes)
        if client:
            vendor, cfg = _provider_input(asm, client[0], client[1])
            try:
                await asyncio.to_thread(
                    d.control.update_oauth2_credential_provider,
                    name=name,
                    credentialProviderVendor=vendor,
                    oauth2ProviderConfigInput=cfg,
                )
                oauth["registered"] = "dcr" if vendor == "CustomOauth2" else f"vendor:{vendor}"
                return await _set(
                    d,
                    id,
                    {"auth": "oauth", "provider_name": name, "oauth": oauth, "status": "needs_login", "needs": None},
                )
            except Exception as e:
                log("warn", "connector.dcr_update_failed", connector=id, error=type(e).__name__)
    # No dynamic registration: the owner registers a client at the provider with our callback URL.
    return await _set(
        d,
        id,
        {"auth": "oauth", "provider_name": name, "oauth": oauth, "status": "needs_key", "needs": "oauth_client"},
    )


async def _register(d: ConnectorsDeps, url: str, callback: str, scopes: list[str]) -> tuple[str, str] | None:
    """RFC 7591 dynamic client registration. Returns (client id, client secret) or None."""
    body = json.dumps(
        {
            "client_name": "AI City",
            "redirect_uris": [callback],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "client_secret_basic",
            **({"scope": " ".join(scopes)} if scopes else {}),
        }
    ).encode()
    try:
        r: HttpResponse = await asyncio.to_thread(
            d.transport, url, {"content-type": "application/json", "accept": "application/json"}, body, PROBE_TIMEOUT
        )
        out = json.loads(r.body) if r.status in (200, 201) else {}
    except Exception:
        return None
    cid, secret = out.get("client_id"), out.get("client_secret")
    if isinstance(cid, str) and isinstance(secret, str) and cid and secret:
        return cid, secret
    return None  # a public client without a secret can't be stored in an Identity provider


# ---------- sync ----------
_SCALARS = ("string", "number", "integer", "boolean", "object", "array")


def map_schema(s: Any, top: bool = True) -> dict[str, Any] | None:
    """An MCP ``inputSchema`` in the Gateway's inline SchemaDefinition (type, properties, required, items,
    description). None when it doesn't map ($ref, a top-level oneOf/anyOf/allOf, an unknown type)."""
    if not isinstance(s, dict) or "$ref" in s:
        return None
    for k in ("oneOf", "anyOf", "allOf"):
        if k in s:
            if top:
                return None
            options = [o for o in s[k] if isinstance(o, dict) and o.get("type") != "null"]
            if len(options) != 1:
                return None
            return map_schema(
                {**options[0], **({"description": s["description"]} if "description" in s else {})}, False
            )
    t = s.get("type")
    if isinstance(t, list):
        t = next((x for x in t if x != "null"), None)
    if t is None:
        t = "object" if "properties" in s or top else "string"
    if t not in _SCALARS:
        return None
    out: dict[str, Any] = {"type": t}
    if isinstance(s.get("description"), str):
        out["description"] = s["description"][:1000]
    if t == "object":
        props: dict[str, Any] = {}
        for name, p in (s.get("properties") or {}).items():
            m = map_schema(p, False)
            if m is None:
                return None
            props[str(name)] = m
        out["properties"] = props
        req = [str(r) for r in s.get("required") or [] if r in props]
        if req:
            out["required"] = req
    elif t == "array":
        items = map_schema(s.get("items") or {"type": "string"}, False)
        if items is None:
            return None
        out["items"] = items
    return out


async def sync(d: ConnectorsDeps, id: str) -> Record | None:
    rec = await d.store.get(id)
    if not rec or rec.get("status") in ("removing", "pending_approval"):
        return rec
    await _set(d, id, {"status": "syncing"})
    try:
        if rec.get("transport") == "package":  # §1.10: listing also pre-warms the host session
            raw = await connector_packages.list_tools(rec, d)
        else:
            headers = await asyncio.to_thread(credential_headers, rec, d.identity, d.workload)
            raw = await remote_client(rec, headers, d.transport).list_tools()
    except NeedsLogin:
        return await _set(d, id, {"status": "needs_login", "error": None})
    except NeedsKey:
        return await _set(d, id, {"status": "needs_key", "needs": "api_key", "error": None})
    except McpError as e:
        if e.status == 401:
            return await _set(d, id, {"status": "login_expired" if rec.get("auth") == "oauth" else "needs_key"})
        return await _fail(d, id, f"Listing the server's tools failed (HTTP {e.status}).")
    except Exception as e:
        return await _fail(d, id, f"Listing the server's tools failed ({type(e).__name__}).")
    tools, schemas, skipped = [], [], []
    for t in raw:
        name = str(t.get("name", ""))
        schema = map_schema(t.get("inputSchema") or {"type": "object"})
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name) or len(gateway_name(id, name)) > 64 or schema is None:
            skipped.append(name[:64] or "?")
            continue
        tools.append(tool_entry(t))
        schemas.append({"name": name, "description": str(t.get("description") or name)[:1000], "inputSchema": schema})
    if not tools:
        return await _fail(d, id, "The server has no tools the city can use.")
    config = {"mcp": {"lambda": {"lambdaArn": d.bridge_arn, "toolSchema": {"inlinePayload": schemas}}}}
    creds = [{"credentialProviderType": "GATEWAY_IAM_ROLE"}]
    try:
        if rec.get("target_id"):
            await asyncio.to_thread(
                d.control.update_gateway_target,
                gatewayIdentifier=d.gateway_id,
                targetId=rec["target_id"],
                name=id,
                targetConfiguration=config,
                credentialProviderConfigurations=creds,
            )
            target_id = rec["target_id"]
        else:
            r = await asyncio.to_thread(
                d.control.create_gateway_target,
                gatewayIdentifier=d.gateway_id,
                name=id,
                description=str(rec.get("label") or id)[:200],
                targetConfiguration=config,
                credentialProviderConfigurations=creds,
            )
            target_id = r["targetId"]
    except Exception as e:
        return await _fail(d, id, f"The Gateway refused the connector's tools ({type(e).__name__}).")
    warning = (
        f"Skipped {len(skipped)} tool(s) the Gateway can't describe: {', '.join(skipped[:10])}." if skipped else None
    )
    await d.store.update(
        id, {"tools": tools, "target_id": target_id, "status": "ready", "error": warning, "needs": None}
    )
    await rewrite_policies(d)
    return await _set(d, id, {})


# ---------- Cedar (§1.5) ----------
def _cedar(actions: list[str], gateway_arn: str, principal: str) -> str:
    """One permit. AgentCore's IamEntity id is the caller's assumed-role ARN **without the session name**
    ("Principal-scoped policies"), so the principal is matched exactly, never with ``like ".../*"``."""
    acts = ", ".join(f'AgentCore::Action::"{a}"' for a in sorted(actions))
    return (
        f'permit(\n  principal == AgentCore::IamEntity::"{principal}",\n'
        f"  action in [{acts}],\n"
        f'  resource == AgentCore::Gateway::"{gateway_arn}"\n'
        ");"
    )


def policy_statements(
    records: list[Record],
    gateway_arn: str,
    name_prefix: str,
    app_role: str,
    granted: set[tuple[str, str]] | None = None,
) -> dict[str, str]:
    """One permit per role (that role's level), and one for the apps' bridge Lambda listing exactly the
    ``(connector, tool)`` pairs some app was granted that are still read-only and ready. Name -> Cedar text."""
    account = gateway_arn.split(":")[4]
    ready = [r for r in records if r.get("status") == "ready"]
    out: dict[str, str] = {}
    for role in ROLES:
        acts: list[str] = []
        for r in ready:
            level = (r.get("roles") or {}).get(role)
            if level in LEVELS:
                acts += [
                    gateway_name(r["id"], t["name"]) for t in r.get("tools") or [] if level == "all" or is_read_only(t)
                ]
        if acts:
            out[f"aic_role_{role}"] = _cedar(
                acts, gateway_arn, f"arn:aws:sts::{account}:assumed-role/{name_prefix}-agent-{role}"
            )
    app = sorted(
        gateway_name(r["id"], t["name"])
        for r in ready
        for t in r.get("tools") or []
        if is_read_only(t) and (r["id"], t["name"]) in (granted or set())
    )
    if app:
        out["aic_app_bridge"] = _cedar(app, gateway_arn, f"arn:aws:sts::{account}:assumed-role/{app_role}")
    return out


async def app_grants(d: ConnectorsDeps) -> set[tuple[str, str]]:
    """Every ``connector.read`` grant of every app (``APPS`` / ``APP#<app_id>``, the apps contract's record)."""
    out: set[tuple[str, str]] = set()
    for app in await d.store.table.query("APPS", "APP#"):
        for g in app.get("grants") or []:
            if isinstance(g, dict) and g.get("id") == "connector.read" and g.get("connector") and g.get("tool"):
                out.add((str(g["connector"]), str(g["tool"])))
    return out


async def rewrite_policies(d: ConnectorsDeps) -> None:
    gw = await asyncio.to_thread(d.control.get_gateway, gatewayIdentifier=d.gateway_id)
    want = policy_statements(await d.store.list(), gw["gatewayArn"], d.name_prefix, d.app_role, await app_grants(d))
    have: dict[str, str] = {}
    token: str | None = None
    while True:
        kw: dict[str, Any] = {"policyEngineId": d.policy_engine_id, **({"nextToken": token} if token else {})}
        page = await asyncio.to_thread(d.control.list_policies, **kw)
        have.update({p["name"]: p["policyId"] for p in page.get("policies") or [] if p["name"].startswith("aic_")})
        token = page.get("nextToken")
        if not token:
            break
    for name, text in want.items():
        definition = {"cedar": {"statement": text}}
        if name in have:
            await asyncio.to_thread(
                d.control.update_policy, policyEngineId=d.policy_engine_id, policyId=have[name], definition=definition
            )
        else:
            await asyncio.to_thread(
                d.control.create_policy,
                policyEngineId=d.policy_engine_id,
                name=name,
                definition=definition,
                description="Written by the city's connectors Lambda (decision 76).",
            )
    for name, pid in have.items():
        if name not in want:
            await asyncio.to_thread(d.control.delete_policy, policyEngineId=d.policy_engine_id, policyId=pid)


# ---------- remove ----------
async def remove(d: ConnectorsDeps, id: str) -> None:
    rec = await d.store.get(id)
    if not rec:
        return
    steps: list[tuple[str, Any, dict[str, Any]]] = []
    if rec.get("target_id"):
        steps.append(
            (
                "target",
                d.control.delete_gateway_target,
                {"gatewayIdentifier": d.gateway_id, "targetId": rec["target_id"]},
            )
        )
    if rec.get("auth") == "oauth":
        steps.append(("provider", d.control.delete_oauth2_credential_provider, {"name": f"aic-conn-{id}"}))
    if rec.get("auth") == "api_key":
        name = str(rec.get("provider_name") or f"aic-conn-{id}")  # ``-key`` when a token replaced a sign-in
        steps.append(("provider", d.control.delete_api_key_credential_provider, {"name": name}))
    if rec.get("transport") == "package":  # §1.10: end the connector's microVM
        steps.append(("session", d.identity.stop_runtime_session, connector_packages.stop_kwargs(rec, d.mcp_host_arn)))
    if rec.get("secret_name"):
        steps.append(("secret", d.secrets.delete_secret, {"SecretId": rec["secret_name"], "RecoveryWindowInDays": 7}))
    for what, fn, kw in steps:
        try:
            await asyncio.to_thread(fn, **kw)
        except Exception as e:
            log("warn", "connector.remove_step_failed", connector=id, step=what, error=type(e).__name__)
    await d.store.delete(id)
    await rewrite_policies(d)
    await d.bus.put(
        {
            "type": "connector.updated",
            "id": id,
            "label": rec.get("label") or id,
            "status": "removed",
            "auth": rec.get("auth") or "unknown",
        }
    )


async def handle(event: Mapping[str, Any], d: ConnectorsDeps) -> dict[str, Any]:
    action, id = event.get("action"), str(event.get("id") or "")
    if (done := await openapi_admin.dispatch(event, d)) is not None:  # §1.11 web APIs
        return done
    try:
        if action == "provision":
            await provision(d, id)
        elif action in ("sync", "refresh"):
            await sync(d, id)
        elif action == "remove":
            await remove(d, id)
        elif action == "policies":  # the apps code, after a publish, a removal or a grant change
            await rewrite_policies(d)
            return {"ok": True}
        else:
            return {"ok": False, "error": "unknown action"}
    except Exception as e:
        log("error", "connectors.failed", connector=id, action=str(action), error=type(e).__name__)
        if id:
            await _fail(d, id, "Something went wrong while setting it up. Try Refresh in Settings.")
        return {"ok": False}
    return {"ok": True}


_deps: ConnectorsDeps | None = None


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        import os

        from aic.shared.aws import aws_city, require_env

        city = aws_city()
        _deps = ConnectorsDeps(
            store=ConnectorStore(city.ledger.table, city.ledger.now),
            bus=city.bus,
            control=city.session.client("bedrock-agentcore-control"),
            identity=city.session.client("bedrock-agentcore"),
            secrets=city.session.client("secretsmanager"),
            gateway_id=require_env("AIC_GATEWAY_ID"),
            policy_engine_id=require_env("AIC_POLICY_ENGINE_ID"),
            bridge_arn=require_env("AIC_BRIDGE_ARN"),
            workload=require_env("AIC_CONNECTORS_WORKLOAD"),
            app_role=os.environ.get("AIC_APP_BRIDGE_ROLE") or "aic-prod-fn-app-bridge",
            mcp_host_arn=os.environ.get("AIC_MCP_HOST_ARN", ""),
        )
    return run(handle(event, _deps))
