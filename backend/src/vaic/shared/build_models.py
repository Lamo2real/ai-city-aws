"""Which model does which job in a build, by job size (decision 289). One module, read from ``config/models.json``
(``build``), so the map lives in one place like every other model rule.

Sizes: ``small`` (one worker, no planner), ``medium`` (Sonnet planner), ``large`` (Opus planner), ``extreme`` (a
Fable architect for a whole app with AWS infrastructure). Every worker is Sonnet 5.5 (decision 300). Nothing here calls a
model.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal, cast

from .config import models_config

Size = Literal["small", "medium", "large", "extreme"]
SIZES: tuple[Size, ...] = ("small", "medium", "large", "extreme")
Review = Literal["risky", "nontrivial", "every"]


@dataclass(frozen=True)
class SizeModels:
    size: Size
    planner: str | None
    """The model that splits the job into parts; None = no planner (one worker does it all)."""
    worker: str
    reviewer: str
    review: Review
    """Which parts the reviewer reads after the tests: only risky ones, every non-trivial one, or every one."""
    takeover: str
    """Who takes over a part still failing after ``fails_before_takeover`` tries."""
    whole_app_check: bool
    aws_checks: bool
    """The AWS setup gets security and cost checks (extreme jobs)."""
    fails_before_takeover: int


def _cfg(config: Mapping[str, Any] | None) -> Mapping[str, Any]:
    return (config or models_config())["build"]


def models_for(size: str, config: Mapping[str, Any] | None = None) -> SizeModels:
    """The model map for one job size; an unknown size is treated as small (start small when unsure)."""
    b = _cfg(config)
    s = cast(Size, size if size in SIZES else "small")
    r = b["sizes"][s]
    return SizeModels(
        size=s,
        planner=r.get("planner"),
        worker=str(r["worker"]),
        reviewer=str(r["reviewer"]),
        review=r["review"],
        takeover=str(r["takeover"]),
        whole_app_check=bool(r.get("wholeAppCheck")),
        aws_checks=bool(r.get("awsChecks")),
        fails_before_takeover=int(b.get("failsBeforeTakeover", 2)),
    )


def worker_model(size: str, trivial: bool = False, fails: int = 0, config: Mapping[str, Any] | None = None) -> str:
    """The model for one part: Sonnet 5.5 for every worker (decision 300; ``trivial`` changes nothing any more), and
    after ``fails_before_takeover`` failures the size's takeover model (Opus 5.5, Fable 5.1 on extreme)."""
    m = models_for(size, config)
    return m.takeover if fails >= m.fails_before_takeover else m.worker


def needs_review(size: str, trivial: bool, risky: bool, config: Mapping[str, Any] | None = None) -> bool:
    """Whether a part goes to the reviewer after its tests pass."""
    rule = models_for(size, config).review
    if rule == "every":
        return True
    if rule == "risky":
        return risky
    return not trivial or risky


def build_model_names(config: Mapping[str, Any] | None = None) -> set[str]:
    """Every model a build may call (for IAM and checks)."""
    b = _cfg(config)
    names: set[str] = set()
    for r in b["sizes"].values():
        names |= {str(v) for k, v in r.items() if k in ("planner", "worker", "reviewer", "takeover") and v}
    return names


def inference_note(config: Mapping[str, Any] | None = None) -> str:
    """What kind of Bedrock endpoint builds use, in one line (the owner asked to be told which)."""
    cfg = config or models_config()
    return (
        f"Bedrock {cfg['profilePrefix']} cross-region inference profiles; latency-optimised inference is not used "
        "(not offered for these models in eu-north-1 as far as this repository knows)."
    )
