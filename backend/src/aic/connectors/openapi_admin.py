"""The connectors Lambda's actions for ``transport = "openapi"`` (``docs/CONNECTORS_SKILLS.md`` §1.11).

- ``provision``: fetch the spec link again, refuse it if it isn't what the card showed (hash), store the normalized
  spec in S3 at ``specs/<id>/<sha256>.json``, and set up the sign-in: none, the key field, or an AgentCore Identity
  custom OAuth provider waiting for the owner's client (authorization code or client credentials).
- ``sync`` / ``refresh``: rebuild the tools from the stored spec (never from the link), check the credential is
  there, create or update the Gateway Lambda target, rewrite the Cedar policies.
- ``remove``: delete the stored specs, then everything the MCP path removes.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from aic.shared.connectors import Record, check_url
from aic.shared.log import log

from . import openapi
from .openapi_bridge import NeedsKey, NeedsLogin, credential

if TYPE_CHECKING:
    from aic.lambdas.connectors import ConnectorsDeps

ACTIONS = ("provision", "sync", "refresh", "remove")


async def dispatch(event: Mapping[str, Any], d: ConnectorsDeps, store: Any = None) -> dict[str, Any] | None:
    """The connectors Lambda's one hook: handles the action for an OpenAPI connector, None for any other."""
    action, id = event.get("action"), str(event.get("id") or "")
    if action not in ACTIONS:
        return None
    rec = await d.store.get(id)
    if not rec or rec.get("transport") != "openapi":
        return None
    specs = store or openapi.spec_store()
    try:
        if action == "provision":
            await provision(d, rec, specs)
        elif action == "remove":
            await remove(d, rec, specs)
        else:
            await sync(d, id, specs)
    except Exception as e:
        from aic.lambdas.connectors import _fail

        log("error", "connectors.failed", connector=id, action=str(action), error=type(e).__name__)
        await _fail(d, id, "Something went wrong while setting it up. Try Refresh in Settings.")
        return {"ok": False}
    return {"ok": True}


async def provision(d: ConnectorsDeps, rec: Record, specs: Any) -> Record | None:
    from aic.lambdas.connectors import _fail, _set

    id = rec["id"]
    if rec.get("status") != "provisioning":
        return rec
    info = dict(rec.get("openapi") or {})
    url = str(info.get("spec_url") or rec.get("url") or "")
    if bad := check_url(url, d.resolve):
        return await _fail(d, id, bad)
    try:
        doc = await openapi.fetch_doc(url, d.transport)
        if doc is None:
            return await _fail(d, id, "The API description could not be fetched again.")
        spec = openapi.normalize(doc, url, id)
    except openapi.SpecError as e:
        return await _fail(d, id, str(e))
    digest = openapi.sha256(spec)
    if digest != info.get("sha256"):
        return await _fail(d, id, openapi.CHANGED)
    if bad := check_url(spec["base_url"], d.resolve):
        return await _fail(d, id, bad)
    key = openapi.spec_key(id, digest)
    await asyncio.to_thread(specs.put, key, openapi.dumps(spec))
    info.update({"spec_url": url, "spec_key": key, "base_url": spec["base_url"], "operations": len(spec["operations"])})
    info["auth"] = spec["auth"]
    kind = spec["auth"]["kind"]
    if kind == "none":
        await _set(d, id, {"openapi": info, "auth": "none", "status": "syncing", "error": None, "needs": None})
        return await sync(d, id, specs)
    if kind == "api_key":
        return await _set(
            d, id, {"openapi": info, "auth": "api_key", "status": "needs_key", "needs": "api_key", "error": None}
        )
    return await _oauth(d, rec, info, spec["auth"])


async def _oauth(d: ConnectorsDeps, rec: Record, info: dict[str, Any], auth: Mapping[str, Any]) -> Record | None:
    """A custom provider with the spec's endpoints and a placeholder client; the owner enters theirs in the
    secure field (most APIs have no dynamic registration), after registering our callback URL."""
    from aic.lambdas.connectors import PENDING_CLIENT, _fail, _provider_input, _set

    id = rec["id"]
    name = f"aic-conn-{id}"
    token = str(auth["token_url"])
    issuer = f"https://{openapi.host_of(token)}"
    metadata = {"issuer": issuer, "authorization_endpoint": str(auth["authorization_url"]), "token_endpoint": token}
    vendor, cfg = _provider_input(metadata, PENDING_CLIENT, PENDING_CLIENT)
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
    oauth = {
        "flow": auth["flow"],
        "authorization_server": issuer,
        "scopes": list(auth.get("scopes") or []),
        "registered": "owner",
        "vendor": vendor,
        "metadata": metadata,
        "callback_url": str(created.get("callbackUrl") or ""),
    }
    return await _set(
        d,
        id,
        {
            "openapi": info,
            "auth": "oauth",
            "provider_name": name,
            "oauth": oauth,
            "status": "needs_key",
            "needs": "oauth_client",
            "error": None,
        },
    )


async def sync(d: ConnectorsDeps, id: str, specs: Any) -> Record | None:
    from aic.lambdas.connectors import _fail, _set, rewrite_policies

    rec = await d.store.get(id)
    if not rec or rec.get("status") in ("removing", "pending_approval", "provisioning"):
        return rec
    key = (rec.get("openapi") or {}).get("spec_key")
    if not key:
        return await _fail(d, id, "The API description isn't stored yet. Remove it and ask AIC again.")
    await _set(d, id, {"status": "syncing"})
    try:
        spec = json.loads(await asyncio.to_thread(specs.get, key))
    except Exception as e:
        return await _fail(d, id, f"The stored API description couldn't be read ({type(e).__name__}).")
    try:
        await asyncio.to_thread(credential, rec, d.identity, d.workload)
    except NeedsLogin:
        return await _set(d, id, {"status": "needs_login", "error": None})
    except NeedsKey:
        needs = "oauth_client" if rec.get("auth") == "oauth" else "api_key"
        return await _set(d, id, {"status": "needs_key", "needs": needs, "error": None})
    except Exception as e:
        return await _fail(d, id, f"The credential couldn't be read ({type(e).__name__}).")
    tools, schemas = openapi.tools_of(spec)
    if not tools:
        return await _fail(d, id, "The API has no operations the city can use.")
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
        return await _fail(d, id, f"The Gateway refused the API's tools ({type(e).__name__}).")
    skipped = list(spec.get("skipped") or [])
    warning = f"Skipped {len(skipped)} operation(s) the city can't use: {'; '.join(skipped[:10])}." if skipped else None
    await d.store.update(
        id, {"tools": tools, "target_id": target_id, "status": "ready", "error": warning, "needs": None}
    )
    await rewrite_policies(d)
    return await _set(d, id, {})


async def remove(d: ConnectorsDeps, rec: Record, specs: Any) -> None:
    from aic.lambdas.connectors import remove as remove_connector

    try:
        await asyncio.to_thread(specs.delete_prefix, f"specs/{rec['id']}/")
    except Exception as e:
        log("warn", "connector.remove_step_failed", connector=rec["id"], step="spec", error=type(e).__name__)
    await remove_connector(d, rec["id"])
