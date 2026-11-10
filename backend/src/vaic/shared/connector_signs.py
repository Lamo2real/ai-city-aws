"""Connector signs on the City's towers (decision 173).

On every successful connection (a connector turning ``ready``), two things are stored on its record:
- ``departments`` / ``every_department``: which departments use it, decided by a hardcoded prompt
  (``agents/utility/connector-departments.md``) on the utility model and checked against the real department list;
- ``sign``: the service's logo as a small pixel-art grid in the City's own palette, made deterministically from its
  favicon (fetched once, cached on the record). No logo means no ``sign``: the City letters the plaque instead.

Fetched logos are untrusted bytes: public HTTPS only (the same address checks as connector links), at most a few
redirects, a size cap, decoded only as raster formats (never SVG), and only their pixels are kept.
"""

from __future__ import annotations

import asyncio
import io
import json
import re
import urllib.parse
from collections.abc import Mapping
from typing import Any

from .connectors import Record, Resolver, check_url, system_resolver
from .log import log
from .mcp_http import Transport, urllib_transport
from .presets import catalog
from .utility import UtilityDeps, utility_turn

SIZE = 12
"""Art pixels per side: as tall as a person in the City, small enough for a row of them beside a door."""
MAX_LOGO_BYTES = 200_000
MAX_LOGO_SIDE = 512
FETCH_TIMEOUT = 4
MAX_REDIRECTS = 3
MAX_FETCHES = 8
FORMATS = ("PNG", "ICO", "GIF", "JPEG", "WEBP", "BMP")
"""Raster only: SVG is never decoded (it can carry script)."""

PALETTE = (
    # The City's colours (web/src/city/scene.js): ink, paper and stone, the roofs, the shirts and the icon inks.
    "#1d1c36", "#ffffff", "#fff6e0", "#e6d3ae", "#cfd6e2", "#8b8fa8", "#5e5a74", "#3b4a66", "#2c3550",
    "#f4c63c", "#e8842c", "#d8392b", "#e0625a", "#c0533f", "#b84f78", "#d2699e", "#9a6bd0", "#7f5aa8",
    "#3f7fd0", "#4f8fd6", "#8fdcff", "#3f9a9a", "#37a564", "#49ad7c", "#8d9440", "#8a5a33", "#c98f55",
)  # fmt: skip
_RGB = [tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) for h in PALETTE]


# ---------- which departments ----------
def parse_departments(text: str, names: list[str]) -> tuple[bool, list[str]] | None:
    """The model's JSON answer, kept only where it names real departments (any case), or None."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except ValueError:
        return None
    if not isinstance(obj, dict):
        return None
    by_key = {n.strip().lower(): n for n in names}
    raw = obj.get("departments")
    picked: list[Any] = raw if isinstance(raw, list) else []
    out: list[str] = []
    for p in picked:
        n = by_key.get(str(p).strip().lower()) if isinstance(p, str) else None
        if n and n not in out:
            out.append(n)
    every = obj.get("every_department") is True
    if not every and not out:
        return None
    return every, (list(names) if every else out)


def _brief(rec: Mapping[str, Any], departments: list[Mapping[str, Any]]) -> str:
    tools = [t for t in rec.get("tools") or [] if isinstance(t, dict)][:60]
    lines = [
        f"Name: {str(rec.get('label') or rec.get('id'))[:80]}",
        f"Kind: {'web API' if rec.get('transport') == 'openapi' else 'MCP server'}",
    ]
    if what := _catalog_entry(rec).get("what"):
        lines.append(f"What it is: {str(what)[:300]}")
    lines.append("Tools:")
    lines += [f"- {str(t.get('name'))[:64]}: {str(t.get('description') or '')[:160]}" for t in tools]
    lines.append("\nDepartments:")
    lines += [f"- {d['name']}: {str(d.get('mission') or '')[:160]}" for d in departments]
    return "\n".join(lines)


async def assign_departments(
    rec: Mapping[str, Any], departments: list[Mapping[str, Any]], d: UtilityDeps
) -> tuple[bool, list[str]] | None:
    names = [str(x["name"]) for x in departments if x.get("name")]
    if not names:
        return None
    return parse_departments(await utility_turn("connector-departments", _brief(rec, departments), d), names)


# ---------- the logo, as pixels ----------
def _nearest(rgb: tuple[int, int, int]) -> int:
    r, g, b = rgb
    return min(
        range(len(_RGB)),
        key=lambda i: 2 * (r - _RGB[i][0]) ** 2 + 4 * (g - _RGB[i][1]) ** 2 + 3 * (b - _RGB[i][2]) ** 2,
    )


def pixelate(data: bytes) -> dict[str, Any] | None:
    """A logo (PNG, ICO, GIF, JPEG, WebP or BMP bytes) as ``{"size", "colors", "px"}``: ``px`` has ``size``×``size``
    characters, ``.`` for see-through and ``a``… for ``colors[0]``…, every colour from the City's palette.
    None when it isn't a small raster image or nothing of it remains."""
    from PIL import Image

    if not data or len(data) > MAX_LOGO_BYTES:
        return None
    try:
        with Image.open(io.BytesIO(data), formats=FORMATS) as im:
            if max(im.size) > MAX_LOGO_SIDE or min(im.size) < 1:
                return None
            img = im.convert("RGBA")
    except Exception:
        return None
    w, h = img.size
    flat = getattr(img, "get_flattened_data", None) or img.getdata  # Pillow 12 renamed it
    rgba: list[tuple[int, int, int, int]] = list(flat())
    # An opaque square with one colour in all four corners: that colour is the background, not the logo.
    corners = [rgba[0], rgba[w - 1], rgba[(h - 1) * w], rgba[h * w - 1]]
    if all(c[3] > 200 for c in corners) and max(_dist(corners[0], c) for c in corners) < 30:
        bg = corners[0]
        img.putdata([(0, 0, 0, 0) if _dist(c, bg) < 30 else c for c in rgba])
    box = img.getchannel("A").point(lambda a: 255 if a >= 96 else 0).getbbox()
    if not box:
        return None
    img = img.crop(box)
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    small = square.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    colors: list[str] = []
    out = []
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = small.getpixel((x, y))  # type: ignore[misc]
            if a < 128:
                out.append(".")
                continue
            hexc = PALETTE[_nearest((r, g, b))]
            if hexc not in colors:
                colors.append(hexc)
            out.append(chr(ord("a") + colors.index(hexc)))
    if all(c == "." for c in out):
        return None
    return {"size": SIZE, "colors": colors, "px": "".join(out)}


