"""Where and when a knowledge item holds (``docs/KNOWLEDGE.md`` §15).

Every item carries ``jurisdictions`` (ISO country codes, US states as ``US-XX``, the regions ``EU``/``EEA``/``EFTA``
or ``global``), a ``year`` with an optional in-force period, a ``topic``, a ``doc_type`` and a ``language``.
This module validates those fields, knows which regions a country belongs to (``config/jurisdictions.json``),
builds the Bedrock ``Retrieve`` filter for one market, and decides which items a newer one supersedes.
"""

from __future__ import annotations

import contextlib
import re
from datetime import UTC, date
from functools import cache
from typing import Any

from ..config import _load

GLOBAL = "global"
UTC_TZ = UTC
META_FIELDS = ("jurisdictions", "year", "in_force_from", "in_force_to", "topic", "doc_type", "language")
MAX_JURISDICTIONS = 12
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_LANG = re.compile(r"^[a-z]{2,3}$")


@cache
def jurisdictions_config() -> dict[str, Any]:
    return _load("jurisdictions.json")


def regions() -> dict[str, dict[str, Any]]:
    return dict(jurisdictions_config()["regions"])


def topics() -> list[str]:
    return list(jurisdictions_config()["topics"])


def doc_types() -> list[str]:
    return list(jurisdictions_config()["doc_types"])


@cache
def _names() -> dict[str, str]:
    """Lower-case name or code → canonical code."""
    c = jurisdictions_config()
    out: dict[str, str] = {GLOBAL: GLOBAL}
    for code, name in c["countries"].items():
        out[code.lower()] = code
        out[name.lower()] = code
    for code, r in c["regions"].items():
        out[code.lower()] = code
        out[str(r["name"]).lower()] = code
    for st, name in c["us_states"].items():
        out[f"us-{st.lower()}"] = f"US-{st}"
        out[name.lower()] = f"US-{st}"
    for alias, code in c["aliases"].items():
        out[alias.lower()] = code
    return out


def normalize(v: Any) -> str | None:
    """A code or a name ("Sweden", "se", "EU", "California", "US-CA", "global") → its code; None when unknown."""
    if not isinstance(v, str):
        return None
    s = " ".join(v.strip().split()).lower()
    if not s:
        return None
    hit = _names().get(s)
    if hit:
        return hit
    # Any other ISO 3166-2 subdivision of a known country (e.g. "CH-ZH", "DE-BY").
    m = re.fullmatch(r"([a-z]{2})-([a-z0-9]{1,3})", s)
    if m and m.group(1).upper() in jurisdictions_config()["countries"]:
        return f"{m.group(1).upper()}-{m.group(2).upper()}"
    return None


def is_region(code: str) -> bool:
    return code in regions() or code == GLOBAL


def country_of(code: str) -> str:
    """``US-CA`` → ``US``; a country, region or ``global`` stays as it is."""
    return code.split("-", 1)[0] if "-" in code else code


def parents(code: str) -> list[str]:
    """What a market also falls under: Sweden → EU, EEA; California → US; Switzerland → EFTA."""
    if code == GLOBAL:
        return []
    if "-" in code:
        country = country_of(code)
        return [country, *parents(country)]
    if code in regions():
        # Every EU member is in the EEA: a task for "the EU" also gets EEA-wide rules.
        return ["EEA"] if code == "EU" else []
    return [r for r, v in regions().items() if code in v["members"]]


def market_codes(market: str) -> list[str]:
    """The jurisdictions whose items hold in a market, the market itself first, ``global`` last."""
    return [market, *parents(market), GLOBAL] if market != GLOBAL else [GLOBAL]


def item_holds_in(item_jurisdictions: list[str] | None, market: str) -> bool:
    """True when an item tagged with these jurisdictions holds in the market.

    A country market also takes its own states and regions (US takes US-CA); a state market takes only itself,
    its country and the country's regions (US-CA never takes US-TX); a region market takes the region's own
    items, not one member country's.
    """
    codes = set(market_codes(market))
    for j in item_jurisdictions or []:
        if j in codes:
            return True
        if not is_region(market) and "-" not in market and country_of(j) == market:
            return True
    return False


def label(code: str) -> str:
    c = jurisdictions_config()
    if code == GLOBAL:
        return "Global"
    if code in c["countries"]:
        return str(c["countries"][code])
    if code in c["regions"]:
        return code
    if code.startswith("US-") and code[3:] in c["us_states"]:
        return f"{c['us_states'][code[3:]]} (US)"
    return code


def countries_attr(jurisdictions: list[str]) -> list[str]:
    """The ``countries`` metadata attribute: the country of each jurisdiction (regions kept as they are)."""
    return list(dict.fromkeys(country_of(j) for j in jurisdictions))


