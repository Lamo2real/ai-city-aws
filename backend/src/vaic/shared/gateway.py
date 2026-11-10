"""The AgentCore Gateway client (``docs/CONNECTORS_SKILLS.md`` §1.4, §1.9).

MCP over streamable HTTP to the one Gateway, every request signed with SigV4 (service ``bedrock-agentcore``)
using whatever boto3 credentials the process has, so Cedar sees who is calling. Only boto3/botocore are
needed: the runtimes use it (with the role filter and output wrapping in ``vaic.runtime.gateway``) and so does
the apps' bridge Lambda (``vaic.shared.connector_calls``).
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from typing import Any

from .mcp_http import McpHttp, Transport, urllib_transport

LIST_TTL_S = 300
CALL_TIMEOUT_S = 60


def sigv4_headers(
    session: Any, region: str, service: str = "bedrock-agentcore"
) -> Callable[[str, bytes], dict[str, str]]:
    """Signs each POST with the session's current credentials."""
    from botocore.auth import SigV4Auth
    from botocore.awsrequest import AWSRequest

    def sign(url: str, body: bytes) -> dict[str, str]:
        creds = session.get_credentials().get_frozen_credentials()
        req = AWSRequest(
            method="POST",
            url=url,
            data=body,
            headers={"content-type": "application/json", "accept": "application/json, text/event-stream"},
        )
        SigV4Auth(creds, service, region).add_auth(req)
        return dict(req.headers.items())

    return sign


class GatewayClient:
    def __init__(
        self,
        url: str,
        sign: Callable[[str, bytes], Mapping[str, str]],
        transport: Transport = urllib_transport,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.url = url
        self._sign = sign
        self._transport = transport
        self._clock = clock
        self._cache: tuple[float, str, dict[str, dict[str, Any]]] | None = None

    def _mcp(self, timeout: float) -> McpHttp:
        return McpHttp(self.url, self._transport, self._sign, timeout)

    async def list_tools(self, stamp: str = "") -> dict[str, dict[str, Any]]:
        """Gateway tool name -> MCP tool. Cached 5 minutes per process, and refreshed when ``stamp`` (the
        connector list's ``updated_at`` values) changes."""
        now = self._clock()
        if self._cache and self._cache[1] == stamp and now - self._cache[0] < LIST_TTL_S:
            return self._cache[2]
        tools = {str(t["name"]): t for t in await self._mcp(30).list_tools() if t.get("name")}
        self._cache = (now, stamp, tools)
        return tools

    async def call_tool(self, name: str, args: dict[str, Any], wait_s: float = CALL_TIMEOUT_S) -> dict[str, Any]:
        return await self._mcp(wait_s).call_tool(name, args, wait_s)
