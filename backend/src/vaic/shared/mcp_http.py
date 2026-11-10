"""A small MCP client over streamable HTTP (JSON-RPC over POST; the answer is JSON or one SSE stream).

Used by the connector bridge (to the remote MCP server) and by the runtimes' Gateway client (to the AgentCore
Gateway, with SigV4). The transport is a plain function, so tests pass a fake and nothing touches the network.
Only what the city needs: ``initialize``, ``tools/list`` (with paging) and ``tools/call``.
"""

from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

PROTOCOL_VERSION = "2025-06-18"


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: Mapping[str, str]
    """Header names in lower case."""
    body: bytes


Transport = Callable[[str, Mapping[str, str], bytes, float], HttpResponse]
"""(url, headers, body, timeout seconds) -> response. Blocking; called in a thread."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_: Any, **__: Any) -> None:
        return None  # a redirect could point at a private address that the URL check refused


_opener = urllib.request.build_opener(_NoRedirect)


def urllib_transport(url: str, headers: Mapping[str, str], body: bytes, timeout: float) -> HttpResponse:
    """The production transport: HTTPS POST (or GET when body is empty), no redirects followed."""
    req = urllib.request.Request(url, data=body or None, headers=dict(headers), method="POST" if body else "GET")  # noqa: S310
    try:
        with _opener.open(req, timeout=timeout) as r:
            return HttpResponse(r.status, {k.lower(): v for k, v in r.headers.items()}, r.read(4_000_000))
    except urllib.error.HTTPError as e:
        return HttpResponse(e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read(200_000))


class McpError(RuntimeError):
    def __init__(self, message: str, status: int | None = None, headers: Mapping[str, str] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.headers = dict(headers or {})


def _parse(resp: HttpResponse, want_id: int) -> dict[str, Any]:
    ctype = resp.headers.get("content-type", "")
    text = resp.body.decode("utf-8", "replace")
    messages: list[Any] = []
    if "text/event-stream" in ctype:
        for block in text.split("\n\n"):
            data = "\n".join(line[5:].lstrip() for line in block.splitlines() if line.startswith("data:"))
            if data:
                try:
                    messages.append(json.loads(data))
                except json.JSONDecodeError:
                    continue
    else:
        try:
            body = json.loads(text) if text.strip() else None
        except json.JSONDecodeError as e:
            raise McpError("The server's answer is not JSON.", resp.status) from e
        messages = body if isinstance(body, list) else [body]
    for m in messages:
        if isinstance(m, dict) and m.get("id") == want_id:
            if "error" in m:
                err = m["error"] or {}
                raise McpError(f"MCP error {err.get('code')}: {str(err.get('message', ''))[:300]}", resp.status)
            result: dict[str, Any] = m.get("result") or {}
            return result
    raise McpError("The server did not answer the request.", resp.status)


class McpHttp:
    """One MCP session. ``headers`` returns the extra headers for each request (auth, signatures)."""

    def __init__(
        self,
        url: str,
        transport: Transport = urllib_transport,
        headers: Callable[[str, bytes], Mapping[str, str]] | None = None,
        timeout: float = 30,
    ) -> None:
        self.url = url
        self._transport = transport
        self._headers = headers or (lambda _u, _b: {})
        self.timeout = timeout
        self._session: str | None = None
        self._next = 0
        self._ready = False

    async def _post(self, payload: dict[str, Any], wait_s: float | None = None) -> HttpResponse:
        body = json.dumps(payload).encode()
        h = {
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
            "mcp-protocol-version": PROTOCOL_VERSION,
            **self._headers(self.url, body),
        }
        if self._session:
            h["mcp-session-id"] = self._session
        return await asyncio.to_thread(self._transport, self.url, h, body, wait_s or self.timeout)

    async def request(self, method: str, params: dict[str, Any] | None = None, wait_s: float | None = None) -> Any:
        self._next += 1
        rid = self._next
        resp = await self._post({"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}, wait_s)
        if resp.status >= 400:
            raise McpError(f"HTTP {resp.status}", resp.status, resp.headers)
        if sid := resp.headers.get("mcp-session-id"):
            self._session = sid
        return _parse(resp, rid)

    async def initialize(self, wait_s: float | None = None) -> dict[str, Any]:
        r: dict[str, Any] = await self.request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "ai-city", "version": "1"},
            },
            wait_s,
        )
        await self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self._ready = True
        return r

    async def _ensure(self) -> None:
        if not self._ready:
            await self.initialize()

    async def list_tools(self, max_pages: int = 20) -> list[dict[str, Any]]:
        await self._ensure()
        out: list[dict[str, Any]] = []
        cursor: str | None = None
        for _ in range(max_pages):
            r = await self.request("tools/list", {"cursor": cursor} if cursor else {})
            out.extend(t for t in r.get("tools") or [] if isinstance(t, dict))
            cursor = r.get("nextCursor")
            if not cursor:
                break
        return out

    async def call_tool(self, name: str, args: dict[str, Any], wait_s: float | None = None) -> dict[str, Any]:
        await self._ensure()
        r: dict[str, Any] = await self.request("tools/call", {"name": name, "arguments": args}, wait_s)
        return r
