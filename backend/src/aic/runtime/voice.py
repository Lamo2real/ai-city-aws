"""AIC's real-time voice (decision 120): Amazon Nova 2 Sonic as the voice, AIC as the brain.

The browser opens a WebSocket to AIC's own AgentCore runtime (``/ws``, a presigned URL from ``POST /voice/session``)
and streams microphone audio. This module keeps one Nova 2 Sonic bidirectional stream per connection: Sonic hears,
takes turns (it knows when the owner has finished), speaks, and stops the moment the owner talks over it (barge-in).
It never answers on its own: every real request goes to the one tool it has, ``ask_aic``, which runs a normal AIC turn
in this same process (same model, tools, ledger and departments), and Sonic speaks the answer.

Browser → relay (JSON text frames): ``{"type": "audio", "data": <base64 PCM16 16 kHz mono>}``, ``{"type": "stop"}``.
Relay → browser: ``ready`` (model, region), ``audio`` (base64 PCM16 24 kHz), ``transcript`` (role, text),
``interrupted`` (stop playback now), ``thinking`` (on: AIC is working), ``error`` (message), ``closed``.

Thinking cues: Sonic says a short cue itself before calling the tool (its prompt asks for it); if AIC is still working
after ``CUE_AFTER_S`` (and again after ``CUE_AGAIN_S``), a ``[status]`` line asks Sonic for a two-to-three-word cue.
Sessions: Bedrock closes a stream after 8 minutes; the relay starts a fresh one before that, while Sonic is quiet,
and replays the conversation so far as text, so the owner never notices.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from aic.shared.config import voice_config
from aic.shared.log import log

INTERRUPTED = '{ "interrupted" : true }'
CUE_AFTER_S = 4.0
CUE_AGAIN_S = 12.0
ROTATE_AFTER_S = 7 * 60 + 15  # Bedrock's limit is 8 minutes
QUIET_S = 1.5  # Sonic counts as quiet this long after its last audio
HISTORY = 24  # lines replayed into a fresh session
MAX_FRAME = 24_000  # AgentCore WebSocket frames are capped at 32 KB


class Duplex(Protocol):
    """One open Bedrock bidirectional stream: send JSON events, read JSON events."""

    async def send(self, event: dict[str, Any]) -> None: ...
    def events(self) -> AsyncIterator[dict[str, Any]]: ...
    async def close(self) -> None: ...


Opener = Callable[[str, str], Awaitable[Duplex]]
"""``open(model_id, region)``: a new stream, or an exception when the model can't be used there."""
Send = Callable[[dict[str, Any]], Awaitable[None]]
Ask = Callable[[str], Awaitable[str]]


def _tool_spec() -> dict[str, Any]:
    schema = {
        "type": "object",
        "properties": {
            "request": {
                "type": "string",
                "description": "The owner's request in their own words, complete, with any context it depends on.",
            }
        },
        "required": ["request"],
    }
    return {
        "toolSpec": {
            "name": "ask_aic",
            "description": "Ask AIC, the owner's assistant: it knows the city, the departments, the owner's knowledge and"
            " tools, and starts or stops work. Use it for every request except greetings and thanks.",
            "inputSchema": {"json": json.dumps(schema)},
        }
    }


