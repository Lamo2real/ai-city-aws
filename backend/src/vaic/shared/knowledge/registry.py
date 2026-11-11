"""The entry registry (§17): the system of record for department knowledge entries.

One record per entry in the knowledge table (``ITEM#kn-<entry id>`` / ``META``, listed through gsi1
``ENTRY#<department>``, so entries never crowd the owner's own Knowledge list), plus an audit row per change
(``AUDIT#<time>#<n>``). OpenSearch (through the Bedrock knowledge base) and Neptune are projections of these
records and can be rebuilt from them; ``sync`` says whether the projections have caught up with the record.
"""

from __future__ import annotations

import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ..events import now_iso
from ..table import Table, UpdateOptions
from .entries import ITEM_PREFIX, Entry
from .model import item_pk

AUDIT_KEEP = 200
"""Audit rows read back per entry (newest first)."""
_HIDDEN = ("pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk")
_LIST_FIELDS = (
    "id", "entry_id", "department", "domain", "title", "summary", "type", "audience", "platforms", "objectives",
    "confidence", "volatility", "as_of", "review_by", "origin", "builtin", "status", "error", "user_modified",
    "deleted", "retired", "seed_removed", "sync", "updated_at", "changed_by",
)  # fmt: skip


def entry_item_id(entry_id: str) -> str:
    return ITEM_PREFIX + entry_id


def is_entry_record(rec: dict[str, Any] | None) -> bool:
    return bool(rec and rec.get("entry_id"))


def record_json(rec: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in rec.items() if k not in _HIDDEN}


def list_row(rec: dict[str, Any]) -> dict[str, Any]:
    """What the list shows: no content, a flag for a newer default."""
    row = {k: rec[k] for k in _LIST_FIELDS if k in rec}
    row["has_newer_default"] = bool(rec.get("newer_default"))
    return row


def entry_fields(e: Entry, origin: str) -> dict[str, Any]:
    """The record fields an entry sets (the rest is lifecycle state)."""
    return {
        **e.fields(),
        "id": e.item_id,
        "kind": "document",
        "scope": "relevant",
        "source": "built in" if origin == "system" else "you",
        "origin": origin,
        "builtin": origin == "system",
        "content_hash": e.content_hash(),
    }


class EntryRegistry:
    def __init__(self, table: Table, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self._now = now or (lambda: datetime.now(UTC))

    def now_iso(self) -> str:
        return now_iso(self._now())

    async def get(self, entry_id: str) -> dict[str, Any] | None:
        rec = await self.table.get(item_pk(entry_item_id(entry_id)), "META")
        return rec if is_entry_record(rec) else None

    async def in_department(self, department: str) -> list[dict[str, Any]]:
        return await self.table.query_index("gsi1", f"ENTRY#{department}")

    async def put(self, rec: dict[str, Any]) -> dict[str, Any]:
        """Writes the whole record (create or replace), keeping ``created_at``."""
        at = self.now_iso()
        full = {
            **rec,
            "pk": item_pk(rec["id"]),
            "sk": "META",
            "gsi1pk": f"ENTRY#{rec['department']}",
            "gsi1sk": rec["entry_id"],
            "created_at": rec.get("created_at") or at,
            "updated_at": at,
        }
        await self.table.put(full)
        return full

    async def update(self, entry_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        return await self.table.update(
            item_pk(entry_item_id(entry_id)),
            "META",
            UpdateOptions(set={**patch, "updated_at": self.now_iso()}, must_exist=True),
        )

    async def audit(self, entry_id: str, action: str, by: str, detail: str = "", content_hash: str = "") -> None:
        at = self.now_iso()
        await self.table.put(
            {
                "pk": item_pk(entry_item_id(entry_id)),
                "sk": f"AUDIT#{at}#{secrets.token_hex(3)}",
                "action": action,
                "by": by,
                "at": at,
                "detail": detail[:500],
                "content_hash": content_hash,
            }
        )

    async def history(self, entry_id: str) -> list[dict[str, Any]]:
        rows = await self.table.query(item_pk(entry_item_id(entry_id)), "AUDIT#")
        rows.sort(key=lambda r: str(r.get("sk")), reverse=True)
        return [{k: r.get(k) for k in ("action", "by", "at", "detail", "content_hash")} for r in rows[:AUDIT_KEEP]]
