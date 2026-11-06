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
from typing import Any, Protocol

from aic.shared.cost import Usage
from aic.shared.ledger import Ledger
from aic.shared.policy import gate
from aic.shared.turn import StopReason, TurnInput, TurnOutput

from .tools import CITY_SERVER, ToolSpec, TurnCtx, mcp_name


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
    """Text as it streams, for Ace's spoken replies."""
    on_needs_approval: Callable[[str, dict[str, Any], str, str], Awaitable[None]] | None = None
    """Called when a built-in tool call needs the owner's approval for this exact action (tool, input, hash, reason)."""
    on_activity: Callable[[str, str | None], Awaitable[None]] | None = None
    """What the agent is doing, for the City view ("coding", "reading", ...)."""
    cwd: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


class AgentEngine(Protocol):
    def __call__(self, req: EngineRequest, /) -> Awaitable[TurnOutput]: ...


_ACTIVITY: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(Write|Edit|MultiEdit)$"), "coding"),
    (re.compile(r"^(Read|Glob|Grep)$"), "reading"),
    (re.compile(r"^Bash$"), "running"),
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


async def sdk_engine(req: EngineRequest) -> TurnOutput:
    """The production engine: the Claude Agent SDK, on Bedrock, with the city tools in-process."""
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        PermissionResultAllow,
        PermissionResultDeny,
        ResultMessage,
        TextBlock,
        create_sdk_mcp_server,
        query,
        tool,
    )

    def make(t: ToolSpec) -> Any:
        @tool(t.name, t.description, t.schema)
        async def run(args: dict[str, Any]) -> dict[str, Any]:
            return {"content": [{"type": "text", "text": await t.handler(args)}]}

        return run

    server = create_sdk_mcp_server(name=CITY_SERVER, version="1.0.0", tools=[make(t) for t in req.tools])
    allowed = [mcp_name(t.name) for t in req.tools] + req.builtins
    env = {**os.environ, "ANTHROPIC_MODEL": req.turn.model.invoke_id}
    if req.turn.cache_ttl == "1h":
        env["ENABLE_PROMPT_CACHING_1H"] = "1"

    async def can_use_tool(name: str, input: dict[str, Any], _ctx: Any) -> Any:
        if name not in allowed:
            return PermissionResultDeny(message=f"{name} is not one of your tools.")
        r = await gate(name, input, req.ctx.role, req.ctx.agent_id, consume_approval=req.ledger.consume_approval)
        await req.ledger.audit_tool(req.ctx.agent_id, name, r.decision, r.reason)
        if r.needs_approval and req.on_needs_approval:
            await req.on_needs_approval(name, input, r.needs_approval.hash, r.needs_approval.reason)
        if r.decision == "allow":
            if req.on_activity:
                await req.on_activity(activity_for(name), None)
            return PermissionResultAllow(updated_input=input)
        return PermissionResultDeny(message=r.reason)

    # can_use_tool needs streaming input: the prompt is sent as one user message on a stream.
    async def prompt() -> AsyncIterator[dict[str, Any]]:
        yield {"type": "user", "message": {"role": "user", "content": req.turn.prompt}}

    options = ClaudeAgentOptions(
        model=req.turn.model.invoke_id,
        system_prompt=req.system,  # stable text first, so prompt caching hits
        mcp_servers={CITY_SERVER: server},
        allowed_tools=allowed,
        setting_sources=[],  # no settings files: the city decides tools, not the repo a worker clones
        env=env,
        cwd=req.cwd,
        can_use_tool=can_use_tool,
    )
    text = ""
    stop: StopReason = "end_turn"
    usage = Usage()
    async for msg in query(prompt=prompt(), options=options):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock) and req.on_text:
                    await req.on_text(block.text)
            if getattr(msg, "stop_reason", None) == "refusal":
                stop = "refusal"
        elif isinstance(msg, ResultMessage):
            if msg.subtype == "success":
                text = msg.result or ""
            if msg.stop_reason == "refusal":
                stop = "refusal"
            elif msg.stop_reason == "max_tokens":
                stop = "max_tokens"
            usage = usage_from_model_usage(dict(msg.model_usage or {}), req.turn.cache_ttl)  # type: ignore[arg-type]
            if msg.subtype != "success" and stop == "end_turn":
                raise RuntimeError(f"agent turn ended with {msg.subtype}")
    return TurnOutput(text=text, stop_reason=stop, usage=usage)
