"""VAIC's real-time voice (decision 120): Nova 2 Sonic as the voice, VAIC as the brain, with a fake Bedrock stream."""

import asyncio
import json
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from starlette.testclient import TestClient

from aic.lambdas.api import ROUTES, handle_http
from aic.runtime import voice as V
from aic.runtime.prompts import load_prompt
from aic.runtime.server import create_app
from aic.shared.voice_url import VoiceUrlDeps, presigned_voice_url
from test_api import ev, js, make


class FakeStream:
    """A Bedrock bidirectional stream: records what the relay sends; the test pushes what Sonic says."""

    def __init__(self, fail: bool = False) -> None:
        self.sent: list[dict[str, Any]] = []
        self.out: asyncio.Queue[dict[str, Any] | Exception | None] = asyncio.Queue()
        self.closed = False
        if fail:
            self.out.put_nowait(RuntimeError("ValidationException: model not available"))

    async def send(self, event: dict[str, Any]) -> None:
        self.sent.append(event["event"])

    async def events(self) -> Any:
        while True:
            item = await self.out.get()
            if item is None:
                return
            if isinstance(item, Exception):
                raise item
            yield {"event": item}

    async def close(self) -> None:
        self.closed = True

    def kinds(self) -> list[str]:
        return [next(iter(e)) for e in self.sent]


class Rig:
    def __init__(self, fail_first: bool = False, answer: str = "Two departments are busy.", delay: float = 0) -> None:
        self.streams: list[FakeStream] = []
        self.opened: list[tuple[str, str]] = []
        self.client: list[dict[str, Any]] = []
        self.asked: list[str] = []
        self.fail_first, self.answer, self.delay = fail_first, answer, delay
        self.now = 1000.0

        async def open_stream(model: str, region: str) -> Any:
            self.opened.append((model, region))
            s = FakeStream(fail=self.fail_first and len(self.streams) == 0)
            self.streams.append(s)
            return s

        async def send(msg: dict[str, Any]) -> None:
            self.client.append(msg)

        async def ask(text: str) -> str:
            self.asked.append(text)
            await asyncio.sleep(self.delay)
            return self.answer

        self.s = V.SonicSession(
            send_client=send,
            ask_aic=ask,
            open_stream=open_stream,
            system_prompt="You are the voice of VAIC.",
            candidates=[("nova-2", "eu-north-1"), ("nova-2", "us-east-1"), ("nova-1", "eu-north-1")],
            clock=lambda: self.now,
        )

    @property
    def stream(self) -> FakeStream:
        return self.streams[-1]

    def types(self) -> list[str]:
        return [m["type"] for m in self.client]


async def settle() -> None:
    for _ in range(20):
        await asyncio.sleep(0)


async def say(r: Rig, *events: dict[str, Any]) -> None:
    for e in events:
        await r.stream.out.put(e)
    await settle()


def user_said(text: str) -> list[dict[str, Any]]:
    return [{"contentStart": {"role": "USER", "type": "TEXT"}}, {"textOutput": {"role": "USER", "content": text}}]


def tool_call(request: str, use_id: str = "tu-1") -> list[dict[str, Any]]:
    return [
        {"contentStart": {"role": "TOOL", "type": "TOOL"}},
        {"toolUse": {"toolName": "ask_aic", "toolUseId": use_id, "content": json.dumps({"request": request})}},
        {"contentEnd": {"type": "TOOL"}},
    ]


async def test_it_opens_sonic_with_aic_as_its_only_tool_and_streams_the_mic_in() -> None:
    r = Rig()
    await r.s.start()
    assert r.opened == [("nova-2", "eu-north-1")]
    assert r.client[0] == {"type": "ready", "model": "nova-2", "region": "eu-north-1"}
    k = r.stream.kinds()
    assert k[:2] == ["sessionStart", "promptStart"]
    start = r.stream.sent[1]["promptStart"]
    (tool,) = start["toolConfiguration"]["tools"]
    assert tool["toolSpec"]["name"] == "ask_aic"
    assert start["audioOutputConfiguration"]["sampleRateHertz"] == 24000
    assert r.stream.sent[0]["sessionStart"]["turnDetectionConfiguration"]["endpointingSensitivity"] == "MEDIUM"
    system = next(e for e in r.stream.sent if "textInput" in e)["textInput"]["content"]
    assert system == "You are the voice of VAIC."
    assert r.stream.sent[-1]["contentStart"]["type"] == "AUDIO"
    await r.s.on_client({"type": "audio", "data": "AAAA"})
    assert r.stream.sent[-1] == {
        "audioInput": {"promptName": r.s.prompt, "contentName": r.s.audio_name, "content": "AAAA"}
    }
    await r.s.close()


