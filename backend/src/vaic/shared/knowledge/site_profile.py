"""Site profiles: a link's design (brand colours, fonts, logo, spacing, light or dark) and content (what the site
is: a company, project, paper, docs or a store), captured when a web page is added to the knowledge base
(``docs/KNOWLEDGE.md`` §16, decision 185).

Everything fetched is untrusted data. Pages and stylesheets are parsed as text, never run: scripts are dropped
(only JSON-LD is read, as data), and nothing a page says changes what is fetched beyond its own same-site links.
Extra fetches are https only, on the page's own site, through the same address guard as every link (private and
metadata addresses refused, every redirect checked again), with tighter size and time caps.
"""

from __future__ import annotations

import base64
import json
import re
import time
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qs, urljoin, urlsplit, urlunsplit

from ..log import log
from .fetch import Fetched, LinkRefused, html_to_text

MAX_CSS_FILES = 6
MAX_CSS_BYTES = 1_500_000
MAX_CSS_TOTAL = 4_000_000
MAX_EXTRA_PAGES = 3
MAX_PAGE_BYTES = 2_000_000
MAX_LOGO_BYTES = 48_000
ASSET_TIMEOUT_S = 10.0
CAPTURE_BUDGET_S = 60.0
MAX_PROFILE_JSON = 60_000
PAGE_TEXT_CHARS = 2_500
MODEL_TEXT_CHARS = 24_000

AssetFetch = Callable[[str, int], Fetched]
"""(url, byte cap) → the response; raises ``LinkRefused`` (or ``OSError``) when it can't."""

_LOGO_TYPES = ("image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon")
_SITE_KINDS = ("company", "project", "research-paper", "documentation", "e-commerce", "personal", "news", "website")


# ---------- sites and links ----------
def site_of(host: str) -> str:
    """The registrable part of a host, roughly: ``www.shop.example.co.uk`` → ``example.co.uk``."""
    labels = host.lower().rstrip(".").split(".")
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in ("co", "com", "org", "net", "ac", "gov", "edu"):
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def brand_key(url: str) -> str:
    """The tenant key that keeps one brand's profile apart from another's (vectors and graph): the site."""
    url = url.strip()
    host = (urlsplit(url if "://" in url else f"https://{url}").hostname or "").lower()
    return site_of(host) if host else ""


def same_site(a: str, b: str) -> bool:
    ha, hb = urlsplit(a).hostname or "", urlsplit(b).hostname or ""
    return bool(ha and hb) and site_of(ha) == site_of(hb)


def canonical_url(url: str) -> str:
    """For "the same link": lower-case scheme and host, no fragment, no trailing slash on the path."""
    u = urlsplit(url.strip())
    path = u.path.rstrip("/") or ""
    return urlunsplit(
        (u.scheme.lower(), (u.hostname or "").lower() + (f":{u.port}" if u.port else ""), path, u.query, "")
    )


# ---------- colours ----------
_HEX = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
_RGB = re.compile(r"rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)", re.I)
_HSL = re.compile(r"hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)", re.I)
_NAMED = {"white": "#ffffff", "black": "#000000"}


def _chan(v: str) -> int:
    x = float(v[:-1]) * 2.55 if v.endswith("%") else float(v)
    return max(0, min(255, round(x)))


def _alpha(v: str | None) -> float:
    if not v:
        return 1.0
    return float(v[:-1]) / 100 if v.endswith("%") else float(v)


def _hsl_hex(h: float, s: float, light: float) -> str:
    import colorsys

    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, light / 100, s / 100)
    return f"#{round(r * 255):02x}{round(g * 255):02x}{round(b * 255):02x}"


def normalize_color(v: str) -> str | None:
    """``#rrggbb`` for an opaque colour value, else ``None`` (transparent and see-through colours are skipped)."""
    v = v.strip().lower()
    if v in _NAMED:
        return _NAMED[v]
    m = _HEX.fullmatch(v)
    if m:
        h = v[1:]
        if len(h) in (3, 4):
            if len(h) == 4 and h[3] != "f":
                return None
            h = "".join(c * 2 for c in h[:3])
        elif len(h) == 8:
            if int(h[6:], 16) < 200:
                return None
            h = h[:6]
        return f"#{h}"
    m = _RGB.fullmatch(v)
    if m:
        if _alpha(m.group(4)) < 0.8:
            return None
        return "#{:02x}{:02x}{:02x}".format(*(_chan(m.group(i)) for i in (1, 2, 3)))
    m = _HSL.fullmatch(v)
    if m:
        if _alpha(m.group(4)) < 0.8:
            return None
        return _hsl_hex(float(m.group(1)), float(m.group(2)), float(m.group(3)))
    return None


def colors_in(text: str) -> list[str]:
    out: list[str] = []
    for m in (*_HEX.finditer(text), *_RGB.finditer(text), *_HSL.finditer(text)):
        c = normalize_color(m.group(0))
        if c:
            out.append(c)
    for word, hexv in _NAMED.items():
        out += [hexv] * len(re.findall(rf"(?<![\w-]){word}(?![\w-])", text, re.I))
    return out


