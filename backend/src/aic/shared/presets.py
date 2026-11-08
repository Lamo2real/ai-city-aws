"""The pre-configured departments (decision 113): IT and Marketing, with their teams, skills and connectors.

``config/departments.json`` is the one source. The Orchestrator is told the preset names so IT or marketing work
lands in the right department; a department created under a preset's name or alias gets that preset's manager
template (``agents/departments/<key>.md``) and its bundled skills (``agents/skills/<name>/SKILL.md``); the HUD
reads ``GET /departments/presets`` for Settings -> Departments, whose switches add the listed connectors.
"""

from __future__ import annotations

import re
from typing import Any

from .config import _load

Preset = dict[str, Any]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def presets_config() -> dict[str, Any]:
    return _load("departments.json")


def presets() -> list[Preset]:
    return list(presets_config().get("departments") or [])


def catalog() -> dict[str, dict[str, Any]]:
    return dict(presets_config().get("connectors") or {})


def preset_for(name: str) -> Preset | None:
    """The preset a department name belongs to: its name, its key or one of its aliases (case and punctuation
    ignored), so "IT", "it-infrastructure" or "Engineering" all reach IT."""
    n = _norm(name or "")
    if not n:
        return None
    for p in presets():
        names = {_norm(p["name"]), _norm(p["key"]), *(_norm(a) for a in p.get("aliases") or [])}
        if n in names:
            return p
    return None


def public_presets() -> list[Preset]:
    """What the HUD shows: each department with its teams, skills (name and description) and connectors."""
    from .skills_bundled import bundled_skill  # late: reads files from agents/

    cat = catalog()
    out: list[Preset] = []
    for p in presets():
        skills = []
        for s in p.get("skills") or []:
            b = bundled_skill(s)
            if b:
                skills.append({"name": b["name"], "description": b["description"]})
        out.append(
            {
                "key": p["key"],
                "name": p["name"],
                "mission": p["mission"],
                "teams": p.get("teams") or [],
                "skills": skills,
                "connectors": [{"id": c, **cat[c]} for c in p.get("connectors") or [] if c in cat],
            }
        )
    return out


def orchestrator_note() -> str:
    """One line per preset for the Orchestrator's context."""
    lines = [
        f"- {p['name']}: {p['mission']} Teams: {', '.join(t['name'] for t in p.get('teams') or [])}." for p in presets()
    ]
    return (
        "Pre-configured departments (create them with exactly these names when the work fits; they come with "
        "their own playbook, skills and connectors):\n" + "\n".join(lines)
    )
