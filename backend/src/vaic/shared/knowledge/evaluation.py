"""The retrieval evaluation (§17): realistic questions per department (``knowledge/seed/<dept>/_eval.yaml``), each
with the entries that should come back. A question is a hit when an expected entry is in the top ``k``.

``offline_eval`` ranks the indexed parts with BM25 (keywords only, no embeddings, no AWS), so the tests can keep
chunking and titles honest; ``live_eval`` asks the real knowledge base (hybrid search, the department's own
caller), which the deploy runs after seeding and prints.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .entries import Entry, SeedSet, index_parts, seed_root

_WORD = re.compile(r"[a-z0-9][a-z0-9+:.-]*[a-z0-9+]|[a-z0-9]")
_STOP = frozenset(
    re.findall(
        r"\w+",
        "a an and are as at be by can do does for from has have how i in is it its of on or our should that the "
        "their them this to we what when which who why will with you your",
    )
)


@dataclass
class EvalResult:
    department: str
    k: int
    hits: int = 0
    total: int = 0
    misses: list[dict[str, Any]] = field(default_factory=list)
    fallbacks: int = 0
    """Searches answered by the plain safety-net call instead of the filtered hybrid one (decision 242)."""

    @property
    def hit_rate(self) -> float:
        return self.hits / self.total if self.total else 0.0

    def as_json(self) -> dict[str, Any]:
        return {
            "department": self.department,
            "k": self.k,
            "hits": self.hits,
            "total": self.total,
            "hit_rate": round(self.hit_rate, 3),
            "fallbacks": self.fallbacks,
            "misses": self.misses,
        }


def load_eval(department: str, root: Path | None = None) -> tuple[int, list[dict[str, Any]]]:
    path = (root or seed_root()) / department / "_eval.yaml"
    if not path.is_file():
        return 5, []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    qs = [
        {"q": str(x["q"]), "expect": [e if e.count(".") == 2 else f"{department}.{e}" for e in x["expect"]]}
        for x in data.get("questions") or []
    ]
    return int(data.get("top_k") or 5), qs


def _tokens(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in _STOP]


def bm25_rank(question: str, entries: list[Entry], label: str, k1: float = 1.2, b: float = 0.75) -> list[str]:
    """Entry ids by their best-scoring part."""
    parts = [(e.id, _tokens(p)) for e in entries for p in index_parts(e, label)]
    n = len(parts)
    avg = sum(len(t) for _, t in parts) / max(n, 1)
    df: Counter[str] = Counter()
    for _, toks in parts:
        df.update(set(toks))
    q = _tokens(question)
    best: dict[str, float] = {}
    for eid, toks in parts:
        tf = Counter(toks)
        score = 0.0
        for w in q:
            if w in tf:
                idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
                score += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(toks) / avg))
        best[eid] = max(best.get(eid, 0.0), score)
    return [eid for eid, s in sorted(best.items(), key=lambda x: -x[1]) if s > 0]


def offline_eval(seeds: SeedSet, department: str, root: Path | None = None) -> EvalResult:
    k, questions = load_eval(department, root)
    entries = [e for e in seeds.entries.values() if e.department == department]
    label = seeds.taxonomies[department].label if department in seeds.taxonomies else department
    out = EvalResult(department, k)
    for x in questions:
        top = bm25_rank(x["q"], entries, label)[:k]
        out.total += 1
        if set(top) & set(x["expect"]):
            out.hits += 1
        else:
            out.misses.append({"q": x["q"], "expected": x["expect"], "got": top})
    return out


async def live_eval(kb: Any, store: Any, department: str, root: Path | None = None) -> EvalResult:
    """The real thing: ``search`` as that department's manager would call it (audience widened to all)."""
    from .search import PLAIN_FALLBACKS, Caller, search

    k, questions = load_eval(department, root)
    out = EvalResult(department, k)
    before = PLAIN_FALLBACKS[0]
    who = Caller(department=department, role="manager", audience="all", related=False)
    for x in questions:
        r = await search(kb, store, x["q"], max_results=k, caller=who)
        top = [str(i.get("entry_id")) for i, _ in r.items if i.get("entry_id")]
        out.total += 1
        if set(top) & set(x["expect"]):
            out.hits += 1
        else:
            # What the index itself returned (scope filter only), so a miss can be told apart from an empty index.
            raw = await kb.retrieve(x["q"], 10, ["always", "relevant"])
            miss: dict[str, Any] = {"q": x["q"], "expected": x["expect"], "got": top, "index": [h.item_id for h in raw]}
            if not out.misses:  # once: the index with no filter at all, and what metadata its hits carry
                miss["unfiltered"] = await _unfiltered(kb, x["q"])
            out.misses.append(miss)
    out.fallbacks = PLAIN_FALLBACKS[0] - before
    return out