def luminance(hexv: str) -> float:
    r, g, b = (int(hexv[i : i + 2], 16) / 255 for i in (1, 3, 5))

    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def saturation(hexv: str) -> float:
    r, g, b = (int(hexv[i : i + 2], 16) for i in (1, 3, 5))
    hi, lo = max(r, g, b), min(r, g, b)
    return 0.0 if hi == 0 else (hi - lo) / hi


# ---------- CSS ----------
_COMMENT = re.compile(r"/\*.*?\*/", re.S)
_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}")
_DECL = re.compile(r"([\w-]+)\s*:\s*([^;]+)")
_FONT_FACE = re.compile(r"@font-face\s*\{([^}]*)\}", re.I)
_IMPORT = re.compile(r"@import\s+(?:url\()?\s*['\"]?([^'\")\s;]+)", re.I)
_VAR = re.compile(r"var\(\s*(--[\w-]+)")
_GENERIC_FONTS = {
    "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
    "ui-monospace", "ui-rounded", "inherit", "initial", "unset", "emoji", "math", "fangsong", "-apple-system",
    "blinkmacsystemfont", "revert",
}  # fmt: skip


def strip_css(css: str) -> str:
    return _COMMENT.sub(" ", css)


def css_imports(css: str) -> list[str]:
    return _IMPORT.findall(strip_css(css))


def font_stack(v: str) -> list[str]:
    return [f.strip().strip("'\"") for f in v.split(",") if f.strip().strip("'\"")]


def first_font(v: str) -> str | None:
    for f in font_stack(v):
        if f.lower() not in _GENERIC_FONTS and not f.startswith("var("):
            return f[:80]
    return None


@dataclass
class _Css:
    vars: dict[str, str] = field(default_factory=dict)
    colors: Counter[str] = field(default_factory=Counter)
    fonts: Counter[str] = field(default_factory=Counter)
    font_faces: list[str] = field(default_factory=list)
    sizes: Counter[str] = field(default_factory=Counter)
    weights: Counter[str] = field(default_factory=Counter)
    radius: Counter[str] = field(default_factory=Counter)
    shadows: Counter[str] = field(default_factory=Counter)
    spacing: Counter[str] = field(default_factory=Counter)
    by_selector: dict[str, dict[str, str]] = field(default_factory=dict)
    dark_media: bool = False
    color_scheme: str = ""


_ROLE_SELECTORS = ("html", "body", ":root", "h1", "h2", "h3", "a", "button", ".btn", ".button")


def read_css(css: str, acc: _Css) -> None:
    css = strip_css(css)
    if re.search(r"prefers-color-scheme\s*:\s*dark", css, re.I):
        acc.dark_media = True
    for m in _FONT_FACE.finditer(css):
        fam = re.search(r"font-family\s*:\s*([^;]+)", m.group(1), re.I)
        if fam:
            name = fam.group(1).strip().strip("'\"")[:80]
            if name and name not in acc.font_faces:
                acc.font_faces.append(name)
    css = _FONT_FACE.sub(" ", css)
    for raw_sel, body in _RULE.findall(css):
        sel = " ".join(raw_sel.rsplit(";", 1)[-1].split())  # an @import or @charset line before it is not part
        if sel.startswith("@"):
            continue
        for prop, val in _DECL.findall(body):
            read_decl(sel, prop.lower(), val.replace("!important", "").strip(), acc)


def read_decl(sel: str, prop: str, val: str, acc: _Css) -> None:
    if prop.startswith("--"):
        acc.vars.setdefault(prop, val[:200])
    if (
        prop in ("color", "background", "background-color", "border-color", "fill", "stroke", "outline-color")
        or (prop.startswith("border") and "color" in prop)
        or prop.startswith("--")
    ):
        for c in colors_in(val):
            acc.colors[c] += 1
    if prop == "font-family":
        f = first_font(val)
        if f:
            acc.fonts[f] += 1
    elif prop == "font":
        f = first_font(val.split(" ", 2)[-1] if "," in val else val)
        if f:
            acc.fonts[f] += 1
    elif prop == "font-size" and re.fullmatch(r"[\d.]+(px|rem|em)|clamp\(.+\)", val):
        acc.sizes[val[:40]] += 1
    elif prop == "font-weight" and re.fullmatch(r"\d{3}|bold|normal|lighter|bolder", val):
        acc.weights[val] += 1
    elif prop == "border-radius":
        acc.radius[val[:40]] += 1
    elif prop == "box-shadow" and val not in ("none", "0"):
        acc.shadows[val[:120]] += 1
    elif prop in ("padding", "margin", "gap", "row-gap", "column-gap") and val not in ("0", "auto"):
        acc.spacing[val[:40]] += 1
    elif prop == "color-scheme":
        acc.color_scheme = val[:40]
    for s in (x.strip() for x in sel.split(",")):
        if s in _ROLE_SELECTORS or re.fullmatch(r"\.?[\w-]*(primary|brand|accent|cta)[\w-]*", s, re.I):
            # The first rule wins: the base rule comes before media-query variants (a dark-mode body, say).
            acc.by_selector.setdefault(s, {}).setdefault(prop, val[:200])


def resolve_var(val: str, vars_: dict[str, str], depth: int = 0) -> str:
    m = _VAR.search(val)
    if not m or depth > 5:
        return val
    return resolve_var(vars_.get(m.group(1), val), vars_, depth + 1)


