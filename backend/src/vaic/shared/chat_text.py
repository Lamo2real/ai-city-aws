"""Owner-facing chat words: no record ids, no text cut mid-word (decision in docs/DECISIONS.md, 2026-11-12).

``no_ids`` is the one sanitiser on the chat output path: every line VAIC writes to a conversation and every
``vaic.reply`` event passes it, so an agent id such as ``wkr-application-3032a482e8b7`` reaches the owner as
"an Application worker" and any other record id is dropped. ``clip`` shortens at a sentence or word boundary.
"""

from __future__ import annotations

import re
from typing import Any

# A worker or manager id (wkr-<department>-<12 hex>, mgr-<department>[-…]) and any other id new_id makes
# (<prefix>-<12 hex>). Text inside a link or code span is left alone, so a link to an app still works.
_WORKER = re.compile(r"\b(?:(?:the|a|an)\s+)?wkr-([a-z0-9-]+?)-[0-9a-f]{12}\b(?:-0+\b)?", re.I)
_MANAGER = re.compile(r"\b(?:(?:the|a|an)\s+)?mgr-([a-z0-9]+(?:-[a-z0-9]+)*)\b", re.I)
_ANY_WORKER = re.compile(r"\b(?:(?:the|a|an)\s+)?wkr-[a-z0-9-]+", re.I)
_OTHER = re.compile(r"\s?\b[a-z]+(?:-[a-z0-9]+)*-[0-9a-f]{12}\b", re.I)
_KEEP = re.compile(r"\[[^\]]*\]\([^)]*\)|https?://\S+|```.*?```|`[^`]*`", re.S)
# Any id pattern that must never reach a chat message (the test checks against this).
ID_PATTERN = re.compile(r"\b(?:wkr|mgr)-[a-z0-9-]+|\b[a-z]+-[0-9a-f]{12}\b", re.I)
_SMALL = {"it": "IT", "ai": "AI", "hr": "HR"}


def dept_words(key: str) -> str:
    """``application`` → "Application", ``data-ai`` → "Data AI": a department key said as a name."""
    return " ".join(_SMALL.get(w, w.capitalize()) for w in key.split("-") if w)


def _article(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def worker_name(agent: dict[str, Any] | None, fallback_id: str = "") -> str:
    """What to call a worker in a sentence: "the game-logic worker", else "an Application worker", else "a worker"."""
    a = agent or {}
    specialty = " ".join(str(a.get("specialty") or a.get("role") or "").split()).strip().rstrip(".")
    if specialty and specialty.lower() != "worker" and len(specialty) <= 40:
        return f"the {specialty.lower().removesuffix(' worker')} worker"
    dept = str(a.get("department") or "")
    if not dept:
        m = re.match(r"wkr-([a-z0-9-]+?)-[0-9a-f]{12}", fallback_id)
        dept = dept_words(m.group(1)) if m else ""
    return f"{_article(dept)} {dept} worker" if dept else "a worker"


def _scrub(part: str) -> str:
    def worker(m: re.Match[str]) -> str:
        d = dept_words(m.group(1))
        return f"{_article(d)} {d} worker"

    def manager(m: re.Match[str]) -> str:
        key = re.sub(r"(?:-[a-z]+(?:-[a-z0-9]+)*?-[0-9a-f]{12})?(?:-0+)?$", "", m.group(1))
        return f"the {dept_words(key)} manager"

    part = _WORKER.sub(worker, part)
    part = _ANY_WORKER.sub("a worker", part)
    part = _MANAGER.sub(manager, part)
    return _OTHER.sub("", part)


def no_ids(text: str) -> str:
    """The chat output sanitiser: worker and manager ids become plain names, other record ids are dropped."""
    if not text or not ID_PATTERN.search(text):
        return text
    out, last = [], 0
    for m in _KEEP.finditer(text):
        out += [_scrub(text[last : m.start()]), m.group(0)]
        last = m.end()
    out.append(_scrub(text[last:]))
    s = "".join(out)
    # A sentence that starts with a replaced name gets its capital back.
    return re.sub(
        r"(^|[.!?]\s+|\n\s*(?:[-*]\s+)?)(a|an|the)\s(?=(?:[\w-]+ ){0,3}(?:worker|manager)\b)",
        lambda m: m.group(1) + m.group(2).capitalize() + " ",
        s,
    )


def clip(text: str, n: int) -> str:
    """At most ``n`` characters, cut at a sentence end if one is near, else at a word boundary, with "…"."""
    s = " ".join(str(text or "").split())
    if len(s) <= n:
        return s
    head = s[: n - 1]
    end = max(head.rfind(". "), head.rfind("? "), head.rfind("! "))
    if end >= n // 2:
        return head[: end + 1]
    words = (head.rsplit(" ", 1)[0] if " " in head else head).split(" ")
    # No dangling small word ("when a…") and no bracket or quote opened and left hanging ('("Animal…').
    while len(words) > 1 and (words[-1].lower() in _DANGLING or (words[-1][:1] in "(\"“'[" and not _closed(words[-1]))):
        words.pop()
    return " ".join(words).rstrip(" ,;:-—") + "…"


_DANGLING = {"a", "an", "the", "to", "of", "and", "or", "with", "when", "in", "on", "for", "is", "are", "at", "by"}


def _closed(word: str) -> bool:
    pairs = {"(": ")", '"': '"', "“": "”", "'": "'", "[": "]"}
    return pairs[word[0]] in word[1:]