# ---------- validation (owner edits and the model's answer) ----------
class MetadataError(ValueError):
    """Plain words for the owner."""


def clean_jurisdictions(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        v = [x for x in re.split(r"[,;]", v) if x.strip()]
    if not isinstance(v, list):
        raise MetadataError("Countries must be a list such as SE, CH, US or EU.")
    out: list[str] = []
    bad: list[str] = []
    for x in v:
        code = normalize(x)
        if code is None:
            bad.append(str(x)[:40])
        elif code not in out:
            out.append(code)
    if bad:
        raise MetadataError(f"I don't know these places: {', '.join(bad)}. Use a country code like SE, or EU.")
    if len(out) > MAX_JURISDICTIONS:
        raise MetadataError(f"At most {MAX_JURISDICTIONS} countries or regions per item.")
    return out


def _year(v: Any, what: str) -> int | None:
    if v is None or v == "":
        return None
    if isinstance(v, str) and v.strip().isdigit():
        v = int(v.strip())
    if isinstance(v, bool) or not isinstance(v, int) or not 1800 <= v <= 2200:
        raise MetadataError(f"The {what} must be a year like 2026.")
    return v


def _date(v: Any, what: str) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, int) and not isinstance(v, bool):
        v = f"{v}-01-01"
    if not isinstance(v, str):
        raise MetadataError(f"The {what} must be a date like 2026-01-01.")
    s = v.strip()
    if re.fullmatch(r"\d{4}", s):
        s += "-01-01"
    if not _DATE.match(s):
        raise MetadataError(f"The {what} must be a date like 2026-01-01.")
    try:
        date.fromisoformat(s)
    except ValueError as e:
        raise MetadataError(f"The {what} is not a real date.") from e
    return s


def _choice(v: Any, allowed: list[str], what: str) -> str | None:
    if v is None or v == "":
        return None
    s = str(v).strip().lower().replace(" ", "-").replace("_", "-")
    s = {"data-protection": "privacy", "privacy/data-protection": "privacy", "labour": "employment",
         "labor": "employment", "ip": "intellectual-property", "policy": "internal-policy",
         "internal": "internal-policy"}.get(s, s)  # fmt: skip
    if s not in allowed:
        raise MetadataError(f"The {what} must be one of: {', '.join(allowed)}.")
    return s


def clean_metadata(b: dict[str, Any], partial: bool = False) -> dict[str, Any]:
    """The metadata fields present in ``b``, validated. ``partial``: only the keys given (an owner's edit)."""
    out: dict[str, Any] = {}
    keys = [k for k in META_FIELDS if k in b] if partial else list(META_FIELDS)
    for k in keys:
        v = b.get(k)
        if k == "jurisdictions":
            out[k] = clean_jurisdictions(v)
        elif k == "year":
            out[k] = _year(v, "year")
        elif k in ("in_force_from", "in_force_to"):
            out[k] = _date(v, "start date" if k == "in_force_from" else "end date")
        elif k == "topic":
            out[k] = _choice(v, topics(), "topic")
        elif k == "doc_type":
            out[k] = _choice(v, doc_types(), "document type")
        elif k == "language":
            s = str(v or "").strip().lower()[:3] or None
            if s is not None and not _LANG.match(s):
                raise MetadataError("The language must be a code like en, sv or de.")
            out[k] = s
    f, t = out.get("in_force_from"), out.get("in_force_to")
    if f and t and t < f:
        raise MetadataError("The end date is before the start date.")
    if "year" in out and out["year"] is None and f:
        out["year"] = int(f[:4])
    return out


def clean_detected(b: Any) -> dict[str, Any]:
    """The model's answer, forgiving: anything that doesn't validate is dropped field by field."""
    out: dict[str, Any] = {k: None for k in META_FIELDS}
    out["jurisdictions"] = []
    if not isinstance(b, dict):
        return out
    js = b.get("jurisdictions")
    if isinstance(js, list):
        out["jurisdictions"] = [c for c in (normalize(x) for x in js) if c][:MAX_JURISDICTIONS]
        out["jurisdictions"] = list(dict.fromkeys(out["jurisdictions"]))
    for k in META_FIELDS[1:]:
        with contextlib.suppress(MetadataError):
            out.update(clean_metadata({k: b.get(k)}, partial=True))
    if out.get("year") is None and out.get("in_force_from"):
        out["year"] = int(out["in_force_from"][:4])
    return out


_YEAR_IN_NAME = re.compile(r"(?<!\d)(19[5-9]\d|20\d\d|21\d\d)(?!\d)")


