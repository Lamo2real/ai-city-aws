"""AIC's voice through OpenAI text-to-speech (the owner's choice, decision 96).

A voice service only: the agents stay on Anthropic models through Bedrock. The HUD sends a sentence to
``POST /speech`` and gets MP3 bytes back; the key lives in Secrets Manager (``aic/prod/openai``), pasted by the
owner in Settings → Voice, and is never logged or echoed.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from aic.shared.log import log

OPENAI_SECRET_DEFAULT = "aic/prod/openai"  # noqa: S105  (a secret's name, not a secret)
SPEECH_URL = "https://api.openai.com/v1/audio/speech"
MODELS = ("gpt-4o-mini-tts", "tts-1")
"""The first that answers wins: the newer model, then the plain one if the account can't use it."""
VOICES = ("alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse")
DEFAULT_VOICE = "alloy"
"""OpenAI's default voice: what the owner asked for."""
MAX_CHARS = 2000
TIMEOUT_S = 15.0
KEY_TTL_S = 300.0
_KEY = re.compile(r"^sk-[A-Za-z0-9_\-]{20,}$")

Post = Callable[[str, dict[str, str], dict[str, Any], float], Awaitable[tuple[int, bytes, str]]]
"""``post(url, headers, json_body, timeout_s) -> (status, body_bytes, content_type)``."""


async def httpx_post(
    url: str, headers: dict[str, str], body: dict[str, Any], timeout_s: float
) -> tuple[int, bytes, str]:
    async with httpx.AsyncClient(timeout=timeout_s) as c:
        r = await c.post(url, headers=headers, json=body)
        return r.status_code, r.content, r.headers.get("content-type", "")


class SpeechError(Exception):
    """A failure the HUD can show: ``status`` (502/503), a short ``error`` code and a plain ``message``."""

    def __init__(self, status: int, error: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.error = error
        self.message = message


class NotConfigured(SpeechError):
    def __init__(self) -> None:
        super().__init__(503, "not_configured", "OpenAI's voice isn't set up yet. Paste the key in Settings → Voice.")


def openai_key_secret(b: dict[str, Any]) -> str:
    """Validates the pasted key and returns what to store. Never logged, never echoed back."""
    key = str(b.get("key") or "").strip()
    if not _KEY.fullmatch(key):
        raise ValueError("Paste the whole OpenAI API key (it starts with sk-).")
    return key


def store_secret(secrets: Any, name: str, value: str, kms_key: str | None, tags: dict[str, str]) -> None:
    """Sets the secret's value, creating the secret when Terraform's empty one isn't there."""
    try:
        secrets.put_secret_value(SecretId=name, SecretString=value)
    except Exception as e:
        if _error_code(e) != "ResourceNotFoundException":
            raise
        secrets.create_secret(
            Name=name,
            SecretString=value,
            **({"KmsKeyId": kms_key} if kms_key else {}),
            Tags=[{"Key": k, "Value": v} for k, v in tags.items()],
        )


def _error_code(e: Exception) -> str:
    return str(((getattr(e, "response", None) or {}).get("Error") or {}).get("Code") or "")


@dataclass
class SpeechDeps:
    """What ``/speech`` and ``/voice/openai*`` need."""

    secrets: Any = None
    """A boto3 ``secretsmanager`` client; None = the key can't be read or stored (503)."""
    secret_name: str = OPENAI_SECRET_DEFAULT
    kms_key: str | None = None
    tags: dict[str, str] = field(default_factory=dict)
    post: Post = httpx_post
    key_ttl_s: float = KEY_TTL_S
    clock: Callable[[], float] = time.monotonic
    _key: str | None = field(default=None, repr=False)
    _key_at: float = field(default=-1.0, repr=False)

    async def key(self) -> str | None:
        """The owner's key from Secrets Manager, cached for a few minutes; None when empty or missing."""
        if self._key_at >= 0 and self.clock() - self._key_at < self.key_ttl_s:
            return self._key
        if self.secrets is None:
            return None
        try:
            r = await asyncio.to_thread(self.secrets.get_secret_value, SecretId=self.secret_name)
            value = str(r.get("SecretString") or "").strip()
        except Exception as e:
            if _error_code(e) != "ResourceNotFoundException":
                log("warn", "speech.key_read_failed", error=type(e).__name__)
            value = ""
        self._key, self._key_at = (value or None), self.clock()
        return self._key

    def forget_key(self) -> None:
        self._key, self._key_at = None, -1.0


def clean_text(text: Any) -> str:
    t = str(text or "").strip()
    if not t:
        raise ValueError("There is nothing to say.")
    if len(t) > MAX_CHARS:
        raise ValueError(f"Speech is limited to {MAX_CHARS} characters at a time.")
    return t


async def synthesize(d: SpeechDeps, text: Any, voice: Any = None) -> bytes:
    """MP3 bytes for ``text`` in ``voice`` (OpenAI's default when unknown)."""
    t = clean_text(text)
    v = str(voice or "").strip().lower()
    if v not in VOICES:
        v = DEFAULT_VOICE
    key = await d.key()
    if not key:
        raise NotConfigured()
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    started = time.monotonic()
    for model in MODELS:
        body = {"model": model, "input": t, "voice": v, "response_format": "mp3"}
        try:
            status, content, _ = await d.post(SPEECH_URL, headers, body, TIMEOUT_S)
        except (httpx.TimeoutException, TimeoutError) as e:
            log("warn", "speech.failed", error="timeout", model=model, reason=type(e).__name__)
            raise SpeechError(502, "timeout", "OpenAI took too long to answer. Try again.") from e
        except httpx.HTTPError as e:
            log("warn", "speech.failed", error="unreachable", model=model, reason=type(e).__name__)
            raise SpeechError(502, "unreachable", "OpenAI could not be reached. Try again in a moment.") from e
        if status == 200 and content:
            log("info", "speech.ok", model=model, voice=v, chars=len(t), ms=round((time.monotonic() - started) * 1000))
            return content
        if model != MODELS[-1] and (status == 404 or (status == 400 and b"model" in content.lower())):
            log("info", "speech.model_fallback", model=model, status=status)
            continue
        log("warn", "speech.failed", error="openai", model=model, status=status)
        if status in (401, 403):
            d.forget_key()
            raise SpeechError(503, "bad_key", "OpenAI rejected the key. Paste it again in Settings → Voice.")
        if status == 429:
            raise SpeechError(503, "rate_limited", "OpenAI is busy right now. Try again in a moment.")
        raise SpeechError(502, "openai_error", f"OpenAI answered with an error ({status}).")
    raise SpeechError(502, "openai_error", "No speech model answered.")