def _dist(a: tuple[int, ...], b: tuple[int, ...]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def _catalog_entry(rec: Mapping[str, Any]) -> dict[str, Any]:
    url = str(rec.get("url") or "")
    for id, e in catalog().items():
        if id == rec.get("id") or (url and e.get("url") == url):
            return dict(e)
    return {}


def logo_hosts(rec: Mapping[str, Any]) -> list[str]:
    """Where the service's icon may be: its site's root domain first (``mcp.stripe.com`` → ``stripe.com``), then the
    hosts themselves; from the connector's link, a web API's base URL and the catalog's sign-up page."""
    urls = [_catalog_entry(rec).get("signup"), rec.get("url")]
    if isinstance(rec.get("openapi"), dict):
        urls.append(rec["openapi"].get("base_url"))
    roots: list[str] = []
    hosts: list[str] = []
    for u in urls:
        host = (urllib.parse.urlsplit(str(u or "")).hostname or "").lower()
        if not host or "." not in host:
            continue
        labels = host.split(".")
        root = ".".join(labels[-3:] if len(labels[-2]) <= 3 and len(labels) > 2 else labels[-2:])  # co.uk, com.au
        for h in (root, f"www.{root}"):
            if h not in roots:
                roots.append(h)
        if host not in roots and host not in hosts:
            hosts.append(host)
    return roots + hosts


async def fetch_logo(
    rec: Mapping[str, Any], transport: Transport = urllib_transport, resolve: Resolver = system_resolver
) -> bytes | None:
    """The first icon that decodes, from the hosts in ``logo_hosts``; None when there is none."""
    tries = 0
    for host in logo_hosts(rec):
        for path in ("/apple-touch-icon.png", "/favicon.ico"):
            if tries >= MAX_FETCHES:
                return None
            tries += 1
            body = await _get(f"https://{host}{path}", transport, resolve)
            if body and pixelate(body):
                return body
    return None


async def _get(url: str, transport: Transport, resolve: Resolver) -> bytes | None:
    for _ in range(MAX_REDIRECTS + 1):
        if check_url(url, resolve):
            return None
        try:
            r = await asyncio.to_thread(transport, url, {"accept": "image/*"}, b"", FETCH_TIMEOUT)
        except Exception:
            return None
        if r.status in (301, 302, 303, 307, 308) and r.headers.get("location"):
            url = urllib.parse.urljoin(url, r.headers["location"])
            continue
        if r.status != 200 or len(r.body) > MAX_LOGO_BYTES:
            return None
        if "svg" in r.headers.get("content-type", "").lower():
            return None
        return r.body
    return None


# ---------- on every successful connection ----------
async def label_connector(
    rec: Record,
    departments: list[Mapping[str, Any]],
    d: UtilityDeps,
    transport: Transport = urllib_transport,
    resolve: Resolver = system_resolver,
) -> dict[str, Any]:
    """The fields to store on a connector that just connected: its departments (asked again every time) and its
    sign (made once, then kept). A failure leaves the field out; it never stops the connection."""
    patch: dict[str, Any] = {}
    try:
        got = await assign_departments(rec, departments, d)
        if got:
            patch["every_department"], patch["departments"] = got
    except Exception as e:
        log("warn", "connector.departments_failed", connector=str(rec.get("id")), error=type(e).__name__)
    if not rec.get("sign"):
        try:
            data = await fetch_logo(rec, transport, resolve)
            if data and (sign := pixelate(data)):
                patch["sign"] = sign
        except Exception as e:
            log("warn", "connector.sign_failed", connector=str(rec.get("id")), error=type(e).__name__)
    return patch