@dataclass
class SonicSession:
    send_client: Send
    ask_aic: Ask
    open_stream: Opener
    system_prompt: str
    voice_id: str = "tiffany"
    sensitivity: str = "MEDIUM"
    candidates: list[tuple[str, str]] = field(default_factory=list)
    """``(model_id, region)`` pairs, tried in order until one opens (and answers)."""
    clock: Callable[[], float] = time.monotonic

    stream: Duplex | None = None
    model: tuple[str, str] | None = None
    prompt: str = ""
    audio_name: str = ""
    started_at: float = 0.0
    last_audio_out: float = 0.0
    history: list[tuple[str, str]] = field(default_factory=list)  # (USER|ASSISTANT, text)
    _role: str = ""
    _final: bool = False
    _tool: dict[str, Any] = field(default_factory=dict)
    _tool_in_turn: bool = False
    _pending: set[asyncio.Task[Any]] = field(default_factory=set)
    _reader: asyncio.Task[Any] | None = None
    _closed: bool = False
    _got_output: bool = False
    _tried: int = 0
    _last_error: str = ""
    _errors_in_a_row: int = 0

    # ---------- opening and rotating streams ----------
    async def start(self) -> None:
        cands = self.candidates or [(c["modelId"], c["region"]) for c in voice_config().get("speech", [])]
        self.candidates = cands
        while self._tried < len(cands):
            model_id, region = cands[self._tried]
            self._tried += 1
            try:
                await self._open(model_id, region)
                await self.send_client({"type": "ready", "model": model_id, "region": region})
                return
            except Exception as e:
                self._last_error = f"{model_id} in {region}: {type(e).__name__}: {str(e)[:160]}"
                log(
                    "warn",
                    "voice.open_failed",
                    model=model_id,
                    region=region,
                    error=type(e).__name__,
                    detail=str(e)[:300],
                )
        raise RuntimeError(f"Nova Sonic could not be opened ({self._last_error or 'no model configured'})")

    async def _open(self, model_id: str, region: str, replay: bool = False) -> None:
        stream = await self.open_stream(model_id, region)
        self.stream, self.model = stream, (model_id, region)
        self.prompt, self.audio_name = str(uuid.uuid4()), str(uuid.uuid4())
        self.started_at, self._got_output = self.clock(), False
        await self._send(
            {
                "sessionStart": {
                    "inferenceConfiguration": {"maxTokens": 1024, "topP": 0.9, "temperature": 0.7},
                    "turnDetectionConfiguration": {"endpointingSensitivity": self.sensitivity},
                }
            }
        )
        await self._send(
            {
                "promptStart": {
                    "promptName": self.prompt,
                    "textOutputConfiguration": {"mediaType": "text/plain"},
                    "audioOutputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 24000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "voiceId": self.voice_id,
                        "encoding": "base64",
                        "audioType": "SPEECH",
                    },
                    "toolUseOutputConfiguration": {"mediaType": "application/json"},
                    "toolConfiguration": {"tools": [_tool_spec()]},
                }
            }
        )
        await self._text("SYSTEM", self.system_prompt, interactive=False)
        for role, text in self.history[-HISTORY:] if replay else []:
            await self._text(role, text, interactive=False)
        await self._send(
            {
                "contentStart": {
                    "promptName": self.prompt,
                    "contentName": self.audio_name,
                    "type": "AUDIO",
                    "interactive": True,
                    "role": "USER",
                    "audioInputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 16000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "audioType": "SPEECH",
                        "encoding": "base64",
                    },
                }
            }
        )
        self._reader = asyncio.create_task(self._read(stream))

    async def _rotate(self, why: str) -> None:
        """A fresh stream with the conversation replayed, on the same model."""
        old = self.stream
        assert self.model is not None
        log("info", "voice.rotate", why=why, lines=len(self.history))
        try:
            await self._open(*self.model, replay=True)
        except Exception as e:
            log("warn", "voice.rotate_failed", error=type(e).__name__)
            await self.send_client(
                {"type": "error", "message": "The voice connection dropped. Tap the voice button again."}
            )
            await self.close()
            return
        if old is not None:
            asyncio.create_task(old.close())  # noqa: RUF006  (fire and forget: the old stream is done)

    # ---------- the browser's side ----------
    async def on_client(self, msg: dict[str, Any]) -> None:
        if msg.get("type") == "audio" and isinstance(msg.get("data"), str) and self.stream:
            if self.clock() - self.started_at > ROTATE_AFTER_S and self._quiet():
                await self._rotate("time")
            await self._send(
                {"audioInput": {"promptName": self.prompt, "contentName": self.audio_name, "content": msg["data"]}}
            )
        elif msg.get("type") == "stop":
            await self.close()

    def _quiet(self) -> bool:
        return not self._pending and self.clock() - self.last_audio_out > QUIET_S

    # ---------- Sonic's side ----------
    async def _read(self, stream: Duplex) -> None:
        try:
            async for ev in stream.events():
                if stream is not self.stream:
                    return
                self._got_output = True
                self._errors_in_a_row = 0
                await self._on_event(ev.get("event", {}))
        except Exception as e:
            if stream is not self.stream or self._closed:
                return
            log("warn", "voice.stream_error", error=type(e).__name__, detail=str(e)[:300])
            assert self.model is not None
            self._last_error = f"{self.model[0]} in {self.model[1]}: {type(e).__name__}: {str(e)[:160]}"
            if not self._got_output and self._tried < len(self.candidates):
                model_id, region = self.candidates[self._tried]  # this model isn't usable here: the next one
                self._tried += 1
                try:
                    await self._open(model_id, region, replay=True)
                    await self.send_client({"type": "ready", "model": model_id, "region": region})
                    return
                except Exception as e2:
                    log("warn", "voice.open_failed", model=model_id, region=region, error=type(e2).__name__)
            # A stream that keeps failing before Sonic says anything is not coming back: say why and stop,
            # instead of reopening it forever while the owner hears nothing.
            self._errors_in_a_row += 1
            if not self._got_output and self._errors_in_a_row >= 2:
                log("warn", "voice.gave_up", detail=self._last_error)
                await self.send_client({"type": "error", "message": f"Nova Sonic stopped ({self._last_error})"})
                await self.close()
                return
            await self._rotate("error")
            return
        if stream is self.stream and not self._closed:
            await self._rotate("ended")

    async def _on_event(self, ev: dict[str, Any]) -> None:
        if "contentStart" in ev:
            c = ev["contentStart"]
            self._role = c.get("role", "")
            stage = ""
            with contextlib.suppress(ValueError):
                stage = json.loads(c.get("additionalModelFields") or "{}").get("generationStage", "")
            self._final = stage == "FINAL" or (self._role == "USER")
        elif "textOutput" in ev:
            text = str(ev["textOutput"].get("content", ""))
            if INTERRUPTED in text:
                await self.send_client({"type": "interrupted"})  # barge-in: the browser stops playback now
                return
            if self._role == "USER" and text.strip():
                self._tool_in_turn = False
                self.history.append(("USER", text))
                await self.send_client({"type": "transcript", "role": "user", "text": text})
            elif self._role == "ASSISTANT" and self._final and text.strip():
                self.history.append(("ASSISTANT", text))
                await self.send_client(
                    {"type": "transcript", "role": "assistant", "text": text, "aic": self._tool_in_turn}
                )
        elif "audioOutput" in ev:
            self.last_audio_out = self.clock()
            data = str(ev["audioOutput"].get("content", ""))
            for i in range(0, len(data), MAX_FRAME):
                await self.send_client({"type": "audio", "data": data[i : i + MAX_FRAME]})
        elif "toolUse" in ev:
            self._tool = ev["toolUse"]
        elif "contentEnd" in ev and ev["contentEnd"].get("type") == "TOOL" and self._tool:
            tool, self._tool = self._tool, {}
            self._tool_in_turn = True
            task = asyncio.create_task(self._run_tool(tool))
            self._pending.add(task)
            task.add_done_callback(self._pending.discard)

    async def _run_tool(self, tool: dict[str, Any]) -> None:
        use_id = str(tool.get("toolUseId", ""))
        try:
            request = str(json.loads(tool.get("content") or "{}").get("request", "")).strip()
        except ValueError:
            request = ""
        await self.send_client({"type": "thinking", "on": True, "request": request})
        cues = asyncio.create_task(self._cues())
        try:
            answer = await self.ask_aic(request) if request else "The request was empty; ask the owner to say it again."
            result: dict[str, Any] = {"answer": answer}
        except Exception as e:
            log("warn", "voice.ask_failed", error=type(e).__name__)
            result = {"error": "AIC could not answer just now."}
        finally:
            cues.cancel()
            await self.send_client({"type": "thinking", "on": False})
        name = str(uuid.uuid4())
        await self._send(
            {
                "contentStart": {
                    "promptName": self.prompt,
                    "contentName": name,
                    "interactive": False,
                    "type": "TOOL",
                    "role": "TOOL",
                    "toolResultInputConfiguration": {
                        "toolUseId": use_id,
                        "type": "TEXT",
                        "textInputConfiguration": {"mediaType": "text/plain"},
                    },
                }
            }
        )
        await self._send(
            {"toolResult": {"promptName": self.prompt, "contentName": name, "content": json.dumps(result)}}
        )
        await self._send({"contentEnd": {"promptName": self.prompt, "contentName": name}})

    async def _cues(self) -> None:
        """A short, human cue while AIC works longer than a moment: once after CUE_AFTER_S, once more later."""
        await asyncio.sleep(CUE_AFTER_S)
        await self._text("USER", "[status] AIC is still working on it.", interactive=True)
        await asyncio.sleep(CUE_AGAIN_S - CUE_AFTER_S)
        await self._text("USER", "[status] AIC is still working; it is a bigger one.", interactive=True)

    # ---------- plumbing ----------
    async def _send(self, event: dict[str, Any]) -> None:
        if self.stream is not None and not self._closed:
            await self.stream.send({"event": event})

    async def _text(self, role: str, text: str, interactive: bool) -> None:
        name = str(uuid.uuid4())
        await self._send(
            {
                "contentStart": {
                    "promptName": self.prompt,
                    "contentName": name,
                    "type": "TEXT",
                    "role": role,
                    "interactive": interactive,
                    "textInputConfiguration": {"mediaType": "text/plain"},
                }
            }
        )
        await self._send({"textInput": {"promptName": self.prompt, "contentName": name, "content": text}})
        await self._send({"contentEnd": {"promptName": self.prompt, "contentName": name}})

    async def close(self) -> None:
        if self._closed:
            return
        for t in list(self._pending):
            t.cancel()
        stream = self.stream
        if stream is not None:
            try:
                await self._send({"contentEnd": {"promptName": self.prompt, "contentName": self.audio_name}})
                await self._send({"promptEnd": {"promptName": self.prompt}})
                await self._send({"sessionEnd": {}})
            except Exception as e:
                log("info", "voice.close_send_failed", error=type(e).__name__)
        self._closed = True
        if stream is not None:
            await stream.close()
        try:
            await self.send_client({"type": "closed"})
        except Exception as e:
            log("info", "voice.client_gone", error=type(e).__name__)


