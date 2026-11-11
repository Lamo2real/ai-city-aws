"""The product department's built-in knowledge (decision 230): one document per numbered section of the product
research, seeded, scoped and replaced exactly like marketing's, sales' and application's (docs/KNOWLEDGE.md §17).
No AWS."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entries import index_parts, mentioned_concepts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "product-research.md"
PROD = {i: e for i, e in SEEDS.entries.items() if e.department == "product"}
MKT = "marketing.seo.local-seo"
APP = "application.security.application-security"
PRIORITY = "product.prioritisation.prioritisation-and-roadmaps"
ACCESS = "product.accessibility.accessibility"
DESIGN = "product.compliance.compliance-by-design"
SWEDEN = "product.compliance.sweden-and-the-eu"
GUARDRAILS = "product.guardrails.agent-guardrails"
PRECEDENCE = "product.precedence.precedence-compliance-evidence-house-style"
GAPS = "product.gaps.consolidated-gaps"
LEGAL = {ACCESS, DESIGN, SWEDEN}
HOUSE = {
    "product.house-style.house-style-hormozi-product-models",
    "product.house-style.adapting-the-house-style-to-software",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "6721f953b217bc8af1aa70437a3d4c36b82cea9dc1eebfbf4efae486dbcab799"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 35947 and re.findall(r"(?m)^## .*$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 25)]
    assert len(PROD) == 25  # 24 sections plus "About this knowledge base"
    for e in PROD.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # About joins the opening summary and the reading guide; section 24 carries the conclusion.
        for piece in re.split(r"\n\n## (?:Conclusion|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in a document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")):
            assert sum(line in e.body for e in PROD.values()) >= 1, line[:80]
    about = PROD["product.overview.about-this-knowledge-base"]
    assert about.title == "Product: About this knowledge base" and "**[GAP]** marks" in about.body
    assert "## Conclusion" in PROD[GAPS].body and PROD[GAPS].body.count("**[GAP]**") == 6
    assert all(e.title.startswith("Product: ") for e in PROD.values())


def test_house_style_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in PROD.items() if e.type == "house-style"} == HOUSE
    assert {i for i, e in PROD.items() if e.confidence == "house-style"} == HOUSE
    assert {i for i, e in PROD.items() if e.domain == "house-style"} == HOUSE
    assert {i for i, e in PROD.items() if e.type == "policy"} == LEGAL
    assert {i for i, e in PROD.items() if e.domain in ("compliance", "accessibility")} == LEGAL
    assert {i for i, e in PROD.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in PROD.items() if e.domain == "guardrails"} == {GUARDRAILS}
    for i in LEGAL:
        assert PROD[i].volatility == "fast-moving" and PROD[i].review_by <= "2027-03-01"
    # the accessibility answer carries its date label
    assert PROD[ACCESS].body.count("**[FAST-MOVING") >= 5
    assert "checked on primary source" in PROD[ACCESS].body
    # the opening summary, the reading guide and the gaps cite no links in the source
    assert {i for i, e in PROD.items() if not e.sources} == {"product.overview.about-this-knowledge-base", GAPS}


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(PROD[PRECEDENCE].cross_refs)
    assert refs["18"] == (DESIGN,) and refs["17"] == (ACCESS,)
    assert "section 18 → product.compliance" in index_parts(PROD[PRECEDENCE], "Product")[0]
    # "SuperSummary, $100M Offers, section 3 summary" is a link's text, not a section of this document
    assert "3" not in dict(PROD["product.house-style.adapting-the-house-style-to-software"].cross_refs)
    assert "rice" in mentioned_concepts(PROD[PRIORITY], SEEDS.taxonomies["product"])
    assert "wcag" in mentioned_concepts(PROD[ACCESS], SEEDS.taxonomies["product"])


# ---------- seeding ----------
async def test_seeding_the_product_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/product/" in u]) > len(PROD)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "product" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(PRIORITY))
    await run_seed(small(PRIORITY), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{PRIORITY}/" in u}
    kid = f"kn-{PRIORITY}"
    assert ("MENTIONS", kid, "product/concept/kano") in r.graph.edges
    await s.update(
        PRIORITY,
        {"content": "## Short version\n\nRank small items with RICE.", "summary": "Rank small items with RICE."},
    )
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{PRIORITY}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{PRIORITY}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "product/concept/rice") in mentions
    assert ("MENTIONS", kid, "product/concept/kano") not in mentions
    rec = await r.registry.get(PRIORITY) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(PRIORITY, DESIGN))
    await run_seed(small(PRIORITY, DESIGN), r.registry, r.projector, MODEL)
    await s.update(PRIORITY, {"summary": "The owner's own words."})
    await s.delete(DESIGN)
    newer = {PRIORITY: {"summary": "Shipped later."}, DESIGN: {"title": "Product: Compliance by design, newer"}}
    for changes in (None, newer):
        rep = await run_seed(small(PRIORITY, DESIGN, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        kept = await r.registry.get(PRIORITY) or {}
        assert kept["summary"] == "The owner's own words." and kept["user_modified"]
        gone = await r.registry.get(DESIGN) or {}
        assert gone["deleted"] and gone["status"] == "deleted" and not [u for u in r.kb.docs if f"/{DESIGN}/" in u]
    assert (await r.registry.get(PRIORITY) or {})["newer_default"]["summary"] == "Shipped later."


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(PRIORITY))
    await run_seed(small(PRIORITY), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["product"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(PRIORITY)
    rec = await r.registry.get(PRIORITY) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, APP, PRIORITY, ACCESS, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "application", "product"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{APP}", "OWASP Top 10", 0.85, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{PRIORITY}", "RICE", 0.8, "relevant", attributes={"department": "product"}),
        Hit(f"kn-{ACCESS}", "WCAG 2.2 AA", 0.7, "relevant", attributes={"department": "product"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.6, "relevant", attributes={"department": "product"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_product_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        prod = await search(
            r.kb, r.store, "q", caller=Caller(department="product", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in prod.items] == [PRIORITY, ACCESS, GUARDRAILS]
        for dept, own in (("marketing", MKT), ("application", APP)):
            other = await search(
                r.kb, r.store, "q", caller=Caller(department=dept, role=role, audience="all", related=False)
            )
            assert [i["entry_id"] for i, _ in other.items] == [own]
    for nobody in (Caller(role="vaic"), Caller(department="sales", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_and_guardrail_documents_come_back_on_their_own_type() -> None:
    r = await _three_departments(IgnoresFilters())
    legal = await search(r.kb, r.store, "q", caller=Caller(department="product", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in legal.items] == [ACCESS]
    rails = await search(
        r.kb, r.store, "q", caller=Caller(department="product", role="manager", entry_type="checklist")
    )
    assert [i["entry_id"] for i, _ in rails.items] == [GUARDRAILS]


# ---------- prompts ----------
def test_product_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Product"), department_worker_rules("Product")
    for text in (manager, worker):
        assert "search_knowledge" in text and "Compliance first" in text and "Evidence second" in text
        assert "House style third, and by default" in text and "brand's own voice" in text
        assert "Never imitate Alex Hormozi" in text and "catchphrases or performance figures" in text
        assert "`entry_type` `policy`" in text and "`entry_type` `checklist`" in text
        assert "Guardrails for the department's AI agents" in text and "is advice" in text  # decision 240
        for gated in ("price, packaging", "roadmap commitment", "personal data or uses AI in a new way", "legal-terms"):
            assert gated in worker, gated  # the full list stays with the workers (decision 240)
        assert "needs_verification" in text and "[GAP]" in text and "[FAST-MOVING" in text
        assert "never final legal, tax or accounting advice" in text
        assert "Handoffs with other departments" in text and "decision 240" in text


# ---------- retrieval ----------
def test_the_product_retrieval_evaluation() -> None:
    k, questions = load_eval("product")
    assert k == 5 and len(questions) >= 15
    assert all(i in PROD for q in questions for i in q["expect"])
    assert any(q["expect"] == [GAPS] for q in questions)  # a question the knowledge base marks as a gap
    assert any(q["expect"] == [ACCESS] for q in questions)  # accessibility, answered with its date label
    r = offline_eval(SEEDS, "product")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
