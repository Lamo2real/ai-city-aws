"""Team sizing (decision 283): as many workers as parts that can run at the same time, and no more. The manager's
`plan_team` tool went with the Orchestrator chain (decision 298); the project board's planner writes parts instead."""

from typing import Any

import pytest

from vaic.shared.hierarchy.team_size import Part, PlanError, parse_parts, size_team


def size(parts: list[dict[str, Any]], asked: int | None = None) -> Any:
    return size_team(parse_parts(parts), owner_asked=asked)


def test_a_tiny_edit_gets_one_worker() -> None:
    t = size([{"name": "change to 4 pairs", "size": "tiny"}])
    assert t.workers == 1 and t.reason.startswith("1 worker: a small change")


def test_several_tiny_edits_share_one_worker() -> None:
    assert size([{"name": f"edit {i}", "size": "tiny"} for i in range(6)]).workers == 1


def test_three_independent_parts_get_three_workers() -> None:
    t = size(
        [
            {"name": "UI", "size": "normal"},
            {"name": "game logic", "size": "normal"},
            {"name": "tests", "size": "normal"},
        ]
    )
    assert t.workers == 3 and t.reason == "3 workers: UI, game logic and tests run in parallel"


def test_a_dependent_chain_needs_fewer() -> None:
    t = size(
        [
            {"name": "schema", "size": "normal"},
            {"name": "API", "size": "normal", "after": ["schema"]},
            {"name": "UI", "size": "normal", "after": ["API"]},
        ]
    )
    assert t.workers == 1 and "one after another" in t.reason
    assert t.waves == (("schema",), ("API",), ("UI",))


def test_the_widest_wave_decides_and_tiny_parts_ride_along() -> None:
    t = size(
        [
            {"name": "data model", "size": "normal"},
            {"name": "bump version", "size": "tiny"},
            {"name": "UI", "size": "normal", "after": ["data model"]},
            {"name": "game logic", "size": "normal", "after": ["data model"]},
        ]
    )
    assert t.workers == 2 and t.reason.startswith("2 workers: UI and game logic run in parallel")


def test_the_owner_override_wins_over_the_parts() -> None:
    t = size([{"name": "change to 4 pairs", "size": "tiny"}], asked=5)
    assert t.workers == 5 and t.reason == "5 workers: the owner asked for 5"


def test_no_ceiling_500_parallel_parts_get_500_workers() -> None:
    # The owner (decision 288): "No limit on agents, absolutely no limit."
    t = size([{"name": f"part {i}", "size": "normal"} for i in range(500)])
    assert (
        t.workers == 500
        and t.reason.startswith("500 workers: part 0, part 1")
        and "495 more run in parallel" in t.reason
    )
    assert size([{"name": "x", "size": "tiny"}], asked=1000).workers == 1000


def test_bad_plans_are_refused() -> None:
    with pytest.raises(PlanError):
        parse_parts([])
    with pytest.raises(PlanError):
        parse_parts([{"name": "a", "after": ["nope"]}])
    with pytest.raises(PlanError):
        size_team([Part("a", after=("b",)), Part("b", after=("a",))])
