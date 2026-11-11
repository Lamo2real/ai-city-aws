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
from .ids import department_key, manager_id

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


_FILLER = re.compile(r"\b(the|my|our|an?|mcp|server|connector|integration|app|account|api|tool|access|to|for|on)\b")


def _names(id: str, entry: dict[str, Any]) -> set[str]:
    label = str(entry.get("label") or id)
    names = {
        id.replace("-", " "),
        label,
        label.split("(", maxsplit=1)[0],
        label.split(".", maxsplit=1)[0],
        *entry.get("aka", []),
    }
    return {k for n in names if (k := _key(n))}


def find_service(query: str) -> dict[str, Any] | None:
    """The catalog service, or the service that can't be connected, that the owner's words name (decision 130).

    ``{"kind": "catalog", "id", **entry}`` for a checked server, ``{"kind": "not_offered", "id", "label", "why",
    "instead": [catalog entries]}`` for one like LinkedIn, else None (the MCP Registry is searched next)."""
    q = _key(query)
    q = " ".join(_FILLER.sub(" ", q).split()) or q
    if not q or "://" in query:
        return None
    for id, e in (presets_config().get("not_offered") or {}).items():
        if q in _names(id, e):
            cat = catalog()
            instead = [{"id": i, **cat[i]} for i in e.get("instead", []) if i in cat]
            return {"kind": "not_offered", "id": id, "label": e["label"], "why": e["why"], "instead": instead}
    for id, e in catalog().items():
        if q in _names(id, e):
            return {"kind": "catalog", "id": id, **e}
    return None


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


def replaced_by(name: str) -> Preset | None:
    """The preset that took over an older department of this name (``replaces``, decision 220): "Apps" is
    Application. That name always means the preset, and nothing builds it again."""
    n = _key(name or "")
    for p in presets():
        if n and n in {_key(r) for r in p.get("replaces") or []}:
            return p
    return None


_GENERIC = {"and", "of", "the", "for", "a", "an", "to", "in", "on", "with", "team", "teams", "department",
            "dept", "new", "own", "owner", "s", "everything", "business", "work", "what", "from", "all"}  # fmt: skip


def _tokens(text: str) -> set[str]:
    out = set()
    for word in _key(text).split():
        w = word[:-1] if len(word) > 3 and word.endswith("s") and not word.endswith("ss") else word
        if w not in _GENERIC and len(w) > 1:
            out.add(w)
    return out


def _vocabulary(dept: dict[str, Any]) -> set[str]:
    name = str(dept.get("name", ""))
    p = preset_for(name)
    words = [name, str(dept.get("mission") or "")]
    if p and _key(p["name"]) == _key(name):
        words += [p["key"], p["mission"], *(p.get("aliases") or []), *(t["name"] for t in p.get("teams") or [])]
        words += [str(t.get("does") or "") for t in p.get("teams") or []]
    return set().union(*(_tokens(w) for w in words))


def overlapping(name: str, standing: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The standing department whose work a new department called ``name`` would overlap (decision 220), or None.

    A name that already is a standing department (its own name or a preset alias) is not an overlap: it is that
    department. Otherwise the new name's words are matched against each department's name, mission, aliases and
    teams; the best match wins (the earlier one on a tie)."""
    resolved = preset_for(name) or replaced_by(name)
    target = _key(resolved["name"] if resolved else name)
    if any(_key(str(x.get("name", ""))) == target for x in standing):
        return None
    words = _tokens(name)
    best, score = None, 0
    for x in standing:
        hit = len(words & _vocabulary(x))
        if hit > score:
            best, score = x, hit
    return best


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


def orchestrator_note(demolished: set[str] | None = None) -> str:
    """One line per preset for the Orchestrator's context (minus the ones the owner demolished, by key)."""
    gone = demolished or set()
    lines = [
        f"- {p['name']}: {p['mission']} Teams: {', '.join(t['name'] for t in p.get('teams') or [])}."
        for p in presets()
        if department_key(p["name"]) not in gone
    ]
    return (
        "Pre-configured departments (create them with exactly these names when the work fits; they come with "
        "their own playbook, skills and connectors):\n" + "\n".join(lines)
    )


async def ensure_presets(ledger: Any) -> list[str]:
    """Every preset department exists from the start (the owner's rule, decision 119): the ones missing are
    created, in the presets' order, so their towers stand in the City before any work arrives (and again after a
    Start over). Their managers are hired with the first goal (`ensure_manager` in the city tools), so an idle city
    shows empty towers, not a crowd of idle managers. Returns the names it created."""
    # A preset the owner demolished stays demolished (decision 134): its record is still there.
    have = {department_key(str(x.get("name", ""))) for x in await ledger.list_departments(include_demolished=True)}
    made = []
    for p in presets():
        if department_key(p["name"]) in have:
            continue
        _, created = await ledger.create_department(p["name"], p["mission"], manager_id(p["name"]))
        if created:
            made.append(p["name"])
    return made
