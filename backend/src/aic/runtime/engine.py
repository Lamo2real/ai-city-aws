"""How a turn talks to the model.

``AgentEngine`` is the seam: production uses the Claude Agent SDK on Bedrock; tests use a scripted fake that
calls the same tool handlers. The SDK's own refusal fallback is not used: the turn gate in ``aic.shared`` does
the one Fable → Opus retry.
"""

from __future__ import annotations

import os
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol, cast

from aic.shared.cost import Usage
from aic.shared.ledger import Ledger
from aic.shared.policy import gate
from aic.shared.turn import StopReason, TurnInput, TurnOutput

from .skills import skill_allowed
from .tools import CITY_SERVER, ToolSpec, TurnCtx


@dataclass
class EngineRequest:
    turn: TurnInput
    system: str
    tools: list[ToolSpec]
    builtins: list[str]
    """Built-in SDK tools this agent may use (workers only), each still gated by can_use_tool."""
    ctx: TurnCtx
    ledger: Ledger
    on_text: Callable[[str], Awaitable[None]] | None = None
    """Text as it streams, for AIC's spoken replies."""
    on_needs_approval: Callable[[str, dict[str, Any], str, str], Awaitable[None]] | None = None
    """Called when a built-in tool call needs the owner's approval for this exact action (tool, input, hash, reason)."""
    on_activity: Callable[[str, str | None], Awaitable[None]] | None = None
    """What the agent is doing, for the City view ("coding", "reading", ...)."""
    cwd: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    skills_dir: str | None = None
    """The city-owned plugin folder with this turn's skills (SDK path), or None."""
    skill_names: frozenset[str] = frozenset()
    """The skills this turn may use; ``can_use_tool`` accepts ``Skill`` only for these."""
    home: str | None = None
    """An empty HOME for the CLI, so nothing under ``~/.claude`` adds skills or settings."""


class AgentEngine(Protocol):
    def __call__(self, req: EngineRequest, /) -> Awaitable[TurnOutput]: ...


_ACTIVITY: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(Write|Edit|MultiEdit)$"), "coding"),
    (re.compile(r"^(Read|Glob|Grep)$"), "reading"),
    (re.compile(r"^Bash$|run_command"), "running"),
    (re.compile(r"^(WebSearch|WebFetch)$"), "researching"),
    (re.compile(r"browser"), "browsing"),
    (re.compile(r"hire_worker"), "hiring"),
    (re.compile(r"assign|assign_to_department|delegate_to_orchestrator"), "delegating"),
    (re.compile(r"review|sign_off"), "reviewing"),
    (re.compile(r"report_to"), "reporting"),
    (re.compile(r"ask_owner|ask_manager"), "asking"),
    (re.compile(r"answer_"), "answering"),
]


def activity_for(tool: str) -> str:
    return next((a for r, a in _ACTIVITY if r.search(tool)), "working")


def usage_from_model_usage(mu: dict[str, dict[str, Any]], ttl: str) -> Usage:
    """Usage from the SDK's per-model totals, split by cache-write lifetime."""
    inp = out = read = w5_total = w1_total = 0
    for m in (mu or {}).values():
        inp += int(m.get("inputTokens", 0))
        out += int(m.get("outputTokens", 0))
        read += int(m.get("cacheReadInputTokens", 0))
        w5 = int(m.get("cacheCreationEphemeral5mInputTokens", 0) or 0)
        w1 = int(m.get("cacheCreationEphemeral1hInputTokens", 0) or 0)
        unknown = max(0, int(m.get("cacheCreationInputTokens", 0)) - w5 - w1)
        w5_total += w5 + (unknown if ttl == "5m" else 0)
        w1_total += w1 + (unknown if ttl == "1h" else 0)
    return Usage(input=inp, output=out, cache_read=read, cache_write_5m=w5_total, cache_write_1h=w1_total)


