"""VAIC and the Orchestrator read every department's knowledge base (the owner's rule, decision 253): every
department's entries, the shared documents and the owner's own items, by vector search and graph expansion alike,
optionally narrowed to one department. Departments stay isolated from each other. No AWS."""

from __future__ import annotations

import json

import pytest

from knowledge_support import ready_item, world
from test_knowledge_api_tools import city, ctx
from test_knowledge_entries import SEEDS, IgnoresFilters, rig, small
from test_shared_knowledge import GUARDRAILS, INFRA, MAP, MKT, MODEL, ROUTING, SALES, _with_shared
from vaic.runtime.prompts import load_prompt
from vaic.runtime.tools import gate_tools, tools_for
from vaic.shared.knowledge.entries import SHARED, all_departments
from vaic.shared.knowledge.evaluation import bm25_rank, load_eval
from vaic.shared.knowledge.kb import FakeKnowledgeBase, Hit
from vaic.shared.knowledge.search import Caller, caller_filter, entry_visible, search
from vaic.shared.knowledge.seeder import refresh_status, run_seed

EVERYTHING = [ROUTING, MKT, SALES, INFRA, GUARDRAILS]


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
@pytest.mark.parametrize("role", ["vaic", "orchestrator"])
async def test_vaic_and_the_orchestrator_see_every_department_and_shared(
    kb_class: type[FakeKnowledgeBase], role: str
) -> None:
    r = await _with_shared(kb_class())
    res = await search(r.kb, r.store, "q", max_results=10, caller=Caller(role=role, related=False))
    assert [i["entry_id"] for i, _ in res.items] == EVERYTHING
    # Each entry says which knowledge base it came from, so VAIC can say where an answer is from.
    text = res.text()
    assert 'from="Marketing knowledge base"' in text and 'from="Sales knowledge base"' in text
    assert 'from="IT infrastructure knowledge base"' in text and 'from="Shared knowledge base"' in text


@pytest.mark.parametrize("kb_class", [FakeKnowledgeBase, IgnoresFilters])
async def test_the_department_filter_narrows_vaic_to_one_knowledge_base(kb_class: type[FakeKnowledgeBase]) -> None:
    r = await _with_shared(kb_class())
    for dept, want in (("marketing", [MKT]), ("sales", [SALES]), (SHARED, [ROUTING, GUARDRAILS])):
        who = Caller(department=dept, role="vaic", related=False)
        assert [i["entry_id"] for i, _ in (await search(r.kb, r.store, "q", 10, caller=who)).items] == want


async def test_departments_stay_isolated_from_each_other() -> None:
    r = await _with_shared(FakeKnowledgeBase())
    for me, other in (("marketing", SALES), ("sales", MKT)):
        who = Caller(department=me, role="manager", audience="all", related=False)
        got = [i["entry_id"] for i, _ in (await search(r.kb, r.store, "q", 10, caller=who)).items]
        assert other not in got and ROUTING in got
    # A department caller can't widen itself: the role decides, never the department name.
    entry = {"entry_id": "x.y.z", "audience": "both", "department": "sales"}
    assert not entry_visible(entry, Caller(department="marketing", role="manager"))
    assert not entry_visible(entry, Caller(department="marketing", role="worker"))
    assert not entry_visible(entry, Caller(role="executive"))
    for d in [*all_departments(), SHARED]:
        assert entry_visible({**entry, "department": d}, Caller(role="vaic"))
        assert entry_visible({**entry, "department": d}, Caller(role="orchestrator"))
        assert entry_visible({**entry, "department": d}, Caller(department=d, role="vaic"))
        assert not entry_visible({**entry, "department": d}, Caller(department="nowhere", role="vaic"))
    # The owner's own items: everything for VAIC; a department filter means department entries only.
    assert entry_visible({"id": "k-1"}, Caller(role="vaic"))
    assert not entry_visible({"id": "k-1"}, Caller(department="marketing", role="vaic"))


def test_the_index_filter_for_vaic() -> None:
    assert caller_filter(Caller(role="vaic")) is None  # every department, shared and the owner's items
    assert caller_filter(Caller(role="orchestrator")) is None
    f = caller_filter(Caller(department="marketing", role="vaic"))
    assert f == {"equals": {"key": "department", "value": "marketing"}}
    f2 = json.dumps(caller_filter(Caller(role="executive")))
    assert '"marketing"' in f2 and '"shared"' in f2  # the executives: still no department knowledge


