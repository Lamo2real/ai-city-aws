"""VAIC's voice through OpenAI text-to-speech: the key is a secret the owner pastes, /speech returns MP3 bytes."""

import base64
from typing import Any

import httpx
import pytest

from test_api import ev, js, make
from vaic.lambdas.api import handle_http
from vaic.shared.speech import (
    DEFAULT_VOICE,
    INSTRUCTIONS,
    MAX_CHARS,
    VOICES,
    SpeechDeps,
    openai_key_secret,
    synthesize,
)

KEY = "sk-" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6"
MP3 = b"ID3\x03\x00\x00\x00fake-mp3-bytes"


class FakeSecrets:
    def __init__(self, value: str | None = None) -> None:
        self.values: dict[str, str] = {} if value is None else {"vaic/prod/openai": value}
        self.reads = 0

    def get_secret_value(self, SecretId: str) -> dict[str, Any]:
        self.reads += 1
        if SecretId not in self.values:
            e: Any = Exception("missing")
            e.response = {"Error": {"Code": "ResourceNotFoundException"}}
            raise e
        return {"SecretString": self.values[SecretId]}

    def put_secret_value(self, SecretId: str, SecretString: str) -> None:
        if SecretId not in self.values:
            e: Any = Exception("missing")
            e.response = {"Error": {"Code": "ResourceNotFoundException"}}
            raise e
        self.values[SecretId] = SecretString

    def create_secret(self, Name: str, SecretString: str, **kw: Any) -> None:
        self.values[Name] = SecretString


class FakeOpenAI:
    """``post`` as the speech module calls it; ``answers`` is consumed in order, one per call."""

    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.calls: list[dict[str, Any]] = []

    async def post(self, url: str, headers: dict[str, str], body: dict[str, Any], timeout_s: float) -> Any:
        self.calls.append({"url": url, "headers": headers, "body": body, "timeout": timeout_s})
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a


def deps(secret: str | None = KEY, *answers: Any) -> tuple[SpeechDeps, FakeOpenAI, FakeSecrets]:
    openai = FakeOpenAI(*answers)
    secrets = FakeSecrets(secret)
    return SpeechDeps(secrets=secrets, post=openai.post, tags={"Project": "ai-city"}), openai, secrets


def audio(r: dict[str, Any]) -> bytes:
    assert r["statusCode"] == 200, r
    assert r["headers"]["content-type"] == "audio/mpeg"
    assert r["headers"]["cache-control"] == "no-store"
    assert r["isBase64Encoded"] is True
    return base64.b64decode(r["body"])


async def test_speech_returns_mp3_bytes_in_the_sol_styled_default_voice() -> None:
    d, openai, _ = deps(KEY, (200, MP3, "audio/mpeg"))
    api = make(speech=d)
    r = await handle_http(ev("POST", "/speech", {"text": "Hi there. Anything fun today?"}), api)
    assert audio(r) == MP3
    call = openai.calls[0]
    assert call["url"] == "https://api.openai.com/v1/audio/speech"
    assert call["headers"]["Authorization"] == f"Bearer {KEY}"
    assert call["body"] == {
        "model": "gpt-4o-mini-tts",
        "input": "Hi there. Anything fun today?",
        "voice": DEFAULT_VOICE,
        "response_format": "mp3",
        "instructions": INSTRUCTIONS,
    }
    assert DEFAULT_VOICE == "marin" and "Sol" in INSTRUCTIONS
    assert call["timeout"] == 15.0


async def test_a_named_voice_is_used_and_an_unknown_one_falls_back_to_the_default() -> None:
    d, openai, _ = deps(KEY, (200, MP3, "audio/mpeg"), (200, MP3, "audio/mpeg"))
    await synthesize(d, "One.", "nova")
    await synthesize(d, "Two.", "robot9000")
    assert [c["body"]["voice"] for c in openai.calls] == ["nova", DEFAULT_VOICE]


async def test_the_newer_model_falls_back_to_tts_1_when_the_account_cannot_use_it() -> None:
    d, openai, _ = deps(
        KEY, (404, b'{"error":{"code":"model_not_found"}}', "application/json"), (200, MP3, "audio/mpeg")
    )
    assert await synthesize(d, "Hello.") == MP3
    assert [c["body"]["model"] for c in openai.calls] == ["gpt-4o-mini-tts", "tts-1"]
    # tts-1 knows no instructions and no marin: the Sol-styled default becomes its calmest voice.
    assert "instructions" not in openai.calls[1]["body"]
    assert openai.calls[1]["body"]["voice"] == "sage"


