"""The project board (decision 289): kept from the city's events, with timings for every stage, and VAIC's instant
no-model status answers from it. Since decision 298 it is the only path."""

from __future__ import annotations

from typing import Any

from city_support import make_city, make_department, scripted_engine
from test_hierarchy_e2e import GOAL, make_manager, orchestrator, vaic, worker
from vaic.lambdas import api
from vaic.lambdas.ledger_writer import write_event
from vaic.shared.board import Board, say_ms, status_question, timing_line, timings
from vaic.shared.hierarchy.board_status import status_reply
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.table import MemoryTable


async def board_city() -> Any:
    city = make_city(
        scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": make_manager(), "worker": worker})
    )
    await make_department(city, "Builders")

    async def project(e: dict[str, Any]) -> None:  # what the ledger writer Lambda does for every event
        await write_event({"detail": e}, city.ledger)

    city.bus.on(project)
    return city


async def _job(city: Any) -> dict[str, Any]:
    return next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")


async def test_a_whole_job_lands_on_the_board_with_stage_timings() -> None:
    city = await board_city()
    await city.owner_says(GOAL)
    await city.run()
    task = await _job(city)
    b = await Board(city.ledger.table, city.ledger.get_ticket).read(task["id"])
    assert b is not None
    # The owner's exact words, the size and why, the status and result, all on the board.
    assert b["owner_words"] == GOAL and b["status"] == "done" and "power" in b["result"]
    assert b["size"] == "small" and b["size_reason"] and b["size_by_owner"] is False
    assert b["path"] == "board"
    goals = [p for p in b["parts"] if p["role"] == "goal"]
    parts = [p for p in b["parts"] if p["role"] == "part"]
    assert [g["department"] for g in goals] == ["Builders"]
    assert len(parts) == 4 and all(p["status"] == "done" and p["worker"].startswith("wkr-") for p in parts)
    assert all(p["department"] == "Builders" for p in parts)
    test_part = next(p for p in parts if p["goal"] == "write the test")
    assert [v["verdict"] for v in test_part["verdicts"]] == ["FAIL", "PASS"]
    t = b["timings"]
    assert t["total_ms"] > 0
    for stage in ("sizing", "planning", "spinup", "work", "tests", "review"):
        assert stage in t["stages"], stage
    assert t["stages"]["work"]["parts"] == 4  # three parts and the whole-app check
    assert t["stages"]["planning"]["ms"] > 0 and t["stages"]["work"]["ms"] > 0
    # Every child ticket names its job, so the board never has to walk up the tree.
    kids = [k for k in await city.ledger.list_tickets(ALL_STATUSES) if k.get("parent_id")]
    assert kids and all(k["task_id"] == task["id"] for k in kids)
    assert timing_line(t).startswith("It took ")


async def test_events_out_of_order_and_twice_change_nothing() -> None:
    table = MemoryTable()
    tickets: dict[str, dict[str, Any]] = {}

    async def get(id: str) -> dict[str, Any] | None:
        return tickets.get(id)

    board = Board(table, get)
    task = {"id": "t-1", "goal": "g", "kind": "task", "parent_id": None, "status": "open", "to": "orchestrator",
            "created_at": "2026-11-12T10:00:00.000Z", "updated_at": "2026-11-12T10:00:00.000Z", "owner_words": "w"}  # fmt: skip
    part = {"id": "t-3", "goal": "p", "kind": "assignment", "parent_id": "t-2", "status": "open", "to": "wkr-a-1",
            "department": "A", "created_at": "2026-11-12T10:00:20.000Z", "updated_at": "2026-11-12T10:00:20.000Z"}  # fmt: skip
    tickets["t-2"] = {"id": "t-2", "parent_id": "t-1", "kind": "assignment"}
    tickets["t-1"] = task
    ev = [
        {"type": "ticket.status", "ticket": task, "previous": None, "at": "2026-11-12T10:00:00.000Z"},
        {"type": "ticket.status", "ticket": part, "previous": None, "at": "2026-11-12T10:00:20.000Z"},
        {
            "type": "ticket.status",
            "ticket": {**part, "status": "in_progress"},
            "previous": "open",
            "at": "2026-11-12T10:00:25.000Z",
        },
        {
            "type": "ticket.status",
            "ticket": {**part, "status": "in_review"},
            "previous": "in_progress",
            "at": "2026-11-12T10:01:25.000Z",
        },
        {
            "type": "review.result",
            "ticket_id": "t-3",
            "agent": "wkr-a-1",
            "reviewer": "mgr-a",
            "verdict": "PASS",
            "summary": "ok",
            "round": 1,
            "at": "2026-11-12T10:01:35.000Z",
        },
        {
            "type": "ticket.status",
            "ticket": {**part, "status": "done"},
            "previous": "in_review",
            "at": "2026-11-12T10:01:35.000Z",
        },
        {
            "type": "ticket.status",
            "ticket": {**task, "status": "done"},
            "previous": "in_progress",
            "at": "2026-11-12T10:01:40.000Z",
        },
    ]
    tickets["t-3"] = part
    for e in [ev[0], ev[1], ev[3], ev[2], ev[5], ev[4], ev[6], ev[6], ev[3]]:  # shuffled, with repeats
        await board.project(e)
    b = await board.read("t-1")
    assert b is not None and b["status"] == "done"
    (p,) = [x for x in b["parts"] if x["role"] == "part"]
    assert p["status"] == "done"  # an older event arriving late never rolls a part back
    s = b["timings"]["stages"]
    assert s["planning"]["ms"] == 20_000 and s["spinup"]["ms"] == 5_000
    assert s["work"]["ms"] == 60_000 and s["review"]["ms"] == 10_000
    assert b["timings"]["total_ms"] == 100_000


