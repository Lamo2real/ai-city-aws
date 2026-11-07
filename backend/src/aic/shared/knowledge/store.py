"""Items, entities, mentions and relationships in the ``aic-prod-knowledge`` table (§4), over ``Table``."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ..events import now_iso
from ..table import Table, UpdateOptions
from .extract import Extraction
from .model import ALWAYS_BUDGET_TOKENS, CHARS_PER_TOKEN, entity_key, estimate_tokens, item_pk


class KnowledgeStore:
    def __init__(self, table: Table, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self._now = now or (lambda: datetime.now(UTC))

    def now_iso(self) -> str:
        return now_iso(self._now())

    # ---------- items ----------
    async def create_item(self, item: dict[str, Any]) -> dict[str, Any]:
        at = self.now_iso()
        rec = {
            "status": "uploading",
            "entity_count": 0,
            "normalized_keys": [],
            "graph_keys": [],
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
        return await self.table.update(item_pk(item_id), "META", UpdateOptions(set=s, must_exist=True))

    async def list_items(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Newest first."""
        items = list(reversed(await self.table.query_index("gsi1", "ITEM")))
        return items[:limit] if limit else items

    async def items_by_scope(self, scope: str) -> list[dict[str, Any]]:
        """Oldest first."""
        return await self.table.query_index("gsi2", f"SCOPE#{scope}")

    async def delete_item(self, item_id: str) -> None:
        await self.clear_graph(item_id)
        await self.table.delete(item_pk(item_id), "META")

    async def get_items(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        got = await asyncio.gather(*(self.get_item(i) for i in dict.fromkeys(ids)))
        return {g["id"]: g for g in got if g}

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
    async def clear_graph(self, item_id: str) -> None:
        """Removes this item's mentions and relationships, and entities nothing mentions any more."""
        it = await self.get_item(item_id)
        keys = [tuple(k) for k in (it or {}).get("graph_keys") or []]
        for m in await self.table.query_index("gsi2", f"MENTION#{item_id}"):
            keys.append((m["pk"], m["sk"]))
        entities = {pk for pk, _ in keys if pk.startswith("ENT#")}
        for pk, sk in dict.fromkeys(keys):
            await self.table.delete(pk, sk)
        for pk in entities:
            if not await self.table.query(pk, "ITEM#"):
                for rest in await self.table.query(pk):
                    await self.table.delete(rest["pk"], rest["sk"])
        if it:
            await self.update_item(item_id, {"graph_keys": [], "entity_count": 0})

    async def write_graph(self, item_id: str, ex: Extraction) -> list[list[str]]:
        """Writes the entities, mentions and both directions of each relationship; returns the item's keys."""
        await self.clear_graph(item_id)
        keys: list[list[str]] = []
        names: dict[str, str] = {}
        for e in ex.entities:
            k = entity_key(e.name)
            if not k or k in names:
                continue
            names[k] = e.name
            await self.table.update(
                f"ENT#{k}", "META", UpdateOptions(set={"name": e.name, "type": e.type, "description": e.description})
            )
            await self.table.put(
                {
                    "pk": f"ENT#{k}",
                    "sk": f"ITEM#{item_id}",
                    "gsi2pk": f"MENTION#{item_id}",
                    "gsi2sk": f"ENT#{k}",
                    "item_id": item_id,
                }
            )
            keys.append([f"ENT#{k}", f"ITEM#{item_id}"])
        for r in ex.relationships:
            a, b = entity_key(r.source), entity_key(r.target)
            if a not in names or b not in names or a == b:
                continue
            common = {"relation": r.relation, "item_id": item_id}
            fwd = {"pk": f"ENT#{a}", "sk": f"REL#{r.relation}#{b}#{item_id}", "other": b, **common}
            rev = {"pk": f"ENT#{b}", "sk": f"REL#~{r.relation}#{a}#{item_id}", "other": a, **common}
            fwd |= {"from_name": names[a], "to_name": names[b]}
            rev |= {"from_name": names[a], "to_name": names[b]}
            for rec in (fwd, rev):
                await self.table.put(rec)
                keys.append([rec["pk"], rec["sk"]])
        await self.update_item(item_id, {"graph_keys": keys, "entity_count": len(names)})
        return keys

    async def entities_of(self, item_id: str) -> list[dict[str, Any]]:
        mentions = await self.table.query_index("gsi2", f"MENTION#{item_id}")
        metas = await asyncio.gather(*(self.table.get(m["pk"], "META") for m in mentions))
        return [
            {"key": m["pk"][4:], "name": e["name"], "type": e.get("type", "concept")}
            for m, e in zip(mentions, metas, strict=True)
            if e
        ]

    async def relationships_of(self, key: str) -> list[dict[str, Any]]:
        return await self.table.query(f"ENT#{key}", "REL#")

    async def items_mentioning(self, key: str) -> list[str]:
        return [str(m["item_id"]) for m in await self.table.query(f"ENT#{key}", "ITEM#")]


ALWAYS_BUDGET_CHARS = ALWAYS_BUDGET_TOKENS * CHARS_PER_TOKEN
