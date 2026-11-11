"""The Research department's built-in knowledge (decision 231): one document per section of the Research department
research, seeded, scoped and replaced exactly like marketing's and sales' (docs/KNOWLEDGE.md §17). No AWS."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, small
from vaic.shared.knowledge.entries import canonical_department, index_parts, mentioned_concepts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "research-dept-research.md"
RES = {i: e for i, e in SEEDS.entries.items() if e.department == "research"}
MKT = "marketing.seo.local-seo"
SALES = "sales.house-style.closer-framework"
SCRAPE = "research.compliance.web-scraping-and-data-access"
TDM = "research.compliance.copyright-and-text-and-data-mining"
PERSONAL = "research.compliance.personal-data-in-research"
ETHICS = "research.compliance.swedish-ethics-review"
GUARDRAILS = "research.guardrails.agent-guardrails"
GAPS = "research.gaps.consolidated-gaps"
ABOUT = "research.overview.about-this-knowledge-base"
MARKET = "research.market.market-analysis-and-forecasting"


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "2a32c88b3507ca6a1d3b73941abee8f7a4b536f1a3a5323167c13000cc7ccfe3"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 25_165 and re.findall(r"(?m)^## .*", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 21)]
    assert len(RES) == 21  # 20 sections plus "About this knowledge base"
    for e in RES.values():
        assert e.title.startswith("Research: ")
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source line
        # Section 20 carries the closing Conclusion; About carries the title and summary before the reading guide.
        for piece in re.split(r"\n\n(?=## Conclusion|## How to read)", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading, labelled paragraph and table row of the source lands in the documents exactly as often.
    for line in src.splitlines():
        if line.startswith(("# ", "## ", "### ", "[", "| ")):
            assert sum(e.body.count(line) for e in RES.values()) == src.count(line), line[:80]
    assert "## How to read and split this document" in RES[ABOUT].body
    assert "## 20. Consolidated gaps" in RES[GAPS].body and "## Conclusion" in RES[GAPS].body


def test_types_and_the_compliance_and_guardrail_documents_are_filterable() -> None:
    legal = {TDM, SCRAPE, PERSONAL, ETHICS}
    assert {i for i, e in RES.items() if e.domain == "compliance"} == legal
    assert {i for i, e in RES.items() if e.type == "policy"} == legal
    assert {i for i, e in RES.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert {i for i, e in RES.items() if e.type == "checklist"} == {GUARDRAILS}
    # The research has no [HOUSE STYLE] material (its reading guide says so), so nothing is house style.
    assert not [e for e in RES.values() if "house-style" in (e.type, e.confidence, e.domain)]
    assert RES[SCRAPE].volatility == "fast-moving" and RES[SCRAPE].review_by <= "2027-03-01"
    assert all(e.sources for e in RES.values() if e.domain not in ("guardrails", "handoffs", "gaps", "overview"))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    g = RES[GUARDRAILS]
    refs = dict(g.cross_refs)
    assert refs["13"] == (SCRAPE,) and refs["12.2"] == (TDM,) and refs["14.2"] == (PERSONAL,)
    assert refs["17"] == ("research.security.confidential-information",)
    assert all(r in SEEDS.entries for ids in refs.values() for r in ids)
    assert "section 13 → " + SCRAPE in index_parts(g, "Research")[0]
    assert not RES[SCRAPE].cross_refs  # its "section 1201" is the US DMCA, not this document
    assert {"technical-barrier", "dataintrang"} <= {
        c for c in mentioned_concepts(RES[SCRAPE], SEEDS.taxonomies["research"])
    }


# ---------- seeding ----------
async def test_seeding_the_research_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/research/" in u]) > len(RES)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(SCRAPE) or {}
    assert rec["department"] == "research" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SCRAPE))
    await run_seed(small(SCRAPE), r.registry, r.projector, MODEL)
    before = {u for u in r.kb.docs if f"/{SCRAPE}/" in u}
    kid = f"kn-{SCRAPE}"
    assert ("MENTIONS", kid, "research/concept/dataintrang") in r.graph.edges
    await s.update(SCRAPE, {"content": "## Short version\n\nStop at any login or block and ask the owner."})
    after = {u for u in r.kb.docs if f"/{SCRAPE}/" in u}
    assert len(after) == 2 and len(before) > 2 and after < before
    part1 = next(v for k, v in r.blobs.objects.items() if k.endswith(f"/{SCRAPE}/1.md"))
    assert b"Short version" in (part1 if isinstance(part1, bytes) else part1[0])
    assert not [k for k in r.blobs.objects if f"/{SCRAPE}/" in k and k.split("/")[-1].split(".")[0] not in ("0", "1")]
    mentions = {e[2] for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert "research/concept/technical-barrier" in mentions  # from the summary, which the new text keeps
    assert "research/concept/dataintrang" not in mentions
    rec = await r.registry.get(SCRAPE) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SCRAPE, GAPS))
    await run_seed(small(SCRAPE, GAPS), r.registry, r.projector, MODEL)
    await s.update(SCRAPE, {"summary": "The owner's own scraping summary."})
    await s.delete(GAPS)
    changed = {SCRAPE: {"title": "Research: newer"}, GAPS: {"title": "Research: newer gaps"}}
    for changes in (None, changed):
        rep = await run_seed(small(SCRAPE, GAPS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        sc, gaps = await r.registry.get(SCRAPE) or {}, await r.registry.get(GAPS) or {}
        assert sc["summary"] == "The owner's own scraping summary." and sc["user_modified"]
        assert gaps["deleted"] and not [u for u in r.kb.docs if f"/{GAPS}/" in u]
    reset = await s.reset(GAPS)
    assert not reset["deleted"] and reset["sync"] == "done"


@pytest.mark.xfail(
    strict=True,
    reason="Not built: an edit or re-index hides the document until it is indexed again (status processing, then "
    "failed); keeping the last ready version active is the shared change assigned to the Application session.",
)
async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SCRAPE))
    await run_seed(small(SCRAPE), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["research"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(SCRAPE)
    rec = await r.registry.get(SCRAPE) or {}
    assert rec["status"] == "ready"
    r.kb.hits = [Hit(f"kn-{SCRAPE}", "stop sign", 0.8, "relevant", attributes={"department": "research"})]
    res = await search(r.kb, r.store, "q", caller=Caller(department="research", role="worker", related=False))
    assert [i["entry_id"] for i, _ in res.items] == [SCRAPE]


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SALES, SCRAPE, MARKET), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "research"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{SALES}", "clarify why they are there", 0.85, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{SCRAPE}", "stop sign", 0.8, "relevant", attributes={"department": "research"}),
        Hit(f"kn-{MARKET}", "reference class", 0.7, "relevant", attributes={"department": "research"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_research_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        for dept, want in (("research", [SCRAPE, MARKET]), (canonical_department("Research"), [SCRAPE, MARKET]),
                           ("marketing", [MKT]), ("sales", [SALES])):  # fmt: skip
            who = Caller(department=dept, role=role, audience="all", related=False)
            res = await search(r.kb, r.store, "q", caller=who)
            assert [i["entry_id"] for i, _ in res.items] == want, (dept, role)
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="manager"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_compliance_documents_come_back_on_their_own_filter() -> None:
    r = await _three_departments(IgnoresFilters())
    for caller in (Caller(department="research", role="worker", entry_type="policy"),
                   Caller(department="research", role="worker", domain="compliance")):  # fmt: skip
        res = await search(r.kb, r.store, "q", caller=caller)
        assert [i["entry_id"] for i, _ in res.items] == [SCRAPE]


# ---------- prompts ----------
def test_research_managers_and_workers_carry_precedence_guardrails_and_gaps() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Research"), department_worker_rules("Research")
    for text in (manager, worker):
        assert "search_knowledge" in text
        assert "Law and compliance first" in text and "Independent evidence second" in text
        assert "orientation for a human to confirm" in text and "legal, tax or accounting advice" in text
        assert "technical barrier is a stop sign" in text and "CAPTCHAs" in text
        assert "personal data" in text and "deliverable" in text and "confidential" in text
        assert "needs_verification" in text and "[GAP]" in text and "Consolidated gaps" in text
        assert "Research: Handoffs with other departments" in text
    assert "ask_owner" in manager and "Stop and escalate" in manager


# ---------- retrieval ----------
def test_the_research_retrieval_evaluation() -> None:
    k, questions = load_eval("research")
    assert k == 5 and len(questions) >= 15
    assert all(i in RES for q in questions for i in q["expect"])
    text = " ".join(q["q"] for q in questions).lower()
    for topic in ("market", "survey", "competitive intelligence", "trustworthy", "scrape", "likelihood", "not know"):
        assert topic in text, topic
    r = offline_eval(SEEDS, "research")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
