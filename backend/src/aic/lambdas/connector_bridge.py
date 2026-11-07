"""Lambda ``aic-prod-connector-bridge``: the one Gateway target behind every connector (§1.1).

The Gateway invokes it with the tool's arguments as the event and the tool name ``<connector id>___<tool>`` in
the client context (``bedrockAgentCoreToolName``). It reads the connector record, gets the credential from the
AgentCore Identity token vault for the fixed user ``owner`` (in memory, at call time), and calls the remote MCP
server. Credentials are never logged, stored or returned. When the vault can't refresh a sign-in, it answers
``login_expired`` and marks the record so the HUD shows "Sign in again".

The connectors Lambda reuses ``credential_headers`` and ``remote_client`` to list a server's tools at sync.
"""

from __future__ import annotations

import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from aic.connectors import openapi_bridge
from aic.shared.connectors import SEP, ConnectorStore, Record
from aic.shared.log import log
from aic.shared.mcp_http import McpError, McpHttp, Transport, urllib_transport

from ._runtime import run

OWNER_USER = "owner"
CALL_TIMEOUT = 60
LOGIN_EXPIRED = "login_expired"


class NeedsLogin(Exception):
    """The vault has no usable token for the owner: sign in (again)."""


class NeedsKey(Exception):
    """The API key or OAuth client isn't there yet."""


@dataclass
class BridgeDeps:
    store: ConnectorStore
    identity: Any
    """A boto3 ``bedrock-agentcore`` (data plane) client."""
    workload: str
    transport: Transport = urllib_transport


def credential_headers(rec: Mapping[str, Any], identity: Any, workload: str) -> dict[str, str]:
    """The header that carries the connector's credential. Raises NeedsLogin / NeedsKey."""
    auth = rec.get("auth") or "none"
    if auth == "none":
        return {}
    provider = rec.get("provider_name") or f"aic-conn-{rec['id']}"
    wt = identity.get_workload_access_token_for_user_id(workloadName=workload, userId=OWNER_USER)["workloadAccessToken"]
    if auth == "api_key":
        try:
            key = identity.get_resource_api_key(workloadIdentityToken=wt, resourceCredentialProviderName=provider)[
                "apiKey"
            ]
        except Exception as e:
            raise NeedsKey from e
        prefix = rec.get("key_prefix")
        prefix = (
            "Bearer " if prefix is None and (rec.get("key_header") or "Authorization") == "Authorization" else prefix
        )
        return {str(rec.get("key_header") or "Authorization"): f"{prefix or ''}{key}"}
    r = identity.get_resource_oauth2_token(
        workloadIdentityToken=wt,
        resourceCredentialProviderName=provider,
        scopes=list((rec.get("oauth") or {}).get("scopes") or []),
        oauth2Flow="USER_FEDERATION",
    )
    token = r.get("accessToken")
    if not token:  # the vault answered with an authorization URL: nobody is signed in, or it can't refresh
        raise NeedsLogin
    return {"Authorization": f"Bearer {token}"}


def remote_client(rec: Mapping[str, Any], headers: Mapping[str, str], transport: Transport) -> McpHttp:
    return McpHttp(str(rec["url"]), transport, lambda _u, _b: headers, timeout=CALL_TIMEOUT)


def _tool_name(context: Any) -> str:
    custom = getattr(getattr(context, "client_context", None), "custom", None) or {}
    return str(custom.get("bedrockAgentCoreToolName", ""))


def _error(code: str, message: str) -> dict[str, Any]:
    return {"isError": True, "aic_error": code, "content": [{"type": "text", "text": message}]}


async def call(event: Mapping[str, Any], tool_name: str, d: BridgeDeps) -> dict[str, Any]:
    cid, sep, tool = tool_name.partition(SEP)
    rec: Record | None = await d.store.get(cid) if sep else None
    if not rec or rec.get("status") not in ("ready", "syncing"):
        return _error("unavailable", "That connector is not ready.")
    label = rec.get("label") or cid
    if not any(t.get("name") == tool for t in rec.get("tools") or []):
        return _error("unknown_tool", f"{label} has no tool {tool}.")
    if rec.get("transport") == "openapi":  # §1.11 web APIs
        return await openapi_bridge.call(rec, tool, dict(event), d)
    t0 = time.monotonic()
    try:
        headers = credential_headers(rec, d.identity, d.workload)
        result = await remote_client(rec, headers, d.transport).call_tool(tool, dict(event), CALL_TIMEOUT)
    except (NeedsLogin, NeedsKey):
        await d.store.update(cid, {"status": LOGIN_EXPIRED, "error": f"{label} needs the owner to sign in again."})
        log("warn", "connector.login_expired", connector=cid)
        return _error(LOGIN_EXPIRED, f"{label} needs the owner to sign in again.")
    except McpError as e:
        if e.status == 401:
            await d.store.update(cid, {"status": LOGIN_EXPIRED, "error": f"{label} needs the owner to sign in again."})
            return _error(LOGIN_EXPIRED, f"{label} needs the owner to sign in again.")
        log("warn", "connector.call_failed", connector=cid, status=e.status)
        return _error("failed", f"{label} answered with an error.")
    except Exception as e:
        log("warn", "connector.call_failed", connector=cid, error=type(e).__name__)
        return _error("failed", f"{label} could not be reached.")
    log("info", "connector.call", connector=cid, ms=round((time.monotonic() - t0) * 1000))
    return {"isError": bool(result.get("isError")), "content": list(result.get("content") or [])}


_deps: BridgeDeps | None = None


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        import os

        import boto3

        from aic.shared.table import DynamoTable

        region = os.environ.get("AWS_REGION") or os.environ.get("AIC_REGION")
        s = boto3.session.Session(region_name=region)
        _deps = BridgeDeps(
            store=ConnectorStore(DynamoTable(s.resource("dynamodb").Table(os.environ["AIC_LEDGER_TABLE"]))),
            identity=s.client("bedrock-agentcore"),
            workload=os.environ["AIC_CONNECTORS_WORKLOAD"],
        )
    return run(call(event, _tool_name(context), _deps))
