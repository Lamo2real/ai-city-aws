"""Pre-configured departments (decision 113): IT and Marketing, their skills, connectors and names."""

from pathlib import Path
from typing import Any

from aic.lambdas.api import ROUTES, handle_http
from aic.runtime.prompts import department_template
from aic.runtime.skills import SkillStore
from aic.runtime.tools import TurnCtx
from aic.shared.presets import catalog, orchestrator_note, preset_for, presets, public_presets, shared
from aic.shared.skills_bundled import bundled_skill, department_skills
from aic.shared.table import MemoryTable
from test_api import ev, js, make
from test_apps import city_deps, tool

ORCH = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t-task", task_id="t-task")


def test_nine_departments_and_everything_they_name_exists() -> None:
    names = [p["name"] for p in presets()]
    assert names == [
        "IT", "Data & Analytics", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations",
        "Research",
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
    assert {"github", "aws-knowledge", "context7"} <= set(by["it"]["connectors"])
    assert "salesforce" in by["sales"]["essential"]
    assert {"stripe", "atlassian"} <= set(shared()["essential"])  # one Stripe account and Jira for everyone


def test_names_and_aliases_reach_the_preset() -> None:
    for name in ("IT", "it", "IT Infrastructure", "engineering", "Application", "devops"):
        assert preset_for(name)["key"] == "it", name  # type: ignore[index]
    for name in ("Marketing", "design", "Ads", "brand"):
        assert preset_for(name)["key"] == "marketing", name  # type: ignore[index]
    for name, key in (("Data & AI", "data"), ("analytics", "data"), ("customer service", "support"),
                      ("Accounting", "finance"), ("GDPR", "legal"), ("UX", "product"), ("ops", "operations")):  # fmt: skip
        assert preset_for(name)["key"] == key, name  # type: ignore[index]
    for name in ("Research", "R&D", "innovation", "market research"):
        assert preset_for(name)["key"] == "research", name  # type: ignore[index]
    assert preset_for("user research")["key"] == "product"  # type: ignore[index]
    assert preset_for("Gardening") is None
    assert preset_for("") is None


def test_a_departments_skills_come_from_its_preset_only() -> None:
    it = [r["name"] for r in department_skills("Engineering")]
    assert "terraform-iac" in it and "aws-well-architected" in it and "canva-design" not in it
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
    run = await store.materialize(department_skills("IT"))
    assert run is not None
    assert (run / "skills" / "terraform-iac" / "SKILL.md").read_text().startswith("---\nname: terraform-iac")
    assert (run / ".claude-plugin" / "plugin.json").is_file()


async def test_the_orchestrator_lands_engineering_work_in_it() -> None:
    d = city_deps()
    out = await tool(d, ORCH, "create_department")({"name": "Engineering", "mission": "Build the shop's API."})
    assert out.startswith("Created IT")
    (dept,) = await d.ledger.list_departments()
    assert dept["name"] == "IT" and dept["mission"] == "Build the shop's API."
    again = await tool(d, ORCH, "create_department")({"name": "IT infrastructure", "mission": "Run the servers."})
    assert "IT already exists" in again
    assert "Marketing" in orchestrator_note() and "IT" in orchestrator_note()


async def test_the_presets_route_lists_departments_teams_skills_and_connectors() -> None:
    assert ("GET", "/departments/presets") in ROUTES
    body = js(await handle_http(ev("GET", "/departments/presets"), make()))
    assert body == public_presets()
    assert body["shared"]["connectors"][0]["id"] == "stripe" and body["shared"]["connectors"][0]["essential"]
    it, mk = body["departments"][0], body["departments"][2]
    assert it["name"] == "IT" and any(t["name"] == "Mobile" for t in it["teams"])
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
    await d.ledger.create_ticket({"id": "t-task", "goal": "an API", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    await tool(d, ORCH, "create_department")({"name": "IT", "mission": "Build and run the owner's software."})
    out = await tool(d, ORCH, "assign_to_department")(
        {"department": "Engineering", "goal": "an API", "acceptance": "it runs"}
    )
    assert "IT" in out
    (kid,) = await d.ledger.child_tickets("t-task")
    assert kid["department"] == "IT"
