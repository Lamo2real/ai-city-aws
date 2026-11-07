"""Routing, the link-fetch address guard, PDFs, documents, images and transcripts (docs/KNOWLEDGE.md §3, §12)."""

import io
import json
import zipfile

import pytest

from aic.shared.knowledge.documents import (
    document_text,
    needs_page_reading,
    pdf_chunks,
    pdf_page_texts,
    split_text,
)
from aic.shared.knowledge.fetch import (
    LinkRefused,
    RawResponse,
    address_allowed,
    check_url,
    fetch_link,
    html_to_text,
)
from aic.shared.knowledge.haiku import MAX_IMAGE_EDGE, fit_image
from aic.shared.knowledge.model import entity_key, new_item_id, safe_file_name
from aic.shared.knowledge.routing import name_for_download, route_file, route_key
from aic.shared.knowledge.transcript import stamp, transcript_to_text
from knowledge_support import pdf_with_text, png


# ---------- routing table ----------
@pytest.mark.parametrize(
    ("name", "ct", "kind", "convert"),
    [
        ("notes.txt", None, "text", False),
        ("README.MD", None, "text", False),
        ("report.pdf", None, "document", False),
        ("plan.docx", None, "document", False),
        ("old.doc", None, "document", False),
        ("sheet.xlsx", None, "document", False),
        ("sheet.xls", None, "document", False),
        ("data.csv", None, "document", False),
        ("page.htm", None, "document", False),
        ("photo.JPG", None, "image", False),
        ("diagram.webp", None, "image", False),
        ("anim.gif", None, "image", False),
        ("talk.mp3", None, "audio", False),
        ("memo.m4a", None, "audio", False),
        ("voice.amr", None, "audio", False),
        ("clip.webm", "audio/webm", "audio", False),
        ("clip.webm", "video/webm", "video", True),
        ("song.aac", None, "audio", True),
        ("song.aiff", None, "audio", True),
        ("song.wma", None, "audio", True),
        ("movie.mp4", None, "video", True),
        ("movie.mov", None, "video", True),
        ("movie.mkv", None, "video", True),
        ("movie.avi", None, "video", True),
        ("archive.zip", None, "other", False),
        ("noext", "application/pdf", "document", False),
        ("noext", "text/markdown", "text", False),
        ("noext", "image/png", "image", False),
        ("noext", "audio/x-something", "audio", True),
        ("noext", "video/x-something", "video", True),
        ("noext", "application/octet-stream", "other", False),
        ("noext", None, "other", False),
    ],
)
def test_routes_by_extension_then_content_type(name: str, ct: str | None, kind: str, convert: bool) -> None:
    r = route_file(name, ct)
    assert (r.kind, r.convert) == (kind, convert)


def test_raw_keys_for_links_and_pasted_text() -> None:
    assert route_key("raw/k-aaaaaaaaaaaa/link.json").kind == "link"
    assert route_key("raw/k-aaaaaaaaaaaa/note.md").kind == "text"
    assert route_key("raw/k-aaaaaaaaaaaa/sub/link.json").kind != "link"


def test_names_downloads_so_they_route_like_uploads() -> None:
    assert name_for_download("/files/report", "application/pdf") == "report.pdf"
    assert name_for_download("/a/b.pdf", "application/pdf") == "b.pdf"
    assert name_for_download("/", "text/html") == "page.html"
    assert name_for_download("/talk", "audio/mpeg") == "talk.mp3"


def test_ids_keys_and_file_names() -> None:
    i = new_item_id()
    assert i.startswith("k-") and len(i) == 14
    assert entity_key("  Ada   Lovelace ") == "ada-lovelace"
    assert entity_key("A#B") == "ab"
    assert len(entity_key("x" * 200)) == 80
    assert safe_file_name("../../etc/passwd") == "passwd"
    assert safe_file_name("C:\\Users\\me\\cv.pdf") == "cv.pdf"
    assert safe_file_name("x.metadata.json") == "x.json"
    assert safe_file_name("...") == "file"


# ---------- link-fetch address guard ----------
@pytest.mark.parametrize(
    "addr",
    [
        "127.0.0.1",
        "10.1.2.3",
        "172.16.0.9",
        "192.168.1.1",
        "169.254.169.254",
        "169.254.0.1",
        "100.64.0.1",
        "0.0.0.0",  # noqa: S104
        "224.0.0.1",
        "::1",
        "fd00::1",
        "fd00:ec2::254",
        "fe80::1",
        "fc00::1",
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
        "not-an-ip",
    ],
)
def test_refuses_private_loopback_link_local_and_metadata_addresses(addr: str) -> None:
    assert not address_allowed(addr)


