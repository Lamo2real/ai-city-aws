"""AIC's direct Bedrock engine: streams text, runs city tools through the policy gate, loops on tool use."""

from types import SimpleNamespace
from typing import Any

from aic.runtime.direct import direct_engine
from aic.runtime.tools import ToolSpec


def text_round(*pieces: str, stop: str = "end_turn") -> list[dict[str, Any]]:
    return [
        {"messageStart": {"role": "assistant"}},
        *[{"contentBlockDelta": {"contentBlockIndex": 0, "delta": {"text": p}}} for p in pieces],
        {"contentBlockStop": {"contentBlockIndex": 0}},
        {"messageStop": {"stopReason": stop}},
        {"metadata": {"usage": {"inputTokens": 100, "outputTokens": 10}}},
    ]


def tool_round(name: str, input_json: str) -> list[dict[str, Any]]:
    return [
        {"messageStart": {"role": "assistant"}},
        {"contentBlockStart": {"contentBlockIndex": 0, "start": {"toolUse": {"toolUseId": "t1", "name": name}}}},
        {"contentBlockDelta": {"contentBlockIndex": 0, "delta": {"toolUse": {"input": input_json[:5]}}}},
        {"contentBlockDelta": {"contentBlockIndex": 0, "delta": {"toolUse": {"input": input_json[5:]}}}},
        {"contentBlockStop": {"contentBlockIndex": 0}},
        {"messageStop": {"stopReason": "tool_use"}},
        {"metadata": {"usage": {"inputTokens": 50, "outputTokens": 5}}},
    ]


class FakeBedrock:
    def __init__(self, rounds: list[list[dict[str, Any]]]) -> None:
        self.rounds = rounds
        self.calls: list[dict[str, Any]] = []

    def converse_stream(self, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        return {"stream": iter(self.rounds[len(self.calls) - 1])}


class Ledger:
    def __init__(self) -> None:
        self.audit: list[tuple[str, str]] = []

    async def consume_approval(self, *_: Any) -> bool:
        return False

    async def audit_tool(self, agent: str, name: str, decision: str, reason: str) -> None:
        self.audit.append((name, decision))


def request(tools: list[ToolSpec], texts: list[str]) -> Any:
    async def on_text(t: str) -> None:
        texts.append(t)

    return SimpleNamespace(
        turn=SimpleNamespace(prompt="what's the status?", model=SimpleNamespace(invoke_id="arn:profile/aic-ace")),
        system="You are AIC.",
        tools=tools,
        builtins=[],
        on_text=on_text,
        ctx=SimpleNamespace(role="ace", agent_id="ace"),
        ledger=Ledger(),
        on_needs_approval=None,
        on_activity=None,
    )


async def test_streams_text_as_it_arrives_and_returns_the_whole_reply() -> None:
    texts: list[str] = []
    fake = FakeBedrock([text_round("Eigh", "teen.")])
    out = await direct_engine(request([], texts), fake)
    assert texts == ["Eigh", "teen."]
    assert out.text == "Eighteen." and out.stop_reason == "end_turn"
    assert out.usage.input == 100 and out.usage.output == 10
    assert fake.calls[0]["modelId"] == "arn:profile/aic-ace"
    assert fake.calls[0]["system"] == [{"text": "You are AIC."}]
    assert "toolConfig" not in fake.calls[0]


async def test_runs_a_tool_through_the_gate_and_answers_with_its_result() -> None:
    seen: list[dict[str, Any]] = []

    async def get_status(args: dict[str, Any]) -> str:
        seen.append(args)
        return "2 tickets running"

    spec = ToolSpec("get_status", "Status.", {"type": "object", "properties": {}}, get_status)
    fake = FakeBedrock([tool_round("get_status", '{"detail": true}'), text_round("Two things are running.")])
    req = request([spec], [])
    out = await direct_engine(req, fake)
    assert out.text == "Two things are running."
    assert seen == [{"detail": True}]
    assert req.ledger.audit == [("mcp__city__get_status", "allow")]
    second = fake.calls[1]["messages"]
    assert second[1]["content"][0]["toolUse"]["input"] == {"detail": True}
    assert second[2]["content"][0]["toolResult"]["content"] == [{"text": "2 tickets running"}]
    assert out.usage.input == 150


async def test_an_unknown_tool_gets_an_error_result_not_a_crash() -> None:
    fake = FakeBedrock([tool_round("delete_everything", "{}"), text_round("I can't do that.")])
    out = await direct_engine(request([], []), fake)
    result = fake.calls[1]["messages"][2]["content"][0]["toolResult"]
    assert result["status"] == "error" and "not one of your tools" in result["content"][0]["text"]
    assert out.text == "I can't do that."


def test_the_sdk_path_pre_approves_nothing_so_every_tool_call_hits_the_policy_gate() -> None:
    from aic.runtime.engine import _Binding, _options

    async def noop(_: dict[str, Any]) -> str:
        return ""

    spec = ToolSpec("assign", "Assign.", {"type": "object", "properties": {}}, noop)
    req = request([spec], [])
    req.turn.cache_ttl = "1h"
    req.cwd = None
    o = _options(req, _Binding(req))
    assert o.allowed_tools == []  # an allowed_tools entry would skip can_use_tool (the SDK warns about it)
    assert o.can_use_tool is not None