def hints_from_name(*names: str) -> dict[str, Any]:
    """Cheap hints from the file name and folder ("tax/Sweden/2026 income tax.pdf"): countries and a year."""
    js: list[str] = []
    year: int | None = None
    for n in names:
        for word in re.split(r"[\s/\\_.,()\[\]-]+", n or ""):
            if len(word) < 2:
                continue
            code = _names().get(word.lower())
            # Two-letter words only when written in capitals ("SE", "US"), so "de" or "in" don't count.
            if code and (len(word) > 2 or word.isupper()) and code not in js:
                js.append(code)
        m = _YEAR_IN_NAME.findall(n or "")
        if m and year is None:
            year = int(m[-1])
    return {"jurisdictions": js, "year": year}


# ---------- retrieval filter (Bedrock Retrieve) ----------
def _or(xs: list[dict[str, Any]]) -> dict[str, Any]:
    return xs[0] if len(xs) == 1 else {"orAll": xs}


def market_filter(market: str) -> dict[str, Any]:
    """Bedrock metadata filter for items that hold in one market (the post-filter in search re-checks it)."""
    parts: list[dict[str, Any]] = []
    if "-" in market or is_region(market):
        parts.append({"listContains": {"key": "jurisdictions", "value": market}})
    else:
        # The country and every state or region inside it (US-CA, US-NY) are under ``countries``.
        parts.append({"listContains": {"key": "countries", "value": market}})
    parts += [{"listContains": {"key": "jurisdictions", "value": p}} for p in market_codes(market)[1:]]
    return _or(parts)


def with_scopes(scopes: list[str], extra: dict[str, Any] | None) -> dict[str, Any]:
    scope = {"in": {"key": "scope", "value": list(scopes)}}
    return {"andAll": [scope, extra]} if extra else scope


def matches_filter(meta: dict[str, Any], f: dict[str, Any]) -> bool:
    """Evaluates the filter shapes built here against one document's metadata (for the fake KB in tests)."""
    if "andAll" in f:
        return all(matches_filter(meta, x) for x in f["andAll"])
    if "orAll" in f:
        return any(matches_filter(meta, x) for x in f["orAll"])
    if "in" in f:
        return meta.get(f["in"]["key"]) in f["in"]["value"]
    if "equals" in f:
        return bool(meta.get(f["equals"]["key"]) == f["equals"]["value"])
    if "notIn" in f:  # an attribute the document does not have passes, as in OpenSearch's must_not
        v = meta.get(f["notIn"]["key"])
        return v is None or v not in f["notIn"]["value"]
    if "listContains" in f:
        v = meta.get(f["listContains"]["key"])
        return isinstance(v, list) and f["listContains"]["value"] in v
    raise ValueError(f"filter not supported: {sorted(f)}")


# ---------- time: in force, superseded ----------
def _yr(d: str | None) -> int | None:
    return int(d[:4]) if d else None


def in_force_status(item: dict[str, Any], year: int) -> str:
    """``in force`` | ``not yet in force`` | ``no longer in force`` for one target year (no supersession)."""
    start = _yr(item.get("in_force_from")) or item.get("year")
    end = _yr(item.get("in_force_to"))
    if start is not None and int(start) > year:
        return "not yet in force"
    if end is not None and end < year:
        return "no longer in force"
    return "in force"


def superseded_map(items: list[dict[str, Any]], year: int) -> dict[str, str]:
    """item id → the id of the newer item that replaces it for ``year``.

    Same topic (not ``other``), at least one jurisdiction in common, a later ``year`` that is itself in force in
    ``year``. The older item is kept and shown; agents use the newer one unless the task names the period.
    """
    usable = [
        i for i in items
        if i.get("status") == "ready" and i.get("topic") not in (None, "other") and i.get("year") is not None
        and i.get("jurisdictions")
    ]  # fmt: skip
    out: dict[str, str] = {}
    for a in usable:
        best: dict[str, Any] | None = None
        for b in usable:
            if b is a or b["topic"] != a["topic"] or int(b["year"]) <= int(a["year"]):
                continue
            if not set(b["jurisdictions"]) & set(a["jurisdictions"]):
                continue
            if in_force_status(b, year) != "in force":
                continue
            if best is None or int(b["year"]) > int(best["year"]):
                best = b
        if best is not None:
            out[str(a["id"])] = str(best["id"])
    return out


def status_for(item: dict[str, Any], year: int, superseded: dict[str, str], years: dict[str, int]) -> str:
    """The words an agent sees: ``in force``, ``superseded by k-… (2026)``, ``not yet in force``…"""
    s = in_force_status(item, year)
    if s == "in force" and item.get("id") in superseded:
        newer = superseded[item["id"]]
        return f"superseded by {newer} ({years.get(newer, '?')})"
    return s
