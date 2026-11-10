"""Link fetching with the address guard (§3).

``http``/``https`` only, no credentials in the URL, the host resolved and every address checked: private,
loopback, link-local, metadata and other non-public addresses are refused (``169.254.169.254``,
``fd00::/8`` included). The connection goes to the checked address (no second DNS lookup), every redirect
is checked again (at most 5), the whole fetch stops at 30 s and 50 MB. What comes back is untrusted data.
"""

from __future__ import annotations

import http.client
import ipaddress
import re
import socket
import ssl
import time
from collections.abc import Callable
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import urljoin, urlsplit

MAX_BYTES = 50 * 1024**2
TIMEOUT_S = 30.0
MAX_REDIRECTS = 5
MAX_URL_LEN = 2048
USER_AGENT = "AI-City-knowledge/1.0 (owner's personal knowledge base)"

_BLOCKED_NETS = [
    ipaddress.ip_network(n)
    for n in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.168.0.0/16",
        "198.18.0.0/15",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::/128",
        "::1/128",
        "fc00::/7",
        "fd00::/8",
        "fe80::/10",
        "ff00::/8",
        "64:ff9b::/96",
    )
]


class LinkRefused(ValueError):
    """The link can't be fetched; the message is plain words for the owner."""


def check_url(url: str) -> tuple[str, str, int, str]:
    """(scheme, host, port, path+query) for an allowed URL, else ``LinkRefused``."""
    if not isinstance(url, str) or not url.strip() or len(url) > MAX_URL_LEN:
        raise LinkRefused("That link is empty or too long.")
    try:
        u = urlsplit(url.strip())
        port = u.port
    except ValueError as e:
        raise LinkRefused("That link could not be read.") from e
    if u.scheme not in ("http", "https"):
        raise LinkRefused("Only http and https links can be stored.")
    if u.username or u.password or "@" in u.netloc:
        raise LinkRefused("Links with a user name or password in them are not fetched.")
    host = (u.hostname or "").rstrip(".")
    if not host:
        raise LinkRefused("That link has no address.")
    path = (u.path or "/") + (f"?{u.query}" if u.query else "")
    return u.scheme, host, port or (443 if u.scheme == "https" else 80), path