async def test_a_spoken_request_goes_to_aic_and_its_answer_comes_back_to_sonic() -> None:
    r = Rig()
    await r.s.start()
    await say(r, *user_said("what's the status?"), *tool_call("what's the status of the city?"))
    await settle()
    assert r.asked == ["what's the status of the city?"]
    assert {"type": "transcript", "role": "user", "text": "what's the status?"} in r.client
    assert {"type": "thinking", "on": True, "request": "what's the status of the city?"} in r.client
    assert {"type": "thinking", "on": False} in r.client
    tr = next(e for e in r.stream.sent if "toolResult" in e)["toolResult"]
    assert json.loads(tr["content"]) == {"answer": "Two departments are busy."}
    start = next(e for e in r.stream.sent if e.get("contentStart", {}).get("type") == "TOOL")["contentStart"]
    assert start["toolResultInputConfiguration"]["toolUseId"] == "tu-1"
    # Sonic says it; the final text is marked as VAIC's answer for the chat.
    await say(
        r,
        {"contentStart": {"role": "ASSISTANT", "additionalModelFields": '{"generationStage":"FINAL"}'}},
        {"textOutput": {"role": "ASSISTANT", "content": "Two departments are busy right now."}},
    )
    assert r.client[-1] == {
        "type": "transcript",
        "role": "assistant",
        "text": "Two departments are busy right now.",
        "aic": True,
    }
    await r.s.close()


async def test_barge_in_tells_the_browser_to_stop_at_once_and_audio_is_passed_through() -> None:
    r = Rig()
    await r.s.start()
    big = "A" * (V.MAX_FRAME * 2 + 10)
    await say(r, {"contentStart": {"role": "ASSISTANT"}}, {"audioOutput": {"content": big}})
    audio = [m for m in r.client if m["type"] == "audio"]
    assert "".join(m["data"] for m in audio) == big and all(len(m["data"]) <= V.MAX_FRAME for m in audio)
    await say(r, {"textOutput": {"role": "ASSISTANT", "content": V.INTERRUPTED}})
    assert r.client[-1] == {"type": "interrupted"}
    await r.s.close()


async def test_long_work_gets_a_short_spoken_cue_from_sonic() -> None:
    r = Rig(delay=0.08)
    r.s.cue_after_s, r.s.cue_again_s = 0.01, 10
    await r.s.start()
    await say(r, *tool_call("build me a landing page"))
    await asyncio.sleep(0.05)
    texts = [e["textInput"]["content"] for e in r.stream.sent if "textInput" in e]
    assert any(t.startswith("[status]") for t in texts)
    await asyncio.sleep(0.1)
    assert any("toolResult" in e for e in r.stream.sent)
    await r.s.close()


async def test_a_model_that_cannot_be_used_falls_through_to_the_next() -> None:
    r = Rig(fail_first=True)
    await r.s.start()
    await settle()
    await asyncio.sleep(0.01)
    assert r.opened == [("nova-2", "eu-north-1"), ("nova-2", "us-east-1")]
    assert r.client[-1] == {"type": "ready", "model": "nova-2", "region": "us-east-1"}
    await r.s.close()


async def test_before_bedrocks_8_minutes_it_moves_to_a_fresh_stream_and_replays_the_conversation() -> None:
    r = Rig()
    await r.s.start()
    await say(r, *user_said("remind me about the dentist"))
    first = r.stream
    r.now += V.ROTATE_AFTER_S + 1
    await r.s.on_client({"type": "audio", "data": "BBBB"})
    assert r.stream is not first and len(r.opened) == 2
    replay = [e["textInput"]["content"] for e in r.stream.sent if "textInput" in e]
    assert "remind me about the dentist" in replay
    assert r.stream.sent[-1]["audioInput"]["content"] == "BBBB"
    await r.s.close()


def test_the_voice_prompt_keeps_aic_the_brain() -> None:
    p = load_prompt("voice.md")
    assert p.tools == ["ask_aic"]
    body = p.body
    assert "Never answer facts, status, plans, numbers or tasks from your own knowledge" in body
    assert "[status]" in body and "stop at once and listen" in body and '"Vice"' in body


