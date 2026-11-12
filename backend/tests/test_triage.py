"""VAIC's quick triage: most questions, lists and drafts are VAIC's to answer now; only real work becomes a task."""

import json
from typing import Any

from city_support import make_city, scripted_engine
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared import utility
from vaic.shared.cost import Usage
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.turn import TurnInput, TurnOutput
from vaic.shared.utility import TRIAGE_WHEN_UNSURE, Triage, UtilityDeps, parse_triage, triage


def runner_saying(text: str) -> Any:
    seen: list[str] = []

    async def run(input: TurnInput) -> TurnOutput:
        seen.append(input.prompt)
        return TurnOutput(text=text, usage=Usage(input=40, output=12))

    run.seen = seen  # type: ignore[attr-defined]
    return run


def test_parses_the_three_routes_and_rejects_anything_else() -> None:
    assert parse_triage('{"route": "self", "department": null, "reason": "a list"}') == Triage("self", None, "a list")
    assert parse_triage('Sure: {"route": "department", "department": "Engineering", "reason": "code"}') == Triage(
        "department", "Engineering", "code"
    )
    assert parse_triage('{"route": "new_department", "department": "Legal", "reason": ""}') == Triage(
        "new_department", "Legal", ""
    )
    assert parse_triage('{"route": "maybe"}') is None
    assert parse_triage("not json") is None


async def deps(runner: Any) -> UtilityDeps:
    city = make_city(scripted_engine({}))
    return UtilityDeps(ledger=city.ledger, bus=city.bus, settings=await city.deps.settings(), runner=runner)


async def test_triage_asks_the_utility_model_once_per_request_and_is_costed() -> None:
    utility._TRIAGE_CACHE.clear()
    r = runner_saying('{"route": "self", "department": null, "reason": "a comparison"}')
    d = await deps(r)
    first = await triage("give me 50 sentences on the GT3 vs the GT3 RS engine", ["Engineering"], d)
    again = await triage("give me 50 sentences on the GT3 vs the GT3 RS engine", ["Engineering"], d)
    assert first.route == "self" and again is first
    assert len(r.seen) == 1 and "Existing departments: Engineering" in r.seen[0]
    assert (await d.ledger.spend("day", "ROLE#utility"))["turns"] == 1  # a gated, costed utility turn


async def test_a_broken_answer_routes_to_the_orchestrator() -> None:
    utility._TRIAGE_CACHE.clear()
    d = await deps(runner_saying("I'd rather not say."))
    assert await triage("do the thing", [], d) is TRIAGE_WHEN_UNSURE


def ctx() -> TurnCtx:
    return TurnCtx(
        agent_id="vaic", role="vaic", department=None, ticket_id="conv-main", task_id="conv-main", conversation="main"
    )


async def delegate_with(
    route_json: str | None,
    goal: str = "Compare the GT3 and GT3 RS engines",
    owner_words: str = "can you give me 50 sentences on …",
    confirm: bool = True,
) -> tuple[str, Any]:
    utility._TRIAGE_CACHE.clear()
    city = make_city(scripted_engine({}))
    city.deps.utility_runner = runner_saying(route_json) if route_json is not None else None
    spec = next(t for t in tools_for(city.deps, ctx()) if t.name == "start_job")
    out = await spec.handler({"goal": goal, "owner_words": owner_words, "confirm": confirm})
    return out, city


async def test_self_means_no_task_and_vaic_answers_in_the_same_turn() -> None:
    out, city = await delegate_with('{"route": "self", "department": null, "reason": "a list"}', confirm=False)
    assert out.startswith("Triage: answer this yourself now")
    assert city.queue.pending == []
    assert [t for t in await city.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"] == []


async def test_department_starts_the_job_with_the_hint_for_the_planner() -> None:
    out, city = await delegate_with('{"route": "department", "department": "Engineering", "reason": "needs code"}')
    assert out.startswith("Started: ")
    tasks = [t for t in await city.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"]
    assert len(tasks) == 1
    body = json.dumps(city.queue.pending[-1][0])
    assert "Triage suggests the Engineering department" in body
    assert "needs code" in body


async def test_new_department_hint_and_no_runner_means_delegate_as_before() -> None:
    out, city = await delegate_with('{"route": "new_department", "department": "Legal", "reason": "contracts"}')
    assert out.startswith("Started: ")
    body = json.dumps(city.queue.pending[-1][0])
    assert "Triage suggests a new department: Legal" in body
    out2, _ = await delegate_with(None)
    assert out2.startswith("Started: ")


async def test_nothing_starts_until_the_owner_said_yes() -> None:
    out, city = await delegate_with(
        '{"route": "department", "department": "Engineering", "reason": "needs code"}',
        goal="Build a snake game",
        owner_words="build me a snake game",
        confirm=False,
    )
    assert out.startswith("Ask the owner first") and "Engineering" in out and "Nothing was started" in out
    assert city.queue.pending == []
    assert [t for t in await city.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"] == []
    out2, _ = await delegate_with(None, goal="Build a snake game", owner_words="build me a snake game", confirm=False)
    assert out2.startswith("Ask the owner first") and "the team" in out2


async def test_a_complaint_about_ai_city_is_never_a_job_even_on_yes() -> None:
    for words in ("the voice is bugged, fix it", "make the voice more humane", "why is the city so slow?"):
        city = make_city(scripted_engine({}))
        city.deps.utility_runner = runner_saying('{"route": "new_department", "department": "Voice Engineering"}')
        spec = next(t for t in tools_for(city.deps, ctx()) if t.name == "start_job")
        out = await spec.handler({"goal": "Fix VAIC's voice", "owner_words": words, "confirm": True})
        assert "about AI City itself" in out and "builder session" in out, words
        assert city.queue.pending == []
        assert city.deps.utility_runner.seen == []  # not even triaged
    # An explicit "have the team …" still goes through.
    out, city = await delegate_with(
        '{"route": "department", "department": "Engineering", "reason": "code"}',
        goal="Build a voice recorder app",
        owner_words="have the team build me a voice recorder app",
    )
    assert out.startswith("Started: ")


async def test_no_more_jobs_than_the_ceiling() -> None:
    city = make_city(scripted_engine({}))
    spec = next(t for t in tools_for(city.deps, ctx()) if t.name == "start_job")
    for n in range(3):
        out = await spec.handler({"goal": f"Build thing {n}", "owner_words": f"build me thing {n}", "confirm": True})
        assert out.startswith("Started: ")
    out = await spec.handler({"goal": "Build thing 4", "owner_words": "build me thing 4", "confirm": True})
    assert out.startswith("Not started: 3 jobs already running (the limit is 3)")
    assert len([t for t in await city.ledger.list_tickets(ALL_STATUSES) if t.get("kind") == "task"]) == 3
