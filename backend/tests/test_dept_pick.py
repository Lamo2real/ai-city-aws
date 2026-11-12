"""Departments for skills and knowledge (decision 266): the picker, the owner's words, and who sees what."""

from __future__ import annotations

import json
from typing import Any

import pytest

from knowledge_support import ready_item, world
from test_api import ev, js, make
from test_knowledge_api_tools import city
from vaic.lambdas.api import handle_http, vaic_call
from vaic.runtime.skills import for_agent
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared import dept_pick as dp
from vaic.shared.events import MemoryBus
from vaic.shared.knowledge.search import Caller, always_block, entry_visible

DEPTS = dp.choices([{"name": "Pizza Shop"}])
ALL_KEYS = [d.key for d in DEPTS]


# ---------- the owner's words ----------
@pytest.mark.parametrize(
    ("words", "want"),
    [
        ("all", dp.ALL),
        ("All departments", dp.ALL),
        ("Add for all departments", dp.ALL),
        ("all except Sales and Legal", [k for k in ALL_KEYS if k not in ("sales", "legal")]),
        ("all but media", [k for k in ALL_KEYS if k != "media"]),
        ("just Finance", ["finance"]),
        ("add it for finance", ["finance"]),  # "it" is not IT Infrastructure in lower case
        ("Add for Finance and Data & AI", ["data", "finance"]),
        ("Add for Application, IT Infrastructure and Data & AI", ["application", "infrastructure", "data"]),
        ("IT and AI", ["infrastructure", "data"]),
        ("finance, not legal", ["finance"]),
        ("also Sales", ["data", "sales", "finance"]),
        ("not Legal", ["data", "finance"]),
        ("the pizza shop only", ["pizza-shop"]),
        ("none", []),
        ("yes", None),
        ("go ahead", None),
    ],
)
def test_the_owners_words_become_departments(words: str, want: Any) -> None:
    assert dp.parse(words, DEPTS, ["finance", "data", "legal"] if words == "not Legal" else ["finance", "data"]) == want


def test_a_python_skill_is_recommended_for_the_technical_departments_only() -> None:
    recs = dp.recommend("python: write, test and run Python scripts", DEPTS)
    assert [k for k, _ in recs] == ["application", "infrastructure", "data"]
    assert all(why for _, why in recs)


def test_a_dashboard_skill_is_recommended_for_data_and_finance() -> None:
    assert {k for k, _ in dp.recommend("Analytics dashboards: KPI dashboards from spreadsheets", DEPTS)} == {
        "data",
        "finance",
    }


def test_never_every_department_by_default() -> None:
    every = [{"name": d.name, "why": "x"} for d in DEPTS]
    assert len(dp.recommended(every, "", DEPTS)) == dp.MAX_RECOMMENDED
    words = " ".join(d.name for d in DEPTS)
    assert len(dp.recommend(words, DEPTS)) == dp.MAX_RECOMMENDED


def test_vaics_recommendation_is_checked_and_falls_back_to_the_words() -> None:
    got = dp.recommended([{"name": "Data and AI", "why": "charts"}, {"name": "Nope"}], "", DEPTS)
    assert got == [("data", "charts")]
    assert [k for k, _ in dp.recommended([], "a GDPR contract checklist", DEPTS)] == ["legal"]


def test_a_selection_is_checked() -> None:
    assert dp.check("all", DEPTS) == dp.ALL
    assert dp.check(["Finance", "data"], DEPTS) == ["data", "finance"]
    assert dp.check(ALL_KEYS, DEPTS) == dp.ALL  # every department is "all"
    with pytest.raises(ValueError, match="no department called"):
        dp.check(["Astrology"], DEPTS)
    with pytest.raises(ValueError):
        dp.check([], DEPTS)


# ---------- skills reach only their departments ----------
SKILL = {"name": "python", "enabled": True, "roles": ["vaic", "orchestrator", "manager", "worker"]}


@pytest.mark.parametrize(
    ("role", "department", "sees"),
    [
        ("manager", "Application", True),
        ("worker", "IT Infrastructure", True),
        ("worker", "infrastructure", True),
        ("manager", "Finance", False),
        ("worker", "Marketing", False),
        ("worker", None, False),
        ("vaic", None, True),
        ("orchestrator", None, True),
    ],
)
def test_a_skill_with_departments_is_loaded_only_for_them(role: str, department: str | None, sees: bool) -> None:
    row = {**SKILL, "departments": ["application", "infrastructure"]}
    assert for_agent(row, role, department) is sees


def test_a_skill_without_departments_is_for_every_department() -> None:
    assert for_agent({**SKILL, "departments": []}, "worker", "Finance")
    assert for_agent(SKILL, "manager", "Marketing")
    assert not for_agent({**SKILL, "enabled": False}, "manager", "Marketing")


