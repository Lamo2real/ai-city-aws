"""Department knowledge entries (docs/KNOWLEDGE.md §17): the seed files, the seeder's rules, department isolation in
retrieval, the owner's edits through the API service, the graph, and the retrieval evaluation. No AWS."""

from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any

import pytest

from knowledge_support import world
from test_api import ev, js, make
from vaic.lambdas.api import handle_http
from vaic.runtime.tools import TurnCtx, gate_tools, tools_for
from vaic.shared.knowledge.blobs import MemoryBlobs
from vaic.shared.knowledge.entries import (
    ENTRY_ID_RE,
    Entry,
    EntryError,
    SeedSet,
    canonical_department,
    entry_from_meta,
    entry_markdown,
    index_parts,
    load_seeds,
    load_taxonomy,
    mentioned_concepts,
    seed_root,
    split_front_matter,
)
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import load_eval, offline_eval
from vaic.shared.knowledge.graph import MemoryGraph
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit, ThrottlingException
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.registry import EntryRegistry
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import plan, refresh_status, run_seed
from vaic.shared.knowledge.store import KnowledgeStore
from vaic.shared.table import MemoryTable

SEEDS = load_seeds()
MODEL = "embed-model-1"


# ---------- the seed files ----------
def _of(department: str) -> list[Entry]:
    return [e for e in SEEDS.entries.values() if e.department == department]


def test_every_seed_file_validates_and_ids_are_unique() -> None:
    assert SEEDS.errors == []
    assert "marketing" in SEEDS.taxonomies
    assert len(SEEDS.entries) >= 120
    ids = list(SEEDS.entries)
    marketing = [i for i in ids if i.startswith("marketing.")]
    assert len(ids) == len(set(ids))
    assert all(ENTRY_ID_RE.fullmatch(i) for i in ids)
    # The file system can't hold two files at one path, so also check every file was read.
    files = [p for p in (seed_root() / "marketing").rglob("*.md") if not p.name.startswith("_")]
    assert len(files) == len(marketing)


def test_every_entry_is_atomic_sourced_and_free_of_gap_passages() -> None:
    tax = SEEDS.taxonomies["marketing"]
    for e in _of("marketing"):
        if e.document:  # a whole document kept unchanged (decision 222)
            continue
        words = len(e.body.split())
        assert 90 <= words <= 700, (e.id, words)
        assert "[GAP" not in e.body, e.id
        assert e.summary and e.title and e.domain in tax.domains
        assert e.sources or e.confidence == "inference", e.id
        if e.volatility == "fast-moving":
            assert e.review_by <= "2027-03-01", e.id
    domains = {e.domain for e in _of("marketing")}
    assert domains == set(tax.domains), set(tax.domains) - domains


def test_labels_map_onto_confidence_and_volatility() -> None:
    by = {e.id: e for e in SEEDS.entries.values()}
    assert by["marketing.meta-ads.attribution-changes-2026"].volatility == "fast-moving"
    assert by["marketing.strategy.positioning"].volatility == "evergreen"
    assert by["marketing.strategy.brand-and-activation-split"].confidence == "contested"
    assert {e.confidence for e in by.values()} >= {"established", "vendor", "contested", "inference"}


def test_a_seed_file_round_trips_with_the_same_hash() -> None:
    e = SEEDS.entries["marketing.seo.local-seo"]
    meta, body = split_front_matter(entry_markdown(e))
    again = entry_from_meta(meta, body, SEEDS.taxonomies["marketing"])
    assert again == e and again.content_hash() == e.content_hash()


def _meta(**over: Any) -> dict[str, Any]:
    e = SEEDS.entries["marketing.seo.local-seo"]
    meta, _ = split_front_matter(entry_markdown(e))
    return {**meta, **over}


@pytest.mark.parametrize(
    ("over", "words"),
    [
        ({"id": "Marketing.SEO.x"}, "department.domain.slug"),
        ({"id": "marketing.nope.local-seo", "domain": "nope"}, "unknown domain"),
        ({"domain": "geo"}, "domain must match"),
        ({"platforms": ["myspace"]}, "unknown platforms"),
        ({"objectives": ["fame"]}, "unknown objectives"),
        ({"type": "essay"}, "type must be one of"),
        ({"confidence": "sure"}, "confidence must be one of"),
        ({"review_by": "2020-01-01"}, "review_by must be after as_of"),
        ({"sources": ["not a link"]}, "sources must be web links"),
        ({"related": ["marketing.seo.local-seo"]}, "self reference"),
        ({"summary": ""}, "summary is required"),
    ],
)
def test_the_schema_refuses_bad_entries_in_plain_words(over: dict[str, Any], words: str) -> None:
    with pytest.raises(EntryError, match=words):
        entry_from_meta(_meta(**over), "Some text.", SEEDS.taxonomies["marketing"])


