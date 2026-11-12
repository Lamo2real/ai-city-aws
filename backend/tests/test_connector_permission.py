"""VAIC asks before it uses a connector in the owner's chat (decision 265): ask, allow once, always allow, decline,
switching to another service, and "no connectors" leaving them out without asking."""

from __future__ import annotations

from typing import Any

from city_support import City, make_city, scripted_engine
from vaic.runtime.connector_permission import (
    ASK_PK,
    no_connectors,
    owner_connector_tools,
    similar,
    tool_title,
)
from vaic.runtime.tools import ToolSpec, TurnCtx
from vaic.shared.connectors import GATEWAY_SERVER, ConnectorStore
from vaic.shared.events import MemoryBus

DESCRIPT = "descript___transcribe_audio_video"
RIVERSIDE = "riverside___transcribe_media"
CANVA = "canva___create_design"


def connectors() -> list[dict[str, Any]]:
    return [
        {"id": "descript", "label": "Descript", "status": "ready", "roles": {"vaic": "all"}, "tools": []},
        {"id": "riverside", "label": "Riverside", "status": "ready", "roles": {"vaic": "all"}, "tools": []},
        {"id": "canva", "label": "Canva", "status": "ready", "roles": {"vaic": "all"}, "tools": []},
    ]


LISTED = {
    DESCRIPT: {"name": DESCRIPT, "title": "Transcribe Audio or Video", "description": "Transcribe one recording."},
    RIVERSIDE: {"name": RIVERSIDE, "description": "Transcribe media."},
    CANVA: {"name": CANVA, "description": "Make a design."},
}


class Setup:
    def __init__(self) -> None:
        self.city: City = make_city(scripted_engine({}))
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.store = ConnectorStore(self.city.deps.ledger.table, self.city.deps.ledger.now)

    async def seed(self) -> None:
        for r in connectors():
            await self.store.create(r)

    def spec(self, name: str) -> ToolSpec:
        async def run(args: dict[str, Any]) -> str:
            self.calls.append((name, args))
            return f"ran {name}"

        schema = {"type": "object", "properties": {"url": {"type": "string"}, "format": {"type": "string"}}}
        return ToolSpec(name, f"[x, outside service] {name}", schema, run, server=GATEWAY_SERVER)

    async def turn(self, message: str = "", from_owner: bool = True) -> dict[str, ToolSpec]:
        d = self.city.deps
        ctx = TurnCtx("vaic", "vaic", None, "t-1", "t-1", conversation="main", from_owner=from_owner)
        records = await self.store.list()
        avoid = await no_connectors(d, "main", message if from_owner else "", records)
        base = [self.spec(DESCRIPT), self.spec(RIVERSIDE), self.spec(CANVA)]
        return {t.name: t for t in owner_connector_tools(d, ctx, base, records, LISTED, avoid)}

    @property
    def bus(self) -> MemoryBus:
        return self.city.bus  # type: ignore[return-value]

    def cards(self) -> list[dict[str, Any]]:
        return [e for e in self.bus.events if e["type"] == "vaic.question"]


ARGS = {"url": "https://www.youtube.com/watch?v=x", "format": "txt"}


async def test_a_connector_call_on_the_owners_message_asks_first() -> None:
    s = Setup()
    await s.seed()
    t = await s.turn("transcribe this youtube video")
    out = await t[DESCRIPT].handler(ARGS)
    assert "NOT run yet" in out and not s.calls
    (card,) = s.cards()
    assert card["question"] == "Vice wants to use Transcribe Audio or Video from Descript"
    assert card["options"] == ["Allow once", "Always allow", "Decline"]
    p = card["permission"]
    assert p["inputs"] == [["Url", ARGS["url"]], ["Format", "txt"]]
    assert p["description"] == "Transcribe one recording." and p["params"] == ["url", "format"]
    # The dropdown: Riverside transcribes too; Canva doesn't.
    assert [c["id"] for c in p["choices"]] == ["descript", "riverside"]
    # The same turn can't answer for the owner.
    assert "same turn" in await t["connector_permission"].handler({"answer": "allow_once"})


