"""VAIC's job sizing and the build model map (decision 289)."""

from __future__ import annotations

import pytest

from vaic.shared.build_models import build_model_names, inference_note, models_for, needs_review, worker_model
from vaic.shared.sizing import size_job


@pytest.mark.parametrize(
    ("words", "kwargs", "size"),
    [
        ("change the memory game to 4 pairs", {"existing_app": True}, "small"),
        ("make the buttons bigger", {}, "small"),
        ("fix the typo on the about page", {}, "small"),
        ("build me a memory game with animals", {}, "medium"),
        ("make a todo app", {}, "medium"),
        (
            "build a recipe app with login, favourites, a shopping list, meal plans, sharing, dark mode, search, "
            "filters and offline mode",
            {},
            "large",
        ),
        ("build a SaaS invoicing platform on AWS with Cognito auth, DynamoDB and Lambda", {}, "extreme"),
        ("here are the business requirements for our booking product: ...", {}, "extreme"),
        ("research our three biggest competitors", {}, "small"),
        ("", {}, "small"),
    ],
)
def test_signals(words: str, kwargs: dict[str, bool], size: str) -> None:
    s = size_job(words, **kwargs)  # type: ignore[arg-type]
    assert s.size == size, (words, s)
    assert s.reason and not s.by_owner


@pytest.mark.parametrize(
    ("words", "size", "workers"),
    [
        ("go big on this: change the memory game to 4 pairs", "large", None),
        ("build a memory game, use 10 agents", "large", 10),
        ("build a memory game with 3 workers", "medium", 3),
        ("build a whole SaaS on AWS with Lambda and DynamoDB, just one worker", "small", 1),
        ("use only one agent for this app", "small", 1),
        ("single worker please: build me a todo app", "small", 1),
        ("make it extreme: change the title", "extreme", None),
        ("all hands on deck, fix the footer", "large", None),
        ("use five agents to tweak the colours", "medium", 5),
    ],
)
def test_the_owners_words_always_win(words: str, size: str, workers: int | None) -> None:
    s = size_job(words, existing_app="change" in words)
    assert (s.size, s.workers, s.by_owner) == (size, workers, True), (words, s)


def test_vaics_worker_count_is_the_owners_number() -> None:
    assert size_job("build a game", workers=1).size == "small"
    assert size_job("change the title", workers=12).size == "large"


def test_the_model_map() -> None:
    small = models_for("small")
    assert small.planner is None and small.worker == "sonnet-5-5" and small.reviewer == "opus-5-5"
    assert models_for("medium").planner == "sonnet-5-5"
    assert models_for("large").planner == "opus-5-5"
    x = models_for("extreme")
    assert (x.planner, x.reviewer, x.takeover, x.aws_checks, x.review) == (
        "fable-5-1",
        "fable-5-1",
        "fable-5-1",
        True,
        "every",
    )
    assert models_for("nonsense").size == "small"
    assert not small.whole_app_check and models_for("medium").whole_app_check
    # Haiku for trivial parts, Sonnet after one failure, the takeover model after two.
    assert worker_model("medium", trivial=True) == "haiku-5-5"
    assert worker_model("medium", trivial=True, fails=1) == "sonnet-5-5"
    assert worker_model("medium", fails=2) == "opus-5-5"
    assert worker_model("extreme", fails=2) == "fable-5-1"
    assert not needs_review("small", trivial=False, risky=False) and needs_review("small", False, True)
    assert needs_review("medium", trivial=False, risky=False) and not needs_review("medium", True, False)
    assert needs_review("extreme", trivial=True, risky=False)
    assert build_model_names() == {"haiku-5-5", "sonnet-5-5", "opus-5-5", "fable-5-1"}
    assert "global" in inference_note()
