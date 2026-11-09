"""VAIC acting for the owner through the HUD's own API (the owner, 2026-11-09, decision 143).

"I want the VAIC agent to do these kind of things for me, no questions nor restrictions… anything and everything in
the settings and all other tabs; it has both read and write access to all things in AI City." So VAIC gets the same
routes the HUD calls, run by the same code with the same checks, as the owner. Three things stay out, because they
are the city's invariants rather than restrictions on the owner:

* routes that take a secret (a token, key, password or private key) — secrets never pass through a chat or a model
  (CLAUDE.md); VAIC opens the page instead and the owner pastes it there;
* ``/messages`` and ``/wake-check`` — those are VAIC itself;
* nothing here reaches IAM, the policy file or Terraform: the API has no such route.

Deleting things and starting over stay possible; VAIC passes ``confirm`` when the owner's own words asked for it.
"""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import parse_qsl

METHODS = ("GET", "POST", "PUT", "DELETE")

SECRET_ROUTES: tuple[tuple[str, str], ...] = (
    ("PUT", r"/github/token"),
    ("PUT", r"/connectors/[^/]+/key"),
    ("PUT", r"/voice/openai-key"),
    ("PUT", r"/notifications/apns"),
    ("POST", r"/mail/accounts/[^/]+/imap"),
    ("POST", r"/auth/.*"),
)
SELF_ROUTES: tuple[tuple[str, str], ...] = (
    ("POST", r"/messages"),
    ("POST", r"/wake-check"),
    ("POST", r"/voice/.*"),
    ("POST", r"/speech"),
    ("POST", r"/knowledge/uploads(/.*)?"),  # file bytes come from the owner's device, not a chat
    ("POST", r"/files/uploads(/.*)?"),
)
SECRET_PAGE = {
    "/github/token": "#/settings/github",
    "/voice/openai-key": "#/settings/voice",
    "/notifications/apns": "#/settings/general",
}


def clean_path(path: str) -> str:
    p = "/" + str(path or "").strip().lstrip("/")
    return p.split("?", 1)[0].rstrip("/") or "/"


def refusal(method: str, path: str) -> str | None:
    """Why VAIC may not make this call, or None. Checked in the runtime tool and again in the API."""
    m, p = method.upper(), clean_path(path)
    if m not in METHODS:
        return f"{m} is not a method the API takes (GET, POST, PUT or DELETE)."
    if ".." in p or not re.fullmatch(r"/[\w./=-]*", p):
        return "That path is not one of AI City's routes."
    for mm, pat in SECRET_ROUTES:
        if m == mm and re.fullmatch(pat, p):
            page = SECRET_PAGE.get(p, "#/settings/connectors")
            return (
                "That route takes a secret (a token, key or password), and secrets never pass through a chat. "
                f'Open the page for the owner with hud_action {{"action": "open", "page": "{page}"}} and ask '
                "them to paste it there."
            )
    for mm, pat in SELF_ROUTES:
        if m == mm and re.fullmatch(pat, p):
            return "That route is the HUD's own (messages, voice or file uploads from the owner's device)."
    return None


def destructive(method: str, path: str) -> bool:
    m, p = method.upper(), clean_path(path)
    return m == "DELETE" or (m == "POST" and p in ("/city/reset", "/workers/home"))


def to_event(method: str, path: str, body: Any = None) -> dict[str, Any]:
    """The API Gateway event the HUD's request would have been, for the API's own router."""
    raw = "/" + str(path or "").strip().lstrip("/")
    p, _, qs = raw.partition("?")
    q = dict(parse_qsl(qs, keep_blank_values=True))
    return {
        "requestContext": {"http": {"method": method.upper()}},
        "rawPath": p,
        "rawQueryString": qs,
        "queryStringParameters": q or None,
        "body": json.dumps(body) if body is not None else None,
    }


def summarise(response: dict[str, Any], cap: int = 6000) -> str:
    """The API's answer as VAIC reads it: status and body, cut to fit."""
    status = response.get("statusCode", 500)
    body = response.get("body") or ""
    if response.get("isBase64Encoded"):
        body = "(binary content)"
    text = f"{status} {body}"
    return text if len(text) <= cap else text[:cap] + f"… ({len(text) - cap} more characters)"
