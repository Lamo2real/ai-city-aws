"""Departments on demand (decision 134): the owner builds a department, by a word to VAIC or from the City or
Settings, with a Fable 5.1 manager and Opus 5.5 workers unless they ask for Fable workers; and demolishes one:
its workers go home, its open work goes back to the Orchestrator, its history stays."""

import pytest

from aic.lambdas.api import handle_http
from aic.runtime.tools import TurnCtx, tools_for
from aic.shared.hierarchy.departments import DepartmentError, clean_name, worker_model_choice
from aic.shared.models import department_override, model_name_for, resolve_role
from aic.shared.presets import ensure_presets, orchestrator_note
from test_api import ev, js, make
from test_task_control import SPEC, ace_tools, city, job


def test_names_and_model_choices_are_plain() -> None:
    assert clean_name("  customer   success department ") == "Customer success"
    assert clean_name("Partnerships") == "Partnerships"
    for bad in ("", "x", "1234", "a" * 41, "HQ"):
        with pytest.raises(DepartmentError):
            clean_name(bad)
    assert worker_model_choice(None) is None and worker_model_choice("") is None
    assert worker_model_choice("fable") == "fable-5-1" and worker_model_choice("Fable 5.1") == "fable-5-1"
    assert worker_model_choice(True) == "fable-5-1" and worker_model_choice("opus") == "opus-5-5"
    with pytest.raises(DepartmentError):
        worker_model_choice("gpt-5")


def test_a_departments_own_worker_model_wins_for_workers_only() -> None:
    fable = {"name": "Customer Success", "worker_model": "fable-5-1"}
    assert model_name_for("worker", "Customer Success") == "opus-5-5"
    assert model_name_for("worker", "Customer Success", fable) == "fable-5-1"
    assert model_name_for("manager", "Customer Success", fable) == "fable-5-1"  # every manager is Fable anyway
    r = resolve_role("worker", department="Customer Success", dept=fable, application_profiles={"worker": "arn:w"})
    assert r.primary.name == "fable-5-1" and r.fallback is not None and r.fallback.name == "opus-5-5"
    assert r.primary.invoke_id == r.primary.profile_id  # the worker's app profile copies Opus, so Fable goes direct
    # Opus chosen for a department whose config says Fable: the owner's choice wins; no override needed elsewhere.
    assert department_override("worker", "Media", dept={"worker_model": "opus-5-5"}) is None
    assert model_name_for("worker", "Media") == "fable-5-1"
    assert model_name_for("worker", "Media", {"worker_model": ""}) == "fable-5-1"


async def test_aic_builds_a_department_with_opus_workers_and_a_tower_event() -> None:
    c = await city()
    said = await ace_tools(c)["build_department"].handler(
        {"name": "Customer Success", "mission": "Keep customers happy and renewing."}
    )
    assert said.startswith("Built Customer Success") and "Claude Fable 5.1" in said and "Claude Opus 5.5" in said
    dept = await c.ledger.get_department("Customer Success")
    assert dept and dept["state"] == "active" and dept["built_by"] == "owner" and not dept.get("worker_model")
    (e,) = c.bus.of_type("department.created")
    assert e["name"] == "Customer Success" and "worker_model" not in e
    # Its manager is Fable (hired with its first goal); its workers are Opus.
    task = await c.ledger.create_ticket(
        {"goal": "Write a renewal email", "from": "ace", "to": "orchestrator", "department": None,
         "parent_id": None, "kind": "task", "status": "open"}
    )  # fmt: skip
    orch = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"], task_id=task["id"]
    )
    orch_tools = {t.name: t for t in tools_for(c.host.d, orch)}
    await orch_tools["assign_to_department"].handler(
        {"department": "Customer Success", "goal": "A renewal email", "acceptance": "One email"}
    )
    mgr = await c.ledger.get_agent(dept["manager_id"])
    assert mgr and mgr["model"] == "fable-5-1"
    w = await c.factory.hire(SPEC, dept["manager_id"], "Customer Success")
    assert w["model"] == "opus-5-5"
    again = await ace_tools(c)["build_department"].handler({"name": "customer success"})
    assert "already standing" in again and len(c.bus.of_type("department.created")) == 1


async def test_fable_workers_only_when_the_owner_asks() -> None:
    c = await city()
    said = await ace_tools(c)["build_department"].handler({"name": "Partnerships", "worker_model": "fable-5-1"})
    assert "workers run on Claude Fable 5.1" in said
    dept = await c.ledger.get_department("Partnerships")
    assert dept and dept["worker_model"] == "fable-5-1"
    assert c.bus.of_type("department.created")[0]["worker_model"] == "fable-5-1"
    w = await c.factory.hire(SPEC, dept["manager_id"], "Partnerships")
    assert w["model"] == "fable-5-1"


