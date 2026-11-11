"""One department for apps, and asking before an overlapping department (decision 220).

The owner (2026-11-11): remove the Apps department, keep only Application; and when a new project would get a new
department whose work overlaps an existing one, ask first: the suggested new department, or the best-fitting
existing one (several existing departments may still share the project's parts)."""

import json
from typing import Any

from city_support import make_city, scripted_engine
from test_api import ev, js, make
from test_task_control import city, job, vaic_tools
from test_triage import ctx, runner_saying
from vaic.lambdas.api import handle_http
from vaic.lambdas.scheduler import run_job
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared import utility
from vaic.shared.apps import APPS_PK, DRAFTS_PK, home_department
from vaic.shared.hierarchy.departments import (
    MERGES_PK,
    merge_replaced_departments,
    owner_pick,
    preset_named,
)
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.presets import ensure_presets, overlapping, preset_for, replaced_by
from vaic.shared.workflows import definition


# ---------- part 1: Application is the one department for apps ----------
def test_apps_is_application_by_every_name() -> None:
    for name in ("Apps", "apps", "App", "Games", "App studio"):
        assert (preset_for(name) or {}).get("name") == "Application", name
    assert (replaced_by("Apps") or {}).get("name") == "Application"
    assert (preset_named("Apps") or {}).get("name") == "Application"  # the owner's "build Apps" is Application too
    assert replaced_by("Customer Success") is None
    assert home_department("Apps") == "Application" and home_department("Media") == "Media"
    assert (definition("app-build") or {})["department"] == "Application"


async def test_nothing_builds_an_apps_department_again() -> None:
    c = await city()
    await ensure_presets(c.ledger)
    said = await vaic_tools(c)["build_department"].handler({"name": "Apps"})
    assert said.startswith("Application is already standing")
    task = await c.ledger.create_ticket(
        {"goal": "a game", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None,
         "kind": "task", "status": "open"}
    )  # fmt: skip
    orch = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"],
                   task_id=task["id"])  # fmt: skip
    tools = {t.name: t for t in tools_for(c.host.d, orch)}
    made = await tools["create_department"].handler({"name": "Apps", "mission": "Self-contained web apps."})
    assert made == "Application already exists; use it."
    sent = await tools["assign_to_department"].handler({"department": "Apps", "goal": "Snake", "acceptance": "plays"})
    assert sent.startswith("Sent to Application")
    assert await c.ledger.get_department("Apps") is None
    assert c.bus.of_type("department.created") == []


async def test_the_old_apps_department_is_folded_into_application_once() -> None:
    c = await city()
    await ensure_presets(c.ledger)
    task = await job(c, "Build a snake game", "make me a snake game", "Apps", workers=1)  # prod: Apps exists
    await c.ledger.table.put({"pk": APPS_PK, "sk": "APP#app-snake", "app_id": "app-snake", "title": "Snake",
                              "department": "Apps", "status": "live"})  # fmt: skip
    await c.ledger.table.put({"pk": APPS_PK, "sk": "APP#app-notes", "app_id": "app-notes", "title": "Notes",
                              "department": "Media"})  # fmt: skip
    await c.ledger.table.put({"pk": DRAFTS_PK, "sk": "DRAFT#drf-1", "draft_id": "drf-1", "department": "Apps"})

    class Files:
        def __init__(self) -> None:
            self.recs = {"f-1": {"id": "f-1", "department": "Apps"}, "f-2": {"id": "f-2", "department": "Legal"}}

        async def all(self) -> list[dict[str, Any]]:
            return list(self.recs.values())

        async def update(self, file_id: str, patch: dict[str, Any]) -> None:
            self.recs[file_id].update(patch)

    (out,) = await merge_replaced_departments(c.host.d)
    assert out == {**out, "from": "Apps", "into": "Application", "demolished": True, "workers": 1, "apps": 1,
                   "drafts": 1}  # fmt: skip
    old = await c.ledger.get_department("Apps")
    assert old and old["state"] == "demolished" and old["merged_into"] == "Application"  # history stays
    assert (await c.ledger.get_agent("mgr-apps"))["state"] == "retired"
    snake = await c.ledger.table.get(APPS_PK, "APP#app-snake")
    assert snake and snake["department"] == "Application" and snake["status"] == "live"  # still published
    assert (await c.ledger.table.get(APPS_PK, "APP#app-notes"))["department"] == "Media"  # others untouched
    assert (await c.ledger.table.get(DRAFTS_PK, "DRAFT#drf-1"))["department"] == "Application"
    (handed,) = [m for m in c.queue.sent if m["role"] == "orchestrator" and "demolished" in m["body"]]
    assert handed["taskId"] == task["id"] and "Hand that part to the Application department" in handed["body"]
    # Idempotent: the deploy and every City load may call it again; with the marker in place nothing happens.
    events = len(c.bus.events)
    assert await merge_replaced_departments(c.host.d) == []
    assert len(c.bus.events) == events
    # The API passes the files store: only the files part runs, once.
    files = Files()
    (again,) = await merge_replaced_departments(c.host.d, files)
    assert again["files"] == 1 and files.recs["f-1"]["department"] == "Application"
    assert files.recs["f-2"]["department"] == "Legal"
    assert await merge_replaced_departments(c.host.d, files) == []
    mark = await c.ledger.table.get(MERGES_PK, "DEPT_MERGE#apps")
    assert mark and mark["into"] == "Application" and mark["files_moved"] and mark["apps"] == 1
    # The preset seeding never puts Apps back, and Apps work goes to Application.
    assert await ensure_presets(c.ledger) == []
    assert "Apps" not in [x["name"] for x in await c.ledger.list_departments()]


