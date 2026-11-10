"""The brand step on creative connector calls (decision 190, ``docs/KNOWLEDGE.md`` §16).

When any agent calls a Canva or Higgsfield tool, the city code (not the model) works out which stored brand the
work is for and adds that brand's profile to the call: the palette by role, named in plain colour words too (an
orange site gives an orange theme), the fonts with the closest kind as a fallback, the logo and the tone of voice.
It goes into the call's prompt-like text field. The tool's reply starts with what was applied.

Which brand: the ``vaic_brand`` the agent passed (a domain, a name, or ``none``), else the one picked earlier in this
turn, else the only brand the task names, else the only brand stored. With several brands and nothing to tell them
apart, the call is not sent: the agent is told to ask once and call again with ``vaic_brand``.
Profiles come from the owner's knowledge base and are site data: they only describe colours, fonts and tone.
"""

from __future__ import annotations

import colorsys
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from vaic.shared.knowledge.site_profile import brand_key

CREATIVE = {"canva": "Canva", "higgsfield": "Higgsfield"}
"""Connectors whose designs, images and videos get the brand: matched in the connector's id, label or URL."""
PROMPT_KEYS = ("prompt", "query", "design_brief", "brief", "text_prompt", "description", "instructions", "text")
BRAND_ARG = "vaic_brand"
NONE = "none"
_SERIF = re.compile(r"serif|georgia|times|garamond|merriweather|playfair|lora|baskerville|caslon|didot|bodoni|"
                    r"crimson|libre|roman|minion|cambria", re.I)  # fmt: skip
_MONO = re.compile(r"mono|code|courier|consolas|menlo", re.I)
_DISPLAY = re.compile(r"display|script|hand|brush|bebas|lobster|pacifico", re.I)
_GEOMETRIC = re.compile(r"grotesk|futura|montserrat|poppins|gotham|avenir|circular|manrope|sora|outfit|geist", re.I)


def is_creative(rec: dict[str, Any]) -> bool:
    hay = " ".join(str(rec.get(k) or "") for k in ("id", "label", "url", "registry_name")).lower()
    return any(k in hay for k in CREATIVE)


def colour_word(hexv: str) -> str:
    """A plain name for a colour, for image and video models that read words better than hex."""
    r, g, b = (int(hexv[i : i + 2], 16) / 255 for i in (1, 3, 5))
    h, light, sat = colorsys.rgb_to_hls(r, g, b)
    if light > 0.93:
        return "white"
    if light < 0.08:
        return "black"
    if sat < 0.12:
        return "light grey" if light > 0.6 else "dark grey" if light < 0.3 else "grey"
    deg = h * 360
    names = ((15, "red"), (45, "orange"), (65, "yellow"), (160, "green"), (200, "teal"), (255, "blue"),
             (290, "purple"), (335, "pink"), (360, "red"))  # fmt: skip
    name = next(n for limit, n in names if deg < limit)
    if name == "orange" and light < 0.35:
        name = "brown"
    shade = "dark " if light < 0.3 else "light " if light > 0.75 else ""
    return shade + name


def font_kind(name: str) -> str:
    if _MONO.search(name):
        return "monospace"
    if _SERIF.search(name) and not re.search(r"sans", name, re.I):
        return "serif"
    if _DISPLAY.search(name):
        return "display"
    if _GEOMETRIC.search(name):
        return "geometric sans-serif"
    return "sans-serif"


@dataclass(frozen=True)
class Brand:
    key: str
    name: str
    palette: tuple[tuple[str, str], ...]
    heading_font: str
    body_font: str
    logo_url: str
    tone: str

    def style(self) -> str:
        """The brand as one paragraph to add to a design, image or video prompt."""
        parts = [f"Use the {self.name} brand ({self.key})."]
        if self.palette:
            main = self.palette[0]
            parts.append(f"Theme colour: {colour_word(main[1])} ({main[1]}).")
            parts.append(
                "Palette by role: "
                + ", ".join(f"{role} {hexv} ({colour_word(hexv)})" for role, hexv in self.palette)
                + "."
            )
        fonts = []
        if self.heading_font:
            fonts.append(
                f"headings in {self.heading_font} (or the closest {font_kind(self.heading_font)} font available)"
            )
        if self.body_font and self.body_font != self.heading_font:
            fonts.append(f"body text in {self.body_font} (or the closest {font_kind(self.body_font)} font available)")
        if fonts:
            parts.append("Typography: " + "; ".join(fonts) + ".")
        if self.logo_url:
            parts.append(f"Logo: {self.logo_url}")
        if self.tone:
            parts.append(f"Tone of voice: {self.tone}")
        return " ".join(parts)


_HEX = re.compile(r"#[0-9a-f]{6}")


def _clean(v: Any, n: int) -> str:
    return re.sub(r"[\x00-\x1f<>`]", "", " ".join(str(v or "").split()))[:n]