async def test_allow_once_runs_the_kept_call_and_asks_again_next_time() -> None:
    s = Setup()
    await s.seed()
    await (await s.turn("transcribe it"))[DESCRIPT].handler(ARGS)
    out = await (await s.turn("Allow once"))["connector_permission"].handler({"answer": "allow_once"})
    assert out == f"ran {DESCRIPT}" and s.calls == [(DESCRIPT, ARGS)]
    assert [e["saved"] for e in s.bus.events if e["type"] == "vaic.change"] == [True]
    assert await s.city.deps.ledger.table.get(ASK_PK, "main") is None
    assert "NOT run yet" in await (await s.turn("again please"))[DESCRIPT].handler(ARGS)


async def test_always_allow_is_remembered_on_the_connector() -> None:
    s = Setup()
    await s.seed()
    await (await s.turn("transcribe it"))[DESCRIPT].handler(ARGS)
    assert (
        await (await s.turn("Always allow"))["connector_permission"].handler({"answer": "always"}) == f"ran {DESCRIPT}"
    )
    rec = await s.store.get("descript")
    assert rec is not None and rec["always_allow"] == ["transcribe_audio_video"]
    # Next time it runs without a card; another of Descript's tools would still ask.
    before = len(s.cards())
    assert await (await s.turn("and this one"))[DESCRIPT].handler(ARGS) == f"ran {DESCRIPT}"
    assert len(s.cards()) == before


async def test_decline_runs_nothing_and_leaves_that_service_out() -> None:
    s = Setup()
    await s.seed()
    await (await s.turn("transcribe it"))[DESCRIPT].handler(ARGS)
    out = await (await s.turn("Decline"))["connector_permission"].handler({"answer": "decline"})
    assert "declined Descript" in out and "another way" in out and not s.calls
    assert [e["saved"] for e in s.bus.events if e["type"] == "vaic.change"] == [False]
    t = await s.turn("ok, then try something else")
    assert DESCRIPT not in t and RIVERSIDE in t


async def test_picking_another_service_in_the_list_lets_vaic_call_it() -> None:
    s = Setup()
    await s.seed()
    await (await s.turn("transcribe it"))[DESCRIPT].handler(ARGS)
    t = await s.turn("Allow once (use Riverside)")
    out = await t["connector_permission"].handler({"answer": "allow_once", "connector": "Riverside"})
    assert "chose Riverside" in out and RIVERSIDE in out and not s.calls
    assert await t[RIVERSIDE].handler({"url": "u"}) == f"ran {RIVERSIDE}"


async def test_no_connectors_leaves_them_out_and_nothing_asks() -> None:
    s = Setup()
    await s.seed()
    t = await s.turn("Is it possible to do it without any connectors?")
    assert not [n for n in t if "___" in n] and not s.cards()
    # It holds for the follow-ups too, until the owner says connectors are fine again.
    assert not [n for n in await s.turn("ok go") if "___" in n]
    assert DESCRIPT in await s.turn("you can use connectors again")


async def test_dont_use_one_service_leaves_only_that_one_out() -> None:
    s = Setup()
    await s.seed()
    t = await s.turn("transcribe this but don't use Descript")
    assert DESCRIPT not in t and RIVERSIDE in t and CANVA in t
    t = await s.turn("actually use Descript")
    assert DESCRIPT in t


async def test_turns_that_arent_the_owners_message_never_ask() -> None:
    s = Setup()
    await s.seed()
    t = await s.turn("a worker's report", from_owner=False)
    assert "connector_permission" not in t
    assert await t[DESCRIPT].handler(ARGS) == f"ran {DESCRIPT}" and not s.cards()


async def test_nothing_waiting_says_so() -> None:
    s = Setup()
    await s.seed()
    assert "No connector call is waiting" in await (await s.turn("hi"))["connector_permission"].handler(
        {"answer": "allow_once"}
    )


def test_titles_and_similar_tools() -> None:
    assert tool_title("transcribe_audio_video") == "Transcribe audio video"
    assert tool_title("x", {"annotations": {"title": "Make a clip"}}) == "Make a clip"
    assert similar("transcribe_audio_video", "transcribeMedia")
    assert similar("search_people", "people_search")
    assert not similar("create_design", "transcribe_media")
