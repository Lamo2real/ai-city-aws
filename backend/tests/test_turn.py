from datetime import UTC, datetime
from typing import Any

import pytest

from vaic.shared.caps import DEFAULT_SETTINGS, SpendCapReached, check_caps, settings_with, validate_caps
from vaic.shared.cost import Usage, cache_savings_usd, estimate_usd
from vaic.shared.events import MemoryBus
from vaic.shared.ledger import TURN_KINDS, Ledger
from vaic.shared.models import resolve_role
from vaic.shared.table import MemoryTable, UpdateOptions
from vaic.shared.turn import (
    BackoffOptions,
    GateDeps,
    GatedTurn,
    ModelUnavailable,
    TurnInput,
    TurnOutput,
    parse_verdict,
    run_gated_turn,
    with_backoff,
)

USAGE = Usage(input=1000, output=500, cache_read=2000, cache_write_5m=0, cache_write_1h=100)


async def _no_sleep(_: float) -> None:
    return None


NO_SLEEP = BackoffOptions(sleep=_no_sleep, random=lambda: 0.5)
# Caps are off by default; these tests set them explicitly to check the brake when the owner wants one.
CAPPED = settings_with(daily_global_usd=10, monthly_budget_usd=150, daily_department_usd=5)


def reply(text: str, stop: str = "end_turn") -> TurnOutput:
    return TurnOutput(text=text, stop_reason=stop, usage=USAGE)  # type: ignore[arg-type]


class Runner:
    def __init__(self, fn: Any) -> None:
        self.fn = fn
        self.calls: list[TurnInput] = []

    async def __call__(self, i: TurnInput) -> TurnOutput:
        self.calls.append(i)
        r = self.fn(i)
        if hasattr(r, "__await__"):
            r = await r
        return r  # type: ignore[no-any-return]


def setup(runner: Any, settings: dict[str, Any] | None = None) -> tuple[Ledger, MemoryBus, GateDeps]:
    clock = lambda: datetime(2026, 11, 6, 10, 0, tzinfo=UTC)  # noqa: E731
    ledger = Ledger(MemoryTable(), clock)
    bus = MemoryBus()
    return ledger, bus, GateDeps(ledger=ledger, bus=bus, runner=runner, settings=settings or CAPPED, backoff=NO_SLEEP)


def turn(role: str, kind: str | None = None, **extra: Any) -> GatedTurn:
    dept = extra.pop("department", "Engineering" if role in ("worker", "manager") else None)
    return GatedTurn(
        kind=kind or role,
        role=role,
        agent_id=f"{role}-1",
        session_id="s" * 33,
        department=dept,
        ticket_id="t-1",
        models=resolve_role(role, department=dept),  # type: ignore[arg-type]
        prompt="do it",
        **extra,
    )


# ---------- cost math ----------
def test_prices_each_token_class_with_5_minute_and_1_hour_cache_writes() -> None:
    u = Usage(1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000)
    # opus: 4 + 20 + 0.2 + 4*1.25 + 4*2 = 37.2
    assert estimate_usd("opus-5-5", u) == pytest.approx(37.2)
    assert estimate_usd("fable-5-1", Usage(1_000_000, 1_000_000, 1_000_000)) == pytest.approx(60.25)  # 10 + 50 + 0.25


def test_geo_profiles_cost_10pct_more_and_haiku_over_100k_costs_5x() -> None:
    assert estimate_usd("sonnet-5-5", Usage(input=1_000_000), "eu") == pytest.approx(2.2)
    assert estimate_usd("haiku-5-5", Usage(input=90_000)) == pytest.approx(0.009)
    assert estimate_usd("haiku-5-5", Usage(input=110_000)) == pytest.approx(0.055)


def test_cache_savings_compare_against_paying_full_input_for_cached_tokens() -> None:
    assert cache_savings_usd("opus-5-5", Usage(cache_read=1_000_000)) == pytest.approx(3.8)


