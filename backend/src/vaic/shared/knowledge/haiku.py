"""The knowledge base's Haiku 5.5 calls: summary + graph, image description, scanned-PDF page reading.

Each is a utility turn through the same gate as the other utility calls (spend caps, cost row in
the ledger, ``cost.update`` event), with the utility role's model from ``config/models.json``. Every prompt
stays far below Haiku's 100,000-token long-context tier.
"""

from __future__ import annotations

import io
import json
import re
from dataclasses import dataclass
from typing import Any

from ..models import resolve_role_from_env
from ..turn import GateDeps, GatedTurn, run_gated_turn
from ..utility import UTILITY_MAX_CHARS, UtilityDeps, agents_dir
from .extract import SUMMARY_MAX_WORDS, Extraction, limit_words, parse_extraction
from .jurisdiction import clean_detected

METADATA_TEXT_CHARS = 12_000
"""The start of the item is enough to say where and when it holds."""

MAX_IMAGE_BYTES = int(3.75 * 1024**2)
MAX_IMAGE_EDGE = 1568
"""Larger images cost more tokens without reading better; Bedrock's own limit is 8,000 px."""
_IMAGE_FORMATS = {"PNG": "png", "JPEG": "jpeg", "WEBP": "webp", "GIF": "gif"}


def knowledge_prompt(name: str) -> str:
    return (agents_dir() / "utility" / f"knowledge-{name}.md").read_text(encoding="utf-8").strip()


def fit_image(data: bytes) -> tuple[bytes, str]:
    """(bytes, Converse format) within Bedrock's limits: resized and re-encoded only when needed."""
    from PIL import Image

    with Image.open(io.BytesIO(data)) as im:
        fmt = _IMAGE_FORMATS.get(str(im.format))
        animated = bool(getattr(im, "is_animated", False))
        if fmt and not animated and max(im.size) <= MAX_IMAGE_EDGE and len(data) <= MAX_IMAGE_BYTES:
            return data, fmt
        im.seek(0)
        frame = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    frame.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    buf = io.BytesIO()
    if frame.mode == "RGBA":
        frame.save(buf, "PNG", optimize=True)
        if buf.tell() <= MAX_IMAGE_BYTES:
            return buf.getvalue(), "png"
        frame = frame.convert("RGB")
        buf = io.BytesIO()
    frame.save(buf, "JPEG", quality=85)
    return buf.getvalue(), "jpeg"


@dataclass
class KnowledgeModel:
    deps: UtilityDeps

    async def _call(
        self, prompt: str, data: str, attachments: tuple[dict[str, object], ...] = (), max_tokens: int = 2048
    ) -> str:
        d = self.deps
        body = data[:UTILITY_MAX_CHARS]
        r = await run_gated_turn(
            GatedTurn(
                kind="utility",
                role="utility",
                agent_id="utility",
                session_id="utility-calls-are-stateless-000000",
                department=None,
                ticket_id=None,
                models=resolve_role_from_env("utility", d.env),
                prompt=f"{prompt}\n\n<data>\n{body}\n</data>",
                prefix=d.settings.get("profile_prefix"),
                timeout_ms=120_000,
                attachments=attachments,
                max_tokens=max_tokens,
            ),
            GateDeps(ledger=d.ledger, bus=d.bus, settings=d.settings, runner=d.runner),
        )
        return r.output.text.strip()

    async def summarize(self, title: str, text: str) -> str:
        """A plain summary of at most 150 words. Raises ``ValueError`` when the reply is empty."""
        reply = await self._call(knowledge_prompt("summary"), f"Title: {title}\n\n{text}", max_tokens=1024)
        summary = limit_words(re.sub(r"\s+", " ", reply), SUMMARY_MAX_WORDS)
        if not summary:
            raise ValueError("empty summary")
        return summary

    async def extract(self, title: str, text: str) -> Extraction:
        """Entities and relationships (validated JSON, ≤ 50 entities). One retry when the JSON doesn't validate."""
        data = f"Title: {title}\n\n{text}"
        prompt = knowledge_prompt("entities")
        try:
            return parse_extraction(await self._call(prompt, data, max_tokens=4096))
        except ValueError:
            return parse_extraction(
                await self._call(prompt + "\n\nReply with the JSON object only.", data, max_tokens=4096)
            )

    async def detect_metadata(self, title: str, file_name: str, folder: str, text: str) -> dict[str, object]:
        """Jurisdictions, year, in-force period, topic, document type and language (§15), each validated.

        Raises ``ValueError`` when the reply is not a JSON object.
        """
        reply = await self._call(
            knowledge_prompt("metadata"),
            f"Title: {title}\nFile name: {file_name}\nFolder: {folder or '(none)'}\n\n{text[:METADATA_TEXT_CHARS]}",
            max_tokens=512,
        )
        m = re.search(r"\{.*\}", reply, re.S)
        if not m:
            raise ValueError("no JSON in the metadata reply")
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError as e:
            raise ValueError("the metadata reply is not JSON") from e
        if not isinstance(data, dict):
            raise ValueError("the metadata reply is not an object")
        return clean_detected(data)

    async def site_profile(self, data: str) -> dict[str, Any]:
        """The brand and site profile (§16) as the model wrote it; ``site_profile.clean_profile`` validates it.

        Raises ``ValueError`` when the reply is not a JSON object.
        """
        from .site_profile import parse_model_profile

        return parse_model_profile(await self._call(knowledge_prompt("site-profile"), data, max_tokens=3000))

    async def describe_image(self, title: str, data: bytes) -> str:
        img, fmt = fit_image(data)
        return await self._call(
            knowledge_prompt("image"),
            f"Title: {title}",
            ({"image": {"format": fmt, "source": {"bytes": img}}},),
            max_tokens=4096,
        )

    async def read_pages(self, title: str, first_page: int, pdf: bytes) -> str:
        """Bedrock Converse reads a PDF visually (scanned pages) only with citations enabled."""
        return await self._call(
            knowledge_prompt("pages"),
            f"Title: {title}\nThe attached part starts at page {first_page}.",
            (
                {
                    "document": {
                        "format": "pdf",
                        "name": f"pages from {first_page}",
                        "source": {"bytes": pdf},
                        "citations": {"enabled": True},
                    }
                },
            ),
            max_tokens=8192,
        )