def test_load_seeds_reports_broken_files_and_dangling_links(tmp_path: Path) -> None:
    dept = tmp_path / "marketing"
    (dept / "seo").mkdir(parents=True)
    (dept / "_taxonomy.yaml").write_text((seed_root() / "marketing" / "_taxonomy.yaml").read_text())
    good = SEEDS.entries["marketing.seo.local-seo"]
    (dept / "seo" / "local-seo.md").write_text(entry_markdown(good))
    (dept / "seo" / "wrong-place.md").write_text(entry_markdown(good))
    (dept / "seo" / "broken.md").write_text("no front matter")
    s = load_seeds(tmp_path)
    assert list(s.entries) == ["marketing.seo.local-seo"]
    text = "\n".join(s.errors)
    assert "must be at marketing/seo/local-seo.md" in text
    assert "front matter" in text
    assert "points to marketing.seo.technical-and-content-basics, which does not exist" in text


def test_a_new_department_is_just_a_folder(tmp_path: Path) -> None:
    (tmp_path / "sales" / "pipeline").mkdir(parents=True)
    (tmp_path / "sales" / "_taxonomy.yaml").write_text(
        "department: sales\nlabel: Sales\ndomains:\n  - {id: pipeline, label: Pipeline}\nplatforms: []\n"
        "objectives: []\nconcepts:\n  - {id: win-rate, label: Win rate, kind: metric, aliases: [win rate]}\n"
    )
    e = Entry(
        id="sales.pipeline.qualify", department="sales", domain="pipeline", title="Qualify", summary="Qualify.",
        type="checklist", audience="both", confidence="established", volatility="evergreen", as_of="2026-11-11",
        review_by="2028-11-11", body="## Qualify\n\nTrack the win rate.",
    )  # fmt: skip
    (tmp_path / "sales" / "pipeline" / "qualify.md").write_text(entry_markdown(e))
    s = load_seeds(tmp_path)
    assert s.errors == [] and list(s.taxonomies) == ["sales"] and list(s.entries) == ["sales.pipeline.qualify"]
    assert mentioned_concepts(s.entries["sales.pipeline.qualify"], s.taxonomies["sales"]) == ["win-rate"]


def test_every_indexed_part_starts_with_the_title_and_stays_small() -> None:
    for e in SEEDS.entries.values():
        parts = index_parts(e, "Marketing")
        assert parts == index_parts(e, "Marketing")  # deterministic
        assert parts[0].startswith(f"# {e.title}") and e.summary in parts[0] and e.review_by in parts[0]
        for p in parts[1:]:
            assert p.startswith(f"{e.title} › "), (e.id, p[:80])
            # Tables are kept whole; four sales tables are longer (each row repeats its source link, decision 224).
            table = p.split("\n\n", 1)[1].startswith("|")
            assert len(p.split()) <= (450 if table else 260), (e.id, len(p.split()))


def test_concepts_come_only_from_the_taxonomy() -> None:
    tax = SEEDS.taxonomies["marketing"]
    pmax = mentioned_concepts(SEEDS.entries["marketing.google-ads.performance-max-and-feeds"], tax)
    assert "performance-max" in pmax and set(pmax) <= tax.concept_ids()
    assert canonical_department("Marketing") == "marketing"
    assert canonical_department("IT Infrastructure") == "infrastructure"


# ---------- the seeder ----------
@dataclasses.dataclass
class Rig:
    table: MemoryTable
    registry: EntryRegistry
    kb: FakeKnowledgeBase
    graph: MemoryGraph
    blobs: MemoryBlobs
    projector: EntryProjector
    store: KnowledgeStore


async def _no_sleep(_s: float) -> None:
    return None


