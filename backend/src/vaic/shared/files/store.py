"""File records in the ``vaic-prod-files`` table (docs/FILES.md §4): ``FILE#<id>`` / ``META``, listed on gsi1."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ..events import now_iso
from ..table import Table, UpdateOptions
from .model import file_pk


class FilesStore:
    def __init__(self, table: Table, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self._now = now or (lambda: datetime.now(UTC))

    def now_iso(self) -> str:
        return now_iso(self._now())

    async def create(self, rec: dict[str, Any]) -> dict[str, Any]:
        at = self.now_iso()
        full = {
            "status": "uploading",
            "folder": "",
            "tags": [],
            **rec,
            "pk": file_pk(rec["id"]),
            "sk": "META",
            "created_at": at,
            "updated_at": at,
            "gsi1pk": "FILE",
            "gsi1sk": f"{at}#{rec['id']}",
        }
        if not await self.table.put(full, if_not_exists=True):
            raise FileExistsError(rec["id"])
        return full

    async def get(self, file_id: str) -> dict[str, Any] | None:
        return await self.table.get(file_pk(file_id), "META")

    async def update(self, file_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        return await self.table.update(
            file_pk(file_id), "META", UpdateOptions(set={**patch, "updated_at": self.now_iso()}, must_exist=True)
        )

    async def all(self) -> list[dict[str, Any]]:
        """Every record, newest first (vectors included: search reads them)."""
        return list(reversed(await self.table.query_index("gsi1", "FILE")))

    async def delete(self, file_id: str) -> None:
        await self.table.delete(file_pk(file_id), "META")
