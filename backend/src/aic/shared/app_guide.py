"""The AI City guide (``agents/help/app_guide.md``): how to use every part of the app.

AIC carries it with its instructions, so "how do I add a connector?" is answered at once (the owner, 2026-11-09); the
Knowledge base holds it as a built-in, read-only PDF (``aic/shared/knowledge/builtin.py``).
"""

from __future__ import annotations

from functools import cache

from aic.shared.utility import agents_dir


@cache
def app_guide() -> str:
    return (agents_dir() / "help" / "app_guide.md").read_text(encoding="utf-8").strip()
