"""Pre-configured departments (decision 113): IT and Marketing, their skills, connectors and names."""

from pathlib import Path
from typing import Any

from test_api import ev, js, make
from test_apps import city_deps, tool
from vaic.lambdas.api import ROUTES, handle_http
from vaic.runtime.prompts import department_template
from vaic.runtime.skills import SkillStore
from vaic.runtime.tools import TurnCtx
from vaic.shared.presets import (
    catalog,
    ensure_presets,
    orchestrator_note,
    preset_for,
    presets,
    public_presets,
    shared,
)
from vaic.shared.skills_bundled import bundled_skill, department_skills
from vaic.shared.table import MemoryTable

ORCH = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t-task", task_id="t-task")


def test_nine_departments_and_everything_they_name_exists() -> None:
    names = [p["name"] for p in presets()]
    assert names == [
        "Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal",
        "Product", "Operations", "Research", "Media",
    ]  # fmt: skip
    cat = catalog()
    for p in [*presets(), shared()]:
        assert all(c in cat and cat[c]["url"].startswith("https://") for c in p["connectors"])
        assert set(p["essential"]) <= set(p["connectors"]) and p["essential"]
        assert all(bundled_skill(s) for s in p["skills"]), p["skills"]
    for p in presets():
        assert department_template(p["name"]).startswith(f"## {p['name']} playbook")
    by = {p["key"]: p for p in presets()}
    assert {"canva", "higgsfield", "elevenlabs", "heygen", "meta-ads", "google-ads"} <= set(
        by["marketing"]["connectors"]
    )
    assert {"github", "aws-knowledge", "context7"} <= set(by["application"]["connectors"]) | set(
        by["infrastructure"]["connectors"]
    )
    assert "salesforce" in by["sales"]["essential"]
    assert {"stripe", "atlassian"} <= set(shared()["essential"])  # one Stripe account and Jira for everyone


def test_names_and_aliases_reach_the_preset() -> None:
    for name in ("Application", "engineering", "software", "iOS", "backend"):
        assert preset_for(name)["key"] == "application", name  # type: ignore[index]
    for name in ("IT", "it", "IT Infrastructure", "devops", "cloud", "security"):
        assert preset_for(name)["key"] == "infrastructure", name  # type: ignore[index]
    for name in ("Marketing", "design", "Ads", "brand"):
        assert preset_for(name)["key"] == "marketing", name  # type: ignore[index]
    for name, key in (("Data & AI", "data"), ("analytics", "data"), ("Data & Analytics", "data"), ("AI", "data"), ("customer service", "support"),
                      ("Accounting", "finance"), ("GDPR", "legal"), ("UX", "product"), ("ops", "operations")):  # fmt: skip
        assert preset_for(name)["key"] == key, name  # type: ignore[index]
    for name in ("Research", "R&D", "innovation", "market research"):
        assert preset_for(name)["key"] == "research", name  # type: ignore[index]
    assert preset_for("user research")["key"] == "product"  # type: ignore[index]
    for name in ("Media", "YouTube", "video production", "TikTok", "podcast"):
        assert preset_for(name)["key"] == "media", name  # type: ignore[index]
    assert preset_for("Gardening") is None
    assert preset_for("") is None


def test_a_departments_skills_come_from_its_preset_only() -> None:
    app = [r["name"] for r in department_skills("Engineering")]
    infra = [r["name"] for r in department_skills("IT")]
    assert "backend-services" in app and "terraform-iac" not in app and "canva-design" not in app
    assert "terraform-iac" in infra and "aws-well-architected" in infra
    shared_skills = ["knowledge-first", "sell-with-stripe", "cross-team-work"]
    assert [r["name"] for r in department_skills("Marketing")][:5] == [*shared_skills, "brand-and-copy", "canva-design"]
    assert [r["name"] for r in department_skills("Gardening")] == shared_skills  # every department gets these
    assert "business-idea-brief" in [r["name"] for r in department_skills("R&D")]
    row = bundled_skill("terraform-iac")
    assert row and row["builtin"] and row["version"].startswith("builtin-") and "Terraform" in row["description"]
    assert row["files"] == [{"path": "SKILL.md", "size": row["files"][0]["size"]}]


async def test_bundled_skills_join_the_plugin_folder_without_s3(tmp_path: Path) -> None:
    class NoS3:
        def get_object(self, **_: Any) -> Any:
            raise AssertionError("a bundled skill is never downloaded")

    store = SkillStore(MemoryTable(), NoS3(), "bucket", root=tmp_path)
    run = await store.materialize(department_skills("IT Infrastructure"))
    assert run is not None
    assert (run / "skills" / "terraform-iac" / "SKILL.md").read_text().startswith("---\nname: terraform-iac")
    assert (run / ".claude-plugin" / "plugin.json").is_file()