# ---------- HTML ----------
class _Page(HTMLParser):
    """Collects what the profile needs. Script bodies are never kept, except JSON-LD (read as data only)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, list[str]] = {}
        self.links: list[dict[str, str]] = []
        self.styles: list[str] = []
        self.inline: list[str] = []
        self.anchors: list[tuple[str, str]] = []
        self.imgs: list[dict[str, str]] = []
        self.svg_fills: list[str] = []
        self.jsonld: list[str] = []
        self.headings: list[tuple[str, str]] = []
        self.html_attrs: dict[str, str] = {}
        self._in: list[str] = []
        self._anchor: str | None = None
        self._anchor_text: list[str] = []
        self._heading: str | None = None
        self._heading_text: list[str] = []
        self._logo_depth = 0
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        hint = " ".join((a.get("class", ""), a.get("id", ""), a.get("aria-label", ""), a.get("alt", ""))).lower()
        if tag == "html":
            self.html_attrs = a
        elif tag == "meta":
            key = (a.get("name") or a.get("property") or a.get("itemprop") or "").lower()
            if key and a.get("content"):
                self.meta.setdefault(key, []).append(a["content"][:2000])
        elif tag == "link":
            self.links.append(a)
        elif tag in ("style", "script"):
            self._in.append(tag if tag == "style" or "ld+json" in a.get("type", "").lower() else "skip")
            self._buf = []
        elif tag == "a":
            self._anchor = a.get("href", "")
            self._anchor_text = []
        elif re.fullmatch(r"h[1-3]", tag):
            self._heading = tag
            self._heading_text = []
        elif tag == "img":
            self.imgs.append({**a, "_logo": "1" if self._logo_depth else ""})
        if (tag in ("svg", "a", "div", "span", "header") and "logo" in hint) or (
            self._logo_depth and tag in ("svg", "a", "div", "span", "header")
        ):
            self._logo_depth += 1
        if self._logo_depth and tag in ("path", "rect", "circle", "g", "svg", "polygon"):
            for k in ("fill", "stroke"):
                c = normalize_color(a.get(k, ""))
                if c:
                    self.svg_fills.append(c)
        if a.get("style"):
            self.inline.append(a["style"][:2000])

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script") and self._in:
            kind = self._in.pop()
            if kind == "style":
                self.styles.append("".join(self._buf))
            elif kind == "script":
                self.jsonld.append("".join(self._buf)[:200_000])
            self._buf = []
        elif tag == "a" and self._anchor is not None:
            self.anchors.append((self._anchor, " ".join("".join(self._anchor_text).split())[:120]))
            self._anchor = None
        elif self._heading == tag:
            self.headings.append((tag, " ".join("".join(self._heading_text).split())[:200]))
            self._heading = None
        if self._logo_depth and tag in ("svg", "a", "div", "span", "header"):
            self._logo_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in:
            if self._in[-1] != "skip":
                self._buf.append(data)
            return
        if self._anchor is not None:
            self._anchor_text.append(data)
        if self._heading:
            self._heading_text.append(data)


def parse_page(html: str) -> _Page:
    p = _Page()
    try:
        p.feed(html)
        p.close()
    except Exception as e:  # a broken page still gives what was read so far
        log("warn", "knowledge.site_parse", error=type(e).__name__)
    return p


def _meta(p: _Page, *keys: str) -> str:
    for k in keys:
        if p.meta.get(k):
            return " ".join(p.meta[k][0].split())
    return ""


def _jsonld_nodes(p: _Page) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def walk(v: Any) -> None:
        if isinstance(v, dict):
            out.append(v)
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    for raw in p.jsonld:
        try:
            walk(json.loads(raw))
        except ValueError:
            continue
    return out[:500]


def _types(node: dict[str, Any]) -> list[str]:
    t = node.get("@type")
    return [str(x) for x in (t if isinstance(t, list) else [t]) if x]


# ---------- design ----------
def _rel(link: dict[str, str]) -> set[str]:
    return set(link.get("rel", "").lower().split())


def stylesheet_urls(p: _Page, base: str) -> list[str]:
    urls = [urljoin(base, x["href"]) for x in p.links if "stylesheet" in _rel(x) and x.get("href")]
    return list(dict.fromkeys(urls))


def google_fonts(p: _Page, base: str, css_texts: list[str]) -> list[str]:
    """Families named in Google Fonts links (read from the address, never fetched)."""
    hrefs = [urljoin(base, x["href"]) for x in p.links if x.get("href")]
    for css in css_texts:
        hrefs += css_imports(css)
    fams: list[str] = []
    for h in hrefs:
        u = urlsplit(h)
        if u.hostname not in ("fonts.googleapis.com", "fonts.bunny.net"):
            continue
        for fam in parse_qs(u.query).get("family", []):
            for one in fam.split("|"):
                name = one.split(":")[0].replace("+", " ").strip()[:80]
                if name and name not in fams:
                    fams.append(name)
    return fams


def logo_candidates(p: _Page, base: str) -> tuple[str, str]:
    """(logo url, favicon url): an ``<img>`` that says it is the logo, else og:image; the best icon link."""
    logo = ""
    for img in p.imgs:
        hint = " ".join((img.get("src", ""), img.get("alt", ""), img.get("class", ""), img.get("id", ""))).lower()
        if img.get("src") and ("logo" in hint or img.get("_logo")):
            logo = urljoin(base, img["src"])
            break
    icons = [x for x in p.links if x.get("href") and _rel(x) & {"icon", "apple-touch-icon", "shortcut", "mask-icon"}]
    icons.sort(key=lambda x: ("apple-touch-icon" not in _rel(x), "svg" not in x.get("type", "")))
    favicon = urljoin(base, icons[0]["href"]) if icons else urljoin(base, "/favicon.ico")
    if not logo:
        og = _meta(p, "og:logo", "og:image")
        logo = urljoin(base, og) if og else ""
    return logo, favicon


def _top(c: Counter[str], n: int) -> list[str]:
    return [k for k, _ in c.most_common(n)]


def design_facts(p: _Page, base: str, css_texts: list[str]) -> dict[str, Any]:
    acc = _Css()
    for css in [*css_texts, *p.styles]:
        read_css(css, acc)
    for style in p.inline:
        read_css(f"inline{{{style}}}", acc)
    for c in p.svg_fills:
        acc.colors[c] += 3

    def sel(s: str, *props: str) -> str:
        d = acc.by_selector.get(s, {})
        for prop in props:
            if d.get(prop):
                return resolve_var(d[prop], acc.vars)
        return ""

    def color_of(v: str) -> str | None:
        cs = colors_in(v)
        return cs[0] if cs else None

    brand_vars: dict[str, str] = {}
    for name, val in acc.vars.items():
        vc = color_of(resolve_var(val, acc.vars))
        if vc and re.search(
            r"primary|brand|accent|secondary|background|bg|foreground|fg|text|surface|link", name, re.I
        ):
            brand_vars[name] = vc
        if len(brand_vars) >= 24:
            break
    theme = _meta(p, "theme-color")
    background = color_of(
        sel("body", "background-color", "background") or sel("html", "background-color", "background")
    )
    text = color_of(sel("body", "color") or sel("html", "color"))
    primary: str | None = None
    for name, c in brand_vars.items():
        if re.search(r"primary|brand", name, re.I):
            primary = c
            break
    if not primary:
        for s in ("button", ".btn", ".button", "a"):
            primary = color_of(sel(s, "background-color", "background")) if s != "a" else color_of(sel(s, "color"))
            if primary and saturation(primary) > 0.2:
                break
            primary = None
    accent = next((c for n, c in brand_vars.items() if re.search(r"accent|secondary", n, re.I)), None)
    vivid = [c for c in _top(acc.colors, 40) if saturation(c) > 0.25 and 0.04 < luminance(c) < 0.85]
    if not primary:
        primary = (normalize_color(theme) if theme else None) or (p.svg_fills[0] if p.svg_fills else None)
        primary = primary or (vivid[0] if vivid else None)
    if not accent:
        accent = next((c for c in vivid if c != primary), None)

    scheme_hint = (
        acc.color_scheme + " " + p.html_attrs.get("class", "") + " " + p.html_attrs.get("data-theme", "")
    ).lower()
    if background:
        scheme = "dark" if luminance(background) < 0.2 else "light"
    elif "dark" in scheme_hint and "light" not in scheme_hint:
        scheme = "dark"
    else:
        scheme = "light"

    body_font = first_font(sel("body", "font-family", "font") or sel("html", "font-family", "font")) or ""
    heading_font = first_font(sel("h1", "font-family", "font") or sel("h2", "font-family", "font")) or ""
    gfonts = google_fonts(p, base, css_texts)
    families = list(dict.fromkeys([*([body_font] if body_font else []), *_top(acc.fonts, 6), *gfonts, *acc.font_faces]))
    logo, favicon = logo_candidates(p, base)
    return {
        "colors": {
            "primary": primary,
            "accent": accent,
            "background": background,
            "text": text,
            "theme_color": normalize_color(theme) if theme else None,
            "custom_properties": brand_vars,
            "most_used": _top(acc.colors, 12),
            "logo_fills": list(dict.fromkeys(p.svg_fills))[:6],
        },
        "fonts": {
            "body": body_font or (families[0] if families else ""),
            "heading": heading_font or body_font or (families[0] if families else ""),
            "families": families[:10],
            "font_face": acc.font_faces[:10],
            "google_fonts": gfonts[:10],
            "sizes": _top(acc.sizes, 8),
            "weights": _top(acc.weights, 6),
        },
        "logo_url": logo,
        "favicon_url": favicon,
        "radius": _top(acc.radius, 4),
        "shadows": _top(acc.shadows, 3),
        "spacing": _top(acc.spacing, 6),
        "scheme": scheme,
        "has_dark_mode": acc.dark_media,
    }


# ---------- content ----------
_PRICE = re.compile(
    r"(?:[$€£¥]\s?\d[\d,]*(?:\.\d{2})?|\d[\d\s,]*(?:[.,]\d{2})?\s?(?:kr|SEK|EUR|USD|GBP|NOK|DKK|CHF)\b)"
)
_PRICE_NUM = re.compile(r"\d[\d\s,]*(?:[.,]\d{1,2})?")


def _price_value(s: str) -> float | None:
    m = _PRICE_NUM.search(s)
    if not m:
        return None
    raw = m.group(0).replace(" ", "")
    raw = raw.replace(".", "").replace(",", ".") if re.search(r",\d{2}$", raw) else raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def guess_kind(p: _Page, url: str, nodes: list[dict[str, Any]], text: str) -> str:
    types = {t.lower() for n in nodes for t in _types(n)}
    path = urlsplit(url).path.lower()
    host = (urlsplit(url).hostname or "").lower()
    if p.meta.get("citation_title") or types & {"scholarlyarticle", "medicalscholarlyarticle"} or "arxiv.org" in host:
        return "research-paper"
    if types & {"product", "offer", "aggregateoffer", "store", "onlinestore"} or _meta(p, "og:type") == "product":
        return "e-commerce"
    if (
        host.startswith(("docs.", "developer.", "developers."))
        or "/docs" in path
        or types & {"techarticle", "apireference"}
        or re.search(r"\bdocumentation\b", _meta(p, "og:title", "description") + " " + text[:400], re.I)
    ):
        return "documentation"
    if types & {"newsarticle", "newsmediaorganization"}:
        return "news"
    if host in ("github.com", "gitlab.com") or types & {"softwaresourcecode", "softwareapplication"}:
        return "project"
    if types & {"organization", "corporation", "localbusiness"}:
        return "company"
    if re.search(r"/(cart|checkout|shop|collections|products?)\b", " ".join(a for a, _ in p.anchors).lower()):
        return "e-commerce"
    return "company" if types else "website"


def site_name(p: _Page, nodes: list[dict[str, Any]], title: str) -> str:
    name = _meta(p, "og:site_name", "application-name", "citation_title")
    if not name:
        for n in nodes:
            if {"Organization", "WebSite", "Corporation", "Store"} & set(_types(n)) and isinstance(n.get("name"), str):
                name = n["name"]
                break
    if not name and title:
        parts = [x.strip() for x in re.split(r"\s+[|–—·:-]\s+", title) if x.strip()]
        name = min(parts, key=len) if parts else title
    return " ".join(str(name).split())[:120]


def content_facts(p: _Page, url: str, text: str, page_title: str = "") -> dict[str, Any]:
    nodes = _jsonld_nodes(p)
    title = " ".join((page_title or _meta(p, "og:title")).split())
    kind = guess_kind(p, url, nodes, text)
    out: dict[str, Any] = {
        "url": url,
        "name": site_name(p, nodes, title),
        "title": title,
        "description": _meta(p, "description", "og:description", "twitter:description")[:600],
        "kind": kind,
        "language": (p.html_attrs.get("lang") or "")[:12],
        "headings": [h for _, h in p.headings if h][:20],
    }
    if kind == "e-commerce":
        prices: list[float] = []
        for n in nodes:
            for k in ("price", "lowPrice", "highPrice"):
                v = n.get(k)
                if isinstance(v, int | float | str):
                    f = _price_value(str(v))
                    if f is not None:
                        prices.append(f)
        currency = next((str(n["priceCurrency"]) for n in nodes if isinstance(n.get("priceCurrency"), str)), "")
        if not prices:
            for m in _PRICE.findall(text)[:200]:
                f = _price_value(m)
                if f is not None:
                    prices.append(f)
            cur = re.search(r"[$€£¥]|\b(kr|SEK|EUR|USD|GBP|NOK|DKK|CHF)\b", " ".join(_PRICE.findall(text)[:5]))
            currency = currency or (cur.group(0) if cur else "")
        cats = [
            t
            for a, t in p.anchors
            if t and re.search(r"/(collections?|categor(y|ies)|c|shop|department)/", urlsplit(urljoin(url, a)).path)
        ]
        out["store"] = {
            "categories": list(dict.fromkeys(cats))[:15],
            "price_min": min(prices) if prices else None,
            "price_max": max(prices) if prices else None,
            "currency": currency[:8],
            "products": [str(n["name"])[:120] for n in nodes if "Product" in _types(n) and n.get("name")][:10],
        }
    if kind == "research-paper":
        authors = p.meta.get("citation_author", [])
        if not authors:
            for n in nodes:
                for a in n.get("author", []) if isinstance(n.get("author"), list) else [n.get("author")]:
                    if isinstance(a, dict) and a.get("name"):
                        authors.append(str(a["name"]))
        abstract = _meta(p, "citation_abstract", "dc.description", "description")
        if not abstract:
            m = re.search(r"#+\s*abstract\s*\n+(.{40,2000}?)(?:\n#|\Z)", text, re.I | re.S)
            abstract = " ".join(m.group(1).split()) if m else ""
        out["paper"] = {
            "title": _meta(p, "citation_title") or out["title"],
            "authors": [" ".join(a.split())[:100] for a in authors][:20],
            "abstract": abstract[:2000],
            "published": _meta(p, "citation_publication_date", "citation_date", "article:published_time")[:20],
        }
    if kind == "documentation":
        out["docs"] = {"sections": [t for a, t in p.anchors if t and "/docs" in a.lower()][:20]}
    return out


def main_links(p: _Page, base: str, n: int = MAX_EXTRA_PAGES) -> list[str]:
    """Same-site pages worth a look (about, products, pricing, docs…), at most ``n``; never the page itself."""
    here = canonical_url(base)
    good = re.compile(r"about|product|pricing|price|feature|solution|service|docs|guide|shop|collection|team|mission")
    scored: list[tuple[int, str]] = []
    for href, text in p.anchors:
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        u = urljoin(base, href)
        if urlsplit(u).scheme != "https" or not same_site(u, base):
            continue
        u = urlunsplit(urlsplit(u)._replace(fragment=""))
        if canonical_url(u) == here or re.search(r"\.(pdf|zip|png|jpe?g|gif|svg|mp4|xml|json)$", u, re.I):
            continue
        score = (2 if good.search(urlsplit(u).path.lower() + " " + text.lower()) else 0) - urlsplit(u).path.count("/")
        scored.append((score, u))
    out: list[str] = []
    for _, u in sorted(scored, key=lambda x: -x[0]):
        if u not in out:
            out.append(u)
        if len(out) >= n:
            break
    return out


# ---------- capture ----------
@dataclass
class Capture:
    url: str
    brand: str
    design: dict[str, Any]
    content: dict[str, Any]
    pages: list[dict[str, str]]
    logo_data: str = ""
    skipped: list[str] = field(default_factory=list)


def _ct(f: Fetched) -> str:
    return f.content_type.split(";")[0].strip().lower()


def capture_site(
    url: str,
    html: str,
    page_text: str,
    fetch: AssetFetch,
    page_title: str = "",
    clock: Callable[[], float] = time.monotonic,
) -> Capture:
    """The deterministic part: stylesheets (same site, https, capped), logo, a few same-site pages."""
    from .fetch import decode_text

    start = clock()
    skipped: list[str] = []

    def left() -> bool:
        return clock() - start < CAPTURE_BUDGET_S

    def get(u: str, cap: int) -> Fetched | None:
        if not left():
            skipped.append(f"{u} (time budget used)")
            return None
        if urlsplit(u).scheme != "https" or not same_site(u, url):
            skipped.append(f"{u} (not https on the same site)")
            return None
        try:
            got = fetch(u, cap)
        except (LinkRefused, OSError, ValueError) as e:
            skipped.append(f"{u} ({e})"[:200])
            return None
        if len(got.body) > cap or not same_site(got.url, url):
            skipped.append(f"{u} (too large or left the site)")
            return None
        return got

    p = parse_page(html)
    css_texts: list[str] = []
    total = 0
    queue = stylesheet_urls(p, url)
    for style in p.styles:
        queue += [urljoin(url, x) for x in css_imports(style)]
    seen: set[str] = set()
    while queue and len(seen) < MAX_CSS_FILES:
        u = queue.pop(0)
        if u in seen or urlsplit(u).hostname in ("fonts.googleapis.com", "fonts.bunny.net"):
            continue
        seen.add(u)
        got = get(u, min(MAX_CSS_BYTES, MAX_CSS_TOTAL - total))
        if not got or _ct(got) not in ("text/css", ""):
            continue
        css = decode_text(got.body, got.content_type)
        total += len(got.body)
        css_texts.append(css)
        queue += [urljoin(got.url, x) for x in css_imports(css)]
    design = design_facts(p, url, css_texts)
    content = content_facts(p, url, page_text, page_title)

    logo_data = ""
    for cand in (design["logo_url"], design["favicon_url"]):
        if not cand or not cand.startswith("https://"):
            continue
        got = get(cand, MAX_LOGO_BYTES)
        if got and _ct(got) in _LOGO_TYPES and got.body:
            if _ct(got) == "image/svg+xml":
                svg = got.body.decode("utf-8", "replace")
                for c in re.findall(r"(?:fill|stroke)\s*[=:]\s*['\"]?(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))", svg):
                    nc = normalize_color(c)
                    if nc and nc not in design["colors"]["logo_fills"]:
                        design["colors"]["logo_fills"].append(nc)
            # Shown only as an <img> (no scripts run there) from a data: URL.
            logo_data = f"data:{_ct(got)};base64,{base64.b64encode(got.body).decode()}"
            break

    pages: list[dict[str, str]] = []
    for u in main_links(p, url):
        got = get(u, MAX_PAGE_BYTES)
        if not got or _ct(got) not in ("text/html", "application/xhtml+xml"):
            continue
        t_title, t_text = html_to_text(decode_text(got.body, got.content_type))
        pages.append({"url": got.url, "title": t_title[:200], "text": t_text[:PAGE_TEXT_CHARS]})
    return Capture(url, brand_key(url), design, content, pages, logo_data, skipped[:20])


# ---------- the model's profile, validated ----------
_HEXV = re.compile(r"#[0-9a-f]{6}")


def _s(v: Any, n: int) -> str:
    return " ".join(str(v).split())[:n] if isinstance(v, str | int | float) and not isinstance(v, bool) else ""


def _sl(v: Any, n: int, each: int = 200) -> list[str]:
    return [x for x in (_s(i, each) for i in v) if x][:n] if isinstance(v, list) else []


def clean_profile(raw: dict[str, Any], cap: Capture) -> dict[str, Any]:
    """Keeps only the fields asked for, as short text; a colour must be one the site's own code uses."""
    known = {c for c in [*cap.design["colors"]["most_used"], *cap.design["colors"]["logo_fills"],
                         *cap.design["colors"]["custom_properties"].values()] if c}  # fmt: skip
    known |= {c for k, c in cap.design["colors"].items() if isinstance(c, str)}
    palette = []
    raw_palette = raw.get("palette")
    for e in raw_palette if isinstance(raw_palette, list) else []:
        if not isinstance(e, dict):
            continue
        hexv = _s(e.get("hex"), 7).lower()
        if _HEXV.fullmatch(hexv) and hexv in known:
            palette.append({"role": _s(e.get("role"), 30) or "other", "hex": hexv, "note": _s(e.get("note"), 120)})
    raw_typo = raw.get("typography")
    typo: dict[str, Any] = raw_typo if isinstance(raw_typo, dict) else {}
    kind = _s(raw.get("kind"), 30).lower()
    out: dict[str, Any] = {
        "name": _s(raw.get("name"), 120) or cap.content["name"],
        "kind": kind if kind in _SITE_KINDS else cap.content["kind"],
        "what_it_is": _s(raw.get("what_it_is"), 600),
        "audience": _s(raw.get("audience"), 300),
        "offerings": _sl(raw.get("offerings"), 12),
        "key_facts": _sl(raw.get("key_facts"), 12, 300),
        "palette": palette[:8],
        "typography": {
            "heading": _s(typo.get("heading"), 80),
            "body": _s(typo.get("body"), 80),
            "notes": _s(typo.get("notes"), 300),
        },
        "tone_of_voice": _s(raw.get("tone_of_voice"), 300),
        "layout_patterns": _sl(raw.get("layout_patterns"), 8),
    }
    for sect, fields in (
        ("store", {"categories": 15, "price_range": 0}),
        ("paper", {"title": 0, "authors": 20, "abstract": 0, "findings": 8}),
        ("docs", {"product": 0, "concepts": 15}),
    ):
        src = raw.get(sect)
        if isinstance(src, dict):
            sec: dict[str, Any] = {}
            for f, n in fields.items():
                sec[f] = _sl(src.get(f), n, 300) if n else _s(src.get(f), 2000 if f == "abstract" else 300)
            out[sect] = sec
    return out


