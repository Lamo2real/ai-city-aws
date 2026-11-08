"""The pre-configured departments (decisions 113, 114): IT, Data & Analytics, Marketing, Sales, Customer Support,
Finance, Legal, Product and Operations, plus the tools and skills every department shares.

``config/departments.json`` is the one source. The Orchestrator is told the preset names so work lands in the right
department; a department created under a preset's name or alias gets that preset's manager template
(``agents/departments/<key>.md``) and its bundled skills (``agents/skills/<name>/SKILL.md``), plus the shared skills;
the HUD reads ``GET /departments/presets`` for Settings -> Departments, whose switches add the listed connectors.
"""

from __future__ import annotations

import re
from typing import Any

from .config import _load

Preset = dict[str, Any]


def _key(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s.lower().replace("&", " and ")).split())


def presets_config() -> dict[str, Any]:
    return _load("departments.json")


def presets() -> list[Preset]:
    return list(presets_config().get("departments") or [])


def shared() -> Preset:
    return dict(presets_config().get("shared") or {})


def catalog() -> dict[str, dict[str, Any]]:
    return dict(presets_config().get("connectors") or {})


def preset_for(name: str) -> Preset | None:
    """The preset a department name belongs to: its name, its key or one of its aliases (case, punctuation and
    "&"/"and" ignored), so "IT", "it-infrastructure" or "Engineering" all reach IT."""
    n = _key(name or "")
    if not n:
        return None
    for p in presets():
        if n in {_key(p["name"]), _key(p["key"]), *(_key(a) for a in p.get("aliases") or [])}:
            return p
    return None


def _connectors(ids: list[str], essential: list[str]) -> list[dict[str, Any]]:
    cat = catalog()
    return [{"id": c, **cat[c], "essential": c in essential} for c in ids if c in cat]


def _skills(names: list[str]) -> list[dict[str, str]]:
    from .skills_bundled import bundled_skill  # late: reads files from agents/

    out = []
    for s in names:
        b = bundled_skill(s)
        if b:
            out.append({"name": b["name"], "description": b["description"]})
    return out


def public_presets() -> dict[str, Any]:
    """What the HUD shows: the shared tools, then each department with its teams, skills and connectors."""
    sh = shared()
    return {
        "shared": {
            "name": sh.get("name", "Shared by every department"),
            "mission": sh.get("mission", ""),
            "skills": _skills(sh.get("skills") or []),
            "connectors": _connectors(sh.get("connectors") or [], sh.get("essential") or []),
        },
        "departments": [
            {
                "key": p["key"],
                "name": p["name"],
                "mission": p["mission"],
                "teams": p.get("teams") or [],
                "skills": _skills(p.get("skills") or []),
                "connectors": _connectors(p.get("connectors") or [], p.get("essential") or []),
            }
            for p in presets()
        ],
    }


def orchestrator_note() -> str:
    """One line per preset for the Orchestrator's context."""
    lines = [
        f"- {p['name']}: {p['mission']} Teams: {', '.join(t['name'] for t in p.get('teams') or [])}." for p in presets()
    ]
    return (
        "Pre-configured departments (create them with exactly these names when the work fits; they come with "
        "their own playbook, skills and connectors):\n" + "\n".join(lines)
    )
