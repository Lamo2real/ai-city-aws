"""VAIC's fast engine: Bedrock ConverseStream directly, with the city tools, no Claude Code process.

VAIC has no shell or file tools, only city tools, so it doesn't need the Claude Code CLI (whose start-up
costs seconds). This loop streams text as it is written, runs tool calls through the same policy gate
and audit as the SDK path (under the same ``mcp__city__<tool>`` and ``mcp__gateway__<id>___<tool>`` names), and stops after a few tool rounds.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import threading
import time
from typing import Any

from vaic.shared.ad_spend import spend_ask
from vaic.shared.cost import Usage
from vaic.shared.log import log
from vaic.shared.policy import gate
from vaic.shared.turn import StopReason, TurnOutput

from .engine import EngineRequest, activity_for

MAX_TOOL_ROUNDS = 8
MAX_TOKENS = 4096  # a "50 sentences on …" answer must not be cut short

_client: Any = None


def _bedrock() -> Any:
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("VAIC_REGION")
        _client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(connect_timeout=5, read_timeout=120, retries={"max_attempts": 2, "mode": "adaptive"}),
        )
    return _client


async def _stream(client: Any, kwargs: dict[str, Any]) -> Any:
    """Yields ConverseStream events as they arrive (boto3 is blocking, so a thread reads the stream)."""
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[Any] = asyncio.Queue()
    done = object()
    quit = threading.Event()  # the turn was stopped (the owner's Stop): the thread closes the stream

    def put(x: Any) -> None:
        with contextlib.suppress(RuntimeError):  # the loop may be gone by then
            loop.call_soon_threadsafe(q.put_nowait, x)

    def read() -> None:
        try:
            stream = client.converse_stream(**kwargs)["stream"]
            for ev in stream:
                if quit.is_set():
                    with contextlib.suppress(Exception):
                        stream.close()
                    return
                put(ev)
        except Exception as e:  # handed to the turn
            put(e)
        finally:
            put(done)

    threading.Thread(target=read, daemon=True).start()
    try:
        while True:
            ev = await q.get()
            if ev is done:
                return
            if isinstance(ev, Exception):
                raise ev
            yield ev
    finally:
        quit.set()


async def direct_engine(req: EngineRequest, client: Any = None) -> TurnOutput:
    client = client or _bedrock()
    tools = {t.name: t for t in req.tools}
    tool_config = (
        {
            "tools": [
                {"toolSpec": {"name": t.name, "description": t.description, "inputSchema": {"json": t.schema}}}
                for t in req.tools
            ]
        }
        if req.tools
        else None
    )
    messages: list[dict[str, Any]] = [{"role": "user", "content": [{"text": req.turn.prompt}]}]
    usage = Usage()
    stop: StopReason = "end_turn"
    text = ""
    t0 = time.monotonic()
    first: float | None = None
    for rnd in range(MAX_TOOL_ROUNDS + 1):
        kwargs: dict[str, Any] = {
            "modelId": req.turn.model.invoke_id,
            "system": [{"text": req.system}],
            "messages": messages,
            "inferenceConfig": {"maxTokens": MAX_TOKENS},
        }
        if tool_config:
            kwargs["toolConfig"] = tool_config
        blocks: list[dict[str, Any]] = []
        current: dict[str, Any] | None = None
        reason = "end_turn"
        async for ev in _stream(client, kwargs):
            if "contentBlockStart" in ev:
                start = ev["contentBlockStart"].get("start", {})
                if "toolUse" in start:
                    current = {"toolUse": {**start["toolUse"], "input": ""}}
            elif "contentBlockDelta" in ev:
                d = ev["contentBlockDelta"]["delta"]
                if "text" in d:
                    if current is None or "text" not in current:
                        current = {"text": ""}
                    current["text"] += d["text"]
                    if first is None:
                        first = time.monotonic()
                    if req.on_text:
                        await req.on_text(d["text"])
                elif "toolUse" in d and current is not None and "toolUse" in current:
                    current["toolUse"]["input"] += d["toolUse"].get("input", "")
            elif "contentBlockStop" in ev:
                if current is not None:
                    blocks.append(current)
                current = None
            elif "messageStop" in ev:
                reason = ev["messageStop"].get("stopReason", "end_turn")
            elif "metadata" in ev:
                u = ev["metadata"].get("usage", {})
                usage = Usage(
                    input=usage.input + int(u.get("inputTokens", 0)),
                    output=usage.output + int(u.get("outputTokens", 0)),
                    cache_read=usage.cache_read + int(u.get("cacheReadInputTokens", 0)),
                    cache_write_5m=usage.cache_write_5m + int(u.get("cacheWriteInputTokens", 0)),
                )
        for b in blocks:
            if "toolUse" in b:
                raw = b["toolUse"]["input"]
                try:
                    b["toolUse"]["input"] = json.loads(raw) if raw else {}
                except ValueError:  # cut off mid-input (max tokens): the tool then reports what is missing
                    b["toolUse"]["input"] = {}
        text = "".join(b.get("text", "") for b in blocks)
        messages.append({"role": "assistant", "content": blocks})
        if reason != "tool_use":
            # Where the seconds go, per turn: first word and whole reply (ms), and tool rounds.
            ms = lambda t: round((t - t0) * 1000)  # noqa: E731
            log(
                "info",
                "vaic.timing",
                first_word_ms=ms(first) if first else None,
                total_ms=ms(time.monotonic()),
                rounds=rnd,
            )
            stop = "max_tokens" if reason == "max_tokens" else "refusal" if reason == "refusal" else "end_turn"
            return TurnOutput(text=text, stop_reason=stop, usage=usage)
        results = [await _run_tool(req, tools, b["toolUse"]) for b in blocks if "toolUse" in b]
        messages.append({"role": "user", "content": results})
    return TurnOutput(text=text or "I stopped after too many steps.", stop_reason=stop, usage=usage)


async def _run_tool(req: EngineRequest, tools: dict[str, Any], use: dict[str, Any]) -> dict[str, Any]:
    name, args, tid = use["name"], use.get("input") or {}, use["toolUseId"]

    def result(text: str, error: bool = False) -> dict[str, Any]:
        r: dict[str, Any] = {"toolUseId": tid, "content": [{"text": str(text)}]}
        # A tool may hand the model pictures too (the browser's screenshots, decision 265).
        for img in getattr(text, "images", None) or []:
            r["content"].append({"image": {"format": "jpeg", "source": {"bytes": img}}})
        if error:
            r["status"] = "error"
        return {"toolResult": r}

    async def finished(text: str, error: bool = False) -> dict[str, Any]:
        """The result, after it is written down: what VAIC did is in its history before it says a word about it."""
        done = getattr(req, "on_tool_done", None)
        if done:
            try:
                await done(name, args, text, error)
            except Exception as e:  # the log is a help, never a reason to lose the result
                log("warn", "vaic.action_log_failed", error=type(e).__name__)
        return result(text, error)

    spec = tools.get(name)
    if spec is None:
        return result(f"{name} is not one of your tools.", True)
    full = spec.full_name  # the policy and audit use the same names as the SDK path
    if spec.self_gated:
        # The handler runs the gate itself (the mail tools: standing rules and the owner's preview come first).
        if req.on_activity:
            await req.on_activity(activity_for(full), name)
        try:
            # Shielded: a call under way when the owner presses Stop still finishes whole.
            out = await asyncio.shield(spec.handler(args))
        except Exception as e:
            return await finished(f"The tool failed: {type(e).__name__}: {str(e)[:300]}", True)
        return await finished(out)
    ask = await spend_ask(req.ledger.table, full, args, req.ledger.now())
    r = await gate(
        full, args, req.ctx.role, req.ctx.agent_id, consume_approval=req.ledger.consume_approval, spend_ask=ask
    )
    await req.ledger.audit_tool(req.ctx.agent_id, full, r.decision, r.reason)
    if r.needs_approval and req.on_needs_approval:
        await req.on_needs_approval(full, args, r.needs_approval)
    if r.decision != "allow":
        return result(r.reason, True)
    if req.on_activity:
        # The tool name rides along as the detail, so the HUD can show VAIC's steps in plain words; a tool with
        # ``step`` says it from its arguments ("Running: git push").
        await req.on_activity(activity_for(full), spec.step(args) if spec.step else name)
    try:
        # Shielded: a call under way when the owner presses Stop still finishes whole.
        out = await asyncio.shield(spec.handler(args))
    except Exception as e:
        return await finished(f"The tool failed: {type(e).__name__}: {str(e)[:300]}", True)
    return await finished(out)
