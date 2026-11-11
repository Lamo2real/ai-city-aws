"""The media department's built-in knowledge (decision 233): one document per numbered section of the media
research, seeded, scoped and replaced exactly like marketing's, sales' and application's (docs/KNOWLEDGE.md §17). No AWS."""

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
SOURCE = seed_root().parent / "source" / "media-research.md"
MEDIA = {i: e for i, e in SEEDS.entries.items() if e.department == "media"}
MKT = "marketing.seo.local-seo"
APPSEC = "application.security.application-security"
SPECS = "media.specs.platform-specs-and-safe-zones"
DISCLOSURE = "media.compliance.disclosure-and-labelling"
HOUSE = "media.house-style.hormozi-content-system"
GUARDRAILS = "media.guardrails.agent-guardrails"
GAPS = "media.gaps.consolidated-gaps"
LEGAL = {
    DISCLOSURE,
    "media.compliance.copyright-ai-output-and-vendor-terms",
    "media.compliance.licensing-non-ai-assets",
    "media.compliance.likeness-and-voice",
    "media.compliance.trade-marks-products-and-locations",
    "media.compliance.swedish-media-law",
}


# ---------- the documents ----------
def test_the_source_is_kept_unchanged() -> None:
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert digest == "f8053f26eaded9d25d0ffd6797dbc8aa6407c75fb41f8fa1ddbdee278547cf36"
    text = SOURCE.read_text(encoding="utf-8")
    assert len(text.split()) == 28866 and re.findall(r"(?m)^## .*$", text)[-1] == "## Conclusion"


def test_one_document_per_numbered_section_with_the_text_verbatim() -> None:
    src = SOURCE.read_text(encoding="utf-8")
    assert re.findall(r"(?m)^## (\d+)\. ", src) == [str(n) for n in range(1, 26)]
    assert len(MEDIA) == 26  # 25 sections plus "About this knowledge base"
    for e in MEDIA.values():
        body = e.body.split("\n\n", 2)[2]  # after "When to use this" and the source-section line
        # About joins the opening summary and the reading guide; section 25 carries the conclusion.
        for piece in re.split(r"\n\n## (?:Conclusion|How to read and split this document)\n\n", body):
            assert piece.strip() and piece.strip() in src, e.id
    # Every heading and every labelled paragraph or table row of the source lands in a document.
    for line in src.splitlines():
        if line.startswith(("### ", "**[", "| ")):
            assert sum(line in e.body for e in MEDIA.values()) >= 1, line[:80]
    about = MEDIA["media.overview.about-this-knowledge-base"]
    assert about.title == "Media: About this knowledge base" and "**[HOUSE STYLE]** marks" in about.body
    assert "## Conclusion" in MEDIA[GAPS].body and MEDIA[GAPS].body.count("**[GAP]**") == 14
    assert MEDIA[SPECS].title == "Media: Platform specs and safe zones (dated)"


def test_house_style_legal_and_guardrail_documents_are_their_own_types() -> None:
    assert {i for i, e in MEDIA.items() if e.type == "policy"} == LEGAL
    assert {i for i, e in MEDIA.items() if e.domain == "compliance"} == LEGAL
    assert {i for i, e in MEDIA.items() if e.type == "checklist"} == {GUARDRAILS}
    assert {i for i, e in MEDIA.items() if e.type == "house-style"} == {HOUSE}
    assert MEDIA[HOUSE].confidence == "house-style" and MEDIA[HOUSE].body.count("**[HOUSE STYLE")
    for dated in (SPECS, "media.generative-tools.tool-landscape-november-2026"):
        assert MEDIA[dated].volatility == "fast-moving" and MEDIA[dated].review_by <= "2027-03-01"
    assert "**[FAST-MOVING, Nov 2026]**" in MEDIA["media.generative-tools.tool-landscape-november-2026"].body
    assert all(e.sources for e in MEDIA.values() if e.domain not in ("overview",))


