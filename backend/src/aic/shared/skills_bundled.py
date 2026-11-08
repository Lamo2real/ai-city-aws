"""Skills that ship with AI City for the pre-configured departments (decision 113).

Each is ``agents/skills/<name>/SKILL.md`` with ``name`` and ``description`` frontmatter, the same shape as an owner
skill. A manager or worker in a preset department (``presets.preset_for``) gets its department's bundled skills next
to the owner's own; an owner skill with the same name wins. They are read-only: no upload, no S3, no version table.
"""

from __future__ import annotations

import hashlib
from functools import cache
from pathlib import Path
from typing import Any

from .presets import preset_for
from .skills import reduce_frontmatter
from .utility import agents_dir


def _dir() -> Path:
    return agents_dir() / "skills"


@cache
def bundled_skill(name: str) -> dict[str, Any] | None:
    """A skill row (like the owner's) for a bundled skill, with ``dir`` pointing at its folder; None if absent."""
    d = _dir() / name
    md = d / "SKILL.md"
    if not md.is_file():
        return None
    meta = reduce_frontmatter(md.read_text(encoding="utf-8"))[1]
    files = sorted(p for p in d.rglob("*") if p.is_file())
    digest = hashlib.sha256(b"".join(p.read_bytes() for p in files)).hexdigest()[:12]
    return {
        "name": name,
        "description": str(meta.get("description") or "")[:1024],
        "version": f"builtin-{digest}",
        "files": [{"path": str(p.relative_to(d)), "size": p.stat().st_size} for p in files],
        "enabled": True,
        "builtin": True,
        "dir": str(d),
    }


def department_skills(department_name: str) -> list[dict[str, Any]]:
    """The bundled skills of the preset this department belongs to (none for any other department)."""
    p = preset_for(department_name)
    if not p:
        return []
    rows = [bundled_skill(s) for s in p.get("skills") or []]
    return [r for r in rows if r]