def address_allowed(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr.split("%", maxsplit=1)[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if any(ip in n for n in _BLOCKED_NETS if n.version == ip.version):
        return False
    return ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_loopback or ip.is_link_local)


Resolver = Callable[[str, int], list[str]]


def system_resolver(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(str(i[4][0]) for i in infos))


def safe_address(host: str, port: int, resolve: Resolver) -> str:
    """The address to connect to. Every address the name resolves to must be public, or the link is refused."""
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
        addrs = [str(literal)]
    except ValueError:
        try:
            addrs = resolve(host, port)
        except OSError as e:
            raise LinkRefused("That web address does not exist.") from e
    if not addrs:
        raise LinkRefused("That web address does not exist.")
    if not all(address_allowed(a) for a in addrs):
        raise LinkRefused("That link points to a private or internal address, so it is not fetched.")
    return addrs[0]


@dataclass(frozen=True)
class RawResponse:
    status: int
    headers: dict[str, str]
    body: bytes


class Transport(Protocol):
    def __call__(
        self, scheme: str, host: str, ip: str, port: int, path: str, timeout: float, max_bytes: int
    ) -> RawResponse: ...


def pinned_transport(
    scheme: str, host: str, ip: str, port: int, path: str, timeout: float, max_bytes: int
) -> RawResponse:
    """One GET to ``ip`` with ``host`` as the Host header and the TLS name (certificate checked)."""
    deadline = time.monotonic() + timeout
    conn: http.client.HTTPConnection
    if scheme == "https":
        ctx = ssl.create_default_context()

        class _Https(http.client.HTTPSConnection):
            def connect(self) -> None:
                sock = socket.create_connection((ip, port), timeout)
                self.sock = ctx.wrap_socket(sock, server_hostname=host)

        conn = _Https(host, port, timeout=timeout, context=ctx)
    else:

        class _Http(http.client.HTTPConnection):
            def connect(self) -> None:
                self.sock = socket.create_connection((ip, port), timeout)

        conn = _Http(host, port, timeout=timeout)
    try:
        conn.request("GET", path, headers={"User-Agent": USER_AGENT, "Accept": "*/*", "Accept-Encoding": "identity"})
        r = conn.getresponse()
        headers = {k.lower(): v for k, v in r.getheaders()}
        if 300 <= r.status < 400:
            return RawResponse(r.status, headers, b"")
        length = headers.get("content-length")
        if length and length.isdigit() and int(length) > max_bytes:
            raise LinkRefused("That page is larger than 50 MB.")
        chunks: list[bytes] = []
        total = 0
        while True:
            if time.monotonic() > deadline:
                raise LinkRefused("That page took longer than 30 seconds.")
            chunk = r.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise LinkRefused("That page is larger than 50 MB.")
            chunks.append(chunk)
        return RawResponse(r.status, headers, b"".join(chunks))
    except TimeoutError as e:
        raise LinkRefused("That page took longer than 30 seconds.") from e
    except (OSError, http.client.HTTPException) as e:
        raise LinkRefused("That page could not be reached.") from e
    finally:
        conn.close()


@dataclass(frozen=True)
class Fetched:
    url: str
    content_type: str
    body: bytes


def fetch_link(
    url: str,
    resolve: Resolver = system_resolver,
    transport: Transport = pinned_transport,
    clock: Callable[[], float] = time.monotonic,
    max_bytes: int = MAX_BYTES,
    timeout_s: float = TIMEOUT_S,
    https_only: bool = False,
) -> Fetched:
    """``max_bytes``/``timeout_s``/``https_only``: the tighter rules for a site profile's stylesheets, logo and extra
    pages (every hop, redirects included, is checked again)."""
    start = clock()
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        scheme, host, port, path = check_url(current)
        if https_only and scheme != "https":
            raise LinkRefused("Only https links are read for a site profile.")
        ip = safe_address(host, port, resolve)
        left = timeout_s - (clock() - start)
        if left <= 0:
            raise LinkRefused("That page took longer than 30 seconds.")
        r = transport(scheme, host, ip, port, path, left, max_bytes)
        if r.status in (301, 302, 303, 307, 308):
            loc = r.headers.get("location")
            if not loc:
                raise LinkRefused("That link redirects nowhere.")
            current = urljoin(current, loc)
            continue
        if r.status >= 400:
            raise LinkRefused(f"The site answered with an error ({r.status}).")
        ct = r.headers.get("content-type", "application/octet-stream")
        return Fetched(url=current, content_type=ct, body=r.body)
    raise LinkRefused("That link redirects more than 5 times.")


# ---------- HTML → readable text ----------
_SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form", "template", "iframe", "aside"}
_BLOCK_TAGS = {"p", "div", "section", "article", "br", "tr", "table", "blockquote", "pre", "main", "figure"}


class _Readable(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif re.fullmatch(r"h[1-6]", tag):
            self.out.append("\n\n" + "#" * int(tag[1]) + " ")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag in _BLOCK_TAGS:
            self.out.append("\n\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False
        elif re.fullmatch(r"h[1-6]", tag) or tag in _BLOCK_TAGS:
            self.out.append("\n\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.out.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    """(title, readable markdown-ish text)."""
    p = _Readable()
    p.feed(html)
    p.close()
    text = "".join(p.out)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return re.sub(r"\s+", " ", p.title).strip(), text


def decode_text(body: bytes, content_type: str = "") -> str:
    m = re.search(r"charset=([\w-]+)", content_type, re.I)
    for enc in (m.group(1) if m else None, "utf-8", "cp1252"):
        if not enc:
            continue
        try:
            return body.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")