def fallback_profile(cap: Capture) -> dict[str, Any]:
    """When the model could not help: the deterministic facts in the same shape."""
    c, f = cap.design["colors"], cap.design["fonts"]
    palette = [{"role": r, "hex": c[r], "note": ""} for r in ("primary", "accent", "background", "text") if c.get(r)]
    out: dict[str, Any] = {
        "name": cap.content["name"],
        "kind": cap.content["kind"],
        "what_it_is": cap.content["description"],
        "audience": "",
        "offerings": [],
        "key_facts": [],
        "palette": palette,
        "typography": {"heading": f["heading"], "body": f["body"], "notes": ""},
        "tone_of_voice": "",
        "layout_patterns": [],
    }
    if "paper" in cap.content:
        pp = cap.content["paper"]
        out["paper"] = {"title": pp["title"], "authors": pp["authors"], "abstract": pp["abstract"], "findings": []}
    if "store" in cap.content:
        s = cap.content["store"]
        rng = f"{s['price_min']}–{s['price_max']} {s['currency']}".strip() if s["price_min"] is not None else ""
        out["store"] = {"categories": s["categories"], "price_range": rng}
    return out


def model_input(cap: Capture, page_text: str) -> str:
    facts = {"design": cap.design, "content": cap.content}
    pages = "\n\n".join(f"## {pg['title']} ({pg['url']})\n{pg['text']}" for pg in cap.pages)
    body = f"Site: {cap.url}\n\nExtracted facts (JSON):\n{json.dumps(facts, ensure_ascii=False)[:20_000]}\n\n"
    body += f"Main page text:\n{page_text[:MODEL_TEXT_CHARS]}\n\nOther pages:\n{pages}"
    return body


