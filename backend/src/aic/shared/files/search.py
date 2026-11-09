"""Finding a file by meaning and time (docs/FILES.md §6).

Every ready file has a Titan vector of its search text (name, folder, tags, who added it, its description and the
dates in words). A search embeds the query, scores every file by cosine similarity plus a small bonus for each
query word found in its text, and keeps only files whose date (taken, else added) is inside ``after``/``before``.
At personal scale (tens of thousands of files) one pass over the records takes well under a second; past that,
the vectors move to a vector index (docs/FILES.md §11).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .embed import Embedder, cosine, unpack
from .model import when_words

KEYWORD_WEIGHT = 0.35
CLEAR_LEAD = 0.08
"""The best match is "clearly it" when it beats the second by this much; otherwise VAIC shows two or three and asks."""
MIN_SCORE = 0.2
_STOP = {
    "the", "and", "for", "with", "that", "this", "from", "have", "you", "your", "can", "find", "give", "time",
    "remember", "took", "taken", "inside", "image", "file", "photo", "picture", "pic", "video", "of", "a", "an",
    "do", "me", "it", "my", "i", "hey", "was", "were", "where", "when", "what", "which", "some", "one", "show",
}  # fmt: skip


def search_text(rec: dict[str, Any]) -> str:
    """What is embedded and keyword-matched for one file."""
    by = rec.get("department") or ("the owner" if rec.get("added_by") == "owner" else rec.get("added_by") or "")
    parts = [
        f"Name: {rec.get('name', '')}",
        f"Kind: {rec.get('kind', '')}",
        f"Folder: {rec.get('folder') or 'top level'}",
        f"Tags: {', '.join(rec.get('tags') or [])}" if rec.get("tags") else "",
        f"Added by: {by}" if by else "",
        f"Taken: {when_words(rec.get('taken_at'))}" if rec.get("taken_at") else "",
        f"Added: {when_words(rec.get('created_at'))}",
        f"Owner's note: {rec['note']}" if rec.get("note") else "",
        f"Description: {rec.get('description', '')}",
    ]
    return "\n".join(p for p in parts if p)


def words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) >= 3 and w not in _STOP}


def when_of(rec: dict[str, Any]) -> str:
    return str(rec.get("taken_at") or rec.get("created_at") or "")


@dataclass(frozen=True)
class Hit:
    rec: dict[str, Any]
    score: float


@dataclass(frozen=True)
class Filters:
    after: str | None = None
    before: str | None = None
    kind: str | None = None
    folder: str | None = None
    department: str | None = None

    def keep(self, rec: dict[str, Any]) -> bool:
        w = when_of(rec)
        if self.after and w[: len(self.after)] < self.after:
            return False
        if self.before and w[: len(self.before)] > self.before:
            return False
        if self.kind and rec.get("kind") != self.kind:
            return False
        if self.folder is not None and self.folder != "":
            f = str(rec.get("folder") or "")
            if f != self.folder and not f.startswith(self.folder + "/"):
                return False
        return not self.department or str(rec.get("department") or "").lower() == self.department.lower()


async def rank(
    records: list[dict[str, Any]],
    query: str,
    embedder: Embedder | None,
    filters: Filters | None = None,
    limit: int = 10,
) -> list[Hit]:
    """The best files for ``query`` among ``records`` (newest first when the query is empty)."""
    f = filters or Filters()
    pool = [r for r in records if f.keep(r)]
    q = query.strip()
    if not q:
        return [Hit(r, 0.0) for r in sorted(pool, key=when_of, reverse=True)[:limit]]
    qv = await embedder.embed(q) if embedder else None
    qw = words(q)
    hits: list[Hit] = []
    for r in pool:
        sem = cosine(qv, unpack(r["vec"])) if qv and r.get("vec") else 0.0
        text = r.get("search_text") or search_text(r)
        kw = len(qw & words(text)) / len(qw) if qw else 0.0
        score = sem + KEYWORD_WEIGHT * kw
        if score >= MIN_SCORE or kw > 0:
            hits.append(Hit(r, round(score, 4)))
    hits.sort(key=lambda h: (h.score, when_of(h.rec)), reverse=True)
    return hits[:limit]


def clear_winner(hits: list[Hit]) -> bool:
    return len(hits) == 1 or (len(hits) > 1 and hits[0].score - hits[1].score >= CLEAR_LEAD)