async def test_the_orchestrator_lands_engineering_work_in_application() -> None:
    d = city_deps()
    out = await tool(d, ORCH, "create_department")({"name": "Engineering", "mission": "Build the shop's API."})
    assert out.startswith("Created Application")
    (dept,) = await d.ledger.list_departments()
    assert dept["name"] == "Application" and dept["mission"] == "Build the shop's API."
    again = await tool(d, ORCH, "create_department")({"name": "software", "mission": "Write the code."})
    assert "Application already exists" in again
    assert "Marketing" in orchestrator_note() and "IT Infrastructure" in orchestrator_note()


async def test_the_presets_route_lists_departments_teams_skills_and_connectors() -> None:
    assert ("GET", "/departments/presets") in ROUTES
    body = js(await handle_http(ev("GET", "/departments/presets"), make()))
    assert body == public_presets()
    assert body["shared"]["connectors"][0]["id"] == "stripe" and body["shared"]["connectors"][0]["essential"]
    it, mk = body["departments"][0], body["departments"][3]
    assert it["name"] == "Application" and any(t["name"] == "iOS" for t in it["teams"])
    assert any(s["name"] == "current-docs" for s in it["skills"])
    canva = next(c for c in mk["connectors"] if c["id"] == "canva")
    assert canva == {
        "id": "canva", "label": "Canva", "url": "https://mcp.canva.com/mcp", "what": canva["what"],
        "signup": "https://www.canva.com/signup/", "essential": True,
    }  # fmt: skip
    shop = next(c for d in body["departments"] for c in d["connectors"] if c["id"] == "shopify-store")
    assert shop["ask"]["name"] == "store" and "{store}" in shop["url"]


async def test_work_sent_to_an_alias_reaches_the_preset() -> None:
    d = city_deps()
    await d.ledger.create_ticket({"id": "t-task", "goal": "an API", "from": "vaic", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    await tool(d, ORCH, "create_department")({"name": "Application", "mission": "Build the owner's software."})
    out = await tool(d, ORCH, "assign_to_department")(
        {"department": "Engineering", "goal": "an API", "acceptance": "it runs"}
    )
    assert "Application" in out
    (kid,) = await d.ledger.child_tickets("t-task")
    assert kid["department"] == "Application"


async def test_every_preset_stands_from_the_start_without_managers_and_comes_back_after_start_over() -> None:
    d = make()
    snap = js(await handle_http(ev("GET", "/city"), d))
    names = [x["name"] for x in snap["departments"]]
    assert set(names) == {p["name"] for p in presets()}
    assert [a for a in snap["agents"] if a.get("kind") == "manager"] == []  # empty towers, no idle managers
    again = js(await handle_http(ev("GET", "/city"), d))
    assert len(again["departments"]) == len(names)  # no duplicates
    reset = js(await handle_http(ev("POST", "/city/reset", {"confirm": True}), d))
    assert reset["done"] is True
    back = js(await handle_http(ev("GET", "/city"), d))
    assert {x["name"] for x in back["departments"]} == set(names)


async def test_a_preset_gets_its_manager_with_its_first_goal_and_own_departments_have_their_own_ceiling() -> None:
    d = city_deps()
    await ensure_presets(d.ledger)
    assert await d.ledger.get_agent("mgr-marketing") is None
    await d.ledger.create_ticket({"id": "t-task", "goal": "a launch", "from": "vaic", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    await tool(d, ORCH, "assign_to_department")({"department": "Marketing", "goal": "a launch", "acceptance": "ready"})
    mgr = await d.ledger.get_agent("mgr-marketing")
    assert mgr and mgr["kind"] == "manager" and mgr["department"] == "Marketing"
    # Twelve presets exist; the ceiling (6 by default) counts only the owner's own departments.
    for i in range(6):
        out = await tool(d, ORCH, "create_department")({"name": f"Garden {i}", "mission": "Grow vegetables."})
        assert out.startswith("Created"), out
    refused = await tool(d, ORCH, "create_department")({"name": "Garden 6", "mission": "Grow vegetables."})
    assert refused.startswith("Refused")
    ok = await tool(d, ORCH, "create_department")({"name": "Sales", "mission": "Sell the owner's products."})
    assert "already exists" in ok


def test_the_catalog_says_how_each_service_connects_and_where_to_sign_up() -> None:
    """Decision 134: sign-up links are https on the service's own site (checked live by
    scripts/check-signup-links.mjs); 'own_app' marks sign-ins without self-registration; 'not_offered' points only
    to services in the catalog; a '{name}' in a link comes with its question."""
    from vaic.shared.presets import presets_config

    cat = catalog()
    for id, c in cat.items():
        assert c["url"].startswith("https://"), id
        assert not c.get("signup") or c["signup"].startswith("https://"), id
        assert c.get("setup") in (None, "own_app"), id
        assert ("{" in c["url"]) == bool(c.get("ask")), id
    for id, e in presets_config()["not_offered"].items():
        assert e["why"] and e["instead"] and all(i in cat for i in e["instead"]), id
