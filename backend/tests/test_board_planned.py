"""Medium, large and extreme jobs on the project board (decision 289, stage 3): the planner writes parts to the board
and each one starts the moment it can; Haiku for trivial parts with an upgrade to Sonnet; department reviewers on Opus
(Fable on extreme, with security and cost checks for AWS parts); a single worker growing into a team; the whole-app
check; one app built by several workers in one shared copy."""

# ruff: noqa: ASYNC240 (test workers write their files like a real worker does)
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from city_support import Call, City, make_city, make_department, scripted_engine
from test_apps import FakeS3
from vaic.lambdas.ledger_writer import write_event
from vaic.runtime import tools as tools_mod
from vaic.runtime.engine import EngineRequest
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared.apps import Workspace
from vaic.shared.board import Board
from vaic.shared.hierarchy import board_path as board
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.utility import Triage

MEDIUM = "build me a memory game with animals"


@pytest.fixture(autouse=True)
def triage_builders(monkeypatch: pytest.MonkeyPatch) -> None:
    async def triage(*_: Any, **__: Any) -> Triage:
        return Triage("department", "Builders", "test")

    monkeypatch.setattr(tools_mod, "triage", triage)


async def good_worker(req: EngineRequest, call: Call) -> str:
    assert req.cwd
    Path(req.cwd, "out.json").write_text('{"ok": true}')
    return await call("report_to_manager", {"summary": f"Did: {req.ctx.ticket_id}", "artifacts": [], "checks": "-"})


async def passing_reviewer(req: EngineRequest, call: Call) -> str:
    assert "Board review" in req.turn.prompt
    return await call("review", {"ticket_id": req.ctx.ticket_id, "verdict": "PASS", "reasons": "Meets the acceptance."})


def planner(parts: list[dict[str, Any]], seen: dict[str, Any]) -> Any:
    async def plan(req: EngineRequest, call: Call) -> str:
        assert "Board planning" in req.turn.prompt
        seen["prompt"] = req.turn.prompt
        for p in parts:
            seen.setdefault("answers", []).append(await call("add_part", p))
            # Streaming: a part that waits for nothing has its worker before the plan is even finished.
            seen.setdefault("workers_while_planning", []).append(
                len([a for a in await req.ledger.list_agents() if a["kind"] == "worker"])
            )
        seen["done"] = await call("finish_plan", {})
        return "Planned."

    return plan


def city_with(plan: Any, worker: Any = good_worker, reviewer: Any = passing_reviewer, **settings: Any) -> City:
    async def vaic(req: EngineRequest, call: Call) -> str:
        if "(task) from owner" in req.turn.prompt:
            w = req.ctx.owner_text
            return await call("start_job", {"goal": w, "owner_words": w, "confirm": True})
        return "Done, Sir."

    city = make_city(
        scripted_engine({"vaic": vaic, "orchestrator": plan, "manager": reviewer, "worker": worker}), **settings
    )
    city.deps.utility_runner = object()

    async def project(e: dict[str, Any]) -> None:
        await write_event({"detail": e}, city.ledger)

    city.bus.on(project)
    return city


async def run(
    city: City, words: str = MEDIUM, departments: tuple[str, ...] = ("Builders", "Designers")
) -> dict[str, Any]:
    for name in departments:
        await make_department(city, name)
    await city.owner_says(words)
    await city.run(max_steps=2000)
    return next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")


