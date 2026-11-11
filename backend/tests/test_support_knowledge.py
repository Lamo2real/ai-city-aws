"""The customer support department's built-in knowledge (decision 229): one document per section of the customer
support research, seeded, scoped and replaced exactly like marketing's and sales' (docs/KNOWLEDGE.md §17). No AWS."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entries import canonical_department, index_parts, mentioned_concepts, seed_root
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.evaluation import bm25_rank, load_eval, offline_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

MODEL = "embed-model-1"
SOURCE = seed_root().parent / "source" / "customer-support-research.md"
SUPPORT = {i: e for i, e in SEEDS.entries.items() if e.department == "support"}
MKT = "marketing.seo.local-seo"
SALES = "sales.house-style.closer-framework"
CANCEL = "support.house-style.cancellation-saves-and-exit-interviews"
CONSUMER = "support.compliance.swedish-and-eu-consumer-law"
SELF_HARM = "support.compliance.vulnerable-customers-self-harm-threats"
GUARDRAILS = "support.agent-guardrails.ai-agent-guardrails"
LEGAL = {
    CONSUMER,
    "support.compliance.b2b-support-obligations",
    "support.compliance.gdpr-in-support",
    "support.compliance.accessibility-and-language",
    "support.compliance.ai-disclosure-and-liability",
    SELF_HARM,
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "b1be7dc33a9e18dcc29a7ab4fa5625d0b4a0a2e0eecd441e6f81269f4acba43e"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 24_499 and re.findall(r"(?m)^## .+$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 30)]
    assert len(SUPPORT) == 30  # 29 sections plus "About this knowledge base"
    for e in SUPPORT.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source line
        for piece in body.split("\n\n## Conclusion"):  # section 29 keeps the conclusion
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph of the source lands in a document, labels and links unchanged.
    every = "\n".join(e.body for e in SUPPORT.values())
    for line in src.splitlines():
        if line.startswith("### ") or line.startswith("["):
            assert line in every, line[:80]
    about = SUPPORT["support.overview.about-this-knowledge-base"]
    assert about.title == "Customer support: About this knowledge base" and "## How to read and split" in about.body
    gaps = SUPPORT["support.gaps.consolidated-gaps"]
    assert "## Conclusion" in gaps.body and gaps.body.count("[GAP]") == 6
    assert all(e.title.startswith("Customer support: ") for e in SUPPORT.values())


def test_types_confidence_and_legal_and_guardrails_as_their_own_types() -> None:
    house = {i for i, e in SUPPORT.items() if e.domain == "house-style"}
    assert len(house) == 8  # sections 2 to 9
    assert all(SUPPORT[i].type == "house-style" and SUPPORT[i].confidence == "house-style" for i in house)
    assert {i for i, e in SUPPORT.items() if e.domain == "compliance"} == LEGAL
    assert {i for i, e in SUPPORT.items() if e.type == "policy"} == LEGAL | {GUARDRAILS}
    assert SUPPORT[GUARDRAILS].domain == "agent-guardrails"
    assert SUPPORT["support.precedence.compliance-evidence-house-style"].confidence == "contested"
    assert SUPPORT[SELF_HARM].volatility == "fast-moving" and SUPPORT[SELF_HARM].review_by <= "2027-03-01"
    assert all(
        e.sources for e in SUPPORT.values() if e.domain not in ("overview", "gaps", "agent-guardrails", "handoffs")
    )
    assert SEEDS.taxonomies["support"].label == "Customer support"


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    e = SUPPORT["support.precedence.compliance-evidence-house-style"]
    assert dict(e.cross_refs)["21"] == (CONSUMER,)
    assert "section 21 → support.compliance" in index_parts(e, "Customer support")[0]
    assert dict(SUPPORT[GUARDRAILS].cross_refs)["26"] == (SELF_HARM,)
    assert mentioned_concepts(SUPPORT[SELF_HARM], SEEDS.taxonomies["support"])


# ---------- seeding ----------
async def test_seeding_the_support_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/support/" in u]) > len(SUPPORT)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(CONSUMER) or {}
    assert rec["department"] == "support" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_support_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(CANCEL))
    await run_seed(small(CANCEL), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{CANCEL}/" in u}
    kid = f"kn-{CANCEL}"
    assert ("MENTIONS", kid, "support/concept/exit-conversation") in r.graph.edges
    old_mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    await s.update(CANCEL, {"content": "## Short version\n\nProcess the request in the channel it came in."})
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{CANCEL}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [k for k in r.blobs.objects if f"/{CANCEL}/" in k and "/v2/" not in k]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    # Only what the title, summary and new text mention is left (the summary is unchanged here).
    assert mentions < old_mentions and ("MENTIONS", kid, "support/concept/withdrawal-right") in old_mentions - mentions
    assert ("KnowledgeEntry", kid) in r.graph.vertices
    rec = await r.registry.get(CANCEL) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_support_document_survives_a_redeploy() -> None:
    r = rig()
    seeds = small(CANCEL, CONSUMER)
    s = EntryService(r.registry, r.projector, seeds=lambda: seeds)
    await run_seed(seeds, r.registry, r.projector, MODEL)
    await s.update(CANCEL, {"summary": "The owner's own words."})
    await s.delete(CONSUMER)
    for changes in (None, {CANCEL: {"title": "Shipped later"}, CONSUMER: {"title": "Shipped later"}}):
        rep = await run_seed(small(CANCEL, CONSUMER, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        edited, deleted = await r.registry.get(CANCEL) or {}, await r.registry.get(CONSUMER) or {}
        assert edited["summary"] == "The owner's own words." and edited["user_modified"]
        assert deleted["deleted"] and not [u for u in r.kb.docs if f"/{CONSUMER}/" in u]


async def test_a_failed_index_is_recorded_on_the_document() -> None:
    r = rig()
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    rep = await run_seed(small(SELF_HARM), r.registry, r.projector, MODEL)
    assert not rep.ok
    rec = await r.registry.get(SELF_HARM) or {}
    assert rec["sync"] == "failed"


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(SELF_HARM))
    await run_seed(small(SELF_HARM), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["support"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(SELF_HARM)
    rec = await r.registry.get(SELF_HARM) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, SALES, CANCEL, SELF_HARM), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "sales", "support"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.9, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{SALES}", "clarify why they are there", 0.85, "relevant", attributes={"department": "sales"}),
        Hit(f"kn-{CANCEL}", "exit conversation", 0.8, "relevant", attributes={"department": "support"}),
        Hit(f"kn-{SELF_HARM}", "hand over to a trained human", 0.7, "relevant", attributes={"department": "support"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_support_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):

        async def ids(dept: str, role: str = role) -> list[str]:
            c = Caller(department=dept, role=role, audience="all", related=False)
            return [i["entry_id"] for i, _ in (await search(r.kb, r.store, "q", caller=c)).items]

        assert await ids("support") == [CANCEL, SELF_HARM]
        assert await ids("sales") == [SALES]
        assert await ids("marketing") == [MKT]
        assert await ids(canonical_department("Customer Support")) == [CANCEL, SELF_HARM]  # as the tool does
    for nobody in (Caller(role="vaic"), Caller(department="finance", role="manager"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_and_guardrail_documents_come_back_on_their_own_type() -> None:
    r = await _three_departments(IgnoresFilters())
    res = await search(r.kb, r.store, "q", caller=Caller(department="support", role="worker", entry_type="policy"))
    assert [i["entry_id"] for i, _ in res.items] == [SELF_HARM]
    res = await search(r.kb, r.store, "q", caller=Caller(department="support", role="worker", domain="house-style"))
    assert [i["entry_id"] for i, _ in res.items] == [CANCEL]


# ---------- prompts ----------
def test_support_managers_and_workers_carry_the_precedence_and_guardrails() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Customer Support"), department_worker_rules("Customer Support")
    for text in (manager, worker):
        assert "Compliance first" in text and "Evidence second" in text and "House style third" in text
        assert "`domain` `compliance`" in text and "`entry_type` `policy`" in text
        assert "never use his name, likeness or catchphrases with customers" in text
        assert "brand's own voice" in text and "performance figures" in text
        assert "needs_verification" in text and "[GAP]" in text
        assert "Guardrails for the department's AI agents" in text and "ask_owner" in text
        assert "self-harm" in text and "112" in text and "90101" in text and "do not counsel" in text
        assert "orientation for a human to confirm" in text and "legal, tax or accounting advice" in text
        assert "Handoffs between Customer support and the other departments" in text
        assert "any refund" in text and "legal threat" in text


# ---------- retrieval ----------
def test_the_support_retrieval_evaluation() -> None:
    k, questions = load_eval("support")
    assert k == 5 and len(questions) >= 15
    assert all(i in SUPPORT for q in questions for i in q["expect"])
    r = offline_eval(SEEDS, "support")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses


def test_a_self_harm_disclosure_finds_the_hand_over_to_a_human_first() -> None:
    entries = list(SUPPORT.values())
    top = bm25_rank(
        "A customer wrote that they are thinking about suicide and want to end their life.", entries, "Customer support"
    )
    assert top[0] == SELF_HARM
    assert "hands over to a trained human at once" in SUPPORT[SELF_HARM].body
    assert "It does not attempt counselling" in SUPPORT[SELF_HARM].body
