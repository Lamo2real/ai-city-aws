"""The ingest pipeline's steps (§10). Step Functions calls the knowledge Lambda once per step with
``{"action": …, "item_id": …}``; each step reads the item record, does one thing and returns a small dict.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlsplit

from ..events import EventBus
from ..log import log
from .blobs import Blobs
from .documents import (
    MAX_NORMALIZED_PART_BYTES,
    document_text,
    needs_page_reading,
    pdf_chunks,
    pdf_page_texts,
    split_text,
)
from .fetch import Fetched, decode_text, fetch_link, html_to_text
from .haiku import KnowledgeModel
from .kb import KnowledgeBase
from .model import metadata_doc
from .routing import TRANSCRIBE_FORMAT, extension, name_for_download, route_file, route_key
from .service import updated_event
from .store import KnowledgeStore
from .transcript import transcript_to_text

TEXT_FOR_SUMMARY_CHARS = 160_000
ACTIONS = (
    "route",
    "fetch_link",
    "prepare_document",
    "describe_image",
    "start_mediaconvert",
    "check_mediaconvert",
    "start_transcribe",
    "check_transcribe",
    "transcript_to_text",
    "enrich",
    "start_sync",
    "check_sync",
    "finish",
    "fail",
    "mark_unsupported",
)


class MediaJobFailed(RuntimeError):
    pass


class SyncFailed(RuntimeError):
    pass


class Unsupported(RuntimeError):
    pass


@dataclass
class MediaClients:
    """boto3 ``mediaconvert`` and ``transcribe`` clients, and the role MediaConvert runs with."""

    mediaconvert: Any = None
    transcribe: Any = None
    mediaconvert_role_arn: str = ""


@dataclass
class Pipeline:
    store: KnowledgeStore
    blobs: Blobs
    kb: KnowledgeBase
    bus: EventBus
    model: KnowledgeModel | None
    media: MediaClients = field(default_factory=MediaClients)
    fetch: Callable[[str], Fetched] = fetch_link
    clock_ms: Callable[[], int] = field(default=lambda: int(time.time() * 1000))

    async def run(self, event: dict[str, Any]) -> dict[str, Any]:
        action = str(event.get("action", ""))
        if action not in ACTIONS:
            raise ValueError(f"unknown action {action!r}")
        step: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]] = getattr(self, f"_{action}")
        item_id = str(event.get("item_id", ""))
        if action == "fail":
            return await self._fail_item(item_id, event.get("error"))
        item = await self.store.require_item(item_id)
        out = await step({**event, "item": item})
        return {"item_id": item_id, **out}

    # ---------- helpers ----------
    async def _set(self, item_id: str, patch: dict[str, Any], announce: bool = False) -> dict[str, Any]:
        new = await self.store.update_item(item_id, patch)
        if new is None:
            raise LookupError(f"no knowledge item {item_id}")
        if announce:
            await self.bus.put(updated_event(new))
        return new

    def _source_key(self, item: dict[str, Any]) -> str:
        return str(item.get("work_key") or item["raw_key"])

    async def _write_normalized(self, item: dict[str, Any], files: list[tuple[str, bytes, str]]) -> dict[str, Any]:
        """Writes ``normalized/<id>/<name>`` + its ``.metadata.json`` for each file, replacing older ones."""
        item_id = item["id"]
        await self.blobs.delete_prefix(f"normalized/{item_id}/")
        keys: list[str] = []
        meta = json.dumps(metadata_doc(item_id, item["scope"], item["kind"])).encode()
        for name, body, ct in files:
            key = f"normalized/{item_id}/{name}"
            await self.blobs.put(key, body, ct)
            await self.blobs.put(f"{key}.metadata.json", meta, "application/json")
            keys.append(key)
        return await self._set(item_id, {"normalized_keys": keys})

    async def _write_text(self, item: dict[str, Any], stem: str, text: str) -> dict[str, Any]:
        parts = split_text(text, MAX_NORMALIZED_PART_BYTES)
        names = [f"{stem}.md"] if len(parts) == 1 else [f"{stem}-part{n}.md" for n in range(1, len(parts) + 1)]
        return await self._write_normalized(
            item, [(n, p.encode(), "text/markdown; charset=utf-8") for n, p in zip(names, parts, strict=True)]
        )

    def _need_model(self) -> KnowledgeModel:
        if not self.model:
            raise RuntimeError("no utility model configured")
        return self.model

    # ---------- route ----------
    async def _route(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        head = await self.blobs.head(item["raw_key"])
        r = route_key(item["raw_key"], (head.content_type if head else None) or item.get("content_type"))
        patch: dict[str, Any] = {"status": "processing", "kind": r.kind, "error": None, "warning": None}
        if head:
            patch["size_bytes"] = head.size
        await self._set(item["id"], patch, announce=True)
        return {"kind": r.kind, "convert": r.convert}

    async def _fetch_link(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        url = json.loads(await self.blobs.get(item["raw_key"]))["url"]
        got = await asyncio.to_thread(self.fetch, url)  # LinkRefused carries plain words to ``fail``
        ct = got.content_type.split(";")[0].strip().lower()
        name = name_for_download(urlsplit(got.url).path, ct)
        r = route_file(name, ct)
        if r.kind in ("document", "text") and ct in ("text/html", "application/xhtml+xml", "text/plain", ""):
            body = decode_text(got.body, got.content_type)
            title, text = ("", body) if ct == "text/plain" else html_to_text(body)
            new_title = item["title"] if item["title"] != url or not title else title[:200]
            item = await self._set(item["id"], {"title": new_title, "content_type": ct or "text/html"})
            await self._write_text(item, "page", f"# {new_title}\n\nSource: {got.url}\n\n{text}")
            return {"kind": "link", "convert": False, "normalized": True}
        key = f"work/{item['id']}/fetched/{name}"
        await self.blobs.put(key, got.body, ct or "application/octet-stream")
        await self._set(item["id"], {"work_key": key, "content_type": ct, "size_bytes": len(got.body)})
        return {"kind": r.kind, "convert": r.convert, "normalized": False}

    # ---------- documents and text ----------
    async def _prepare_document(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        src = self._source_key(item)
        name = PurePosixPath(src).name
        ext = extension(name)
        head = await self.blobs.head(src)
        size = head.size if head else 0
        if ext == ".pdf":
            data = await self.blobs.get(src)
            pages = await asyncio.to_thread(pdf_page_texts, data)
            if needs_page_reading(pages):
                await self._read_scanned_pdf(item, data)
                return {"normalized": True}
            if size > MAX_NORMALIZED_PART_BYTES:
                await self._write_text(item, PurePosixPath(name).stem, "\n\n".join(pages))
                return {"normalized": True}
        elif size > MAX_NORMALIZED_PART_BYTES:
            if ext in (".txt", ".md", ".csv", ".html", ".htm"):
                text = document_text(name, await self.blobs.get(src), (head.content_type if head else "") or "")
                if text is not None:
                    await self._write_text(item, PurePosixPath(name).stem, text)
                    return {"normalized": True}
            raise Unsupported("This file is over 50 MB. Save it as a PDF or split it, then add it again.")
        dst = f"normalized/{item['id']}/{name}"
        await self.blobs.delete_prefix(f"normalized/{item['id']}/")
        await self.blobs.copy(src, dst)
        await self.blobs.put(
            f"{dst}.metadata.json",
            json.dumps(metadata_doc(item["id"], item["scope"], item["kind"])).encode(),
            "application/json",
        )
        await self._set(item["id"], {"normalized_keys": [dst]})
        return {"normalized": True}

    async def _read_scanned_pdf(self, item: dict[str, Any], data: bytes) -> None:
        model = self._need_model()
        chunks = await asyncio.to_thread(pdf_chunks, data)
        if not chunks:
            raise Unsupported("The pages of this PDF are too large to read.")
        texts = [await model.read_pages(item["title"], first, part) for first, part in chunks]
        await self._write_text(item, "pages", f"# {item['title']}\n\n" + "\n\n".join(texts))

    # ---------- images ----------
    async def _describe_image(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        data = await self.blobs.get(self._source_key(item))
        try:
            text = await self._need_model().describe_image(item["title"], data)
        except (OSError, ValueError) as err:  # Pillow can't open it
            raise Unsupported("This image could not be opened.") from err
        await self._write_text(item, "image", f"# {item['title']}\n\n{text}")
        return {"normalized": True}

    # ---------- audio and video ----------
    def _audio_key(self, item_id: str) -> str:
        return f"work/{item_id}/audio.m4a"

    async def _start_mediaconvert(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        bucket = self.blobs.bucket
        settings = {
            "Inputs": [
                {
                    "FileInput": f"s3://{bucket}/{self._source_key(item)}",
                    "AudioSelectors": {"Audio Selector 1": {"DefaultSelection": "DEFAULT"}},
                }
            ],
            "OutputGroups": [
                {
                    "Name": "audio",
                    "OutputGroupSettings": {
                        "Type": "FILE_GROUP_SETTINGS",
                        "FileGroupSettings": {"Destination": f"s3://{bucket}/work/{item['id']}/audio"},
                    },
                    "Outputs": [
                        {
                            "ContainerSettings": {"Container": "MP4"},
                            "Extension": "m4a",
                            "AudioDescriptions": [
                                {
                                    "AudioSourceName": "Audio Selector 1",
                                    "CodecSettings": {
                                        "Codec": "AAC",
                                        "AacSettings": {
                                            "Bitrate": 96000,
                                            "CodingMode": "CODING_MODE_2_0",
                                            "SampleRate": 48000,
                                        },
                                    },
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        r = await asyncio.to_thread(
            self.media.mediaconvert.create_job,
            Role=self.media.mediaconvert_role_arn,
            Settings=settings,
            Tags={"Component": "knowledge"},
        )
        job_id = str(r["Job"]["Id"])
        await self._set(item["id"], {"mediaconvert_job": job_id})
        return {"job_id": job_id}

    async def _check_mediaconvert(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        r = await asyncio.to_thread(self.media.mediaconvert.get_job, Id=item["mediaconvert_job"])
        status = r["Job"]["Status"]
        if status in ("ERROR", "CANCELED"):
            raise MediaJobFailed("The audio could not be taken out of this file.")
        if status == "COMPLETE":
            await self._set(item["id"], {"audio_key": self._audio_key(item["id"])})
            return {"done": True}
        return {"done": False}

    async def _start_transcribe(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        media_key = item.get("audio_key") or self._source_key(item)
        fmt = TRANSCRIBE_FORMAT.get(extension(media_key))
        if not fmt:
            raise Unsupported("Transcribe can't read this audio format.")
        job = f"aic-{item['id']}-{self.clock_ms()}"
        await asyncio.to_thread(
            self.media.transcribe.start_transcription_job,
            TranscriptionJobName=job,
            Media={"MediaFileUri": f"s3://{self.blobs.bucket}/{media_key}"},
            MediaFormat=fmt,
            IdentifyLanguage=True,
            OutputBucketName=self.blobs.bucket,
            OutputKey=f"work/{item['id']}/transcript.json",
            Tags=[{"Key": "Component", "Value": "knowledge"}],
        )
        await self._set(item["id"], {"transcribe_job": job})
        return {"job_id": job}

    async def _check_transcribe(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        r = await asyncio.to_thread(
            self.media.transcribe.get_transcription_job, TranscriptionJobName=item["transcribe_job"]
        )
        job = r["TranscriptionJob"]
        if job["TranscriptionJobStatus"] == "FAILED":
            log("warn", "knowledge.transcribe_failed", item=item["id"], reason=str(job.get("FailureReason", ""))[:200])
            raise MediaJobFailed("The speech in this file could not be transcribed.")
        return {"done": job["TranscriptionJobStatus"] == "COMPLETED"}

    async def _transcript_to_text(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        raw = await self.blobs.get(f"work/{item['id']}/transcript.json")
        await self._write_text(item, "transcript", transcript_to_text(raw, item["title"]))
        return {"normalized": True}

    # ---------- summary + graph ----------
    async def _item_text(self, item: dict[str, Any]) -> str | None:
        texts: list[str] = []
        for key in item.get("normalized_keys") or []:
            head = await self.blobs.head(key)
            if head and head.size > 200 * 1024**2:
                continue
            t = document_text(
                key.rsplit("/", 1)[-1], await self.blobs.get(key), (head.content_type if head else "") or ""
            )
            if t:
                texts.append(t)
            if sum(len(x) for x in texts) >= TEXT_FOR_SUMMARY_CHARS:
                break
        joined = "\n\n".join(texts).strip()
        return joined[:TEXT_FOR_SUMMARY_CHARS] or None

    async def _enrich(self, e: dict[str, Any]) -> dict[str, Any]:
        item = e["item"]
        text = await self._item_text(item)
        if not text:
            await self._set(
                item["id"], {"warning": "No summary: this format can't be read for one. It is still searchable."}
            )
            return {}
        try:
            ex = await self._need_model().summarize(item["title"], text)
        except ValueError:
            await self._set(item["id"], {"warning": "The summary could not be made. The item is still searchable."})
            return {}
        await self._set(item["id"], {"summary": ex.summary})
        await self.store.write_graph(item["id"], ex)
        return {}

    # ---------- sync and end ----------
    async def _start_sync(self, e: dict[str, Any]) -> dict[str, Any]:
        job_id = await self.kb.start_sync()  # ConflictException propagates by name; the pipeline retries it
        await self._set(e["item"]["id"], {"sync_job": job_id})
        return {"job_id": job_id}

    async def _check_sync(self, e: dict[str, Any]) -> dict[str, Any]:
        status = await self.kb.sync_status(str(e["item"]["sync_job"]))
        if status in ("FAILED", "STOPPED", "STOPPING"):
            raise SyncFailed("The knowledge base could not take this item in.")
        return {"done": status == "COMPLETE"}

    async def _finish(self, e: dict[str, Any]) -> dict[str, Any]:
        await self._set(e["item"]["id"], {"status": "ready", "error": None}, announce=True)
        return {"status": "ready"}

    async def _mark_unsupported(self, e: dict[str, Any]) -> dict[str, Any]:
        await self._set(
            e["item"]["id"],
            {"status": "unsupported", "error": "This kind of file is stored but can't be searched."},
            announce=True,
        )
        return {"status": "unsupported"}

    async def _fail(self, e: dict[str, Any]) -> dict[str, Any]:  # dispatched in run()
        return await self._fail_item(e["item"]["id"], e.get("error"))

    async def _fail_item(self, item_id: str, error: Any) -> dict[str, Any]:
        if not await self.store.get_item(item_id):
            return {"item_id": item_id, "status": "gone"}
        await self._set(item_id, {"status": "failed", "error": plain_error(error)}, announce=True)
        return {"item_id": item_id, "status": "failed"}


_OURS = ("LinkRefused", "MediaJobFailed", "SyncFailed", "Unsupported")


def plain_error(error: Any) -> str:
    """The Step Functions error as plain words. Our own errors carry them; anything else gets a general line."""
    if not isinstance(error, dict):
        return "Something went wrong while processing this item."
    name = str(error.get("Error", ""))
    cause = error.get("Cause")
    msg = ""
    if isinstance(cause, str):
        try:
            c = json.loads(cause)
            msg = str(c.get("errorMessage", "")) if isinstance(c, dict) else ""
            name = str(c.get("errorType", name)) if isinstance(c, dict) else name
        except ValueError:
            msg = cause
    if name in _OURS and msg:
        return msg[:300]
    if name == "States.Timeout":
        return "Processing took too long."
    if name == "ConflictException":
        return "The knowledge base was busy for too long. Add the item again."
    return "Something went wrong while processing this item."