class _Binding:
    """What a (possibly pre-started) Claude process is working on right now: tools, permission checks and
    stderr are looked up here at call time, so one process can be started before its turn arrives."""

    def __init__(self, req: EngineRequest | None = None) -> None:
        self.req = req
        self.stderr_tail: list[str] = []

    def bound(self) -> EngineRequest:
        if self.req is None:
            raise RuntimeError("no turn is bound to this engine yet")
        return self.req


def _options(req: EngineRequest, b: _Binding) -> Any:
    """The SDK options for ``req``'s kind of turn. Everything turn-specific goes through ``b``."""
    from claude_agent_sdk import (
        ClaudeAgentOptions,
        PermissionResultAllow,
        PermissionResultDeny,
        create_sdk_mcp_server,
        tool,
    )

    def make(t: ToolSpec) -> Any:
        @tool(t.name, t.description, t.schema)
        async def run(args: dict[str, Any]) -> dict[str, Any]:
            handler = next(x.handler for x in b.bound().tools if x.name == t.name)
            return {"content": [{"type": "text", "text": await handler(args)}]}

        return run

    servers: dict[str, Any] = {}
    for srv in dict.fromkeys([CITY_SERVER, *(t.server for t in req.tools)]):
        mine = [make(t) for t in req.tools if t.server == srv]
        if mine or srv == CITY_SERVER:
            servers[srv] = create_sdk_mcp_server(name=srv, version="1.0.0", tools=mine)
    by_name = {t.full_name: t for t in req.tools}
    # City tools and connector tools (``mcp__gateway__<id>___<tool>``) are checked here, never pre-approved.
    allowed = [*by_name, *req.builtins, *(["Skill"] if req.skill_names else [])]
    env = {**os.environ, "ANTHROPIC_MODEL": req.turn.model.invoke_id}
    # The Claude Code CLI on Bedrock needs AWS_REGION; the runtime only sets AIC_REGION.
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AIC_REGION")
    if region:
        env["AWS_REGION"] = region
    if not req.builtins:
        # No shell tools, so nothing to scrub; with it set Claude Code demands bubblewrap and won't start.
        env.pop("CLAUDE_CODE_SUBPROCESS_ENV_SCRUB", None)
    if req.turn.cache_ttl == "1h":
        env["ENABLE_PROMPT_CACHING_1H"] = "1"
    if req.home:
        env["HOME"] = req.home  # an empty city folder: ~/.claude/skills can't add anything
    # Only the city's plugin folder adds skills: not the CLI's bundled ones, nor managed-policy ones.
    env["CLAUDE_CODE_DISABLE_BUNDLED_SKILLS"] = "1"
    env["CLAUDE_CODE_DISABLE_POLICY_SKILLS"] = "1"

    def on_stderr(line: str) -> None:
        b.stderr_tail.append(line.rstrip()[:500])
        del b.stderr_tail[:-30]

    async def can_use_tool(name: str, input: dict[str, Any], _ctx: Any) -> Any:
        r_ = b.bound()
        if name not in allowed:
            return PermissionResultDeny(message=f"{name} is not one of your tools.")
        if name == "Skill" and not skill_allowed(input.get("skill"), r_.skill_names):
            return PermissionResultDeny(message="That skill is not one of yours.")
        spec = by_name.get(name)
        if spec and spec.self_gated:
            # The handler runs the gate itself (the mail tools: standing rules and the owner's preview come first).
            return PermissionResultAllow(updated_input=input)
        r = await gate(
            name,
            input,
            r_.ctx.role,
            r_.ctx.agent_id,
            consume_approval=r_.ledger.consume_approval,
            extra_ask=spec.ask if spec else None,
        )
        await r_.ledger.audit_tool(r_.ctx.agent_id, name, r.decision, r.reason)
        if r.needs_approval and r_.on_needs_approval:
            await r_.on_needs_approval(name, input, r.needs_approval.hash, r.needs_approval.reason)
        if r.decision == "allow":
            if r_.on_activity:
                await r_.on_activity(activity_for(name), None)
            return PermissionResultAllow(updated_input=input)
        return PermissionResultDeny(message=r.reason)

    return ClaudeAgentOptions(
        model=req.turn.model.invoke_id,
        system_prompt=req.system,  # stable text first, so prompt caching hits
        mcp_servers=servers,
        # Nothing is pre-approved: an allowed_tools entry would skip can_use_tool, and with it the policy gate.
        # can_use_tool denies anything outside ``allowed`` and gates the rest.
        allowed_tools=[],
        setting_sources=[],  # no settings files: the city decides tools, not the repo a worker clones
        # Skills come only from the city-owned plugin folder. The ``skills`` option is never used: it would
        # pre-approve Skill(name) past can_use_tool and turn the user and project settings back on.
        plugins=[{"type": "local", "path": req.skills_dir}] if req.skills_dir else [],
        env=env,
        cwd=req.cwd,
        can_use_tool=can_use_tool,
        include_partial_messages=bool(req.on_text),  # token deltas, so the reply streams as it is written
        stderr=on_stderr,  # kept so a failed turn says why (the SDK drops it otherwise)
    )


