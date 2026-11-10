"""Skill rules shared by the api Lambda (uploads) and the runtimes (``docs/CONNECTORS_SKILLS.md`` §2).

A skill is a folder with ``SKILL.md`` at its root. Only the owner adds skills. The frontmatter is reduced to
``name`` and ``description`` on upload and again when a runtime writes the files, because keys such as
``allowed-tools`` or ``hooks`` would get past the policy gate.
"""

from __future__ import annotations

import json
import re
from typing import Any

PK = "SKILLS"
ROLES = ("vaic", "orchestrator", "manager", "worker")
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
MAX_FILES = 100
MAX_BYTES = 4 * 1024 * 1024
MAX_DESCRIPTION = 1024
MAX_PATH = 200
_FORBIDDEN_PART = re.compile(r"^(\.claude-plugin|hooks|\.mcp\.json|settings[^/]*\.json)$", re.I)
_FRONT = re.compile(r"^﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(\r?\n|$)", re.S)


class SkillInvalid(ValueError):
    pass


def sk(name: str) -> str:
    return f"SKILL#{name}"


def object_key(name: str, version: str, path: str) -> str:
    return f"skills/{name}/{version}/{path}"


def path_problem(path: str) -> str | None:
    """None when ``path`` may be a file of a skill."""
    if not isinstance(path, str) or not path or len(path) > MAX_PATH:
        return "File paths must be 1 to 200 characters."
    if path.startswith("/") or "\\" in path or "\x00" in path:
        return f"{path[:80]} is not a relative path."
    parts = path.split("/")
    if any(p in ("", ".", "..") for p in parts):
        return f"{path[:80]} is not a plain relative path."
    if any(_FORBIDDEN_PART.match(p) for p in parts):
        return f"{path[:80]} can't be part of a skill (plugin, hook, MCP and settings files are refused)."
    return None


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Top-level ``key: value`` pairs (continuation lines join the previous key) and the body after it."""
    m = _FRONT.match(text)
    if not m:
        return {}, text
    meta: dict[str, str] = {}
    key: str | None = None
    for line in m.group(1).splitlines():
        km = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if km and not line[:1].isspace():
            key = km.group(1)
            meta[key] = km.group(2).strip()
        elif key is not None and line.strip():
            meta[key] = (meta[key] + " " + line.strip()).strip()
    for k, v in meta.items():
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            meta[k] = v[1:-1]
        elif v in ("|", ">", "|-", ">-"):
            meta[k] = ""
    return meta, text[m.end() :]


def reduce_frontmatter(text: str) -> tuple[str, dict[str, str], list[str]]:
    """SKILL.md with only ``name`` and ``description`` in its frontmatter, the two values, and the removed keys."""
    meta, body = parse_frontmatter(text)
    removed = sorted(k for k in meta if k not in ("name", "description"))
    kept: dict[str, str] = {k: meta[k] for k in ("name", "description") if k in meta}
    head = "---\n" + "".join(f"{k}: {json.dumps(v, ensure_ascii=False)}\n" for k, v in kept.items()) + "---\n"
    return head + body.lstrip("\r\n"), kept, removed


def valid_roles(v: Any) -> list[str]:
    if not isinstance(v, list) or not v or any(r not in ROLES for r in v):
        raise SkillInvalid("Roles must be some of VAIC, Orchestrator, Managers and Workers.")
    return [r for r in ROLES if r in v]


def public(row: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in row.items() if k not in ("pk", "sk")}