@pytest.mark.parametrize("addr", ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])
def test_allows_public_addresses(addr: str) -> None:
    assert address_allowed(addr)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/x",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://user:pw@example.com/",
        "https://user@example.com/",
        "http://",
        "",
        "https://example.com:99999/",
        "https://" + "a" * 3000 + ".com/",
    ],
)
def test_refuses_other_schemes_credentials_and_broken_urls(url: str) -> None:
    with pytest.raises(LinkRefused):
        check_url(url)


class Script:
    """A fake network: a resolver and a transport answering from a table, keeping each request."""

    def __init__(self, dns: dict[str, list[str]], pages: dict[str, RawResponse]) -> None:
        self.dns = dns
        self.pages = pages
        self.requests: list[tuple[str, str, str]] = []

    def resolve(self, host: str, port: int) -> list[str]:
        if host not in self.dns:
            raise OSError("no such host")
        return self.dns[host]

    def transport(
        self, scheme: str, host: str, ip: str, port: int, path: str, timeout: float, max_bytes: int
    ) -> RawResponse:
        self.requests.append((host, ip, path))
        return self.pages[f"{scheme}://{host}{path}"]


def test_fetches_a_public_page_and_connects_to_the_checked_address() -> None:
    s = Script(
        {"example.com": ["93.184.216.34"]},
        {"https://example.com/a": RawResponse(200, {"content-type": "text/html"}, b"<p>hi</p>")},
    )
    got = fetch_link("https://example.com/a", s.resolve, s.transport)
    assert got.body == b"<p>hi</p>" and got.content_type == "text/html"
    assert s.requests == [("example.com", "93.184.216.34", "/a")]


def test_refuses_a_name_that_resolves_to_any_private_address() -> None:
    s = Script({"evil.example": ["93.184.216.34", "10.0.0.5"]}, {})
    with pytest.raises(LinkRefused, match="private or internal"):
        fetch_link("https://evil.example/", s.resolve, s.transport)
    assert s.requests == []


def test_refuses_literal_metadata_address_without_asking_dns() -> None:
    s = Script({}, {})
    with pytest.raises(LinkRefused):
        fetch_link("http://169.254.169.254/latest/meta-data/", s.resolve, s.transport)
    with pytest.raises(LinkRefused):
        fetch_link("http://[fd00:ec2::254]/", s.resolve, s.transport)


def test_rechecks_every_redirect_and_refuses_one_to_an_internal_host() -> None:
    s = Script(
        {"example.com": ["93.184.216.34"], "internal.example": ["192.168.0.10"]},
        {"https://example.com/go": RawResponse(302, {"location": "http://internal.example/admin"}, b"")},
    )
    with pytest.raises(LinkRefused, match="private"):
        fetch_link("https://example.com/go", s.resolve, s.transport)
    assert len(s.requests) == 1


def test_follows_relative_redirects_up_to_five_times() -> None:
    pages = {f"https://example.com/{i}": RawResponse(301, {"location": f"/{i + 1}"}, b"") for i in range(6)}
    pages["https://example.com/5"] = RawResponse(200, {"content-type": "text/plain"}, b"end")
    s = Script({"example.com": ["93.184.216.34"]}, pages)
    assert fetch_link("https://example.com/0", s.resolve, s.transport).body == b"end"
    pages["https://example.com/5"] = RawResponse(301, {"location": "/6"}, b"")
    with pytest.raises(LinkRefused, match="more than 5"):
        fetch_link("https://example.com/0", s.resolve, s.transport)


def test_refuses_a_redirect_to_another_scheme_and_error_statuses() -> None:
    s = Script(
        {"example.com": ["93.184.216.34"]},
        {
            "https://example.com/a": RawResponse(302, {"location": "file:///etc/passwd"}, b""),
            "https://example.com/b": RawResponse(404, {}, b""),
        },
    )
    with pytest.raises(LinkRefused, match="http and https"):
        fetch_link("https://example.com/a", s.resolve, s.transport)
    with pytest.raises(LinkRefused, match="404"):
        fetch_link("https://example.com/b", s.resolve, s.transport)


def test_stops_when_the_time_is_up() -> None:
    t = iter([0.0, 31.0])
    s = Script({"example.com": ["93.184.216.34"]}, {})
    with pytest.raises(LinkRefused, match="30 seconds"):
        fetch_link("https://example.com/", s.resolve, s.transport, clock=lambda: next(t))


def test_html_to_readable_text_drops_scripts_and_navigation() -> None:
    title, text = html_to_text(
        "<html><head><title>My  Page</title><script>steal()</script></head><body><nav>Menu</nav>"
        "<h1>Hello</h1><p>First &amp; second.</p><ul><li>one</li><li>two</li></ul><footer>f</footer></body></html>"
    )
    assert title == "My Page"
    assert "# Hello" in text and "First & second." in text and "- one" in text
    assert "steal" not in text and "Menu" not in text