async def _unfiltered(kb: Any, query: str) -> dict[str, Any]:
    """A Retrieve with no filter, for diagnosis only: how many hits, and the metadata keys and ids they carry."""
    import asyncio

    runtime = getattr(kb, "_runtime", None)
    if runtime is None:
        return {"skipped": "no Bedrock client"}
    try:
        r = await asyncio.to_thread(
            runtime.retrieve,
            knowledgeBaseId=kb.kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": 5}},
        )
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)[:300]}"}
    res = r.get("retrievalResults", [])
    return {
        "hits": len(res),
        "metadata_keys": [sorted((x.get("metadata") or {}).keys())[:20] for x in res[:3]],
        "item_ids": [(x.get("metadata") or {}).get("item_id") for x in res[:5]],
        "uris": [((x.get("location") or {}).get("s3Location") or {}).get("uri") for x in res[:5]],
    }


async def retrieve_probe(kb: Any, query: str, department: str) -> dict[str, Any]:
    """Diagnosis only (decision 236): the same question through Retrieve with each setting alone and combined, so
    the deploy log shows which one the live index answers with nothing: the search type, the filter, or a filter
    on a field the index maps itself (``scope``, ``item_id``: ``keyword``) versus one Bedrock mapped
    (``department``: ``text`` with a ``.keyword`` subfield). Hit counts or the error per variant; read-only."""
    import asyncio

    runtime = getattr(kb, "_runtime", None)
    if runtime is None:
        return {"skipped": "no Bedrock client"}

    async def call(search_type: str | None, flt: dict[str, Any] | None) -> Any:
        cfg: dict[str, Any] = {"numberOfResults": 5}
        if search_type:
            cfg["overrideSearchType"] = search_type
        if flt:
            cfg["filter"] = flt
        try:
            r = await asyncio.to_thread(
                runtime.retrieve,
                knowledgeBaseId=kb.kb_id,
                retrievalQuery={"text": query},
                retrievalConfiguration={"vectorSearchConfiguration": cfg},
            )
        except Exception as e:
            return f"{type(e).__name__}: {str(e)[:240]}"
        res = r.get("retrievalResults", [])
        meta = [x.get("metadata") or {} for x in res[:2]]
        return {"hits": len(res), "ids": [m.get("item_id") for m in meta], "scopes": [m.get("scope") for m in meta]}

    from .jurisdiction import with_scopes
    from .search import Caller, caller_filter

    who = Caller(department=department, role="manager", audience="all", related=False)
    plain = await call(None, None)
    first = plain["ids"][0] if isinstance(plain, dict) and plain["ids"] else "none"
    first_scope = plain["scopes"][0] if isinstance(plain, dict) and plain["scopes"] else "relevant"
    scope = {"in": {"key": "scope", "value": ["always", "relevant"]}}
    dept = {"equals": {"key": "department", "value": department}}
    item = {"equals": {"key": "item_id", "value": first}}
    out: dict[str, Any] = {"query": query, "plain": plain}
    for name, st, f in (
        ("hybrid", "HYBRID", None),
        ("semantic", "SEMANTIC", None),
        ("scope_in", None, scope),
        ("scope_equals", None, {"equals": {"key": "scope", "value": first_scope}}),
        ("item_id_equals", None, item),
        ("department_equals", None, dept),
        ("department_in", None, {"in": {"key": "department", "value": [department]}}),
        ("hybrid_department", "HYBRID", dept),
        ("semantic_scope_in", "SEMANTIC", scope),
        ("hybrid_scope_in", "HYBRID", scope),
        ("hybrid_search_scope", "HYBRID", with_scopes(["always", "relevant"], None)),
        ("hybrid_search_filter", "HYBRID", with_scopes(["always", "relevant"], caller_filter(who))),
    ):
        out[name] = await call(st, f)
    return out
