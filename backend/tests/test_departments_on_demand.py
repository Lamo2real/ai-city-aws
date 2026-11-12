"""Departments on demand (decision 134): the owner builds a department, by a word to VAIC or from the City or
Settings, with a Fable 5.1 manager and Opus 5.5 workers unless they ask for Fable workers; and demolishes one:
its workers go home, its open work goes back to the Orchestrator, its history stays."""

import pytest

from test_api import ev, js, make
from test_task_control import SPEC, city, job, vaic_tools
from vaic.lambdas.api import handle_http
from vaic.shared.hierarchy.board_path import add_part, plan_items
from vaic.shared.hierarchy.departments import DepartmentError, clean_name
from vaic.shared.models import model_name_for, resolve_role
from vaic.shared.presets import ensure_presets, orchestrator_note


def test_names_and_model_choices_are_plain() -> None:
    assert clean_name("  customer   success department ") == "Customer success"
    assert clean_name("Partnerships") == "Partnerships"
    for bad in ("", "x", "1234", "a" * 41, "HQ"):
        with pytest.raises(DepartmentError):
            clean_name(bad)


def test_no_department_has_its_own_worker_model_any_more() -> None:
    """Decision 300 replaces decisions 129 and 134: every worker is Sonnet 5.5, every reviewer Opus 5.5."""
    for rec in ({"name": "Customer Success", "worker_model": "fable-5-1"}, {"name": "Media"}, None):
        name = rec["name"] if rec else "Sales"
        assert model_name_for("worker", name, rec) == "sonnet-5-5"
        assert model_name_for("manager", name, rec) == "opus-5-5"
        assert resolve_role("worker", department=name, dept=rec).primary.name == "sonnet-5-5"


async def test_vaic_builds_a_department_with_sonnet_workers_and_a_tower_event() -> None:
    c = await city()
    said = await vaic_tools(c)["build_department"].handler(
        {"name": "Customer Success", "mission": "Keep customers happy and renewing."}
    )
    assert said.startswith("Built Customer Success") and "Sonnet 5.5" in said and "Opus 5.5" in said
    dept = await c.ledger.get_department("Customer Success")
    assert dept and dept["state"] == "active" and dept["built_by"] == "owner" and not dept.get("worker_model")
    (e,) = c.bus.of_type("department.created")
    assert e["name"] == "Customer Success" and "worker_model" not in e
    # Its reviewer is Opus (hired with its first part); its workers are Sonnet.
    task = await c.ledger.create_ticket(
        {"goal": "Write a renewal email", "from": "vaic", "to": "orchestrator", "department": None,
         "parent_id": None, "kind": "task", "status": "in_progress", "planned": True, "contract_version": 1, "path": "board",
         "size": "medium"}
    )  # fmt: skip
    await add_part(c.host.d, task["id"], {"name": "Email", "goal": "A renewal email", "acceptance": "One email",
                                          "department": "Customer Success"})  # fmt: skip
    mgr = await c.ledger.get_agent(dept["manager_id"])
    assert mgr and mgr["model"] == "opus-5-5"
    w = await c.factory.hire(SPEC, dept["manager_id"], "Customer Success")
    assert w["model"] == "sonnet-5-5"
    again = await vaic_tools(c)["build_department"].handler({"name": "customer success"})
    assert "already standing" in again and len(c.bus.of_type("department.created")) == 1


async def test_an_old_request_for_fable_workers_still_builds_sonnet_workers() -> None:
    c = await city()
    said = await vaic_tools(c)["build_department"].handler({"name": "Partnerships", "worker_model": "fable-5-1"})
    assert said.startswith("Built Partnerships") and "Sonnet 5.5" in said
    dept = await c.ledger.get_department("Partnerships")
    assert dept and not dept.get("worker_model")
    w = await c.factory.hire(SPEC, dept["manager_id"], "Partnerships")
    assert w["model"] == "sonnet-5-5"


async def test_the_ceiling_counts_only_the_owners_own_departments() -> None:
    c = await city()
    await c.ledger.update_settings({"max_departments": 1})
    tools = vaic_tools(c)
    assert (await tools["build_department"].handler({"name": "Partnerships"})).startswith("Built")
    refused = await tools["build_department"].handler({"name": "Events"})
    assert refused.startswith("Not built:") and "limit is 1" in refused
    assert (await tools["build_department"].handler({"name": "Finance"})).startswith("Built Finance")  # a preset
    await tools["demolish_department"].handler({"name": "Partnerships", "confirm": True})
    assert (await tools["build_department"].handler({"name": "Events"})).startswith("Built")  # room again