# ---------- spend caps ----------
async def test_the_defaults_have_no_caps_and_a_turn_runs_however_much_was_spent() -> None:
    assert DEFAULT_SETTINGS["daily_global_usd"] is None
    assert DEFAULT_SETTINGS["monthly_budget_usd"] is None
    assert DEFAULT_SETTINGS["daily_department_usd"] is None
    runner = Runner(lambda _: reply("ok"))
    ledger, bus, deps = setup(runner, settings_with())
    await ledger.table.update("SPEND#DAY#2026-11-06", "GLOBAL", UpdateOptions(add={"usd": 100_000}))
    await ledger.table.update("SPEND#MONTH#2026-11", "GLOBAL", UpdateOptions(add={"usd": 1_000_000}))
    await ledger.table.update("SPEND#DAY#2026-11-06", "DEPT#engineering", UpdateOptions(add={"usd": 50_000}))
    await run_gated_turn(turn("worker"), deps)
    assert len(runner.calls) == 1
    assert bus.of_type("spend.cap_reached") == []
    assert (await check_caps(ledger, settings_with(), "worker", "Engineering")).ok


@pytest.mark.parametrize("kind", TURN_KINDS)
async def test_turns_of_every_kind_stop_at_the_daily_global_cap(kind: str) -> None:
    runner = Runner(lambda _: reply("ok"))
    ledger, bus, deps = setup(runner)
    await ledger.table.update("SPEND#DAY#2026-11-06", "GLOBAL", UpdateOptions(add={"usd": 10}))
    role = "utility" if kind in ("compaction", "eval") else kind
    with pytest.raises(SpendCapReached):
        await run_gated_turn(turn(role, kind), deps)
    assert runner.calls == []
    assert bus.of_type("spend.cap_reached")[0]["cap"] == "daily_global"


async def test_the_monthly_cap_and_the_department_cap_block_too() -> None:
    ledger, _, _ = setup(Runner(lambda _: reply("ok")))
    await ledger.table.update("SPEND#MONTH#2026-11", "GLOBAL", UpdateOptions(add={"usd": 150}))
    c = await check_caps(ledger, CAPPED, "worker", None)
    assert not c.ok and c.cap == "monthly"
    l2, _, _ = setup(Runner(lambda _: reply("ok")))
    await l2.table.update("SPEND#DAY#2026-11-06", "DEPT#engineering", UpdateOptions(add={"usd": 5}))
    c2 = await check_caps(l2, CAPPED, "worker", "Engineering")
    assert not c2.ok and c2.cap == "daily_department"
    assert (await check_caps(l2, CAPPED, "worker", "Research")).ok


def test_accepts_any_cap_of_zero_or_more_or_none_and_rejects_impossible_values() -> None:
    assert "zero or more" in (validate_caps({"daily_global_usd": -1}) or "")
    assert "zero or more" in (validate_caps({"daily_global_usd": float("nan")}) or "")
    assert validate_caps({"daily_global_usd": 500_000}) is None
    assert validate_caps({"daily_global_usd": None, "monthly_budget_usd": None, "daily_department_usd": None}) is None


# ---------- throttling ----------
class Throttled(Exception):
    pass


async def test_retries_a_throttled_call_with_jittered_back_off_and_succeeds() -> None:
    calls = 0
    delays: list[int] = []

    async def fn(_: TurnInput) -> TurnOutput:
        nonlocal calls
        calls += 1
        if calls < 3:
            raise RuntimeError("ThrottlingException: Rate exceeded")
        return reply("done")

    _, _, deps = setup(fn)
    deps.backoff = BackoffOptions(sleep=_no_sleep, random=lambda: 0.5, on_retry=lambda _a, d: delays.append(d))
    r = await run_gated_turn(turn("worker"), deps)
    assert r.output.text == "done"
    assert calls == 3
    assert delays == [500, 1000]  # random 0.5 × 1s, 0.5 × 2s


async def test_gives_up_after_the_retry_budget() -> None:
    err = RuntimeError("ThrottlingException: Too many")

    async def fn() -> None:
        raise err

    with pytest.raises(RuntimeError) as e:
        await with_backoff(fn, BackoffOptions(sleep=_no_sleep, random=lambda: 0.5, retries=2))
    assert e.value is err


async def test_does_not_retry_other_errors() -> None:
    calls = 0

    async def fn() -> None:
        nonlocal calls
        calls += 1
        raise ValueError("bad input")

    with pytest.raises(ValueError):
        await with_backoff(fn, NO_SLEEP)
    assert calls == 1


