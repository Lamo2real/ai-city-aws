"""Department knowledge entries (``docs/KNOWLEDGE.md`` §17): schema, taxonomy, seed files and the indexed text.

Every department may have a default knowledge base under ``knowledge/seed/<department>/``: a ``_taxonomy.yaml``
and one Markdown file per entry (``<domain>/<slug>.md`` with YAML front matter). Adding a department is adding a
folder; nothing here names a department. The same schema validates seed files and the owner's own entries.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from ..config import _load as load_config
from ..config import repo_root
from ..ids import department_key

ENTRY_TYPES = ("principle", "playbook", "checklist", "benchmark", "policy", "glossary")
AUDIENCES = ("manager", "worker", "both")
CONFIDENCES = ("established", "vendor", "platform-claim", "contested", "inference")
VOLATILITIES = ("evergreen", "annual", "fast-moving")
ORIGINS = ("system", "user")
ITEM_PREFIX = "kn-"
"""An entry's record and index id is ``kn-`` + its entry id (the built-in guide, ``kn-builtin-guide``, is not one)."""
_SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
ENTRY_ID_RE = re.compile(rf"{_SLUG}\.{_SLUG}\.{_SLUG}")
MAX_TITLE = 200
MAX_SUMMARY = 500
MAX_BODY_CHARS = 20_000
MAX_LIST = 40
PART_WORDS = 180
"""Each indexed document (one per part) stays under Bedrock's default 300-token chunk, so every chunk the vector
store holds starts with the entry title and its heading path."""


class EntryError(ValueError):
    """A seed file or an owner's entry that does not fit the schema; the message is plain words."""


@dataclass(frozen=True)
class Taxonomy:
    department: str
    label: str
    seed_version: int
    domains: dict[str, str]
    platforms: dict[str, str]
    objectives: dict[str, str]
    concepts: list[dict[str, Any]] = field(default_factory=list)

    def concept_ids(self) -> set[str]:
        return {str(c["id"]) for c in self.concepts}