def parse_model_profile(reply: str) -> dict[str, Any]:
    m = re.search(r"\{.*\}", reply, re.S)
    if not m:
        raise ValueError("no JSON in the site profile reply")
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise ValueError("the site profile reply is not JSON") from e
    if not isinstance(data, dict):
        raise ValueError("the site profile reply is not an object")
    return data


# ---------- what is stored ----------
def record(cap: Capture, profile: dict[str, Any], captured_at: str) -> dict[str, Any]:
    """The ``site_profile`` on the item record, kept under ~60 KB (DynamoDB items stop at 400 KB)."""
    rec: dict[str, Any] = {
        "url": cap.url,
        "brand": cap.brand,
        "captured_at": captured_at,
        "profile": profile,
        "design": cap.design,
        "content": {k: v for k, v in cap.content.items() if k != "headings"},
        "pages": [{"url": p["url"], "title": p["title"]} for p in cap.pages],
        "logo_data": cap.logo_data,
    }
    if len(json.dumps(rec)) > MAX_PROFILE_JSON:
        rec["logo_data"] = ""
    if len(json.dumps(rec)) > MAX_PROFILE_JSON:
        rec["design"] = {k: rec["design"][k] for k in ("colors", "fonts", "logo_url", "favicon_url", "scheme")}
    return rec