async def test_the_ceiling_counts_only_the_owners_own_departments() -> None:
    c = await city()
    await c.ledger.update_settings({"max_departments": 1})
    tools = ace_tools(c)
    assert (await tools["build_department"].handler({"name": "Partnerships"})).startswith("Built")
    refused = await tools["build_department"].handler({"name": "Events"})
    assert refused.startswith("Not built:") and "limit is 1" in refused
    assert (await tools["build_department"].handler({"name": "Finance"})).startswith("Built Finance")  # a preset
    await tools["demolish_department"].handler({"name": "Partnerships", "confirm": True})
    assert (await tools["build_department"].handler({"name": "Events"})).startswith("Built")  # room again


async def test_demolish_asks_first_then_sends_workers_home_hands_work_back_and_keeps_history() -> None:
    c = await city()
    task = await job(c, "Write 50 sentences about the GT3", "porsche sentences", "Writing", workers=2)
    tools = ace_tools(c)
    ask = await tools["demolish_department"].handler({"name": "writing department", "confirm": False})
    assert ask.startswith("Demolish Writing? 2 workers go home and 3 unfinished parts go back to the Orchestrator.")
    assert (await c.ledger.get_department("Writing"))["state"] == "active"  # not yet

    said = await tools["demolish_department"].handler({"name": "Writing", "confirm": True})
    assert said.startswith("Demolished Writing: 2 workers went home, 3 unfinished parts went back")
    dept = await c.ledger.get_department("Writing")
    assert dept and dept["state"] == "demolished" and dept.get("demolished_at")  # the record stays: history
    assert "Writing" not in [x["name"] for x in await c.ledger.list_departments()]
    assert "Writing" in [x["name"] for x in await c.ledger.list_departments(include_demolished=True)]
    workers = [a for a in await c.ledger.list_agents() if a["kind"] == "worker"]
    assert workers and all(w["state"] == "retired" for w in workers)
    assert (await c.ledger.get_agent("mgr-writing"))["state"] == "retired"
    kids = await c.ledger.child_tickets(task["id"])
    assert kids and all(k["status"] == "cancelled" for k in kids)
    assert (await c.ledger.get_ticket(task["id"]))["status"] == "in_progress"  # the job is the Orchestrator's again
    (handed,) = [m for m in c.queue.sent if m["role"] == "orchestrator" and "demolished" in m["body"]]
    assert handed["taskId"] == task["id"] and "Do not create or use Writing again" in handed["body"]
    (e,) = c.bus.of_type("department.demolished")
    assert e == {**e, "name": "Writing", "workers": 2, "parts": 3}
    # The Orchestrator can neither use nor recreate it.
    orch = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"], task_id=task["id"]
    )
    orch_tools = {t.name: t for t in tools_for(c.host.d, orch)}
    assert "demolished" in await orch_tools["assign_to_department"].handler(
        {"department": "Writing", "goal": "x", "acceptance": "y"}
    )
    assert "Refused" in await orch_tools["create_department"].handler({"name": "Writing", "mission": "Words."})
    assert "no standing department" in await tools["demolish_department"].handler({"name": "Writing", "confirm": True})
    # The owner can build it again.
    assert (await tools["build_department"].handler({"name": "Writing"})).startswith("Rebuilt Writing")
    assert (await c.ledger.get_department("Writing"))["state"] == "active"


async def test_a_demolished_preset_is_not_put_back_and_leaves_the_orchestrators_list() -> None:
    c = await city()
    await ensure_presets(c.ledger)
    said = await ace_tools(c)["demolish_department"].handler({"name": "Finance", "confirm": True})
    assert said.startswith("Demolished Finance: 0 workers")
    assert await ensure_presets(c.ledger) == []
    assert "Finance" not in [x["name"] for x in await c.ledger.list_departments()]
    assert "- Finance:" not in orchestrator_note({"finance"}) and "- Finance:" in orchestrator_note()


async def test_the_http_api_builds_and_demolishes() -> None:
    d = make()
    r = await handle_http(ev("POST", "/departments", {"name": "Customer Success", "worker_model": "fable"}), d)
    assert r["statusCode"] == 201 and js(r)["department"]["worker_model"] == "fable-5-1"
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
    assert ("POST", "/departments") in __import__("aic.lambdas.api", fromlist=["ROUTES"]).ROUTES
