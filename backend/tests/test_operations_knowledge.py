"""The operations department's built-in knowledge (decision 234): one document per numbered section of the
operations research (section 2, the house style, in two parts), seeded, scoped and replaced exactly like marketing's,
sales' and application's (docs/KNOWLEDGE.md §17). No AWS."""

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
SOURCE = seed_root().parent / "source" / "operations-research.md"
OPS = {i: e for i, e in SEEDS.entries.items() if e.department == "operations"}
APP = "application.security.application-security"
HIRING = "operations.hiring.hiring"
WORK_ENV = "operations.compliance.swedish-work-environment-law"
GUARDRAILS = "operations.guardrails.agent-guardrails"
GAPS = "operations.gaps.consolidated-gaps"
HOUSE = {
    "operations.house-style.scaling-roadmap-constraint-and-management",
    "operations.house-style.training-delegation-hiring-culture-and-performance",
}
LEGAL = {
    "operations.compliance.swedish-employment-framework",
    WORK_ENV,
    "operations.compliance.employee-data-and-monitoring",
    "operations.compliance.ai-in-people-decisions",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "67856611569e4edac6c4dbabe9b8a13b2f2fd050adf96d0f92d7a2f2f7f20748"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 28160 and re.findall(r"(?m)^## .*$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 27)]
    assert len(OPS) == 28  # 26 sections (section 2 in two parts) plus "About this knowledge base"
    for e in OPS.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # About joins the opening summary and the reading guide; section 26 carries the conclusion.
        for piece in re.split(r"\n\n## (?:Conclusion|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in exactly one document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")) and not re.fullmatch(r"\|[-| ]+\|", line):
            assert sum(line in e.body.splitlines() for e in OPS.values()) == 1, line[:80]
    about = OPS["operations.overview.about-this-knowledge-base"]
    assert about.title == "Operations: About this knowledge base" and "**[GAP]** marks" in about.body
    assert "## Conclusion" in OPS[GAPS].body and "| House style: roadmap |" in OPS[GAPS].body
    # Section 2 is longer than one document may be: two parts, cut at a sub-heading, nothing lost.
    first, second = (OPS[i] for i in sorted(HOUSE))
    assert "(part 1 of 2)" in first.body and "(part 2 of 2)" in second.body
    s2 = src.split("## 2. ", 1)[1].split("\n## 3. ", 1)[0].split("\n", 1)[1].strip()
    assert first.body.split("\n\n", 2)[2].strip() + "\n\n" + second.body.split("\n\n", 2)[2].strip() == s2


def test_house_style_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in OPS.items() if e.type == "house-style"} == HOUSE
    assert {i for i, e in OPS.items() if e.confidence == "house-style"} == HOUSE
    assert {i for i, e in OPS.items() if e.type == "policy"} == LEGAL
    assert {i for i, e in OPS.items() if e.domain == "compliance"} == LEGAL
    assert {i for i, e in OPS.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in OPS.items() if e.domain == "guardrails"} == {GUARDRAILS}
    ai = OPS["operations.compliance.ai-in-people-decisions"]
    assert ai.volatility == "fast-moving" and ai.review_by <= "2027-03-01"
    assert "**[FAST-MOVING, 27 Jul 2026]** Legal status: application dates read on the consolidated text" in ai.body
    # The reading guide, the handoffs table and the gaps cite no links; every other document keeps its sources.
    assert {i for i, e in OPS.items() if not e.sources} == {
        "operations.overview.about-this-knowledge-base",
        "operations.handoffs.handoffs-to-other-departments",
        GAPS,
    }


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(OPS[GUARDRAILS].cross_refs)
    assert refs["3"] == ("operations.precedence.law-evidence-house-style",)
    assert refs["12"] == ("operations.ai-operations.operating-a-company-with-ai-agents",)
    assert "section 3 → operations.precedence" in index_parts(OPS[GUARDRAILS], "Operations")[0]
    # "section 2" points to both house-style parts; "sections 13 to 23" is a range; "section 4.6.6" of PMBOK is not ours.
    overview = dict(OPS["operations.overview.overview"].cross_refs)
    assert set(overview["2"]) == HOUSE and "18" in overview and "4" in overview
    assert "4" not in dict(OPS["operations.rhythm.operating-rhythm-and-decision-rights"].cross_refs)
    assert {"las", "mbl"} <= set(
        mentioned_concepts(OPS["operations.offboarding.offboarding"], SEEDS.taxonomies["operations"])
    )


