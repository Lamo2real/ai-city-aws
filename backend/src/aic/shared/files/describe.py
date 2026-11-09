"""The Haiku 5.5 calls that describe a file (docs/FILES.md §5): an image caption, a video's frames, and a
description from a document's text or a recording's transcript. Utility turns through the same gate as every
other utility call (spend caps, a cost row in the ledger); prompts in ``agents/utility/files-*.md``."""

from __future__ import annotations

from ..knowledge.haiku import KnowledgeModel, fit_image
from ..utility import agents_dir

MAX_FRAMES = 4
DESCRIBE_TEXT_CHARS = 60_000


def files_prompt(name: str) -> str:
    return (agents_dir() / "utility" / f"files-{name}.md").read_text(encoding="utf-8").strip()


def _clip(text: str, words: int = 160) -> str:
    out = " ".join(text.split())
    w = out.split(" ")
    return out if len(w) <= words else " ".join(w[:words]) + "…"


class FilesModel(KnowledgeModel):
    async def caption_image(self, name: str, data: bytes) -> str:
        img, fmt = fit_image(data)
        reply = await self._call(
            files_prompt("image"),
            f"File name: {name}",
            ({"image": {"format": fmt, "source": {"bytes": img}}},),
            max_tokens=600,
        )
        return _clip(reply)

    async def caption_frames(self, name: str, frames: list[bytes]) -> str:
        blocks: list[dict[str, object]] = []
        for f in frames[:MAX_FRAMES]:
            img, fmt = fit_image(f)
            blocks.append({"image": {"format": fmt, "source": {"bytes": img}}})
        reply = await self._call(
            files_prompt("frames"), f"File name: {name}\nFrames, in order: {len(blocks)}", tuple(blocks), max_tokens=600
        )
        return _clip(reply)

    async def describe(self, name: str, text: str, frames: str = "") -> str:
        body = f"File name: {name}\n"
        if frames:
            body += f"\nWhat the video's frames show:\n{frames}\n"
        body += f"\nText:\n{text[:DESCRIBE_TEXT_CHARS]}"
        return _clip(await self._call(files_prompt("describe"), body, max_tokens=600))
