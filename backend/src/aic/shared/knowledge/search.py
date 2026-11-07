"""``search_knowledge`` (§7) and the ``<owner-knowledge>`` block for every prompt (§2).

Retrieve with the scope filter → group by item → graph expansion (entities of the hit items → 1-hop related
entities → up to 3 more ready items as summaries). Hits are checked against the item's *current* record, so
a scope change or a delete counts at once, before the next sync. Everything returned is marked as data.
"""

from __future__ import annotations

import asyncio
import html
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from .kb import Hit, KnowledgeBase
from .model import DATA_HEADER, Scope
from .store import KnowledgeStore

MAX_RELATED_ITEMS = 3
MAX_RELATED_LINES = 15
SNIPPETS_PER_ITEM = 2
SNIPPET_CHARS = 1500


def allowed_scopes(include_on_request: bool) -> list[Scope]:
    return ["always", "relevant", "on_request"] if include_on_request else ["always", "relevant"]


def _attr(v: Any) -> str:
    return html.escape(str(v or ""), quote=True).replace("\n", " ")[:300]


def _body(v: str) -> str:
    """Content can't close the data block or open a new one: angle brackets are escaped."""
    return html.escape(v.strip(), quote=False)


def knowledge_block(item: dict[str, Any], text: str) -> str:
    return (
        f'<knowledge item="{_attr(item["id"])}" title="{_attr(item.get("title"))}" '
        f'source="{_attr(item.get("source"))}" scope="{_attr(item.get("scope"))}">\n{_body(text)}\n</knowledge>'
    )


@dataclass
class SearchResult:
    items: list[tuple[dict[str, Any], list[str]]] = field(default_factory=list)
    related_items: list[dict[str, Any]] = field(default_factory=list)
    related_lines: list[str] = field(default_factory=list)

    def text(self) -> str:
        if not self.items and not self.related_items:
            return f"{DATA_HEADER}\nNothing in the knowledge base matches."
        parts = [DATA_HEADER]
        for item, snippets in self.items:
            parts.append(knowledge_block(item, "\n…\n".join(snippets)))
        for item in self.related_items:
            parts.append(knowledge_block(item, f"(related, summary) {item.get('summary', '')}"))
        parts += self.related_lines
        return "\n".join(parts)


def _usable(item: dict[str, Any] | None, scopes: list[Scope]) -> bool:
    return item is not None and item.get("status") == "ready" and item.get("scope") in scopes


async def search(
    kb: KnowledgeBase,
    store: KnowledgeStore,
    query: str,
    max_results: int = 5,
    include_on_request: bool = False,
) -> SearchResult:
    scopes = allowed_scopes(include_on_request)
    hits = await kb.retrieve(query, min(30, max_results * 4), list(scopes))
    grouped: dict[str, list[Hit]] = {}
    for h in sorted(hits, key=lambda h: h.score, reverse=True):
        grouped.setdefault(h.item_id, []).append(h)
    records = await store.get_items(list(grouped))
    out = SearchResult()
    for item_id, hs in grouped.items():
        item = records.get(item_id)
        if not _usable(item, scopes):
            continue
        assert item is not None
        out.items.append((item, [h.text[:SNIPPET_CHARS] for h in hs[:SNIPPETS_PER_ITEM]]))
        if len(out.items) >= max_results:
            break
    await _expand(store, out, scopes)
    return out


async def _expand(store: KnowledgeStore, out: SearchResult, scopes: list[Scope]) -> None:
    hit_ids = {item["id"] for item, _ in out.items}
    if not hit_ids:
        return
    entity_lists = await asyncio.gather(*(store.entities_of(i) for i in hit_ids))
    keys = list(dict.fromkeys(e["key"] for es in entity_lists for e in es))
    rel_lists = await asyncio.gather(*(store.relationships_of(k) for k in keys))
    neighbours: list[str] = []
    seen_lines: set[str] = set()
    for rels in rel_lists:
        for r in rels:
            neighbours.append(str(r["other"]))
            line = (
                f"related: {_attr(r.get('from_name'))} —{_attr(r.get('relation'))}→ "
                f"{_attr(r.get('to_name'))} (item {_attr(r.get('item_id'))})"
            )
            if line not in seen_lines and len(out.related_lines) < MAX_RELATED_LINES:
                seen_lines.add(line)
                out.related_lines.append(line)
    linked = list(dict.fromkeys([*keys, *neighbours]))
    mention_lists = await asyncio.gather(*(store.items_mentioning(k) for k in linked))
    votes = Counter(i for ids in mention_lists for i in ids if i not in hit_ids)
    if not votes:
        return
    candidates = [i for i, _ in votes.most_common(MAX_RELATED_ITEMS * 4)]
    records = await store.get_items(candidates)
    for i in candidates:
        item = records.get(i)
        if _usable(item, scopes) and item and item.get("summary"):
            out.related_items.append(item)
            if len(out.related_items) >= MAX_RELATED_ITEMS:
                break


async def always_block(store: KnowledgeStore) -> str:
    """The ``always`` summaries for every role's prompt, inside the 8,000-token budget, oldest first."""
    inside, _ = await store.always_items()
    if not inside:
        return ""
    blocks = "\n".join(knowledge_block(i, str(i["summary"])) for i in inside)
    return f"<owner-knowledge>\n{DATA_HEADER}\n{blocks}\n</owner-knowledge>"
