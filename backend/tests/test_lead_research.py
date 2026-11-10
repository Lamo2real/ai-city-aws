"""Lead research (decision 121): "find me 2 leads" reaches Sales, a worker follows the bundled ``lead-research``
skill, and the leads come back as a table in the chat plus a CSV in the owner's knowledge base. Fake runners only."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from city_support import Call, make_city, scripted_engine
from knowledge_support import world
from vaic.runtime.engine import EngineRequest
from vaic.shared.knowledge.service import KnowledgeAccess, KnowledgeError
from vaic.shared.leads import csv_blocks, save_lead_csvs
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.presets import catalog, ensure_presets, preset_for
from vaic.shared.skills_bundled import bundled_skill, department_skills

ASK = "find me 2 leads: Swedish fintechs hiring engineers"
TABLE = (
    "| Name | Role | Company | Size | Email (confidence) | Hiring (engineering) | Hiring owner | News |\n"
    "|---|---|---|---|---|---|---|---|\n"
    "| Ada Berg | CTO | Kassa AB | 51-200 (Allabolag) | ada@kassa.se (published) | Backend engineer | Ada Berg | Raised a Series A |\n"
    "| Ola Lind | Head of Talent | Pengar AB | 11-50 (LinkedIn) | not found publicly | Data engineer | Ola Lind | none in 6 months |"
)
CSV = (
    "first_name,last_name,role,company,website,company_size,email,email_confidence\n"
    "Ada,Berg,CTO,Kassa AB,https://kassa.se,51-200,ada@kassa.se,published\n"
    "Ola,Lind,Head of Talent,Pengar AB,https://pengar.se,11-50,not found publicly,\n"
)
REPORT = f"Two leads.\n\n{TABLE}\n\n```csv\n{CSV}```\nDefaults: Sweden, 11-200 employees."


def test_the_owners_words_for_lead_work_reach_sales() -> None:
    for name in ("Sales", "business development", "Business Development", "bizdev", "biz dev", "leads",
                 "lead generation", "Prospecting", "sales leads"):  # fmt: skip
        assert preset_for(name)["key"] == "sales", name  # type: ignore[index]


def test_the_lead_research_skill_is_bundled_for_sales_with_its_connectors() -> None:
    row = bundled_skill("lead-research")
    assert row and row["builtin"] and "leads" in row["description"]
    assert "lead-research" in [r["name"] for r in department_skills("bizdev")]
    assert "lead-research" not in [r["name"] for r in department_skills("Marketing")]
    text = (Path(row["dir"]) / "SKILL.md").read_text(encoding="utf-8")
    for must in ("Platsbanken", "jobsearch.api.jobtechdev.se", "Teamtailor", "Jobylon", "LinkedIn Jobs", "Indeed",
                 "not found publicly", "hiring owner", "```csv", "CAPTCHA", "home addresses"):  # fmt: skip
        assert must.lower() in text.lower(), must
    sales = preset_for("Sales")
    assert sales and {"apollo", "hunter", "crunchbase", "tavily", "firecrawl", "hubspot"} <= set(sales["connectors"])
    hunter = catalog()["hunter"]
    assert hunter["url"] == "https://mcp.hunter.io/mcp" and hunter["label"] and hunter["what"] and hunter["signup"]


def test_csv_blocks_are_read_from_a_report() -> None:
    assert csv_blocks(REPORT) == [CSV]
    assert csv_blocks("no table here") == []
    assert csv_blocks("```csv\n\n```") == []


async def test_find_me_two_leads_walks_to_sales_and_comes_back_as_a_table_and_a_csv() -> None:
    seen: dict[str, str] = {}

    async def vaic(req: EngineRequest, call: Call) -> str:
        if "(task) from owner" in req.turn.prompt:
            await call("delegate_to_orchestrator", {"goal": "Sales: lead research. " + ASK, "owner_words": ASK,
                                                    "confirm": True})  # fmt: skip
            return "On it."
        seen["vaic"] = req.turn.prompt
        return "Here are your two leads."

    async def orchestrator(req: EngineRequest, call: Call) -> str:
        if "(task) from vaic" in req.turn.prompt:
            await call("assign_to_department", {"department": "Business Development", "goal": ASK,
                                                "acceptance": "2 leads with every field or 'not found publicly'"})  # fmt: skip
            return "Sent."
        reports = json.loads(await call("get_reports", {}))
        if reports and all(r["status"] == "in_review" for r in reports):
            await call("sign_off", {"verdict": "PASS", "reasons": "Two leads, every field sourced."})
            await call("report_to_vaic", {"summary": f"Two leads found.\n\n{TABLE}"})
        return "ok"

    async def manager(req: EngineRequest, call: Call) -> str:
        mine = [k for k in await req.ledger.child_tickets(req.ctx.ticket_id) if k.get("kind") == "assignment"]
        if "(task) from orchestrator" in req.turn.prompt and not mine:
            seen["manager"] = req.system
            hired = await call("hire_worker", {"specialty": "Prospecting: lead researcher",
                                               "instructions": "Follow lead-research.", "tools": ["WebFetch"],
                                               "budget_hint_usd": 1})  # fmt: skip
            wid = re.search(r"Hired (\S+)", hired).group(1)  # type: ignore[union-attr]
            await call("assign", {"worker_id": wid, "goal": ASK, "acceptance": "2 leads"})
            return "Assigned."
        for t in [k for k in mine if k["status"] == "in_review"]:
            await call("review", {"ticket_id": t["id"], "verdict": "PASS", "reasons": "Sourced."})
            await call("release_worker", {"worker_id": t["to"]})
            await call("report_to_orchestrator", {"summary": REPORT})
        return "Reviewed."

    async def worker(req: EngineRequest, call: Call) -> str:
        await call("report_to_manager", {"summary": REPORT, "artifacts": [], "checks": "every field has a source"})
        return "Reported."

    w = world()
    city = make_city(
        scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": manager, "worker": worker})
    )
    city.deps.knowledge = KnowledgeAccess(store=w.store, kb=w.kb, service=w.service)
    await ensure_presets(city.ledger)  # the preset departments stand from the start
    await city.owner_says(ASK)
    await city.run()

    every = await city.ledger.list_tickets(ALL_STATUSES)
    task = next(t for t in every if t["from"] == "vaic")  # the job the Work screen shows
    assert task["status"] == "done"
    dept = next(t for t in every if t["from"] == "orchestrator")
    assert dept["department"] == "Sales"
    assert "Lead research" in seen["manager"] and "lead-research" in seen["manager"]

    csvs = [(k, v) for k, v in w.blobs.objects.items() if k.endswith("/leads.csv")]
    assert len(csvs) == 1  # worker's and manager's copies are the same block: saved once
    key, (body, content_type) = csvs[0]
    assert body == CSV.encode() and content_type.startswith("text/csv")
    item = await w.store.get_item(key.split("/")[1])
    assert item and item["kind"] == "document" and item["title"].startswith("Leads: Sales: lead research")
    assert "| Ada Berg | CTO | Kassa AB" in seen["vaic"]  # the table reaches VAIC for the chat
    assert "Saved to the owner's knowledge base as a CSV: “Leads:" in seen["vaic"]

    assert await save_lead_csvs(city.ledger, w.service, task["id"]) == []  # a re-delivered report saves nothing
    assert await save_lead_csvs(city.ledger, None, task["id"]) == []


async def test_a_csv_must_have_rows_and_stay_under_a_megabyte() -> None:
    w = world()
    for bad in ("", "  \n", "a,b\n" * 300_000):
        with pytest.raises(KnowledgeError):
            await w.service.add_csv(bad, "Leads")
