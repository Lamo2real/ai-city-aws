"""Formats and routing (§3): by extension first, then by content type."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath

from .model import Kind

TEXT = {".txt", ".md"}
DOCUMENT = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".html", ".htm"}
IMAGE = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AUDIO_DIRECT = {".mp3", ".m4a", ".wav", ".flac", ".ogg", ".webm", ".amr"}
AUDIO_CONVERT = {".aac", ".aiff", ".aif", ".wma", ".opus", ".caf", ".mka"}
VIDEO = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}

_TYPES: dict[str, Kind] = {
    "text/plain": "text",
    "text/markdown": "text",
    "text/x-markdown": "text",
    "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
    "text/csv": "document",
    "text/html": "document",
    "application/xhtml+xml": "document",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    "image/gif": "image",
}
_EXT_FOR_TYPE = {
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/pdf": ".pdf",
    "text/csv": ".csv",
    "text/html": ".html",
    "application/xhtml+xml": ".html",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}

# Transcribe's MediaFormat for each file it takes directly.
TRANSCRIBE_FORMAT = {
    ".mp3": "mp3",
    ".m4a": "m4a",
    ".mp4": "mp4",
    ".wav": "wav",
    ".flac": "flac",
    ".ogg": "ogg",
    ".webm": "webm",
    ".amr": "amr",
}


@dataclass(frozen=True)
class Route:
    kind: Kind
    convert: bool = False
    """Audio or video that MediaConvert turns into audio before Transcribe."""


def extension(name: str) -> str:
    return PurePosixPath(name.lower()).suffix


def _base_type(content_type: str | None) -> str:
    return (content_type or "").split(";")[0].strip().lower()


def route_file(name: str, content_type: str | None = None) -> Route:
    ext = extension(name)
    ct = _base_type(content_type)
    if ext == ".webm":
        return Route("video", True) if ct.startswith("video/") else Route("audio", False)
    if ext in TEXT:
        return Route("text")
    if ext in DOCUMENT:
        return Route("document")
    if ext in IMAGE:
        return Route("image")
    if ext in AUDIO_DIRECT:
        return Route("audio", False)
    if ext in AUDIO_CONVERT:
        return Route("audio", True)
    if ext in VIDEO:
        return Route("video", True)
    if ct in _TYPES:
        return Route(_TYPES[ct])
    if ct.startswith("audio/"):
        return Route("audio", True)
    if ct.startswith("video/"):
        return Route("video", True)
    return Route("other")


def route_key(raw_key: str, content_type: str | None = None) -> Route:
    """The route for an object under ``raw/<id>/``: ``link.json`` is a link, ``note.md`` pasted text."""
    name = raw_key.rsplit("/", 1)[-1]
    if name == "link.json" and raw_key.count("/") == 2:
        return Route("link")
    return route_file(name, content_type)


def name_for_download(url_path: str, content_type: str | None) -> str:
    """A file name for something fetched from a link, so it can be routed like an upload."""
    base = PurePosixPath(url_path).name or "page"
    ct = _base_type(content_type)
    if extension(base) and route_file(base, ct).kind != "other":
        return base
    return f"{PurePosixPath(base).stem or 'page'}{_EXT_FOR_TYPE.get(ct, '')}"