def rig() -> Rig:
    table, kb, graph, blobs = MemoryTable(), FakeKnowledgeBase(), MemoryGraph(), MemoryBlobs()
    return Rig(
        table, EntryRegistry(table), kb, graph, blobs, EntryProjector(blobs, kb, graph, sleep=_no_sleep),
        KnowledgeStore(table, graph),
    )  # fmt: skip


def small(*ids: str, changes: dict[str, dict[str, Any]] | None = None) -> SeedSet:
    """A seed set of a few real entries (optionally changed), with their links trimmed to the set."""
    out = SeedSet(taxonomies=dict(SEEDS.taxonomies))
    for i in ids:
        e = SEEDS.entries[i]
        e = dataclasses.replace(
            e,
            related=tuple(r for r in e.related if r in ids),
            requires=tuple(r for r in e.requires if r in ids),
            **(changes or {}).get(i, {}),
        )
        out.entries[i] = e
    return out


A, B, C = (
    "marketing.seo.local-seo",
    "marketing.seo.technical-and-content-basics",
    "marketing.geo.crawler-access-and-llms-txt",
)


async def test_seeding_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok and first.counts() == {"create": len(SEEDS.entries)}
    docs, calls, edges = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges


async def test_a_dry_run_writes_nothing_and_a_broken_seed_set_writes_nothing() -> None:
    r = rig()
    dry = await run_seed(small(A, B), r.registry, r.projector, MODEL, dry_run=True)
    assert dry.ok and dry.counts() == {"create": 2}
    assert await r.registry.in_department("marketing") == [] and r.kb.docs == {}
    broken = small(A)
    broken.errors.append("marketing/seo/x.md: title is required")
    bad = await run_seed(broken, r.registry, r.projector, MODEL)
    assert not bad.ok and bad.errors == ["marketing/seo/x.md: title is required"]
    assert await r.registry.in_department("marketing") == []


async def test_an_untouched_default_follows_the_new_seed() -> None:
    r = rig()
    await run_seed(small(A), r.registry, r.projector, MODEL)
    rep = await run_seed(small(A, changes={A: {"summary": "A better summary."}}), r.registry, r.projector, MODEL)
    assert rep.counts() == {"update": 1}
    rec = await r.registry.get(A)
    assert rec and rec["summary"] == "A better summary." and rec["sync"] == "done" and not rec["user_modified"]
    assert any("A better summary." in v for v in _texts(r))


def _texts(r: Rig) -> list[str]:
    return [b.decode() for k, (b, _) in r.blobs.objects.items() if k.endswith(".md")]


async def test_an_edited_default_is_kept_and_the_newer_default_is_offered() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(A))
    await run_seed(small(A), r.registry, r.projector, MODEL)
    await s.update(A, {"summary": "The owner's own words."})
    rep = await run_seed(small(A, changes={A: {"summary": "Shipped later."}}), r.registry, r.projector, MODEL)
    assert rep.counts() == {"newer_default": 1}
    rec = await r.registry.get(A)
    assert rec and rec["summary"] == "The owner's own words." and rec["user_modified"]
    assert rec["newer_default"]["summary"] == "Shipped later."
    again = await run_seed(small(A, changes={A: {"summary": "Shipped later."}}), r.registry, r.projector, MODEL)
    assert again.counts() == {"keep_modified": 1}


