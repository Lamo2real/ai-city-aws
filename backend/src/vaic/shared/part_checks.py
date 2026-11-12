"""The tests a part gets before any reviewer sees it (decision 289): code, no model, run in the worker's own runtime
on the files it changed, in parallel. JSON must load, an app keeps its ``index.html`` and every local file its pages
load exists, JavaScript must parse where Node is installed (``node --check``; the runtime image has no Node), and a
project with an ``npm test`` script runs it. Only what is there is checked; the result says
what ran, so a part that nothing could check goes to a reviewer instead of passing silently."""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

SKIP_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__", ".venv"}
MAX_FILES = 400
TEST_TIMEOUT_S = 120
CHECK_TIMEOUT_S = 20


_REF = re.compile(r"""<(?:script|img|link|audio|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"'#?]+)""", re.I)
_BRIDGE = {"vaic-bridge.js", "vaic-live.js"}
"""Files the city adds to every app itself."""


def _local_refs(html: str) -> list[str]:
    out = []
    for raw in _REF.findall(html):
        ref = raw.strip()
        if not ref or re.match(r"^(?:[a-z][a-z0-9+.-]*:|//|/)", ref, re.I):
            continue  # a URL, an absolute path or data: is not a file of the app
        out.append(ref)
    return out


@dataclass
class CheckResult:
    ran: list[str] = field(default_factory=list)
    """What was checked ("12 JavaScript files parse", "npm test")."""
    failures: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failures

    def text(self, cap: int = 3000) -> str:
        return "\n".join(self.failures)[:cap]


def _files(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob("*"):
        if len(out) >= MAX_FILES:
            break
        if p.is_file() and not any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            out.append(p)
    return out


async def _run(cmd: list[str], cwd: Path, limit_s: float) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=str(cwd), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), limit_s)
    except TimeoutError:
        proc.kill()
        return 124, f"timed out after {int(limit_s)} s"
    return proc.returncode or 0, out.decode("utf-8", "replace")[-2000:]


async def run_checks(root: Path, app: bool = False) -> CheckResult:
    """Checks the work under ``root`` (a worker's folder; its ``app/`` for an app)."""
    r = CheckResult()
    base = root / "app" if app and (root / "app").is_dir() else root
    if not base.is_dir():
        if app:
            r.failures.append("There is no app/ folder: call load_app, make the change there, then submit_app.")
        return r
    files = _files(base)
    if app:
        r.ran.append("the app has index.html")
        if not (base / "index.html").is_file():
            r.failures.append("app/index.html is missing.")
    pages = [f for f in files if f.suffix in (".html", ".htm")]
    for page in pages:
        for ref in _local_refs(page.read_text(encoding="utf-8", errors="replace")):
            if ref not in _BRIDGE and not (page.parent / ref).resolve().is_file():
                r.failures.append(f"{page.relative_to(root)} loads {ref}, which does not exist.")
    if pages:
        r.ran.append("every file the pages load exists")
    for p in (f for f in files if f.suffix == ".json"):
        try:
            json.loads(p.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            r.failures.append(f"{p.relative_to(root)} is not valid JSON: {e}")
    if any(f.suffix == ".json" for f in files):
        r.ran.append("JSON files load")
    node = shutil.which("node")
    js = [f for f in files if f.suffix in (".js", ".mjs", ".cjs")]
    if node and js:
        results = await asyncio.gather(*(_run([node, "--check", str(f)], base, CHECK_TIMEOUT_S) for f in js))
        for f, (code, out) in zip(js, results, strict=True):
            if code:
                r.failures.append(f"{f.relative_to(root)} does not parse:\n{out.strip()}")
        r.ran.append(f"{len(js)} JavaScript file{'s' if len(js) != 1 else ''} parse")
    pkg = base / "package.json"
    npm = shutil.which("npm")
    if npm and pkg.is_file() and (base / "node_modules").is_dir():
        try:
            has_test = bool((json.loads(pkg.read_text(encoding="utf-8")).get("scripts") or {}).get("test"))
        except ValueError:
            has_test = False
        if has_test:
            code, out = await _run([npm, "test", "--silent"], base, TEST_TIMEOUT_S)
            r.ran.append("npm test")
            if code:
                r.failures.append(f"npm test failed:\n{out.strip()}")
    return r
