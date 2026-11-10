"""The EventBridge implementation of the city bus. Events are validated before they leave."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from .events import now_iso, parse_event

EVENT_SOURCE = "vaic.city"


class EventBridgeBus:
    """``client`` is a boto3 ``events`` client."""

    def __init__(self, client: Any, bus_name: str) -> None:
        self._client = client
        self._bus = bus_name

    async def put(self, event: dict[str, Any]) -> None:
        e = parse_event({**event, "at": now_iso()})
        r = await asyncio.to_thread(
            self._client.put_events,
            Entries=[
                {"EventBusName": self._bus, "Source": EVENT_SOURCE, "DetailType": e["type"], "Detail": json.dumps(e)}
            ],
        )
        if r.get("FailedEntryCount"):
            code = (r.get("Entries") or [{}])[0].get("ErrorCode", "unknown")
            raise RuntimeError(f"event bus refused {e['type']}: {code}")