async def test_a_deleted_default_stays_deleted_across_deploys() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(A, B))
    await run_seed(small(A, B), r.registry, r.projector, MODEL)
    await s.delete(A)
    assert not [u for u in r.kb.docs if f"/{A}/" in u] and ("KnowledgeEntry", f"kn-{A}") not in r.graph.vertices
    for changes in (None, {A: {"title": "A newer title"}}):
        rep = await run_seed(small(A, B, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        rec = await r.registry.get(A)
        assert rec and rec["deleted"] and rec["status"] == "deleted"
        assert not [u for u in r.kb.docs if f"/{A}/" in u]
    assert (await r.registry.get(A) or {})["newer_default"]["title"] == "A newer title"
    reset = await s.reset(A)
    assert not reset["deleted"] and reset["title"] == SEEDS.entries[A].title and reset["sync"] == "done"


async def test_the_owners_own_entries_are_never_touched() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(A))
    await run_seed(small(A), r.registry, r.projector, MODEL)
    mine = await s.create(
        {"department": "marketing", "domain": "seo", "title": "Our SEO rules", "summary": "Ours.", "content": "Text."}
    )
    assert mine["origin"] == "user" and mine["entry_id"] == "marketing.seo.our-seo-rules"
    before = await r.registry.get("marketing.seo.our-seo-rules")
    rep = await run_seed(small(A), r.registry, r.projector, MODEL)
    assert rep.changed() == []
    assert await r.registry.get("marketing.seo.our-seo-rules") == before
    # A later default with the same id as the owner's entry does not overwrite it.
    clash = small(A)
    clash.entries["marketing.seo.our-seo-rules"] = dataclasses.replace(
        SEEDS.entries[A], id="marketing.seo.our-seo-rules"
    )
    rep = await run_seed(clash, r.registry, r.projector, MODEL)
    assert [c.action for c in rep.changes if c.entry_id == "marketing.seo.our-seo-rules"] == ["keep_user"]
    assert (await r.registry.get("marketing.seo.our-seo-rules") or {})["summary"] == "Ours."


async def test_a_removed_seed_retires_its_entry_unless_the_owner_edited_it() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(A, B, C))
    await run_seed(small(A, B, C), r.registry, r.projector, MODEL)
    await s.update(B, {"title": "Our technical checklist"})
    rep = await run_seed(small(A), r.registry, r.projector, MODEL)
    acts = {c.entry_id: c.action for c in rep.changed()}
    assert acts[B] == "mark_removed" and acts[C] == "retire"  # (A changed too: its links to B and C were trimmed)
    retired = await r.registry.get(C)
    assert retired and retired["retired"] and not [u for u in r.kb.docs if f"/{C}/" in u]
    kept = await r.registry.get(B)
    assert kept and kept["seed_removed"] and not kept.get("retired") and [u for u in r.kb.docs if f"/{B}/" in u]
    assert (await run_seed(small(A), r.registry, r.projector, MODEL)).changed() == []


async def test_a_new_embedding_model_re_embeds_everything() -> None:
    r = rig()
    await run_seed(small(A, B), r.registry, r.projector, MODEL)
    calls = len(r.kb.ingest_calls)
    rep = await run_seed(small(A, B), r.registry, r.projector, "embed-model-2")
    assert rep.counts() == {"reembed": 2} and len(r.kb.ingest_calls) > calls
    assert (await r.registry.get(A) or {})["embed_model"] == "embed-model-2"


async def test_a_failed_projection_is_recorded_and_repaired_next_time() -> None:
    r = rig()
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    rep = await run_seed(small(A), r.registry, r.projector, MODEL)
    assert not rep.ok and "indexing failed" in rep.errors[0]
    rec = await r.registry.get(A)
    assert rec and rec["sync"] == "failed" and rec["status"] == "failed"
    r.kb.throttle = 2  # busy twice, then fine: the back-off rides it out
    rep = await run_seed(small(A), r.registry, r.projector, MODEL)
    assert rep.ok and rep.counts() == {"resync": 1}
    assert (await r.registry.get(A) or {})["sync"] == "done"


async def test_editing_moves_parts_and_drops_the_ones_that_are_gone() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(B))
    await run_seed(small(B), r.registry, r.projector, MODEL)
    before = sorted(u for u in r.kb.docs if f"/{B}/" in u)
    await s.update(B, {"content": "## One section\n\nShort now."})
    after = sorted(u for u in r.kb.docs if f"/{B}/" in u)
    assert len(after) == 2 and len(before) > 2 and set(after) < set(before)
    assert not [k for k in r.blobs.objects if k.startswith(f"normalized/builtin/marketing/{B}/2.md")]
    assert [h["action"] for h in await r.registry.history(B)][:1] == ["update"]


async def test_indexing_status_moves_to_ready() -> None:
    r = rig()
    await run_seed(small(A, B), r.registry, r.projector, MODEL)
    assert (await refresh_status(r.registry, r.projector, ["marketing"]))["processing"] == 2
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    assert await refresh_status(r.registry, r.projector, ["marketing"]) == {
        "ready": 2, "processing": 0, "failed": 0, "deleted": 0, "retired": 0, "total": 2,
    }  # fmt: skip


