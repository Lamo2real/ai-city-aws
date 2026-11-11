"""Projections of the entry registry (§17): the parts in S3 and the vector store, and the graph.

An entry is indexed as one small document per part (``normalized/builtin/<department>/<entry id>/<n>.md`` with
its ``.metadata.json``), so ids are deterministic (``<entry id>#<n>``) and re-indexing replaces instead of adding.
Parts an edit no longer has are deleted from the index. The graph gets the entry vertex and its edges.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

from ..log import log
from .entries import Entry, Taxonomy, index_parts, kb_entry_metadata, mentioned_concepts
from .graph import EntryRow, Graph, TaxonomyRows, taxonomy_vertex_id
from .kb import INDEXED, MAX_DOCS_PER_CALL, KnowledgeBase, ThrottlingException

INGEST_TRIES = 8
INGEST_BACKOFF_S = 2.0


def parts_prefix(department: str, entry_id: str) -> str:
    return f"normalized/builtin/{department}/{entry_id}/"


def taxonomy_rows(tax: Taxonomy) -> TaxonomyRows:
    d = tax.department

    def rows(kind: str, xs: dict[str, str]) -> list[dict[str, str]]:
        return [{"id": taxonomy_vertex_id(d, kind, k), "name": v} for k, v in xs.items()]

    return TaxonomyRows(
        department=d,
        name=tax.label,
        domains=rows("domain", tax.domains),
        platforms=rows("platform", tax.platforms),
        objectives=rows("objective", tax.objectives),
        concepts=[
            {
                "id": taxonomy_vertex_id(d, "concept", str(c["id"])),
                "name": str(c.get("label") or c["id"]),
                "kind": str(c.get("kind") or "concept"),
            }
            for c in tax.concepts
        ],
        measured_by=[
            {"a": taxonomy_vertex_id(d, "concept", str(c["id"])), "b": taxonomy_vertex_id(d, "concept", str(m))}
            for c in tax.concepts
            for m in c.get("measured_by") or []
        ],
    )


def entry_row(e: Entry, tax: Taxonomy, status: str) -> EntryRow:
    d = e.department

    def v(kind: str, ids: Any) -> list[str]:
        return [taxonomy_vertex_id(d, kind, i) for i in ids]

    return EntryRow(
        id=e.item_id,
        entry_id=e.id,
        department=d,
        domain=taxonomy_vertex_id(d, "domain", e.domain),
        title=e.title,
        status=status,
        audience=e.audience,
        type=e.type,
        edges={
            "IN_DOMAIN": v("domain", [e.domain]),
            "APPLIES_TO": v("platform", e.platforms),
            "SERVES": v("objective", e.objectives),
            "MENTIONS": v("concept", mentioned_concepts(e, tax)),
            "RELATED_TO": [f"kn-{r}" for r in e.related],
            "REQUIRES": [f"kn-{r}" for r in e.requires],
            "SUPERSEDES": [f"kn-{r}" for r in e.supersedes],
        },
    )


class EntryProjector:
    def __init__(
        self,
        blobs: Any,
        kb: KnowledgeBase | None,
        graph: Graph,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.blobs = blobs
        self.kb = kb
        self.graph = graph
        self._sleep = sleep

    def uri(self, key: str) -> str:
        return f"s3://{self.blobs.bucket}/{key}"

    async def write_parts(self, e: Entry, origin: str, label: str) -> list[tuple[str, dict[str, Any]]]:
        """Writes every part and its metadata file to S3; returns the documents to ingest."""
        docs = []
        prefix = parts_prefix(e.department, e.id)
        for n, text in enumerate(index_parts(e, label)):
            key = f"{prefix}{n}.md"
            meta = kb_entry_metadata(e, origin, n)
            await self.blobs.put(key, text.encode(), "text/markdown")
            await self.blobs.put(
                f"{key}.metadata.json", json.dumps({"metadataAttributes": meta}).encode(), "application/json"
            )
            docs.append((self.uri(key), meta))
        return docs

    async def ingest(self, docs: list[tuple[str, dict[str, Any]]]) -> None:
        """In batches of 25, each retried with back-off while Bedrock throttles."""
        if not self.kb:
            raise RuntimeError("the knowledge base is not set up")
        for i in range(0, len(docs), MAX_DOCS_PER_CALL):
            batch = docs[i : i + MAX_DOCS_PER_CALL]
            for attempt in range(INGEST_TRIES):
                try:
                    await self.kb.ingest(batch)
                    break
                except ThrottlingException:
                    if attempt == INGEST_TRIES - 1:
                        raise
                    await self._sleep(INGEST_BACKOFF_S * 2**attempt)

    async def drop_stale(self, old: list[str], keep: list[str]) -> None:
        """Parts an edit no longer has: out of the index, then out of S3 (the bucket keeps old versions)."""
        stale = [u for u in old if u not in set(keep)]
        if not stale:
            return
        if self.kb:
            await self.kb.delete(stale)
        for u in stale:
            key = u.split("/", 3)[3]
            await self.blobs.delete(key)
            await self.blobs.delete(f"{key}.metadata.json")

    async def unproject(self, department: str, entry_id: str, uris: list[str]) -> None:
        """Out of the vector store, S3 (versions stay recoverable) and the graph."""
        if uris and self.kb:
            await self.kb.delete(uris)
        await self.blobs.delete_prefix(parts_prefix(department, entry_id))
        await self.graph.delete_entries([f"kn-{entry_id}"])

    async def indexed(self, uris: list[str]) -> tuple[bool, str | None]:
        """(all indexed, the failure if any) for one entry's parts."""
        if not self.kb or not uris:
            return False, None
        states = await self.kb.statuses(uris)
        bad = sorted({s for s in states.values() if s and s not in INDEXED and s not in _IN_PROGRESS})
        if bad:
            return False, f"Indexing failed (the knowledge base says {', '.join(bad)})."
        return all(states.get(u) in INDEXED for u in uris), None


_IN_PROGRESS = ("STARTING", "IN_PROGRESS", "PENDING", "")


async def safe(coro: Awaitable[Any], what: str) -> str | None:
    """Runs one projection step; returns the plain-words error instead of raising."""
    try:
        await coro
        return None
    except Exception as e:
        why = " ".join(f"{type(e).__name__}: {e}".split())[:300]
        log("warn", "knowledge.entry_projection_failed", step=what, detail=why)
        return f"{what} failed ({why})"