async def test_the_skills_api_stores_and_edits_departments() -> None:
    from test_skills import FakeS3
    from vaic.lambdas.skills_api import SkillsApi, route

    s = SkillsApi(make().ledger, FakeS3(), "vaic-prod-skills")
    md = "---\nname: python\ndescription: Python scripts.\n---\n\n# Python\n"
    import base64

    files = [{"path": "SKILL.md", "content_base64": base64.b64encode(md.encode()).decode()}]
    code, out = await route(
        s, "POST", ["skills"], lambda: {"files": files, "departments": ["Application", "Data & AI"]}
    )
    assert code == 201 and out["skill"]["departments"] == ["application", "data"]
    code, out = await route(s, "PUT", ["skills", "python"], lambda: {"departments": "all"})
    assert code == 200 and out["skill"]["departments"] == []
    code, out = await route(s, "PUT", ["skills", "python"], lambda: {"departments": ["Astrology"]})
    assert code == 400 and "no department" in out["error"]
    # A new version keeps the departments it had.
    await route(s, "PUT", ["skills", "python"], lambda: {"departments": ["finance"]})
    code, out = await route(s, "POST", ["skills"], lambda: {"files": files})
    assert out["skill"]["departments"] == ["finance"]


# ---------- knowledge for some departments ----------
DOC = {"id": "k-1", "status": "ready", "scope": "relevant", "departments": ["finance", "data"]}


@pytest.mark.parametrize(
    ("caller", "sees"),
    [
        (Caller(department="finance", role="manager"), True),
        (Caller(department="data", role="worker"), True),
        (Caller(department="marketing", role="worker"), False),
        (Caller(department=None, role="executive"), False),
        (Caller(role="vaic"), True),
        (Caller(role="orchestrator"), True),
        (Caller(department="finance", role="vaic"), True),  # VAIC narrowed to Finance
        (Caller(department="marketing", role="orchestrator"), False),  # narrowed to Marketing
    ],
)
def test_a_document_for_some_departments_is_visible_to_exactly_them(caller: Caller, sees: bool) -> None:
    assert entry_visible(DOC, caller) is sees


def test_a_document_for_every_department_is_visible_to_all() -> None:
    doc = {**DOC, "departments": []}
    for c in (Caller(department="marketing", role="worker"), Caller(role="executive"), Caller(role="vaic")):
        assert entry_visible(doc, c)


async def test_the_always_block_leaves_out_other_departments_documents() -> None:
    w = world()
    a = await ready_item(w, "Budget rules", "always", summary="Budgets are monthly.")
    await w.store.update_item(a["id"], {"departments": ["finance"]})
    assert "Budgets are monthly" in await always_block(w.store, Caller(department="finance", role="manager"))
    assert "Budgets are monthly" not in await always_block(w.store, Caller(department="sales", role="worker"))
    assert "Budgets are monthly" in await always_block(w.store, Caller(role="vaic"))


async def test_the_knowledge_page_edits_departments() -> None:
    w = world()
    d = make(knowledge=w.service)
    d.bus = w.bus
    a = await ready_item(w, "Q3 numbers")
    r = await handle_http(ev("PUT", f"/knowledge/{a['id']}", {"departments": ["Finance", "Data & AI"]}), d)
    assert r["statusCode"] == 200 and js(r)["item"]["departments"] == ["finance", "data"]
    assert w.bus.of_type("knowledge.updated")[-1]["departments"] == ["finance", "data"]
    r = await handle_http(ev("PUT", f"/knowledge/{a['id']}", {"departments": "all"}), d)
    assert js(r)["item"]["departments"] == []
    r = await handle_http(ev("PUT", f"/knowledge/{a['id']}", {"departments": []}), d)
    assert r["statusCode"] == 400


# ---------- VAIC: the cards and the owner's answer ----------
def owner_turn(c: Any, text: str) -> dict[str, Any]:
    ctx = TurnCtx(
        agent_id="vaic", role="vaic", department=None, ticket_id="t-1", task_id="t-1", from_owner=True, owner_text=text
    )
    return {t.name: t for t in tools_for(c, ctx)}


async def test_a_drafted_skill_is_saved_for_the_departments_the_owner_says() -> None:
    from test_owner_api import draft, skills_wired

    c, api, t = skills_wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    recs = [{"name": "Application", "why": "writes code"}, {"name": "IT Infrastructure", "why": "scripts"}]
    out = await t["draft_skill"].handler(draft(name="python", departments=recs))
    assert "which departments" in out
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    p = q["departments"]
    assert [x["key"] for x in p["choices"]][:3] == ["application", "infrastructure", "data"]
    assert p["recommended"] == [
        {"key": "application", "why": "writes code"},
        {"key": "infrastructure", "why": "scripts"},
    ]
    assert p["selected"] == ["application", "infrastructure"]
    # Spoken: "all except Sales and Legal" first changes the card, then "yes" saves it.
    out = await owner_turn(c.deps, "make it all except Sales and Legal")["choose_departments"].handler({})
    assert "Nothing is saved yet" in out
    picked = [e for e in bus.events if e["type"] == "vaic.departments"][-1]["selected"]
    assert "sales" not in picked and "legal" not in picked and "finance" in picked
    out = await owner_turn(c.deps, "yes")["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved")
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#python")
    assert row and row["departments"] == picked


