"""VAIC's direct Bedrock engine: streams text, runs city tools through the policy gate, loops on tool use."""

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from vaic.runtime.direct import direct_engine
from vaic.runtime.tools import ToolSpec
from vaic.shared.table import MemoryTable


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
        self.table = MemoryTable()  # the owner's ad spend limit is read from it (decision 240)

    def now(self) -> datetime:
        return datetime(2026, 11, 11, tzinfo=UTC)

    async def consume_approval(self, *_: Any) -> bool:
        return False

    async def audit_tool(self, agent: str, name: str, decision: str, reason: str) -> None:
        self.audit.append((name, decision))


def request(tools: list[ToolSpec], texts: list[str]) -> Any:
    async def on_text(t: str) -> None:
        texts.append(t)

    return SimpleNamespace(
        turn=SimpleNamespace(prompt="what's the status?", model=SimpleNamespace(invoke_id="arn:profile/vaic-vaic")),
        system="You are VAIC.",
        tools=tools,
        builtins=[],
        on_text=on_text,
        ctx=SimpleNamespace(role="vaic", agent_id="vaic"),
        ledger=Ledger(),
        on_needs_approval=None,
        on_activity=None,
        skills_dir=None,
        skill_names=frozenset(),
        home=None,
    )


async def test_streams_text_as_it_arrives_and_returns_the_whole_reply() -> None:
    texts: list[str] = []
    fake = FakeBedrock([text_round("Eigh", "teen.")])
    out = await direct_engine(request([], texts), fake)
    assert texts == ["Eigh", "teen."]
    assert out.text == "Eighteen." and out.stop_reason == "end_turn"
    assert out.usage.input == 100 and out.usage.output == 10
    assert fake.calls[0]["modelId"] == "arn:profile/vaic-vaic"
    assert fake.calls[0]["system"] == [{"text": "You are VAIC."}]
    assert "toolConfig" not in fake.calls[0]


async def test_runs_a_tool_through_the_gate_and_answers_with_its_result() -> None:
    seen: list[dict[str, Any]] = []

    async def get_status(args: dict[str, Any]) -> str:
        seen.append(args)
        return "2 tickets running"

    spec = ToolSpec("get_status", "Status.", {"type": "object", "properties": {}}, get_status)
    fake = FakeBedrock([tool_round("get_status", '{"detail": true}'), text_round("Two things are running.")])
    req = request([spec], [])
    steps: list[tuple[str, str | None]] = []

    async def on_activity(activity: str, detail: str | None) -> None:
        steps.append((activity, detail))

    req.on_activity = on_activity
    out = await direct_engine(req, fake)
    assert steps == [("working", "get_status")]  # the HUD turns this into "Checking the ledger"
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
    from vaic.runtime.engine import _Binding, _options

    async def noop(_: dict[str, Any]) -> str:
        return ""

    spec = ToolSpec("assign", "Assign.", {"type": "object", "properties": {}}, noop)
    req = request([spec], [])
    req.turn.cache_ttl = "1h"
    req.cwd = None
    o = _options(req, _Binding(req))
    assert o.allowed_tools == []  # an allowed_tools entry would skip can_use_tool (the SDK warns about it)
    assert o.can_use_tool is not None


async def test_a_self_gated_tool_is_not_gated_twice_its_handler_decides() -> None:
    """The mail tools gate themselves (standing rules, preview). The engine must not file a bare approval first."""
    calls: list[dict[str, Any]] = []

    async def send(args: dict[str, Any]) -> str:
        calls.append(args)
        return "sent (the handler gated this itself)"

    spec = ToolSpec("mail_send", "Send.", {"type": "object", "properties": {}}, send, self_gated=True)
    fake = FakeBedrock([tool_round("mail_send", '{"to": ["a@b.c"]}'), text_round("Sent.")])
    req = request([spec], [])
    out = await direct_engine(req, fake)
    assert calls == [{"to": ["a@b.c"]}]  # the policy's "ask" rule for mail_send did not block the handler
    assert req.ledger.audit == []  # the handler audits; the engine doesn't add a second row
    assert out.text == "Sent."


def test_the_sdk_path_lets_a_self_gated_tool_through_to_its_handler() -> None:
    import asyncio

    from vaic.runtime.engine import _Binding, _options

    async def noop(_: dict[str, Any]) -> str:
        return ""

    spec = ToolSpec("mail_send", "Send.", {"type": "object", "properties": {}}, noop, self_gated=True)
    req = request([spec], [])
    req.turn.cache_ttl = "5m"
    req.cwd = None
    req.home = None
    req.skill_names = []
    o = _options(req, _Binding(req))
    r = asyncio.run(o.can_use_tool(spec.full_name, {"to": ["a@b.c"]}, None))
    assert type(r).__name__ == "PermissionResultAllow"
    assert req.ledger.audit == []


async def test_after_a_triage_says_answer_yourself_vaic_answers_in_the_same_turn() -> None:
    from vaic.runtime.direct import MAX_TOKENS

    async def delegate(_: dict[str, Any]) -> str:
        return "Triage: answer this yourself now, in full. No task was created."

    spec = ToolSpec("start_job", "Hand off.", {"type": "object", "properties": {}}, delegate)
    fake = FakeBedrock(
        [tool_round("start_job", '{"goal": "x"}'), text_round("Sentence one. ", "Sentence two.")]
    )
    texts: list[str] = []
    out = await direct_engine(request([spec], texts), fake)
    assert out.text == "Sentence one. Sentence two."
    assert texts == ["Sentence one. ", "Sentence two."]  # streamed in the same turn, after the tool result
    assert fake.calls[1]["inferenceConfig"]["maxTokens"] == MAX_TOKENS == 4096
