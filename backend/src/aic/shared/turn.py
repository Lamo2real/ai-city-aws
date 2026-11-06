"""One gate for every model turn: pause flag, spend caps, throttling back-off, the Fable → Opus fallback
(exactly once), and the ledger cost row.

Model runners are injected, so tests use fakes and never call Bedrock.
"""

from __future__ import annotations

import asyncio
import json
import random as _random
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, TypeVar

from .caps import CityPaused, SpendCapReached, check_caps
from .cost import ZERO_USAGE, Usage, cache_savings_usd, estimate_usd
from .events import EventBus
from .ledger import Ledger
from .models import ResolvedModel, RoleModels

StopReason = Literal["end_turn", "refusal", "max_tokens", "tool_use"]
Outcome = Literal["ok", "refused", "no_verdict", "error", "timeout"]
Verdict = Literal["PASS", "FAIL"]


@dataclass(frozen=True)
class TurnInput:
    role: str
    agent_id: str
    session_id: str
    model: ResolvedModel
    cache_ttl: str
    prompt: str


@dataclass(frozen=True)
class TurnOutput:
    text: str
    stop_reason: StopReason = "end_turn"
    """"refusal" when the model declined; the gate then falls back once."""
    usage: Usage = ZERO_USAGE


class ModelRunner(Protocol):
    def __call__(self, input: TurnInput, /) -> Awaitable[TurnOutput]: ...


class ModelUnavailable(RuntimeError):
    pass


class TurnTimeout(RuntimeError):
    pass


_THROTTLE = re.compile(
    r"ThrottlingException|TooManyRequests|ServiceUnavailable|ModelNotReady|\b429\b|\b503\b|rate.?exceeded|throttl", re.I
)
_UNAVAILABLE = re.compile(
    r"ModelUnavailable|ResourceNotFound|AccessDenied.*model|model.*not.*(available|enabled)|ValidationException.*model",
    re.I,
)


def _describe(e: BaseException) -> str:
    code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code", "")
    return f"{type(e).__name__} {code} {e}"


def is_throttle(e: BaseException) -> bool:
    return bool(_THROTTLE.search(_describe(e)))


def is_unavailable(e: BaseException) -> bool:
    return isinstance(e, ModelUnavailable) or bool(_UNAVAILABLE.search(_describe(e)))


@dataclass
class BackoffOptions:
    retries: int = 5
    base_ms: int = 1000
    cap_ms: int = 30_000
    sleep: Callable[[float], Awaitable[None]] = field(default=lambda ms: asyncio.sleep(ms / 1000))
    random: Callable[[], float] = _random.random
    on_retry: Callable[[int, int], None] | None = None


T = TypeVar("T")


async def with_backoff(fn: Callable[[], Awaitable[T]], o: BackoffOptions | None = None) -> T:
    """Full-jitter exponential back-off for throttling only. Throttling is never a pause."""
    opts = o or BackoffOptions()
    attempt = 0
    while True:
        try:
            return await fn()
        except Exception as e:
            if not is_throttle(e) or attempt >= opts.retries:
                raise
            delay = int(opts.random() * min(opts.cap_ms, opts.base_ms * 2**attempt))
            if opts.on_retry:
                opts.on_retry(attempt + 1, delay)
            await opts.sleep(delay)
            attempt += 1


@dataclass
class GatedTurn:
    kind: str
    role: str
    agent_id: str
    session_id: str
    department: str | None
    ticket_id: str | None
    models: RoleModels
    prompt: str
    prefix: str | None = None
    needs_verdict: bool = False
    """For review and sign-off turns: a turn without a PASS/FAIL verdict counts as "no verdict"."""
    timeout_ms: int | None = None
    turn_id: str | None = None


@dataclass
class GateDeps:
    ledger: Ledger
    bus: EventBus
    runner: ModelRunner
    settings: dict[str, Any]
    backoff: BackoffOptions | None = None


@dataclass(frozen=True)
class GatedResult:
    output: TurnOutput
    model: ResolvedModel
    fallback: bool
    verdict: Verdict | None
    usd: float


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")
_VERDICT_LINE = re.compile(r"^\s*(?:verdict\s*:\s*)?(PASS|FAIL)\b", re.I | re.M)