async def test_a_city_without_an_apps_department_only_gets_its_marker() -> None:
    c = await city()
    (out,) = await merge_replaced_departments(c.host.d)
    assert out == {**out, "demolished": False, "already_demolished": False, "apps": 0, "drafts": 0}
    assert c.bus.of_type("department.demolished") == []


async def test_the_deploy_job_and_the_city_load_run_the_merge() -> None:
    d = make()
    await d.ledger.create_department("Apps", "Self-contained web apps.", "mgr-apps")
    out = await run_job("merge_departments", d.ledger, d.queue, d.bus)
    assert json.loads(str(out["merged"]))[0]["into"] == "Application"
    assert (await d.ledger.get_department("Apps"))["state"] == "demolished"
    d2 = make()
    await d2.ledger.create_department("Apps", "Self-contained web apps.", "mgr-apps")
    await d2.ledger.table.put({"pk": APPS_PK, "sk": "APP#a-1", "app_id": "a-1", "title": "A", "department": "Apps"})
    city_now = js(await handle_http(ev("GET", "/city"), d2))
    assert "Apps" not in [x["name"] for x in city_now["departments"]]
    assert [a["department"] for a in city_now["apps"]] == ["Application"]


# ---------- part 2: ask before an overlapping department ----------
def test_overlap_finds_the_best_fitting_standing_department() -> None:
    from vaic.shared.presets import presets

    standing = [{"name": p["name"], "mission": p["mission"]} for p in presets()]
    assert (overlapping("Game Studio", standing) or {}).get("name") == "Application"
    assert (overlapping("Legal Tech", standing) or {}).get("name") == "Legal"
    assert overlapping("Video Production", standing) is None  # a Media alias: it is Media, no question
    assert (overlapping("Podcast Studio", standing) or {}).get("name") == "Media"
    assert overlapping("Engineering", standing) is None  # that name already is Application
    assert overlapping("Apps", standing) is None
    assert overlapping("Aviary", standing) is None  # nothing like it: no question
    assert owner_pick("New department: Game Studio", "Game Studio", "Application") == "create"
    assert owner_pick("Use Application", "Game Studio", "Application") == "use"
    assert owner_pick("do it in the existing one", "Game Studio", "Application") == "use"
    assert owner_pick("hmm", "Game Studio", "Application") is None


async def delegate(route: str, **args: Any) -> tuple[str, Any]:
    utility._TRIAGE_CACHE.clear()
    c = make_city(scripted_engine({}))
    await ensure_presets(c.ledger)
    c.deps.utility_runner = runner_saying(route)
    spec = next(t for t in tools_for(c.deps, ctx()) if t.name == "delegate_to_orchestrator")
    out = await spec.handler({"goal": "Build a puzzle game", "owner_words": "make me a puzzle game", **args})
    return out, c


GAME_STUDIO = '{"route": "new_department", "department": "Game Studio", "reason": "games"}'