def to_markdown(rec: dict[str, Any], pages: list[dict[str, str]] | None = None) -> str:
    """The profile as a document for the knowledge base (vector search) and for people."""
    p, d = rec["profile"], rec["design"]
    name = p.get("name") or rec["brand"]
    lines = [
        f"# Brand and site profile: {name}",
        "",
        f"Source: {rec['url']}  ",
        f"Brand key: {rec['brand']}  ",
        f"Captured: {rec['captured_at']}  ",
        f"Site kind: {p.get('kind', '')}",
        "",
        "This profile was read from the website's own HTML and CSS. Use it when making anything for this brand.",
        "",
        "## What it is",
        p.get("what_it_is") or rec["content"].get("description") or "",
    ]
    if p.get("audience"):
        lines += ["", f"Audience: {p['audience']}"]
    for title, key in (("Offerings", "offerings"), ("Key facts", "key_facts"), ("Layout patterns", "layout_patterns")):
        if p.get(key):
            lines += ["", f"## {title}", *(f"- {x}" for x in p[key])]
    lines += ["", "## Brand colours"]
    lines += [f"- {e['role']}: {e['hex']}" + (f" ({e['note']})" if e.get("note") else "") for e in p.get("palette", [])]
    cols = d["colors"]
    lines += [f"- most used in the site's CSS: {', '.join(cols.get('most_used', []))}"]
    if cols.get("custom_properties"):
        lines += ["- CSS variables: " + ", ".join(f"{k} {v}" for k, v in list(cols["custom_properties"].items())[:12])]
    f, t = d["fonts"], p.get("typography", {})
    lines += [
        "",
        "## Typography",
        f"- headings: {t.get('heading') or f.get('heading', '')}",
        f"- body: {t.get('body') or f.get('body', '')}",
        f"- all families: {', '.join(f.get('families', []))}",
    ]
    if f.get("sizes"):
        lines.append(f"- common sizes: {', '.join(f['sizes'])}; weights: {', '.join(f.get('weights', []))}")
    if t.get("notes"):
        lines.append(f"- {t['notes']}")
    lines += [
        "",
        "## Look and feel",
        f"- {d.get('scheme', 'light')} theme" + (", with a dark mode" if d.get("has_dark_mode") else ""),
    ]
    if d.get("radius"):
        lines.append(f"- corner radius: {', '.join(d['radius'])}")
    if d.get("shadows"):
        lines.append(f"- shadows: {'; '.join(d['shadows'])}")
    if d.get("spacing"):
        lines.append(f"- spacing: {', '.join(d['spacing'])}")
    if d.get("logo_url"):
        lines.append(f"- logo: {d['logo_url']}")
    if p.get("tone_of_voice"):
        lines += ["", "## Tone of voice", p["tone_of_voice"]]
    for sect, title in (("store", "Store"), ("paper", "Paper"), ("docs", "Documentation")):
        s = p.get(sect)
        if isinstance(s, dict) and any(s.values()):
            lines += ["", f"## {title}"]
            for k, v in s.items():
                if v:
                    lines.append(f"- {k.replace('_', ' ')}: {', '.join(v) if isinstance(v, list) else v}")
    if pages:
        lines += ["", "## Main pages"]
        for pg in pages:
            lines += ["", f"### {pg['title'] or pg['url']}", pg["url"], "", pg["text"][:1500]]
    return "\n".join(lines).strip() + "\n"


