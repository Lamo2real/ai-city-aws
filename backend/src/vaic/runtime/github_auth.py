"""git and the GitHub CLI signed in as the owner, inside every VAIC and worker runtime (``docs/GITHUB_ACCESS.md``).

At the start of a runtime session, and again at each turn, the city's GitHub token (``vaic/prod/github``) is read.
When there is one: ``GH_TOKEN`` and ``GITHUB_TOKEN`` are set for ``gh``, git gets a credential helper for
``https://github.com`` that answers from the environment (nothing with the token in it is ever written to disk),
and commits are signed ``AI City <id+login@users.noreply.github.com>``, the token owner's own noreply address.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
from collections.abc import Callable, Mapping, MutableMapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from vaic.shared.github import GitHubDeps, GitHubError, noreply_email, whoami
from vaic.shared.log import log

GIT_CONFIG = "/tmp/vaic-git/config"  # noqa: S108  (the runtime's own disk; it holds no token)
"""The runtime's global git config (``GIT_CONFIG_GLOBAL``), so it holds whatever HOME a turn runs with."""
HELPER = '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'
"""A credential helper that reads the token from the environment at call time: no file ever holds it."""
AUTHOR = "AI City"

Run = Callable[[list[str], Mapping[str, str]], tuple[int, str]]
"""``run(argv, env) -> (exit code, output)``; the output is never logged."""


def subprocess_run(argv: list[str], env: Mapping[str, str]) -> tuple[int, str]:
    try:
        r = subprocess.run(argv, env=dict(env), capture_output=True, text=True, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, type(e).__name__
    return r.returncode, (r.stdout or "") + (r.stderr or "")


@dataclass
class GitAuth:
    deps: GitHubDeps
    env: MutableMapping[str, str] = field(default_factory=lambda: os.environ)
    run: Run = subprocess_run
    config_path: Path = Path(GIT_CONFIG)
    _configured: str | None = field(default=None, repr=False)
    """The token in place right now (so a new one pasted in Settings takes over within a few minutes)."""

    async def ensure(self) -> bool:
        """Puts the current token in place (or takes a removed one out). True when git and gh are signed in."""
        token = await self.deps.token()
        if token == self._configured:
            return bool(token)
        if not token:
            self._clear()
            return False
        user: dict[str, Any] | None = None
        try:
            user = await whoami(self.deps.get, token)
        except GitHubError as e:
            log("warn", "github.auth_user_failed", error=e.error)  # the token may still work; gh will say
        ok = await asyncio.to_thread(self._configure, token, user)
        self._configured = token
        return ok

    def _configure(self, token: str, user: dict[str, Any] | None) -> bool:
        self.env["GH_TOKEN"] = token
        self.env["GITHUB_TOKEN"] = token
        self.env["GIT_CONFIG_GLOBAL"] = str(self.config_path)
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.touch()
        for key, value in (
            ("credential.https://github.com.helper", HELPER),
            ("user.name", AUTHOR),
            ("user.email", noreply_email(user)),
            ("init.defaultBranch", "main"),
        ):
            code, _ = self.run(["git", "config", "--file", str(self.config_path), key, value], self.env)
            if code:
                log("warn", "github.git_config_failed", setting=key, exit=code)
        code, _ = self.run(["gh", "auth", "status", "--hostname", "github.com"], self.env)
        log("info" if code == 0 else "warn", "github.auth", ok=code == 0, login=(user or {}).get("login"))
        return code == 0

    def _clear(self) -> None:
        for k in ("GH_TOKEN", "GITHUB_TOKEN", "GIT_CONFIG_GLOBAL"):
            self.env.pop(k, None)
        if self._configured:
            self.config_path.unlink(missing_ok=True)
            log("info", "github.auth", ok=False, login=None)
        self._configured = None