async def _consume(messages: AsyncIterator[Any], req: EngineRequest, b: _Binding, seen: list[bool]) -> TurnOutput:
    from claude_agent_sdk import AssistantMessage, ResultMessage, StreamEvent

    text = ""
    stop: StopReason = "end_turn"
    usage = Usage()
    try:
        async for msg in messages:
            if isinstance(msg, StreamEvent | AssistantMessage | ResultMessage):
                seen[0] = True  # the model has started (it may have called a tool): no silent retry after this
            if isinstance(msg, StreamEvent):
                ev = msg.event
                delta = ev.get("delta") or {}
                if req.on_text and ev.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                    await req.on_text(str(delta.get("text", "")))
            elif isinstance(msg, AssistantMessage):
                if getattr(msg, "stop_reason", None) == "refusal":
                    stop = "refusal"
            elif isinstance(msg, ResultMessage):
                if msg.subtype == "success":
                    text = msg.result or ""
                if msg.stop_reason == "refusal":
                    stop = "refusal"
                elif msg.stop_reason == "max_tokens":
                    stop = "max_tokens"
                usage = usage_from_model_usage(
                    cast(dict[str, dict[str, Any]], dict(msg.model_usage or {})), req.turn.cache_ttl
                )
                if (msg.subtype != "success" or getattr(msg, "is_error", False)) and stop == "end_turn":
                    raise RuntimeError(f"agent turn ended with {msg.subtype}: {str(msg.result or '')[:500]}")
    except Exception as e:
        tail = " | ".join(b.stderr_tail[-10:])
        raise RuntimeError(f"{type(e).__name__}: {e}" + (f" — CLI stderr: {tail}" if tail else "")) from e
    return TurnOutput(text=text, stop_reason=stop, usage=usage)


async def sdk_engine(req: EngineRequest) -> TurnOutput:
    """The production engine: the Claude Agent SDK, on Bedrock, with the city tools in-process. AIC, which has
    only city tools and must answer within seconds, talks to Bedrock directly instead (see ``direct``)."""
    if req.ctx.role == "ace" and not req.builtins:
        from .direct import direct_engine

        return await direct_engine(req)
    return await _cold(req)


async def _cold(req: EngineRequest) -> TurnOutput:
    from claude_agent_sdk import query

    b = _Binding(req)

    # can_use_tool needs streaming input: the prompt is sent as one user message on a stream.
    async def prompt() -> AsyncIterator[dict[str, Any]]:
        yield {"type": "user", "message": {"role": "user", "content": req.turn.prompt}}

    return await _consume(query(prompt=prompt(), options=_options(req, b)), req, b, [False])
