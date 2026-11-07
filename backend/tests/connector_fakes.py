"""Fakes for connectors: a scripted MCP server over a fake transport, AgentCore control/data clients and
Secrets Manager. No network, no AWS."""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from typing import Any

from aic.shared.mcp_http import HttpResponse

PUBLIC_IP = "93.184.216.34"


def resolver(host: str) -> list[str]:
    return {"internal.example.com": ["10.0.0.5"], "meta.example.com": ["169.254.169.254"]}.get(host, [PUBLIC_IP])


def jsonrpc(id: Any, result: Any) -> bytes:
    return json.dumps({"jsonrpc": "2.0", "id": id, "result": result}).encode()


class FakeNet:
    """A transport: GET/POST by URL. ``mcp`` maps an MCP endpoint to a function (method, params, headers) -> result."""

    def __init__(self) -> None:
        self.get: dict[str, Any] = {}
        self.post: dict[str, Callable[[dict[str, Any]], tuple[int, Any]]] = {}
        self.mcp: dict[str, Callable[[str, dict[str, Any], Mapping[str, str]], Any]] = {}
        self.status: dict[str, tuple[int, dict[str, str]]] = {}
        self.calls: list[tuple[str, dict[str, str], bytes]] = []

    def __call__(self, url: str, headers: Mapping[str, str], body: bytes, timeout: float) -> HttpResponse:
        self.calls.append((url, dict(headers), body))
        if url in self.status:
            code, h = self.status[url]
            return HttpResponse(code, h, b"")
        if not body:
            if url not in self.get:
                return HttpResponse(404, {}, b"")
            return HttpResponse(200, {"content-type": "application/json"}, json.dumps(self.get[url]).encode())
        if url in self.post:
            code, out = self.post[url](json.loads(body))
            return HttpResponse(code, {"content-type": "application/json"}, json.dumps(out).encode())
        if url in self.mcp:
            msg = json.loads(body)
            if "id" not in msg:
                return HttpResponse(202, {}, b"")
            result = self.mcp[url](msg["method"], msg.get("params") or {}, headers)
            if isinstance(result, HttpResponse):
                return result
            return HttpResponse(
                200, {"content-type": "application/json", "mcp-session-id": "s1"}, jsonrpc(msg["id"], result)
            )
        return HttpResponse(404, {}, b"")


def mcp_server(tools: list[dict[str, Any]], need: str | None = None, call: Callable[..., Any] | None = None) -> Any:
    """An MCP endpoint. With ``need`` set, requests without that Authorization header get 401."""

    def handle(method: str, params: dict[str, Any], headers: Mapping[str, str]) -> Any:
        if need is not None and headers.get("Authorization") != need:
            return HttpResponse(401, {}, b"")
        if method == "initialize":
            return {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}}, "serverInfo": {"name": "x"}}
        if method == "tools/list":
            return {"tools": tools}
        if method == "tools/call":
            if call:
                return call(params["name"], params.get("arguments") or {})
            return {"content": [{"type": "text", "text": f"ran {params['name']}"}]}
        return {}

    return handle


TOOLS = [
    {
        "name": "search_videos",
        "description": "Search.",
        "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]},
        "annotations": {"readOnlyHint": True},
    },
    {
        "name": "create_video",
        "description": "Create.",
        "inputSchema": {"type": "object", "properties": {"prompt": {"type": "string"}}},
        "annotations": {"readOnlyHint": False, "destructiveHint": False},
    },
    {"name": "delete_video", "description": "Delete.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "weird", "description": "x", "inputSchema": {"oneOf": [{"type": "object"}, {"type": "string"}]}},
]


class Recorder:
    """Records every boto3-style call as (method, kwargs) and answers from ``answers``."""

    def __init__(self, answers: dict[str, Any] | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.answers = answers or {}

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)

        def call(**kw: Any) -> Any:
            self.calls.append((name, kw))
            a = self.answers.get(name, {})
            if isinstance(a, Exception):
                raise a
            return a(**kw) if callable(a) else a

        return call

    def names(self) -> list[str]:
        return [n for n, _ in self.calls]


GATEWAY_ARN = "arn:aws:bedrock-agentcore:eu-north-1:123456789012:gateway/gw-1"


def control() -> Recorder:
    pols: dict[str, dict[str, Any]] = {}

    def create_policy(**kw: Any) -> dict[str, Any]:
        pid = f"p-{len(pols) + 1}"
        pols[pid] = {"policyId": pid, "name": kw["name"], "definition": kw["definition"]}
        return {"policyId": pid}

    def update_policy(**kw: Any) -> dict[str, Any]:
        pols[kw["policyId"]]["definition"] = kw["definition"]
        return {}

    def delete_policy(**kw: Any) -> dict[str, Any]:
        pols.pop(kw["policyId"], None)
        return {}

    r = Recorder(
        {
            "get_gateway": {"gatewayArn": GATEWAY_ARN},
            "create_gateway_target": {"targetId": "tgt-1"},
            "update_gateway_target": {},
            "create_oauth2_credential_provider": {"callbackUrl": "https://identity.example.com/callback/abc"},
            "update_oauth2_credential_provider": {},
            "create_api_key_credential_provider": {},
            "list_policies": lambda **_: {"policies": list(pols.values())},
            "create_policy": create_policy,
            "update_policy": update_policy,
            "delete_policy": delete_policy,
        }
    )
    r.policies = pols  # type: ignore[attr-defined]
    return r
