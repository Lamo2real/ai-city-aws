"""Opt-in (``VAIC_CLI_CHECK=1``): starts the Claude Code CLI bundled with the Agent SDK, with the city's options,
and reads the skills its init message lists. The model endpoint is a dead localhost port, so no model is
called and nothing leaves the machine; the turn then fails, which is expected.

It shows that, with ``setting_sources=[]``, an empty HOME and the two CLI switches, only the city's plugin
skills (plus two of the CLI's built-in plugins, which ``can_use_tool`` denies) are offered, and that skills in
the project's ``.claude/skills`` or in ``HOME/.claude/skills`` are not.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest

pytestmark = pytest.mark.skipif(os.environ.get("VAIC_CLI_CHECK") != "1", reason="starts the real CLI; opt in")


def _skill(root: Path, name: str) -> None:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(f"---\nname: {name}\ndescription: test skill {name}\n---\nSay hi.\n")


async def test_the_cli_loads_only_the_city_plugin_skills(tmp_path: Path) -> None:
    from claude_agent_sdk import ClaudeAgentOptions, PermissionResultDeny, SystemMessage, query

    plugin = tmp_path / "plugin"
    (plugin / ".claude-plugin").mkdir(parents=True)
    (plugin / ".claude-plugin" / "plugin.json").write_text(json.dumps({"name": "vaic-skills", "version": "1"}))
    _skill(plugin / "skills", "city-skill")
    home = tmp_path / "home"
    _skill(home / ".claude" / "skills", "home-decoy")
    repo = tmp_path / "repo"
    _skill(repo / ".claude" / "skills", "project-decoy")
    env = {
        "HOME": str(home),
        "PATH": os.environ["PATH"],
        "CLAUDE_CODE_USE_BEDROCK": "1",
        "AWS_REGION": "eu-north-1",
        "AWS_ACCESS_KEY_ID": "AKIAFAKEFAKEFAKE",
        "AWS_SECRET_ACCESS_KEY": "fake",
        "ANTHROPIC_BEDROCK_BASE_URL": "http://127.0.0.1:9",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        "CLAUDE_CODE_DISABLE_BUNDLED_SKILLS": "1",
        "CLAUDE_CODE_DISABLE_POLICY_SKILLS": "1",
    }

    async def prompt() -> Any:
        yield {"type": "user", "message": {"role": "user", "content": "hi"}}

    async def deny(*_: Any) -> Any:
        return PermissionResultDeny(message="no")

    opts = ClaudeAgentOptions(
        model="eu.anthropic.test",
        allowed_tools=[],
        setting_sources=[],
        plugins=[{"type": "local", "path": str(plugin)}],
        cwd=str(repo),
        env=env,
        can_use_tool=deny,
        max_turns=1,
    )
    init: dict[str, Any] = {}
    try:
        async for m in query(prompt=prompt(), options=opts):
            if isinstance(m, SystemMessage) and m.subtype == "init":
                init = m.data
                break
    except Exception as e:  # the dead endpoint ends the turn
        print("turn ended as expected:", type(e).__name__)
    skills = init.get("skills") or []
    assert "vaic-skills:city-skill" in skills
    assert not [s for s in skills if "decoy" in s]
    assert set(skills) <= {"vaic-skills:city-skill", "doctor", "plugin-authoring"}
