"""The owner's personal features (City → Features in the HUD, ``docs/PRODUCT.md``).

A feature is a built-in part of AI City the owner turns on or off. Rows: ``FEATURES`` / ``<id>`` →
``{enabled, updated_at}``; a feature with no row has its default. New ones are asked for in AIC's chat."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from aic.shared.events import now_iso
from aic.shared.table import Table, UpdateOptions

PK = "FEATURES"

FEATURES: dict[str, dict[str, Any]] = {
    "calendar": {
        "id": "calendar",
        "name": "Calendar",
        "blurb": "Every meeting from every email account you connect, in one calendar, with a big Join button.",
        "default": True,
    },
}


class FeatureStore:
    def __init__(self, table: Table, now: Callable[[], Any] | None = None) -> None:
        self.table = table
        self.now = now

    async def enabled(self, id: str) -> bool:
        row = await self.table.get(PK, id)
        return bool(row["enabled"]) if row and "enabled" in row else bool(FEATURES[id]["default"])

    async def all(self) -> list[dict[str, Any]]:
        rows = {r["sk"]: r for r in await self.table.query(PK)}
        out = []
        for id, f in FEATURES.items():
            r = rows.get(id) or {}
            out.append(
                {
                    "id": id,
                    "name": f["name"],
                    "blurb": f["blurb"],
                    "enabled": bool(r.get("enabled", f["default"])),
                    "updated_at": r.get("updated_at"),
                }
            )
        return out

    async def set_enabled(self, id: str, on: bool) -> dict[str, Any]:
        if id not in FEATURES:
            raise KeyError(id)
        at = now_iso(self.now()) if self.now else now_iso()
        await self.table.update(PK, id, UpdateOptions(set={"enabled": on, "updated_at": at}))
        return next(f for f in await self.all() if f["id"] == id)


__all__ = ["FEATURES", "FeatureStore"]