def brand_graph(rec: dict[str, Any]) -> tuple[list[dict[str, str]], list[tuple[str, str, str]]]:
    """Entities and relationships that keep one brand apart from another in the graph: the brand node, and its
    colours, fonts and main pages named with the brand key, so two brands never share them."""
    p, d, key = rec["profile"], rec["design"], rec["brand"]
    name = (p.get("name") or key)[:100]
    kind = p.get("kind", "")
    etype = "project" if kind in ("project", "research-paper", "documentation") else "organization"
    ents = [{"name": name, "type": etype, "description": f"Brand profile from {key} ({kind})."}]
    rels: list[tuple[str, str, str]] = []
    if key and key.lower() != name.lower():
        ents.append({"name": key, "type": "concept", "description": f"The website of {name}."})
        rels.append((name, "has website", key))
    for e in p.get("palette", [])[:6]:
        n = f"{key} {e['role']} colour {e['hex']}"
        ents.append({"name": n, "type": "concept", "description": f"{name}'s {e['role']} colour."})
        rels.append((name, f"brand colour {e['role']}", n))
    fonts = [("heading", p.get("typography", {}).get("heading") or d["fonts"].get("heading")),
             ("body", p.get("typography", {}).get("body") or d["fonts"].get("body"))]  # fmt: skip
    for role, fam in fonts:
        if fam:
            n = f"{key} {role} font {fam}"
            if not any(x["name"] == n for x in ents):
                ents.append({"name": n, "type": "concept", "description": f"{name}'s {role} typeface."})
            rels.append((name, f"{role} font", n))
    return ents, rels
