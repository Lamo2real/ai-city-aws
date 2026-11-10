"""The owner's Stop on a message to VAIC (decision 183): the turn is dropped, nothing more is said or done for it."""

import asyncio
from typing import Any

import pytest

from city_support import make_city
from test_api import ev, handle_http, js, make
from test_direct_engine import FakeBedrock, request, text_round, tool_round
from vaic.runtime import stop
from vaic.runtime.direct import direct_engine
from vaic.runtime.engine import EngineRequest
from vaic.runtime.stop import unless_stopped
from vaic.runtime.tools import ToolSpec
from vaic.shared.cost import Usage
from vaic.shared.turn import TurnOutput

MSG = "owner-13-c1"  # the id city_support gives "what's 9 + 9?" (13 characters) in conversation c1


@pytest.fixture(autouse=True)
def fast_poll(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(stop, "POLL_SECONDS", 0.005)


def with_live(city: Any) -> list[dict[str, Any]]:
    sent: list[dict[str, Any]] = []

    async def send(e: dict[str, Any]) -> None:
        sent.append(e)

    city.host.o.live_sender = lambda inv: send
    return sent


async def test_stop_mid_stream_drops_the_rest_of_the_reply() -> None:
    city: Any = None
    after_stop: list[str] = []

    async def engine(req: EngineRequest) -> TurnOutput:
        assert req.on_text
        await req.on_text("Eigh")
        await city.ledger.stop_turn(MSG)  # the owner presses Stop while VAIC is still writing
        await asyncio.sleep(0.5)
        after_stop.append("still running")  # never reached: the turn was cancelled
        await req.on_text("teen.")
        return TurnOutput(text="Eighteen.", usage=Usage(input=10, output=2))

    city = make_city(engine)
    sent = with_live(city)
    await city.owner_says("what's 9 + 9?")
    await city.run()
    assert after_stop == []
    replies = [e for e in sent if e["type"] == "vaic.reply"]
    assert [(e["text"], e["done"], e["message_id"]) for e in replies] == [("Eigh", False, MSG)]
    assert not city.bus.of_type("vaic.reply")  # no final reply, not even the safety-net copy
    stopped = city.bus.of_type("vaic.stopped")
    assert len(stopped) == 1 and stopped[0]["message_id"] == MSG and stopped[0]["tools"] == []
    # Kept for context (the owner: "still save them as chat history"), marked stopped, with what had streamed.
    lines = await city.ledger.recent_conversation("c1")
    assert [(line["who"], line["text"]) for line in lines] == [
        ("owner", "what's 9 + 9?"),
        ("vaic", "(stopped by the owner. Not an open request: do not carry it on unless the owner asks again.) Eigh"),
    ]
    assert await city.ledger.is_work_done(MSG)  # the crash sweep must not send it again


async def test_a_reply_that_would_come_after_stop_is_never_sent() -> None:
    """A late reply (the model answering after Stop) is ignored: the turn returns nothing and says nothing."""
    city: Any = None
    release = asyncio.Event()

    async def engine(req: EngineRequest) -> TurnOutput:
        await city.ledger.stop_turn(MSG)
        await release.wait()  # the model is slow; Stop lands first
        assert req.on_text
        await req.on_text("Too late.")
        return TurnOutput(text="Too late.", usage=Usage(input=1, output=1))

    city = make_city(engine)
    sent = with_live(city)
    await city.owner_says("what's 9 + 9?")
    await city.run()
    release.set()
    await asyncio.sleep(0.02)
    assert not [e for e in sent if e["type"] == "vaic.reply"]
    assert not city.bus.of_type("vaic.reply")
    assert city.bus.of_type("vaic.stopped")


async def test_a_message_stopped_before_vaic_picked_it_up_never_runs() -> None:
    calls: list[str] = []

    async def engine(req: EngineRequest) -> TurnOutput:
        calls.append("ran")
        return TurnOutput(text="hi", usage=Usage())

    city = make_city(engine)
    await city.owner_says("what's 9 + 9?")
    await city.ledger.stop_turn(MSG)
    await city.run()
    assert calls == []
    assert not city.bus.of_type("vaic.reply")
    assert await city.ledger.is_work_done(MSG)
    lines = await city.ledger.recent_conversation("c1")
    assert [line["who"] for line in lines] == ["owner", "vaic"]
    assert lines[1]["text"].startswith("(stopped by the owner before VAIC answered.")


async def test_tools_already_called_are_said_plainly_and_remembered() -> None:
    city: Any = None

    async def engine(req: EngineRequest) -> TurnOutput:
        assert req.on_activity
        await req.on_activity("delegating", "delegate_to_orchestrator")
        await city.ledger.stop_turn(MSG)
        await asyncio.sleep(0.5)
        return TurnOutput(text="Done.", usage=Usage())

    city = make_city(engine)
    await city.owner_says("what's 9 + 9?")
    await city.run()
    stopped = city.bus.of_type("vaic.stopped")[0]
    assert stopped["tools"] == [{"activity": "delegating", "detail": "delegate_to_orchestrator"}]
    lines = await city.ledger.recent_conversation("c1")
    assert [line["who"] for line in lines] == ["owner", "vaic"]
    assert "delegate_to_orchestrator" in lines[1]["text"] and lines[1]["text"].startswith("(stopped by the owner")


async def test_without_stop_the_turn_answers_as_before() -> None:
    async def engine(req: EngineRequest) -> TurnOutput:
        return TurnOutput(text="Eighteen.", usage=Usage(input=10, output=2))

    city = make_city(engine)
    await city.owner_says("what's 9 + 9?")
    await city.run()
    assert [e["text"] for e in city.bus.of_type("vaic.reply")] == ["Eighteen."]
    assert not city.bus.of_type("vaic.stopped")


async def test_unless_stopped_returns_the_result_and_ignores_a_failing_check() -> None:
    async def work() -> int:
        await asyncio.sleep(0.03)
        return 7

    async def broken() -> bool:
        raise RuntimeError("ledger down")

    assert await unless_stopped(work(), broken) == (7, False)


async def test_a_tool_under_way_when_stop_lands_still_finishes_whole() -> None:
    finished: list[str] = []

    async def delegate(_: dict[str, Any]) -> str:
        await asyncio.sleep(0.05)
        finished.append("delegated")
        return "ticket t-1"

    spec = ToolSpec("delegate_to_orchestrator", "Hand on.", {"type": "object", "properties": {}}, delegate)
    fake = FakeBedrock([tool_round("delegate_to_orchestrator", "{}"), text_round("Passed on.")])
    turn = asyncio.ensure_future(direct_engine(request([spec], []), fake))
    await asyncio.sleep(0.02)  # inside the tool call
    turn.cancel()
    with pytest.raises(asyncio.CancelledError):
        await turn
    await asyncio.sleep(0.06)
    assert finished == ["delegated"]  # the call completed rather than being cut in half
    assert len(fake.calls) == 1  # and the model was not asked again: nothing after it ran


async def test_post_stop_flags_the_owners_message() -> None:
    d = make()
    r = await handle_http(ev("POST", "/messages/oabc12345/stop", {}), d)
    assert r["statusCode"] == 202 and js(r) == {"stopped": True}
    assert await d.ledger.turn_stopped("owner-oabc12345")
    assert not await d.ledger.turn_stopped("owner-other1234")
    assert (await handle_http(ev("POST", "/messages/x/stop", {}), d))["statusCode"] == 404


async def test_the_next_turn_reads_the_stopped_exchange_as_stopped_not_as_work_to_carry_on() -> None:
    city: Any = None
    prompts: list[str] = []

    async def engine(req: EngineRequest) -> TurnOutput:
        prompts.append(req.turn.prompt)
        if len(prompts) == 1:
            assert req.on_text
            await req.on_text("Here are fifty sentences. One.")
            await city.ledger.stop_turn(MSG)
            await asyncio.sleep(0.5)
        return TurnOutput(text="Hello again.", usage=Usage())

    city = make_city(engine)
    await city.owner_says("what's 9 + 9?")
    await city.run()
    await city.owner_says("hello", "c1")
    await city.run()
    later = prompts[1]
    assert "Owner: what's 9 + 9?" in later
    assert (
        "VAIC: (stopped by the owner. Not an open request: do not carry it on unless the owner asks again.) "
        "Here are fifty sentences. One." in later
    )
    assert later.index("Conversation so far") < later.index("Message (task) from owner:\nhello")
