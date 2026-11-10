"""Describing each file once it lands (docs/FILES.md §5), driven by events rather than a workflow:

- ``object_created`` (S3 → EventBridge): a file under ``files/<id>/`` is described; one under
  ``hires/<hire>/files/<id>/<name>`` (a department wrote it) is adopted into ``files/`` first.
- images: a thumbnail, the date taken (EXIF) and a Claude caption.
- documents and text: their text (scanned PDFs read by Claude) and a description from it.
- audio: Amazon Transcribe (MediaConvert first for formats it can't take), then a description.
- video: one MediaConvert job takes a few frames and the sound; Claude describes the frames, Transcribe the sound.
- ``mediaconvert_done`` and ``transcribe_done`` (their EventBridge state changes) carry a file on.
Then the description, name, folder, tags, who added it and the dates in words are embedded (Titan V2) and the
file is ``ready``. A step that can't describe a file never loses it: it stays findable by name with a plain warning.
"""

from __future__ import annotations

import asyncio
import io
import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import unquote

from ..events import EventBus
from ..knowledge.blobs import Blobs
from ..knowledge.documents import document_text, needs_page_reading, pdf_chunks, pdf_page_texts
from ..knowledge.routing import AUDIO_DIRECT, TRANSCRIBE_FORMAT, extension
from ..knowledge.transcript import transcript_to_text
from ..log import log
from .describe import FilesModel
from .embed import Embedder, pack
from .model import clean_folder, clean_name, clean_tags, file_kind, is_file_id, object_key, readable_image, thumb_key
from .search import search_text
from .service import updated_event
from .store import FilesStore

EXCERPT_CHARS = 2_000
TEXT_READ_MAX_BYTES = 200 * 1024**2
IMAGE_READ_MAX_BYTES = 60 * 1024**2
FRAME_COUNT = 4
THUMB_EDGE = 480
_FILES_KEY = re.compile(r"^files/(f-[\w-]{12})/[^/]+$")
_HIRE_KEY = re.compile(r"^hires/((?:wkr|mgr)-[\w-]{1,80})/files/(f-[\w-]{12})/([^/]+)$")
JOB_PREFIX = "vaic-files-"


@dataclass
class MediaClients:
    mediaconvert: Any = None
    transcribe: Any = None
    mediaconvert_role_arn: str = ""


