"""VAIC's instant status answers (decision 289): "how's it going?" is answered from the project board in
milliseconds, with no model call and no runtime. Anything that is not plainly a status question goes to VAIC's
model as before, and so does a question about a job this cannot find."""

from __future__ import annotations

import re

from ..board import Board, _ms, say_ms, status_question, timing_line
from ..ledger import Ledger, Record
from .actions import LIVE
from .tasks import DONE_OR_GONE, _ago, describe_task, find_task, recent_tasks, short_name

_APP_CHAT = re.compile(r"app-(?!new-)([\w-]+)")


def _in_chat(t: Record, conversation: str) -> bool:
    if conversation in ("main", "hud", ""):
        return True
    if t.get("conversation") == conversation:
        return True
    m = _APP_CHAT.fullmatch(conversation)
    return bool(m and t.get("app_id") == m.group(1))


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def board_text(b: Record, now_ms: int, ago: str) -> str:
    """One job's status in plain words, from its board."""
    name = short_name({"goal": b.get("owner_words") or b.get("goal", "")})
    parts = [p for p in b.get("parts") or [] if p.get("role") == "part"]
    done = sum(1 for p in parts if p.get("status") == "done")
    status = str(b.get("status"))
    t = b.get("timings") or {}
    if status in DONE_OR_GONE:
        word = {"done": "Done", "failed": "It didn't finish", "cancelled": "Stopped"}[status]
        line = f"{word}: {name}, {ago}."
        took = timing_line(t)
        if took:
            line += f" {took}"
        if status == "done" and b.get("result"):
            line += f" Result: {str(b['result'])[:240]}"
        return line
    lines = [f"Working on {name}."]
    working = {p.get("worker") for p in parts if p.get("status") in ("in_progress", "in_review", "open")}
    working.discard(None)
    if not parts:
        lines.append("It's being planned right now.")
    else:
        lines.append(f"{done} of {_plural(len(parts), 'part')} done")
        if working:
            lines[-1] += f", {_plural(len(working), 'agent')} on it"
        lines[-1] += "."
    states = {p.get("status") for p in parts}
    if "waiting_on_owner" in states:
        lines.append("It needs you: there's something in Needs you.")
    elif "in_review" in states:
        lines.append("A finished part is being checked.")
    started = t.get("started_at")
    if started:
        s = _ms(str(started))
        if s:
            lines.append(f"Running for {say_ms(max(0, now_ms - s))}.")
    return " ".join(lines)


async def status_reply(ledger: Ledger, board: Board, text: str, conversation: str) -> str | None:
    """The answer to a plain status question, or None when the model should answer it."""
    is_status, what = status_question(text)
    if not is_status:
        return None
    jobs = [t for t in await recent_tasks(ledger) if _in_chat(t, conversation)]
    if what:
        task, _ = await find_task(ledger, what)
        if task is None or not _in_chat(task, conversation):
            return None  # not sure which job: VAIC's model asks
        chosen = [task]
    else:
        live = [t for t in jobs if t["status"] in LIVE]
        chosen = live[:3] if live else jobs[:1]
    if not chosen:
        return None  # no job here at all: "status?" may be about something else, so VAIC's model answers
    now = ledger.now()
    out = []
    for task in chosen:
        b = await board.read(task["id"])
        if b is None:  # a job from before the board: the same no-model words as the job_status tool
            out.append(await describe_task(ledger, task))
        else:
            out.append(board_text(b, ledger.now_ms(), _ago(now, task.get("updated_at"))))
    return "\n\n".join(out)
