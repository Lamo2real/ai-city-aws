"""The knowledge Lambda's steps (§10) end to end on fakes: no AWS, no Bedrock."""

import json
from typing import Any

import pytest

from aic.shared.knowledge.fetch import Fetched, LinkRefused
from aic.shared.knowledge.kb import ConflictException
from aic.shared.knowledge.pipeline import ACTIONS, MediaClients, MediaJobFailed, Pipeline, SyncFailed, plain_error
from knowledge_support import World, pdf_with_text, png, world


class FakeMediaConvert:
    def __init__(self) -> None:
        self.jobs: list[dict[str, Any]] = []
        self.status = "PROGRESSING"

    def create_job(self, **kw: Any) -> dict[str, Any]:
        self.jobs.append(kw)
        return {"Job": {"Id": "mc-1"}}

    def get_job(self, Id: str) -> dict[str, Any]:
        return {"Job": {"Id": Id, "Status": self.status}}


class FakeTranscribe:
    def __init__(self) -> None:
        self.jobs: list[dict[str, Any]] = []
        self.status = "IN_PROGRESS"

    def start_transcription_job(self, **kw: Any) -> dict[str, Any]:
        self.jobs.append(kw)
        return {}

    def get_transcription_job(self, TranscriptionJobName: str) -> dict[str, Any]:
        return {"TranscriptionJob": {"TranscriptionJobStatus": self.status, "FailureReason": "bad audio"}}


def pipeline(w: World, fetched: Fetched | Exception | None = None) -> tuple[Pipeline, FakeMediaConvert, FakeTranscribe]:
    mc, tr = FakeMediaConvert(), FakeTranscribe()

    def fetch(url: str) -> Fetched:
        if isinstance(fetched, Exception):
            raise fetched
        assert fetched is not None
        return fetched

    p = Pipeline(
        store=w.store,
        blobs=w.blobs,
        kb=w.kb,
        bus=w.bus,
        model=w.model,
        media=MediaClients(mediaconvert=mc, transcribe=tr, mediaconvert_role_arn="arn:aws:iam::1:role/mc"),
        fetch=fetch,
        clock_ms=lambda: 1700,
    )
    return p, mc, tr


async def upload(w: World, name: str, body: bytes, ct: str, scope: str = "relevant") -> str:
    r = await w.service.create_upload(
        {"file_name": name, "content_type": ct, "size_bytes": max(1, len(body)), "scope": scope}
    )
    item = r["item"]
    await w.blobs.put(item["raw_key"], body, ct)
    return str(item["id"])


async def step(p: Pipeline, action: str, item_id: str, **extra: Any) -> dict[str, Any]:
    assert action in ACTIONS
    return await p.run({"action": action, "item_id": item_id, **extra})


async def finish(p: Pipeline, item_id: str) -> None:
    await step(p, "enrich", item_id)
    assert (await step(p, "start_sync", item_id))["job_id"]
    assert (await step(p, "check_sync", item_id))["done"]
    assert (await step(p, "finish", item_id))["status"] == "ready"


def meta(w: World, key: str) -> dict[str, Any]:
    return json.loads(w.blobs.objects[f"{key}.metadata.json"][0])


async def test_a_text_document_goes_through_every_step_to_ready() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(
        w, "notes.md", b"# Ada\n\nAda Lovelace wrote about the Analytical Engine.", "text/markdown", "always"
    )
    r = await step(p, "route", i)
    assert r == {"item_id": i, "kind": "text", "convert": False}
    assert (await w.store.require_item(i))["status"] == "processing"
    assert await step(p, "prepare_document", i) == {"item_id": i, "normalized": True}
    key = f"normalized/{i}/notes.md"
    assert w.blobs.objects[key][0].startswith(b"# Ada")
    assert meta(w, key) == {"metadataAttributes": {"item_id": i, "scope": "always", "kind": "text"}}
    await finish(p, i)
    item = await w.store.require_item(i)
    assert item["status"] == "ready" and item["normalized_keys"] == [key]
    assert item["summary"].startswith("A note about Ada") and item["entity_count"] == 2
    assert [e["status"] for e in w.bus.of_type("knowledge.updated")] == ["processing", "ready"]
    ev = w.bus.of_type("knowledge.updated")[-1]
    assert ev == {**ev, "id": i, "scope": "always", "kind": "text", "title": "notes.md"}


