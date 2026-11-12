"""How many workers a goal gets: as many parts as can run at the same time, and no more (decision 283).

The manager lists the goal's parts (a name, ``tiny`` or ``normal``, and the parts each one waits for). The parts
are laid out in waves: a part starts in the wave after the last part it waits for. Tiny parts (a one-line edit, a
config value, "change it to 4 pairs") are folded together: all the tiny parts of a wave are one worker's job, and
a wave of tiny parts next to a real part is done by that part's worker. The team is the widest wave, with no ceiling
(the owner, decision 288: "No limit on agents… If it needs 1,000, be my guest"); more workers than parallel parts
would only be slower. The owner's own number ("use 5 agents") wins.

Pure and deterministic: the same parts always give the same team and the same one-line reason.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

TINY, NORMAL = "tiny", "normal"
MAX_PARTS = 1000


@dataclass(frozen=True)
class Part:
    name: str
    size: str = NORMAL
    after: tuple[str, ...] = ()


@dataclass(frozen=True)
class Team:
    workers: int
    reason: str
    waves: tuple[tuple[str, ...], ...] = ()


class PlanError(ValueError):
    pass


def parse_parts(raw: Any) -> list[Part]:
    """Parts from a tool call: ``[{"name", "size", "after"}]``. Unknown ``after`` names are an error."""
    if not isinstance(raw, list) or not raw:
        raise PlanError("List at least one part.")
    if len(raw) > MAX_PARTS:
        raise PlanError(f"At most {MAX_PARTS} parts; merge small ones.")
    parts: list[Part] = []
    for item in raw:
        r = item if isinstance(item, dict) else {"name": item}
        name = " ".join(str(r.get("name") or "").split())[:80]
        if not name:
            raise PlanError("Every part needs a name.")
        if any(p.name.lower() == name.lower() for p in parts):
            raise PlanError(f"Two parts are called {name!r}.")
        size = TINY if str(r.get("size") or NORMAL).lower() == TINY else NORMAL
        after = tuple(" ".join(str(x).split()) for x in (r.get("after") or []) if str(x).strip())
        parts.append(Part(name, size, after))
    known = {p.name.lower() for p in parts}
    for p in parts:
        for a in p.after:
            if a.lower() not in known:
                raise PlanError(f"{p.name!r} waits for {a!r}, which is not a part.")
            if a.lower() == p.name.lower():
                raise PlanError(f"{p.name!r} cannot wait for itself.")
    return parts


def waves(parts: list[Part]) -> list[list[Part]]:
    """The parts in the order they can run: each wave holds the parts whose waits are all in earlier waves."""
    level: dict[str, int] = {}
    by = {p.name.lower(): p for p in parts}
    for _ in range(len(parts) + 1):
        moved = False
        for p in parts:
            lv = 1 + max((level.get(a.lower(), -1) for a in p.after), default=-1)
            if all(a.lower() in level for a in p.after) and level.get(p.name.lower()) != lv:
                level[p.name.lower()] = lv
                moved = True
        if not moved:
            break
    if len(level) != len(parts):
        raise PlanError("The parts wait for each other in a circle.")
    out: list[list[Part]] = [[] for _ in range(max(level.values()) + 1)]
    for k, lv in level.items():
        out[lv].append(by[k])
    return out


def _wave_workers(w: list[Part]) -> int:
    real = sum(1 for p in w if p.size == NORMAL)
    return real if real else 1  # tiny parts ride along with a real part, or share one worker


def _names(ps: list[str]) -> str:
    return ps[0] if len(ps) == 1 else ", ".join(ps[:-1]) + " and " + ps[-1]


def size_team(parts: list[Part], *, owner_asked: int | None = None) -> Team:
    """The team for a goal: the owner's number, or as many workers as parts can run at the same time."""
    if owner_asked:
        return Team(
            owner_asked, f"{owner_asked} worker{'s' if owner_asked != 1 else ''}: the owner asked for {owner_asked}"
        )
    ws = waves(parts)
    sizes = [_wave_workers(w) for w in ws]
    widest = max(sizes)
    n = max(1, widest)
    wide = ws[sizes.index(widest)]
    real = [p.name for p in wide if p.size == NORMAL]
    plural = "s" if n != 1 else ""
    if not real:
        what = "a small change" if len(parts) == 1 else "small changes"
        why = f"1 worker: {what} ({_names([p.name for p in parts])})"
    elif len(real) > 1:
        shown = real if len(real) <= 6 else [*real[:5], f"{len(real) - 5} more"]
        why = f"{n} worker{plural}: {_names(shown)} run in parallel"
        later = [p.name for w in ws for p in w if p not in wide and p.size == NORMAL]
        if later:
            why += f"; then {_names(later if len(later) <= 6 else [*later[:5], f'{len(later) - 5} more'])}"
    elif len(parts) == 1:
        why = f"1 worker: {real[0]} is one piece of work"
    elif len(ws) == 1:
        why = f"1 worker: {real[0]}, with the small edits alongside"
    else:
        why = f"1 worker: {_names([p.name for p in parts])} run one after another"
    return Team(n, why, tuple(tuple(p.name for p in w) for w in ws))
