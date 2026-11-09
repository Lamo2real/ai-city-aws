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
MAX_TRIES = 3


@cache
def app_guide() -> str:
    return (agents_dir() / "help" / "app_guide.md").read_text(encoding="utf-8").strip()


REVISION = "2"
"""Bumped when the way the guide is stored changes, so every deploy that needs it starts with one fresh copy."""


def guide_hash() -> str:
    return hashlib.sha256((REVISION + app_guide()).encode()).hexdigest()[:16]


async def ensure_guide_in_knowledge(table: Any, knowledge: Any) -> bool:
    """Puts the current guide in the Knowledge base once, and replaces the old copy when the guide changed. True when
    it added one. Never raises: the guide still reaches AIC through its instructions."""
    if knowledge is None:
        return False
    try:
        flag = await table.get(*FLAG) or {}
        h = guide_hash()
        tries = int(flag.get("tries") or 1)
        if flag.get("hash") == h:
            # Same guide: only a copy that failed in the pipeline is added again, at most three times per version.
            if tries >= MAX_TRIES or not flag.get("item_id"):
                return False
            try:
                current = await knowledge.get(flag["item_id"])
            except Exception:
                current = {"status": "failed"}  # gone: add it again
            if current.get("status") != "failed":
                return False
            tries += 1
        else:
            tries = 1
        item = await knowledge.add_text(app_guide(), TITLE, "relevant")
        await table.put({"pk": FLAG[0], "sk": FLAG[1], "hash": h, "item_id": item.get("id"), "tries": tries})
        # Only one guide: every other copy (an older version, a copy that failed) goes.
        olds = {flag.get("item_id")} if flag.get("item_id") else set()
        try:
            listed = await knowledge.list()
            olds |= {i["id"] for i in listed.get("items", []) if i.get("title") == TITLE}
        except Exception as e:
            log("info", "guide.list_failed", error=type(e).__name__)
        for old in olds - {item.get("id")}:
            try:
                await knowledge.delete(old)
            except Exception as e:  # the old copy may already be gone
                log("info", "guide.old_copy_kept", error=type(e).__name__)
        log("info", "guide.added", hash=h)
        return True
    except Exception as e:
        log("warn", "guide.add_failed", error=type(e).__name__)
        return False
