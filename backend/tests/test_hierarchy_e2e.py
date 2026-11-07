"""One prompt walks the whole chain with a fake model runner.

owner → AIC → Orchestrator → creates a department → Manager hires three workers → workers report → manager
rejects one (FAIL) → the worker fixes it → manager PASS → Orchestrator sign-off → AIC reports.
"""

from __future__ import annotations

import json
import re
from typing import Any, cast

from aic.runtime.engine import EngineRequest
from aic.shared.hierarchy.actions import instruct_agent
from aic.shared.hierarchy.dispatch import Dispatcher, DispatcherDeps, resume_stale
from aic.shared.hierarchy.queue import WorkMessage
from aic.shared.ledger import ALL_STATUSES
from city_support import Call, City, Script, make_city, scripted_engine, session_id_for

GOAL = "Add a power(a, b) function to add.js with a matching test"
PARTS = ["implement power", "write the test", "update the docs"]


async def ace(req: EngineRequest, call: Call) -> str:
    if "(task) from owner" in req.turn.prompt:
        await call("delegate_to_orchestrator", {"goal": GOAL, "owner_words": GOAL, "confirm": True})
        return "On it — the team is starting."
    return "Done: power(a, b) is in add.js with a test, reviewed and signed off. About a cent of model time."


async def orchestrator(req: EngineRequest, call: Call) -> str:
    if "(task) from ace" in req.turn.prompt:
        await call("create_department", {"name": "Engineering", "mission": "Build and test the owner's software."})
        await call(
            "assign_to_department",
            {
                "department": "Engineering",
                "goal": GOAL,
                "acceptance": "power works for integers and has a passing test",
            },
        )
        return "Sent to Engineering."
    reports = json.loads(await call("get_reports", {}))
    if all(r["status"] == "in_review" for r in reports):
        await call("sign_off", {"verdict": "PASS", "reasons": "All acceptance criteria met, tests pass."})
        await call(
            "report_to_ace",
            {"summary": "power(a, b) added to add.js with a test; three parts reviewed, one fixed after review."},
        )
        return "PASS"
    return "Waiting for reports."


def make_manager() -> Script:
    failed_once: set[str] = set()

    async def manager(req: EngineRequest, call: Call) -> str:
        ledger, ctx = req.ledger, req.ctx
        mine = [k for k in await ledger.child_tickets(ctx.ticket_id) if k.get("kind") == "assignment"]
        if "(task) from orchestrator" in req.turn.prompt:
            for part in PARTS[len(mine) :]:
                hired = await call(
                    "hire_worker",
                    {
                        "specialty": "JavaScript developer",
                        "instructions": f"You {part} for add.js.",
                        "tools": ["Bash", "Read", "Edit", "git"],
                        "budget_hint_usd": 1,
                    },
                )
                wid = re.search(r"Hired (\S+)", hired).group(1)  # type: ignore[union-attr]
                await call("assign", {"worker_id": wid, "goal": part, "acceptance": f"{part} is done and checked"})
            return "Team hired and assigned."
        for t in [k for k in mine if k["status"] == "in_review"]:
            if t["goal"] == "write the test" and t["id"] not in failed_once:
                failed_once.add(t["id"])
                await call(
                    "review",
                    {"ticket_id": t["id"], "verdict": "FAIL", "reasons": "The test does not cover negative exponents."},
                )
                continue
            await call("review", {"ticket_id": t["id"], "verdict": "PASS", "reasons": "Meets the acceptance criteria."})
            await call("release_worker", {"worker_id": t["to"]})
        now = [k for k in await ledger.child_tickets(ctx.ticket_id) if k.get("kind") == "assignment"]
        if len(now) == len(PARTS) and all(k["status"] == "done" for k in now):
            await call(
                "report_to_orchestrator",
                {
                    "summary": "power(a, b) implemented, tested (incl. negative exponents) and documented on branch aic/power."
                },
            )
        return "Reviewed."

    return manager


