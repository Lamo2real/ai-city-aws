"""The shared cross-department documents (decision 238): one document per section of the cross-department handoffs
research, seeded like every department's, but in the ``shared`` scope that every department's managers and workers
retrieve beside their own (docs/KNOWLEDGE.md section 17). Adding it must not loosen any department's own isolation.
No AWS."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entries import SHARED, all_departments, index_parts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import bm25_rank, load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, caller_filter, entry_visible, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "cross-department-handoffs.md"
DOCS = {i: e for i, e in SEEDS.entries.items() if e.department == SHARED}
ABOUT = "shared.overview.about-this-knowledge-base"
MAP = "shared.responsibilities.responsibility-map"
CATALOGUE = "shared.handoffs.handoff-catalogue"
ROUTING = "shared.routing.routing-rule-and-message-template"
GUARDRAILS = "shared.guardrails.company-wide-guardrails"
LAW = "shared.compliance.sweden-and-eu"
GAPS = "shared.gaps.consolidated-gaps"
MKT = "marketing.seo.local-seo"
SALES = "sales.house-style.closer-framework"
INFRA = "infrastructure.reliability.backup-and-disaster-recovery"


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "a03089ed90dea8c781110896dce1fb5e79d757012acffb9cbd5bb010e3b15beb"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 15_708 and re.findall(r"(?m)^## .*", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 11)]
    assert len(DOCS) == 11  # ten sections plus "About this knowledge base"
    for e in DOCS.values():
        assert e.title.startswith("Shared: ") and e.audience == "both"
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source line
        for piece in re.split(r"\n\n(?=## (?:How to read|Conclusion))", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading, labelled paragraph and table row lands in the documents exactly as often as in the source.
    for line in src.splitlines():
        if line.startswith(("# ", "## ", "### ", "[", "| ")):
            assert sum(e.body.count(line) for e in DOCS.values()) == src.count(line), line[:80]
    assert "## How to read and split this document" in DOCS[ABOUT].body
    assert "## 10. Consolidated gaps" in DOCS[GAPS].body and "## Conclusion" in DOCS[GAPS].body
    assert "### 7.2 Proposed handoff message template (editable proposal)" in DOCS[ROUTING].body


def test_types_and_the_guardrail_and_law_documents_are_filterable() -> None:
    assert {i for i, e in DOCS.items() if e.type == "policy"} == {GUARDRAILS, LAW}
    assert {i for i, e in DOCS.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert not [e for e in DOCS.values() if "house-style" in (e.type, e.confidence, e.domain)]
    assert all(e.sources for e in DOCS.values() if e.domain not in ("overview", "gaps"))
    assert dict(DOCS[ROUTING].cross_refs) == {"8": (GUARDRAILS,)}
    assert f"section 8 → {GUARDRAILS}" in index_parts(DOCS[ROUTING], "Shared")[0]


# ---------- seeding ----------
async def test_seeding_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/shared/" in u]) > len(DOCS)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(ROUTING) or {}
    assert rec["department"] == SHARED and rec["builtin"] and rec["origin"] == "system"
    assert ("Department", SHARED) in r.graph.vertices


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(CATALOGUE))
    await run_seed(small(CATALOGUE), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{CATALOGUE}/" in u}
    kid = f"kn-{CATALOGUE}"
    gone = {"shared/concept/dpia", "shared/concept/incident-commander"}  # in the body only, not the summary
    assert ("MENTIONS", kid, "shared/concept/deal-desk") in r.graph.edges
    assert gone <= {e[2] for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    await s.update(CATALOGUE, {"content": "## Short version\n\nEvery handoff names its artefact and its owner."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{CATALOGUE}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{CATALOGUE}/" in k and "/v2/" not in k]
    mentions = {e[2] for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert "shared/concept/deal-desk" in mentions  # the summary still names the deal desk
    assert not gone & mentions
    rec = await r.registry.get(CATALOGUE) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_shared_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(ROUTING, GAPS))
    await run_seed(small(ROUTING, GAPS), r.registry, r.projector, MODEL)
    await s.update(ROUTING, {"summary": "The owner's own routing rule."})
    await s.delete(GAPS)
    changed = {ROUTING: {"title": "Shared: newer routing"}, GAPS: {"title": "Shared: newer gaps"}}
    for changes in (None, changed):
        rep = await run_seed(small(ROUTING, GAPS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        routing, gaps = await r.registry.get(ROUTING) or {}, await r.registry.get(GAPS) or {}
        assert routing["summary"] == "The owner's own routing rule." and routing["user_modified"]
        assert gaps["deleted"] and not [u for u in r.kb.docs if f"/{GAPS}/" in u]
    assert (await r.registry.get(ROUTING) or {})["newer_default"]["title"] == "Shared: newer routing"
    reset = await s.reset(GAPS)
    assert not reset["deleted"] and reset["sync"] == "done"


# ---------- scope ----------
async def _with_shared(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SALES, INFRA, ROUTING, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "infrastructure", SHARED])
    kb.hits = [
        Hit(f"kn-{ROUTING}", "manager-to-manager", 0.95, "relevant", attributes={"department": SHARED}),
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{SALES}", "clarify why they are there", 0.85, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{INFRA}", "vault lock", 0.8, "relevant", attributes={"department": "infrastructure"}),
        Hit(f"kn-{GUARDRAILS}", "pay, sign, publish", 0.7, "relevant", attributes={"department": SHARED}),
    ]
    return r


OWN = {"marketing": [MKT], "sales": [SALES], "infrastructure": [INFRA]}


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_every_department_retrieves_the_shared_documents_and_still_only_its_own(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _with_shared(kb_class())
    # Every preset department, every seeded one and one the owner builds on demand.
    for dept in [*all_departments(), "harbour-patrol"]:
        for role in ("manager", "worker"):
            who = Caller(department=dept, role=role, audience="all", related=False)
            got = [i["entry_id"] for i, _ in (await search(r.kb, r.store, "q", max_results=10, caller=who)).items]
            assert got == [ROUTING, *OWN.get(dept, []), GUARDRAILS], (dept, role)
    # VAIC, the Orchestrator and the executives have no department: no department knowledge, shared included.
    for nobody in (Caller(role="vaic"), Caller(role="orchestrator"), Caller(role="executive"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


def test_adding_shared_loosened_no_department_s_own_isolation() -> None:
    assert SHARED not in all_departments()
    entry = {"entry_id": "x.y.z", "audience": "both"}
    for d in all_departments():
        for other in all_departments():
            assert entry_visible({**entry, "department": other}, Caller(department=d, role="worker")) == (d == other)
        assert entry_visible({**entry, "department": SHARED}, Caller(department=d, role="worker"))
    assert not entry_visible({**entry, "department": SHARED}, Caller(role="vaic"))
    assert not entry_visible({**entry, "department": SHARED}, None)
    # Shared follows the caller's other filters like any entry: audience, domain and type still apply.
    manager = Caller(department="sales", role="manager")
    assert not entry_visible({**entry, "department": SHARED, "audience": "worker"}, manager)
    assert not entry_visible(
        {**entry, "department": SHARED, "domain": "routing"}, Caller("sales", "worker", domain="x")
    )
    # The index filter (when turned on) keeps every other department out and never filters shared out.
    f = json.dumps(caller_filter(Caller(department="sales", role="manager")))
    assert '"marketing"' in f and '"finance"' in f and '"sales"' not in f and '"shared"' not in f


async def test_a_shared_hit_brings_its_shared_neighbours_and_no_other_department_s() -> None:
    r = rig()
    await run_seed(small(ROUTING, GUARDRAILS, MAP, MKT), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", SHARED])
    r.kb.hits = [Hit(f"kn-{ROUTING}", "template", 0.9, "relevant", attributes={"department": SHARED})]
    res = await search(r.kb, r.store, "handoff", caller=Caller(department="sales", role="worker"))
    assert [i["entry_id"] for i, _ in res.items] == [ROUTING]
    assert {i["entry_id"] for i in res.related_items} == {MAP, GUARDRAILS}


# ---------- retrieval ----------
def test_the_shared_retrieval_evaluation() -> None:
    k, questions = load_eval(SHARED)
    assert k == 5 and len(questions) >= 15
    assert all(q["expect"] and all(i in DOCS for i in q["expect"]) for q in questions)
    r = offline_eval(SEEDS, SHARED)
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses


@pytest.mark.parametrize("dept", [d for d in SEEDS.taxonomies if d != SHARED])
def test_the_handoff_questions_still_find_the_shared_documents_beside_a_department_s_own(dept: str) -> None:
    """What a department's agent searches: its own documents and the shared ones, ranked together."""
    k, questions = load_eval(SHARED)
    pool = [e for e in SEEDS.entries.values() if e.department in (dept, SHARED)]
    hits = sum(bool(set(bm25_rank(q["q"], pool, "x")[:k]) & set(q["expect"])) for q in questions)
    assert hits / len(questions) >= 0.9, (dept, hits)


