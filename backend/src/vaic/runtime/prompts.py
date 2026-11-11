"""Prompts live in ``agents/**/*.md``. This reads them and fills the ``{{placeholders}}``.

Values placed into a prompt are data from the ledger; braces in them are neutralised so they cannot add
placeholders.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace

from vaic.shared.presets import preset_for
from vaic.shared.utility import agents_dir


@dataclass(frozen=True)
class Prompt:
    name: str = ""
    tools: list[str] = field(default_factory=list)
    body: str = ""


_FRONT = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.S)


def parse_prompt(text: str) -> Prompt:
    m = _FRONT.match(text)
    if not m:
        return Prompt(body=text.strip())
    meta: dict[str, str] = {}
    for line in m.group(1).split("\n"):
        i = line.find(":")
        if i > 0:
            meta[line[:i].strip()] = re.sub(r'^"|"$', "", line[i + 1 :].strip())
    tools = [t.strip() for t in meta.get("tools", "").split(",") if t.strip()]
    return Prompt(name=meta.get("name", ""), tools=tools, body=m.group(2).strip())


def render(body: str, vars: dict[str, str]) -> str:
    return re.sub(r"\{\{(\w+)\}\}", lambda m: re.sub(r"\{\{|\}\}", "", vars.get(m.group(1), "")), body)


def load_prompt(file: str, vars: dict[str, str] | None = None) -> Prompt:
    p = parse_prompt((agents_dir() / file).read_text(encoding="utf-8"))
    return replace(p, body=render(p.body, vars or {}))


def _department_file_key(department: str) -> str:
    preset = preset_for(department)  # "Data & Analytics", "Customer Support", "Engineering" → data, support, it
    return preset["key"] if preset else re.sub(r"[^a-z0-9]+", "-", department.lower())


def department_template(department: str) -> str:
    d = agents_dir() / "departments"
    f = d / f"{_department_file_key(department)}.md"
    return (f if f.is_file() else d / "default.md").read_text(encoding="utf-8").strip()


def department_worker_rules(department: str) -> str:
    """What every worker of a department must follow (``agents/departments/<key>.workers.md``), or nothing."""
    if not department:
        return ""
    f = agents_dir() / "departments" / f"{_department_file_key(department)}.workers.md"
    return f.read_text(encoding="utf-8").strip() if f.is_file() else ""
