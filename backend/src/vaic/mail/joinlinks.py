"""The join link of a meeting, pulled out cleanly (Teams, Zoom, Google Meet, Webex).

Meeting texts are written by others, so only ``https`` links on the four services' own domains count, and Outlook's
"safe links" wrapper is unwrapped first. Answers ``{"url", "kind"}`` or None."""

from __future__ import annotations

import html
import re
import urllib.parse
from typing import Any

KINDS = ("teams", "zoom", "meet", "webex")
LABELS = {"teams": "Microsoft Teams", "zoom": "Zoom", "meet": "Google Meet", "webex": "Webex"}

_URL = re.compile(r"https://[^\s<>\"'()\[\]{}]+", re.I)
_SAFELINK = re.compile(r"^https://[\w.-]*safelinks\.protection\.outlook\.com/", re.I)
_TRAIL = ".,;:!?*>»”’"

# (kind, host pattern, path pattern): the meeting-room paths only, not the services' home or help pages.
_RULES: tuple[tuple[str, re.Pattern[str], re.Pattern[str]], ...] = (
    ("teams", re.compile(r"^teams\.microsoft\.com$|^teams\.live\.com$|^gov\.teams\.microsoft\.us$"),
     re.compile(r"^/(l/meetup-join/|meet/|v2/\?meetingjoin=|_#/l/meetup-join/)", re.I)),
    ("zoom", re.compile(r"^([\w-]+\.)*zoom(gov)?\.(us|com)$"), re.compile(r"^/(j|my|w|s|wc/join)/", re.I)),
    ("meet", re.compile(r"^meet\.google\.com$"), re.compile(r"^/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}|^/lookup/[\w-]+|^/[a-z0-9-]{10,}", re.I)),
    ("webex", re.compile(r"^([\w-]+\.)*webex\.com$"), re.compile(r"^/(meet/|join/|[\w-]+/j\.php|wbxmjs/|[\w-]+/(e|m)\.php|webappng/)", re.I)),
)  # fmt: skip


def _unwrap(url: str) -> str:
    if _SAFELINK.match(url):
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        inner = (q.get("url") or [""])[0]
        if inner:
            return inner
    return url


def _clean(raw: str) -> str:
    url = html.unescape(raw)
    while url and url[-1] in _TRAIL:
        url = url[:-1]
    return _unwrap(url)


def classify(url: str) -> str | None:
    """Which service a link is a meeting room of, or None."""
    try:
        p = urllib.parse.urlsplit(url)
    except ValueError:
        return None
    if p.scheme.lower() != "https" or not p.hostname or p.username or p.password:
        return None
    host = p.hostname.lower()
    path = p.path + (f"?{p.query}" if p.query else "")
    for kind, h, pth in _RULES:
        if h.search(host) and pth.search(path or "/"):
            return kind
    return None


def find_join(*texts: Any) -> dict[str, str] | None:
    """The first meeting link in the texts, in order (an explicit join field first, then location, then the
    description). Text that isn't a string is skipped."""
    for t in texts:
        if not isinstance(t, str) or not t:
            continue
        for m in _URL.finditer(t.replace("&amp;", "&")):
            url = _clean(m.group(0))
            kind = classify(url)
            if kind:
                return {"url": url[:2000], "kind": kind}
    return None


__all__ = ["KINDS", "LABELS", "classify", "find_join"]
