"""A short-lived address for VAIC's real-time voice (decision 120): a SigV4 presigned WebSocket URL to VAIC's own
AgentCore runtime (``/runtimes/<arn>/ws``), signed by the API's role, as AgentCore documents for browsers. It lasts
five minutes (AgentCore's maximum), only opens the connection, and names VAIC's warm session so the voice runs next
to VAIC's warm clients.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode, urlparse

EXPIRES_S = 300


@dataclass
class VoiceUrlDeps:
    session: Any
    """A boto3 session (the API role's credentials)."""
    region: str
    runtime_arn: str
    session_id: Callable[[], str]


def presigned_voice_url(d: VoiceUrlDeps) -> str:
    from botocore.auth import SigV4QueryAuth
    from botocore.awsrequest import AWSRequest

    host = f"bedrock-agentcore.{d.region}.amazonaws.com"
    query = urlencode({"X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": d.session_id()})
    url = f"https://{host}/runtimes/{quote(d.runtime_arn, safe='')}/ws?{query}"
    creds = d.session.get_credentials()
    if creds is None:
        raise RuntimeError("no AWS credentials")
    req = AWSRequest(method="GET", url=url, headers={"host": urlparse(url).hostname or host})
    SigV4QueryAuth(creds.get_frozen_credentials(), "bedrock-agentcore", d.region, expires=EXPIRES_S).add_auth(req)
    return str(req.url).replace("https://", "wss://", 1)


async def check_voice_url(url: str, timeout_s: float = 8.0) -> tuple[int, str]:
    """Opens the WebSocket handshake to ``url`` the way the browser does and returns AWS's answer: ``(101, "")`` when
    it connects, otherwise the HTTP status and the start of the error body. Browsers hide why a WebSocket was
    refused; this shows the owner the real reason (the owner, 2026-11-09: "the connection to VAIC's voice broke")."""
    import asyncio
    import base64
    import os
    import ssl

    u = urlparse(url.replace("wss://", "https://", 1))
    host = u.hostname or ""
    target = u.path + (f"?{u.query}" if u.query else "")
    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        f"GET {target} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: aic-voice-check/1.0\r\n\r\n"
    )

    async def go() -> tuple[int, str]:
        reader, writer = await asyncio.open_connection(
            host, 443, ssl=ssl.create_default_context(), server_hostname=host
        )
        try:
            writer.write(request.encode())
            await writer.drain()
            head = (await reader.readuntil(b"\r\n\r\n")).decode("latin-1")
            status = int(head.split(" ", 2)[1])
            if status == 101:
                return 101, ""
            length = 0
            for line in head.split("\r\n")[1:]:
                k, _, v = line.partition(":")
                if k.strip().lower() == "content-length":
                    length = int(v.strip() or 0)
            body = (await reader.read(min(length or 2000, 2000))).decode("utf-8", "replace")
            return status, " ".join(body.split())[:300]
        finally:
            writer.close()

    return await asyncio.wait_for(go(), timeout_s)