async def test_text_is_required_and_capped() -> None:
    d, _, _ = deps(KEY)
    api = make(speech=d)
    r = await handle_http(ev("POST", "/speech", {"text": "   "}), api)
    assert r["statusCode"] == 400 and js(r)["error"] == "bad_request"
    r = await handle_http(ev("POST", "/speech", {"text": "x" * (MAX_CHARS + 1)}), api)
    assert r["statusCode"] == 400 and str(MAX_CHARS) in js(r)["message"]


async def test_without_a_key_it_is_503_not_configured() -> None:
    d, openai, _ = deps(None)
    r = await handle_http(ev("POST", "/speech", {"text": "Hello."}), make(speech=d))
    assert r["statusCode"] == 503 and js(r)["error"] == "not_configured"
    assert openai.calls == []
    none = await handle_http(ev("POST", "/speech", {"text": "Hello."}), make())
    assert none["statusCode"] == 503 and js(none)["error"] == "not_configured"


async def test_timeouts_and_openai_errors_become_502_or_503_without_the_text_in_logs(capsys: Any) -> None:
    secret = "What I said is private."
    d, _, _ = deps(KEY, httpx.ReadTimeout("slow"))
    r = await handle_http(ev("POST", "/speech", {"text": secret}), make(speech=d))
    assert r["statusCode"] == 502 and js(r)["error"] == "timeout"
    d, _, _ = deps(KEY, (500, b"boom", "text/plain"))
    r = await handle_http(ev("POST", "/speech", {"text": secret}), make(speech=d))
    assert r["statusCode"] == 502 and js(r)["error"] == "openai_error"
    d, _, _ = deps(KEY, (429, b"", "text/plain"))
    r = await handle_http(ev("POST", "/speech", {"text": secret}), make(speech=d))
    assert r["statusCode"] == 503 and js(r)["error"] == "rate_limited"
    d, _, _ = deps(KEY, (401, b"", "text/plain"), (200, MP3, "audio/mpeg"))
    r = await handle_http(ev("POST", "/speech", {"text": secret}), make(speech=d))
    assert r["statusCode"] == 503 and js(r)["error"] == "bad_key"
    assert d._key is None  # a rejected key is read again next time, so a newly pasted one takes effect
    logs = capsys.readouterr().err
    assert secret not in logs and KEY not in logs


async def test_the_key_is_read_once_and_cached_for_a_while() -> None:
    now = {"t": 1000.0}
    openai = FakeOpenAI((200, MP3, "audio/mpeg"), (200, MP3, "audio/mpeg"), (200, MP3, "audio/mpeg"))
    secrets = FakeSecrets(KEY)
    d = SpeechDeps(secrets=secrets, post=openai.post, clock=lambda: now["t"])
    await synthesize(d, "One.")
    await synthesize(d, "Two.")
    assert secrets.reads == 1
    now["t"] += 400
    await synthesize(d, "Three.")
    assert secrets.reads == 2


async def test_the_owner_pastes_the_key_once_it_is_stored_as_a_secret_and_never_echoed(capsys: Any) -> None:
    d, openai, secrets = deps(None, (200, MP3, "audio/mpeg"))
    api = make(speech=d)
    before = js(await handle_http(ev("GET", "/voice/openai"), api))
    assert before["configured"] is False and before["default"] == DEFAULT_VOICE and before["voices"] == list(VOICES)
    assert before["key_saved_at"] is None
    bad = await handle_http(ev("PUT", "/voice/openai-key", {"key": "not-a-key"}), api)
    assert bad["statusCode"] == 400 and "sk-" in js(bad)["message"]
    good = await handle_http(ev("PUT", "/voice/openai-key", {"key": f"  {KEY}  "}), api)
    assert good["statusCode"] == 200 and js(good)["ok"] is True and js(good)["saved_at"]
    assert KEY not in good["body"]
    assert secrets.values["vaic/prod/openai"] == KEY
    after = js(await handle_http(ev("GET", "/voice/openai"), api))
    assert after["configured"] is True and after["key_saved_at"] == js(good)["saved_at"]
    # The pasted key is used at once (no stale "not configured" from the cache).
    assert audio(await handle_http(ev("POST", "/speech", {"text": "Now I talk."}), api)) == MP3
    assert openai.calls[0]["headers"]["Authorization"] == f"Bearer {KEY}"
    assert KEY not in capsys.readouterr().err


async def test_storing_the_key_needs_a_secrets_client() -> None:
    d = SpeechDeps(secrets=None)
    r = await handle_http(ev("PUT", "/voice/openai-key", {"key": KEY}), make(speech=d))
    assert r["statusCode"] == 503


def test_the_key_check_on_its_own() -> None:
    assert openai_key_secret({"key": KEY}) == KEY
    with pytest.raises(ValueError):
        openai_key_secret({"key": "sk-short"})
    with pytest.raises(ValueError):
        openai_key_secret({})