def test_the_runtime_serves_the_voice_on_ws() -> None:
    sent: list[dict[str, Any]] = []

    class Session:
        def __init__(self, send: Any, live: dict[str, str]) -> None:
            self.send = send

        async def start(self) -> None:
            await self.send({"type": "ready", "model": "nova-2", "region": "eu-north-1"})

        async def on_client(self, msg: dict[str, Any]) -> None:
            sent.append(msg)

        async def close(self) -> None:
            sent.append({"type": "closed"})

    class Host:
        async def run_turn(self, inv: dict[str, Any]) -> str:
            return ""

    app = create_app(Host(), voice=Session)
    with TestClient(app) as c, c.websocket_connect("/ws") as ws:
        assert ws.receive_json() == {"type": "ready", "model": "nova-2", "region": "eu-north-1"}
        ws.send_text(json.dumps({"type": "audio", "data": "AAAA"}))
        ws.send_text(json.dumps({"type": "stop"}))
    assert sent[0] == {"type": "audio", "data": "AAAA"} and sent[-1] == {"type": "closed"}


async def test_the_api_hands_out_a_five_minute_signed_address_to_aics_own_runtime() -> None:
    assert ("POST", "/voice/session") in ROUTES
    none = await handle_http(ev("POST", "/voice/session"), make())
    assert none["statusCode"] == 503

    class Creds:
        def get_frozen_credentials(self) -> Any:
            from botocore.credentials import ReadOnlyCredentials

            return ReadOnlyCredentials("AKIAEXAMPLE", "secret", "token")

    class Session:
        def get_credentials(self) -> Any:
            return Creds()

    arn = "arn:aws:bedrock-agentcore:eu-north-1:111122223333:runtime/aic_prod_ace-abc"
    deps = VoiceUrlDeps(session=Session(), region="eu-north-1", runtime_arn=arn, session_id=lambda: "ace-owner-main-v1")
    url = presigned_voice_url(deps)
    u = urlparse(url)
    q = parse_qs(u.query)
    assert u.scheme == "wss" and u.netloc == "bedrock-agentcore.eu-north-1.amazonaws.com"
    assert (
        u.path == "/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aeu-north-1%3A111122223333%3Aruntime%2Faic_prod_ace-abc/ws"
    )
    assert q["X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"] == ["ace-owner-main-v1"]
    assert q["X-Amz-Expires"] == ["300"] and "X-Amz-Signature" in q
    r = js(await handle_http(ev("POST", "/voice/session"), make(voice=deps)))
    assert r["url"].startswith("wss://") and r["expires_in"] == 300


async def test_a_stream_that_keeps_failing_says_why_instead_of_going_silent() -> None:
    r = Rig()
    await r.s.start()
    for _ in range(4):
        if r.client and r.client[-1].get("type") in ("error", "closed"):
            break
        await r.stream.out.put(RuntimeError("AccessDeniedException: not authorized"))
        await settle()
        await asyncio.sleep(0.01)
    errors = [m for m in r.client if m["type"] == "error"]
    assert errors and "AccessDeniedException" in errors[0]["message"]
    assert len(r.opened) <= 4  # tried the next models, then gave up; no endless reopening
    await r.s.close()


async def test_when_no_model_opens_the_reason_reaches_the_browser() -> None:
    async def refuse(model: str, region: str) -> Any:
        raise RuntimeError(f"ValidationException: {model} is not available in {region}")

    sent: list[dict[str, Any]] = []

    async def send(m: dict[str, Any]) -> None:
        sent.append(m)

    async def ask(_: str) -> str:
        return ""

    s = V.SonicSession(
        send_client=send, ask_aic=ask, open_stream=refuse, system_prompt="x", candidates=[("nova-2", "eu-north-1")]
    )
    with pytest.raises(RuntimeError, match="nova-2 in eu-north-1: RuntimeError: ValidationException"):
        await s.start()


async def test_quick_answers_get_no_cue_and_a_cue_never_starts_while_the_owner_talks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(V, "USER_QUIET_S", 0.5)
    statuses = lambda r: [e for e in r.stream.sent if e.get("textInput", {}).get("content", "").startswith("[status]")]  # noqa: E731
    # A quick answer: no cue.
    r = Rig(delay=0.01)
    r.s.cue_after_s = 0.05
    await r.s.start()
    await say(r, *tool_call("what's the time?"))
    await asyncio.sleep(0.1)
    assert statuses(r) == []
    await r.s.close()
    # A long one while the owner is still talking: the cue waits for a quiet moment.
    r = Rig(delay=0.3)
    r.s.cue_after_s, r.s.cue_again_s, r.s.max_cues = 0.02, 10, 1
    await r.s.start()
    await say(r, *tool_call("build me a landing page"))
    await say(r, *user_said("and make it blue"))  # the owner keeps talking
    await asyncio.sleep(0.05)
    assert statuses(r) == []
    r.now += 1  # quiet now
    await asyncio.sleep(0.3)
    assert len(statuses(r)) == 1
    await r.s.close()