# ---------- the real Bedrock stream (aws-sdk-bedrock-runtime) ----------
class BedrockDuplex:
    def __init__(self, stream: Any) -> None:
        self._stream = stream

    async def send(self, event: dict[str, Any]) -> None:
        from aws_sdk_bedrock_runtime.models import (
            BidirectionalInputPayloadPart,
            InvokeModelWithBidirectionalStreamInputChunk,
        )

        chunk = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=json.dumps(event).encode())
        )
        await self._stream.input_stream.send(chunk)

    async def events(self) -> AsyncIterator[dict[str, Any]]:
        _, output = await self._stream.await_output()
        async for item in output:
            value = getattr(item, "value", None)
            raw = getattr(value, "bytes_", None)
            if raw:
                yield json.loads(raw.decode("utf-8"))

    async def close(self) -> None:
        try:
            await self._stream.input_stream.close()
        except Exception as e:
            log("info", "voice.stream_close_failed", error=type(e).__name__)


def bedrock_opener(session: Any) -> Opener:
    """Opens Nova Sonic streams with the runtime role's credentials (from the boto3 session)."""

    async def open_stream(model_id: str, region: str) -> Duplex:
        from aws_sdk_bedrock_runtime.client import AsyncBedrockRuntimeClient
        from aws_sdk_bedrock_runtime.config import AsyncBedrockRuntimeConfig
        from aws_sdk_bedrock_runtime.models import InvokeModelWithBidirectionalStreamOperationInput

        creds = session.get_credentials().get_frozen_credentials()
        config = await AsyncBedrockRuntimeConfig.resolve(
            region=region,
            aws_access_key_id=creds.access_key,
            aws_secret_access_key=creds.secret_key,
            aws_session_token=creds.token,
        )
        client = AsyncBedrockRuntimeClient(config=config)
        stream = await client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(model_id=model_id)
        )
        return BedrockDuplex(stream)

    return open_stream
