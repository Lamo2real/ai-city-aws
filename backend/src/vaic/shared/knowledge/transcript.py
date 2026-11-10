"""Amazon Transcribe output JSON → text with ``[mm:ss]`` markers."""

from __future__ import annotations

import json
from typing import Any

SEGMENT_SECONDS = 30.0


def stamp(seconds: float) -> str:
    """``[mm:ss]``; minutes keep counting past 59 (``[75:03]``)."""
    s = max(0, int(seconds))
    return f"[{s // 60:02d}:{s % 60:02d}]"


def _from_items(items: list[dict[str, Any]]) -> list[tuple[float, str]]:
    """Groups words into lines: a new line after a sentence end once 30 s have passed, or after 60 s."""
    out: list[tuple[float, str]] = []
    start: float | None = None
    words: list[str] = []
    last = 0.0
    for it in items:
        alt = (it.get("alternatives") or [{}])[0]
        word = str(alt.get("content", ""))
        if it.get("type") == "punctuation":
            if words:
                words[-1] += word
            if word in ".?!" and start is not None and last - start >= SEGMENT_SECONDS:
                out.append((start, " ".join(words)))
                start, words = None, []
            continue
        t = float(it.get("start_time", last))
        last = float(it.get("end_time", t))
        if start is None:
            start = t
        elif t - start >= 2 * SEGMENT_SECONDS:
            out.append((start, " ".join(words)))
            start, words = t, []
        words.append(word)
    if words and start is not None:
        out.append((start, " ".join(words)))
    return out


def transcript_to_text(raw: bytes | str, title: str = "") -> str:
    data = json.loads(raw)
    results = data.get("results") or {}
    lines: list[tuple[float, str]] = []
    segments = results.get("audio_segments") or []
    if segments:
        lines = [(float(s.get("start_time", 0)), str(s.get("transcript", "")).strip()) for s in segments]
    elif results.get("items"):
        lines = _from_items(results["items"])
    else:
        text = " ".join(str(t.get("transcript", "")) for t in results.get("transcripts", []))
        lines = [(0.0, text.strip())] if text.strip() else []
    body = "\n".join(f"{stamp(t)} {s}" for t, s in lines if s)
    lang = results.get("language_code") or data.get("language_code")
    head = [f"# {title}" if title else "# Transcript"]
    if lang:
        head.append(f"Language: {lang}")
    return "\n\n".join([*head, body or "(no speech found)"]) + "\n"
