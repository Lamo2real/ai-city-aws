"""The legal department's built-in knowledge (decision 232): one document per numbered section of the legal
research, seeded, scoped and replaced exactly like marketing's, sales' and application's (docs/KNOWLEDGE.md §17). No AWS."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entries import index_parts, mentioned_concepts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, entry_block, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "legal-research.md"
LEGAL = {i: e for i, e in SEEDS.entries.items() if e.department == "legal"}
MKT = "marketing.seo.local-seo"
APP_DOC = "application.security.application-security"
SECURITY = "legal.privacy.privacy-gdpr-imy"
EU = "legal.ai-regulation.eu-ai-act-and-swedish-supervision"
GUARDRAILS = "legal.guardrails.agent-guardrails"
PENDING = "legal.pending-changes.pending-changes-and-dated-milestones"
GAPS = "legal.gaps.consolidated-gaps"
NOT_POLICY = {
    "legal.overview.about-this-knowledge-base",
    GUARDRAILS,
    GAPS,
    "legal.legal-ops.legal-operations",
    "legal.handoffs.handoffs-with-other-departments",
    "legal.legal-ai.ai-doing-legal-work",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "e42856b972a3e906177543d599a174781a34ac6b75960a56bfb9b1ac57d38666"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 39314 and re.findall(r"(?m)^## .*$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 22)]
    assert len(LEGAL) == 22  # 21 sections plus "About this knowledge base"
    for e in LEGAL.values():
        assert e.title.startswith("Legal: ")
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # About joins the opening summary and the reading guide; section 21 carries the conclusion.
        for piece in re.split(r"\n\n## (?:Conclusion|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in a document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")):
            assert sum(line in e.body for e in LEGAL.values()) >= 1, line[:80]
    about = LEGAL["legal.overview.about-this-knowledge-base"]
    assert about.title == "Legal: About this knowledge base" and "**[GAP]** marks" in about.body
    assert "Legal agents must verify before advising" not in about.body  # the document title is not content
    assert "## Conclusion" in LEGAL[GAPS].body and LEGAL[GAPS].title == "Legal: Consolidated gaps"
    # The verification wording is kept exactly.
    assert "Checked on primary source" in about.body and "Unverified background, not fetched" in about.body


def test_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in LEGAL.items() if e.type != "policy"} == NOT_POLICY
    assert {i for i, e in LEGAL.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in LEGAL.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert not [e for e in LEGAL.values() if e.type == "house-style"]  # the source has no [HOUSE STYLE] paragraph
    assert LEGAL[EU].volatility == "fast-moving" and LEGAL[EU].review_by <= "2027-03-01"
    assert all(e.sources for e in LEGAL.values() if e.domain not in ("gaps", "overview", "handoffs"))
    assert set().union(*(e.platforms for e in LEGAL.values())) == {"sweden", "eu", "us"}


def test_pending_changes_keep_every_date_and_flag_a_past_one() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    section = src.split("## 20. ")[1].split("## 21. ")[0]
    rows = [r for r in section.splitlines() if r.startswith("| ") and not r.startswith("| Expected")]
    assert len(rows) == 27 and all(r in LEGAL[PENDING].body for r in rows)
    e = LEGAL[PENDING]
    # Fast-moving, reviewed by the first milestone (19 Nov 2026): once a date is past, retrieval says verify it.
    assert e.volatility == "fast-moving" and e.review_by == "2026-11-19"
    item = {"entry_id": e.id, "volatility": e.volatility, "review_by": e.review_by, "content": e.body}
    assert "needs_verification" not in entry_block(item, today=date(2026, 11, 11))
    assert 'needs_verification="past review date"' in entry_block(item, today=date(2026, 11, 20))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(LEGAL[GUARDRAILS].cross_refs)
    assert refs["17"] == ("legal.legal-ai.ai-doing-legal-work",)
    assert "section 17 → legal.legal-ai" in index_parts(LEGAL[GUARDRAILS], "Legal")[0]
    assert "gdpr" in mentioned_concepts(LEGAL[SECURITY], SEEDS.taxonomies["legal"])
    assert "imy" in mentioned_concepts(LEGAL[SECURITY], SEEDS.taxonomies["legal"])


# ---------- seeding ----------
async def test_seeding_the_legal_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/legal/" in u]) > len(LEGAL)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "legal" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SECURITY))
    await run_seed(small(SECURITY), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{SECURITY}/" in u}
    kid = f"kn-{SECURITY}"
    assert ("MENTIONS", kid, "legal/concept/marketing-act") in r.graph.edges
    await s.update(SECURITY, {"content": "## Short version\n\nAnswer every GDPR request within one month."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{SECURITY}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{SECURITY}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "legal/concept/gdpr") in mentions
    assert ("MENTIONS", kid, "legal/concept/marketing-act") not in mentions
    rec = await r.registry.get(SECURITY) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SECURITY, EU))
    await run_seed(small(SECURITY, EU), r.registry, r.projector, MODEL)
    await s.update(SECURITY, {"summary": "The owner's own words."})
    await s.delete(EU)
    newer = {SECURITY: {"summary": "Shipped later."}, EU: {"title": "Legal: AI regulation, newer"}}
    for changes in (None, newer):
        rep = await run_seed(small(SECURITY, EU, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        kept = await r.registry.get(SECURITY) or {}
        assert kept["summary"] == "The owner's own words." and kept["user_modified"]
        gone = await r.registry.get(EU) or {}
        assert gone["deleted"] and gone["status"] == "deleted" and not [u for u in r.kb.docs if f"/{EU}/" in u]
    assert (await r.registry.get(SECURITY) or {})["newer_default"]["summary"] == "Shipped later."


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SECURITY))
    await run_seed(small(SECURITY), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["legal"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(SECURITY)
    rec = await r.registry.get(SECURITY) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, APP_DOC, SECURITY, EU, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "application", "legal"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.95, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{APP_DOC}", "OWASP", 0.9, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{SECURITY}", "GDPR breach", 0.8, "relevant", attributes={"department": "legal"}),
        Hit(f"kn-{EU}", "AI Act", 0.7, "relevant", attributes={"department": "legal"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.6, "relevant", attributes={"department": "legal"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_legal_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        legal = await search(
            r.kb, r.store, "q", caller=Caller(department="legal", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in legal.items] == [SECURITY, EU, GUARDRAILS]
        for dept, own in (("marketing", MKT), ("application", APP_DOC)):
            other = await search(
                r.kb, r.store, "q", caller=Caller(department=dept, role=role, audience="all", related=False)
            )
            assert [i["entry_id"] for i, _ in other.items] == [own]
    for nobody in (Caller(role="vaic"), Caller(department="sales", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_and_guardrail_documents_come_back_on_their_own_type() -> None:
    r = await _three_departments(IgnoresFilters())
    law = await search(r.kb, r.store, "q", caller=Caller(department="legal", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in law.items] == [SECURITY, EU]
    rails = await search(r.kb, r.store, "q", caller=Caller(department="legal", role="manager", entry_type="checklist"))
    assert [i["entry_id"] for i, _ in rails.items] == [GUARDRAILS]


# ---------- prompts ----------
def test_legal_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Legal"), department_worker_rules("Legal")
    for text in (manager, worker):
        assert "search_knowledge" in text and "law and compliance first" in text.lower()
        assert "independent evidence second" in text
        assert "`entry_type` `policy`" in text and "`entry_type` `checklist`" in text
        assert "Guardrails for the department's AI agents" in text and "is advice" in text  # decision 240
        for gated in (
            "signing or accepting any contract",
            "legal position to a counterparty",
            "court, authority or regulator",
            "dispute",
            "commits the company legally",
        ):
            assert gated in worker, gated  # the full list stays with the workers (decision 240)
        assert "needs_verification" in text and "[GAP]" in text and "[FAST-MOVING" in text
        assert "section 20" in text.lower()
        assert "never final legal, tax or accounting advice" in text
        assert "Hand-offs with the other departments" in text
        assert "decision 240" in text


# ---------- retrieval ----------
def test_the_legal_retrieval_evaluation() -> None:
    k, questions = load_eval("legal")
    assert k == 5 and len(questions) >= 15
    assert all(i in LEGAL for q in questions for i in q["expect"])
    assert any(q["expect"] == [GAPS] for q in questions)  # a question the knowledge base marks as a gap
    texts = " ".join(q["q"] for q in questions)
    for topic in ("liability cap", "DPA", "IMY", "AI Act", "LAS", "Produktansvarslag"):
        assert topic in texts, topic
    r = offline_eval(SEEDS, "legal")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
