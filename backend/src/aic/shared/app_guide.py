"""The AI City guide (``agents/help/app_guide.md``): how to use every part of the app.

AIC carries it with its instructions, so "how do I add a connector?" is answered at once (the owner, 2026-11-09), and
it is kept in the owner's Knowledge base as a built-in item, so it shows in the Knowledge tab and every agent can
search it. The Knowledge copy is refreshed whenever the guide changes (its hash is remembered in the ledger).
"""

from __future__ import annotations

import hashlib
from functools import cache
from typing import Any

from aic.shared.log import log
from aic.shared.utility import agents_dir

TITLE = "AI City guide (built in)"
FLAG = ("HELP#guide", "META")


@cache
def app_guide() -> str:
    return (agents_dir() / "help" / "app_guide.md").read_text(encoding="utf-8").strip()


def guide_hash() -> str:
    return hashlib.sha256(app_guide().encode()).hexdigest()[:16]


async def ensure_guide_in_knowledge(table: Any, knowledge: Any) -> bool:
    """Puts the current guide in the Knowledge base once, and replaces the old copy when the guide changed. True when
    it added one. Never raises: the guide still reaches AIC through its instructions."""
    if knowledge is None:
        return False
    try:
        flag = await table.get(*FLAG) or {}
        h = guide_hash()
        if flag.get("hash") == h:
            return False
        item = await knowledge.add_text(app_guide(), TITLE, "relevant")
        old = flag.get("item_id")
        await table.put({"pk": FLAG[0], "sk": FLAG[1], "hash": h, "item_id": item.get("id")})
        if old and old != item.get("id"):
            try:
                await knowledge.delete(old)
            except Exception as e:  # the old copy may already be gone
                log("info", "guide.old_copy_kept", error=type(e).__name__)
        log("info", "guide.added", hash=h)
        return True
    except Exception as e:
        log("warn", "guide.add_failed", error=type(e).__name__)
        return False
