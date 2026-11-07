"""AIC's warm engine: a Claude process is started before the turn arrives, so the turn skips start-up."""

import asyncio
from types import SimpleNamespace
from typing import Any, ClassVar

import pytest
from claude_agent_sdk import ResultMessage, StreamEvent

from aic.runtime import engine as eng
from aic.shared.cost import Usage
from aic.shared.turn import TurnOutput


class FakeClient:
    instances: ClassVar[list["FakeClient"]] = []

    def __init__(self, options: Any, fail_query: bool = False) -> None:
        self.options = options
        self.fail_query = fail_query
        self.connected = self.closed = False
        self.prompts: list[str] = []
        FakeClient.instances.append(self)

    async def connect(self) -> None:
        self.connected = True

    async def query(self, prompt: str) -> None:
        if self.fail_query:
            raise ConnectionError("process died")
        self.prompts.append(prompt)

    async def receive_response(self) -> Any:
        yield StreamEvent(
            uuid="u",
            session_id="s",
            event={"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Eigh"}},
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="s",
            result="Eighteen.",
        )

    async def disconnect(self) -> None:
        self.closed = True


def request(prompt: str, texts: list[str], system: str = "You are AIC.") -> Any:
    async def on_text(t: str) -> None:
        texts.append(t)

    return SimpleNamespace(
        turn=SimpleNamespace(prompt=prompt, model=SimpleNamespace(invoke_id="global.m"), cache_ttl="5m"),
        system=system,
        tools=[],
        builtins=[],
        cwd=None,
        on_text=on_text,
        ctx=SimpleNamespace(role="ace", agent_id="ace"),
        ledger=None,
        on_needs_approval=None,
        on_activity=None,
    )


async def settle(w: eng.WarmEngine) -> None:
    while w._tasks:
        await asyncio.gather(*list(w._tasks))


@pytest.fixture
def cold(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    calls: list[str] = []

    async def fake_cold(req: Any) -> TurnOutput:
        calls.append(req.turn.prompt)
        return TurnOutput(text="cold", usage=Usage())

    monkeypatch.setattr(eng, "_cold", fake_cold)
    FakeClient.instances.clear()
    return calls


async def test_the_first_turn_runs_cold_and_the_next_uses_the_process_started_meanwhile(cold: list[str]) -> None:
    w = eng.WarmEngine(start=FakeClient)
    texts: list[str] = []
    first = await w.run(request("hi", texts))
    assert first.text == "cold" and cold == ["hi"]
    await settle(w)
    spare = FakeClient.instances[0]
    assert spare.connected and not spare.closed

    second = await w.run(request("what's 9 + 9?", texts))
    await settle(w)
    assert second.text == "Eighteen."
    assert texts == ["Eigh"]  # streamed from the warm process
    assert spare.prompts == ["what's 9 + 9?"] and spare.closed  # used once: a fresh context every turn
    assert cold == ["hi"]
    assert FakeClient.instances[-1].connected and not FakeClient.instances[-1].closed  # the next one waits


async def test_a_different_prompt_or_model_never_reuses_the_waiting_process(cold: list[str]) -> None:
    w = eng.WarmEngine(start=FakeClient)
    await w.run(request("hi", []))
    await settle(w)
    await w.run(request("hi again", [], system="Something else."))
    assert cold == ["hi", "hi again"]


async def test_a_waiting_process_that_died_falls_back_to_a_cold_start(cold: list[str]) -> None:
    w = eng.WarmEngine(start=lambda o: FakeClient(o, fail_query=True))
    await w.run(request("hi", []))
    await settle(w)
    out = await w.run(request("still there?", []))
    assert out.text == "cold" and cold == ["hi", "still there?"]