def parse_verdict(text: str) -> Verdict | None:
    """A verdict counts only if the reply carries one on its own line or as JSON: PASS or FAIL."""
    t = text.strip()
    try:
        j = json.loads(_FENCE.sub("", t))
        if isinstance(j, dict) and j.get("verdict") in ("PASS", "FAIL"):
            return j["verdict"]
    except ValueError:
        pass
    m = _VERDICT_LINE.search(t)
    return m.group(1) if m else None  # type: ignore[return-value]


async def run_gated_turn(t: GatedTurn, d: GateDeps) -> GatedResult:
    if await d.ledger.is_paused():
        raise CityPaused("The city is paused. No new turns start until the owner resumes it.")
    cap = await check_caps(d.ledger, d.settings, t.kind, t.department)
    if not cap.ok:
        await d.bus.put(
            {
                "type": "spend.cap_reached",
                "cap": cap.cap,
                "department": cap.department,
                "spent": cap.spent,
                "limit": cap.limit,
            }
        )
        raise SpendCapReached(cap)

    async def attempt(model: ResolvedModel) -> TurnOutput:
        timeout = t.timeout_ms or 15 * 60_000

        async def once() -> TurnOutput:
            return await d.runner(
                TurnInput(
                    role=t.role,
                    agent_id=t.agent_id,
                    session_id=t.session_id,
                    model=model,
                    cache_ttl=t.models.cache_ttl,
                    prompt=t.prompt,
                )
            )

        try:
            return await asyncio.wait_for(with_backoff(once, d.backoff), timeout / 1000)
        except TimeoutError as e:
            raise TurnTimeout(f"turn timed out after {round(timeout / 60_000)} minutes") from e

    async def record(model: ResolvedModel, out: TurnOutput | None, fallback: bool, outcome: Outcome) -> float:
        usage = out.usage if out else ZERO_USAGE
        usd = estimate_usd(model.name, usage, t.prefix or "global")
        _, today = await d.ledger.record_turn(
            {
                "id": f"{t.turn_id}{'-fb' if fallback else ''}" if t.turn_id else None,
                "agent": t.agent_id,
                "role": t.role,
                "department": t.department,
                "ticket_id": t.ticket_id,
                "kind": t.kind,
                "model": model.name,
                "fallback": fallback,
                "input": usage.input,
                "output": usage.output,
                "cache_read": usage.cache_read,
                "cache_write_5m": usage.cache_write_5m,
                "cache_write_1h": usage.cache_write_1h,
                "usd": usd,
                "cache_savings_usd": cache_savings_usd(model.name, usage, t.prefix or "global"),
                "outcome": outcome,
            }
        )
        tokens = usage.input + usage.output + usage.cache_read + usage.cache_write_5m + usage.cache_write_1h
        if out:
            await d.bus.put(
                {
                    "type": "cost.update",
                    "agent": t.agent_id,
                    "role": t.role,
                    "department": t.department,
                    "model": model.name,
                    "usd": usd,
                    "tokens": tokens,
                    "today": today,
                }
            )
        return usd

    primary = t.models.primary
    why: Outcome = "ok"
    try:
        first = await attempt(primary)
        verdict = parse_verdict(first.text) if t.needs_verdict else None
        if first.stop_reason == "refusal":
            why = "refused"
        elif t.needs_verdict and not verdict:
            why = "no_verdict"
        if why == "ok" or not t.models.fallback:
            usd = await record(primary, first, False, why)
            return GatedResult(first, primary, False, verdict, usd)
        await record(primary, first, False, why)
    except Exception as e:
        if not (is_unavailable(e) and t.models.fallback):
            await record(primary, None, False, "timeout" if isinstance(e, TurnTimeout) else "error")
            raise
    # Exactly one fallback turn. Whatever it returns is final: a refusal never loops.
    fb = t.models.fallback
    assert fb is not None
    out = await attempt(fb)
    verdict = parse_verdict(out.text) if t.needs_verdict else None
    outcome: Outcome = (
        "refused" if out.stop_reason == "refusal" else "no_verdict" if t.needs_verdict and not verdict else "ok"
    )
    usd = await record(fb, out, True, outcome)
    return GatedResult(out, fb, True, verdict, usd)