@dataclass(frozen=True)
class Entry:
    id: str
    department: str
    domain: str
    title: str
    summary: str
    type: str
    audience: str
    confidence: str
    volatility: str
    as_of: str
    review_by: str
    body: str
    platforms: tuple[str, ...] = ()
    objectives: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()
    related: tuple[str, ...] = ()
    requires: tuple[str, ...] = ()
    supersedes: tuple[str, ...] = ()
    seed_version: int = 1

    @property
    def item_id(self) -> str:
        return ITEM_PREFIX + self.id

    def fields(self) -> dict[str, Any]:
        """The schema fields as plain JSON (what the registry stores and the API returns)."""
        return {
            "entry_id": self.id,
            "department": self.department,
            "domain": self.domain,
            "title": self.title,
            "summary": self.summary,
            "type": self.type,
            "audience": self.audience,
            "confidence": self.confidence,
            "volatility": self.volatility,
            "as_of": self.as_of,
            "review_by": self.review_by,
            "platforms": list(self.platforms),
            "objectives": list(self.objectives),
            "sources": list(self.sources),
            "related": list(self.related),
            "requires": list(self.requires),
            "supersedes": list(self.supersedes),
            "seed_version": self.seed_version,
            "content": self.body,
        }

    def content_hash(self) -> str:
        """Over every field: an unchanged seed file is skipped, so nothing is re-embedded needlessly."""
        raw = json.dumps(self.fields(), sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ---------- locations ----------
def seed_root() -> Path:
    """``knowledge/seed``: bundled into the Lambda package as ``vaic/_knowledge/seed``."""
    env = os.environ.get("VAIC_KNOWLEDGE_SEED_DIR")
    if env:
        return Path(env)
    bundled = Path(__file__).resolve().parent.parent.parent / "_knowledge" / "seed"
    if bundled.is_dir():
        return bundled
    root = repo_root()
    if root:
        return root / "knowledge" / "seed"
    raise FileNotFoundError("knowledge/seed not found; set VAIC_KNOWLEDGE_SEED_DIR")


def seed_departments(root: Path | None = None) -> list[str]:
    """Departments with a default knowledge base: every folder holding a ``_taxonomy.yaml``."""
    try:
        base = root or seed_root()
    except FileNotFoundError:
        return []
    if not base.is_dir():
        return []
    return sorted(p.name for p in base.iterdir() if (p / "_taxonomy.yaml").is_file())


@cache
def _department_aliases() -> dict[str, str]:
    """Department name or key (as the ledger and the agents carry it) → the key the seed folders use."""
    out: dict[str, str] = {}
    try:
        for d in load_config("departments.json").get("departments", []):
            key = str(d.get("key") or "")
            if key:
                out[department_key(key)] = key
                out[department_key(str(d.get("name") or key))] = key
    except Exception:  # without the file every name is its own key
        return {}
    return out


def canonical_department(name: str | None) -> str | None:
    """``"Marketing"``, ``"marketing"`` → ``"marketing"``; ``"IT Infrastructure"`` → ``"infrastructure"``."""
    if not name:
        return None
    k = department_key(str(name))
    return _department_aliases().get(k, k)


def all_departments() -> list[str]:
    """Every known department key: the presets and the seeded folders (for the isolation filter)."""
    return sorted(set(_department_aliases().values()) | set(seed_departments()))


# ---------- parsing ----------
def split_front_matter(text: str) -> tuple[dict[str, Any], str]:
    m = re.match(r"\A---\n(.*?)\n---\n?(.*)\Z", text, re.S)
    if not m:
        raise EntryError("the file must start with YAML front matter between two '---' lines")
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        raise EntryError(f"the front matter is not valid YAML ({str(e).splitlines()[0]})") from e
    if not isinstance(meta, dict):
        raise EntryError("the front matter must be a mapping")
    return meta, m.group(2).strip()


def load_taxonomy(path: Path) -> Taxonomy:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    dept = str(data.get("department") or "")
    if not re.fullmatch(_SLUG, dept) or dept != path.parent.name:
        raise EntryError(f"{path}: department must be the folder name ({path.parent.name})")

    def ids(key: str) -> dict[str, str]:
        rows = data.get(key) or []
        out = {str(r["id"]): str(r.get("label") or r["id"]) for r in rows}
        if len(out) != len(rows) or not all(re.fullmatch(_SLUG, i) for i in out):
            raise EntryError(f"{path}: {key} ids must be unique lower-case slugs")
        return out

    concepts = list(data.get("concepts") or [])
    seen: set[str] = set()
    for c in concepts:
        cid = str(c.get("id") or "")
        if not re.fullmatch(_SLUG, cid) or cid in seen or not c.get("aliases"):
            raise EntryError(f"{path}: concept {cid!r} needs a unique slug id and at least one alias")
        seen.add(cid)
    for c in concepts:
        for m in c.get("measured_by") or []:
            if m not in seen:
                raise EntryError(f"{path}: concept {c['id']} is measured by unknown concept {m}")
    return Taxonomy(
        department=dept,
        label=str(data.get("label") or dept),
        seed_version=int(data.get("seed_version") or 1),
        domains=ids("domains"),
        platforms=ids("platforms"),
        objectives=ids("objectives"),
        concepts=concepts,
    )


def _str_list(meta: dict[str, Any], key: str) -> tuple[str, ...]:
    v = meta.get(key) or []
    if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
        raise EntryError(f"{key} must be a list of words")
    if len(v) > MAX_LIST:
        raise EntryError(f"{key} has more than {MAX_LIST} items")
    return tuple(dict.fromkeys(x.strip() for x in v))


def _date(meta: dict[str, Any], key: str) -> str:
    v = meta.get(key)
    if isinstance(v, date):
        return v.isoformat()
    try:
        return date.fromisoformat(str(v)).isoformat()
    except ValueError as e:
        raise EntryError(f"{key} must be a date like 2026-11-11") from e


def _choice(meta: dict[str, Any], key: str, allowed: tuple[str, ...]) -> str:
    v = str(meta.get(key) or "")
    if v not in allowed:
        raise EntryError(f"{key} must be one of {', '.join(allowed)}")
    return v


def _full_id(ref: str, department: str) -> str:
    """``related`` and friends may leave out the department: ``meta-ads.x`` means ``marketing.meta-ads.x``."""
    return ref if ref.count(".") == 2 else f"{department}.{ref}"


def entry_from_meta(meta: dict[str, Any], body: str, tax: Taxonomy) -> Entry:
    """Validates one entry against the schema and the department's taxonomy (cross-entry links are checked by
    ``validate_links``)."""
    eid = str(meta.get("id") or "")
    if not ENTRY_ID_RE.fullmatch(eid):
        raise EntryError("id must look like department.domain.slug (lower case, hyphens)")
    dept, domain, _slug = eid.split(".")
    if str(meta.get("department") or "") != tax.department or dept != tax.department:
        raise EntryError(f"department must be {tax.department} and the id must start with it")
    if str(meta.get("domain") or "") != domain:
        raise EntryError("domain must match the second part of the id")
    if domain not in tax.domains:
        raise EntryError(f"unknown domain {domain}; add it to the taxonomy first")
    title = str(meta.get("title") or "").strip()
    summary = " ".join(str(meta.get("summary") or "").split())
    if not title or len(title) > MAX_TITLE:
        raise EntryError(f"title is required (at most {MAX_TITLE} characters)")
    if not summary or len(summary) > MAX_SUMMARY:
        raise EntryError(f"summary is required (one or two sentences, at most {MAX_SUMMARY} characters)")
    if not body.strip() or len(body) > MAX_BODY_CHARS:
        raise EntryError(f"the entry text is required (at most {MAX_BODY_CHARS:,} characters)")
    platforms = _str_list(meta, "platforms")
    if bad := [p for p in platforms if p not in tax.platforms]:
        raise EntryError(f"unknown platforms: {', '.join(bad)}")
    objectives = _str_list(meta, "objectives")
    if bad := [o for o in objectives if o not in tax.objectives]:
        raise EntryError(f"unknown objectives: {', '.join(bad)}")
    sources = _str_list(meta, "sources")
    if bad := [s for s in sources if not re.match(r"https?://\S+$", s)]:
        raise EntryError(f"sources must be web links: {bad[0][:80]}")
    as_of, review_by = _date(meta, "as_of"), _date(meta, "review_by")
    if review_by <= as_of:
        raise EntryError("review_by must be after as_of")
    links = {k: tuple(_full_id(r, dept) for r in _str_list(meta, k)) for k in ("related", "requires", "supersedes")}
    for k, refs in links.items():
        if bad := [r for r in refs if not ENTRY_ID_RE.fullmatch(r) or r == eid]:
            raise EntryError(f"{k} has an invalid or self reference: {bad[0]}")
    try:
        seed_version = int(meta.get("seed_version") or 1)
    except (TypeError, ValueError) as e:
        raise EntryError("seed_version must be a whole number") from e
    return Entry(
        id=eid,
        department=dept,
        domain=domain,
        title=title,
        summary=summary,
        type=_choice(meta, "type", ENTRY_TYPES),
        audience=_choice(meta, "audience", AUDIENCES),
        confidence=_choice(meta, "confidence", CONFIDENCES),
        volatility=_choice(meta, "volatility", VOLATILITIES),
        as_of=as_of,
        review_by=review_by,
        body=body.strip(),
        platforms=platforms,
        objectives=objectives,
        sources=sources,
        related=links["related"],
        requires=links["requires"],
        supersedes=links["supersedes"],
        seed_version=max(1, seed_version),
    )


def entry_from_fields(f: dict[str, Any], tax: Taxonomy) -> Entry:
    """An entry from the API's JSON (the registry's field names: ``entry_id`` and ``content``)."""
    meta = {k: v for k, v in f.items() if k not in ("entry_id", "content")}
    meta["id"] = f.get("entry_id") or f.get("id")
    return entry_from_meta(meta, str(f.get("content") or ""), tax)


@dataclass
class SeedSet:
    taxonomies: dict[str, Taxonomy] = field(default_factory=dict)
    entries: dict[str, Entry] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def validate_links(entries: dict[str, Entry], known: set[str] | None = None) -> list[str]:
    """Every related, requires and supersedes target must exist (in the seed set, or ``known`` ids)."""
    ids = set(entries) | (known or set())
    out = []
    for e in entries.values():
        for k in ("related", "requires", "supersedes"):
            for r in getattr(e, k):
                if r not in ids:
                    out.append(f"{e.id}: {k} points to {r}, which does not exist")
    return out


def load_seeds(root: Path | None = None) -> SeedSet:
    """Reads and validates every department folder; errors are collected, never raised (the seeder decides)."""
    base = root or seed_root()
    out = SeedSet()
    for dept in seed_departments(base):
        try:
            tax = load_taxonomy(base / dept / "_taxonomy.yaml")
        except (EntryError, OSError, yaml.YAMLError, KeyError, TypeError, ValueError) as err:
            out.errors.append(f"{dept}/_taxonomy.yaml: {err}")
            continue
        out.taxonomies[dept] = tax
        for path in sorted((base / dept).rglob("*.md")):
            rel = path.relative_to(base).as_posix()
            if any(part.startswith("_") for part in path.relative_to(base / dept).parts):
                continue
            try:
                meta, body = split_front_matter(path.read_text(encoding="utf-8"))
                e = entry_from_meta(meta, body, tax)
            except (EntryError, OSError) as err:
                out.errors.append(f"{rel}: {err}")
                continue
            expect = f"{dept}/{e.domain}/{e.id.split('.')[-1]}.md"
            if rel != expect:
                out.errors.append(f"{rel}: the file must be at {expect} for id {e.id}")
                continue
            if e.id in out.entries:
                out.errors.append(f"{rel}: duplicate id {e.id}")
                continue
            out.entries[e.id] = e
    out.errors.extend(validate_links(out.entries))
    return out


def entry_markdown(e: Entry) -> str:
    """The seed-file form of an entry (front matter + body): what ``load_seeds`` reads back."""
    meta = {k: v for k, v in e.fields().items() if k not in ("entry_id", "content")}
    meta = {"id": e.id, **meta}
    for k in ("related", "requires", "supersedes"):
        if not meta[k]:
            del meta[k]
    fm = yaml.safe_dump(meta, sort_keys=False, allow_unicode=True, width=1000)
    return f"---\n{fm}---\n\n{e.body}\n"


# ---------- concepts (graph MENTIONS edges come only from the taxonomy) ----------
def _alias_pattern(alias: str) -> re.Pattern[str]:
    flags = 0 if alias.upper() == alias and any(ch.isalpha() for ch in alias) else re.I
    return re.compile(rf"(?<![\w-]){re.escape(alias)}(?![\w-])", flags)


def mentioned_concepts(e: Entry, tax: Taxonomy) -> list[str]:
    text = f"{e.title}\n{e.summary}\n{e.body}"
    out = []
    for c in tax.concepts:
        if any(_alias_pattern(str(a)).search(text) for a in c.get("aliases") or []):
            out.append(str(c["id"]))
    return out


# ---------- what goes into the vector store ----------
def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+(?=\*\*\[|[A-Z(])", text) if s.strip()]


def _pieces(text: str, words: int) -> list[str]:
    """Paragraph groups of at most ``words`` words; long paragraphs split at sentence ends, tables kept whole."""
    units: list[tuple[str, str]] = []
    for para in [p.strip() for p in text.split("\n\n") if p.strip()]:
        if para.startswith("|") or len(para.split()) <= words:
            units.append((para, "\n\n"))
        else:
            units.extend((s, "\n\n" if i == 0 else " ") for i, s in enumerate(_sentences(para)))
    out: list[str] = []
    cur, n = "", 0
    for u, joiner in units:
        w = len(u.split())
        if cur and n + w > words:
            out.append(cur)
            cur, n = "", 0
        cur = u if not cur else cur + joiner + u
        n += w
    if cur:
        out.append(cur)
    return out


def index_parts(e: Entry, department_label: str, words: int = PART_WORDS) -> list[str]:
    """The documents indexed for one entry, in order (``<entry id>#<n>``). Part 0 is the card: title, summary,
    domain, platforms, dates and confidence; every other part starts with ``title › heading``."""
    head = [
        f"# {e.title}",
        f"{department_label} knowledge · domain: {e.domain} · type: {e.type} · audience: {e.audience}"
        + (f" · platforms: {', '.join(e.platforms)}" if e.platforms else ""),
        f"As of {e.as_of}; review by {e.review_by}; volatility: {e.volatility}; confidence: {e.confidence}.",
        f"Summary: {e.summary}",
    ]
    parts = ["\n".join(head)]
    heading = ""
    section: list[str] = []

    def flush() -> None:
        body = "\n".join(section).strip()
        if body and not heading and len(parts) == 1:
            parts[0] += "\n\n" + body  # the text before the first heading belongs on the card
        elif body:
            for piece in _pieces(body, words):
                parts.append(f"{e.title} › {heading}\n\n{piece}" if heading else f"{e.title}\n\n{piece}")

    for line in e.body.splitlines():
        if line.startswith("#"):
            flush()
            section = []
            heading = line.lstrip("#").strip()
            if line.startswith("# "):
                heading = ""
        else:
            section.append(line)
    flush()
    return parts


def kb_entry_metadata(e: Entry, origin: str, part: int) -> dict[str, Any]:
    """The filterable attributes on every part (``department`` is what isolation filters on)."""
    out: dict[str, Any] = {
        "item_id": e.item_id,
        "scope": "relevant",
        "kind": "document",
        "department": e.department,
        "domain": e.domain,
        "entry_type": e.type,
        "audience": e.audience,
        "volatility": e.volatility,
        "confidence": e.confidence,
        "origin": origin,
        "part": part,
    }
    if e.platforms:
        out["platforms"] = list(e.platforms)
    return out


def embedding_model() -> str:
    """The pinned embedding model; stored on every entry so a model change re-embeds them all."""
    cfg = load_config("models.json").get("embeddings", {}).get("knowledge", {})
    return str(cfg.get("modelId") or "")
