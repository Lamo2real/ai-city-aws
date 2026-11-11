"""The IT infrastructure department's built-in knowledge (decision 226): one document per section of the IT
infrastructure research, seeded, scoped and replaced exactly like marketing's and sales' (docs/KNOWLEDGE.md §17).
No AWS."""

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
SOURCE = seed_root().parent / "source" / "it-infrastructure-research.md"
INFRA = {i: e for i, e in SEEDS.entries.items() if e.department == "infrastructure"}
MKT = "marketing.seo.local-seo"
SALES = "sales.house-style.closer-framework"
DR = "infrastructure.reliability.backup-and-disaster-recovery"
REG = "infrastructure.compliance.eu-and-swedish-regulation"
FRAMEWORKS = "infrastructure.compliance.security-frameworks-and-certifications"
GUARDRAILS = "infrastructure.guardrails.agent-guardrails"
GAPS = "infrastructure.gaps.consolidated-gaps"
ABOUT = "infrastructure.overview.about-this-knowledge-base"


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "6134cf230a70a2343eb1abfbde4a981b166d275153b8b362f992eb75cc38f5f5"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 27_346 and re.findall(r"(?m)^## .*", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 21)]
    assert len(INFRA) == 21  # 20 sections plus "About this knowledge base"
    for e in INFRA.values():
        assert e.title.startswith("IT infrastructure: ")
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source line
        # Section 20 carries the closing Conclusion; each piece is the source's text unchanged.
        for piece in body.split("\n\n## Conclusion"):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading, labelled paragraph and table row of the source lands in the documents exactly as often.
    for line in src.splitlines():
        if line.startswith(("## ", "### ", "**[", "| ")):
            assert sum(e.body.count(line) for e in INFRA.values()) == src.count(line), line[:80]
    assert "## How to read and split this document" in INFRA[ABOUT].body
    assert "## 20. Consolidated gaps" in INFRA[GAPS].body and "## Conclusion" in INFRA[GAPS].body


def test_types_and_the_compliance_and_guardrail_documents_are_filterable() -> None:
    assert {i for i, e in INFRA.items() if e.domain == "compliance"} == {REG, FRAMEWORKS}
    assert {i for i, e in INFRA.items() if e.domain == "guardrails"} == {GUARDRAILS}
    assert {i for i, e in INFRA.items() if e.type == "policy"} == {REG, FRAMEWORKS, GUARDRAILS}
    # The research has no [HOUSE STYLE] material, so nothing is house style.
    assert not [e for e in INFRA.values() if "house-style" in (e.type, e.confidence, e.domain)]
    assert INFRA[REG].volatility == "fast-moving" and INFRA[REG].review_by <= "2027-03-01"
    # The EKS 1.31 forced upgrade after 26 November 2026 makes that document due for review then.
    assert INFRA["infrastructure.compute.kubernetes-containers-serverless"].review_by == "2026-11-26"
    assert all(e.sources for e in INFRA.values() if e.domain not in ("overview", "gaps", "handoffs"))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    g = INFRA[GUARDRAILS]
    assert dict(g.cross_refs) == {
        "13": (REG,),
        "17": ("infrastructure.ai-agents.published-guidance-and-incidents",),
    }
    assert "section 13 → " + REG in index_parts(g, "IT infrastructure")[0]
    assert not INFRA[REG].cross_refs  # its "sections 1 to 3" are the Annex of Regulation 2024/2690
    assert mentioned_concepts(INFRA[REG], SEEDS.taxonomies["infrastructure"])


