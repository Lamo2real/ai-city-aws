"""The finance department's built-in knowledge (decision 228): one document per numbered section of the finance
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
SOURCE = seed_root().parent / "source" / "finance-research.md"
FIN = {i: e for i, e in SEEDS.entries.items() if e.department == "finance"}
MKT = "marketing.seo.local-seo"
CLOSER = "sales.house-style.closer-framework"
VAT = "finance.vat.moms-sweden-eu-and-beyond"
METRICS = "finance.metrics.saas-metrics-formulas-benchmarks"
HOUSE = "finance.house-style.money-models-cash-flow-design"
GUARDRAILS = "finance.guardrails.agent-guardrails"
GAPS = "finance.gaps.consolidated-gaps"
ABOUT = "finance.overview.about-this-knowledge-base"
LEGAL = {
    "finance.bookkeeping.law-and-standards",
    "finance.revenue-recognition.saas-and-capitalised-development",
    "finance.close.close-annual-report-audit-board",
    "finance.invoicing.invoicing-receivables-payment-providers",
    VAT,
    "finance.tax.corporate-owner-and-rd-tax",
    "finance.payroll.payroll-holiday-pay-and-equity",
    "finance.calendar.recurring-dates",
    "finance.other-regimes.other-regimes-and-conclusion",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "5e8fd8043d78338f329615da41cb61a06113c9cc207923e04530f13ed3d14ea1"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 31585
    assert re.findall(r"(?m)^#+ .*$", text)[-1] == "### Corrections applied in this document"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 24)]
    # Sections 1 to 21 and 23, section 22 (the conclusion) with 21, plus "About this knowledge base".
    assert len(FIN) == 23
    for e in FIN.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        for piece in re.split(r"\n\n## (?:22\. .*|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in a document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")):
            assert any(line in e.body for e in FIN.values()), line[:80]
    assert FIN[ABOUT].title == "Finance: About this knowledge base" and "**[GAP]** marks" in FIN[ABOUT].body
    assert "## 22. Conclusion" in FIN["finance.other-regimes.other-regimes-and-conclusion"].body
    assert "### Corrections applied in this document" in FIN[GAPS].body
    assert FIN[GAPS].title == "Finance: Consolidated gaps and unverified points"


def test_house_style_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in FIN.items() if e.type == "house-style"} == {HOUSE}
    assert FIN[HOUSE].confidence == "house-style" and FIN[HOUSE].domain == "house-style"
    assert {i for i, e in FIN.items() if e.type == "policy"} == LEGAL
    assert {i for i, e in FIN.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in FIN.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert FIN["finance.precedence.law-evidence-house-style"].confidence == "contested"
    assert FIN[VAT].volatility == "fast-moving" and FIN[VAT].review_by <= "2027-03-01"
    assert all(e.sources for e in FIN.values() if e.id not in (ABOUT, GAPS))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(FIN[HOUSE].cross_refs)
    assert refs["3"] == ("finance.precedence.law-evidence-house-style",)
    assert "section 3 → finance.precedence" in index_parts(FIN[HOUSE], "Finance")[0]
    assert {"oss", "reverse-charge", "vies"} <= set(mentioned_concepts(FIN[VAT], SEEDS.taxonomies["finance"]))


# ---------- seeding ----------
async def test_seeding_the_finance_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/finance/" in u]) > len(FIN)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "finance" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(VAT))
    await run_seed(small(VAT), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{VAT}/" in u}
    kid = f"kn-{VAT}"
    assert ("MENTIONS", kid, "finance/concept/invoice") in r.graph.edges
    await s.update(VAT, {"content": "## Short version\n\nCheck the customer's VAT number in VIES first."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{VAT}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{VAT}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "finance/concept/vies") in mentions
    assert ("MENTIONS", kid, "finance/concept/invoice") not in mentions  # only the old text named invoices
    rec = await r.registry.get(VAT) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(VAT, METRICS))
    await run_seed(small(VAT, METRICS), r.registry, r.projector, MODEL)
    await s.update(VAT, {"summary": "The owner's own words."})
    await s.delete(METRICS)
    newer = {VAT: {"summary": "Shipped later."}, METRICS: {"title": "Finance: SaaS metrics, newer"}}
    for changes in (None, newer):
        rep = await run_seed(small(VAT, METRICS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        kept = await r.registry.get(VAT) or {}
        assert kept["summary"] == "The owner's own words." and kept["user_modified"]
        gone = await r.registry.get(METRICS) or {}
        assert gone["deleted"] and gone["status"] == "deleted" and not [u for u in r.kb.docs if f"/{METRICS}/" in u]
    assert (await r.registry.get(VAT) or {})["newer_default"]["summary"] == "Shipped later."


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(VAT))
    await run_seed(small(VAT), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["finance"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(VAT)
    rec = await r.registry.get(VAT) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, CLOSER, VAT, GUARDRAILS, HOUSE), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "finance"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.95, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{CLOSER}", "clarify why they are there", 0.9, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{VAT}", "reverse charge", 0.8, "relevant", attributes={"department": "finance"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.7, "relevant", attributes={"department": "finance"}),
        Hit(f"kn-{HOUSE}", "30-day cash payback", 0.6, "relevant", attributes={"department": "finance"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_finance_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        fin = await search(
            r.kb, r.store, "q", caller=Caller(department="finance", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in fin.items] == [VAT, GUARDRAILS, HOUSE]
        for dept, own in (("marketing", MKT), ("sales", CLOSER)):
            res = await search(
                r.kb, r.store, "q", caller=Caller(department=dept, role=role, audience="all", related=False)
            )
            assert [i["entry_id"] for i, _ in res.items] == [own]
    for nobody in (Caller(role="vaic"), Caller(department="legal", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_guardrail_and_house_style_documents_come_back_on_their_own_type() -> None:
    r = await _three_departments(IgnoresFilters())
    for etype, want in (("policy", [VAT]), ("checklist", [GUARDRAILS]), ("house-style", [HOUSE])):
        res = await search(r.kb, r.store, "q", caller=Caller(department="finance", role="worker", entry_type=etype))
        assert [i["entry_id"] for i, _ in res.items] == want, etype


# ---------- prompts ----------
def test_finance_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Finance"), department_worker_rules("Finance")
    for text in (manager, worker):
        assert "search_knowledge" in text
        assert "Law first" in text and "Evidence second" in text and "House style third" in text
        assert "`entry_type` `policy`" in text and "checklist" in text and "`domain` `house-style`" in text
        assert "never use his name, likeness or catchphrases with customers" in text
        assert "brand's own voice" in text and "performance figures" in text
        assert "Guardrails for the department's AI agents" in text
        assert "needs_verification" in text and "[GAP]" in text
        assert "not final legal, tax or accounting advice" in text
        assert "Handoffs between Finance and the other departments" in text
        assert "compliance always overrides it" in text.lower()
    assert "ask_owner" in manager and "auditor, an authority or an investor" in manager


# ---------- retrieval ----------
def test_the_finance_retrieval_evaluation() -> None:
    k, questions = load_eval("finance")
    assert k == 5 and len(questions) >= 15
    assert all(i in FIN for q in questions for i in q["expect"])
    assert any(GAPS in q["expect"] for q in questions)  # a question the knowledge base marks as a gap
    r = offline_eval(SEEDS, "finance")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