def test_plan_repairs_a_lagging_edit_of_any_origin() -> None:
    recs = {
        A: {"entry_id": A, "origin": "system", "user_modified": True, "seed_hash": small(A).entries[A].content_hash(),
            "sync": "failed", "department": "marketing"},
        "marketing.seo.mine": {"entry_id": "marketing.seo.mine", "origin": "user", "sync": "pending",
                               "department": "marketing"},
    }  # fmt: skip
    acts = [(c.action, c.entry_id) for c in plan(small(A), recs, MODEL)]
    assert acts == [("keep_modified", A), ("repair", A), ("repair", "marketing.seo.mine")]


# ---------- the graph ----------
async def test_the_graph_has_the_taxonomy_and_the_entries_with_departments_on_every_vertex() -> None:
    r = rig()
    await run_seed(SEEDS, r.registry, r.projector, MODEL)
    labels = {label for label, _ in r.graph.vertices}
    assert labels == {"Department", "Domain", "Platform", "Objective", "Concept", "KnowledgeEntry"}
    assert {v["department"] for v in r.graph.vertices.values()} == {"marketing", "sales"}
    for (label, vid), v in r.graph.vertices.items():
        if label == "KnowledgeEntry":
            assert vid.removeprefix("kn-").split(".")[0] == v["department"]
        else:
            assert vid.split("/")[0] == v["department"], vid
    kinds = {e[0] for e in r.graph.edges}
    assert kinds >= {
        "PART_OF",
        "IN_DOMAIN",
        "APPLIES_TO",
        "SERVES",
        "MENTIONS",
        "RELATED_TO",
        "REQUIRES",
        "MEASURED_BY",
    }
    pmax = "kn-marketing.google-ads.performance-max-and-feeds"
    assert ("IN_DOMAIN", pmax, "marketing/domain/google-ads") in r.graph.edges
    assert ("REQUIRES", pmax, "kn-marketing.google-ads.conversion-tracking-and-consent") in r.graph.edges
    assert ("MEASURED_BY", "marketing/concept/performance-max", "marketing/concept/roas") in r.graph.edges
    near = await r.graph.entry_neighbours([pmax], "marketing")
    assert "kn-marketing.google-ads.conversion-tracking-and-consent" in near
    assert await r.graph.entry_neighbours([pmax], "sales") == []


# ---------- department isolation in retrieval ----------
class IgnoresFilters(FakeKnowledgeBase):
    """An index that applies no filter at all: the record check alone must keep other departments out."""

    async def retrieve(self, query: str, max_results: int, scopes: list[str], extra: Any = None) -> list[Hit]:
        self.calls.append({"query": query, "extra": extra})
        return self.hits[:max_results]