async def test_a_tapped_add_saves_the_departments_on_the_card() -> None:
    from test_owner_api import draft, skills_wired

    c, api, t = skills_wired()
    await t["draft_skill"].handler(draft(name="python", departments=[{"name": "Application"}]))
    out = await owner_turn(c.deps, "Add for Finance and Data & AI")["save_change"].handler({"answer": "yes"})
    assert "for Data & AI and Finance" in out
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#python")
    assert row and row["departments"] == ["data", "finance"]


async def test_all_departments_saves_a_skill_for_every_department() -> None:
    from test_owner_api import draft, skills_wired

    c, api, t = skills_wired()
    await t["draft_skill"].handler(draft(name="python", departments=[{"name": "Application"}]))
    out = await owner_turn(c.deps, "Add for all departments")["save_change"].handler({"answer": "yes"})
    assert "every department" in out
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#python")
    assert row and row["departments"] == []


async def test_no_department_is_not_saved() -> None:
    from test_owner_api import draft, skills_wired

    c, api, t = skills_wired()
    await t["draft_skill"].handler(draft(name="python", departments=[{"name": "Application"}]))
    out = await owner_turn(c.deps, "yes, for none of them")["save_change"].handler({"answer": "yes"})
    assert out.startswith("Not saved") and await api.skills.ledger.table.get("SKILLS", "SKILL#python") is None
    out = await owner_turn(c.deps, "ok just finance then")["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved")


def knowledge_wired() -> tuple[Any, Any]:
    w = world()
    d = make(knowledge=w.service)
    d.bus, d.ledger = w.bus, w.ledger
    deps = city(w)

    async def call(x: dict[str, Any]) -> dict[str, Any]:
        return await vaic_call(x, d)

    deps.owner_api = call
    return deps, w


async def test_an_attached_document_is_added_as_knowledge_for_the_picked_departments() -> None:
    deps, w = knowledge_wired()
    a = await ready_item(w, "Q3 revenue dashboard", status="processing", summary="KPI dashboard of revenue.")
    t = owner_turn(deps, "add this to the knowledge base")
    out = await t["add_as_knowledge"].handler(
        {"item": "Q3 revenue dashboard", "departments": [{"name": "Finance", "why": "revenue numbers"}]}
    )
    assert "Staged, NOT saved" in out
    q = w.bus.of_type("vaic.question")[-1]
    assert q["question"] == "Add it as knowledge for these departments?" and q["options"] == ["Add", "No"]
    assert q["knowledge"] == {"id": a["id"], "title": "Q3 revenue dashboard", "status": "processing"}
    assert q["departments"]["selected"] == ["finance"]
    assert (await w.store.require_item(a["id"])).get("departments") is None  # nothing saved yet
    out = await owner_turn(deps, "Add for Finance and Data & AI")["save_change"].handler({"answer": "yes"})
    assert "ready in a minute or two" in out and "Data & AI and Finance" in out
    assert (await w.store.require_item(a["id"]))["departments"] == ["data", "finance"]
    for word in ("RAG", "index", "vector"):
        assert word not in q["question"] + q["title"] + json.dumps(q["lines"])


async def test_the_newest_attachment_is_meant_when_none_is_named() -> None:
    deps, w = knowledge_wired()
    await ready_item(w, "Old notes")
    b = await ready_item(w, "Contract template")
    await owner_turn(deps, "add this as knowledge")["add_as_knowledge"].handler({})
    assert w.bus.of_type("vaic.question")[-1]["knowledge"]["id"] == b["id"]
    assert w.bus.of_type("vaic.question")[-1]["departments"]["selected"] == ["legal"]  # from its title
    out = await owner_turn(deps, "all departments")["save_change"].handler({"answer": "yes"})
    assert "it's knowledge for every department now" in out
    assert (await w.store.require_item(b["id"]))["departments"] == []


async def test_only_the_owner_can_add_knowledge_for_departments() -> None:
    deps, _ = knowledge_wired()
    ctx = TurnCtx(agent_id="vaic", role="vaic", department=None, ticket_id="t", task_id="t", from_owner=False)
    t = {x.name: x for x in tools_for(deps, ctx)}
    assert "Only the owner" in await t["add_as_knowledge"].handler({})
    assert "Only the owner" in await t["choose_departments"].handler({"words": "all"})


async def test_the_department_chips_list_every_department_and_the_owners_own() -> None:
    d = make()
    await d.ledger.create_department("Pizza Shop", "Pizzas", "mgr-pizza")
    r = await handle_http(ev("GET", "/departments/choices"), d)
    got = js(r)["departments"]
    assert r["statusCode"] == 200 and got[0] == {"key": "application", "name": "Application"}
    assert {"key": "finance", "name": "Finance"} in got and got[-1] == {"key": "pizza-shop", "name": "Pizza Shop"}