def workers_by_goal(tickets: list[dict[str, Any]], agents: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for t in tickets:
        if str(t.get("to", "")).startswith("wkr-"):
            out.setdefault(str(t["goal"]), []).append(str(agents[t["to"]]["model"]))
    return out


PARTS = [
    {"name": "Cards", "goal": "Cards", "acceptance": "Cards flip", "department": "Builders", "files": ["cards.js"]},
    {
        "name": "Title",
        "goal": "Title",
        "acceptance": "Says Memory",
        "department": "Designers",
        "files": ["title.txt"],
        "trivial": True,
    },
    {
        "name": "Score",
        "goal": "Score",
        "acceptance": "Counts pairs",
        "department": "Builders",
        "after": ["Cards"],
        "files": ["score.js"],
    },
]


async def test_a_medium_job_is_planned_on_the_board_and_each_part_starts_as_soon_as_it_can() -> None:
    seen: dict[str, Any] = {}
    city = city_with(planner(PARTS, seen))
    task = await run(city)
    assert task["status"] == "done" and task["path"] == "board" and task["planned"] and task["size"] == "medium"
    (plan_inv,) = [i for i in city.invocations if i["role"] == "orchestrator"]
    assert plan_inv["model"] == "sonnet-5-5"  # the medium planner
    assert (await city.ledger.turns_of("orchestrator"))[0]["model"] == "sonnet-5-5"
    # Streaming: Cards and Title had workers while the planner was still writing; Score waited for Cards.
    assert seen["workers_while_planning"] == [1, 2, 2]
    assert "starts now" in seen["answers"][0] and "starts when Cards is done" in seen["answers"][2]
    agents = {a["id"]: a for a in await city.ledger.list_agents()}
    every = await city.ledger.list_tickets(ALL_STATUSES)
    models = workers_by_goal(every, agents)
    assert models["Cards"] == ["sonnet-5-5"] and models["Score"] == ["sonnet-5-5"]
    assert models["Title"] == ["sonnet-5-5"]  # trivial or not, every worker is Sonnet (decision 300)
    check = next(t for t in every if t.get("check"))
    assert models[check["goal"]] == ["opus-5-5"]  # the whole-app check, on the reviewer's model
    # Score started only after Cards was done; the check after everything.
    cards, score = (
        next(t for t in every if t["goal"] == g and t.get("to", "").startswith("wkr-")) for g in ("Cards", "Score")
    )
    assert score["created_at"] >= cards["updated_at"]
    assert check["created_at"] >= max(t["updated_at"] for t in every if t.get("plan_key") and not t.get("check"))
    # Reviews: the non-trivial parts on Opus, the trivial one and the check not at all.
    reviewed = {i["ticketId"] for i in city.invocations if i["role"] == "manager"}
    assert reviewed == {cards["id"], score["id"]}
    assert all(i["model"] == "opus-5-5" for i in city.invocations if i["role"] == "manager")
    # One goal per department, all closed; every worker home; VAIC told once.
    goals = [t for t in every if t.get("parent_id") == task["id"]]
    assert sorted(g["department"] for g in goals) == ["Builders", "Designers"]
    assert all(g["status"] == "done" for g in goals)
    assert all(a["state"] == "retired" for a in agents.values() if a["kind"] == "worker")
    assert len([i for i in city.invocations if i["role"] == "vaic" and i["kind"] == "report"]) == 1
    assert task["result"].startswith("Did: ")  # the check's report is the job's result
    b = await Board(city.ledger.table, city.ledger.get_ticket).read(task["id"])
    assert b and {"planning", "spinup", "work", "tests", "review"} <= set(b["timings"]["stages"])


@pytest.mark.parametrize(
    ("words", "size", "planner_model", "reviewer_model"),
    [
        (
            "build a recipe app with login, favourites, a shopping list, meal plans, sharing, dark mode, search, filters and "
            "offline mode",
            "large",
            "opus-5-5",
            "opus-5-5",
        ),
        (
            "build a SaaS invoicing platform on AWS with Cognito auth, DynamoDB and Lambda",
            "extreme",
            "fable-5-1",
            "fable-5-1",
        ),
    ],
)
async def test_bigger_planners_and_reviewers_by_size(
    words: str, size: str, planner_model: str, reviewer_model: str
) -> None:
    seen: dict[str, Any] = {}
    parts = [
        {"name": "App", "goal": "The app", "acceptance": "Works", "department": "Builders"},
        {
            "name": "Infra",
            "goal": "AWS setup in Terraform",
            "acceptance": "Deploys",
            "department": "Builders",
            "aws": True,
        },
    ]
    prompts: list[str] = []

    async def reviewer(req: EngineRequest, call: Call) -> str:
        prompts.append(req.turn.prompt)
        return await passing_reviewer(req, call)

    city = city_with(planner(parts, seen), reviewer=reviewer)
    task = await run(city, words)
    assert task["size"] == size and task["status"] == "done"
    assert [i["model"] for i in city.invocations if i["role"] == "orchestrator"] == [planner_model]
    assert {i["model"] for i in city.invocations if i["role"] == "manager"} == {reviewer_model}
    infra = next(p for p in prompts if "AWS setup" in p)
    assert "security" in infra and "cost" in infra  # an AWS part's review adds security and cost checks
    if size == "extreme":
        assert "investigate first" in seen["prompt"] and "IT Infrastructure" in seen["prompt"]
        assert len(prompts) == 2  # every part reviewed on extreme


async def test_every_worker_is_sonnet_until_a_part_fails_twice() -> None:
    """Decision 300: no Haiku path and no upgrade. A trivial part fails once and stays on Sonnet; only after a second
    failure does a fresh Opus worker take it over."""

    async def worker(req: EngineRequest, call: Call) -> str:
        assert req.cwd
        me = (await req.ledger.get_agent(req.ctx.agent_id) or {}).get("model")
        Path(req.cwd, "out.json").write_text("{}" if me == "opus-5-5" else "{broken")
        first = await call("report_to_manager", {"summary": "done", "artifacts": [], "checks": "-"})
        if first.startswith("Not reported"):
            return await call("report_to_manager", {"summary": "done again", "artifacts": [], "checks": "-"})
        return first

    parts = [{"name": "Title", "goal": "Title", "acceptance": "Says Memory", "department": "Builders", "trivial": True}]
    city = city_with(planner(parts, {}), worker=worker)
    task = await run(city)
    assert task["status"] == "done"
    title = sorted(
        (t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["goal"] == "Title"), key=lambda t: t["created_at"]
    )
    agents = {a["id"]: a for a in await city.ledger.list_agents()}
    assert [agents[t["to"]]["model"] for t in title] == ["sonnet-5-5", "opus-5-5"]
    hired = [e["agent"] for e in city.bus.of_type("agent.hired") if e["agent"]["kind"] == "worker"]
    assert {h["model"] for h in hired} == {"sonnet-5-5", "opus-5-5"}  # never Haiku or Fable on a medium job


async def test_no_code_path_hires_a_worker_on_haiku() -> None:
    from vaic.shared.hierarchy.factory import Factory, HireRefused

    city = make_city(scripted_engine({}))
    mgr = await make_department(city, "Builders")
    f = Factory(city.ledger, city.bus, city.deps.settings)
    spec = {"specialty": "Writer", "instructions": "Write the piece.", "tools": ["Read"]}
    assert (await f.hire(spec, mgr, "Builders"))["model"] == "sonnet-5-5"  # no model named: the map's worker
    with pytest.raises(HireRefused):
        await f.hire(spec, mgr, "Builders", "haiku-5-5")


async def test_a_single_worker_that_finds_the_job_bigger_hands_it_to_a_planner() -> None:
    seen: dict[str, Any] = {}

    async def worker(req: EngineRequest, call: Call) -> str:
        task = await req.ledger.get_ticket(req.ctx.task_id)
        if task and not task.get("planned"):
            return await call("needs_a_team", {"findings": "It needs new screens, scoring and sounds: three parts."})
        return await good_worker(req, call)

    parts = [{"name": "Screens", "goal": "Screens", "acceptance": "Shown", "department": "Builders"}]
    city = city_with(planner(parts, seen), worker=worker)
    task = await run(city, "fix the typo on the about page")
    assert task["status"] == "done" and task["size"] == "medium" and task["planned"]
    assert "found it bigger" in seen["prompt"] and "three parts" in seen["prompt"]
    first = next(
        t
        for t in await city.ledger.list_tickets(ALL_STATUSES)
        if t["goal"] == "fix the typo on the about page" and t.get("to", "").startswith("wkr-")
    )
    assert first["status"] == "cancelled"


async def test_the_plan_keeps_one_owner_per_file_known_departments_and_known_parts() -> None:
    answers: list[str] = []

    async def plan(req: EngineRequest, call: Call) -> str:
        answers.append(
            await call("add_part", {"name": "Alpha", "goal": "part a", "acceptance": "done a", "department": "Nowhere"})
        )
        answers.append(
            await call(
                "add_part",
                {
                    "name": "Alpha",
                    "goal": "part a",
                    "acceptance": "done a",
                    "department": "Builders",
                    "files": ["x.js"],
                },
            )
        )
        answers.append(
            await call(
                "add_part",
                {"name": "Beta", "goal": "part b", "acceptance": "done b", "department": "Builders", "files": ["x.js"]},
            )
        )
        answers.append(
            await call(
                "add_part",
                {
                    "name": "Gamma",
                    "goal": "part c",
                    "acceptance": "done c",
                    "department": "Builders",
                    "after": ["Zeta"],
                },
            )
        )
        answers.append(
            await call(
                "add_part", {"name": "Alpha", "goal": "part a", "acceptance": "done a", "department": "Builders"}
            )
        )
        answers.append(await call("finish_plan", {}))
        answers.append(
            await call(
                "add_part", {"name": "Delta", "goal": "part d", "acceptance": "done d", "department": "Builders"}
            )
        )
        return "x"

    city = city_with(plan)
    await run(city)
    assert answers[0].startswith("There is no department called Nowhere")
    assert "starts now" in answers[1]
    assert "x.js already belong to Alpha" in answers[2]
    assert answers[3].startswith("Add these parts first")
    assert answers[4] == "There is already a part called Alpha."
    assert answers[5].startswith("Plan finished: 1 part")
    assert answers[6] == "The plan is finished; no more parts."


# ---------- one app, several workers, one shared copy ----------
async def test_parts_of_one_app_share_a_copy_and_save_only_their_own_changes(tmp_path: Path) -> None:
    city = make_city(scripted_engine({}))
    s3 = FakeS3()
    city.deps.workspace = Workspace(
        bucket="ws", s3_for=lambda _h: s3, root=str(tmp_path), apps_url="https://apps.vaic.test"
    )
    await make_department(city, "Application")
    task = await city.ledger.create_ticket(
        {
            "goal": "memory game",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            "conversation": "app-new-x1",
            "size": "medium",
            "planned": True,
            "path": "board",
        }
    )

    async def part(name: str, worker: str) -> TurnCtx:
        t = await city.ledger.create_ticket(
            {
                "goal": name,
                "from": "mgr-application",
                "to": worker,
                "department": "Application",
                "parent_id": task["id"],
                "task_id": task["id"],
                "kind": "assignment",
                "path": "board",
                "shared_app": True,
            }
        )
        return TurnCtx(agent_id=worker, role="worker", department="Application", ticket_id=t["id"], task_id=task["id"])

    def tool(c: TurnCtx, name: str) -> Any:
        return next(t for t in tools_for(city.deps, c) if t.name == name).handler

    a, b = await part("cards", "wkr-application-a"), await part("score", "wkr-application-b")
    assert "a new app" in await tool(a, "load_app")({})
    app_a = tmp_path / "wkr-application-a" / "app"
    (app_a / "index.html").write_text("<script src='cards.js'></script>")
    (app_a / "cards.js").write_text("cards")
    out = await tool(a, "submit_app")({"title": "Memory", "description": "A memory game."})
    assert out.startswith("Saved 2 changed files to the shared copy")
    prefix = f"hires/{board.shared_hire(task['id'])}/app/"
    assert s3.keys("ws", prefix) == [prefix + "cards.js", prefix + "index.html"]
    # The second worker starts from what the first saved, and saves only its own file.
    assert "plus 2 files the other parts saved" in await tool(b, "load_app")({})
    app_b = tmp_path / "wkr-application-b" / "app"
    assert (app_b / "cards.js").read_text() == "cards"
    (app_b / "score.js").write_text("score")
    out = await tool(b, "submit_app")({"title": "Memory", "description": "A memory game."})
    assert re.match(r"Saved 1 changed file to the shared copy \(score\.js\)", out)
    assert not city.bus.of_type("app.submitted")  # no per-part drafts: the whole-app check delivers the one app


# ---------- decision 298: the board is the only path ----------
async def test_a_planned_job_still_finishes_when_the_owner_sends_a_parts_worker_home() -> None:
    from vaic.shared.hierarchy.actions import send_home

    sent: list[str] = []

    async def worker(req: EngineRequest, call: Call) -> str:
        part = await req.ledger.get_ticket(req.ctx.ticket_id)
        if part and part["goal"] == "The slow part" and not sent:
            sent.append(req.ctx.agent_id)
            me = await req.ledger.get_agent(req.ctx.agent_id)
            assert me
            await send_home(city.deps, [me])  # the owner clicks it in the City mid-turn
            return "sent home"
        return await good_worker(req, call)

    parts = [
        {"name": "Slow", "goal": "The slow part", "acceptance": "Done well", "department": "Builders"},
        {"name": "Fast", "goal": "The fast part", "acceptance": "Done well", "department": "Builders"},
    ]
    city = city_with(planner(parts, {}), worker=worker)
    task = await run(city)
    assert sent and task["status"] == "done"
    items = {i["name"]: i for i in await board.plan_items(city.deps, task["id"])}
    assert items["Slow"]["result"].startswith("Stopped") and items["Fast"]["status"] == "done"


async def test_a_finished_jobs_publish_approval_waits_for_the_owner() -> None:
    from vaic.shared.apps import put_draft
    from vaic.shared.hierarchy.actions import sweep_stale_asks

    city = make_city(scripted_engine({}))
    task = await city.ledger.create_ticket(
        {
            "goal": "g",
            "from": "vaic",
            "to": "orchestrator",
            "department": None,
            "parent_id": None,
            "kind": "task",
            "path": "board",
        }
    )
    await put_draft(
        city.ledger,
        {
            "draft_id": "drf-1",
            "ticket_id": "t-x",
            "task_id": task["id"],
            "status": "ready",
            "title": "Memory",
            "preview_url": "https://apps.vaic.test/drafts/drf-1/index.html",
            "created_at": "2026-11-12T10:00:00Z",
        },
    )
    await board.finish_job(city.deps, task, "The game has 4 pairs.")
    assert (await city.ledger.get_ticket(task["id"]) or {})["status"] == "done"
    (pending,) = await city.ledger.pending_approvals()
    assert pending["kind"] == "app.publish"
    await sweep_stale_asks(city.ledger, city.bus)  # the 5-minute sweep leaves it too
    assert len(await city.ledger.pending_approvals()) == 1
    assert not city.bus.of_type("approval.withdrawn")
