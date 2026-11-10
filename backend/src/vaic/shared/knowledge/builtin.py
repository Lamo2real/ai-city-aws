"""The built-in AI City guide in the Knowledge base (the owner, 2026-11-09).

One fixed, read-only document, ``kn-builtin-guide``: ``agents/help/app_guide.md`` rendered as a PDF, put in the
knowledge base's own folder (``normalized/builtin/``) and indexed straight into the vector store, so every agent can
search it like any other document. It is not made through the item pipeline and it can't be changed, rescoped or
deleted; the Knowledge tab shows it with a "Built in" label. When the guide changes, the PDF is rebuilt and indexed
again. VAIC also carries the guide in its instructions, so "how do I…" never waits on the index.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from vaic.shared.app_guide import app_guide
from vaic.shared.log import log

from .model import kb_metadata

GUIDE_ID = "kn-builtin-guide"
TITLE = "AI City guide"
KEY = "normalized/builtin/ai-city-guide.pdf"
LEGACY_TITLE = "AI City guide (built in)"
"""Copies the earlier attempt added as ordinary items; they are removed."""
REVISION = "2"

_ASCII = {
    "→": "->", "←": "<-", "…": "...", "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "·": "-",
    "✓": "OK", "×": "x", "•": "-", " ": " ",
}  # fmt: skip


def _plain(s: str) -> str:
    """The PDF's built-in fonts are Latin-1: swap the few other characters the guide uses."""
    for a, b in _ASCII.items():
        s = s.replace(a, b)
    return s.encode("latin-1", "replace").decode("latin-1")


def _inline(s: str) -> str:
    return _plain(s.replace("**", "").replace("`", ""))


def render_pdf(markdown: str) -> bytes:
    """A clean, searchable PDF of the guide: headings, paragraphs and bullet lists."""
    from fpdf import FPDF

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_title("AI City guide")
    pdf.add_page()
    width = pdf.w - pdf.l_margin - pdf.r_margin
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            pdf.ln(2)
            continue
        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 18)
            pdf.multi_cell(width, 9, _inline(line[2:]))
            pdf.ln(2)
        elif line.startswith("## "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 13)
            pdf.multi_cell(width, 7, _inline(line[3:]))
        else:
            stripped = line.lstrip()
            indent = (len(line) - len(stripped)) * 1.5
            pdf.set_font("Helvetica", "", 10)
            if stripped.startswith(("- ", "* ")):
                pdf.set_x(pdf.l_margin + 4 + indent)
                pdf.multi_cell(width - 4 - indent, 5, "- " + _inline(stripped[2:]))
            elif stripped[:3].rstrip(".").isdigit() and ". " in stripped[:4]:
                pdf.set_x(pdf.l_margin + 4 + indent)
                pdf.multi_cell(width - 4 - indent, 5, _inline(stripped))
            else:
                pdf.set_x(pdf.l_margin + indent)
                pdf.multi_cell(width - indent, 5, _inline(stripped))
    return bytes(pdf.output())


def guide_version() -> str:
    return hashlib.sha256((REVISION + app_guide()).encode()).hexdigest()[:16]


def _uri(bucket: str) -> str:
    return f"s3://{bucket}/{KEY}"


async def ensure_builtin_guide(store: Any, blobs: Any, kb: Any) -> dict[str, Any] | None:
    """Makes sure the guide is in the Knowledge base and reports how far its indexing is. Never raises: the guide
    still reaches VAIC through its instructions. Returns the record, or None without a knowledge base."""
    if store is None or blobs is None or kb is None:
        return None
    try:
        rec = await store.get_item(GUIDE_ID)
        version = guide_version()
        uri = _uri(blobs.bucket)
        if not rec or rec.get("guide_version") != version or rec.get("status") == "failed":
            if rec and rec.get("guide_version") == version and int(rec.get("tries") or 0) >= 3:
                return rec  # three tries for this version; the reason stays on the card
            tries = int(rec.get("tries") or 0) + 1 if rec and rec.get("guide_version") == version else 1
            pdf = render_pdf(app_guide())
            meta = kb_metadata(GUIDE_ID, "relevant", "document", {"topic": "AI City", "doc_type": "guidance"})
            await blobs.put(KEY, pdf, "application/pdf")
            await blobs.put(
                f"{KEY}.metadata.json", json.dumps({"metadataAttributes": meta}).encode(), "application/json"
            )
            fields = {
                "kind": "document", "title": TITLE, "source": "built in", "content_type": "application/pdf",
                "size_bytes": len(pdf), "scope": "relevant", "builtin": True, "normalized_keys": [KEY],
                "ingest_uris": [uri], "guide_version": version, "tries": tries, "topic": "AI City",
                "doc_type": "guidance", "meta_source": "built in", "error": None, "warning": None,
                "summary": "How to use every part of AI City: where things are, what each button does, and how to "
                "get things done.",
            }  # fmt: skip
            if rec:
                rec = await store.update_item(GUIDE_ID, {**fields, "status": "processing"})
            else:
                rec = await store.create_item({"id": GUIDE_ID, **fields, "raw_key": KEY, "status": "processing"})
            try:
                await kb.ingest([(uri, meta)])
            except Exception as e:
                why = " ".join(f"{type(e).__name__}: {e}".split())[:400]
                log("warn", "guide.ingest_failed", error=type(e).__name__, detail=why)
                return await store.update_item(GUIDE_ID, {"status": "failed", "error": f"Indexing failed ({why})."})
            log("info", "guide.indexing", version=version, tries=tries)
            return rec
        if rec.get("status") == "processing":
            state = (await kb.statuses([uri])).get(uri, "")
            if state == "INDEXED":
                return await store.update_item(GUIDE_ID, {"status": "ready", "error": None})
            if state in ("FAILED", "METADATA_UPDATE_FAILED", "NOT_FOUND"):
                return await store.update_item(
                    GUIDE_ID, {"status": "failed", "error": f"Indexing failed (the knowledge base says {state})."}
                )
        return rec
    except Exception as e:
        log("warn", "guide.ensure_failed", error=type(e).__name__, detail=str(e)[:300])
        return None


async def remove_legacy_copies(service: Any) -> int:
    """The earlier copies added as ordinary items ("AI City guide (built in)") go; returns how many."""
    n = 0
    try:
        for i in (await service.list()).get("items", []):
            if i.get("title") == LEGACY_TITLE and not i.get("builtin"):
                await service.delete(i["id"])
                n += 1
    except Exception as e:
        log("info", "guide.legacy_cleanup_failed", error=type(e).__name__)
    return n