@dataclass
class Indexer:
    store: FilesStore
    blobs: Blobs
    bus: EventBus
    model: FilesModel | None
    embedder: Embedder | None
    media: MediaClients = field(default_factory=MediaClients)
    agent_department: Callable[[str], Any] | None = None
    """hire id → its department (async), from the ledger; None = unknown."""
    clock_ms: Callable[[], int] = field(default=lambda: int(datetime.now(UTC).timestamp() * 1000))

    async def run(self, event: dict[str, Any]) -> dict[str, Any]:
        action = str(event.get("action", ""))
        if action == "object_created":
            return await self.object_created(str(event.get("key", "")))
        if action == "index":
            return await self.index(str(event.get("file_id", "")))
        if action == "mediaconvert_done":
            return await self.mediaconvert_done(event)
        if action == "transcribe_done":
            return await self.transcribe_done(event)
        raise ValueError(f"unknown action {action!r}")

    # ---------- arrival ----------
    async def object_created(self, key: str) -> dict[str, Any]:
        # The key as S3 wrote it, or URL-encoded (S3 notifications encode it): whichever names a real object.
        keys = list(dict.fromkeys([key, unquote(key.replace("+", " "))]))
        for k in keys:
            m = _FILES_KEY.match(k)
            if m:
                rec = await self.store.get(m.group(1))
                if rec and rec.get("object_key") == k:
                    return await self.index(m.group(1))
        for k in keys:
            h = _HIRE_KEY.match(k)
            if h and await self.blobs.head(k):
                return await self.adopt(k, h.group(1), h.group(2), h.group(3))
        return {"skipped": "not a file"}

    async def adopt(self, key: str, hire: str, file_id: str, name: str) -> dict[str, Any]:
        """A department saved a file into its own ``hires/<hire>/files/`` prefix (the only place IAM lets it
        write): it becomes a file, marked with the department the hire works for (from the ledger, not from
        anything the agent wrote)."""
        if not is_file_id(file_id) or await self.store.get(file_id):
            return {"skipped": "file id already used"}
        head = await self.blobs.head(key)
        if head is None:
            return {"skipped": "gone"}
        meta = head.metadata
        dept = await self.agent_department(hire) if self.agent_department else None
        name = clean_name(name)
        ct = (head.content_type or "application/octet-stream")[:200]
        folder = clean_folder(unquote(meta.get("folder", ""))) or (f"Departments/{dept}" if dept else "Departments")
        try:
            tags = clean_tags(json.loads(unquote(meta.get("tags", "[]"))))
        except ValueError:
            tags = []
        rec = await self.store.create(
            {
                "id": file_id,
                "name": name,
                "kind": file_kind(name, ct),
                "content_type": ct,
                "size_bytes": head.size,
                "folder": folder,
                "tags": tags,
                "note": " ".join(unquote(meta.get("note", "")).split())[:2000],
                "object_key": object_key(file_id, name),
                "added_by": hire,
                "department": dept or "",
                "description": "",
                "status": "processing",
            }
        )
        await self.bus.put(updated_event(rec))
        await self.blobs.copy(key, rec["object_key"])  # its own Object Created event describes it
        await self.blobs.delete(key)
        return {"file_id": file_id, "adopted": True}

    # ---------- describe ----------
    async def index(self, file_id: str) -> dict[str, Any]:
        rec = await self.store.get(file_id)
        if not rec:
            return {"skipped": "no record"}
        head = await self.blobs.head(rec["object_key"])
        if head is None:
            return {"skipped": "object missing"}
        rec = await self._set(
            file_id,
            {"status": "processing", "size_bytes": head.size, "error": None, "warning": None, "upload_id": None},
            announce=True,
        )
        try:
            kind = rec["kind"]
            if kind == "image":
                return await self._image(rec)
            if kind in ("document", "text"):
                return await self._document(rec, head.size)
            if kind == "audio":
                return await self._audio(rec)
            if kind == "video":
                return await self._video(rec)
            return await self.finish(rec, "", warning="This kind of file is found by its name, folder and tags.")
        except Exception as e:
            return await self._failed(rec, e)

    async def _image(self, rec: dict[str, Any]) -> dict[str, Any]:
        if not readable_image(rec["name"]) or rec["size_bytes"] > IMAGE_READ_MAX_BYTES:
            return await self.finish(
                rec,
                "",
                warning="This image format can't be looked at here, so it is found by its name, folder and tags.",
            )
        data = await self.blobs.get(rec["object_key"])
        patch: dict[str, Any] = {}
        try:
            thumb, taken = await asyncio.to_thread(_thumb_and_date, data)
        except (OSError, ValueError):
            return await self.finish(rec, "", warning="This image could not be opened, so it is found by its name.")
        await self.blobs.put(thumb_key(rec["id"]), thumb, "image/jpeg")
        patch["thumb_key"] = thumb_key(rec["id"])
        if taken and rec.get("taken_from") != "owner":
            patch["taken_at"], patch["taken_from"] = taken, "photo"
        rec = await self._set(rec["id"], patch)
        caption = await self._need_model().caption_image(rec["name"], data)
        return await self.finish(rec, caption)

    async def _document(self, rec: dict[str, Any], size: int) -> dict[str, Any]:
        if size > TEXT_READ_MAX_BYTES:
            return await self.finish(rec, "", warning="This file is too large to read, so it is found by its name.")
        data = await self.blobs.get(rec["object_key"])
        text: str | None = None
        if extension(rec["name"]) == ".pdf":
            pages = await asyncio.to_thread(pdf_page_texts, data)
            if needs_page_reading(pages):
                chunks = await asyncio.to_thread(pdf_chunks, data)
                if chunks:
                    first, part = chunks[0]
                    text = await self._need_model().read_pages(rec["name"], first, part)
            else:
                text = "\n\n".join(pages)
        else:
            text = await asyncio.to_thread(document_text, rec["name"], data, rec.get("content_type") or "")
        if not text or not text.strip():
            return await self.finish(
                rec, "", warning="No text could be read from this file, so it is found by its name."
            )
        description = await self._need_model().describe(rec["name"], text)
        return await self.finish(rec, description, excerpt=" ".join(text.split())[:EXCERPT_CHARS])

    # ---------- audio and video ----------
    def _work(self, file_id: str) -> str:
        return f"s3://{self.blobs.bucket}/work/{file_id}"

    async def _audio(self, rec: dict[str, Any]) -> dict[str, Any]:
        if extension(rec["name"]) in AUDIO_DIRECT:
            return await self._transcribe(rec, rec["object_key"])
        return await self._mediaconvert(rec, frames=False, audio=True)

    async def _video(self, rec: dict[str, Any]) -> dict[str, Any]:
        return await self._mediaconvert(rec, frames=True, audio=True)

    async def _mediaconvert(self, rec: dict[str, Any], frames: bool, audio: bool) -> dict[str, Any]:
        groups: list[dict[str, Any]] = []
        if frames:
            groups.append(
                {
                    "Name": "frames",
                    "OutputGroupSettings": {
                        "Type": "FILE_GROUP_SETTINGS",
                        "FileGroupSettings": {"Destination": f"{self._work(rec['id'])}/frames/frame"},
                    },
                    "Outputs": [
                        {
                            "ContainerSettings": {"Container": "RAW"},
                            "Extension": "jpg",
                            "VideoDescription": {
                                "CodecSettings": {
                                    "Codec": "FRAME_CAPTURE",
                                    "FrameCaptureSettings": {
                                        "FramerateNumerator": 1,
                                        "FramerateDenominator": 10,
                                        "MaxCaptures": 12,
                                        "Quality": 80,
                                    },
                                },
                            },
                        }
                    ],
                }
            )
        if audio:
            groups.append(
                {
                    "Name": "audio",
                    "OutputGroupSettings": {
                        "Type": "FILE_GROUP_SETTINGS",
                        "FileGroupSettings": {"Destination": f"{self._work(rec['id'])}/audio"},
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
            )
        inp: dict[str, Any] = {"FileInput": f"s3://{self.blobs.bucket}/{rec['object_key']}"}
        if audio:
            inp["AudioSelectors"] = {"Audio Selector 1": {"DefaultSelection": "DEFAULT"}}
        r = await asyncio.to_thread(
            self.media.mediaconvert.create_job,
            Role=self.media.mediaconvert_role_arn,
            Settings={"Inputs": [inp], "OutputGroups": groups},
            UserMetadata={"component": "files", "file_id": rec["id"], "frames": str(frames), "audio": str(audio)},
            Tags={"Component": "files"},
        )
        job = str(r["Job"]["Id"])
        stage = "media" if frames and audio else "frames" if frames else "audio"
        await self._set(rec["id"], {"mediaconvert_job": job, "stage": stage})
        return {"file_id": rec["id"], "mediaconvert_job": job, "stage": stage}

    async def mediaconvert_done(self, e: dict[str, Any]) -> dict[str, Any]:
        """EventBridge "MediaConvert Job State Change" (COMPLETE or ERROR) for a job this module started."""
        meta = e.get("user_metadata") or {}
        file_id = str(meta.get("file_id", ""))
        rec = await self.store.get(file_id) if is_file_id(file_id) else None
        if not rec or rec.get("mediaconvert_job") != e.get("job_id"):
            return {"skipped": "not the file's current job"}
        try:
            if e.get("status") != "COMPLETE":
                stage = rec.get("stage")
                log("warn", "files.mediaconvert_failed", file=file_id, stage=stage, detail=str(e.get("error"))[:300])
                if stage == "media":  # often a video without sound: try the frames alone
                    return await self._mediaconvert(rec, frames=True, audio=False)
                return await self.finish(
                    rec,
                    "",
                    warning=f"This recording could not be opened ({str(e.get('error') or 'MediaConvert')[:200]}), so it is found by its name.",
                )
            frames_text = ""
            if rec.get("stage") in ("media", "frames"):
                frames_text = await self._frames(rec)
                rec = await self.store.get(file_id) or rec
            if rec.get("stage") in ("media", "audio"):
                await self._set(file_id, {"frames_description": frames_text} if frames_text else {})
                return await self._transcribe(rec, f"work/{file_id}/audio.m4a")
            return await self.finish(rec, frames_text)
        except Exception as err:
            return await self._failed(rec, err)

    async def _frames(self, rec: dict[str, Any]) -> str:
        keys = sorted(k for k in await self.blobs.keys(f"work/{rec['id']}/frames/") if k.endswith(".jpg"))
        if not keys:
            return ""
        step = max(1, len(keys) // FRAME_COUNT)
        picked = keys[::step][:FRAME_COUNT]
        frames = [await self.blobs.get(k) for k in picked]
        thumb, _ = await asyncio.to_thread(_thumb_and_date, frames[0])
        await self.blobs.put(thumb_key(rec["id"]), thumb, "image/jpeg")
        await self._set(rec["id"], {"thumb_key": thumb_key(rec["id"])})
        return await self._need_model().caption_frames(rec["name"], frames)

    async def _transcribe(self, rec: dict[str, Any], media_key: str) -> dict[str, Any]:
        fmt = TRANSCRIBE_FORMAT.get(extension(media_key))
        if not fmt:
            return await self.finish(
                rec, "", warning="This audio format can't be transcribed, so it is found by its name."
            )
        job = f"{JOB_PREFIX}{rec['id']}-{self.clock_ms()}"
        await asyncio.to_thread(
            self.media.transcribe.start_transcription_job,
            TranscriptionJobName=job,
            Media={"MediaFileUri": f"s3://{self.blobs.bucket}/{media_key}"},
            MediaFormat=fmt,
            IdentifyLanguage=True,
            OutputBucketName=self.blobs.bucket,
            OutputKey=f"work/{rec['id']}/transcript.json",
            Tags=[{"Key": "Component", "Value": "files"}],
        )
        await self._set(rec["id"], {"transcribe_job": job, "stage": "transcribe"})
        return {"file_id": rec["id"], "transcribe_job": job}

    async def transcribe_done(self, e: dict[str, Any]) -> dict[str, Any]:
        """EventBridge "Transcribe Job State Change" for a job named ``vaic-files-<id>-<ms>``."""
        job = str(e.get("job_name", ""))
        m = re.match(rf"^{JOB_PREFIX}(f-[\w-]{{12}})-\d+$", job)
        rec = await self.store.get(m.group(1)) if m else None
        if not rec or rec.get("transcribe_job") != job:
            return {"skipped": "not the file's current job"}
        frames = str(rec.get("frames_description") or "")
        try:
            if e.get("status") != "COMPLETED":
                warning = "The speech in this recording could not be transcribed"
                if frames:
                    return await self.finish(rec, frames, warning=warning + "; it is found by what it shows.")
                return await self.finish(rec, "", warning=warning + ", so it is found by its name.")
            raw = await self.blobs.get(f"work/{rec['id']}/transcript.json")
            text = transcript_to_text(raw, rec["name"])
            spoken = re.sub(r"\[\d+:\d\d\]", "", text).strip()
            if len(spoken.split()) < 3 and frames:
                return await self.finish(rec, frames)
            description = await self._need_model().describe(rec["name"], text, frames)
            return await self.finish(rec, description, excerpt=" ".join(text.split())[:EXCERPT_CHARS])
        except Exception as err:
            return await self._failed(rec, err)

    # ---------- end ----------
    async def finish(
        self, rec: dict[str, Any], description: str, warning: str | None = None, excerpt: str = ""
    ) -> dict[str, Any]:
        rec = await self.store.get(rec["id"]) or rec
        merged = {**rec, "description": description}
        text = search_text(merged) + (f"\n{excerpt}" if excerpt else "")
        patch: dict[str, Any] = {
            "description": description,
            "search_text": text,
            "status": "ready",
            "error": None,
            "warning": warning,
            "stage": None,
        }
        if excerpt:
            patch["excerpt"] = excerpt
        if self.embedder:
            patch["vec"] = pack(await self.embedder.embed(text))
        await self._set(rec["id"], patch, announce=True)
        return {"file_id": rec["id"], "status": "ready"}

    async def _failed(self, rec: dict[str, Any], err: BaseException) -> dict[str, Any]:
        """Describing failed (a busy model, a paused city…): the file stays, findable by name, with the reason."""
        why = " ".join(f"{type(err).__name__}: {err}".split())[:400]
        log("warn", "files.describe_failed", file=rec["id"], error=type(err).__name__, detail=why)
        merged = {**rec, "description": ""}
        patch: dict[str, Any] = {
            "status": "failed",
            "error": f"The file is stored, but it couldn't be described ({why}). Use Try again.",
            "search_text": search_text(merged),
            "stage": None,
        }
        try:
            if self.embedder:
                patch["vec"] = pack(await self.embedder.embed(patch["search_text"]))
        except Exception:  # noqa: S110 - the name still matches by keywords
            pass
        await self._set(rec["id"], patch, announce=True)
        return {"file_id": rec["id"], "status": "failed"}

    async def _set(self, file_id: str, patch: dict[str, Any], announce: bool = False) -> dict[str, Any]:
        new = await self.store.update(file_id, patch) if patch else await self.store.get(file_id)
        if new is None:
            raise LookupError(f"no file {file_id}")
        if announce:
            await self.bus.put(updated_event(new))
        return new

    def _need_model(self) -> FilesModel:
        if not self.model:
            raise RuntimeError("no utility model configured")
        return self.model


def _thumb_and_date(data: bytes) -> tuple[bytes, str | None]:
    """A JPEG thumbnail (480 px on the long edge) and the date the photo was taken (EXIF), if it says."""
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(data)) as im:
        taken = _exif_date(im)
        im.seek(0)
        frame = ImageOps.exif_transpose(im) or im
        frame = frame.convert("RGB")
    frame.thumbnail((THUMB_EDGE, THUMB_EDGE))
    buf = io.BytesIO()
    frame.save(buf, "JPEG", quality=82)
    return buf.getvalue(), taken


def _exif_date(im: Any) -> str | None:
    try:
        exif = im.getexif()
        raw = exif.get_ifd(0x8769).get(36867) or exif.get(306)  # DateTimeOriginal, else DateTime
    except Exception:
        return None
    if not raw:
        return None
    try:
        dt = datetime.strptime(str(raw).strip()[:19], "%Y:%m:%d %H:%M:%S").replace(tzinfo=UTC)
    except ValueError:
        return None
    return dt.isoformat().replace("+00:00", "Z") if 1990 <= dt.year <= 2200 else None


def name_of(key: str) -> str:
    return PurePosixPath(key).name
