"""VAIC's reply, live: text is sent to the owner's open HUDs as it is written.

Small pieces are batched (about every 80 ms) and posted straight to the WebSocket connections, so the
owner sees the reply grow word by word without the EventBridge → Lambda hop for every piece. When the
runtime isn't told where the WebSocket is, everything goes through the event bus as before.
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any

Send = Callable[[dict[str, Any]], Awaitable[None]]

FLUSH_SECONDS = 0.08


class LiveReply:
    def __init__(self, send: Send, conversation: str, clock: Callable[[], float] = time.monotonic) -> None:
        self._send = send
        self._conversation = conversation
        self._clock = clock
        self._buf = ""
        self._last = 0.0

    async def add(self, text: str) -> None:
        self._buf += text
        if self._clock() - self._last >= FLUSH_SECONDS:
            await self.flush()

    async def flush(self) -> None:
        if not self._buf:
            return
        text, self._buf = self._buf, ""
        self._last = self._clock()
        await self._send({"type": "ace.reply", "conversation": self._conversation, "text": text, "done": False})

    async def done(self, text: str) -> None:
        """The whole reply: it replaces what was streamed (which may include text written before a tool call)."""
        self._buf = ""
        await self._send({"type": "ace.reply", "conversation": self._conversation, "text": text, "done": True})


_posters: dict[str, Send] = {}


def websocket_sender(endpoint: str, connections_table: str, region: str) -> Send:
    """Posts an event to every open HUD connection, straight from the runtime (cached per endpoint)."""
    key = f"{endpoint}|{connections_table}"
    if key not in _posters:
        import boto3

        from aic.lambdas.ws import ApiGatewayPoster, broadcast
        from aic.shared.table import DynamoTable

        table = DynamoTable(boto3.resource("dynamodb", region_name=region).Table(connections_table))
        poster = ApiGatewayPoster(boto3.client("apigatewaymanagementapi", region_name=region, endpoint_url=endpoint))

        async def send(event: dict[str, Any]) -> None:
            await broadcast(event, table, poster)

        _posters[key] = send
    return _posters[key]
