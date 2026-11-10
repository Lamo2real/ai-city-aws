"""The entity graph on Neptune Analytics (``docs/KNOWLEDGE.md`` §4, §14), behind one small interface.

``NeptuneGraph`` runs openCypher through ``neptune-graph:ExecuteQuery``. Every query is one of the fixed
templates below and every value travels as a **parameter**: nothing read from an item ever becomes query text.
``MemoryGraph`` has the same behaviour for tests.

Model: ``(:Item {id, scope, status})``, ``(:Entity {key, name, type, description})``,
``(:Item)-[:MENTIONS]->(:Entity)``, ``(:Entity)-[:REL {relation, item_id}]->(:Entity)``.
"""

from __future__ import annotations

import asyncio
import json
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Protocol

from .extract import Extraction
from .model import entity_key


@dataclass(frozen=True)
class Expansion:
    rels: list[dict[str, str]] = field(default_factory=list)
    """``{from, rel, to, item}`` for the relationships of the hit items' entities."""
    items: list[tuple[str, int]] = field(default_factory=list)
    """(item id, votes): ready items in the allowed scopes that share or neighbour those entities."""


class Graph(Protocol):
    async def upsert_item(self, item_id: str, scope: str, status: str) -> None: ...
    async def write_item_graph(self, item_id: str, scope: str, status: str, ex: Extraction) -> int:
        """Replaces the item's mentions and relationships; returns the number of entities."""
        ...

    async def delete_item(self, item_id: str) -> None: ...
    async def entities_of(self, item_id: str) -> list[dict[str, str]]: ...
    async def expand(self, ids: list[str], scopes: list[str]) -> Expansion: ...