async def test_haiku_calls_use_the_utility_model_record_their_cost_and_stay_small() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "notes.txt", b"x " * 200_000, "text/plain")
    await step(p, "route", i)
    await step(p, "prepare_document", i)
    await step(p, "enrich", i)
    call = w.haiku.calls[-1]
    assert call.role == "utility" and call.model.name == "haiku-5-5"
    assert len(call.prompt) < 100_000 * 4 / 2  # far below the 100,000-token tier
    turns = await w.ledger.turns_of("utility")
    assert len(turns) == 1 and turns[0]["kind"] == "utility" and turns[0]["usd"] > 0
    assert w.bus.of_type("cost.update")


async def test_a_pdf_with_a_text_layer_is_copied_as_is_for_the_kb_parser() -> None:
    w = world()
    p, _, _ = pipeline(w)
    pdf = pdf_with_text(["Real text " * 40])
    i = await upload(w, "paper.pdf", pdf, "application/pdf")
    await step(p, "route", i)
    await step(p, "prepare_document", i)
    assert w.blobs.objects[f"normalized/{i}/paper.pdf"][0] == pdf
    assert not [c for c in w.haiku.calls if c.attachments]


async def test_a_scanned_pdf_is_read_by_haiku_in_parts_of_twenty_pages() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "scan.pdf", pdf_with_text(["" for _ in range(25)]), "application/pdf")
    await step(p, "route", i)
    await step(p, "prepare_document", i)
    reads = [c for c in w.haiku.calls if c.attachments]
    assert len(reads) == 2
    doc = reads[0].attachments[0]["document"]
    assert doc["format"] == "pdf" and doc["citations"] == {"enabled": True}
    assert "starts at page 21" in reads[1].prompt
    item = await w.store.require_item(i)
    assert item["normalized_keys"] == [f"normalized/{i}/pages.md"]
    assert b"Scanned words" in w.blobs.objects[f"normalized/{i}/pages.md"][0]


async def test_an_image_is_described_by_haiku_vision() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "board.png", png(), "image/png")
    assert (await step(p, "route", i))["kind"] == "image"
    await step(p, "describe_image", i)
    call = w.haiku.calls[-1]
    assert call.attachments[0]["image"]["format"] == "png"
    out = w.blobs.objects[f"normalized/{i}/image.md"][0].decode()
    assert "Q3 plan" in out and out.startswith("# board.png")


async def test_a_video_goes_through_mediaconvert_and_transcribe() -> None:
    w = world()
    p, mc, tr = pipeline(w)
    i = await upload(w, "talk.mov", b"\x00" * 10, "video/quicktime")
    assert await step(p, "route", i) == {"item_id": i, "kind": "video", "convert": True}
    await step(p, "start_mediaconvert", i)
    job = mc.jobs[0]
    assert job["Role"] == "arn:aws:iam::1:role/mc"
    assert job["Settings"]["Inputs"][0]["FileInput"] == f"s3://{w.blobs.bucket}/raw/{i}/talk.mov"
    assert (
        job["Settings"]["OutputGroups"][0]["OutputGroupSettings"]["FileGroupSettings"]["Destination"]
        == f"s3://{w.blobs.bucket}/work/{i}/audio"
    )
    assert (await step(p, "check_mediaconvert", i))["done"] is False
    mc.status = "COMPLETE"
    assert (await step(p, "check_mediaconvert", i))["done"] is True
    await step(p, "start_transcribe", i)
    t = tr.jobs[0]
    assert t["Media"]["MediaFileUri"] == f"s3://{w.blobs.bucket}/work/{i}/audio.m4a"
    assert t["MediaFormat"] == "m4a" and t["IdentifyLanguage"] is True
    assert t["OutputKey"] == f"work/{i}/transcript.json" and t["TranscriptionJobName"] == f"aic-{i}-1700"
    assert (await step(p, "check_transcribe", i))["done"] is False
    tr.status = "COMPLETED"
    assert (await step(p, "check_transcribe", i))["done"] is True
    await w.blobs.put(
        f"work/{i}/transcript.json",
        json.dumps({"results": {"audio_segments": [{"start_time": "62", "transcript": "Hello."}]}}).encode(),
    )
    await step(p, "transcript_to_text", i)
    assert b"[01:02] Hello." in w.blobs.objects[f"normalized/{i}/transcript.md"][0]


