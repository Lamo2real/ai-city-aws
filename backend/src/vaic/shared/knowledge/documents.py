"""Documents: the PDF text-layer check, page chunks for Haiku, and plain text of a file for the summary."""

from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree as ET

from .fetch import decode_text, html_to_text
from .routing import extension

MIN_CHARS_PER_PAGE = 200
PAGES_PER_CALL = 20
MAX_DOCUMENT_BLOCK_BYTES = int(4.5 * 1024**2)
"""Bedrock Converse takes a document block up to 4.5 MB."""
MAX_NORMALIZED_PART_BYTES = 50 * 1024**2


def pdf_page_texts(data: bytes) -> list[str]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    out: list[str] = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:  # a broken page has no usable text layer
            out.append("")
    return out


def needs_page_reading(page_texts: list[str]) -> bool:
    """True when the text layer is near empty: under 200 characters per page on average."""
    if not page_texts:
        return True
    chars = sum(len(re.sub(r"\s+", "", t)) for t in page_texts)
    return chars / len(page_texts) < MIN_CHARS_PER_PAGE


def pdf_chunks(
    data: bytes, pages_per_chunk: int = PAGES_PER_CALL, max_bytes: int = MAX_DOCUMENT_BLOCK_BYTES
) -> list[tuple[int, bytes]]:
    """The PDF split into (first page number, PDF bytes) parts of at most 20 pages and 4.5 MB.

    A part over 4.5 MB is halved until it fits; a single page that is still too large is left out.
    """
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(data))
    n = len(reader.pages)

    def build(start: int, end: int) -> bytes:
        w = PdfWriter()
        for i in range(start, end):
            w.add_page(reader.pages[i])
        buf = io.BytesIO()
        w.write(buf)
        return buf.getvalue()

    out: list[tuple[int, bytes]] = []

    def add(start: int, end: int) -> None:
        part = build(start, end)
        if len(part) <= max_bytes:
            out.append((start + 1, part))
        elif end - start > 1:
            mid = (start + end) // 2
            add(start, mid)
            add(mid, end)

    for s in range(0, n, pages_per_chunk):
        add(s, min(n, s + pages_per_chunk))
    return out


def split_text(text: str, max_bytes: int = MAX_NORMALIZED_PART_BYTES) -> list[str]:
    """Text parts of at most ``max_bytes`` (UTF-8), cut at paragraph breaks where possible."""
    if len(text.encode()) <= max_bytes:
        return [text]
    parts: list[str] = []
    cur: list[str] = []
    size = 0
    for chunk in re.split(r"(?<=\n\n)", text):
        para = chunk
        b = len(para.encode())
        if size + b > max_bytes and cur:
            parts.append("".join(cur))
            cur, size = [], 0
        while b > max_bytes:  # one huge paragraph: cut by characters
            cut = max_bytes // 4
            parts.append(para[:cut])
            para = para[cut:]
            b = len(para.encode())
        cur.append(para)
        size += b
    if cur:
        parts.append("".join(cur))
    return parts


def _xml_text(xml: bytes, tags: tuple[str, ...]) -> list[str]:
    root = ET.fromstring(xml)  # noqa: S314 - members of an Office zip; no external entities are resolved
    out: list[str] = []
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] in tags and el.text:
            out.append(el.text)
    return out


def docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)  # noqa: S314
    paras: list[str] = []
    for p in root.iter():
        if p.tag.rsplit("}", 1)[-1] == "p":
            paras.append("".join(t.text or "" for t in p.iter() if t.tag.rsplit("}", 1)[-1] == "t"))
    return "\n".join(x for x in paras if x.strip())


def xlsx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        out: list[str] = []
        if "xl/sharedStrings.xml" in names:
            out += _xml_text(z.read("xl/sharedStrings.xml"), ("t",))
        for n in sorted(x for x in names if x.startswith("xl/worksheets/sheet")):
            out += _xml_text(z.read(n), ("t",))
    return "\n".join(out)


def document_text(name: str, data: bytes, content_type: str = "") -> str | None:
    """Plain text of a stored file, for the summary and the graph. None when the format can't be read here."""
    ext = extension(name)
    try:
        if ext in (".txt", ".md", ".csv"):
            return decode_text(data, content_type)
        if ext in (".html", ".htm"):
            title, text = html_to_text(decode_text(data, content_type))
            return f"# {title}\n\n{text}" if title else text
        if ext == ".pdf":
            return "\n\n".join(pdf_page_texts(data))
        if ext == ".docx":
            return docx_text(data)
        if ext == ".xlsx":
            return xlsx_text(data)
    except Exception:
        return None
    return None