def graph_rows(ex: Extraction) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Entities (deduplicated by key) and relationships between them, as query parameters."""
    ents: dict[str, dict[str, str]] = {}
    for e in ex.entities:
        k = entity_key(e.name)
        if k and k not in ents:
            ents[k] = {"key": k, "name": e.name, "type": e.type, "description": e.description}
    rels = []
    for r in ex.relationships:
        a, b = entity_key(r.source), entity_key(r.target)
        if a in ents and b in ents and a != b and r.relation:
            rels.append({"a": a, "b": b, "relation": r.relation})
    return list(ents.values()), rels


# ---------- openCypher templates (parameters only) ----------
Q_UPSERT_ITEM = "MERGE (i:Item {id: $id}) SET i.scope = $scope, i.status = $status"
Q_ENSURE_ITEM = "MERGE (i:Item {id: $id}) ON CREATE SET i.scope = $scope, i.status = $status"
Q_DELETE_RELS = "MATCH (:Entity)-[r:REL]->(:Entity) WHERE r.item_id = $id DELETE r"
Q_ITEM_ENTITY_KEYS = "MATCH (:Item {id: $id})-[:MENTIONS]->(e:Entity) RETURN e.key AS key"
Q_DELETE_MENTIONS = "MATCH (:Item {id: $id})-[m:MENTIONS]->(:Entity) DELETE m"
Q_DELETE_ITEM = "MATCH (i:Item {id: $id}) DETACH DELETE i"
Q_DELETE_ORPHANS = (
    "UNWIND $keys AS k MATCH (e:Entity {key: k}) OPTIONAL MATCH (e)<-[m:MENTIONS]-(:Item) "
    "WITH e, count(m) AS n WHERE n = 0 DETACH DELETE e"
)
Q_WRITE_ENTITIES = (
    "MATCH (i:Item {id: $id}) UNWIND $entities AS ent "
    "MERGE (e:Entity {key: ent.key}) SET e.name = ent.name, e.type = ent.type, e.description = ent.description "
    "MERGE (i)-[:MENTIONS]->(e)"
)
Q_WRITE_RELS = (
    "UNWIND $rels AS r MATCH (a:Entity {key: r.a}), (b:Entity {key: r.b}) "
    "CREATE (a)-[:REL {relation: r.relation, item_id: $id}]->(b)"
)
Q_ENTITIES_OF = "MATCH (:Item {id: $id})-[:MENTIONS]->(e:Entity) RETURN e.name AS name, e.type AS type ORDER BY name"
Q_EXPAND = (
    "MATCH (i:Item)-[:MENTIONS]->(e:Entity) WHERE i.id IN $ids "
    "OPTIONAL MATCH (e)-[r:REL]-(o:Entity) "
    "WITH collect(DISTINCT e) + collect(DISTINCT o) AS ents, "
    "collect(DISTINCT CASE WHEN r IS NULL THEN null ELSE "
    "{from: startNode(r).name, rel: r.relation, to: endNode(r).name, item: r.item_id} END) AS rels "
    "UNWIND ents AS x WITH DISTINCT rels, x "
    "OPTIONAL MATCH (x)<-[:MENTIONS]-(j:Item) "
    "WHERE NOT j.id IN $ids AND j.status = 'ready' AND j.scope IN $scopes "
    "WITH rels, j.id AS id, count(j) AS votes "
    "RETURN rels, collect(CASE WHEN id IS NULL THEN null ELSE {id: id, votes: votes} END) AS items"
)
QUERIES = (
    Q_UPSERT_ITEM,
    Q_ENSURE_ITEM,
    Q_DELETE_RELS,
    Q_ITEM_ENTITY_KEYS,
    Q_DELETE_MENTIONS,
    Q_DELETE_ITEM,
    Q_DELETE_ORPHANS,
    Q_WRITE_ENTITIES,
    Q_WRITE_RELS,
    Q_ENTITIES_OF,
    Q_EXPAND,
)


class NeptuneGraph:
    """``client`` is a boto3 ``neptune-graph`` client; ``graph_id`` the graph identifier."""

    def __init__(self, client: Any, graph_id: str) -> None:
        self._c = client
        self.graph_id = graph_id

    async def _q(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        assert query in QUERIES, "only the fixed templates run"
        r = await asyncio.to_thread(
            self._c.execute_query,
            graphIdentifier=self.graph_id,
            queryString=query,
            language="OPEN_CYPHER",
            parameters=params,
        )
        payload = r.get("payload")
        raw = payload.read() if hasattr(payload, "read") else payload
        if not raw:
            return []
        data = json.loads(raw)
        rows: list[dict[str, Any]] = data.get("results", []) if isinstance(data, dict) else []
        return rows

    async def upsert_item(self, item_id: str, scope: str, status: str) -> None:
        await self._q(Q_UPSERT_ITEM, {"id": item_id, "scope": scope, "status": status})

    async def _clear(self, item_id: str, delete_node: bool) -> None:
        await self._q(Q_DELETE_RELS, {"id": item_id})
        keys = [str(r["key"]) for r in await self._q(Q_ITEM_ENTITY_KEYS, {"id": item_id})]
        await self._q(Q_DELETE_ITEM if delete_node else Q_DELETE_MENTIONS, {"id": item_id})
        if keys:
            await self._q(Q_DELETE_ORPHANS, {"keys": keys})

    async def write_item_graph(self, item_id: str, scope: str, status: str, ex: Extraction) -> int:
        await self._q(Q_ENSURE_ITEM, {"id": item_id, "scope": scope, "status": status})
        await self._clear(item_id, delete_node=False)
        ents, rels = graph_rows(ex)
        if ents:
            await self._q(Q_WRITE_ENTITIES, {"id": item_id, "entities": ents})
        if rels:
            await self._q(Q_WRITE_RELS, {"id": item_id, "rels": rels})
        return len(ents)

    async def delete_item(self, item_id: str) -> None:
        await self._clear(item_id, delete_node=True)

    async def entities_of(self, item_id: str) -> list[dict[str, str]]:
        return [
            {"name": str(r["name"]), "type": str(r.get("type") or "concept")}
            for r in await self._q(Q_ENTITIES_OF, {"id": item_id})
        ]

    async def expand(self, ids: list[str], scopes: list[str]) -> Expansion:
        if not ids:
            return Expansion()
        rows = await self._q(Q_EXPAND, {"ids": ids, "scopes": scopes})
        rels: list[dict[str, str]] = []
        votes: Counter[str] = Counter()
        for row in rows:
            for r in row.get("rels") or []:
                if isinstance(r, dict) and r not in rels:
                    rels.append({k: str(r.get(k, "")) for k in ("from", "rel", "to", "item")})
            for it in row.get("items") or []:
                if isinstance(it, dict) and it.get("id"):
                    votes[str(it["id"])] += int(it.get("votes") or 1)
        return Expansion(rels=rels, items=votes.most_common())


class MemoryGraph:
    """The same graph in memory, for tests and local runs."""

    def __init__(self) -> None:
        self.items: dict[str, dict[str, str]] = {}
        self.entities: dict[str, dict[str, str]] = {}
        self.mentions: set[tuple[str, str]] = set()
        """(item id, entity key)"""
        self.rels: list[dict[str, str]] = []
        """{a, b, relation, item_id}"""

    async def upsert_item(self, item_id: str, scope: str, status: str) -> None:
        self.items[item_id] = {"id": item_id, "scope": scope, "status": status}

    def _clear(self, item_id: str, delete_node: bool) -> None:
        self.rels = [r for r in self.rels if r["item_id"] != item_id]
        keys = {k for i, k in self.mentions if i == item_id}
        self.mentions = {(i, k) for i, k in self.mentions if i != item_id}
        if delete_node:
            self.items.pop(item_id, None)
        for k in keys:
            if not any(kk == k for _, kk in self.mentions):
                self.entities.pop(k, None)
                self.rels = [r for r in self.rels if k not in (r["a"], r["b"])]

    async def write_item_graph(self, item_id: str, scope: str, status: str, ex: Extraction) -> int:
        self.items.setdefault(item_id, {"id": item_id, "scope": scope, "status": status})
        self._clear(item_id, delete_node=False)
        ents, rels = graph_rows(ex)
        for e in ents:
            self.entities[e["key"]] = dict(e)
            self.mentions.add((item_id, e["key"]))
        for r in rels:
            self.rels.append({**r, "item_id": item_id})
        return len(ents)

    async def delete_item(self, item_id: str) -> None:
        self._clear(item_id, delete_node=True)

    async def entities_of(self, item_id: str) -> list[dict[str, str]]:
        out = [self.entities[k] for i, k in self.mentions if i == item_id and k in self.entities]
        return sorted(({"name": e["name"], "type": e["type"]} for e in out), key=lambda e: e["name"])

    async def expand(self, ids: list[str], scopes: list[str]) -> Expansion:
        hit_ents = {k for i, k in self.mentions if i in ids}
        if not hit_ents:
            return Expansion()
        rels: list[dict[str, str]] = []
        ents = set(hit_ents)
        for r in self.rels:
            if r["a"] in hit_ents or r["b"] in hit_ents:
                ents |= {r["a"], r["b"]}
                line = {
                    "from": self.entities[r["a"]]["name"],
                    "rel": r["relation"],
                    "to": self.entities[r["b"]]["name"],
                    "item": r["item_id"],
                }
                if line not in rels:
                    rels.append(line)
        votes: Counter[str] = Counter()
        for i, k in self.mentions:
            node = self.items.get(i)
            if k in ents and i not in ids and node and node["status"] == "ready" and node["scope"] in scopes:
                votes[i] += 1
        return Expansion(rels=rels, items=votes.most_common())


class NoGraph:
    """When no graph is configured: writes do nothing, reads find nothing."""

    async def upsert_item(self, item_id: str, scope: str, status: str) -> None:
        return None

    async def write_item_graph(self, item_id: str, scope: str, status: str, ex: Extraction) -> int:
        return 0

    async def delete_item(self, item_id: str) -> None:
        return None

    async def entities_of(self, item_id: str) -> list[dict[str, str]]:
        return []

    async def expand(self, ids: list[str], scopes: list[str]) -> Expansion:
        return Expansion()
