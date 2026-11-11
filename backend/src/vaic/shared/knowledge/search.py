"""``search_knowledge`` (§7, §14) and the ``<owner-knowledge>`` block for every prompt (§2).

Hybrid Retrieve with the scope filter → group by item → one openCypher expansion query (entities of the hit
items → 1-hop related entities → ready items in the allowed scopes). The Retrieve hits and the expansion are
cached per process (LRU, 256 entries, 60 s); the item records are re-read on every call with one
BatchGetItem, so a scope change or a delete counts at once. Everything returned is marked as data.

Department knowledge entries (§17) are isolated here, server-side: a caller sees an entry only when the entry's
department is the caller's own department. The Retrieve filter keeps other departments out of the hits, and the
re-read record is checked again, so a filter the index cannot apply only shortens an answer, never widens it.
"""

from __future__ import annotations

import html
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from ..log import log
from .entries import AUDIENCES, all_departments
from .graph import Expansion
from .jurisdiction import (
    item_holds_in,
    label,
    market_codes,
    market_filter,
    status_for,
    superseded_map,
)
from .kb import Hit, KnowledgeBase
from .model import DATA_HEADER, Scope
from .store import KnowledgeStore

MAX_RELATED_ITEMS = 3
MAX_RELATED_LINES = 15
SNIPPETS_PER_ITEM = 2
SNIPPET_CHARS = 1500
CACHE_SIZE = 256
CACHE_TTL_S = 60.0


RETRIEVE_ENTRY_FILTERS = False
"""Send the department/audience/entry filters to Retrieve too (off until the index is shown to apply them)."""
ENTRY_FETCH = 30
"""Hits fetched for a department caller, so its entries are found after other departments' are dropped."""
ENTRY_CHARS = 6000
"""An entry is returned whole (they are written to stand alone), up to this many characters."""
MAX_RELATED_ENTRIES = 3


@dataclass(frozen=True)
class Caller:
    """Who is searching: their department sees its own entries; nobody sees another department's."""

    department: str | None = None
    """The department key (``marketing``), or None for VAIC, the Orchestrator and the executives."""
    role: str = ""
    audience: str = "mine"
    """``mine`` (a manager gets manager and both entries, a worker worker and both) or ``all``."""
    domain: str | None = None
    platforms: tuple[str, ...] = ()
    entry_type: str | None = None
    related: bool = True

    def audiences(self) -> tuple[str, ...]:
        if self.audience == "all" or self.role not in ("manager", "worker"):
            return AUDIENCES
        return (self.role, "both")

    def key(self) -> tuple[object, ...]:
        return (self.department, self.audiences(), self.domain, self.platforms, self.entry_type, self.related)

    def has_entry_filters(self) -> bool:
        return bool(self.domain or self.platforms or self.entry_type)


def caller_filter(caller: Caller | None) -> dict[str, Any] | None:
    """The Retrieve filter: other departments out; the entry filters the caller asked for."""
    c = caller or Caller()
    others = [d for d in all_departments() if d != c.department]
    parts: list[dict[str, Any]] = []
    if others:
        parts.append({"notIn": {"key": "department", "value": others}})
    hidden = [a for a in AUDIENCES if a not in c.audiences()]
    if hidden:
        parts.append({"notIn": {"key": "audience", "value": hidden}})
    if c.domain:
        parts.append({"equals": {"key": "domain", "value": c.domain}})
    if c.entry_type:
        parts.append({"equals": {"key": "entry_type", "value": c.entry_type}})
    if c.platforms:
        ps = [{"listContains": {"key": "platforms", "value": p}} for p in c.platforms]
        parts.append(ps[0] if len(ps) == 1 else {"orAll": ps})
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else {"andAll": parts}


def entry_visible(item: dict[str, Any], caller: Caller | None) -> bool:
    """The record decides: an item of a department is visible only to that department's agents."""
    c = caller or Caller()
    dept = item.get("department")
    if dept and dept != c.department:
        return False
    if not item.get("entry_id"):
        return not c.has_entry_filters()  # the owner's own items carry no domain, platform or type
    if item.get("deleted") or item.get("retired") or item.get("audience") not in c.audiences():
        return False
    if c.domain and item.get("domain") != c.domain:
        return False
    if c.entry_type and item.get("type") != c.entry_type:
        return False
    return not c.platforms or bool(set(c.platforms) & set(item.get("platforms") or []))


