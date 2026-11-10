"""Keeps VAIC's reply path hot, so the owner's first message after a quiet spell pays nothing extra.

The warm-keeper (``scheduler.warm_vaic``) pings the runtime every couple of minutes. Answering "I'm up" keeps the
container alive, but the first real turn still paid for lazy work: creating the Bedrock and WebSocket clients,
their TLS handshakes, the first DynamoDB call, and the model's own first-token latency on a cold session.
``VaicWarmer`` does all of that on each ping, in the background, so the HTTP answer stays immediate.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

from vaic.shared.log import log

WARM_PROMPT = "ok"


class VaicWarmer:
    def __init__(
        self,
        bedrock: Callable[[], Any],
        model_id: str,
        ledger_read: Callable[[], Awaitable[Any]],
        sender: Callable[[str, str], Any] | None = None,
    ) -> None:
        self._bedrock = bedrock
        self._model_id = model_id
        self._ledger_read = ledger_read
        self._sender = sender

    def prepare(self) -> None:
        """At startup: create the Bedrock client now (no network yet), so the first turn doesn't."""
        try:
            self._bedrock()
        except Exception as e:  # the turn will try again; startup never fails on this
            log("warn", "vaic.warm.prepare_failed", error=type(e).__name__)

    async def warm(self, inv: dict[str, Any] | None = None) -> dict[str, Any]:
        """One warm pass: WebSocket sender for the HUD, a cheap ledger read, and a one-token model call."""
        t0 = time.monotonic()
        out: dict[str, Any] = {}
        endpoint, table = (inv or {}).get("wsEndpoint"), (inv or {}).get("connectionsTable")
        if self._sender and endpoint and table:
            try:
                self._sender(str(endpoint), str(table))
                out["sender"] = "ready"
            except Exception as e:
                out["sender"] = type(e).__name__
        try:
            await self._ledger_read()
            out["ledger_ms"] = round((time.monotonic() - t0) * 1000)
        except Exception as e:
            out["ledger"] = type(e).__name__
        t1 = time.monotonic()
        try:
            await asyncio.to_thread(
                lambda: self._bedrock().converse(
                    modelId=self._model_id,
                    messages=[{"role": "user", "content": [{"text": WARM_PROMPT}]}],
                    inferenceConfig={"maxTokens": 1},
                )
            )
            out["model_ms"] = round((time.monotonic() - t1) * 1000)
        except Exception as e:
            out["model"] = type(e).__name__
        out["total_ms"] = round((time.monotonic() - t0) * 1000)
        log("info", "vaic.warm", **out)
        return out
