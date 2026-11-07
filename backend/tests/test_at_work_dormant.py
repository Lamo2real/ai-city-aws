"""A dormant worker still sits at its desk in the City, so it counts as at work and can be sent home."""

from datetime import UTC, datetime
from typing import Any

from aic.shared.hierarchy.actions import CityDeps, workers_at_work
from aic.shared.ledger import Ledger
from aic.shared.table import MemoryTable


def agent(id: str, state: str, worker_state: str | None = None) -> dict[str, Any]:
    return {
        "id": id,
        "kind": "worker",
        "role": "writer",
        "department": "Research",
        "model": "opus-5-5",
        "parent": "mgr-research",
        "state": state,
        "worker_state": worker_state,
        "total_cost_usd": 0,
        "hired_at": "2026-11-07T10:00:00.000Z",
    }


async def test_dormant_workers_count_as_at_work_but_retired_or_released_do_not() -> None:
    ledger = Ledger(MemoryTable(), lambda: datetime(2026, 11, 7, 12, tzinfo=UTC))
    for a in (
        agent("w-active", "active", "working"),
        agent("w-dormant", "dormant", "idle"),
        agent("w-retired", "retired", "released"),
        agent("w-released", "active", "released"),
    ):
        await ledger.put_agent(a)
    d = CityDeps(ledger=ledger, bus=None, queue=None, factory=None, settings=None, max_review_rounds=3)  # type: ignore[arg-type]
    ids = sorted(w["id"] for w in await workers_at_work(d))
    assert ids == ["w-active", "w-dormant"]
