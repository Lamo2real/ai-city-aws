"""The owner's GitHub token (``docs/GITHUB_ACCESS.md``, decision 110).

One classic personal access token for the whole city, pasted by the owner in Settings → GitHub and kept in Secrets
Manager (``aic/prod/github``) as ``{"token": "…"}``. The api function stores it and asks GitHub who it belongs to
(``GET /user``); every agent runtime reads it at session start (``aic.runtime.github_auth``). The token is never
logged, never echoed back and cut out of anything a tool returns (``redact``).
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from aic.shared.log import log

GITHUB_SECRET_DEFAULT = "aic/prod/github"  # noqa: S105  (a secret's name, not a secret)
USER_URL = "https://api.github.com/user"
TIMEOUT_S = 10.0
TOKEN_TTL_S = 300.0
_TOKEN = re.compile(r"^(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$")
_SECRET_LIKE = re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")

Get = Callable[[str, dict[str, str], float], Awaitable[tuple[int, Any]]]
"""``get(url, headers, timeout_s) -> (status, json_body_or_None)``."""


async def httpx_get(url: str, headers: dict[str, str], timeout_s: float) -> tuple[int, Any]:
    async with httpx.AsyncClient(timeout=timeout_s) as c:
        r = await c.get(url, headers=headers)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, None


def github_token_secret(b: dict[str, Any]) -> str:
    """Validates the pasted token and returns what to store. Never logged, never echoed back."""
    token = str(b.get("token") or "").strip()
    if not _TOKEN.fullmatch(token):
        raise ValueError("Paste the whole GitHub token (it starts with ghp_ or github_pat_).")
    return json.dumps({"token": token})


def token_from_secret(value: str | None) -> str | None:
    """The token inside the secret's value: ``{"token": "…"}`` as Settings stores it, or a bare token pasted in the
    console. Empty, ``{}`` or anything else means no token."""
    v = (value or "").strip()
    if not v:
        return None
    if v.startswith("{"):
        try:
            t = json.loads(v).get("token")
        except (ValueError, AttributeError):
            return None
        return str(t).strip() if isinstance(t, str) and t.strip() else None
    return v if _TOKEN.fullmatch(v) else None


def redact(text: str, token: str | None) -> str:
    """``text`` with the token (and anything shaped like a GitHub token) replaced, so it never reaches the owner,
    a report or a log."""
    if token and token in text:
        text = text.replace(token, "<github-token>")
    return _SECRET_LIKE.sub("<github-token>", text)


class GitHubError(Exception):
    """GitHub refused or could not be reached: ``error`` is a short code, ``message`` plain words for the owner."""

    def __init__(self, error: str, message: str) -> None:
        super().__init__(message)
        self.error = error
        self.message = message


async def whoami(get: Get, token: str) -> dict[str, Any]:
    """``{"login", "id"}`` of the token's owner, from ``GET /user``."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "ai-city",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        status, body = await get(USER_URL, headers, TIMEOUT_S)
    except (httpx.HTTPError, TimeoutError, OSError) as e:
        log("warn", "github.user_failed", error="unreachable", reason=type(e).__name__)
        raise GitHubError("unreachable", "GitHub could not be reached. Try again in a moment.") from e
    if status in (401, 403):
        raise GitHubError("bad_token", "GitHub rejected the token. Make a new one and paste it again.")
    if status != 200 or not isinstance(body, dict) or not body.get("login"):
        log("warn", "github.user_failed", error="github", status=status)
        raise GitHubError("github_error", f"GitHub answered with an error ({status}).")
    return {"login": str(body["login"]), "id": int(body.get("id") or 0)}


def noreply_email(user: dict[str, Any] | None) -> str:
    """The token owner's GitHub noreply address, so commits count as theirs; a city address when unknown."""
    if user and user.get("login"):
        return f"{user.get('id') or 0}+{user['login']}@users.noreply.github.com"
    return "ai-city@users.noreply.github.com"


@dataclass
class GitHubDeps:
    """What ``/github*`` and the runtimes need: the secret, and GitHub's ``GET /user``."""

    secrets: Any = None
    """A boto3 ``secretsmanager`` client; None = the token can't be read or stored (503)."""
    secret_name: str = GITHUB_SECRET_DEFAULT
    kms_key: str | None = None
    tags: dict[str, str] = field(default_factory=dict)
    get: Get = httpx_get
    token_ttl_s: float = TOKEN_TTL_S
    clock: Callable[[], float] = time.monotonic
    _token: str | None = field(default=None, repr=False)
    _token_at: float = field(default=-1.0, repr=False)

    async def token(self) -> str | None:
        """The owner's token from Secrets Manager, cached for a few minutes; None when empty or missing."""
        if self._token_at >= 0 and self.clock() - self._token_at < self.token_ttl_s:
            return self._token
        if self.secrets is None:
            return None
        try:
            r = await asyncio.to_thread(self.secrets.get_secret_value, SecretId=self.secret_name)
            value = token_from_secret(str(r.get("SecretString") or ""))
        except Exception as e:
            if _error_code(e) != "ResourceNotFoundException":
                log("warn", "github.token_read_failed", error=type(e).__name__)
            value = None
        self._token, self._token_at = value, self.clock()
        return self._token

    def forget(self) -> None:
        self._token, self._token_at = None, -1.0

    async def status(self) -> dict[str, Any]:
        """``{configured, login, error}``: who the stored token belongs to, or why it doesn't work, in plain words."""
        token = await self.token()
        if not token:
            return {"configured": False, "login": None, "error": None}
        try:
            user = await whoami(self.get, token)
        except GitHubError as e:
            return {"configured": True, "login": None, "error": e.message}
        return {"configured": True, "login": user["login"], "error": None}


def _error_code(e: Exception) -> str:
    return str(((getattr(e, "response", None) or {}).get("Error") or {}).get("Code") or "")