# ---------- seeding ----------
async def test_seeding_the_infrastructure_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/infrastructure/" in u]) > len(INFRA)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(REG) or {}
    assert rec["department"] == "infrastructure" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DR))
    await run_seed(small(DR), r.registry, r.projector, MODEL)
    before = {u for u in r.kb.docs if f"/{DR}/" in u}
    kid = f"kn-{DR}"
    assert ("MENTIONS", kid, "infrastructure/concept/vault-lock") in r.graph.edges
    await s.update(DR, {"content": "## Short version\n\nRestore from the locked vault in the recovery account."})
    after = {u for u in r.kb.docs if f"/{DR}/" in u}
    assert len(after) == 2 and len(before) > 2 and after < before
    part1 = next(v for k, v in r.blobs.objects.items() if k.endswith(f"/{DR}/1.md"))
    assert b"Short version" in (part1 if isinstance(part1, bytes) else part1[0])
    assert not [k for k in r.blobs.objects if f"/{DR}/" in k and k.split("/")[-1].split(".")[0] not in ("0", "1")]
    mentions = {e[2] for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert "infrastructure/concept/vault-lock" in mentions  # from the summary, which the new text keeps
    assert "infrastructure/concept/kiro" not in mentions and "infrastructure/concept/pocketos" not in mentions
    rec = await r.registry.get(DR) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DR, GAPS))
    await run_seed(small(DR, GAPS), r.registry, r.projector, MODEL)
    await s.update(DR, {"summary": "The owner's own recovery summary."})
    await s.delete(GAPS)
    changed = {DR: {"title": "IT infrastructure: newer"}, GAPS: {"title": "IT infrastructure: newer gaps"}}
    for changes in (None, changed):
        rep = await run_seed(small(DR, GAPS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        dr, gaps = await r.registry.get(DR) or {}, await r.registry.get(GAPS) or {}
        assert dr["summary"] == "The owner's own recovery summary." and dr["user_modified"]
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
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DR))
    await run_seed(small(DR), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["infrastructure"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(DR)
    rec = await r.registry.get(DR) or {}
    assert rec["status"] == "ready"
    r.kb.hits = [Hit(f"kn-{DR}", "vault lock", 0.8, "relevant", attributes={"department": "infrastructure"})]
    res = await search(r.kb, r.store, "q", caller=Caller(department="infrastructure", role="worker", related=False))
    assert [i["entry_id"] for i, _ in res.items] == [DR]


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SALES, DR, REG), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "infrastructure"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{SALES}", "clarify why they are there", 0.85, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{DR}", "vault lock", 0.8, "relevant", attributes={"department": "infrastructure"}),
        Hit(f"kn-{REG}", "30-minute rule", 0.7, "relevant", attributes={"department": "infrastructure"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_infrastructure_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        for dept, want in (("infrastructure", [DR, REG]), (canonical_department("IT Infrastructure"), [DR, REG]),
                           ("marketing", [MKT]), ("sales", [SALES])):  # fmt: skip
            who = Caller(department=dept, role=role, audience="all", related=False)
            res = await search(r.kb, r.store, "q", caller=who)
            assert [i["entry_id"] for i, _ in res.items] == want, (dept, role)
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="manager"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_compliance_documents_come_back_on_their_own_filter() -> None:
    r = await _three_departments(IgnoresFilters())
    for caller in (Caller(department="infrastructure", role="worker", entry_type="policy"),
                   Caller(department="infrastructure", role="worker", domain="compliance")):  # fmt: skip
        res = await search(r.kb, r.store, "q", caller=caller)
        assert [i["entry_id"] for i, _ in res.items] == [REG]


# ---------- prompts ----------
def test_infrastructure_managers_and_workers_carry_precedence_guardrails_and_gaps() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("IT Infrastructure"), department_worker_rules("IT Infrastructure")
    for text in (manager, worker):
        assert "search_knowledge" in text and " " in text and " " in text
        assert "Law and compliance first" in text and "Independent evidence second" in text
        assert "orientation for a human to confirm" in text and "legal, tax or accounting advice" in text
        assert "named human's recorded approval" in text and "Never" in text
        assert "IAM" in text and "network-perimeter" in text and "commitment" in text
        assert "needs_verification" in text and "[GAP]" in text and "Consolidated gaps" in text
        assert "Hand-offs between IT infrastructure and the other departments" in text
    assert "Nobody applies to the owner's production without the owner's yes" in manager


# ---------- retrieval ----------
def test_the_infrastructure_retrieval_evaluation() -> None:
    k, questions = load_eval("infrastructure")
    assert k == 5 and len(questions) >= 15
    assert all(f"infrastructure.{i}" in INFRA or i in INFRA for q in questions for i in q["expect"])
    r = offline_eval(SEEDS, "infrastructure")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