async def worker(req: EngineRequest, call: Call) -> str:
    fixing = "(fix)" in req.turn.prompt
    await call(
        "report_to_manager",
        {
            "summary": "Added negative exponent cases; all tests pass." if fixing else "Done.",
            "artifacts": ["branch aic/power"],
            "checks": "npm test: pass",
        },
    )
    return "Reported."


async def test_walks_one_prompt_from_the_owner_to_aces_report() -> None:
    city = make_city(
        scripted_engine({"ace": ace, "orchestrator": orchestrator, "manager": make_manager(), "worker": worker})
    )
    await city.owner_says(GOAL)
    await city.run()

    # Ledger tickets
    every = await city.ledger.list_tickets(ALL_STATUSES)
    task = next(t for t in every if t["from"] == "ace")
    assert task["status"] == "done"
    assert "power" in task["result"]
    dept = next(t for t in every if t["from"] == "orchestrator")
    assert (dept["status"], dept["department"], dept["to"]) == ("done", "Engineering", "mgr-engineering")
    assignments = [t for t in every if t["from"] == "mgr-engineering"]
    assert len(assignments) == 3
    assert all(t["status"] == "done" for t in assignments)
    test_part = next(t for t in assignments if t["goal"] == "write the test")
    assert test_part["review_rounds"] == 2
    assert [h["to"] for h in await city.ledger.ticket_history(test_part["id"])] == [
        "open",
        "in_progress",
        "in_review",
        "in_progress",
        "in_review",
        "done",
    ]

    # Events
    types = [e["type"] for e in city.bus.events]
    assert [e["name"] for e in city.bus.of_type("department.created")] == ["Engineering"]
    assert len(city.bus.of_type("agent.hired")) == 4  # manager + 3 workers
    reviews = city.bus.of_type("review.result")
    assert sum(r["verdict"] == "FAIL" for r in reviews) == 1
    assert sum(r["verdict"] == "PASS" for r in reviews) == 3
    signoffs = city.bus.of_type("signoff.result")
    assert len(signoffs) == 1 and signoffs[0]["verdict"] == "PASS" and signoffs[0]["ticket_id"] == task["id"]
    assert len(city.bus.of_type("result")) == 1
    assert types.index("signoff.result") < types.index("result")
    replies = [r for r in city.bus.of_type("ace.reply") if r["done"]]
    assert replies[-1]["text"].startswith("Done: power")

    # Costs recorded for every agent that took a turn
    workers = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    for id in ["ace", "orchestrator", "mgr-engineering", *[w["id"] for w in workers]]:
        turns = await city.ledger.turns_of(id)
        assert turns, id
        assert all(t["usd"] > 0 and t["input"] == 400 and t["cache_read"] == 3000 for t in turns)
    o = (await city.ledger.turns_of("orchestrator"))[0]
    assert (o["model"], o["role"]) == ("fable-5-1", "orchestrator")
    w0 = (await city.ledger.turns_of(workers[0]["id"]))[0]
    assert (w0["model"], w0["department"]) == ("opus-5-5", "Engineering")
    today = await city.ledger.spend("day", "GLOBAL")
    assert today["turns"] == len(city.bus.of_type("cost.update"))
    assert len(city.bus.of_type("cost.update")) >= 10

    # Agents released, slots returned
    assert len(workers) == 3
    assert all(w["state"] == "retired" and w["worker_state"] == "released" for w in workers)
    assert len(city.bus.of_type("agent.retired")) == 3
    assert await city.ledger.active_workers() == 0

    # Sessions follow the agreed shapes
    sessions = [i["sessionId"] for i in city.invocations]
    assert any(s.startswith("ace-owner-c1") for s in sessions)
    assert any(s.startswith(f"orch-{task['id']}") for s in sessions)
    assert any(s.startswith(f"mgr-engineering-{task['id']}") for s in sessions)
    assert any(s.startswith("wkr-engineering-wkr-engineering-") for s in sessions)
    assert all(i["async"] for i in city.invocations if i["role"] == "worker")