async def test_vaic_gets_the_graph_neighbours_of_any_department_s_hit() -> None:
    r = rig()
    await run_seed(small(ROUTING, GUARDRAILS, MAP, MKT), r.registry, r.projector, MODEL)
    for u in r.kb.status:
        r.kb.status[u] = "INDEXED"
    await refresh_status(r.registry, r.projector, ["marketing", SHARED])
    r.kb.hits = [Hit(f"kn-{ROUTING}", "template", 0.9, "relevant", attributes={"department": SHARED})]
    res = await search(r.kb, r.store, "handoff", caller=Caller(role="vaic"))
    assert [i["entry_id"] for i, _ in res.items] == [ROUTING]
    assert {i["entry_id"] for i in res.related_items} == {MAP, GUARDRAILS}


# ---------- the tool ----------
async def test_vaic_s_tool_searches_everything_or_one_department() -> None:
    w = world()
    a = await ready_item(w, "Plan")
    w.kb.hits = [Hit(a["id"], "the plan", 0.9, "relevant")]
    d = city(w)
    for role in ("vaic", "orchestrator"):
        tools = {t.name: t for t in gate_tools(d, ctx(role), tools_for(d, ctx(role)))}
        t = tools["search_knowledge"]
        w.kb.calls.clear()
        assert f'item="{a["id"]}"' in await t.handler({"query": f"plan for {role}"})
        assert '"department"' not in json.dumps(w.kb.calls)  # no department filter at all
        w.kb.calls.clear()
        await t.handler({"query": f"meta ads for {role}", "department": "Marketing"})
        first = json.dumps(w.kb.calls[0])
        assert '"equals": {"key": "department", "value": "marketing"}' in first
        out = await t.handler({"query": "plan", "department": "knitting"})
        assert out.startswith("There is no knitting knowledge base.") and "marketing" in out
    # A worker can't name another department: its own department always decides.
    worker = {t.name: t for t in tools_for(d, ctx("worker"))}["search_knowledge"]
    n = len(w.kb.calls)
    await worker.handler({"query": "plan", "department": "sales"})
    assert '"sales"' in json.dumps(w.kb.calls[n:])  # in the notIn list: Eng's worker sees no Sales entries
    assert '"equals": {"key": "department"' not in json.dumps(w.kb.calls[n:])


# ---------- retrieval: one VAIC question per department, over every knowledge base at once ----------
@pytest.mark.parametrize("dept", sorted(SEEDS.taxonomies))
def test_a_vaic_question_finds_the_right_department_s_document_among_all(dept: str) -> None:
    k, questions = load_eval(dept)
    pool = list(SEEDS.entries.values())
    hits = sum(bool(set(bm25_rank(q["q"], pool, "x")[:k]) & set(q["expect"])) for q in questions)
    assert hits / len(questions) >= 0.85, (dept, hits, len(questions))


def test_the_hormozi_meta_ads_question_finds_the_marketing_playbook() -> None:
    pool = [e for e in SEEDS.entries.values() if e.department == "marketing"]  # department="marketing"
    top = bm25_rank("how does Alex Hormozi recommend running Meta ads", pool, "Marketing")[:5]
    assert top[0] == "marketing.house-style.hormozi-playbook"
    assert any(t.startswith("marketing.meta-ads.") for t in top)


# ---------- prompts ----------
def test_vaic_and_the_orchestrator_are_told_when_to_search_and_when_not() -> None:
    vaic = load_prompt("vaic.md")
    assert "search_knowledge" in vaic.tools
    for phrase in ("every department's knowledge base", "Never search", "largest ocean", "`department`", "marketing"):
        assert phrase in vaic.body, phrase
    assert "Never imitate them" in vaic.body and "Hormozi" in vaic.body
    orch = load_prompt("planner.md")
    assert "search_knowledge" in orch.tools
    assert "every department's knowledge base" in orch.body and "Never search for general knowledge" in orch.body
    assert "Never imitate Alex or Leila Hormozi" in orch.body
