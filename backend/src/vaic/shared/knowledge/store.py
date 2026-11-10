"""Knowledge items: records in the ``vaic-prod-knowledge`` table, the entity graph in Neptune (§4).

DynamoDB holds the item records only. Every status or scope change is mirrored onto the graph's ``Item``
node, so the graph expansion can filter on them in the query itself.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ..events import now_iso
from ..table import Table, UpdateOptions
from .extract import Extraction
from .graph import Graph, NoGraph
from .model import ALWAYS_BUDGET_TOKENS, estimate_tokens, item_pk


class KnowledgeStore:
    def __init__(self, table: Table, graph: Graph | None = None, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self.graph: Graph = graph or NoGraph()
        self._now = now or (lambda: datetime.now(UTC))

    def now_iso(self) -> str:
        return now_iso(self._now())

    # ---------- items ----------
    async def create_item(self, item: dict[str, Any]) -> dict[str, Any]:
        """The record only: the graph node appears when the pipeline starts (VAIC may not write the graph)."""
        at = self.now_iso()
        rec = {
            "status": "uploading",
            "entity_count": 0,
            "normalized_keys": [],
            **item,
            "pk": item_pk(item["id"]),
            "sk": "META",
            "created_at": at,
            "updated_at": at,
            "gsi1pk": "ITEM",
            "gsi1sk": at,
            "gsi2pk": f"SCOPE#{item['scope']}",
            "gsi2sk": at,
        }
        if not await self.table.put(rec, if_not_exists=True):
            raise RuntimeError("item id collision")
        return rec

    async def get_item(self, item_id: str) -> dict[str, Any] | None:
        return await self.table.get(item_pk(item_id), "META")

    async def require_item(self, item_id: str) -> dict[str, Any]:
        it = await self.get_item(item_id)
        if not it:
            raise LookupError(f"no knowledge item {item_id}")
        return it

    async def update_item(self, item_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        s = {**patch, "updated_at": self.now_iso()}
        if "scope" in patch:
            s["gsi2pk"] = f"SCOPE#{patch['scope']}"
        new = await self.table.update(item_pk(item_id), "META", UpdateOptions(set=s, must_exist=True))
        if new is not None and ("scope" in patch or "status" in patch):
            await self.graph.upsert_item(item_id, str(new["scope"]), str(new["status"]))
        return new

    async def list_items(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Newest first."""
        items = list(reversed(await self.table.query_index("gsi1", "ITEM")))
        return items[:limit] if limit else items

    async def items_by_scope(self, scope: str) -> list[dict[str, Any]]:
        """Oldest first."""
        return await self.table.query_index("gsi2", f"SCOPE#{scope}")

    async def delete_item(self, item_id: str) -> None:
        await self.graph.delete_item(item_id)
        await self.table.delete(item_pk(item_id), "META")

    async def get_items(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        """One BatchGetItem for all of them (consistent reads)."""
        if not ids:
            return {}
        got = await self.table.batch_get([(item_pk(i), "META") for i in dict.fromkeys(ids)])
        return {g["id"]: g for g in got}

    # ---------- always-include budget (§2) ----------
    async def always_items(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Ready ``always`` items with a summary, oldest first: (inside the 8,000-token budget, beyond it)."""
        inside: list[dict[str, Any]] = []
        beyond: list[dict[str, Any]] = []
        used = 0
        for it in await self.items_by_scope("always"):
            if it.get("status") != "ready" or not it.get("summary"):
                continue
            n = estimate_tokens(str(it["summary"]))
            if used + n <= ALWAYS_BUDGET_TOKENS:
                inside.append(it)
                used += n
            else:
                beyond.append(it)
        return inside, beyond

    async def always_tokens(self) -> int:
        inside, _ = await self.always_items()
        return sum(estimate_tokens(str(i["summary"])) for i in inside)

    # ---------- graph ----------
    async def write_graph(self, item_id: str, ex: Extraction) -> int:
        """Replaces the item's entities and relationships in the graph; the record keeps the count."""
        item = await self.require_item(item_id)
        n = await self.graph.write_item_graph(item_id, str(item["scope"]), str(item["status"]), ex)
        await self.update_item(item_id, {"entity_count": n})
        return n

    async def entities_of(self, item_id: str) -> list[dict[str, str]]:
        return await self.graph.entities_of(item_id)
