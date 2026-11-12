"""Contract-first planning (decision 301): the planner writes a shared contract before any part, splits the job into
many independent parts that build against it (critical path 1), amendments reach the affected parts, one-line changes
ride with a neighbour, and a small job stays one worker."""

# ruff: noqa: ASYNC240 (test workers write their files like a real worker does)
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from city_support import Call, City, make_city, make_department, scripted_engine
from vaic.lambdas.ledger_writer import write_event
from vaic.runtime import tools as tools_mod
from vaic.runtime.engine import EngineRequest
from vaic.shared.board import Board
from vaic.shared.hierarchy import board_path as board
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.utility import Triage

SPEC = (
    "build a booking app with a database, a bookings service and a payments service, Stripe for payments, and five "
    "pages: home, search, booking, account and admin"
)
CONTRACT = {
    "summary": "Bookings app: Postgres, bookings and payments services, Stripe, five pages.",
    "endpoints": [
        "POST /bookings {slot_id, user_id} -> {booking_id, status}",
        "GET /bookings?user_id -> [{booking_id, slot, status}]",
        "POST /payments {booking_id, amount} -> {payment_id, client_secret}",
    ],
    "data_model": "users(id, email), slots(id, starts_at, capacity), bookings(id, user_id, slot_id, status), "
    "payments(id, booking_id, amount, stripe_id, status)",
    "events": ["booking.created {booking_id}", "payment.succeeded {booking_id, payment_id}"],
    "shared_types": "Booking, Slot, Payment, User",
    "routes": ["/ {}", "/search {query}", "/book/:slot {slot}", "/account {user}", "/admin {}"],
    "components": ["SlotCard {slot, onBook}", "Layout {children}"],
    "env": ["DATABASE_URL", "STRIPE_SECRET_KEY", "PAYMENTS_URL"],
}
PARTS = [
    ("DB migrations", "Application", ["db/migrations/001.sql"]),
    ("Bookings service", "Application", ["services/bookings/index.js"]),
    ("Payments service", "Application", ["services/payments/index.js"]),
    ("Stripe integration", "Application", ["services/payments/stripe.js"]),
    ("Home page", "Application", ["web/pages/home.js"]),
    ("Search page", "Application", ["web/pages/search.js"]),
    ("Booking page", "Application", ["web/pages/booking.js"]),
    ("Account page", "Application", ["web/pages/account.js"]),
    ("Admin page", "Application", ["web/pages/admin.js"]),
    ("Shared components", "Application", ["web/components/index.js"]),
    ("Seed data", "Application", ["db/seed.sql"]),
    ("Contract tests", "Application", ["tests/contract.test.js"]),
]


@pytest.fixture(autouse=True)
def triage_application(monkeypatch: pytest.MonkeyPatch) -> None:
    async def triage(*_: Any, **__: Any) -> Triage:
        return Triage("department", "Application", "test")

    monkeypatch.setattr(tools_mod, "triage", triage)


async def worker(req: EngineRequest, call: Call) -> str:
    assert req.cwd
    Path(req.cwd, "out.json").write_text("{}")
    return await call("report_to_manager", {"summary": f"Done: {req.ctx.ticket_id}", "artifacts": [], "checks": "-"})


async def reviewer(req: EngineRequest, call: Call) -> str:
    return await call("review", {"ticket_id": req.ctx.ticket_id, "verdict": "PASS", "reasons": "Honours the contract."})


def city_with(plan: Any, work: Any = worker) -> City:
    async def vaic(req: EngineRequest, call: Call) -> str:
        if "(task) from owner" in req.turn.prompt:
            w = req.ctx.owner_text
            return await call("start_job", {"goal": w, "owner_words": w, "confirm": True})
        return "Done, Sir."

    city = make_city(scripted_engine({"vaic": vaic, "orchestrator": plan, "manager": reviewer, "worker": work}))
    city.deps.utility_runner = object()

    async def project(e: dict[str, Any]) -> None:
        await write_event({"detail": e}, city.ledger)

    city.bus.on(project)
    return city


def sample_planner(seen: dict[str, Any]) -> Any:
    async def plan(req: EngineRequest, call: Call) -> str:
        assert "Contract first" in req.turn.prompt and "critical path" in req.turn.prompt
        seen["before_contract"] = await call(
            "add_part",
            {"name": "Too early", "goal": "Anything at all", "acceptance": "Never", "department": "Application"},
        )
        seen["contract"] = await call("write_contract", CONTRACT)
        seen["answers"] = []
        for name, dept, files in PARTS:
            seen["answers"].append(
                await call(
                    "add_part",
                    {
                        "name": name,
                        "goal": f"Build the {name.lower()}",
                        "acceptance": "Honours the contract; tested",
                        "department": dept,
                        "files": files,
                    },
                )
            )
        seen["workers_before_finish"] = len([a for a in await req.ledger.list_agents() if a["kind"] == "worker"])
        seen["done"] = await call("finish_plan", {})
        return "Planned."

    return plan