def brand_from_item(item: dict[str, Any]) -> Brand | None:
    """The brand of one stored link (its ``site_profile``), or None. Only short, validated values are kept."""
    sp = item.get("site_profile")
    if not isinstance(sp, dict) or not item.get("brand"):
        return None
    prof, design = sp.get("profile") or {}, sp.get("design") or {}
    palette: list[tuple[str, str]] = []
    for e in prof.get("palette") or []:
        hexv = str(e.get("hex", "")).lower() if isinstance(e, dict) else ""
        if _HEX.fullmatch(hexv):
            palette.append((_clean(e.get("role"), 20) or "colour", hexv))
    if not palette:
        colors = design.get("colors") or {}
        for role in ("primary", "accent", "background", "text"):
            hexv = str(colors.get(role) or "").lower()
            if _HEX.fullmatch(hexv):
                palette.append((role, hexv))
    typo, fonts = prof.get("typography") or {}, design.get("fonts") or {}
    logo = str(design.get("logo_url") or "")
    return Brand(
        key=str(item["brand"]),
        name=_clean(prof.get("name") or item.get("title") or item["brand"], 80),
        palette=tuple(palette[:6]),
        heading_font=_clean(typo.get("heading") or fonts.get("heading"), 60),
        body_font=_clean(typo.get("body") or fonts.get("body"), 60),
        logo_url=logo if logo.startswith("https://") and len(logo) < 500 else "",
        tone=_clean(prof.get("tone_of_voice"), 200),
    )


@dataclass
class Ambiguous:
    brands: list[Brand]

    def message(self) -> str:
        names = "; ".join(f"{b.name} ({b.key})" for b in self.brands[:10])
        return (
            f"Not sent: several brands are stored ({names}) and nothing says which one this is for. Pick it from the "
            f"task. If the task doesn't say, ask once (ask_owner or ask_manager), then call again with "
            f'{BRAND_ARG} set to its domain, or "{NONE}" for no brand.'
        )


@dataclass
class BrandContext:
    """One turn's brands, and the one picked so far (it sticks for the rest of the turn)."""

    brands: list[Brand]
    hint: str = ""
    """The task's own words (ticket and message): a brand named there is the one."""
    chosen: Brand | None = None
    declined: bool = False
    _named: list[Brand] | None = field(default=None, repr=False)

    def named_in_hint(self) -> list[Brand]:
        if self._named is None:
            text = self.hint.lower()
            self._named = [
                b
                for b in self.brands
                if b.key.lower() in text
                or (len(b.name) >= 3 and re.search(rf"(?<!\w){re.escape(b.name.lower())}(?!\w)", text))
            ]
        return self._named

    def pick(self, asked: Any) -> Brand | Ambiguous | None:
        if isinstance(asked, str) and asked.strip():
            want = asked.strip()
            if want.lower() == NONE:
                self.declined, self.chosen = True, None
                return None
            key = brand_key(want)
            hit = next((b for b in self.brands if b.key == key or b.name.lower() == want.lower()), None)
            if hit:
                self.chosen, self.declined = hit, False
                return hit
        if self.chosen or self.declined:
            return self.chosen
        named = self.named_in_hint()
        if len(named) == 1:
            self.chosen = named[0]
            return self.chosen
        if len(self.brands) == 1 and not named:
            self.chosen = self.brands[0]
            return self.chosen
        if not self.brands:
            return None
        return Ambiguous(named or self.brands)


def prompt_field(schema: dict[str, Any], args: dict[str, Any]) -> str | None:
    """The call's prompt-like text field: one the schema lists as a string, present in the arguments."""
    props = schema.get("properties") or {}
    for k in PROMPT_KEYS:
        p = props.get(k)
        if isinstance(p, dict) and p.get("type") in ("string", None) and isinstance(args.get(k), str):
            return k
    return None


def with_brand_arg(schema: dict[str, Any], label: str) -> dict[str, Any]:
    """The tool's schema with ``vaic_brand`` (city-only: taken out before the call reaches the service)."""
    props = dict(schema.get("properties") or {})
    props[BRAND_ARG] = {
        "type": "string",
        "description": f"Which stored brand this {label} work is for: its web domain (acme.com) or name, or "
        f'"{NONE}". Optional: the city picks it from the task when it can, and applies its colours, fonts, logo '
        "and tone to the call.",
    }
    return {**schema, "properties": props}


@dataclass(frozen=True)
class Applied:
    args: dict[str, Any]
    note: str
    """What the agent is told in front of the tool's reply ("" when no brand was applied)."""
    stop: str = ""
    """Set when the call must not be sent (the brand is ambiguous): the reply to give instead."""


def apply_brand(ctx: BrandContext | None, schema: dict[str, Any], args: dict[str, Any]) -> Applied:
    clean = {k: v for k, v in args.items() if k != BRAND_ARG}
    if ctx is None:
        return Applied(clean, "")
    got = ctx.pick(args.get(BRAND_ARG))
    if isinstance(got, Ambiguous):
        return Applied(clean, "", got.message())
    if got is None:
        return Applied(clean, "")
    style = got.style()
    key = prompt_field(schema, clean)
    if key:
        clean[key] = f"{clean[key].rstrip()}\n\n{style}"
        return Applied(clean, f"[Brand applied to this call: {got.name} ({got.key}). {style}]")
    return Applied(
        clean,
        f"[This call has no text field for the brand, so apply it yourself in the next steps: {style}]",
    )


def is_bare_link(text: str) -> bool:
    """A message that is just one web link (maybe in angle brackets), nothing else."""
    return re.fullmatch(r"\s*<?https?://[^\s<>]{3,2000}>?\s*", text) is not None


BrandLoader = Callable[[], Awaitable[BrandContext | None]]


def brands_from_items(items: list[dict[str, Any]], hint: str) -> BrandContext | None:
    """The ready items with a brand profile, newest first, one per brand."""
    seen: set[str] = set()
    brands: list[Brand] = []
    for it in items:
        if it.get("status") != "ready":
            continue
        b = brand_from_item(it)
        if b and b.key not in seen:
            seen.add(b.key)
            brands.append(b)
    return BrandContext(brands, hint) if brands else None