async def test_demolish_asks_first_then_sends_workers_home_hands_work_back_and_keeps_history() -> None:
    c = await city()
    task = await job(c, "Write 50 sentences about the GT3", "porsche sentences", "Writing", workers=2)
    tools = vaic_tools(c)
    planned = await c.ledger.create_ticket(
        {"goal": "More sentences", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None,
         "kind": "task", "status": "in_progress", "planned": True, "contract_version": 1, "path": "board", "size": "medium"}
    )  # fmt: skip
    await c.ledger.table.put({"pk": f"TICKET#{planned['id']}", "sk": "PLAN#0000#more", "name": "More",
                              "goal": "more", "acceptance": "ok", "department": "Writing", "after": ["First"],
                              "files": [], "order": 0, "status": "waiting"})  # fmt: skip
    ask = await tools["demolish_department"].handler({"name": "writing department", "confirm": False})
    assert ask.startswith("Demolish Writing? 2 workers go home and 3 unfinished parts go")
    assert (await c.ledger.get_department("Writing"))["state"] == "active"  # not yet

    said = await tools["demolish_department"].handler({"name": "Writing", "confirm": True})
    assert said.startswith(
        "Demolished Writing: 2 workers went home, 3 unfinished parts went to the department that took over, or were dropped."
    )
    dept = await c.ledger.get_department("Writing")
    assert dept and dept["state"] == "demolished" and dept.get("demolished_at")  # the record stays: history
    assert "Writing" not in [x["name"] for x in await c.ledger.list_departments()]
    assert "Writing" in [x["name"] for x in await c.ledger.list_departments(include_demolished=True)]
    workers = [a for a in await c.ledger.list_agents() if a["kind"] == "worker"]
    assert workers and all(w["state"] == "retired" for w in workers)
    assert (await c.ledger.get_agent("mgr-writing"))["state"] == "retired"
    kids = await c.ledger.child_tickets(task["id"])
    assert kids and all(k["status"] == "cancelled" for k in kids)
    assert (await c.ledger.get_ticket(task["id"]))["status"] == "in_progress"
    # A board job's part still waiting in Writing is dropped (nothing took over), so the job can still finish.
    (dropped,) = await plan_items(c.host.d, planned["id"])
    assert dropped["status"] == "done" and "demolished Writing" in dropped["result"]
    (e,) = c.bus.of_type("department.demolished")
    assert e == {**e, "name": "Writing", "workers": 2, "parts": 3}
    # The planner can't give it work.
    again = await c.ledger.create_ticket(
        {"goal": "x", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task",
         "status": "in_progress", "planned": True, "contract_version": 1, "path": "board", "size": "medium"}
    )  # fmt: skip
    said_no = await add_part(c.host.d, again["id"], {"name": "Words", "goal": "x", "acceptance": "y",
                                                     "department": "Writing"})  # fmt: skip
    assert said_no.startswith("There is no department called Writing")
    assert "no standing department" in await tools["demolish_department"].handler({"name": "Writing", "confirm": True})
    # The owner can build it again.
    assert (await tools["build_department"].handler({"name": "Writing"})).startswith("Rebuilt Writing")
    assert (await c.ledger.get_department("Writing"))["state"] == "active"


async def test_a_demolished_preset_is_not_put_back_and_leaves_the_orchestrators_list() -> None:
    c = await city()
    await ensure_presets(c.ledger)
    said = await vaic_tools(c)["demolish_department"].handler({"name": "Finance", "confirm": True})
    assert said.startswith("Demolished Finance: 0 workers")
    assert await ensure_presets(c.ledger) == []
    assert "Finance" not in [x["name"] for x in await c.ledger.list_departments()]
    assert "- Finance:" not in orchestrator_note({"finance"}) and "- Finance:" in orchestrator_note()


async def test_the_http_api_builds_and_demolishes() -> None:
    d = make()
    r = await handle_http(ev("POST", "/departments", {"name": "Customer Success", "worker_model": "fable"}), d)
    assert r["statusCode"] == 201 and not js(r)["department"].get("worker_model")  # one map (decision 300)
    assert js(r)["outcome"] == "created"
    assert (await handle_http(ev("POST", "/departments", {"name": "customer success"}), d))["statusCode"] == 409
    assert (await handle_http(ev("POST", "/departments", {"name": ""}), d))["statusCode"] == 400
    no = await handle_http(ev("DELETE", "/departments/customer-success", {}), d)
    assert no["statusCode"] == 400 and (await d.ledger.get_department("Customer Success"))["state"] == "active"
    gone = await handle_http(ev("DELETE", "/departments/customer-success", {"confirm": True}), d)
    assert gone["statusCode"] == 200 and js(gone)["name"] == "Customer Success"
    assert [e["name"] for e in d.bus.of_type("department.demolished")] == ["Customer Success"]
    assert (await handle_http(ev("DELETE", "/departments/customer-success", {"confirm": True}), d))["statusCode"] == 404
    snap = js(await handle_http(ev("GET", "/city"), d))
    assert "Customer Success" not in [x["name"] for x in snap["departments"]]
    assert ("POST", "/departments") in __import__("vaic.lambdas.api", fromlist=["ROUTES"]).ROUTES
