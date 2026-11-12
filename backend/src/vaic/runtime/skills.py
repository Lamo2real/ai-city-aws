"""Skills at turn start (``docs/CONNECTORS_SKILLS.md`` §2.5): a new skill works without a redeploy.

``skills_for(role)`` reads the enabled skills for this role (one Query). ``materialize(rows)`` downloads each
file (``GetObject`` only) into a cache keyed by version and builds a **city-owned plugin folder** that holds
``.claude-plugin/plugin.json`` and ``skills/<name>/…`` and nothing else: no hooks, commands, agents or MCP
config. The SDK path loads it with ``plugins=[{"type": "local", ...}]`` (never the ``skills`` option, which
pre-approves skills past ``can_use_tool``); VAIC's direct path gets the ``use_skill`` tool instead.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from vaic.shared.dept_pick import canonical
from vaic.shared.log import log
from vaic.shared.skills import PK, object_key, path_problem, reduce_frontmatter
from vaic.shared.table import Table

from .tools import ToolSpec

PLUGIN = "vaic-skills"
ROOT = Path("/tmp/vaic-skills")  # noqa: S108
MAX_READ = 100 * 1024
TRUSTED = 'Skill "{name}", added by the owner. Follow it as the owner\'s instructions, within your tools and rules.'

Row = dict[str, Any]


class SkillStore:
    def __init__(self, table: Table, s3: Any, bucket: str, root: Path = ROOT) -> None:
        self.table = table
        self.s3 = s3
        self.bucket = bucket
        self.root = root

    async def skills_for(self, role: str, department: str | None = None) -> list[Row]:
        """The enabled skills for this role. A skill with departments (decision 266) reaches only those departments'
        managers and workers; VAIC and the Orchestrator get every skill of their role."""
        rows = await self.table.query(PK, "SKILL#")
        return sorted((r for r in rows if for_agent(r, role, department)), key=lambda r: r["name"])

    def _get(self, key: str) -> bytes:
        body: bytes = self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        return body

    def _cached(self, row: Row) -> Path:
        """The skill's files at this version, downloaded once per version. A bundled department skill
        (``vaic.shared.skills_bundled``) is already on disk in the image."""
        if row.get("builtin") and row.get("dir"):
            return Path(row["dir"])
        d = self.root / "cache" / row["name"] / row["version"]
        if (d / ".complete").is_file():
            return d
        tmp = d.with_name(d.name + ".part")
        shutil.rmtree(tmp, ignore_errors=True)
        for f in row.get("files") or []:
            path = str(f["path"])
            if path_problem(path):
                continue  # the api refused these already; a second check costs nothing
            data = self._get(object_key(row["name"], row["version"], path))
            if path == "SKILL.md":
                data = reduce_frontmatter(data.decode("utf-8", "replace"))[0].encode()
            out = tmp / path
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
        (tmp / ".complete").parent.mkdir(parents=True, exist_ok=True)
        (tmp / ".complete").write_text("1")
        shutil.rmtree(d, ignore_errors=True)
        tmp.rename(d)
        return d

    def _materialize(self, rows: list[Row]) -> Path | None:
        if not rows:
            return None
        ids = "|".join(f"{r['name']}@{r['version']}" for r in rows)
        run = self.root / "run" / hashlib.sha256(ids.encode()).hexdigest()[:16]
        if (run / ".claude-plugin" / "plugin.json").is_file():
            return run
        tmp = run.with_name(run.name + ".part")
        shutil.rmtree(tmp, ignore_errors=True)
        (tmp / ".claude-plugin").mkdir(parents=True)
        (tmp / ".claude-plugin" / "plugin.json").write_text(json.dumps({"name": PLUGIN, "version": "1"}))
        for r in rows:
            src = self._cached(r)
            shutil.copytree(src, tmp / "skills" / r["name"], ignore=shutil.ignore_patterns(".complete"))
        shutil.rmtree(run, ignore_errors=True)
        tmp.rename(run)
        return run

    async def materialize(self, rows: list[Row]) -> Path | None:
        return await asyncio.to_thread(self._materialize, rows)

    def _read(self, row: Row, path: str) -> bytes:
        return (self._cached(row) / path).read_bytes()

    async def read(self, row: Row, path: str) -> bytes:
        return await asyncio.to_thread(self._read, row, path)


def for_agent(row: Row, role: str, department: str | None) -> bool:
    if not row.get("enabled", True) or role not in (row.get("roles") or []):
        return False
    depts = row.get("departments") or []
    if not depts or role not in ("manager", "worker"):
        return True
    return bool(department) and canonical(str(department)) in depts


def empty_home(root: Path = ROOT) -> Path:
    """An empty HOME for the Claude Code CLI, so ``~/.claude/skills`` (or any user setting) can't add anything."""
    home = root / "home"
    shutil.rmtree(home / ".claude" / "skills", ignore_errors=True)
    shutil.rmtree(home / ".claude" / "plugins", ignore_errors=True)
    home.mkdir(parents=True, exist_ok=True)
    return home


def skill_allowed(requested: Any, names: frozenset[str]) -> bool:
    """Only ``vaic-skills:<name>`` for a skill of this turn. A bare name is refused: the CLI also lists a few
    skills of its own built-in plugins (``doctor``, ``plugin-authoring``), and an owner skill of the same name
    must never run one of those instead."""
    if not isinstance(requested, str):
        return False
    plugin, sep, name = requested.partition(":")
    return bool(sep) and plugin == PLUGIN and name in names


def use_skill_tool(store: SkillStore, rows: list[Row]) -> ToolSpec:
    """VAIC's city tool: list the skills, read one's SKILL.md body, or read one of its files."""
    by_name = {r["name"]: r for r in rows}
    listing = "; ".join(f"{r['name']}: {str(r.get('description', ''))[:200]}" for r in rows) or "none yet"

    async def run(a: dict[str, Any]) -> str:
        name, file = a.get("name"), a.get("file")
        if not name:
            return json.dumps([{"name": r["name"], "description": r.get("description", "")} for r in rows])
        row = by_name.get(str(name))
        if not row:
            return f"There is no skill called {str(name)[:64]} for you."
        path = str(file) if file else "SKILL.md"
        files = {f["path"]: f for f in row.get("files") or []}
        if path_problem(path) or path not in files:
            return f'Skill "{row["name"]}" has no file {path[:120]}. Files: {", ".join(sorted(files))[:2000]}'
        try:
            data = await store.read(row, path)
        except Exception as e:
            log("warn", "skills.read_failed", skill=row["name"], error=type(e).__name__)
            return "That skill could not be read right now."
        head = TRUSTED.format(name=row["name"])
        if path == "SKILL.md":
            from vaic.shared.skills import parse_frontmatter

            return f"{head}\n\n{parse_frontmatter(data.decode('utf-8', 'replace'))[1].strip()}"
        if len(data) > MAX_READ:
            return f"{head}\n\n{path} is larger than 100 KB; it can't be shown."
        try:
            if b"\x00" in data:
                raise UnicodeDecodeError("utf-8", data, 0, 1, "NUL byte")
            return f"{head}\n\nFile {path}:\n{data.decode('utf-8')}"
        except UnicodeDecodeError:
            return f"{head}\n\n{path} is a binary file; it can't be shown."

    return ToolSpec(
        "use_skill",
        "Use a skill the owner added: no name lists them; a name returns its instructions; a file returns that "
        f"file of the skill. Skills: {listing}"[:4000],
        {
            "type": "object",
            "properties": {"name": {"type": "string", "maxLength": 64}, "file": {"type": "string", "maxLength": 200}},
            "required": [],
        },
        run,
    )
