"""The owner's Stop on a message to VAIC (decision 183).

The HUD's Stop button writes a flag in the ledger (``POST /messages/{id}/stop``); VAIC's turn polls it while it
runs and, once set, cancels the turn: the model stream ends, no later reply is sent and no further tool runs.
A tool call already under way finishes (``direct`` shields it), so nothing is left half done.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from typing import TypeVar

from vaic.shared.log import log

T = TypeVar("T")

POLL_SECONDS = 0.4


async def unless_stopped(
    work: Awaitable[T], stopped: Callable[[], Awaitable[bool]], every: float | None = None
) -> tuple[T | None, bool]:
    """Runs ``work`` until it ends or ``stopped()`` says yes: ``(result, False)``, or ``(None, True)`` once stopped
    (``work`` is then cancelled). A failing check is ignored: the turn goes on."""
    task = asyncio.ensure_future(work)

    async def watch() -> None:
        while True:
            await asyncio.sleep(every or POLL_SECONDS)
            try:
                if await stopped():
                    return
            except Exception as e:
                log("warn", "vaic.stop_check_failed", error=type(e).__name__)

    watcher = asyncio.ensure_future(watch())
    try:
        await asyncio.wait({task, watcher}, return_when=asyncio.FIRST_COMPLETED)
    except BaseException:
        task.cancel()
        raise
    finally:
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await watcher
    if task.done():
        return task.result(), False
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError, Exception):
        await task
    return None, True
