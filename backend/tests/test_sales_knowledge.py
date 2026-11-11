"""The sales department's built-in knowledge (decision 224): one document per section of the sales research, seeded,
scoped and replaced exactly like marketing's (docs/KNOWLEDGE.md §17). No AWS."""

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
SOURCE = seed_root().parent / "source" / "sales-research.md"
SALES = {i: e for i, e in SEEDS.entries.items() if e.department == "sales"}
MKT = "marketing.seo.local-seo"
CLOSER = "sales.house-style.closer-framework"
SWEDEN = "sales.compliance.sweden"
COMPLIANCE = {
    "sales.compliance.outreach-by-country-and-channel",
    SWEDEN,
    "sales.compliance.recording-and-eu-sales-tactics",
    "sales.compliance.contracting-bribery-competition-data",
    "sales.compliance.ai-agent-guardrails",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "13b80d6242bb75e5584dabab0f81d32a48f4ac307d6f4907648e2afa60f65ea3"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    numbered = re.findall(r"(?m)^## (\d+)\. ", src)
    assert numbered == [str(n) for n in range(1, 33)]
    # 32 sections plus the overview (title, introduction, reading guide and conclusion).
    assert len(SALES) == 33
    for e in SALES.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # The overview joins the opening (title, introduction, reading guide) and the conclusion.
        for piece in body.split("\n\n## Conclusion"):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph of the source lands in exactly one document.
    every = "\n".join(e.body for e in SALES.values())
    for line in src.splitlines():
        if line.startswith("### ") or line.startswith("**["):
            assert line in every, line[:80]
    assert "sales.gaps.consolidated-gaps" in SALES


def test_types_confidence_and_compliance_as_its_own_type() -> None:
    house = {i for i, e in SALES.items() if e.domain == "house-style"}
    assert len(house) == 9  # sections 2 to 10
    assert all(SALES[i].type == "house-style" and SALES[i].confidence == "house-style" for i in house)
    assert {i for i, e in SALES.items() if e.type == "policy"} == COMPLIANCE
    assert {i for i, e in SALES.items() if e.domain == "compliance"} == COMPLIANCE
    assert SALES["sales.precedence.compliance-evidence-house-style"].confidence == "contested"
    assert SALES[SWEDEN].volatility == "fast-moving" and SALES[SWEDEN].review_by <= "2027-03-01"
    assert all(e.sources for e in SALES.values() if e.domain not in ("overview", "gaps")), "every section has links"


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    e = SALES["sales.house-style.selling-mentality"]
    assert dict(e.cross_refs)["11"] == ("sales.precedence.compliance-evidence-house-style",)
    assert "section 11 → sales.precedence" in index_parts(e, "Sales")[0]
    assert mentioned_concepts(SALES[CLOSER], SEEDS.taxonomies["sales"])


# ---------- seeding ----------
async def test_seeding_the_sales_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/sales/" in u]) > len(SALES)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(SWEDEN) or {}
    assert rec["department"] == "sales" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_sales_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(CLOSER))
    await run_seed(small(CLOSER), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{CLOSER}/" in u}
    kid = f"kn-{CLOSER}"
    assert ("MENTIONS", kid, "sales/concept/objection-handling") in r.graph.edges
    await s.update(CLOSER, {"content": "## Short version\n\nAsk about their goal, then the price of waiting."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go
    after = {u for u in r.kb.docs if f"/{CLOSER}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    part1 = next(v for k, v in r.blobs.objects.items() if k.endswith(f"/{CLOSER}/v2/1.md"))
    assert b"Short version" in (part1 if isinstance(part1, bytes) else part1[0])
    assert not [k for k in r.blobs.objects if f"/{CLOSER}/" in k and "/v2/" not in k]
    # The graph keeps the entry but only what the new text mentions.
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert mentions == {("MENTIONS", kid, "sales/concept/closer")}  # from the title; the objections are gone
    assert ("KnowledgeEntry", kid) in r.graph.vertices
    rec = await r.registry.get(CLOSER) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]
    # And the next deploy keeps the owner's version.
    again = await run_seed(small(CLOSER), r.registry, r.projector, MODEL)
    assert again.changed() == [] and {u for u in r.kb.docs if f"/{CLOSER}/" in u} == after


# ---------- isolation ----------
async def _two_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, CLOSER, SWEDEN), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{CLOSER}", "clarify why they are there", 0.8, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{SWEDEN}", "written confirmation", 0.7, "relevant", attributes={"department": "sales"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_sales_and_marketing_never_retrieve_each_others_documents(kb_class: type[FakeKnowledgeBase]) -> None:
    r = await _two_departments(kb_class())
    for role in ("manager", "worker"):
        sales = await search(
            r.kb, r.store, "q", caller=Caller(department="sales", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in sales.items] == [CLOSER, SWEDEN]
        mkt = await search(
            r.kb, r.store, "q", caller=Caller(department="marketing", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in mkt.items] == [MKT]
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="manager"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_compliance_documents_come_back_on_their_own_type() -> None:
    r = await _two_departments(IgnoresFilters())
    res = await search(r.kb, r.store, "q", caller=Caller(department="sales", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in res.items] == [SWEDEN]


# ---------- prompts ----------
def test_sales_managers_and_workers_carry_the_precedence_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Sales"), department_worker_rules("Sales")
    for text in (manager, worker):
        assert "Compliance first" in text and "Evidence second" in text and "House style third" in text
        assert "`domain` `compliance`" in text and "`entry_type` `policy`" in text
        assert "never use his name, likeness or catchphrases with customers" in text
        assert "brand's own voice" in text and "performance figures" in text
        assert "needs_verification" in text and "[GAP]" in text
        assert "written acceptance" in text or "written acceptance" in manager
    assert "multi-stakeholder" in manager and "hesitant" in manager


# ---------- retrieval ----------
def test_the_sales_retrieval_evaluation() -> None:
    k, questions = load_eval("sales")
    assert k == 5 and len(questions) >= 20
    assert all(i in SALES for q in questions for i in q["expect"])
    r = offline_eval(SEEDS, "sales")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