async def test_a_crash_mid_turn_resumes_from_the_ledger_without_duplicate_hires() -> None:
    crashed = False
    manager = make_manager()

    async def crashing(req: EngineRequest, call: Call) -> str:
        nonlocal crashed
        if not crashed and "(task) from orchestrator" in req.turn.prompt:
            hired = await call(
                "hire_worker",
                {
                    "specialty": "JavaScript developer",
                    "instructions": "You implement power for add.js.",
                    "tools": ["Bash"],
                },
            )
            wid = re.search(r"Hired (\S+)", hired).group(1)  # type: ignore[union-attr]
            await call("assign", {"worker_id": wid, "goal": PARTS[0], "acceptance": "done"})
            crashed = True
            raise RuntimeError("microVM lost mid-turn")
        return await manager(req, call)

    city = make_city(scripted_engine({"ace": ace, "orchestrator": orchestrator, "manager": crashing, "worker": worker}))
    await city.owner_says(GOAL)
    await city.run()
    assert crashed
    workers = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    assert len(workers) == 3  # the re-run saw one hire in the ledger and added two
    task = next(t for t in await city.ledger.list_tickets(["done"]) if t["from"] == "ace")
    assert "power" in task["result"]


async def _manager_agent(city: City, name: str = "Engineering") -> str:
    mgr = f"mgr-{name.lower()}"
    await city.ledger.create_department(name, f"{name} work.", mgr)
    await city.ledger.put_agent(
        {
            "id": mgr,
            "kind": "manager",
            "role": f"{name} Manager",
            "department": name,
            "model": "fable-5-1",
            "parent": "orchestrator",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    return mgr


async def test_a_worker_turn_whose_microvm_died_is_re_sent_by_the_stale_lease_sweep() -> None:
    city = make_city(scripted_engine({"worker": worker}))
    await _manager_agent(city)
    w = await city.factory.hire(
        {"specialty": "Dev", "instructions": "Write the code please.", "tools": ["Bash"]},
        "mgr-engineering",
        "Engineering",
    )
    parent = await city.ledger.create_ticket(
        {
            "id": "t-mgr",
            "goal": "g",
            "from": "orchestrator",
            "to": "mgr-engineering",
            "department": "Engineering",
            "parent_id": "t-task",
            "kind": "assignment",
        }
    )
    t = await city.ledger.create_ticket(
        {
            "goal": "write it",
            "from": "mgr-engineering",
            "to": w["id"],
            "department": "Engineering",
            "parent_id": parent["id"],
            "kind": "assignment",
        }
    )
    msg = cast(
        WorkMessage,
        {
            "id": "m-lost",
            "role": "worker",
            "agentId": w["id"],
            "department": "Engineering",
            "ticketId": t["id"],
            "taskId": "t-task",
            "kind": "task",
            "from": "mgr-engineering",
            "body": "Assignment: write it",
        },
    )
    # The dispatcher started it, then the microVM died: the lease is taken, the turn never finished.
    await city.ledger.acquire_worker_slot("Engineering", 100, 100)
    await city.ledger.begin_work(msg["id"], 60_000, dict(msg))
    assert await resume_stale(city.ledger, city.queue) == 0  # lease still live
    city.advance(61_000)
    assert await resume_stale(city.ledger, city.queue) == 1
    await city.run()
    assert (await city.ledger.get_ticket(t["id"]) or {})["status"] == "in_review"
    assert await city.ledger.active_workers() == 0  # the dead turn's slot was given back
    assert await city.ledger.is_work_done("m-lost")


async def test_the_next_ace_turn_sees_the_earlier_exchange_typed_or_spoken() -> None:
    prompts: list[str] = []

    async def ace_chat(req: EngineRequest, _: Call) -> str:
        prompts.append(req.turn.prompt)
        return "Eighteen." if len(prompts) == 1 else "You asked about 9 + 9."

    city = make_city(scripted_engine({"ace": ace_chat}))
    await city.owner_says("yo AIC, what's 9 + 9?")
    await city.run()
    await city.owner_says("what did I just ask?")
    await city.run()
    assert "Owner: yo AIC, what's 9 + 9?" in prompts[1]
    assert "AIC: Eighteen." in prompts[1]


async def test_agent_instructions_reach_the_right_worker_with_its_manager_copied() -> None:
    async def quiet_worker(_: EngineRequest, __: Call) -> str:
        return "working on it"

    city = make_city(
        scripted_engine({"ace": ace, "orchestrator": orchestrator, "manager": make_manager(), "worker": quiet_worker})
    )
    await city.owner_says(GOAL)
    await city.run()
    workers = [a for a in await city.ledger.list_agents("active") if a["kind"] == "worker"]
    assert len(workers) == 3
    target = workers[1]
    before = len(city.queue.sent)
    r = await instruct_agent(city.deps, target["id"], "use BigInt for large exponents")
    assert "mgr-engineering copied" in r
    sent = city.queue.sent[before:]
    assert len(sent) == 1  # the worker is woken; the manager is copied without a turn
    assert (sent[0]["role"], sent[0]["agentId"], sent[0]["kind"]) == ("worker", target["id"], "instruction")
    assert "BigInt" in sent[0]["body"]
    ev = city.bus.of_type("instruction")[-1]
    assert ev["to"] == target["id"] and ev["cc"] == ["mgr-engineering"]
    assert "no working agent" in await instruct_agent(city.deps, "nobody", "x")


async def test_500_concurrent_hires_respect_the_ceilings_and_queue_the_rest() -> None:
    city = make_city(
        scripted_engine({}),
        max_concurrent_workers_per_department=100,
        max_concurrent_workers_global=150,
        max_new_sessions_per_second=20,
    )
    for name, n in (("Engineering", 300), ("Research", 200)):
        mgr = await _manager_agent(city, name)
        for _ in range(n):
            w = await city.factory.hire(
                {"specialty": "Analyst", "instructions": "Analyse one item please.", "tools": ["Read"]}, mgr, name
            )
            await city.queue.send(
                cast(
                    WorkMessage,
                    {
                        "id": f"m-{w['id']}",
                        "role": "worker",
                        "agentId": w["id"],
                        "department": name,
                        "ticketId": f"t-{w['id']}",
                        "taskId": "t",
                        "kind": "task",
                        "from": mgr,
                        "body": "go",
                    },
                )
            )
    assert len([a for a in await city.ledger.list_agents() if a["kind"] == "worker"]) == 500  # hiring is unlimited

    # Turns that stay open until we end them, so concurrency is real.
    running: dict[str, str] = {}
    started: set[str] = set()
    peak = peak_eng = peak_res = per_second_max = deferred = 0
    s = await city.deps.settings()

    class Invoker:
        async def invoke(self, inv: dict[str, Any]) -> None:
            assert inv["id"] not in started  # each starts exactly once
            started.add(inv["id"])
            running[inv["id"]] = inv["department"]

    async def settings() -> dict[str, Any]:
        return s

    dispatcher = Dispatcher(
        DispatcherDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            settings=settings,
            session_id_for=session_id_for,
            invoker=Invoker(),
        )
    )

    async def finish(k: int) -> None:
        for id, dept in list(running.items())[:k]:
            del running[id]
            await city.ledger.release_worker_slot(dept)
            await city.ledger.finish_work(id)

    second = 0
    while len(started) < 500 and second < 400:
        this_second = 0
        for m in city.queue.take_ready():
            out = await dispatcher.handle(m)
            if out == "started":
                this_second += 1
            else:
                deferred += 1
            eng = sum(1 for d in running.values() if d == "Engineering")
            peak = max(peak, len(running))
            peak_eng = max(peak_eng, eng)
            peak_res = max(peak_res, len(running) - eng)
        per_second_max = max(per_second_max, this_second)
        await finish(5)  # a few turns end every second
        city.advance(1000)
        second += 1
    assert len(started) == 500
    assert peak <= 150
    assert peak_eng <= 100
    assert peak_res <= 100
    assert per_second_max <= 20
    assert peak == 150  # the ceilings were actually reached
    assert deferred > 0  # the rest waited in the queue