# ---------- PDF text-layer check ----------
def test_a_pdf_with_a_real_text_layer_is_not_sent_for_page_reading() -> None:
    pdf = pdf_with_text(["A" * 300, "B" * 250])
    pages = pdf_page_texts(pdf)
    assert len(pages) == 2 and "AAAA" in pages[0]
    assert not needs_page_reading(pages)


def test_a_pdf_with_a_near_empty_text_layer_is_read_by_haiku() -> None:
    assert needs_page_reading(pdf_page_texts(pdf_with_text(["page 1", "", "x" * 100])))
    assert needs_page_reading([])
    assert needs_page_reading(["  \n\n  " * 300])


def test_pdf_chunks_have_at_most_twenty_pages() -> None:
    pdf = pdf_with_text([f"p{i}" for i in range(45)])
    chunks = pdf_chunks(pdf)
    assert [first for first, _ in chunks] == [1, 21, 41]
    from pypdf import PdfReader

    assert [len(PdfReader(io.BytesIO(c)).pages) for _, c in chunks] == [20, 20, 5]


def test_pdf_chunks_halve_until_they_fit_the_block_limit() -> None:
    pdf = pdf_with_text(["x" * 100 for _ in range(8)])
    one_page = len(pdf_chunks(pdf, 1)[0][1])
    chunks = pdf_chunks(pdf, 8, max_bytes=one_page * 2 + 200)
    assert sum(1 for _ in chunks) > 1 and chunks[0][0] == 1


def test_split_text_keeps_parts_under_the_limit() -> None:
    text = "\n\n".join("para " * 50 for _ in range(100))
    parts = split_text(text, 1000)
    assert all(len(p.encode()) <= 1000 for p in parts)
    assert "".join(parts) == text
    assert split_text("short", 1000) == ["short"]


def test_document_text_reads_docx_xlsx_html_and_csv() -> None:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            "<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p><w:p><w:r><w:t>Two</w:t></w:r></w:p>"
            "</w:body></w:document>",
        )
    assert document_text("a.docx", buf.getvalue()) == "Hello world\nTwo"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", '<sst xmlns="x"><si><t>Revenue</t></si></sst>')
        z.writestr(
            "xl/worksheets/sheet1.xml", '<worksheet xmlns="x"><c t="inlineStr"><is><t>Q3</t></is></c></worksheet>'
        )
    assert document_text("a.xlsx", buf.getvalue()) == "Revenue\nQ3"
    assert document_text("a.html", b"<title>T</title><p>Body</p>") == "# T\n\nBody"
    assert document_text("a.csv", b"a,b\n1,2") == "a,b\n1,2"
    assert document_text("a.doc", b"\xd0\xcf") is None
    assert document_text("a.docx", b"not a zip") is None


# ---------- images ----------
def test_small_images_go_as_they_are_and_large_ones_are_resized() -> None:
    small = png(20, 10)
    assert fit_image(small) == (small, "png")
    big, fmt = fit_image(png(4000, 1000))
    from PIL import Image

    with Image.open(io.BytesIO(big)) as im:
        assert max(im.size) == MAX_IMAGE_EDGE
    assert fmt in ("jpeg", "png")


# ---------- transcript → text ----------
def test_transcript_audio_segments_become_timestamped_lines() -> None:
    raw = json.dumps(
        {
            "results": {
                "language_code": "en-US",
                "audio_segments": [
                    {"start_time": "0.5", "transcript": "Hello there."},
                    {"start_time": "65.2", "transcript": "A minute in."},
                    {"start_time": "4503.0", "transcript": "Much later."},
                ],
            }
        }
    )
    out = transcript_to_text(raw, "Standup")
    assert "# Standup" in out and "Language: en-US" in out
    assert "[00:00] Hello there." in out
    assert "[01:05] A minute in." in out
    assert "[75:03] Much later." in out


def test_transcript_items_are_grouped_into_lines_with_punctuation_attached() -> None:
    def w(t: float, c: str) -> dict[str, object]:
        return {
            "type": "pronunciation",
            "start_time": str(t),
            "end_time": str(t + 0.4),
            "alternatives": [{"content": c}],
        }

    def p(c: str) -> dict[str, object]:
        return {"type": "punctuation", "alternatives": [{"content": c}]}

    items = [w(0, "Hi"), p(","), w(1, "all"), p("."), w(31, "Next"), w(32, "point"), p("."), w(40, "End")]
    out = transcript_to_text(json.dumps({"results": {"items": items}}))
    assert "[00:00] Hi, all. Next point." in out
    assert "[00:40] End" in out


def test_transcript_without_speech_says_so() -> None:
    assert "(no speech found)" in transcript_to_text(json.dumps({"results": {"transcripts": []}}))
    assert stamp(59.9) == "[00:59]" and stamp(-3) == "[00:00]"
