"""Every tower keeps its lot for good (decision 248): a new department takes the first free lot or a new one at the
edge, a demolished one leaves its lot empty, and the lots are numbered the first time in the order the City drew
the towers before, so nothing moved for the owner."""

from datetime import UTC, datetime, timedelta

import pytest

from vaic.shared.ledger import Ledger, lots_shown
from vaic.shared.table import MemoryTable


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 12, tzinfo=UTC)

    def __call__(self) -> datetime:
        self.t += timedelta(seconds=1)  # every record a moment later than the one before
        return self.t


@pytest.fixture
def ledger() -> Ledger:
    return Ledger(MemoryTable(), Clock())


async def _slots(ledger: Ledger) -> dict[str, int]:
    return {str(d["key"]): int(d["slot"]) for d in await ledger.list_departments() if "slot" in d}


async def _old_city(ledger: Ledger, names: list[str]) -> None:
    """Departments built by a version before lots: records without a slot and no lots at all."""
    for n in names:
        await ledger.create_department(n, f"{n} work", f"mgr-{n.lower()}")
    for k in await ledger.table.query_index("gsi1", "LOT"):
        await ledger.table.delete(k["pk"], k["sk"])


async def test_backfill_numbers_the_standing_departments_oldest_first_each_lot_sized_by_its_tower(
    ledger: Ledger,
) -> None:
    await _old_city(ledger, ["Marketing", "Sales", "Legal"])
    lots = await ledger.ensure_lots()
    assert [(lot["slot"], lot["holder"], lot["size"]) for lot in lots] == [
        (0, "marketing", "Marketing"),
        (1, "sales", "Sales"),
        (2, "legal", "Legal"),
    ]
    assert await _slots(ledger) == {"marketing": 0, "sales": 1, "legal": 2}
    assert await ledger.ensure_lots() == lots  # twice: the same numbers


async def test_a_new_department_takes_the_next_lot_and_a_demolished_one_leaves_it_free(ledger: Ledger) -> None:
    await _old_city(ledger, ["Marketing", "Sales", "Legal"])
    await ledger.ensure_lots()
    research, _ = await ledger.create_department("Research", "r", "mgr-research")
    assert (research["slot"], research["lot"]) == (3, "")
    await ledger.demolish_department("Sales")
    assert await _slots(ledger) == {"marketing": 0, "legal": 2, "research": 3}
    free = [lot for lot in await ledger.list_lots() if not lot["holder"]]
    assert [(lot["slot"], lot["size"]) for lot in free] == [(1, "Sales")]  # still sized by the tower that stood there
    media, _ = await ledger.create_department("Media", "m", "mgr-media")
    assert (media["slot"], media["lot"]) == (1, "Sales")  # the first free lot, its footprint unchanged
    assert await _slots(ledger) == {"marketing": 0, "media": 1, "legal": 2, "research": 3}


def test_the_square_shows_n_by_n_blocks_less_hq_and_the_homes() -> None:
    assert [lots_shown(c) for c in (0, 7, 8, 14, 15, 23, 24)] == [7, 7, 14, 14, 23, 23, 34]


async def test_free_lots_are_filled_first_then_the_square_grows_a_ring(ledger: Ledger) -> None:
    for i in range(7):
        await ledger.create_department(f"Dept {i}", "x", f"mgr-{i}")
    assert sorted((await _slots(ledger)).values()) == list(range(7))  # the 3 × 3 square is full
    await ledger.demolish_department("Dept 3")
    back, _ = await ledger.create_department("Eighth", "x", "mgr-8")
    assert back["slot"] == 3  # a free lot first
    ninth, _ = await ledger.create_department("Ninth", "x", "mgr-9")
    assert ninth["slot"] == 7  # then the next ring: 4 × 4


async def test_a_rebuilt_department_goes_back_to_its_old_lot_when_it_is_still_free(ledger: Ledger) -> None:
    for n in ["Marketing", "Sales", "Legal"]:
        await ledger.create_department(n, "x", f"mgr-{n}")
    await ledger.demolish_department("Sales")
    back = await ledger.rebuild_department("Sales", "again")
    assert back["slot"] == 1
    await ledger.demolish_department("Sales")
    await ledger.create_department("Media", "x", "mgr-media")  # takes lot 1
    back = await ledger.rebuild_department("Sales", "again")
    assert back["slot"] == 3  # its old lot is taken: the next free one
    assert await _slots(ledger) == {"marketing": 0, "media": 1, "legal": 2, "sales": 3}


async def test_a_department_built_before_the_lots_were_numbered_comes_last(ledger: Ledger) -> None:
    await _old_city(ledger, ["Marketing", "Sales"])
    new, _ = await ledger.create_department("Research", "x", "mgr-research")  # before any snapshot numbered them
    assert new["slot"] == 2
    assert await _slots(ledger) == {"marketing": 0, "sales": 1, "research": 2}


async def test_a_standing_department_without_a_lot_gets_one_from_the_snapshot(ledger: Ledger) -> None:
    await ledger.create_department("Marketing", "x", "mgr-m")
    lot = (await ledger.list_lots())[0]
    await ledger.table.delete(f"LOT#{lot['slot']:05d}", "META")
    await ledger.create_department("Sales", "x", "mgr-s")  # numbering again: Marketing 0, Sales 1
    assert await _slots(ledger) == {"marketing": 0, "sales": 1}