async def test_vaic_asks_with_buttons_before_an_overlapping_department() -> None:
    for confirm in (False, True):  # even a yes to the job is not a choice of department
        out, c = await delegate(GAME_STUDIO, confirm=confirm)
        assert out.startswith("Ask the owner first") and "Game Studio" in out and "Application" in out
        (card,) = c.bus.of_type("vaic.question")
        assert card["options"] == ["New department: Game Studio", "Use Application", "Not now"]
        assert card["question"] == "A new Game Studio department, or do it in Application?"
        assert c.queue.pending == []
        assert [t for t in await c.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"] == []


async def test_the_owners_pick_goes_to_the_orchestrator() -> None:
    out, c = await delegate(GAME_STUDIO, confirm=True, department_choice="Use Application")
    assert out.startswith("Handed to the Orchestrator")
    (task,) = [t for t in await c.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"]
    assert task["department_choice"] == {"use": "Application"}
    body = c.queue.pending[-1][0]["body"]
    assert "existing Application department instead of a new Game Studio department" in body
    assert "other existing departments may take their own parts" in body

    out, c = await delegate(GAME_STUDIO, confirm=True, department_choice="New department: Game Studio")
    (task,) = [t for t in await c.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"]
    assert task["department_choice"] == {"create": "Game Studio"}
    assert "The owner chose a new department for this project: Game Studio" in c.queue.pending[-1][0]["body"]


async def test_no_question_when_nothing_overlaps_or_the_name_is_a_standing_department() -> None:
    out, c = await delegate('{"route": "new_department", "department": "Aviary"}', confirm=True)
    assert out.startswith("Handed to the Orchestrator") and c.bus.of_type("vaic.question") == []
    out, c = await delegate('{"route": "new_department", "department": "Engineering"}', confirm=True)
    assert out.startswith("Handed to the Orchestrator") and c.bus.of_type("vaic.question") == []
    assert "Triage suggests the Application department" in c.queue.pending[-1][0]["body"]


async def test_a_department_the_owner_asks_to_build_needs_no_question() -> None:
    c = await city()
    await ensure_presets(c.ledger)
    said = await vaic_tools(c)["build_department"].handler({"name": "Legal Tech"})
    assert said.startswith("Built Legal Tech") and c.bus.of_type("vaic.question") == []


async def orchestrator(choice: dict[str, str] | None = None) -> tuple[Any, dict[str, Any], dict[str, Any]]:
    c = await city()
    await ensure_presets(c.ledger)
    task = await c.ledger.create_ticket(
        {"goal": "a puzzle game", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None,
         "kind": "task", "status": "in_progress", **({"department_choice": choice} if choice else {})}
    )  # fmt: skip
    orch = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id=task["id"],
                   task_id=task["id"])  # fmt: skip
    return c, task, {t.name: t for t in tools_for(c.host.d, orch)}


async def test_the_orchestrator_cannot_create_an_overlapping_department_without_the_owner() -> None:
    c, task, tools = await orchestrator()
    create = tools["create_department"].handler
    out = await create({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert out.startswith("Not created yet: Game Studio overlaps Application")
    assert await c.ledger.get_department("Game Studio") is None
    (q,) = await c.ledger.open_questions()
    assert q["options"] == ["New department: Game Studio", "Use Application"]
    assert q["default_answer"] == "Use Application" and q["ticket_id"] == task["id"]
    assert "Still waiting" in await create({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert len(await c.ledger.open_questions()) == 1  # asked once
    await c.ledger.answer_question(q["id"], "Use Application", "owner")
    out = await create({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert out.startswith("Not created: the owner chose to do this project in the existing Application")
    assert (await c.ledger.get_ticket(task["id"]))["department_choice"] == {"use": "Application"}
    assert await c.ledger.get_department("Game Studio") is None

    c, task, tools = await orchestrator()
    await tools["create_department"].handler({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    (q,) = await c.ledger.open_questions()
    await c.ledger.answer_question(q["id"], "New department: Game Studio", "owner")
    out = await tools["create_department"].handler({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert out.startswith("Created Game Studio")


async def test_the_orchestrator_follows_the_choice_vaic_already_got() -> None:
    c, _, tools = await orchestrator({"create": "Game Studio"})
    out = await tools["create_department"].handler({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert out.startswith("Created Game Studio") and await c.ledger.open_questions() == []
    c, _, tools = await orchestrator({"use": "Application"})
    out = await tools["create_department"].handler({"name": "Game Studio", "mission": "Puzzle and arcade games."})
    assert out.startswith("Not created: the owner chose") and await c.ledger.open_questions() == []
    # Several existing departments can still share the project.
    for dept in ("Application", "Marketing"):
        sent = await tools["assign_to_department"].handler({"department": dept, "goal": "part", "acceptance": "ok"})
        assert sent.startswith(f"Sent to {dept}")
    c, _, tools = await orchestrator()
    out = await tools["create_department"].handler({"name": "Aviary", "mission": "Look after the birds."})
    assert out.startswith("Created Aviary") and await c.ledger.open_questions() == []