def test_section_references_point_to_the_documents_that_hold_them() -> None:
    refs = dict(MEDIA[GUARDRAILS].cross_refs)
    assert refs["20"] == ("media.compliance.likeness-and-voice",)
    assert "section 20 → media.compliance" in index_parts(MEDIA[GUARDRAILS], "Media")[0]
    assert {"c2pa", "synthid", "ai-act-50"} <= set(mentioned_concepts(MEDIA[DISCLOSURE], SEEDS.taxonomies["media"]))


# ---------- seeding ----------
async def test_seeding_the_media_documents_twice_changes_nothing_the_second_time() -> None:
    r = rig()
    first = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert first.ok
    assert len([u for u in r.kb.docs if "/builtin/media/" in u]) > len(MEDIA)
    docs, calls, edges, blobs = dict(r.kb.docs), len(r.kb.ingest_calls), set(r.graph.edges), dict(r.blobs.objects)
    second = await run_seed(SEEDS, r.registry, r.projector, MODEL)
    assert second.ok and second.changed() == [] and second.counts() == {"skip": len(SEEDS.entries)}
    assert r.kb.docs == docs and len(r.kb.ingest_calls) == calls and r.graph.edges == edges
    assert r.blobs.objects == blobs
    rec = await r.registry.get(GUARDRAILS) or {}
    assert rec["department"] == "media" and rec["builtin"] and rec["origin"] == "system"


async def test_replacing_a_document_leaves_only_the_new_version_in_the_index_and_graph() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DISCLOSURE))
    await run_seed(small(DISCLOSURE), r.registry, r.projector, MODEL)
    await settled(r)
    before = {u for u in r.kb.docs if f"/{DISCLOSURE}/" in u}
    kid = f"kn-{DISCLOSURE}"
    assert ("MENTIONS", kid, "media/concept/likeness") in r.graph.edges
    await s.update(
        DISCLOSURE, {"content": "## Short version\n\nLabel realistic AI video at first exposure (Article 50)."}
    )
    await settled(r)  # the new version is indexed: the switch, then the old parts and graph edges go (decision 235)
    after = {u for u in r.kb.docs if f"/{DISCLOSURE}/" in u}
    assert len(after) == 2 and len(before) > 2 and all("/v2/" in u for u in after)
    assert not [
        k for k in r.blobs.objects if f"/{DISCLOSURE}/" in k and k.split("/")[-1].split(".")[0] not in ("0", "1")
    ]
    mentions = {e for e in r.graph.edges if e[0] == "MENTIONS" and e[1] == kid}
    assert ("MENTIONS", kid, "media/concept/ai-act-50") in mentions
    assert ("MENTIONS", kid, "media/concept/likeness") not in mentions
    rec = await r.registry.get(DISCLOSURE) or {}
    assert rec["user_modified"] and "Short version" in rec["content"]


async def test_an_edited_or_deleted_document_survives_a_redeploy() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DISCLOSURE, SPECS))
    await run_seed(small(DISCLOSURE, SPECS), r.registry, r.projector, MODEL)
    await s.update(DISCLOSURE, {"summary": "The owner's own words."})
    await s.delete(SPECS)
    newer = {DISCLOSURE: {"summary": "Shipped later."}, SPECS: {"title": "Media: Platform specs, newer"}}
    for changes in (None, newer):
        rep = await run_seed(small(DISCLOSURE, SPECS, changes=changes), r.registry, r.projector, MODEL)
        assert rep.ok
        kept = await r.registry.get(DISCLOSURE) or {}
        assert kept["summary"] == "The owner's own words." and kept["user_modified"]
        gone = await r.registry.get(SPECS) or {}
        assert gone["deleted"] and gone["status"] == "deleted" and not [u for u in r.kb.docs if f"/{SPECS}/" in u]
    assert (await r.registry.get(DISCLOSURE) or {})["newer_default"]["summary"] == "Shipped later."


async def test_a_failed_re_index_leaves_the_old_version_active() -> None:
    r = rig()
    s = EntryService(r.registry, r.projector, seeds=lambda: small(DISCLOSURE))
    await run_seed(small(DISCLOSURE), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["media"])
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(DISCLOSURE)
    rec = await r.registry.get(DISCLOSURE) or {}
    # The new version failed; agents keep reading the old one (decision 235).
    assert rec["status"] == "failed" and rec["active"]["version"] == 1