def entry_block(item: dict[str, Any], today: date | None = None, snippets: list[str] | None = None) -> str:
    """A whole entry with what an agent needs to hedge: dates, volatility, confidence and sources."""
    stale = (
        item.get("volatility") == "fast-moving"
        and str(item.get("review_by") or "9999") < (today or date.today()).isoformat()
    )
    attrs = "".join(
        f' {k}="{_attr(item.get(k))}"'
        for k in ("department", "domain", "type", "as_of", "review_by", "volatility", "confidence", "origin")
        if item.get(k)
    )
    body = str(item.get("content") or "")
    if len(body) > ENTRY_CHARS:
        # A long whole document: the passages that matched, not a cut-off start (decision 222).
        body = "\n…\n".join(snippets) if snippets else body[:ENTRY_CHARS]
    refs = item.get("cross_refs") or {}
    if refs:
        body += (
            "\n\nCross-references (sections of the main research and the entries that hold them now):\n"
            + "\n".join(f"- section {k}: {', '.join(v)}" for k, v in refs.items())
        )
    sources = "\n".join(f"- {s}" for s in (item.get("sources") or [])[:20])
    return (
        f'<knowledge entry="{_attr(item.get("entry_id"))}" title="{_attr(item.get("title"))}"{attrs}'
        f"{' needs_verification="past review date"' if stale else ''}>"
        f"\nSummary: {_body(str(item.get('summary') or ''))}\n\n{_body(body)}"
        + (f"\n\nSources:\n{_body(sources)}" if sources else "")
        + "\n</knowledge>"
    )


def allowed_scopes(include_on_request: bool) -> list[Scope]:
    return ["always", "relevant", "on_request"] if include_on_request else ["always", "relevant"]


def _attr(v: Any) -> str:
    return html.escape(str(v or ""), quote=True).replace("\n", " ")[:300]


def _body(v: str) -> str:
    """Content can't close the data block or open a new one: angle brackets are escaped."""
    return html.escape(v.strip(), quote=False)


def _place_attrs(item: dict[str, Any], status: str | None) -> str:
    """Where and when the item holds (§15), so an agent can say which country a rule comes from."""
    out = ""
    if item.get("jurisdictions"):
        out += f' jurisdictions="{_attr(",".join(item["jurisdictions"]))}"'
    for k in ("year", "topic", "doc_type"):
        if item.get(k) not in (None, ""):
            out += f' {k}="{_attr(item[k])}"'
    if status:
        out += f' status="{_attr(status)}"'
    return out


def knowledge_block(item: dict[str, Any], text: str, status: str | None = None) -> str:
    return (
        f'<knowledge item="{_attr(item["id"])}" title="{_attr(item.get("title"))}" '
        f'source="{_attr(item.get("source"))}" scope="{_attr(item.get("scope"))}"{_place_attrs(item, status)}>'
        f"\n{_body(text)}\n</knowledge>"
    )


@dataclass(frozen=True)
class _Cached:
    groups: list[tuple[str, list[Hit]]]
    expansion: Expansion


class SearchCache:
    """A small LRU with a time limit, keyed by ``(query, include_on_request, max_results)``."""

    def __init__(self, size: int = CACHE_SIZE, ttl_s: float = CACHE_TTL_S, clock: Callable[[], float] = time.monotonic):
        self.size = size
        self.ttl_s = ttl_s
        self._clock = clock
        self._d: OrderedDict[tuple[Any, ...], tuple[float, _Cached]] = OrderedDict()

    def get(self, key: tuple[Any, ...]) -> _Cached | None:
        hit = self._d.get(key)
        if not hit:
            return None
        at, value = hit
        if self._clock() - at > self.ttl_s:
            del self._d[key]
            return None
        self._d.move_to_end(key)
        return value

    def put(self, key: tuple[Any, ...], value: _Cached) -> None:
        self._d[key] = (self._clock(), value)
        self._d.move_to_end(key)
        while len(self._d) > self.size:
            self._d.popitem(last=False)

    def __len__(self) -> int:
        return len(self._d)


@dataclass
class SearchResult:
    items: list[tuple[dict[str, Any], list[str]]] = field(default_factory=list)
    related_items: list[dict[str, Any]] = field(default_factory=list)
    related_lines: list[str] = field(default_factory=list)
    statuses: dict[str, str] = field(default_factory=dict)
    """item id → in force / superseded by … / not yet in force, for items that have a place and a year."""

    def blocks(self) -> list[str]:
        parts: list[str] = []
        for item, snippets in self.items:
            if item.get("entry_id"):
                parts.append(entry_block(item, snippets=snippets))
                continue
            parts.append(knowledge_block(item, "\n…\n".join(snippets), self.statuses.get(item["id"])))
        for item in self.related_items:
            if item.get("entry_id"):
                parts.append(
                    entry_block({**item, "content": "(related entry, summary only; search for it by title to read it)"})
                )
                continue
            parts.append(
                knowledge_block(item, f"(related, summary) {item.get('summary', '')}", self.statuses.get(item["id"]))
            )
        return parts + self.related_lines

    def text(self) -> str:
        if not self.items and not self.related_items:
            return f"{DATA_HEADER}\nNothing in the knowledge base matches."
        return "\n".join([DATA_HEADER, *self.blocks()])