# ---------- seeding ----------
async def test_seeding_the_operations_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/operations/" in u]) > len(OPS)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "operations" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(HIRING))
    await run_seed(small(HIRING), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{HIRING}/" in u}
    kid = f"kn-{HIRING}"
    assert ("MENTIONS", kid, "operations/concept/imy") in r.graph.edges
    await s.update(HIRING, {"content": "## Short version\n\nEvery hire gets a role scorecard and a human decides."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{HIRING}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{HIRING}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "operations/concept/scorecard") in mentions
    assert ("MENTIONS", kid, "operations/concept/imy") not in mentions
    rec = await r.registry.get(HIRING) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(HIRING, WORK_ENV))
    await run_seed(small(HIRING, WORK_ENV), r.registry, r.projector, MODEL)
    await s.update(HIRING, {"summary": "The owner's own words."})
    await s.delete(WORK_ENV)
    newer = {HIRING: {"summary": "Shipped later."}, WORK_ENV: {"title": "Operations: Work environment, newer"}}
    for changes in (None, newer):
        rep = await run_seed(small(HIRING, WORK_ENV, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        kept = await r.registry.get(HIRING) or {}
        assert kept["summary"] == "The owner's own words." and kept["user_modified"]
        gone = await r.registry.get(WORK_ENV) or {}
        assert gone["deleted"] and gone["status"] == "deleted" and not [u for u in r.kb.docs if f"/{WORK_ENV}/" in u]
    assert (await r.registry.get(HIRING) or {})["newer_default"]["summary"] == "Shipped later."


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(HIRING))
    await run_seed(small(HIRING), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["operations"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(HIRING)
    rec = await r.registry.get(HIRING) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _two_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(APP, HIRING, WORK_ENV, GUARDRAILS), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["application", "operations"])
    kb.hits = [
        Hit(f"kn-{APP}", "OWASP Top 10", 0.9, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{HIRING}", "structured interviews", 0.8, "relevant", attributes={"department": "operations"}),
        Hit(f"kn-{WORK_ENV}", "safety representative", 0.7, "relevant", attributes={"department": "operations"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.6, "relevant", attributes={"department": "operations"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_operations_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _two_departments(kb_class())
    for role in ("manager", "worker"):
        ops = await search(
            r.kb, r.store, "q", caller=Caller(department="operations", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in ops.items] == [HIRING, WORK_ENV, GUARDRAILS]
        app = await search(
            r.kb, r.store, "q", caller=Caller(department="application", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in app.items] == [APP]
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_and_guardrail_documents_come_back_on_their_own_type() -> None:
    r = await _two_departments(IgnoresFilters())
    legal = await search(r.kb, r.store, "q", caller=Caller(department="operations", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in legal.items] == [WORK_ENV]
    rails = await search(
        r.kb, r.store, "q", caller=Caller(department="operations", role="manager", entry_type="checklist")
    )
    assert [i["entry_id"] for i, _ in rails.items] == [GUARDRAILS]


# ---------- prompts ----------
def test_operations_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Operations"), department_worker_rules("Operations")
    for text in (manager, worker):
        assert "search_knowledge" in text and "law first, evidence second, house style third" in text
        assert "`entry_type` `policy`" in text and "`entry_type` `checklist`" in text
        assert "house style by default" in text.lower() and "brand's own voice" in text
        assert "Never imitate Alex Hormozi or Leila Hormozi" in text and "his or her name" in text
        assert "Guardrails for the department's AI agents" in text and "ask_owner" in text
        for gated in ("offers", "pay, benefits or working hours", "monitoring", "made or influenced by AI"):
            assert gated in text, gated
        assert "dismissal or redundancy selection" in text and "vendor or contractor" in text
        assert "needs_verification" in text and "[GAP]" in text and "[FAST-MOVING" in text
        assert "never final legal, tax or accounting advice" in text
        assert "Handing work to and receiving work from other departments" in text
        assert "not a human approval" in text


# ---------- retrieval ----------
def test_the_operations_retrieval_evaluation() -> None:
    k, questions = load_eval("operations")
    assert k == 5 and len(questions) >= 15
    assert all(i in OPS for q in questions for i in q["expect"])
    assert any(q["expect"] == [GAPS] for q in questions)  # a question the knowledge base marks as a gap
    asked = " ".join(q["q"] for q in questions).lower()
    for topic in ("hiring process", "first week", "las", "safety representative", "saas vendor", "weekly meeting"):
        assert topic in asked, topic
    r = offline_eval(SEEDS, "operations")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
