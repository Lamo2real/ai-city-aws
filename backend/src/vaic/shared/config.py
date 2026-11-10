"""The repo's config files, loaded once.

In the Lambda zip and the runtime image the files are copied to ``vaic/_config``; in the repository they
live in ``config/`` at the root. ``VAIC_CONFIG_DIR`` overrides both.
"""

from __future__ import annotations

import json
import os
from functools import cache
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve()


@cache
def config_dir() -> Path:
    env = os.environ.get("VAIC_CONFIG_DIR")
    if env:
        return Path(env)
    bundled = _HERE.parent.parent / "_config"
    if bundled.is_dir():
        return bundled
    for parent in _HERE.parents:
        if (parent / "config" / "models.json").is_file():
            return parent / "config"
    raise FileNotFoundError("config/ not found; set VAIC_CONFIG_DIR")


@cache
def _load(name: str) -> dict[str, Any]:
    with (config_dir() / name).open(encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
    return data


def models_config() -> dict[str, Any]:
    return _load("models.json")


def caps_config() -> dict[str, Any]:
    return _load("caps.json")


def voice_config() -> dict[str, Any]:
    """VAIC's real-time voice (Nova 2 Sonic, decision 120): the models to try in order, the voice and endpointing."""
    return dict(models_config().get("voice") or {})


def policy_config() -> dict[str, Any]:
    return _load("policy.json")


def repo_root() -> Path | None:
    """The repository root when running from a checkout (tests, scripts); None inside a bundle."""
    for parent in _HERE.parents:
        if (parent / "config" / "models.json").is_file() and (parent / "infra").is_dir():
            return parent
    return None