# ---------- Fable → Opus fallback ----------
async def test_a_refusal_triggers_exactly_one_fallback_turn_on_opus_marked_in_the_ledger() -> None:
    runner = Runner(
        lambda i: reply("I can't help with that.", "refusal") if i.model.name == "fable-5-1" else reply("Plan ready.")
    )
    ledger, _, deps = setup(runner)
    r = await run_gated_turn(turn("orchestrator"), deps)
    assert [c.model.name for c in runner.calls] == ["fable-5-1", "opus-5-5"]
    assert r.fallback
    turns = await ledger.turns_of("orchestrator-1")
    assert [(t["model"], t["fallback"], t["outcome"]) for t in turns] == [
        ("fable-5-1", False, "refused"),
        ("opus-5-5", True, "ok"),
    ]


async def test_a_refusal_on_the_fallback_is_final_no_loop() -> None:
    runner = Runner(lambda _: reply("no", "refusal"))
    _, _, deps = setup(runner)
    r = await run_gated_turn(turn("manager"), deps)
    assert len(runner.calls) == 2
    assert r.output.stop_reason == "refusal"


async def test_a_review_with_no_verdict_falls_back_once() -> None:
    runner = Runner(
        lambda i: (
            reply("Looks interesting.")
            if i.model.name == "fable-5-1"
            else reply('{"verdict":"FAIL","reasons":["no tests"]}')
        )
    )
    _, _, deps = setup(runner)
    r = await run_gated_turn(turn("manager", "manager", needs_verdict=True), deps)
    assert r.verdict == "FAIL"
    assert r.fallback


async def test_fable_unavailable_falls_back_to_opus() -> None:
    async def fn(i: TurnInput) -> TurnOutput:
        if i.model.name == "fable-5-1":
            raise ModelUnavailable("model not available")
        return reply("ok")

    _, _, deps = setup(fn)
    assert (await run_gated_turn(turn("orchestrator"), deps)).model.name == "opus-5-5"


async def test_a_model_bedrock_refuses_through_claude_code_falls_back_to_opus() -> None:
    """Prod, 2026-11-10 (decision 181): Fable 5.2's Marketplace subscription was missing, and Claude Code reported the
    refusal only as "AWS authentication failed". The turn goes on with Opus instead of dying."""
    for msg in (
        "RuntimeError: agent turn ended with success: AWS authentication failed · refresh your AWS credentials",
        "AccessDeniedException: Model access is denied due to IAM user or service role is not authorized to perform "
        "the required AWS Marketplace actions (aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe)",
    ):

        async def fn(i: TurnInput, msg: str = msg) -> TurnOutput:
            if i.model.name == "fable-5-1":
                raise RuntimeError(msg)
            return reply("ok")

        _, _, deps = setup(fn)
        assert (await run_gated_turn(turn("orchestrator"), deps)).model.name == "opus-5-5"


async def test_roles_without_a_fallback_never_retry_on_another_model() -> None:
    runner = Runner(lambda _: reply("no", "refusal"))
    _, _, deps = setup(runner)
    await run_gated_turn(turn("worker"), deps)
    assert len(runner.calls) == 1


async def test_records_cost_rows_with_role_department_ticket_model_tokens_and_usd() -> None:
    ledger, bus, deps = setup(Runner(lambda _: reply("ok")))
    await run_gated_turn(turn("worker"), deps)
    [t] = await ledger.turns_of("worker-1")
    assert t["role"] == "worker"
    assert t["department"] == "Engineering"
    assert t["ticket_id"] == "t-1"
    assert t["model"] == "opus-5-5"
    assert (t["input"], t["output"], t["cache_read"], t["cache_write_1h"]) == (1000, 500, 2000, 100)
    assert t["usd"] == pytest.approx(estimate_usd("opus-5-5", USAGE))
    assert (await ledger.spend("day", "DEPT#engineering"))["turns"] == 1
    assert len(bus.of_type("cost.update")) == 1


def test_parses_verdicts_only_when_the_reply_states_one() -> None:
    assert parse_verdict('{"verdict":"PASS"}') == "PASS"
    assert parse_verdict("FAIL: tests missing") == "FAIL"
    assert parse_verdict("Verdict: PASS\nGood work") == "PASS"
    assert parse_verdict("The worker said PASS somewhere") is None