def brand_filter(brand: str) -> dict[str, Any]:
    """One brand's items only (§16): its site profile and pages, never another tenant's."""
    return {"equals": {"key": "brand", "value": brand}}


def _usable(
    item: dict[str, Any] | None,
    scopes: list[Scope],
    market: str | None = None,
    brand: str | None = None,
    caller: Caller | None = None,
) -> bool:
    if item is None or item.get("status") != "ready" or item.get("scope") not in scopes:
        return False
    if not entry_visible(item, caller):
        return False
    if brand is not None and item.get("brand") != brand:
        return False
    # The item record is the truth for where an item holds (the owner may have just changed it).
    return market is None or item_holds_in(item.get("jurisdictions"), market)


async def _retrieve(
    kb: KnowledgeBase,
    query: str,
    n: int,
    scopes: list[Scope],
    market: str | None,
    brand: str | None = None,
    caller: Caller | None = None,
) -> list[Hit]:
    """With a market: Retrieve filtered to it. When the filter finds nothing or Bedrock refuses it (an index
    that can't filter on the attribute yet), a wider unfiltered Retrieve; ``search`` keeps only the items whose
    record holds in the market, so the answer is never mixed, only possibly shorter."""
    # The department, audience and entry filters are applied to the records only (``entry_visible``): the live
    # index returned nothing when they were sent to Retrieve (2026-11-11 deploy, 0/22), so Retrieve keeps the
    # proven scope filter and fetches more, and isolation stays exactly as strict.
    who = caller_filter(caller) if RETRIEVE_ENTRY_FILTERS else None
    if caller is not None and caller.department in all_departments():
        n = max(n, ENTRY_FETCH)
    parts = [
        *([market_filter(market)] if market else []),
        *([brand_filter(brand)] if brand else []),
        *([who] if who else []),
    ]
    if not parts:
        hits = await kb.retrieve(query, n, list(scopes))
        return hits or await _plain(kb, query, n)
    extra = parts[0] if len(parts) == 1 else {"andAll": parts}
    try:
        hits = await kb.retrieve(query, n, list(scopes), extra)
    except Exception as e:
        if type(e).__name__ not in ("ValidationException", "ClientError"):
            raise
        log("warn", "knowledge.filter_refused", market=market, brand=brand, error=type(e).__name__)
        # The record check in ``search`` still keeps other departments' entries out of the answer.
        hits = []
    if hits:
        return hits
    return await _plain(kb, query, n)


PLAIN_FETCH = 30


async def _plain(kb: KnowledgeBase, query: str, n: int) -> list[Hit]:
    """The fallback when a filtered Retrieve finds nothing: no filter at all, so the record check alone decides
    scope, market, brand and department. On 2026-11-11 the live index answered every filtered hybrid call with
    nothing and the plain call with the right documents (decision 221)."""
    return await kb.retrieve(query, max(n, PLAIN_FETCH), [])


async def _fetch(
    kb: KnowledgeBase,
    store: KnowledgeStore,
    query: str,
    max_results: int,
    scopes: list[Scope],
    market: str | None = None,
    brand: str | None = None,
    caller: Caller | None = None,
) -> _Cached:
    hits = await _retrieve(kb, query, min(30, max_results * 4), scopes, market, brand, caller)
    grouped: dict[str, list[Hit]] = {}
    for h in sorted(hits, key=lambda h: h.score, reverse=True):
        grouped.setdefault(h.item_id, []).append(h)
    ids = list(grouped)[: max_results * 2]
    expansion = await store.graph.expand(ids, list(scopes))
    return _Cached(groups=[(i, grouped[i]) for i in ids], expansion=expansion)


