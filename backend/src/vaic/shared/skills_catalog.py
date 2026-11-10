"""Skills → Discover (decision 188): the skills the owner can browse and add in one tap.

Two kinds, both read from the repo (shipped in the Lambda as ``vaic/_agents``), never from the web:

* the curated catalog, ``agents/skill-catalog/<name>/SKILL.md`` with ``agents/skill-catalog/catalog.json`` (title,
  departments it is for, the featured one), written for AI City;
* the City's own built-in department skills (``agents/skills``, decision 113), which their departments already use;
  adding one gives it to every role and department the owner picks.

Adding one goes through ``skills_api`` exactly like an upload (same checks, roles, storage and versioning). A remote
catalog could later supply more ``entries`` with files fetched at install time; nothing here assumes the repo beyond
``_files``.
"""

from __future__ import annotations

import json
import re
from functools import cache
from pathlib import Path
from typing import Any

from .presets import presets, shared
from .skills import parse_frontmatter
from .utility import agents_dir

CATALOG_SOURCE = "AI City catalog"
ALL_DEPARTMENTS = "Every department"


def _catalog_dir() -> Path:
    return agents_dir() / "skill-catalog"


def _builtin_dir() -> Path:
    return agents_dir() / "skills"


def _title(name: str) -> str:
    return name.replace("-", " ").capitalize()


def _read(d: Path) -> dict[str, Any] | None:
    md = d / "SKILL.md"
    if not md.is_file():
        return None
    meta, body = parse_frontmatter(md.read_text(encoding="utf-8"))
    files = sorted(p for p in d.rglob("*") if p.is_file())
    return {"description": str(meta.get("description") or "")[:1024], "files": len(files), "body": body}


@cache
def entries() -> tuple[dict[str, Any], ...]:
    """Every skill in Discover, catalog first, then the built-ins; each with name, title, description, departments,
    source, builtin, featured and its file count."""
    out: list[dict[str, Any]] = []
    index = json.loads((_catalog_dir() / "catalog.json").read_text(encoding="utf-8"))
    featured = index.get("featured")
    for e in index.get("skills") or []:
        got = _read(_catalog_dir() / e["name"])
        if not got:
            continue
        out.append(
            {
                "name": e["name"],
                "title": e.get("title") or _title(e["name"]),
                "description": got["description"],
                "departments": list(e.get("departments") or []),
                "source": CATALOG_SOURCE,
                "builtin": False,
                "featured": e["name"] == featured,
                "files": got["files"],
            }
        )
    # Built-ins: who already uses each, from config/departments.json.
    used: dict[str, list[str]] = {}
    for s in shared().get("skills") or []:
        used.setdefault(s, []).append(ALL_DEPARTMENTS)
    for p in presets():
        for s in p.get("skills") or []:
            used.setdefault(s, []).append(p["name"])
    seen = {e["name"] for e in out}
    for name in sorted(used):
        got = _read(_builtin_dir() / name)
        if not got or name in seen:
            continue
        depts = used[name]
        out.append(
            {
                "name": name,
                "title": _title(name),
                "description": got["description"],
                "departments": depts,
                "source": "Built into " + (ALL_DEPARTMENTS.lower() if ALL_DEPARTMENTS in depts else ", ".join(depts)),
                "builtin": True,
                "featured": False,
                "files": got["files"],
            }
        )
    return tuple(out)


def find(name: str) -> dict[str, Any] | None:
    return next((e for e in entries() if e["name"] == name), None)


def _folder(e: dict[str, Any]) -> Path:
    return (_builtin_dir() if e["builtin"] else _catalog_dir()) / e["name"]


def files(e: dict[str, Any]) -> dict[str, bytes]:
    """The skill's files by relative path, as an upload would send them."""
    d = _folder(e)
    return {str(p.relative_to(d)): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()}


def skill_md(e: dict[str, Any]) -> str:
    return (_folder(e) / "SKILL.md").read_text(encoding="utf-8")


def _words(s: str) -> list[str]:
    return re.findall(r"[a-z0-9&]+", s.lower())


def search(q: str = "", department: str = "") -> list[dict[str, Any]]:
    """Entries matching every word of ``q`` (name, title, description, departments) and, when given, a department."""
    words = _words(q)
    out = []
    for e in entries():
        if department and department not in e["departments"] and ALL_DEPARTMENTS not in e["departments"]:
            continue
        hay = " ".join([e["name"], e["title"], e["description"], *e["departments"]]).lower()
        if all(w in hay for w in words):
            out.append(e)
    return out


def departments() -> list[str]:
    """The City's departments in their own order, as Discover's filters (only those with a skill)."""
    have = {d for e in entries() for d in e["departments"]}
    return [p["name"] for p in presets() if p["name"] in have]
