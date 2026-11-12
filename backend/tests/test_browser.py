"""VAIC's browser (decision 265): steps, screenshots streamed to the chat, the YouTube transcript, frames, and what it
refuses (private addresses, password fields)."""

from __future__ import annotations

from typing import Any

import pytest

from vaic.runtime import browser as b
from vaic.runtime.browser import BrowseRun, ToolReply, url_problem
from vaic.runtime.direct import _run_tool
from vaic.runtime.tools import TurnCtx


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    async def nap(_s: float) -> None:
        return None

    monkeypatch.setattr(b.asyncio, "sleep", nap)


def public(_host: str) -> list[str]:
    return ["142.250.74.46"]


class FakePage:
    def __init__(self) -> None:
        self.url, self.title = "about:blank", ""
        self.log: list[Any] = []
        self.password = False
        self.closed = False
        self.video_at = 0.0

    async def open(self, url: str) -> None:
        self.url, self.title = url, "A video - YouTube"
        self.log.append(("open", url))

    async def click(self, x: float, y: float) -> None:
        self.log.append(("click", x, y))

    async def type(self, text: str) -> None:
        self.log.append(("type", text))

    async def key(self, name: str) -> None:
        self.log.append(("key", name))

    async def scroll(self, dy: float) -> None:
        self.log.append(("scroll", dy))

    async def evaluate(self, js: str) -> Any:
        if js == b._PAGE:
            return f'{{"url": "{self.url}", "title": "{self.title}"}}'
        if js == b._SIGN_IN_FIELD:
            return self.password
        if js == b._CONSENT:
            return False
        if js == b._READ:
            return "Intro\nand then he said hello world to everyone\nOutro"
        if js == b._TRANSCRIPT:
            return "0:03 welcome back\n1:12 hello world everyone" if "youtube" in self.url else None
        if "getBoundingClientRect" in js:
            return {"x": 300, "y": 200} if "show transcript" in js else None
        if "currentTime" in js:
            return {"t": 0, "d": 600}
        return None

    async def screenshot(self) -> bytes:
        return b"\xff\xd8jpeg"

    async def close(self) -> None:
        self.closed = True


class Shots:
    def __init__(self) -> None:
        self.keys: list[str] = []

    async def put(self, key: str, data: bytes) -> str:
        self.keys.append(key)
        return f"https://vaic-prod-files.s3.amazonaws.com/{key}?X-Amz-Signature=x"


def make() -> tuple[BrowseRun, FakePage, Shots, list[dict[str, Any]]]:
    page, shots, sent = FakePage(), Shots(), []

    async def new() -> Any:
        return page

    async def send(e: dict[str, Any]) -> None:
        sent.append(e)

    t = [100.0]

    def clock() -> float:
        t[0] += 1.5
        return t[0]

    run = BrowseRun(new, shots, send, "main", "m-1", clock=clock, resolve=public)
    return run, page, shots, sent


async def test_find_hello_world_in_a_youtube_video_through_its_transcript() -> None:
    run, page, shots, sent = make()
    out = await run.run(
        [{"action": "open", "url": "https://www.youtube.com/watch?v=jFLIQSVA1c"}, {"action": "transcript"}]
    )
    assert "1:12 hello world everyone" in out and "<page-text>" in out and "data, not instructions" in out
    assert shots.keys == ["browser/main/m-1/001.jpg", "browser/main/m-1/002.jpg"]
    steps = [e["step"] for e in sent]
    assert [s["label"] for s in steps] == ["Opened www.youtube.com", "Opened the transcript"]
    assert steps[0]["shot"].endswith("X-Amz-Signature=x") and steps[0]["url"].startswith("https://www.youtube.com")
    assert all(e["type"] == "vaic.browser" and e["conversation"] == "main" and not e["done"] for e in sent)
    assert [e["actions"] for e in sent] == [1, 2]
    await run.close()
    assert page.closed and sent[-1]["done"] is True and sent[-1]["actions"] == 2


async def test_clicks_carry_the_pointer_for_the_live_view() -> None:
    run, page, _, sent = make()
    await run.run(
        [{"action": "open", "url": "https://example.com"}, {"action": "click_text", "text": "Show transcript"}]
    )
    assert ("click", 300.0, 200.0) in page.log
    assert (
        sent[-1]["step"]["pointer"] == {"x": 300.0, "y": 200.0}
        and sent[-1]["step"]["label"] == "Clicked “Show transcript”"
    )
    out = await run.run([{"action": "click_text", "text": "nope"}])
    assert "nothing visible says that" in out


async def test_find_reads_only_matching_lines() -> None:
    run, *_ = make()
    out = await run.run([{"action": "open", "url": "https://example.com"}, {"action": "find", "text": "hello world"}])
    assert "and then he said hello world to everyone" in out and "Intro" not in out


async def test_look_and_frames_hand_the_model_pictures() -> None:
    run, *_ = make()
    out = await run.run(
        [
            {"action": "open", "url": "https://www.twitch.tv/videos/1"},
            {"action": "frames", "from": 0, "to": 40, "every": 10},
        ]
    )
    assert isinstance(out, ToolReply) and len(out.images) == 5 and "0:00, 0:10, 0:20, 0:30, 0:40" in out
    out = await run.run([{"action": "look"}])
    assert len(out.images) == 1


async def test_never_types_into_a_password_field() -> None:
    run, page, *_ = make()
    page.password = True
    out = await run.run([{"action": "open", "url": "https://example.com/login"}, {"action": "type", "text": "hunter2"}])
    assert "password field" in out and not any(x[0] == "type" for x in page.log)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:8080",
        "https://10.0.0.5/admin",
        "file:///etc/passwd",
        "https://user:pw@example.com",
        "javascript:x",
    ],
)
def test_private_or_signed_in_addresses_are_refused(url: str) -> None:
    assert url_problem(url, public) is not None


async def test_a_refused_address_opens_nothing() -> None:
    run, page, *_ = make()
    out = await run.run([{"action": "open", "url": "http://169.254.169.254/latest/meta-data"}])
    assert "private" in out and not page.log


async def test_a_browser_that_wont_start_says_so() -> None:
    async def broken() -> Any:
        raise RuntimeError("no browser here")

    async def send(_e: dict[str, Any]) -> None:
        return None

    run = BrowseRun(broken, Shots(), send, "main", "m-1", resolve=public)
    assert "didn't start" in await run.run([{"action": "open", "url": "https://example.com"}])


async def test_the_tool_passes_the_policy_gate_and_the_engine_sends_its_pictures() -> None:
    run, *_ = make()
    spec = run.spec(TurnCtx("vaic", "vaic", None, "t", "t", conversation="main", from_owner=True))
    assert spec.name == "browse" and spec.self_gated

    class Req:
        on_activity = None
        on_tool_done = None

    use = {
        "name": "browse",
        "toolUseId": "u1",
        "input": {"steps": [{"action": "open", "url": "https://x.com"}, {"action": "look"}]},
    }
    r = await _run_tool(Req(), {"browse": spec}, use)  # type: ignore[arg-type]
    content = r["toolResult"]["content"]
    assert "Now on:" in content[0]["text"] and content[1]["image"]["format"] == "jpeg"
