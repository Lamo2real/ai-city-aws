"""VAIC's reply streams to the HUD in small batches, straight to the WebSocket when the runtime knows it."""

import json
from typing import Any

from vaic.lambdas.dispatcher import AgentCoreInvoker
from vaic.runtime.live import LiveReply


class Clock:
    def __init__(self) -> None:
        self.t = 100.0

    def __call__(self) -> float:
        return self.t


async def test_batches_pieces_and_ends_with_the_whole_reply() -> None:
    sent: list[dict[str, Any]] = []

    async def send(e: dict[str, Any]) -> None:
        sent.append(e)

    clock = Clock()
    live = LiveReply(send, "main", clock)
    await live.add("Hel")  # first piece goes at once
    await live.add("lo")  # within 80 ms: held
    await live.add(", ")
    clock.t += 0.1
    await live.add("owner")  # past 80 ms: everything held so far goes
    await live.done("Hello, owner.")
    assert [e["text"] for e in sent] == ["Hel", "lo, owner", "Hello, owner."]
    assert [e["done"] for e in sent] == [False, False, True]
    assert {e["conversation"] for e in sent} == {"main"}
    assert {e["type"] for e in sent} == {"vaic.reply"}


class FakeAgentCore:
    def __init__(self) -> None:
        self.payloads: list[dict[str, Any]] = []

    def invoke_agent_runtime(self, **kw: Any) -> dict[str, Any]:
        self.payloads.append(json.loads(kw["payload"]))
        return {"statusCode": 200}


async def test_only_vaic_is_told_where_the_websocket_is() -> None:
    client = FakeAgentCore()
    live = {"wsEndpoint": "https://ws.example/prod", "connectionsTable": "conns"}
    inv = AgentCoreInvoker(client, {"vaic": "arn:vaic", "worker": "arn:worker"}, live)
    await inv.invoke({"role": "vaic", "sessionId": "s" * 33})
    await inv.invoke({"role": "worker", "sessionId": "w" * 33})
    assert client.payloads[0]["wsEndpoint"] == "https://ws.example/prod"
    assert client.payloads[0]["connectionsTable"] == "conns"
    assert "wsEndpoint" not in client.payloads[1]
    bare = AgentCoreInvoker(client, {"vaic": "arn:vaic"}, {"wsEndpoint": "", "connectionsTable": ""})
    await bare.invoke({"role": "vaic", "sessionId": "s" * 33})
    assert "wsEndpoint" not in client.payloads[2]


async def test_aics_reply_goes_straight_to_the_hud_when_the_runtime_knows_the_websocket() -> None:
    from city_support import make_city
    from vaic.runtime.engine import EngineRequest
    from vaic.shared.cost import Usage
    from vaic.shared.turn import TurnOutput

    async def engine(req: EngineRequest) -> TurnOutput:
        if req.on_text:
            for piece in ("Eight", "een."):
                await req.on_text(piece)
        return TurnOutput(text="Eighteen.", usage=Usage(input=10, output=2))

    city = make_city(engine)
    direct: list[dict[str, Any]] = []

    async def send(e: dict[str, Any]) -> None:
        direct.append(e)

    seen: list[dict[str, Any]] = []

    def live_sender(inv: dict[str, Any]) -> Any:
        seen.append(inv)
        return send

    city.host.o.live_sender = live_sender
    await city.owner_says("what's 9 + 9?")
    await city.run()
    assert direct[0] == {
        "type": "vaic.reply",
        "conversation": "c1",
        "text": "Eight",
        "done": False,
        "message_id": "owner-13-c1",
    }
    assert direct[-1]["done"] and direct[-1]["text"] == "Eighteen."
    # Pieces only went the fast way; the final reply also went through the bus as a safety net.
    assert [(e["done"], e["text"]) for e in city.bus.of_type("vaic.reply")] == [(True, "Eighteen.")]
    assert seen and seen[0]["role"] == "vaic"
