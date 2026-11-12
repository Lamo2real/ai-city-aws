"""The application department's built-in knowledge (decision 225): one document per numbered section of the
application research, seeded, scoped and replaced exactly like marketing's and sales' (docs/KNOWLEDGE.md §17). No AWS."""

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
SOURCE = seed_root().parent / "source" / "application-research.md"
APP = {i: e for i, e in SEEDS.entries.items() if e.department == "application"}
MKT = "marketing.seo.local-seo"
SECURITY = "application.security.application-security"
EU = "application.compliance.eu-regulation"
GUARDRAILS = "application.guardrails.agent-guardrails"
GAPS = "application.gaps.consolidated-gaps"
LEGAL = {EU, "application.compliance.sweden", "application.compliance.customer-trust"}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "ff89b19d906ee74706396504dee1f78b8238bd76323ae97cfcb46cf56c8c83b7"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 27172 and re.findall(r"(?m)^## .*$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 19)]
    assert len(APP) == 19  # 18 sections plus "About this knowledge base"
    for e in APP.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # About joins the opening summary and the reading guide; section 18 carries the conclusion.
        for piece in re.split(r"\n\n## (?:Conclusion|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in exactly one document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")):
            assert sum(line in e.body for e in APP.values()) >= 1, line[:80]
    about = APP["application.overview.about-this-knowledge-base"]
    assert about.title == "Application: About this knowledge base" and "**[GAP]** marks" in about.body
    assert "## Conclusion" in APP[GAPS].body and APP[GAPS].body.count("**[GAP]**") == 7


def test_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in APP.items() if e.type == "policy"} == LEGAL
    assert {i for i, e in APP.items() if e.domain == "compliance"} == LEGAL
    assert {i for i, e in APP.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in APP.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert not [e for e in APP.values() if e.type == "house-style"]  # the source has no house-style material
    assert APP[EU].volatility == "fast-moving" and APP[EU].review_by <= "2027-03-01"
    assert "**[FAST-MOVING, applies since 11 Sep 2026; checked on primary source]**" in APP[EU].body
    assert all(e.sources for e in APP.values() if e.domain not in ("gaps",))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(APP[GUARDRAILS].cross_refs)
    assert refs["15"] == ("application.ai-agents.ai-coding-agent-controls",)
    assert "section 15 → application.ai-agents" in index_parts(APP[GUARDRAILS], "Application")[0]
    assert "owasp" in mentioned_concepts(APP[SECURITY], SEEDS.taxonomies["application"])


# ---------- seeding ----------
async def test_seeding_the_application_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/application/" in u]) > len(APP)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "application" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SECURITY))
    await run_seed(small(SECURITY), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{SECURITY}/" in u}
    kid = f"kn-{SECURITY}"
    assert ("MENTIONS", kid, "application/concept/prompt-injection") in r.graph.edges
    await s.update(SECURITY, {"content": "## Short version\n\nUse the OWASP lists for every review."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go
    after = {u for u in r.kb.docs if f"/{SECURITY}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{SECURITY}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "application/concept/owasp") in mentions
    assert ("MENTIONS", kid, "application/concept/prompt-injection") not in mentions
    rec = await r.registry.get(SECURITY) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SECURITY, EU))
    await run_seed(small(SECURITY, EU), r.registry, r.projector, MODEL)
    await s.update(SECURITY, {"summary": "The owner's own words."})
    await s.delete(EU)
    newer = {SECURITY: {"summary": "Shipped later."}, EU: {"title": "Application: EU regulation, newer"}}
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
    await settled(r)
    before = {u for u in r.kb.docs if f"/{SECURITY}/" in u}
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(SECURITY)
    rec = await r.registry.get(SECURITY) or {}
    assert rec["status"] == "failed" and rec["active"]["version"] == 1
    assert {u for u in r.kb.docs if f"/{SECURITY}/" in u} == before  # the old parts stay; the new ones are gone
    caller = Caller(department="application", role="worker")
    r.kb.hits = [
        Hit(f"kn-{SECURITY}", "OWASP", 0.9, "relevant", attributes={"department": "application", "version": 1})
    ]
    found = await search(r.kb, r.store, "q", caller=caller)
    assert [i["entry_id"] for i, _ in found.items] == [SECURITY]


# ---------- isolation ----------
async def _two_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SECURITY, EU, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "application"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{SECURITY}", "OWASP Top 10", 0.8, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{EU}", "Cyber Resilience Act", 0.7, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.6, "relevant", attributes={"department": "application"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_application_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _two_departments(kb_class())
    for role in ("manager", "worker"):
        app = await search(
            r.kb, r.store, "q", caller=Caller(department="application", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in app.items] == [SECURITY, EU, GUARDRAILS]
        mkt = await search(
            r.kb, r.store, "q", caller=Caller(department="marketing", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in mkt.items] == [MKT]
    for nobody in (Caller(role="executive"), Caller(department="sales", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_and_guardrail_documents_come_back_on_their_own_type() -> None:
    r = await _two_departments(IgnoresFilters())
    legal = await search(
        r.kb, r.store, "q", caller=Caller(department="application", role="worker", entry_type="policy")
    )
    assert [i["entry_id"] for i, _ in legal.items] == [EU]
    rails = await search(
        r.kb, r.store, "q", caller=Caller(department="application", role="manager", entry_type="checklist")
    )
    assert [i["entry_id"] for i, _ in rails.items] == [GUARDRAILS]


# ---------- prompts ----------
def test_application_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Application"), department_worker_rules("Application")
    for text in (manager, worker):
        assert "search_knowledge" in text and "law and compliance first" in text.lower()
        assert "independent evidence second" in text
        assert "`entry_type` `policy`" in text and "`entry_type` `checklist`" in text
        assert "Guardrails for the department's AI agents" in text and "is advice" in text  # decision 240
        assert "merge" in text and "secrets" in text
        assert "needs_verification" in text and "[GAP]" in text and "[FAST-MOVING" in text
        assert "never final legal, tax or accounting advice" in text
        assert "Handing work to and receiving work from other departments" in text
        assert "decision 240" in text  # the approval list is advice


# ---------- retrieval ----------
def test_the_application_retrieval_evaluation() -> None:
    k, questions = load_eval("application")
    assert k == 5 and len(questions) >= 15
    assert all(i in APP for q in questions for i in q["expect"])
    assert any(q["expect"] == [GAPS] for q in questions)  # a question the knowledge base marks as a gap
    r = offline_eval(SEEDS, "application")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
