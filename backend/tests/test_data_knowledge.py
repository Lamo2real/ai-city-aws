"""The Data and AI department's built-in knowledge (decision 227): one document per section of the data and AI
research, seeded, scoped and replaced exactly like marketing's and sales' (docs/KNOWLEDGE.md §17). No AWS."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entries import index_parts, mentioned_concepts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import bm25_rank, load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "data-and-ai-research.md"
DATA = {i: e for i, e in SEEDS.entries.items() if e.department == "data"}
MKT = "marketing.seo.local-seo"
SALES = "sales.compliance.sweden"
RAG = "data.rag.retrieval-augmented-generation"
LAW = "data.ai-law.ai-governance-and-law"
GUARDRAILS = "data.guardrails.agent-guardrails"
GAPS = "data.gaps.consolidated-gaps"
POLICY = {
    "data.privacy.privacy-engineering-and-data-act",
    LAW,
    "data.responsible-ai.testing-documentation-oversight",
    GUARDRAILS,
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    raw = SOURCE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == "e07c7066d360e0db60c57a4c64dc923c80d2e1367302993a6d782ec230fa734a"
    text = raw.decode("utf-8")
    assert len(text.split()) == 30_357
    assert re.findall(r"(?m)^## .*", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 22)]
    # 21 sections plus "About this knowledge base" (title, introduction and the reading guide); the conclusion
    # rides with section 21, which stays its own document.
    assert len(DATA) == 22
    for e in DATA.values():
        assert e.title.startswith("Data and AI: "), e.id
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        for piece in body.split("\n\n## How to read and split this document"):
            for part in piece.split("\n\n## Conclusion"):
                assert part.strip() and part.strip() in src, e.id
    # Every heading and every labelled paragraph of the source lands in exactly one document, label and all.
    every = "\n".join(e.body for e in DATA.values())
    for line in src.splitlines():
        if line.startswith("### ") or line.startswith("**[") or line.startswith("| "):
            assert every.count(line) == 1, line[:80]
    assert "## Conclusion" in DATA[GAPS].body and "## 21." not in DATA[GAPS].body
    about = DATA["data.overview.about-this-knowledge-base"]
    assert "## How to read and split this document" in about.body and "## 1." not in about.body


def test_types_and_the_legal_and_guardrail_documents_as_their_own_types() -> None:
    assert {i for i, e in DATA.items() if e.type == "policy"} == POLICY
    assert DATA[GUARDRAILS].domain == "guardrails"
    assert [i for i, e in DATA.items() if e.domain == "guardrails"] == [GUARDRAILS]
    # The source has no [HOUSE STYLE] material, so nothing here is house style.
    assert not [i for i, e in DATA.items() if "house-style" in (e.type, e.confidence, e.domain)]
    assert DATA[LAW].volatility == "fast-moving" and DATA[LAW].review_by <= "2027-03-01"
    assert DATA[GUARDRAILS].confidence == "inference" and DATA[GAPS].type == "checklist"
    assert all(e.sources for i, e in DATA.items() if e.domain not in ("overview", "gaps", "handoffs")), "links"
    # Section 20 cites section 19's approval tiers.
    assert dict(DATA["data.handoffs.between-departments"].cross_refs)["19"] == (GUARDRAILS,)
    assert mentioned_concepts(DATA[RAG], SEEDS.taxonomies["data"])


def test_the_ai_act_dates_come_with_their_date_label() -> None:
    parts = [p for p in index_parts(DATA[LAW], "Data and AI") if "› EU AI Act timeline" in p and "2 December 2027" in p]
    assert parts and all("**[FAST-MOVING, 8 July 2026]**" in p for p in parts)


# ---------- seeding ----------
async def test_seeding_the_data_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/data/" in u]) > len(DATA)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(LAW) or {}
    assert rec["department"] == "data" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_data_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(RAG))
    await run_seed(small(RAG), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{RAG}/" in u}
    edges_before = set(r.graph.edges)
    kid = f"kn-{RAG}"
    assert ("MENTIONS", kid, "data/concept/reranker") in r.graph.edges
    await s.update(RAG, {"content": "## Short version\n\nUse hybrid search over contextual chunks."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{RAG}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{RAG}/" in k and "/v2/" not in k]
    before_mentions = {e[2] for e in edges_before if e[0] == "MENTIONS" and e[1] == kid}
    mentions = {e[2] for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    # The entry keeps only what its title, summary and new text mention.
    assert "data/concept/hybrid-search" in mentions and mentions < before_mentions
    assert "data/concept/access-filter" in before_mentions - mentions
    assert ("KnowledgeEntry", kid) in r.graph.vertices


async def test_an_edited_or_deleted_data_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(RAG, GUARDRAILS))
    await run_seed(small(RAG, GUARDRAILS), r.registry, r.projector, MODEL)
    await s.update(RAG, {"content": "## The owner's version\n\nOur own retrieval rules."})
    await s.delete(GUARDRAILS)
    edited = {u for u in r.kb.docs if f"/{RAG}/" in u}
    for changes in (None, {RAG: {"title": "Data and AI: RAG, newer"}, GUARDRAILS: {"title": "Newer guardrails"}}):
        rep = await run_seed(small(RAG, GUARDRAILS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok and all(c.action == "newer_default" for c in rep.changed())
        assert "The owner's version" in (await r.registry.get(RAG) or {})["content"]
        assert {u for u in r.kb.docs if f"/{RAG}/" in u} == edited
        g = await r.registry.get(GUARDRAILS) or {}
        assert g["deleted"] and g["status"] == "deleted"
        assert not [u for u in r.kb.docs if f"/{GUARDRAILS}/" in u]
    assert (await r.registry.get(GUARDRAILS) or {})["newer_default"]["title"] == "Newer guardrails"


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(RAG))
    await run_seed(small(RAG), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["data"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(RAG)
    rec = await r.registry.get(RAG) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SALES, RAG, LAW, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "data"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{RAG}", "hybrid retrieval", 0.85, "relevant", attributes={"department": "data"}),
        Hit(f"kn-{SALES}", "written confirmation", 0.8, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{LAW}", "Article 50", 0.7, "relevant", attributes={"department": "data"}),
        Hit(f"kn-{GUARDRAILS}", "needs human approval", 0.6, "relevant", attributes={"department": "data"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_data_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        for dept, want in (("data", [RAG, LAW, GUARDRAILS]), ("marketing", [MKT]), ("sales", [SALES])):
            res = await search(
                r.kb, r.store, "q", caller=Caller(department=dept, role=role, audience="all", related=False)
            )
            assert [i["entry_id"] for i, _ in res.items] == want, (dept, role)
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="manager"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_the_legal_documents_and_the_guardrails_come_back_on_their_own_type_and_domain() -> None:
    r = await _three_departments(IgnoresFilters())
    res = await search(r.kb, r.store, "q", caller=Caller(department="data", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in res.items] == [LAW, GUARDRAILS]
    res = await search(r.kb, r.store, "q", caller=Caller(department="data", role="worker", domain="guardrails"))
    assert [i["entry_id"] for i, _ in res.items] == [GUARDRAILS]
    # Another department asking for policy documents never gets these.
    res = await search(r.kb, r.store, "q", caller=Caller(department="sales", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in res.items] == [SALES]


# ---------- prompts ----------
def test_data_managers_and_workers_carry_the_precedence_guardrails_and_gaps() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Data & AI"), department_worker_rules("Data & AI")
    for text in (manager, worker):
        assert "Law and compliance first" in text and "evidence second" in text.lower()
        assert "`entry_type` `policy`" in text and "Guardrails for the department's AI agents" in text
        assert "not final legal, tax or accounting advice" in text
        assert "[FAST-MOVING]" in text and "needs_verification" in text and "[GAP]" in text
        assert "Consolidated gaps" in text and "Handoffs between departments" in text
        assert "is advice" in text  # decision 240
    assert "deleting or exporting datasets" in manager and "deleting or exporting datasets" in worker
    assert "Nothing waits for the owner's yes" in manager


# ---------- retrieval ----------
def test_the_data_retrieval_evaluation() -> None:
    k, questions = load_eval("data")
    assert k == 5 and len(questions) >= 15
    assert all(i in DATA for q in questions for i in q["expect"])
    asked = " ".join(q["q"] for q in questions)
    for topic in ("grain", "RAG", "LLM judge", "AI Act", "prompt injection", "Sweden"):
        assert topic in asked, topic
    r = offline_eval(SEEDS, "data")
    first = sum(bm25_rank(q["q"], list(DATA.values()), "Data and AI")[0] in q["expect"] for q in questions)
    print(json.dumps({**r.as_json(), "top_1": first}))
    assert r.hit_rate >= 0.9, r.misses