async def _seeded_search_rig(kb: FakeKnowledgeBase) -> Rig:
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(A, B), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing"])
    kb.hits = [
        Hit(f"kn-{A}", "local pack", 0.9, "relevant", attributes={"department": "marketing", "audience": "worker"}),
        Hit(
            f"kn-{B}", "core web vitals", 0.8, "relevant", attributes={"department": "marketing", "audience": "worker"}
        ),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_only_the_marketing_department_retrieves_marketing_entries(kb_class: type[FakeKnowledgeBase]) -> None:
    r = await _seeded_search_rig(kb_class())
    mine = await search(r.kb, r.store, "local seo", caller=Caller(department="marketing", role="worker"))
    assert [i["entry_id"] for i, _ in mine.items] == [A, B]
    text = mine.text()
    assert f'entry="{A}"' in text and 'as_of="2026-11-11"' in text and "Sources:" in text
    for other in (Caller(department="sales", role="worker"), Caller(role="vaic"), None):
        res = await search(r.kb, r.store, "local seo", caller=other)
        assert res.items == [] and res.related_items == []


async def test_the_other_role_is_kept_out_by_the_record_check() -> None:
    r = await _seeded_search_rig(FakeKnowledgeBase())
    await search(r.kb, r.store, "q", caller=Caller(department="marketing", role="manager"))
    assert r.kb.calls[0]["max_results"] == 30  # room for the department's entries after others are dropped
    # A manager does not get worker-only entries unless they widen the audience.
    res = await search(r.kb, r.store, "q", caller=Caller(department="marketing", role="manager"))
    assert res.items == []
    res = await search(r.kb, r.store, "q", caller=Caller(department="marketing", role="manager", audience="all"))
    assert len(res.items) == 2


def test_the_caller_filter_is_still_built_for_when_the_index_applies_it() -> None:
    from vaic.shared.knowledge.search import caller_filter

    f = json.dumps(caller_filter(Caller(department="marketing", role="manager")))
    assert '"notIn": {"key": "department"' in f and '"sales"' in f
    assert '{"notIn": {"key": "audience", "value": ["worker"]}}' in f


async def test_an_old_fast_moving_entry_is_marked_for_verification() -> None:
    from vaic.shared.knowledge.search import entry_block

    rec = {"entry_id": A, "title": "T", "volatility": "fast-moving", "review_by": "2027-02-11", "content": "x"}
    from datetime import date

    assert "needs_verification" in entry_block(rec, date(2027, 3, 1))
    assert "needs_verification" not in entry_block(rec, date(2026, 12, 1))
    assert "needs_verification" not in entry_block({**rec, "volatility": "evergreen"}, date(2030, 1, 1))


def _ctx(role: str, department: str | None) -> TurnCtx:
    return TurnCtx(agent_id=f"{role}-1", role=role, department=department, ticket_id="t1", task_id="t0")


async def test_the_tool_takes_the_department_from_the_caller_never_from_the_arguments() -> None:
    from test_knowledge_api_tools import city

    w = world()
    w.kb = FakeKnowledgeBase()
    w.store = KnowledgeStore(w.table, w.graph, w.clock)
    proj = EntryProjector(w.blobs, w.kb, w.graph, sleep=_no_sleep)
    await run_seed(small(A), EntryRegistry(w.table), proj, MODEL)
    for u in w.kb.status:
        w.kb.status[u] = "INDEXED"
    await refresh_status(EntryRegistry(w.table), proj, ["marketing"])
    attrs = {"department": "marketing", "audience": "worker", "domain": "seo"}
    w.kb.hits = [Hit(f"kn-{A}", "local", 0.9, "relevant", attributes=attrs)]
    d = city(w)
    for role, dept, sees in (("worker", "Marketing", True), ("worker", "Sales", False), ("orchestrator", None, False)):
        c = _ctx(role, dept)
        t = next(x for x in gate_tools(d, c, tools_for(d, c)) if x.name == "search_knowledge")
        out = await t.handler({"query": "local seo", "domain": "seo"})
        assert (f'entry="{A}"' in out) == sees, (role, dept)


# ---------- the owner's API ----------
async def test_entry_routes_list_read_edit_reset_and_delete() -> None:
    import vaic.lambdas.api as api_mod

    w = world()
    reg, proj = EntryRegistry(w.table), EntryProjector(w.blobs, w.kb, w.graph, sleep=_no_sleep)
    await run_seed(small(A, B), reg, proj, MODEL)
    api_mod._entry_service = EntryService(reg, proj, seeds=lambda: small(A, B))
    d = make(knowledge=w.service)
    try:
        listed = js(await handle_http(ev("GET", "/knowledge/entries?domain=seo"), d))
        assert [e["entry_id"] for e in listed["entries"]] == [A, B] or [e["entry_id"] for e in listed["entries"]] == [
            B,
            A,
        ]
        assert "content" not in listed["entries"][0] and listed["taxonomies"]["marketing"]["label"] == "Marketing"
        one = js(await handle_http(ev("GET", f"/knowledge/entries/{A}"), d))
        assert one["entry"]["content"].startswith("**When to use this:**")
        bad = await handle_http(ev("PUT", f"/knowledge/entries/{A}", {"type": "essay"}), d)
        assert bad["statusCode"] == 400 and "type must be one of" in js(bad)["error"]
        ok = js(await handle_http(ev("PUT", f"/knowledge/entries/{A}", {"title": "Ours"}), d))
        assert ok["entry"]["user_modified"] and ok["entry"]["title"] == "Ours"
        reset = js(await handle_http(ev("POST", f"/knowledge/entries/{A}/reset"), d))
        assert reset["entry"]["title"] == SEEDS.entries[A].title and not reset["entry"]["user_modified"]
        gone = js(await handle_http(ev("DELETE", f"/knowledge/entries/{B}"), d))
        assert gone["entry"]["deleted"]
        assert (await handle_http(ev("GET", "/knowledge/entries/marketing.seo.nope"), d))["statusCode"] == 404
        hist = js(await handle_http(ev("GET", f"/knowledge/entries/{A}"), d))["history"]
        assert [h["action"] for h in hist][:3] == ["reset", "update", "seed.create"]
    finally:
        api_mod._entry_service = None


# ---------- the retrieval evaluation ----------
def test_the_offline_retrieval_evaluation_finds_the_expected_entries() -> None:
    k, questions = load_eval("marketing")
    assert k == 5 and len(questions) >= 20
    assert all(i in SEEDS.entries for q in questions for i in q["expect"])
    r = offline_eval(SEEDS, "marketing")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses


def test_the_taxonomy_loader_refuses_unknown_measures(tmp_path: Path) -> None:
    (tmp_path / "x").mkdir()
    p = tmp_path / "x" / "_taxonomy.yaml"
    p.write_text("department: x\ndomains: []\nconcepts:\n  - {id: a, aliases: [a], measured_by: [b]}\n")
    with pytest.raises(EntryError, match="unknown concept b"):
        load_taxonomy(p)


async def test_ingest_retries_while_bedrock_throttles() -> None:
    r = rig()
    r.kb.throttle = 3
    docs = await r.projector.write_parts(SEEDS.entries[A], "system", "Marketing")
    await r.projector.ingest(docs)
    assert set(r.kb.docs) == {u for u, _ in docs}
    r.kb.throttle = 99
    with pytest.raises(ThrottlingException):
        await r.projector.ingest(docs)


# ---------- the house-style document (decision 222) ----------
PLAYBOOK = "marketing.house-style.hormozi-playbook"
PLAYBOOK_SHA256 = "668e6d6cec506db8d882eaa84bfab41d895b5e95e080597ee9f5e914434ffb0e"


def test_the_house_style_playbook_is_stored_unchanged_and_seeded_as_one_document() -> None:
    import hashlib

    path = seed_root() / "marketing" / "marketing-hormozi-playbook.md"
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PLAYBOOK_SHA256  # byte for byte what the owner gave
    e = SEEDS.entries[PLAYBOOK]
    assert e.document == "marketing-hormozi-playbook.md" and e.body == raw.decode().strip()
    assert e.title == "Marketing: House style (Hormozi playbook)"
    assert e.confidence == "house-style" and e.type == "house-style" and e.domain == "house-style"
    assert len(e.sources) > 20


def test_the_playbooks_section_numbers_point_to_the_entries_that_hold_them() -> None:
    e = SEEDS.entries[PLAYBOOK]
    refs = dict(e.cross_refs)
    assert set(refs) == {"1", "2", "3", "4", "10", "13", "17", "19", "20"}
    assert all(r in SEEDS.entries for ids in refs.values() for r in ids)
    assert "marketing.compliance.sweden-misleading-claims-and-prices" in refs["19"]
    assert all(r.split(".")[1] == "market-sweden" for r in refs["20"])
    assert "section 19 → " in index_parts(e, "Marketing")[0]


async def test_a_long_document_comes_back_as_its_matching_passages_with_cross_references() -> None:
    from vaic.shared.knowledge.search import entry_block

    rec = {**SEEDS.entries[PLAYBOOK].fields(), "title": "T"}
    out = entry_block(rec, snippets=["the value equation passage"])
    assert "the value equation passage" in out and "Status of this section" not in out
    assert "- section 19: marketing.compliance." in out


def test_marketing_managers_and_workers_are_told_to_apply_the_house_style_within_its_limits() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    for text in (department_template("Marketing"), department_worker_rules("Marketing")):
        assert "House style (Hormozi playbook)" in text
        assert "Compliance entries" in text and "override" in text
        assert "never use his name, likeness or catchphrases" in text
        assert "brand's own voice" in text
    assert "budget split" in department_template("Marketing")
    assert department_worker_rules("Finance") == "" and department_worker_rules("") == ""


async def test_the_playbook_survives_a_redeploy_after_the_owner_edits_it() -> None:
    r = rig()
    seeds = small(PLAYBOOK)
    s = EntryService(r.registry, r.projector, seeds=lambda: seeds)
    assert (await run_seed(seeds, r.registry, r.projector, MODEL)).counts() == {"create": 1}
    await s.update(PLAYBOOK, {"summary": "Our own summary."})
    assert (await run_seed(seeds, r.registry, r.projector, MODEL)).changed() == []
    assert (await r.registry.get(PLAYBOOK) or {})["summary"] == "Our own summary."