async def test_audio_transcribe_takes_directly_skips_mediaconvert() -> None:
    w = world()
    p, mc, tr = pipeline(w)
    i = await upload(w, "memo.mp3", b"\x00", "audio/mpeg")
    assert (await step(p, "route", i))["convert"] is False
    await step(p, "start_transcribe", i)
    assert tr.jobs[0]["MediaFormat"] == "mp3" and tr.jobs[0]["Media"]["MediaFileUri"].endswith(f"raw/{i}/memo.mp3")
    assert mc.jobs == []


async def test_failed_media_jobs_raise_by_name() -> None:
    w = world()
    p, mc, tr = pipeline(w)
    i = await upload(w, "talk.mov", b"\x00", "video/quicktime")
    await step(p, "start_mediaconvert", i)
    mc.status = "ERROR"
    with pytest.raises(MediaJobFailed):
        await step(p, "check_mediaconvert", i)
    j = await upload(w, "memo.mp3", b"\x00", "audio/mpeg")
    await step(p, "start_transcribe", j)
    tr.status = "FAILED"
    with pytest.raises(MediaJobFailed):
        await step(p, "check_transcribe", j)


async def test_a_web_page_link_becomes_readable_text() -> None:
    w = world()
    page = Fetched(
        "https://example.com/post",
        "text/html; charset=utf-8",
        b"<title>Big Post</title><p>Body text.</p><script>x()</script>",
    )
    p, _, _ = pipeline(w, page)
    item = await w.service.add_link("https://example.com/post")
    i = item["id"]
    assert (await step(p, "route", i))["kind"] == "link"
    assert await step(p, "fetch_link", i) == {"item_id": i, "kind": "link", "convert": False, "normalized": True}
    text = w.blobs.objects[f"normalized/{i}/page.md"][0].decode()
    assert text.startswith("# Big Post") and "Body text." in text and "x()" not in text
    assert (await w.store.require_item(i))["title"] == "Big Post"
    assert meta(w, f"normalized/{i}/page.md")["metadataAttributes"]["kind"] == "link"


async def test_a_pdf_link_is_re_routed_to_the_document_path() -> None:
    w = world()
    pdf = pdf_with_text(["Text " * 80])
    p, _, _ = pipeline(w, Fetched("https://example.com/files/report", "application/pdf", pdf))
    i = (await w.service.add_link("https://example.com/files/report", "Report"))["id"]
    await step(p, "route", i)
    r = await step(p, "fetch_link", i)
    assert r == {"item_id": i, "kind": "document", "convert": False, "normalized": False}
    assert w.blobs.objects[f"work/{i}/fetched/report.pdf"][0] == pdf
    await step(p, "prepare_document", i)
    assert w.blobs.objects[f"normalized/{i}/report.pdf"][0] == pdf


async def test_a_refused_link_fails_with_plain_words() -> None:
    w = world()
    p, _, _ = pipeline(w, LinkRefused("That link points to a private or internal address, so it is not fetched."))
    i = (await w.service.add_link("https://internal.example/"))["id"]
    with pytest.raises(LinkRefused) as err:
        await step(p, "fetch_link", i)
    cause = json.dumps({"errorType": "LinkRefused", "errorMessage": str(err.value)})
    assert await step(p, "fail", i, error={"Error": "LinkRefused", "Cause": cause}) == {
        "item_id": i,
        "status": "failed",
    }
    item = await w.store.require_item(i)
    assert item["status"] == "failed" and "private or internal" in item["error"]
    assert w.bus.of_type("knowledge.updated")[-1]["error"] == item["error"]


def test_unknown_errors_never_leak_details() -> None:
    assert plain_error(
        {"Error": "KeyError", "Cause": json.dumps({"errorType": "KeyError", "errorMessage": "secret path"})}
    ) == ("Something went wrong while processing this item.")
    assert plain_error({"Error": "States.Timeout"}) == "Processing took too long."
    assert plain_error(None) == "Something went wrong while processing this item."


async def test_other_files_are_marked_unsupported() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "archive.zip", b"PK", "application/zip")
    assert (await step(p, "route", i))["kind"] == "other"
    assert (await step(p, "mark_unsupported", i))["status"] == "unsupported"
    item = await w.store.require_item(i)
    assert item["status"] == "unsupported" and "can't be searched" in item["error"]