async def search(
    kb: KnowledgeBase,
    store: KnowledgeStore,
    query: str,
    max_results: int = 5,
    include_on_request: bool = False,
    cache: SearchCache | None = None,
    market: str | None = None,
    brand: str | None = None,
    caller: Caller | None = None,
) -> SearchResult:
    """``market``: only items that hold there (§15): the market, its parent regions and ``global``.
    ``brand``: only that brand's items (§16), its site profile and pages.
    ``caller``: who asks; department entries (§17) only reach their own department (None sees none)."""
    scopes = allowed_scopes(include_on_request)
    key = (query.strip(), include_on_request, max_results, market, brand, (caller or Caller()).key())
    cached = cache.get(key) if cache is not None else None
    if cached is None:
        cached = await _fetch(kb, store, query, max_results, scopes, market, brand, caller)
        if cache is not None:
            cache.put(key, cached)
    ex = cached.expansion
    candidates = [i for i, _ in ex.items[: MAX_RELATED_ITEMS * 4]]
    rel_items = [r["item"] for r in ex.rels]
    records = await store.get_items([*(i for i, _ in cached.groups), *candidates, *rel_items])
    out = SearchResult()
    for item_id, hs in cached.groups:
        item = records.get(item_id)
        if _usable(item, scopes, market, brand, caller):
            assert item is not None
            out.items.append((item, [h.text[:SNIPPET_CHARS] for h in hs[:SNIPPETS_PER_ITEM]]))
            if len(out.items) >= max_results:
                break
    hit_ids = {item["id"] for item, _ in out.items}
    for i in candidates:
        item = records.get(i)
        if i not in hit_ids and _usable(item, scopes, market, brand, caller) and item and item.get("summary"):
            out.related_items.append(item)
            if len(out.related_items) >= MAX_RELATED_ITEMS:
                break
    if hit_ids:
        for r in ex.rels:
            # A relationship is shown only when the item it came from may be shown now.
            if not _usable(records.get(r["item"]), scopes, market, brand, caller):
                continue
            line = f"related: {_attr(r['from'])} —{_attr(r['rel'])}→ {_attr(r['to'])} (item {_attr(r['item'])})"
            if line not in out.related_lines:
                out.related_lines.append(line)
            if len(out.related_lines) >= MAX_RELATED_LINES:
                break
    c = caller or Caller()
    entry_hits = [i for i in hit_ids if records.get(i, {}).get("entry_id")]
    if c.related and c.department and entry_hits:
        near = await store.graph.entry_neighbours(entry_hits, c.department)
        extra = await store.get_items([i for i in near if i not in hit_ids][: MAX_RELATED_ENTRIES * 3])
        added = 0
        for i in near:
            item = extra.get(i)
            if item and i not in hit_ids and _usable(item, scopes, market, brand, caller):
                out.related_items.append(item)
                added += 1
                if added >= MAX_RELATED_ENTRIES:
                    break
    return out


def _placed(r: SearchResult) -> list[dict[str, Any]]:
    return [i for i in [*(x for x, _ in r.items), *r.related_items] if i.get("year") is not None]


async def label_status(store: KnowledgeStore, results: list[SearchResult], year: int) -> None:
    """Marks each found item with a place and a year as in force, superseded by a newer one, not yet or no
    longer in force in ``year``; items in force come first. One Query of the item list, only when needed."""
    if not any(_placed(r) for r in results):
        return
    everything = await store.list_items()
    newer = superseded_map(everything, year)
    years = {str(i["id"]): int(i["year"]) for i in everything if i.get("year") is not None}
    for r in results:
        for item in _placed(r):
            r.statuses[item["id"]] = status_for(item, year, newer, years)
        r.items.sort(key=lambda x: r.statuses.get(x[0]["id"], "in force") != "in force")


MARKETS_HEADER = (
    "Searched once per market. Each <market> holds only what applies there: the country itself, the regions it "
    "belongs to and global items. Never carry one market's rules into another market's answer, and say which "
    "jurisdiction each rule comes from. Prefer items in force; an item superseded by a newer one is history "
    "unless the task names its period."
)


async def search_markets(
    kb: KnowledgeBase,
    store: KnowledgeStore,
    query: str,
    markets: list[str],
    year: int,
    max_results: int = 5,
    include_on_request: bool = False,
    cache: SearchCache | None = None,
    brand: str | None = None,
    caller: Caller | None = None,
) -> str:
    """One filtered search per market, returned as separate ``<market>`` sections (§15)."""
    results = [
        await search(
            kb, store, query, max_results, include_on_request, cache=cache, market=m, brand=brand, caller=caller
        )
        for m in markets
    ]
    await label_status(store, results, year)
    parts = [DATA_HEADER, MARKETS_HEADER]
    for m, r in zip(markets, results, strict=True):
        covers = ", ".join(market_codes(m))
        parts.append(f'<market code="{_attr(m)}" name="{_attr(label(m))}" covers="{_attr(covers)}" year="{year}">')
        body = r.blocks()
        parts += body if body else [f"Nothing stored for {_attr(label(m))} matches."]
        parts.append("</market>")
    return "\n".join(parts)


async def always_block(store: KnowledgeStore) -> str:
    """The ``always`` summaries for every role's prompt, inside the 8,000-token budget, oldest first."""
    inside, _ = await store.always_items()
    if not inside:
        return ""
    blocks = "\n".join(knowledge_block(i, str(i["summary"])) for i in inside)
    return f"<owner-knowledge>\n{DATA_HEADER}\n{blocks}\n</owner-knowledge>"