async def test_the_sample_spec_gets_a_contract_then_twelve_parts_at_once_with_a_critical_path_of_one() -> None:
    seen: dict[str, Any] = {}
    city = city_with(sample_planner(seen))
    await make_department(city, "Application")
    await city.owner_says(SPEC)
    await city.run(max_steps=3000)
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    assert task["size"] in ("medium", "large", "extreme") and task["status"] == "done"
    # The contract comes first: no part before it, and it is the only thing every part waits on.
    assert seen["before_contract"].startswith("Write the contract first")
    assert seen["contract"].startswith("Contract written")
    assert all(a.endswith("its worker starts now.") for a in seen["answers"])
    assert seen["workers_before_finish"] == len(PARTS) >= 10  # every part started while the planner still wrote
    assert task["critical_path"] == 1  # measured: one wave of parts, then the whole-app check
    assert "critical path is 1 part long" in seen["done"]
    # Every part's brief carries the contract and says to build against it with stubs.
    briefs = [i["body"] for i in city.invocations if i["role"] == "worker" and i["kind"] == "task"]
    assert len(briefs) == len(PARTS) + 1  # the parts and the whole-app check
    assert all("Contract (version 1)" in b and "POST /payments" in b for b in briefs)
    assert sum("stub or mock" in b for b in briefs) == len(PARTS)
    assert sum("swap every part's stubs for the real parts" in b for b in briefs) == 1
    # Reviews check against the contract; the board shows the critical path and the contract version.
    reviews = [i["body"] for i in city.invocations if i["role"] == "manager"]
    assert reviews and all("contract" in r for r in reviews)
    b = await Board(city.ledger.table, city.ledger.get_ticket).read(task["id"])
    assert b and b["critical_path"] == 1 and b["contract_version"] == 1


async def test_an_amendment_reaches_the_affected_parts_and_nobody_else() -> None:
    told: dict[str, list[str]] = {}

    async def work(req: EngineRequest, call: Call) -> str:
        part = await req.ledger.get_ticket(req.ctx.ticket_id)
        told.setdefault(str((part or {}).get("goal")), []).append(req.turn.prompt)
        if req.ctx and part and part["goal"] == "Build the payments service" and "amendment" not in req.turn.prompt:
            out = await call(
                "amend_contract",
                {"change": "POST /payments also returns currency.", "affects": ["Booking page"]},
            )
            assert out.startswith("Amendment sent")
            return "waiting"  # finishes on a later turn
        if part and part["goal"] == "Build the payments service":
            return await worker(req, call)
        if "amendment" in req.turn.prompt.lower():
            return "noted"
        return "working"  # stays busy so the amendment finds it started

    async def plan(req: EngineRequest, call: Call) -> str:
        await call("write_contract", CONTRACT)
        for name in ("Payments service", "Booking page", "Home page"):
            await call(
                "add_part",
                {
                    "name": name,
                    "goal": f"Build the {name.lower()}",
                    "acceptance": "Honours it",
                    "department": "Application",
                },
            )
        await call("finish_plan", {})
        return "Planned."

    city = city_with(plan, work)
    await make_department(city, "Application")
    await city.owner_says(SPEC)
    await city.run(max_steps=3000)
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    contract = await board.get_contract(city.deps, task["id"])
    assert contract and contract["version"] == 2 and task["contract_version"] == 2
    assert contract["amendments"][0]["change"] == "POST /payments also returns currency."
    assert any("Contract amendment v2" in p for p in told["Build the booking page"])
    assert not any("Contract amendment v2" in p for p in told["Build the home page"])
    assert board.contract_text(contract).endswith("amendment v2: POST /payments also returns currency.")


async def test_one_line_changes_ride_with_a_neighbour_instead_of_their_own_worker() -> None:
    answers: list[str] = []

    async def plan(req: EngineRequest, call: Call) -> str:
        await call("write_contract", {"summary": "Two pages and a footer."})
        for p in (
            {
                "name": "Footer year",
                "goal": "Change the footer year",
                "acceptance": "It says 2026",
                "department": "Application",
                "trivial": True,
            },
            {"name": "Home page", "goal": "Build the home page", "acceptance": "Renders", "department": "Application"},
            {
                "name": "Button colour",
                "goal": "Make the button blue",
                "acceptance": "The button is blue",
                "department": "Application",
                "trivial": True,
            },
            {
                "name": "Title case",
                "goal": "Title-case the headings",
                "acceptance": "Headings are title-cased",
                "department": "Application",
                "trivial": True,
            },
        ):
            answers.append(await call("add_part", p))
        answers.append(await call("finish_plan", {}))
        return "Planned."

    city = city_with(plan)
    await make_department(city, "Application")
    await city.owner_says(SPEC)
    await city.run(max_steps=3000)
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    assert task["status"] == "done"
    assert "rides with the next Application part" in answers[0]
    items = {i["name"]: i for i in await board.plan_items(city.deps, task["id"])}
    assert items["Footer year"]["merged_into"] == "Home page"  # rode with its neighbour
    assert "Change the footer year" in items["Home page"]["goal"]
    merged = items["Small changes in Application"]  # the two left at the end share one worker
    assert "Make the button blue" in merged["goal"] and "Title-case the headings" in merged["goal"]
    workers = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    assert len(workers) == 3  # Home page, the small changes, the whole-app check: no worker per one-liner


def test_the_critical_path_is_the_longest_chain_of_waits() -> None:
    def item(n: str, after: list[str] | None = None, **kw: Any) -> dict[str, Any]:
        return {"name": n, "after": after or [], "status": "waiting", **kw}

    assert board.critical_path([item(str(i)) for i in range(12)]) == 1
    assert board.critical_path([item("a"), item("b", ["a"]), item("c", ["b"]), item("d", ["a"])]) == 3
    assert board.critical_path([item("a"), item("check", ["a"], check=True)]) == 1  # the check is left out
    assert board.critical_path([]) == 0


async def test_a_one_line_change_stays_one_worker_with_no_contract() -> None:
    async def no_planner(req: EngineRequest, call: Call) -> str:
        raise AssertionError("a small job has no planner")

    city = city_with(no_planner)
    await make_department(city, "Application")
    await city.owner_says("fix the typo on the about page")
    await city.run()
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    assert task["status"] == "done" and task["size"] == "small" and not task.get("contract_version")
    assert len([a for a in await city.ledger.list_agents() if a["kind"] == "worker"]) == 1
    assert await board.get_contract(city.deps, task["id"]) is None
