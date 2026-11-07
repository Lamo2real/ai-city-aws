"""A small JSON-over-HTTPS helper for the Google and Microsoft APIs and CalDAV (stdlib only, like the rest of
the Lambda zip). The transport is a plain function, so tests pass a fake and nothing touches the network."""

from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from typing import Any

from aic.shared.mcp_http import HttpResponse

Http = Callable[[str, str, Mapping[str, str], bytes, float], HttpResponse]
"""(method, url, headers, body, timeout seconds) -> response. Blocking; called in a thread."""

TIMEOUT = 8.0


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_: Any, **__: Any) -> None:
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def urllib_http(method: str, url: str, headers: Mapping[str, str], body: bytes, timeout: float) -> HttpResponse:
    if not url.startswith("https://"):
        raise ValueError("https only")
    req = urllib.request.Request(url, data=body or None, headers=dict(headers), method=method)  # noqa: S310
    try:
        with _opener.open(req, timeout=timeout) as r:
            return HttpResponse(r.status, {k.lower(): v for k, v in r.headers.items()}, r.read(8_000_000))
    except urllib.error.HTTPError as e:
        return HttpResponse(e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read(200_000))


class ProviderError(RuntimeError):
    """A plain-words failure from a provider (never contains a token)."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class Unauthorized(ProviderError):
    """The provider refused the token: the account needs a new sign-in."""


def qs(params: Mapping[str, Any]) -> str:
    clean = {k: v for k, v in params.items() if v is not None and v != ""}
    return ("?" + urllib.parse.urlencode(clean, doseq=True)) if clean else ""


async def call(
    http: Http,
    method: str,
    url: str,
    token: str | None = None,
    body: Any = None,
    headers: Mapping[str, str] | None = None,
    raw: bytes | None = None,
) -> Any:
    """Sends one request and returns the parsed JSON (or text for non-JSON answers). Raises ProviderError."""
    h = {"Accept": "application/json", **(headers or {})}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
    if body is not None and raw is None:
        h.setdefault("Content-Type", "application/json")
    resp = await asyncio.to_thread(http, method, url, h, data, TIMEOUT)
    text = resp.body.decode("utf-8", "replace")
    if resp.status in (401, 403) and token:
        raise Unauthorized("The provider refused the sign-in.", resp.status)
    if resp.status >= 400:
        msg = text[:300]
        try:
            j = json.loads(text)
            err = j.get("error") if isinstance(j, dict) else None
            if isinstance(err, dict):
                msg = str(err.get("message") or err.get("code") or msg)[:300]
            elif isinstance(err, str):
                msg = err[:300]
        except ValueError:
            pass
        raise ProviderError(f"The provider answered {resp.status}: {msg}", resp.status)
    if not text.strip():
        return None
    if "json" in resp.headers.get("content-type", "") or text.lstrip().startswith(("{", "[")):
        try:
            return json.loads(text)
        except ValueError:
            return text
    return text