# ---------- isolation ----------
async def _three_departments(kb: FakeKnowledgeBase):  # type: ignore[no-untyped-def]
    r = rig()
    r.kb = kb
    r.projector = EntryProjector(r.blobs, kb, r.graph, sleep=_no_sleep)
    await run_seed(small(MKT, APPSEC, DISCLOSURE, GUARDRAILS, HOUSE), r.registry, r.projector, MODEL)
    for u in kb.status:
        kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", "application", "media"])
    kb.hits = [
        Hit(f"kn-{MKT}", "local pack", 0.95, "relevant", attributes={"department": "marketing"}),
        Hit(f"kn-{APPSEC}", "OWASP Top 10", 0.9, "relevant", attributes={"department": "application"}),
        Hit(f"kn-{DISCLOSURE}", "Article 50", 0.8, "relevant", attributes={"department": "media"}),
        Hit(f"kn-{GUARDRAILS}", "human approval", 0.7, "relevant", attributes={"department": "media"}),
        Hit(f"kn-{HOUSE}", "hook-retain-reward", 0.6, "relevant", attributes={"department": "media"}),
    ]
    return r


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_media_and_other_departments_never_retrieve_each_others_documents(
    kb_class: type[FakeKnowledgeBase],
) -> None:
    r = await _three_departments(kb_class())
    for role in ("manager", "worker"):
        media = await search(
            r.kb, r.store, "q", caller=Caller(department="media", role=role, audience="all", related=False)
        )
        assert [i["entry_id"] for i, _ in media.items] == [DISCLOSURE, GUARDRAILS, HOUSE]
        for dept, own in (("marketing", MKT), ("application", APPSEC)):
            other = await search(
                r.kb, r.store, "q", caller=Caller(department=dept, role=role, audience="all", related=False)
            )
            assert [i["entry_id"] for i, _ in other.items] == [own]
    for nobody in (Caller(role="vaic"), Caller(department="sales", role="worker"), None):
        assert (await search(r.kb, r.store, "q", caller=nobody)).items == []


async def test_legal_guardrail_and_house_style_documents_come_back_on_their_own_type() -> None:
    r = await _three_departments(IgnoresFilters())
    for entry_type, want in (("policy", DISCLOSURE), ("checklist", GUARDRAILS), ("house-style", HOUSE)):
        got = await search(r.kb, r.store, "q", caller=Caller(department="media", role="worker", entry_type=entry_type))
        assert [i["entry_id"] for i, _ in got.items] == [want]


# ---------- prompts ----------
def test_media_managers_and_workers_carry_the_knowledge_rules() -> None:
    from vaic.runtime.prompts import department_template, department_worker_rules

    manager, worker = department_template("Media"), department_worker_rules("Media")
    for text in (manager, worker):
        assert "search_knowledge" in text and "rights and disclosure first" in text.lower()
        assert "evidence and official platform guidance second" in text.lower() and "house style third" in text.lower()
        assert (
            "`entry_type` `policy`" in text and "`entry_type` `checklist`" in text and "`domain` `house-style`" in text
        )
        assert "Never imitate Alex Hormozi" in text and "catchphrases" in text and "performance figures" in text
        assert "Guardrails for the department's AI agents" in text and "is advice" in text  # decision 240
        assert "cloned voice" in text and "disclosure decision" in text and "paid" in text and "licensed" in text
        assert "second check" in text
        assert "needs_verification" in text and "[GAP]" in text and "[FAST-MOVING" in text
        assert "never final legal, tax or accounting advice" in text
        assert "Handoffs between Media and the other departments" in text
        assert "decision 240" in text


# ---------- retrieval ----------
def test_the_media_retrieval_evaluation() -> None:
    k, questions = load_eval("media")
    assert k == 5 and len(questions) >= 15
    assert all(i in MEDIA for q in questions for i in q["expect"])
    assert any(q["expect"] == [GAPS] for q in questions)  # a question the knowledge base marks as a gap
    r = offline_eval(SEEDS, "media")
    print(json.dumps(r.as_json()))
    assert r.hit_rate >= 0.9, r.misses
