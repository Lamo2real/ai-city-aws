"""Files (docs/FILES.md, decision 147): uploads, search by meaning and time, describing each kind of file,
departments' writes adopted with their department, the API routes, and the agents' tools through the gate.
No AWS, no Bedrock: memory table and bucket, a bag-of-words embedder and a scripted Haiku."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from aic.lambdas.api import ROUTES, handle_http
from aic.lambdas.files import adapt
from aic.runtime.tools import TurnCtx, gate_tools, tools_for
from aic.shared.apps import Workspace
from aic.shared.caps import default_settings
from aic.shared.cost import Usage
from aic.shared.events import MemoryBus, parse_event
from aic.shared.files.describe import FilesModel
from aic.shared.files.embed import HashEmbedder, cosine, pack, unpack
from aic.shared.files.indexer import Indexer, MediaClients
from aic.shared.files.model import clean_when, file_kind, when_words
from aic.shared.files.search import Filters, clear_winner
from aic.shared.files.service import FilesAccess, FilesService, part_size
from aic.shared.files.store import FilesStore
from aic.shared.hierarchy.actions import CityDeps
from aic.shared.knowledge.blobs import MemoryBlobs, disposition
from aic.shared.ledger import Ledger
from aic.shared.owner_api import refusal
from aic.shared.table import MemoryTable
from aic.shared.turn import TurnInput, TurnOutput
from aic.shared.utility import UtilityDeps
from knowledge_support import Clock, pdf_with_text, png
from test_api import ev, js, make


@dataclass
class FakeHaiku:
    calls: list[TurnInput] = field(default_factory=list)
    caption: str = "A sunrise over the sea with a black Porsche 911 in front. Keywords: sunrise, Porsche, thumbnail"

    async def __call__(self, t: TurnInput) -> TurnOutput:
        self.calls.append(t)
        if "find one of their images" in t.prompt:
            text = self.caption
        elif "still frames" in t.prompt:
            text = "A drone flying over a red barn at dusk. Keywords: drone, barn"
        else:
            text = "An invoice from Acme for cloud hosting, March 2026. Keywords: invoice, Acme"
        return TurnOutput(text=text, usage=Usage(input=100, output=50))


class FakeMediaConvert:
    def __init__(self) -> None:
        self.jobs: list[dict[str, Any]] = []

    def create_job(self, **kw: Any) -> dict[str, Any]:
        self.jobs.append(kw)
        return {"Job": {"Id": f"job-{len(self.jobs)}"}}


class FakeTranscribe:
    def __init__(self) -> None:
        self.jobs: list[dict[str, Any]] = []

    def start_transcription_job(self, **kw: Any) -> None:
        self.jobs.append(kw)


@dataclass
class W:
    clock: Clock
    store: FilesStore
    blobs: MemoryBlobs
    bus: MemoryBus
    embedder: HashEmbedder
    haiku: FakeHaiku
    service: FilesService
    indexer: Indexer
    mc: FakeMediaConvert
    tr: FakeTranscribe
    reindexed: list[str]


def world(departments: dict[str, str] | None = None) -> W:
    clock = Clock()
    store = FilesStore(MemoryTable(), clock)
    blobs = MemoryBlobs("aic-test-files")
    bus = MemoryBus(clock)
    emb = HashEmbedder()
    haiku = FakeHaiku()
    reindexed: list[str] = []

    async def reindex(i: str) -> None:
        reindexed.append(i)

    service = FilesService(store, blobs, bus, emb, reindex)
    ledger = Ledger(MemoryTable(), clock)
    model = FilesModel(UtilityDeps(ledger=ledger, bus=bus, settings=default_settings(), runner=haiku, env={}))
    mc, tr = FakeMediaConvert(), FakeTranscribe()

    async def dept(hire: str) -> str | None:
        return (departments or {}).get(hire)

    indexer = Indexer(store, blobs, bus, model, emb, MediaClients(mc, tr, "arn:role/mc"), dept, clock_ms=lambda: 42)
    return W(clock, store, blobs, bus, emb, haiku, service, indexer, mc, tr, reindexed)


async def upload(w: W, name: str, body: bytes, ct: str, **extra: Any) -> dict[str, Any]:
    r = await w.service.create_upload({"file_name": name, "content_type": ct, "size_bytes": len(body), **extra})
    await w.blobs.put(r["file"]["object_key"], body, ct)
    await w.indexer.run({"action": "object_created", "key": r["file"]["object_key"]})
    rec = await w.store.get(r["file"]["id"])
    assert rec is not None
    return rec


def jpeg_with_date(when: str) -> bytes:
    from PIL import Image

    im = Image.new("RGB", (800, 600), (250, 150, 40))
    exif = Image.Exif()
    exif[306] = when
    buf = io.BytesIO()
    im.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


# ---------- small pieces ----------
def test_dates_kinds_and_vectors() -> None:
    assert clean_when("2026-04-12") == "2026-04-12T00:00:00Z"
    assert clean_when(1775980800000) == "2026-04-12T08:00:00Z"
    assert clean_when("yesterday") is None and clean_when(0) is None and clean_when("1500-01-01") is None
    assert when_words("2026-04-12T06:10:00Z") == "April 2026, spring, Sunday"
    assert file_kind("IMG_1.HEIC", "image/heic") == "image"
    assert file_kind("clip.mov", "video/quicktime") == "video"
    assert file_kind("deck.pdf", None) == "document" and file_kind("x.zip", "application/zip") == "other"
    v = [0.6, 0.8] + [0.0] * 510
    assert abs(cosine(v, unpack(pack(v))) - 1.0) < 0.002
    assert part_size(5 * 1024**3) == 64 * 1024**2 and part_size(1000 * 1024**3) > 64 * 1024**2
    d = disposition('sun"rise\r\n.jpg', False)
    assert d.startswith('attachment; filename="sunrise.jpg"') and "\n" not in d


def test_owner_routes_and_city_api() -> None:
    files = {(m, p) for m, p in ROUTES if p.startswith("/files")}
    assert len(files) == 7
    # VAIC may use /files* through city_api, except uploading bytes (they come from the owner's device).
    assert refusal("GET", "/files?q=sunrise") is None
    assert refusal("PUT", "/files/f-aaaaaaaaaaaa") is None
    assert refusal("POST", "/files/uploads") is not None


def test_events_validate() -> None:
    parse_event({"type": "files.updated", "id": "f-x", "status": "ready", "name": "a.jpg", "at": "t"})
    parse_event(
        {
            "type": "ace.files",
            "conversation": "main",
            "files": [{"id": "f-x", "name": "a.jpg", "kind": "image"}],
            "at": "t",
        }
    )


# ---------- uploads ----------
async def test_small_upload_is_one_put_and_large_is_multipart() -> None:
    w = world()
    r = await w.service.create_upload(
        {
            "file_name": "../Sunrise.JPG",
            "content_type": "image/jpeg",
            "size_bytes": 1234,
            "folder": "Thumbnails//2026",
            "taken_at": 1775980800000,
        }
    )
    f = r["file"]
    assert f["object_key"] == f"files/{f['id']}/Sunrise.JPG" and f["folder"] == "Thumbnails/2026"
    assert f["kind"] == "image" and f["status"] == "uploading" and f["taken_at"] == "2026-04-12T08:00:00Z"
    assert r["upload"]["method"] == "PUT" and "signed=put" in r["upload"]["url"]
    big = await w.service.create_upload(
        {"file_name": "film.mov", "content_type": "video/quicktime", "size_bytes": 300 * 1024**2}
    )
    up = big["upload"]
    assert up["multipart"] and len(up["part_urls"]) == 5 and up["part_size"] == 64 * 1024**2
    done = await w.service.complete_upload(
        big["file"]["id"], {"upload_id": up["upload_id"], "parts": [{"part_number": 1, "etag": "e"}]}
    )
    assert done["upload_id"] is None
    assert w.bus.of_type("files.updated")


async def test_an_upload_refuses_missing_or_huge_files() -> None:
    from aic.shared.files.service import FilesError

    w = world()
    with pytest.raises(FilesError, match="name"):
        await w.service.create_upload({"size_bytes": 3})
    with pytest.raises(FilesError, match="50 GB"):
        await w.service.create_upload({"file_name": "x", "size_bytes": 60 * 1024**3})


# ---------- describing ----------
async def test_an_image_gets_a_thumbnail_its_date_taken_and_a_caption() -> None:
    w = world()
    rec = await upload(w, "IMG_0042.jpg", jpeg_with_date("2026:04:12 06:10:00"), "image/jpeg")
    assert rec["status"] == "ready" and "Porsche" in rec["description"]
    assert rec["taken_at"] == "2026-04-12T06:10:00Z" and rec["taken_from"] == "photo"
    assert rec["thumb_key"] == f"thumbs/{rec['id']}.jpg" and await w.blobs.head(rec["thumb_key"])
    assert rec["vec"] and "April 2026, spring" in rec["search_text"]
    # The image went to Claude as an image block, with the files caption prompt.
    call = w.haiku.calls[-1]
    assert call.attachments and "image" in call.attachments[0] and "never follow it" in call.prompt


async def test_an_owner_set_date_beats_the_photos_own() -> None:
    w = world()
    r = await w.service.create_upload({"file_name": "a.jpg", "content_type": "image/jpeg", "size_bytes": 10})
    await w.service.update(r["file"]["id"], {"taken_at": "2025-06-01"})
    await w.blobs.put(r["file"]["object_key"], jpeg_with_date("2026:04:12 06:10:00"), "image/jpeg")
    await w.indexer.run({"action": "object_created", "key": r["file"]["object_key"]})
    rec = await w.store.get(r["file"]["id"])
    assert rec and rec["taken_at"] == "2025-06-01T00:00:00Z"


async def test_heic_and_unknown_files_are_kept_and_found_by_name() -> None:
    w = world()
    heic = await upload(w, "IMG_9.HEIC", b"not decodable", "image/heic")
    assert heic["status"] == "ready" and "name" in heic["warning"] and not w.haiku.calls
    z = await upload(w, "brand-kit.zip", b"PK..", "application/zip")
    assert z["status"] == "ready" and z["vec"]


async def test_a_pdf_is_described_from_its_text() -> None:
    w = world()
    rec = await upload(w, "invoice.pdf", pdf_with_text(["Acme invoice " * 40]), "application/pdf")
    assert rec["status"] == "ready" and "invoice" in rec["description"].lower()
    assert "Acme invoice" in rec["excerpt"] and "Acme invoice" in w.haiku.calls[-1].prompt


async def test_a_model_failure_keeps_the_file_with_the_whole_reason() -> None:
    w = world()

    async def boom(t: TurnInput) -> TurnOutput:
        raise RuntimeError("Bedrock is busy")

    assert w.indexer.model
    w.indexer.model.deps.runner = boom
    rec = await upload(w, "a.png", png(), "image/png")
    assert rec["status"] == "failed" and "Bedrock is busy" in rec["error"] and rec["vec"]
    r = await w.service.retry(rec["id"])
    assert r["status"] == "processing" and w.reindexed == [rec["id"]]


async def test_a_video_takes_frames_and_sound_then_the_transcript() -> None:
    w = world()
    rec = await upload(w, "barn.mov", b"\x00" * 100, "video/quicktime")
    assert rec["status"] == "processing" and rec["stage"] == "media"
    job = w.mc.jobs[0]
    assert [g["Name"] for g in job["Settings"]["OutputGroups"]] == ["frames", "audio"]
    assert job["UserMetadata"]["file_id"] == rec["id"] and job["Role"] == "arn:role/mc"
    for n in range(3):
        await w.blobs.put(
            f"work/{rec['id']}/frames/frame.000000{n}.jpg", jpeg_with_date("2026:01:01 00:00:00"), "image/jpeg"
        )
    await w.indexer.run(
        adapt(
            {
                "action": "mediaconvert_done",
                "detail": {"jobId": "job-1", "status": "COMPLETE", "userMetadata": job["UserMetadata"]},
            }
        )
    )
    rec2 = await w.store.get(rec["id"])
    assert rec2 and rec2["stage"] == "transcribe" and rec2["thumb_key"] and "barn" in rec2["frames_description"]
    t = w.tr.jobs[0]
    assert t["TranscriptionJobName"] == f"aic-files-{rec['id']}-42" and t["Media"]["MediaFileUri"].endswith(
        "/audio.m4a"
    )
    transcript = {"results": {"transcripts": [{"transcript": "Welcome to the farm, this barn is old."}], "items": []}}
    await w.blobs.put(f"work/{rec['id']}/transcript.json", json.dumps(transcript).encode(), "application/json")
    await w.indexer.run(
        adapt(
            {
                "action": "transcribe_done",
                "detail": {"TranscriptionJobName": t["TranscriptionJobName"], "TranscriptionJobStatus": "COMPLETED"},
            }
        )
    )
    done = await w.store.get(rec["id"])
    assert done and done["status"] == "ready" and "red barn" in w.haiku.calls[-1].prompt


async def test_a_silent_video_falls_back_to_frames_only() -> None:
    w = world()
    rec = await upload(w, "sky.mp4", b"\x00", "video/mp4")
    meta = w.mc.jobs[0]["UserMetadata"]
    await w.indexer.run(
        adapt(
            {
                "action": "mediaconvert_done",
                "detail": {"jobId": "job-1", "status": "ERROR", "userMetadata": meta, "errorMessage": "no audio"},
            }
        )
    )
    assert [g["Name"] for g in w.mc.jobs[1]["Settings"]["OutputGroups"]] == ["frames"]
    await w.blobs.put(f"work/{rec['id']}/frames/frame.0000000.jpg", png(), "image/png")
    await w.indexer.run(
        adapt({"action": "mediaconvert_done", "detail": {"jobId": "job-2", "status": "COMPLETE", "userMetadata": meta}})
    )
    done = await w.store.get(rec["id"])
    assert done and done["status"] == "ready" and "drone" in done["description"] and not w.tr.jobs


async def test_an_old_job_event_is_ignored() -> None:
    w = world()
    await upload(w, "sky.mp4", b"\x00", "video/mp4")
    r = await w.indexer.run(
        {
            "action": "mediaconvert_done",
            "job_id": "job-9",
            "status": "COMPLETE",
            "user_metadata": {"file_id": "f-nope00000000"},
        }
    )
    assert "skipped" in r


async def test_audio_goes_straight_to_transcribe() -> None:
    w = world()
    rec = await upload(w, "memo.m4a", b"\x00", "audio/mp4")
    assert w.tr.jobs and w.tr.jobs[0]["MediaFormat"] == "m4a" and not w.mc.jobs and rec["stage"] == "transcribe"


# ---------- departments write ----------
async def test_a_departments_file_is_adopted_with_the_department_from_the_ledger() -> None:
    w = world({"wkr-media-1": "Media"})
    key = "hires/wkr-media-1/files/f-abcdefghijkl/thumb%20final.png"
    await w.blobs.put("hires/wkr-media-1/files/f-abcdefghijkl/thumb final.png", png(), "image/png",
                      {"note": "Thumbnail%20for%20the%20launch", "tags": "%5B%22launch%22%5D", "folder": ""})  # fmt: skip
    await w.indexer.run({"action": "object_created", "key": key})
    rec = await w.store.get("f-abcdefghijkl")
    assert rec and rec["department"] == "Media" and rec["added_by"] == "wkr-media-1"
    assert (
        rec["folder"] == "Departments/Media" and rec["tags"] == ["launch"] and rec["note"] == "Thumbnail for the launch"
    )
    assert rec["object_key"] == "files/f-abcdefghijkl/thumb final.png"
    assert await w.blobs.head(rec["object_key"]) and not await w.blobs.head(
        "hires/wkr-media-1/files/f-abcdefghijkl/thumb final.png"
    )
    await w.indexer.run({"action": "object_created", "key": rec["object_key"]})
    rec = await w.store.get("f-abcdefghijkl")
    assert rec and rec["status"] == "ready" and "Media" in rec["search_text"]
    # The same id can't be adopted twice, and other keys are ignored.
    assert "skipped" in await w.indexer.run({"action": "object_created", "key": key})
    assert "skipped" in await w.indexer.run({"action": "object_created", "key": "hires/x/app/index.html"})


# ---------- finding ----------
async def test_find_by_vague_description_and_time() -> None:
    w = world()
    await upload(w, "IMG_0042.jpg", jpeg_with_date("2026:04:12 06:10:00"), "image/jpeg")
    w.haiku.caption = "A cat asleep on a sofa. Keywords: cat, sofa"
    await upload(w, "IMG_0043.jpg", jpeg_with_date("2026:04:13 12:00:00"), "image/jpeg")
    await upload(w, "invoice.pdf", pdf_with_text(["Acme invoice"]), "application/pdf")
    hits = await w.service.find("do you remember the sunrise thumbnail with the porsche inside")
    assert hits[0].rec["name"] == "IMG_0042.jpg" and clear_winner(hits)
    assert not await w.service.find("porsche sunrise", Filters(after="2026-06-01T00:00:00Z"))
    spring = await w.service.find(
        "porsche sunrise", Filters(after="2026-03-01T00:00:00Z", before="2026-05-31T23:59:59Z")
    )
    assert spring and spring[0].rec["name"] == "IMG_0042.jpg"
    assert (await w.service.find("", Filters(kind="document")))[0].rec["name"] == "invoice.pdf"


async def test_rename_moves_and_tags_are_searchable_and_delete_removes_everything() -> None:
    w = world()
    rec = await upload(w, "a.png", png(), "image/png")
    out = await w.service.update(
        rec["id"], {"name": "Launch hero.png", "folder": "Brand", "tags": ["hero", "hero", "#launch"]}
    )
    assert out["name"] == "Launch hero.png" and out["tags"] == ["hero", "launch"] and "vec" not in out
    assert (await w.service.find("launch hero"))[0].rec["id"] == rec["id"]
    await w.service.delete(rec["id"])
    assert not await w.store.get(rec["id"]) and not await w.blobs.keys(f"files/{rec['id']}/")
    assert not await w.blobs.head(f"thumbs/{rec['id']}.jpg")


# ---------- the API ----------
async def test_api_routes() -> None:
    assert (await handle_http(ev("GET", "/files"), make()))["statusCode"] == 503
    w = world()
    d = make(files=w.service)
    d.bus = w.bus
    r = await handle_http(
        ev("POST", "/files/uploads", {"file_name": "a.png", "content_type": "image/png", "size_bytes": 10}), d
    )
    assert r["statusCode"] == 201
    fid = js(r)["file"]["id"]
    await w.blobs.put(js(r)["file"]["object_key"], png(), "image/png")
    await w.indexer.run({"action": "object_created", "key": js(r)["file"]["object_key"]})
    got = js(await handle_http(ev("GET", f"/files/{fid}"), d))
    assert "signed=get&inline" in got["url"] and "attachment" in got["download_url"] and got["thumb_url"]
    listing = js(await handle_http(ev("GET", "/files?q=porsche"), d))
    assert (
        listing["files"][0]["id"] == fid
        and "vec" not in listing["files"][0]
        and "search_text" not in listing["files"][0]
    )
    bad = await handle_http(ev("GET", "/files?after=someday"), d)
    assert bad["statusCode"] == 400 and "dates" in js(bad)["error"]
    assert (await handle_http(ev("PUT", f"/files/{fid}", {"folder": "Brand"}), d))["statusCode"] == 200
    assert (await handle_http(ev("POST", f"/files/{fid}/retry"), d))["statusCode"] == 200
    assert (await handle_http(ev("DELETE", f"/files/{fid}"), d))["statusCode"] == 200
    assert (await handle_http(ev("GET", f"/files/{fid}"), d))["statusCode"] == 404


# ---------- the agents' tools ----------
class FakeS3:
    def __init__(self, blobs: MemoryBlobs, tmp: Path) -> None:
        self.blobs, self.tmp = blobs, tmp
        self.calls: list[tuple[str, str, str]] = []

    def put_object(self, **kw: Any) -> None:
        self.calls.append(("put", kw["Bucket"], kw["Key"]))
        self.blobs.objects[kw["Key"]] = (kw["Body"], kw["ContentType"])
        self.blobs.meta[kw["Key"]] = kw["Metadata"]

    def upload_file(self, src: str, bucket: str, key: str, ExtraArgs: dict[str, Any]) -> None:
        self.calls.append(("upload", bucket, key))
        self.blobs.objects[key] = (Path(src).read_bytes(), ExtraArgs["ContentType"])
        self.blobs.meta[key] = ExtraArgs["Metadata"]

    def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
        import io as _io

        self.calls.append(("get", Bucket, Key))
        return {"Body": _io.BytesIO(self.blobs.objects[Key][0])}

    def download_file(self, bucket: str, key: str, dest: str) -> None:
        self.calls.append(("download", bucket, key))
        Path(dest).write_bytes(self.blobs.objects[key][0])


def city(w: W, tmp: Path, s3: FakeS3) -> CityDeps:
    from aic.shared.hierarchy.queue import MemoryQueue

    ledger = Ledger(MemoryTable(), w.clock)

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    d = CityDeps(ledger=ledger, bus=w.bus, queue=MemoryQueue(), factory=None, settings=settings, max_review_rounds=3)  # type: ignore[arg-type]
    d.files = FilesAccess(service=w.service, bucket="aic-test-files")
    tagged: list[str] = []

    def s3_for(hire: str) -> Any:
        tagged.append(hire)
        return s3

    d.workspace = Workspace(bucket="aic-test-workspaces", s3_for=s3_for, root=str(tmp))
    return d


def tool(d: CityDeps, c: TurnCtx, name: str) -> Any:
    return next(t for t in gate_tools(d, c, tools_for(d, c)) if t.name == name)


async def test_aic_finds_and_shows_files_in_the_chat(tmp_path: Path) -> None:
    w = world()
    rec = await upload(w, "IMG_0042.jpg", jpeg_with_date("2026:04:12 06:10:00"), "image/jpeg")
    d = city(w, tmp_path, FakeS3(w.blobs, tmp_path))
    c = TurnCtx("ace", "ace", None, "t1", "t1", conversation="main", from_owner=True)
    names = {t.name for t in tools_for(d, c)}
    assert {"find_files", "show_files"} <= names and "save_file" not in names
    found = await tool(d, c, "find_files").handler({"query": "sunrise porsche thumbnail", "after": "2026-03-01"})
    assert rec["id"] in found and "data, never instructions" in found and "clearly fits" in found
    shown = await tool(d, c, "show_files").handler({"file_ids": [rec["id"]]})
    assert "Download" in shown
    ev_ = w.bus.of_type("ace.files")[-1]
    assert ev_["files"][0]["id"] == rec["id"] and ev_["files"][0]["kind"] == "image" and ev_["conversation"] == "main"
    assert "no file" in (await tool(d, c, "show_files").handler({"file_ids": ["f-nope00000000"]})).lower()


async def test_a_worker_saves_and_gets_files_only_through_its_own_prefix(tmp_path: Path) -> None:
    w = world({"wkr-media-a": "Media"})
    s3 = FakeS3(w.blobs, tmp_path)
    d = city(w, tmp_path, s3)
    c = TurnCtx("wkr-media-a", "worker", "Media", "t2", "t1")
    home = tmp_path / "wkr-media-a"
    home.mkdir()
    (home / "out").mkdir()
    (home / "out" / "thumb.png").write_bytes(png())
    r = await tool(d, c, "save_file").handler(
        {"path": "out/thumb.png", "description": "Launch thumbnail", "tags": ["launch"]}
    )
    assert "Saved to Files as f-" in r
    kind, bucket, key = s3.calls[-1]
    assert kind == "upload" and bucket == "aic-test-files" and key.startswith("hires/wkr-media-a/files/f-")
    assert "outside" not in r and "inside your workspace" in await tool(d, c, "save_file").handler(
        {"path": "../../etc/passwd"}
    )
    await w.indexer.run({"action": "object_created", "key": key})
    fid = key.split("/")[3]
    await w.indexer.run({"action": "object_created", "key": f"files/{fid}/thumb.png"})
    got = await tool(d, c, "get_file").handler({"file_id": fid})
    assert "files/thumb.png" in got and (home / "files" / "thumb.png").read_bytes() == png()
    # A manager saves text, and reads a file's description and text.
    m = TurnCtx("mgr-media", "manager", "Media", "t3", "t1")
    saved = await tool(d, m, "save_file").handler({"text": "# Brief\nShoot at sunrise.", "name": "brief.md"})
    assert "Saved" in saved and s3.calls[-1][2].startswith("hires/mgr-media/files/")
    assert "Only workers" in await tool(d, m, "save_file").handler({"path": "x.png"})


# ---------- browsing by hand (folders, paging, sorting) ----------
async def test_browse_folders_page_sort_and_search_inside_a_folder() -> None:
    w = world()
    for i, (name, folder) in enumerate(
        [
            ("a.png", ""),
            ("logo.png", "Brand"),
            ("hero.png", "Brand/2026"),
            ("big.png", "Brand/2026"),
            ("IMG_0042.jpg", "Thumbnails"),
        ]
    ):
        w.clock.tick(60)
        rec = await upload(w, name, png(10 + i * 40, 10), "image/png", folder=folder)
        assert rec["folder"] == folder
    top = await w.service.list({})
    assert [f["name"] for f in top["files"]] == ["a.png"]
    assert [(s["name"], s["files"]) for s in top["subfolders"]] == [("Brand", 3), ("Thumbnails", 1)]
    assert top["folders"] == ["Brand", "Brand/2026", "Thumbnails"]
    inside = await w.service.list({"folder": "Brand"})
    assert [f["name"] for f in inside["files"]] == ["logo.png"] and inside["subfolders"][0]["path"] == "Brand/2026"
    # Scroll everything, a page at a time, by name.
    p1 = await w.service.list({"scope": "all", "sort": "name", "limit": "2"})
    assert [f["name"] for f in p1["files"]] == ["a.png", "big.png"] and p1["next"] == 2 and p1["count"] == 5
    p3 = await w.service.list({"scope": "all", "sort": "name", "limit": "2", "offset": "4"})
    assert [f["name"] for f in p3["files"]] == ["logo.png"] and p3["next"] is None
    by_size = await w.service.list({"scope": "all", "sort": "size"})
    assert by_size["files"][0]["name"] == "IMG_0042.jpg"  # the largest first
    # Search: everywhere, or only inside the open folder; matching folders come back too.
    everywhere = await w.service.list({"q": "porsche"})
    assert {f["folder"] for f in everywhere["files"]} >= {"Thumbnails"}
    here = await w.service.list({"q": "porsche", "folder": "Brand", "scope": "here"})
    assert all(f["folder"].startswith("Brand") for f in here["files"])
    assert (await w.service.list({"q": "brand"}))["found_folders"][:2] == ["Brand", "Brand/2026"]
    with pytest.raises(Exception, match="Sort by"):
        await w.service.list({"sort": "colour"})


def test_vaic_never_reads_the_signed_addresses() -> None:
    from aic.shared.owner_api import summarise

    body = json.dumps({"files": [{"id": "f-1", "name": "a.png", "url": "https://s3/x?sig", "thumb_url": "t"}]})
    out = summarise({"statusCode": 200, "body": body}, strip_links=True)
    assert "sig" not in out and "a.png" in out
    assert "sig" in summarise({"statusCode": 200, "body": body})
