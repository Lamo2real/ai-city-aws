"""Cost math in plain model names. Every figure is an estimate; the AWS bill is the truth."""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any

from .config import models_config


@dataclass(frozen=True)
class Usage:
    input: int = 0
    output: int = 0
    cache_read: int = 0
    cache_write_5m: int = 0
    """Cache writes split by TTL, because the 1-hour cache costs more to write."""
    cache_write_1h: int = 0

    def to_json(self) -> dict[str, int]:
        """The wire format shared with the HUD (camelCase, as the TypeScript version had)."""
        return {
            "input": self.input,
            "output": self.output,
            "cacheRead": self.cache_read,
            "cacheWrite5m": self.cache_write_5m,
            "cacheWrite1h": self.cache_write_1h,
        }

    @staticmethod
    def from_json(d: dict[str, Any]) -> Usage:
        return Usage(
            input=int(d.get("input", 0)),
            output=int(d.get("output", 0)),
            cache_read=int(d.get("cacheRead", 0)),
            cache_write_5m=int(d.get("cacheWrite5m", 0)),
            cache_write_1h=int(d.get("cacheWrite1h", 0)),
        )


ZERO_USAGE = Usage()


def total_tokens(u: Usage) -> int:
    return sum(asdict(u).values())


def prompt_tokens(u: Usage) -> int:
    """Prompt size as the long-context tier measures it: everything sent in."""
    return u.input + u.cache_read + u.cache_write_5m + u.cache_write_1h


def estimate_usd(model: str, u: Usage, prefix: str = "global") -> float:
    cfg = models_config()
    p = cfg["prices"].get(model)
    if not p:
        raise ValueError(f"no price for {model}")
    mult = cfg["cacheWriteMultiplier"]

    def per_tok(n: int, rate: float) -> float:
        return n * rate / 1_000_000

    total = (
        per_tok(u.input, p["input"])
        + per_tok(u.output, p["output"])
        + per_tok(u.cache_read, p["cacheRead"])
        + per_tok(u.cache_write_5m, p["input"] * mult["5m"])
        + per_tok(u.cache_write_1h, p["input"] * mult["1h"])
    )
    long = cfg.get("longContext", {}).get(model)
    if long and prompt_tokens(u) > long["thresholdTokens"]:
        total *= long["multiplier"]
    if prefix != "global":
        total *= 1 + cfg["geoSurchargePct"] / 100
    return float(total)


def cache_savings_usd(model: str, u: Usage, prefix: str = "global") -> float:
    """What caching saved on this turn compared with sending the cached tokens as plain input."""
    if model not in models_config()["prices"]:
        return 0.0
    without = estimate_usd(model, replace(u, input=u.input + u.cache_read, cache_read=0), prefix)
    return max(0.0, without - estimate_usd(model, u, prefix))


def format_usd(v: float) -> str:
    return f"${v:.2f}"