async def test_the_api_says_why_aws_refused_the_voice_connection(monkeypatch: Any) -> None:
    import aic.lambdas.api as api_mod

    class Creds:
        def get_frozen_credentials(self) -> Any:
            from botocore.credentials import ReadOnlyCredentials

            return ReadOnlyCredentials("AKIAEXAMPLE", "secret", "token")

    class Session:
        def get_credentials(self) -> Any:
            return Creds()

    arn = "arn:aws:bedrock-agentcore:eu-north-1:111122223333:runtime/aic_prod_ace-abc"
    deps = VoiceUrlDeps(session=Session(), region="eu-north-1", runtime_arn=arn, session_id=lambda: "s" * 40)
    seen: list[str] = []

    async def refused(url: str, timeout_s: float = 8.0) -> tuple[int, str]:
        seen.append(url)
        return 403, '{"message":"not authorized to perform: bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream"}'

    monkeypatch.setattr(api_mod, "check_voice_url", refused)
    assert ("POST", "/voice/check") in ROUTES
    r = js(await handle_http(ev("POST", "/voice/check"), make(voice=deps)))
    assert r["ok"] is False and r["status"] == 403 and "InvokeAgentRuntimeWithWebSocketStream" in r["reason"]
    assert seen and seen[0].startswith("wss://bedrock-agentcore.eu-north-1.amazonaws.com/runtimes/")

    async def accepted(url: str, timeout_s: float = 8.0) -> tuple[int, str]:
        return 101, ""

    monkeypatch.setattr(api_mod, "check_voice_url", accepted)
    r = js(await handle_http(ev("POST", "/voice/check"), make(voice=deps)))
    assert r["ok"] is True


async def test_the_real_uvicorn_server_accepts_the_voice_websocket() -> None:
    """The same server the runtime image runs (uvicorn), not Starlette's test client: without a WebSocket library
    uvicorn answered /ws with 404 and AgentCore reported 424 to the owner (2026-11-09)."""
    import socket

    import uvicorn
    import websockets

    class Session:
        def __init__(self, send: Any, live: dict[str, str]) -> None:
            self.send = send

        async def start(self) -> None:
            await self.send({"type": "ready", "model": "nova-2", "region": "eu-north-1"})

        async def on_client(self, msg: dict[str, Any]) -> None:
            pass

        async def close(self) -> None:
            pass

    class Host:
        async def run_turn(self, inv: dict[str, Any]) -> str:
            return ""

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(create_app(Host(), voice=Session), host="127.0.0.1", port=port, log_level="error")
    )
    task = asyncio.create_task(server.serve())
    try:
        for _ in range(100):
            if server.started:
                break
            await asyncio.sleep(0.02)
        async with websockets.connect(f"ws://127.0.0.1:{port}/ws") as ws:
            assert json.loads(await ws.recv()) == {"type": "ready", "model": "nova-2", "region": "eu-north-1"}
    finally:
        server.should_exit = True
        await task


async def test_nova_sonic_is_opened_on_the_duplex_crt_transport(monkeypatch: Any) -> None:
    """The bidirectional stream needs HTTP/2 both ways: on the SDK's default aiohttp transport Bedrock refused with
    "UnsupportedTransportError ... does not support duplex" and the owner had no real-time voice (2026-11-09)."""
    from aws_sdk_bedrock_runtime import client as client_mod
    from aws_sdk_bedrock_runtime.config import AsyncBedrockRuntimeConfig
    from smithy_http.aio.crt import AWSCRTHTTPClient

    from aic.runtime.voice import bedrock_opener

    seen: dict[str, Any] = {}

    async def resolve(**kw: Any) -> Any:
        seen.update(kw)
        return object()

    class Client:
        def __init__(self, config: Any) -> None:
            pass

        async def invoke_model_with_bidirectional_stream(self, _input: Any) -> Any:
            return object()

    monkeypatch.setattr(AsyncBedrockRuntimeConfig, "resolve", staticmethod(resolve))
    monkeypatch.setattr(client_mod, "AsyncBedrockRuntimeClient", Client)

    class Frozen:
        access_key, secret_key, token = "AKIA", "s", "t"

    class Session:
        def get_credentials(self) -> Any:
            return type("C", (), {"get_frozen_credentials": lambda self: Frozen()})()

    await bedrock_opener(Session())("amazon.nova-2-sonic-v1:0", "eu-north-1")
    assert isinstance(seen["transport"], AWSCRTHTTPClient)
    assert seen["region"] == "eu-north-1"
