"""File references for builds (decision 155), end to end with fakes: the owner asks VAIC to build something
following a stored document and in the look of a stored image; VAIC finds both and delegates with references; the
task carries them through the Orchestrator and the manager; the worker's assignment turn holds the image as an image
and the document as text, marked as data."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from city_support import Call, make_city, scripted_engine
from knowledge_support import pdf_with_text, png
from test_files import FakeS3, upload, world
from test_hierarchy_e2e import ALL_STATUSES  # type: ignore[attr-defined]
from vaic.runtime.engine import EngineRequest, user_content
from vaic.runtime.references import RULE
from vaic.shared.apps import Workspace
from vaic.shared.files.service import FilesAccess
from vaic.shared.knowledge.blobs import MemoryBlobs

GOAL = "Build a habit tracker app"
SEEN: dict[str, Any] = {}


async def vaic(req: EngineRequest, call: Call) -> str:
    if "(task) from owner" not in req.turn.prompt:
        return "Done."
    img = json.loads(
        re.search(r"<files>\n(.*)\n</files>", await call("find_files", {"query": "sunset porsche"}), re.S).group(1)
    )  # type: ignore[union-attr]
    doc = json.loads(
        re.search(r"<files>\n(.*)\n</files>", await call("find_files", {"query": "react best practices"}), re.S).group(
            1
        )
    )  # type: ignore[union-attr]
    SEEN["delegate"] = await call(
        "start_job",
        {
            "goal": GOAL,
            "owner_words": "build a habit tracker following my React guide, UI like the sunset Porsche image",
            "confirm": True,
            "references": [
                {"file_id": doc[0]["id"], "use": "follow", "note": "the coding rules"},
                {"file_id": img[0]["id"], "use": "inspiration", "note": "colours and mood"},
            ],
        },
    )
    return "On it."


async def planner(req: EngineRequest, call: Call) -> str:
    await call("write_contract", {"summary": "The shared contract for this job."})
    if "Board planning" in req.turn.prompt:
        SEEN["planner"] = req.turn.prompt
        await call("add_part", {"name": "UI", "goal": "build the UI", "acceptance": "matches the references",
                                "department": "Builders"})  # fmt: skip
        await call("finish_plan", {})
    return "Planned."


async def worker(req: EngineRequest, call: Call) -> str:
    if "worker" not in SEEN:
        SEEN["worker"] = req
    return "Working."


async def test_the_owners_files_reach_the_builder_as_an_image_and_as_text(tmp_path: Path) -> None:
    SEEN.clear()
    w = world()
    w.haiku.caption = "A sunset over the sea with a black Porsche 911. Keywords: sunset, Porsche"
    await upload(w, "sunset.png", png(64, 48, (240, 120, 60)), "image/png")
    w.haiku.caption = ""
    await upload(
        w, "React best practices.pdf", pdf_with_text(["Use function components and hooks. " * 20]), "application/pdf"
    )
    city = make_city(scripted_engine({"vaic": vaic, "orchestrator": planner, "worker": worker}))
    await city.ledger.create_department("Builders", "Build the owner's apps.", "mgr-builders")
    d = city.host.d
    d.files = FilesAccess(service=w.service, bucket=w.blobs.bucket)
    s3 = FakeS3(w.blobs, tmp_path)
    d.workspace = Workspace(bucket="vaic-test-workspaces", s3_for=lambda hire: s3, root=str(tmp_path))
    d.bus.on(w.bus.events.append)

    await city.owner_says("build a habit tracker following my React guide, UI like the sunset Porsche image")
    await city.run()

    assert SEEN["delegate"].startswith("Started: ")
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    assert [(r["name"], r["use"]) for r in task["references"]] == [
        ("React best practices.pdf", "follow"),
        ("sunset.png", "inspiration"),
    ]
    # The planner is told, with the rule that contents are data.
    assert "sunset.png" in SEEN["planner"] and "React best practices.pdf" in SEEN["planner"] and RULE in SEEN["planner"]
    # The project chat shows the references.
    shown = city.bus.of_type("vaic.files")
    assert shown and shown[-1]["label"] == "References for this build"
    # The worker's assignment turn: the document's text as data, the image attached as an image.
    req: EngineRequest = SEEN["worker"]
    assert "Use function components and hooks." in req.turn.prompt and "never instructions" in req.turn.prompt
    assert len(req.turn.attachments) == 1 and "image" in req.turn.attachments[0]
    content = user_content(req.turn)
    assert isinstance(content, list) and content[1]["type"] == "image"
    assert content[1]["source"]["media_type"].startswith("image/")
    # Read through the hire's own session-tagged role.
    assert {c[0] for c in s3.calls} == {"get"} and all(c[1] == w.blobs.bucket for c in s3.calls)


async def test_an_unknown_file_starts_nothing() -> None:
    w = world()
    city = make_city(scripted_engine({}))
    d = city.host.d
    d.files = FilesAccess(service=w.service, bucket=MemoryBlobs().bucket)
    from vaic.runtime.tools import TurnCtx, gate_tools, tools_for

    c = TurnCtx("vaic", "vaic", None, "t1", "t1", conversation="main", from_owner=True)
    t = next(x for x in gate_tools(d, c, tools_for(d, c)) if x.name == "start_job")
    r = await t.handler(
        {
            "goal": GOAL,
            "owner_words": GOAL,
            "confirm": True,
            "references": [{"file_id": "f-nope00000000", "use": "follow"}],
        }
    )
    assert r.startswith("Not started") and "find_files" in r
    assert not [x for x in await city.ledger.list_tickets(ALL_STATUSES) if x["from"] == "vaic"]