async def test_start_sync_raises_conflict_by_name_and_a_failed_sync_raises() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "a.txt", b"hello", "text/plain")
    w.kb.busy = True
    with pytest.raises(ConflictException):
        await step(p, "start_sync", i)
    w.kb.busy = False
    await step(p, "start_sync", i)
    w.kb.status = "IN_PROGRESS"
    assert (await step(p, "check_sync", i))["done"] is False
    w.kb.status = "FAILED"
    with pytest.raises(SyncFailed):
        await step(p, "check_sync", i)


async def test_enrich_survives_bad_json_twice_with_a_warning_and_retries_once() -> None:
    w = world()
    p, _, _ = pipeline(w)
    i = await upload(w, "a.txt", b"hello world", "text/plain")
    await step(p, "prepare_document", i)
    w.haiku.replies["summary"] = ["not json", "still not json"]
    await step(p, "enrich", i)
    item = await w.store.require_item(i)
    assert "summary could not be made" in item["warning"] and not item.get("summary")
    assert len(w.haiku.calls) == 2


async def test_unknown_actions_and_items_are_refused() -> None:
    w = world()
    p, _, _ = pipeline(w)
    with pytest.raises(ValueError):
        await p.run({"action": "set", "item_id": "k-x"})
    with pytest.raises(LookupError):
        await p.run({"action": "route", "item_id": "k-missingmissin"})
    assert (await p.run({"action": "fail", "item_id": "k-missingmissin"}))["status"] == "gone"


def test_the_lambda_handler_dispatches_every_action_name_and_refuses_others(monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    from aic.lambdas import knowledge as lam

    w = world()
    p, _, _ = pipeline(w)
    monkeypatch.setattr(lam, "_pipeline", p)
    i = asyncio.run(upload(w, "a.txt", b"hello", "text/plain"))
    assert lam.handler({"action": "route", "item_id": i}) == {"item_id": i, "kind": "text", "convert": False}
    assert lam.handler({"action": "mark_unsupported", "item_id": i})["status"] == "unsupported"
    with pytest.raises(ValueError):
        lam.handler({"action": "_set", "item_id": i})
    assert set(ACTIONS) == {
        "route", "fetch_link", "prepare_document", "describe_image", "start_mediaconvert", "check_mediaconvert",
        "start_transcribe", "check_transcribe", "transcript_to_text", "enrich", "start_sync", "check_sync",
        "finish", "fail", "mark_unsupported",
    }  # fmt: skip


class FakeSfn:
    def __init__(self) -> None:
        self.runs: dict[str, dict[str, Any]] = {}

    def start_execution(self, **kw: Any) -> dict[str, Any]:
        if kw["name"] in self.runs:
            raise type("ExecutionAlreadyExists", (Exception,), {})("exists")
        self.runs[kw["name"]] = kw
        return {"executionArn": "arn:x"}


def test_start_names_the_run_after_the_item_once_and_ignores_other_keys() -> None:
    from aic.lambdas.knowledge import start_run

    sfn = FakeSfn()
    ev = {"action": "start", "bucket": "aic-prod-knowledge", "key": "raw/k-abcDEF123_-x/My video.mov"}
    assert start_run(ev, sfn, "arn:sm") == {"item_id": "k-abcDEF123_-x", "started": True}
    assert sfn.runs["k-abcDEF123_-x"]["stateMachineArn"] == "arn:sm"
    assert json.loads(sfn.runs["k-abcDEF123_-x"]["input"]) == {"item_id": "k-abcDEF123_-x"}
    assert start_run(ev, sfn, "arn:sm")["reason"] == "already ran"
    for key in ("raw/k-short/a.txt", "work/k-abcDEF123_-x/a.m4a", "raw/k-abcDEF123_-x/sub/a.txt", "raw/../x"):
        assert start_run({"action": "start", "key": key}, sfn, "arn:sm")["started"] is False
    assert len(sfn.runs) == 1


def test_start_lets_other_errors_through() -> None:
    from aic.lambdas.knowledge import start_run

    class Broken:
        def start_execution(self, **kw: Any) -> None:
            raise RuntimeError("AccessDenied")

    with pytest.raises(RuntimeError):
        start_run({"key": "raw/k-abcDEF123_-x/a.txt"}, Broken(), "arn:sm")
