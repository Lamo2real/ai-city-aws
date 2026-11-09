"""The built-in AI City guide in Knowledge: a read-only PDF, indexed in the vector store, never through the item
pipeline (the owner, 2026-11-09)."""

import pytest

from aic.shared.knowledge.builtin import (
    GUIDE_ID,
    KEY,
    LEGACY_TITLE,
    ensure_builtin_guide,
    remove_legacy_copies,
    render_pdf,
)
from aic.shared.knowledge.service import KnowledgeError
from knowledge_support import world


def test_the_guide_renders_as_a_pdf() -> None:
    pdf = render_pdf(
        "# Title\n\n## How do I…\n- **add a connector?** Settings → Connectors `#/settings/connectors`\n1. Step"
    )
    assert pdf.startswith(b"%PDF") and len(pdf) > 500


async def test_the_guide_is_indexed_and_becomes_ready() -> None:
    w = world()
    rec = await ensure_builtin_guide(w.store, w.blobs, w.kb)
    assert rec and rec["status"] == "processing" and rec["builtin"] is True
    uri = f"s3://{w.blobs.bucket}/{KEY}"
    assert w.kb.docs[uri]["item_id"] == GUIDE_ID and w.kb.docs[uri]["scope"] == "relevant"
    assert (await w.blobs.get(KEY)).startswith(b"%PDF")
    w.kb.status[uri] = "INDEXED"
    rec = await ensure_builtin_guide(w.store, w.blobs, w.kb)
    assert rec and rec["status"] == "ready"
    assert await ensure_builtin_guide(w.store, w.blobs, w.kb) == rec  # nothing more to do
    assert len(w.kb.ingest_calls) == 1


async def test_the_guide_cant_be_changed_or_deleted() -> None:
    w = world()
    await ensure_builtin_guide(w.store, w.blobs, w.kb)
    with pytest.raises(KnowledgeError, match="built in"):
        await w.service.delete(GUIDE_ID)
    with pytest.raises(KnowledgeError, match="built in"):
        await w.service.update(GUIDE_ID, {"scope": "always"})


async def test_a_failed_index_shows_why_and_tries_again_three_times() -> None:
    w = world()

    async def refuse(docs: object) -> None:
        raise RuntimeError("AccessDeniedException: not authorized")

    w.kb.ingest = refuse  # type: ignore[method-assign]
    for _ in range(4):
        rec = await ensure_builtin_guide(w.store, w.blobs, w.kb)
    assert rec and rec["status"] == "failed" and "AccessDeniedException" in rec["error"] and rec["tries"] == 3


async def test_the_old_ordinary_copies_are_removed() -> None:
    w = world()
    old = await w.service.add_text("old guide", LEGACY_TITLE)
    await ensure_builtin_guide(w.store, w.blobs, w.kb)
    assert await remove_legacy_copies(w.service) == 1
    ids = [i["id"] for i in (await w.service.list())["items"]]
    assert old["id"] not in ids and GUIDE_ID in ids
