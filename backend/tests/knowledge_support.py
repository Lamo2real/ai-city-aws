"""Fakes for the knowledge tests: memory table, memory bucket, fake KB and a scripted Haiku. No AWS, no Bedrock."""

from __future__ import annotations

import io
import json
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from vaic.shared.caps import default_settings
from vaic.shared.cost import Usage
from vaic.shared.events import MemoryBus
from vaic.shared.knowledge.blobs import MemoryBlobs
from vaic.shared.knowledge.extract import Entity, Extraction, Relationship
from vaic.shared.knowledge.graph import MemoryGraph
from vaic.shared.knowledge.haiku import KnowledgeModel
from vaic.shared.knowledge.kb import FakeKnowledgeBase
from vaic.shared.knowledge.service import KnowledgeService
from vaic.shared.knowledge.store import KnowledgeStore
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable
from vaic.shared.turn import TurnInput, TurnOutput


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 7, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t

    def tick(self, seconds: int = 1) -> None:
        from datetime import timedelta

        self.t += timedelta(seconds=seconds)


@dataclass
class FakeHaiku:
    """Answers each utility call by what its prompt asks for, and keeps what it was sent."""

    replies: dict[str, list[str]] = field(default_factory=dict)
    calls: list[TurnInput] = field(default_factory=list)

    async def __call__(self, t: TurnInput) -> TurnOutput:
        self.calls.append(t)
        kind = (
            "summary"
            if "Reply with the summary only" in t.prompt
            else "entities"
            if '"entities"' in t.prompt
            else "image"
            if "describe one image" in t.prompt
            else "pages"
            if "scanned pages" in t.prompt
            else "metadata"
            if "say where and when it holds" in t.prompt
            else "site"
            if "brand and site profile" in t.prompt
            else "other"
        )
        queue = self.replies.get(kind) or []
        text = queue.pop(0) if queue else _DEFAULT[kind]
        return TurnOutput(text=text, usage=Usage(input=1000, output=200))


_DEFAULT = {
    "summary": "A note about Ada Lovelace and the Analytical Engine.",
    "entities": json.dumps(
        {
            "entities": [
                {"name": "Ada Lovelace", "type": "person", "description": "Mathematician."},
                {"name": "Analytical Engine", "type": "product", "description": "A machine."},
            ],
            "relationships": [{"source": "Ada Lovelace", "relation": "wrote about", "target": "Analytical Engine"}],
        }
    ),
    "image": "## Description\nA whiteboard.\n\n## Text in the image\nQ3 plan",
    "pages": "## Page 1\nScanned words",
    "metadata": "{}",
    "site": "",
    "other": "",
}


@dataclass
class World:
    clock: Clock
    table: MemoryTable
    graph: MemoryGraph
    store: KnowledgeStore
    blobs: MemoryBlobs
    kb: FakeKnowledgeBase
    bus: MemoryBus
    ledger: Ledger
    haiku: FakeHaiku
    service: KnowledgeService
    model: KnowledgeModel


def world() -> World:
    from vaic.shared.utility import UtilityDeps

    clock = Clock()
    table = MemoryTable()
    graph = MemoryGraph()
    store = KnowledgeStore(table, graph, clock)
    blobs = MemoryBlobs()
    kb = FakeKnowledgeBase()
    bus = MemoryBus(clock)
    ledger = Ledger(MemoryTable(), clock)
    haiku = FakeHaiku()
    model = KnowledgeModel(UtilityDeps(ledger=ledger, bus=bus, settings=default_settings(), runner=haiku, env={}))
    return World(
        clock, table, graph, store, blobs, kb, bus, ledger, haiku, KnowledgeService(store, blobs, bus, kb), model
    )


async def ready_item(
    w: World,
    title: str,
    scope: str = "relevant",
    summary: str = "",
    entities: list[tuple[str, str]] | None = None,
    rels: list[tuple[str, str, str]] | None = None,
    status: str = "ready",
) -> dict[str, Any]:
    """An item as the pipeline leaves it, with its graph."""
    item = await w.service.add_text(f"text of {title}", title, scope)
    w.clock.tick()
    await w.store.update_item(item["id"], {"status": status, "summary": summary or f"Summary of {title}."})
    if entities:
        await w.store.write_graph(
            item["id"],
            Extraction(
                summary="",
                entities=[Entity(name=n, type=t) for n, t in entities],  # type: ignore[arg-type]
                relationships=[Relationship(source=a, relation=r, target=b) for a, r, b in rels or []],
            ),
        )
    got = await w.store.get_item(item["id"])
    assert got is not None
    return got


def pdf_with_text(pages: list[str]) -> bytes:
    """A small valid PDF whose pages carry the given text in their text layer (Helvetica)."""
    objs: list[bytes] = []
    kids = []
    n = len(pages)
    # 1 catalog, 2 pages, 3 font, then (page, content) pairs
    for i in range(len(pages)):
        page_no = 4 + 2 * i
        kids.append(f"{page_no} 0 R")
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {n} >>".encode())
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i, text in enumerate(pages):
        content_no = 5 + 2 * i
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_no} 0 R >>".encode()
        )
        safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 10 Tf 20 700 Td ({safe}) Tj ET".encode()
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + o + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def png(width: int = 10, height: int = 10, color: tuple[int, int, int] = (200, 30, 30)) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, "PNG")
    return buf.getvalue()


Resolver = Callable[[str, int], list[str]]
