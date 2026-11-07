"""Utility calls on Haiku 5.5: the wake-word check for unclear transcripts, ticket titles and compaction summaries.

Each is a gated turn (pause, caps, cost row) and every prompt stays well under Haiku's 100,000-token
long-context tier.
"""

from __future__ import annotations

import asyncio
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .config import repo_root
from .cost import Usage
from .events import EventBus
from .ledger import Ledger
from .models import resolve_role_from_env
from .turn import GateDeps, GatedTurn, ModelRunner, TurnInput, TurnOutput, run_gated_turn

UTILITY_MAX_CHARS = 160_000
"""About 4 characters per token: 160k characters stays near 40k tokens, far below 100k."""

_GREETING = (
    r"(?:yo|hi|hey|hello|hiya|ok|okay|morning|good (?:morning|afternoon|evening)|what'?s up|whats up|sup|"
    r"how'?s it going|hows it going)"
)
_NAME = r"(?:aic|a\.?\s?i\.?\s?c\.?)"
_ADDRESSED = re.compile(rf"^\s*(?:{_GREETING}[\s,!.]*)?{_NAME}\b", re.I)
_ENDS_WITH_NAME = re.compile(rf"[,\s]{_NAME}[\s?.!]*$", re.I)
_MENTIONS = re.compile(rf"\b{_NAME}\b", re.I)


def wake_match(transcript: str) -> Literal["yes", "no", "unclear"]:
    """Plain matching first: "yes" and "no" are decided here, only "unclear" goes to Haiku."""
    t = re.sub(r"[“”\"]", "", transcript.strip())
    if not t:
        return "no"
    if _ADDRESSED.search(t) or _ENDS_WITH_NAME.search(t):
        return "yes"
    return "unclear" if _MENTIONS.search(t) else "no"


def agents_dir() -> Path:
    env = os.environ.get("AIC_AGENTS_DIR")
    if env:
        return Path(env)
    bundled = Path(__file__).resolve().parent.parent / "_agents"
    if bundled.is_dir():
        return bundled
    root = repo_root()
    if root:
        return root / "agents"
    raise FileNotFoundError("agents/ not found; set AIC_AGENTS_DIR")


def _utility_prompt(name: str) -> str:
    return (agents_dir() / "utility" / f"{name}.md").read_text(encoding="utf-8").strip()


@dataclass
class UtilityDeps:
    ledger: Ledger
    bus: EventBus
    settings: dict[str, Any]
    runner: ModelRunner
    env: Mapping[str, str] | None = None


async def utility_turn(kind: Literal["wake-word", "title", "compaction", "triage"], text: str, d: UtilityDeps) -> str:
    body = text[-UTILITY_MAX_CHARS:] if len(text) > UTILITY_MAX_CHARS else text
    r = await run_gated_turn(
        GatedTurn(
            kind="compaction" if kind == "compaction" else "utility",
            role="utility",
            agent_id="utility",
            session_id="utility-calls-are-stateless-000000",
            department=None,
            ticket_id=None,
            models=resolve_role_from_env("utility", d.env),
            prompt=f"{_utility_prompt(kind)}\n\n<data>\n{body}\n</data>",
            prefix=d.settings.get("profile_prefix"),
            timeout_ms=30_000,
        ),
        GateDeps(ledger=d.ledger, bus=d.bus, settings=d.settings, runner=d.runner),
    )
    return r.output.text.strip()


TriageRoute = Literal["self", "department", "new_department"]


@dataclass(frozen=True)
class Triage:
    route: TriageRoute
    department: str | None
    reason: str


_TRIAGE_CACHE: dict[str, Triage] = {}
_TRIAGE_CACHE_MAX = 256
TRIAGE_WHEN_UNSURE = Triage("department", None, "triage unavailable; the Orchestrator decides")


def parse_triage(text: str) -> Triage | None:
    """The utility model's JSON answer, or None when it isn't one."""
    import json

    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except ValueError:
        return None
    route = obj.get("route") if isinstance(obj, dict) else None
    if route not in ("self", "department", "new_department"):
        return None
    dept = obj.get("department")
    return Triage(
        route, str(dept)[:80] if isinstance(dept, str) and dept.strip() else None, str(obj.get("reason", ""))[:200]
    )


async def triage(request: str, departments: list[str], d: UtilityDeps) -> Triage:
    """The Orchestrator's quick triage, on the utility model: may AIC just answer this itself?

    A full Orchestrator turn only to decide would cost seconds; this is one short Haiku call, cached per
    request text, costed like every utility turn. Any failure routes to the Orchestrator as before.
    """
    key = f"{request.strip()}\n{sorted(departments)}"
    hit = _TRIAGE_CACHE.get(key)
    if hit:
        return hit
    body = f"Existing departments: {', '.join(departments) or 'none yet'}\n\nThe owner's request:\n{request}"
    try:
        out = parse_triage(await utility_turn("triage", body, d))
    except Exception:
        out = None
    result = out or TRIAGE_WHEN_UNSURE
    if len(_TRIAGE_CACHE) >= _TRIAGE_CACHE_MAX:
        _TRIAGE_CACHE.clear()
    _TRIAGE_CACHE[key] = result
    return result


async def is_addressed_to_ace(transcript: str, d: UtilityDeps) -> bool:
    """Wake check: plain match, then Haiku only for unclear cases."""
    m = wake_match(transcript)
    if m != "unclear":
        return m == "yes"
    return bool(re.match(r"^yes\b", await utility_turn("wake-word", transcript, d), re.I))


def _block_text(c: dict[str, Any]) -> str:
    """A text block, or the text inside a ``citationsContent`` block (PDF reading with citations on)."""
    if "text" in c:
        return str(c["text"])
    cited = c.get("citationsContent") or {}
    return "".join(str(x.get("text", "")) for x in cited.get("content") or [] if isinstance(x, dict))


def bedrock_converse_runner(client: Any) -> ModelRunner:
    """Haiku through Bedrock Converse with the Lambda's role. ``client`` is a boto3 ``bedrock-runtime`` client."""

    async def run(input: TurnInput) -> TurnOutput:
        r = await asyncio.to_thread(
            client.converse,
            modelId=input.model.invoke_id,
            messages=[{"role": "user", "content": [*input.attachments, {"text": input.prompt}]}],
            inferenceConfig={"maxTokens": input.max_tokens or 1024},
        )
        content = ((r.get("output") or {}).get("message") or {}).get("content") or []
        text = "".join(_block_text(c) for c in content if isinstance(c, dict))
        u = r.get("usage") or {}
        stop = r.get("stopReason")
        return TurnOutput(
            text=text,
            stop_reason="refusal"
            if stop in ("content_filtered", "guardrail_intervened")
            else "max_tokens"
            if stop == "max_tokens"
            else "end_turn",
            usage=Usage(
                input=u.get("inputTokens", 0),
                output=u.get("outputTokens", 0),
                cache_read=u.get("cacheReadInputTokens", 0),
                cache_write_5m=u.get("cacheWriteInputTokens", 0),
            ),
        )

    return run