def test_timings_are_spans_and_busy_time() -> None:
    m = [
        {"stage": "work", "edge": "start", "key": "a", "at": "2026-11-12T10:00:00Z"},
        {"stage": "work", "edge": "end", "key": "a", "at": "2026-11-12T10:00:30Z"},
        {"stage": "work", "edge": "start", "key": "b", "at": "2026-11-12T10:00:10Z"},
        {"stage": "work", "edge": "end", "key": "b", "at": "2026-11-12T10:01:00Z"},
        {"stage": "sizing", "edge": "dur", "key": "job", "at": "2026-11-12T10:00:00Z", "ms": 2},
    ]
    t = timings(m)
    assert t["stages"]["work"] == {"ms": 60_000, "busy_ms": 80_000, "parts": 2}
    assert t["stages"]["sizing"]["ms"] == 2
    assert say_ms(161_000) == "2 min 41 s" and say_ms(8_000) == "8 s" and say_ms(400) == "0.4 s"


def test_only_plain_status_questions_skip_the_model() -> None:
    for q in ("status?", "How's it going?", "any updates", "Is it done yet?", "hey vaic, how is it going",
              "what's the status", "where are we at", "how long did it take?", "Progress?"):  # fmt: skip
        assert status_question(q) == (True, ""), q
    assert status_question("how's the memory game going?") == (True, "memory game")
    assert status_question("is the porsche site done?") == (True, "porsche site")
    for q in ("change the memory game to 4 pairs", "build me a status page", "what's the weather",
              "status of my emails and then book a flight to Paris next week please", "", "how are you"):  # fmt: skip
        assert status_question(q)[0] is False, q


async def test_vaic_answers_status_from_the_board_with_no_model_call() -> None:
    city = await board_city()
    await city.owner_says(GOAL)
    await city.run()
    board = Board(city.ledger.table, city.ledger.get_ticket)
    text = await status_reply(city.ledger, board, "how's it going?", "c1")
    assert text is not None and text.startswith("Done: ") and "It took " in text
    assert "wkr-" not in text and "t-" not in text.split("Result")[0]
    assert await status_reply(city.ledger, board, "change it to 4 pairs", "c1") is None
    # A named job VAIC can't find goes to the model, which can ask which one.
    assert await status_reply(city.ledger, board, "how's the porsche thing going?", "c1") is None


async def test_the_api_answers_a_status_question_without_queueing_a_turn() -> None:
    city = await board_city()
    await city.owner_says(GOAL)
    await city.run()
    before = len(city.queue.items) if hasattr(city.queue, "items") else None
    d: Any = type("D", (), {"ledger": city.ledger, "bus": city.bus})()
    assert await api._status_fast(d, "owner-abcdefgh", "status?", "c1") is True
    reply = [e for e in city.bus.of_type("vaic.reply") if e.get("message_id") == "owner-abcdefgh"]
    assert len(reply) == 1 and reply[0]["done"] and reply[0]["text"].startswith("Done: ")
    lines = await city.ledger.recent_conversation("c1")
    assert [ln["who"] for ln in lines[-2:]] == ["owner", "vaic"]
    # The same message again (a retry) is never answered twice; anything else goes to the model.
    assert await api._status_fast(d, "owner-abcdefgh", "status?", "c1") is False
    assert await api._status_fast(d, "owner-other123", "build me a game", "c1") is False
    if before is not None:
        assert len(city.queue.items) == before
