"""The startup guard: every runtime calls this before anything else.

The product bills only through Amazon Bedrock with the execution role's credentials; anything else is refused.
"""

from __future__ import annotations

import os
from collections.abc import Mapping

FORBIDDEN_ENV = (
    "ANTHROPIC_API_KEY",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "AWS_BEARER_TOKEN_BEDROCK",
    "CLAUDE_CODE_USE_ANTHROPIC_AWS",
)


class StartupRefused(RuntimeError):
    pass


def startup_guard(env: Mapping[str, str] | None = None) -> None:
    e = os.environ if env is None else env
    if e.get("CLAUDE_CODE_USE_BEDROCK") != "1":
        raise StartupRefused(
            "Refusing to start: CLAUDE_CODE_USE_BEDROCK must be 1. AI City runs only on Amazon Bedrock."
        )
    # A value is never printed: only the variable's name.
    found = [k for k in FORBIDDEN_ENV if e.get(k)]
    if found:
        raise StartupRefused(
            f"Refusing to start: {', '.join(found)} must not be set. Bedrock is reached through the IAM role only."
        )
    if e.get("CLAUDE_CODE_SUBPROCESS_ENV_SCRUB") == "0":
        raise StartupRefused("Refusing to start: CLAUDE_CODE_SUBPROCESS_ENV_SCRUB must stay on for worker shells.")


def bedrock_env(region: str) -> dict[str, str]:
    """The environment every agent process gets, on top of the role's own."""
    return {
        "CLAUDE_CODE_USE_BEDROCK": "1",
        "AWS_REGION": region,
        "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1",
        "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "1",
    }