# ---------- prompts ----------
def test_every_department_s_managers_and_workers_carry_the_shared_handoff_rules() -> None:
    from vaic.runtime.prompts import agents_dir, department_template, department_worker_rules
    from vaic.shared.presets import presets

    names = [str(p["name"]) for p in presets()]
    assert len(names) >= 12
    for name in [*names, "Knitting circle"]:  # every preset and a department the owner builds on demand
        manager, worker = department_template(name), department_worker_rules(name)
        for text in (manager, worker):
            assert "search_knowledge" in text and "Shared: Responsibility map" in text
            assert "manager-to-manager" in text and "accepted" in text and "twelve fields" in text
            assert "approval class" in text and "disagree" in text and "don't choose silently" in text
        assert "`file_handoff`" in manager and "Rejected (<reason code>)" in manager and "decision owner" in manager
        assert "Decision rights" in manager and "section 8" in manager and "never add a hold" in manager
        assert "never to that department's workers" in worker
    # Each department's own playbook and worker rules stay as they were, first and unchanged.
    d = agents_dir() / "departments"
    for f in d.glob("*.md"):
        key = f.name.removesuffix(".workers.md").removesuffix(".md")
        if f.name.endswith(".workers.md"):
            assert department_worker_rules(key).startswith(f.read_text(encoding="utf-8").strip()), f.name
        elif key not in ("default", "engineering"):
            assert department_template(key).startswith(f.read_text(encoding="utf-8").strip()), f.name
