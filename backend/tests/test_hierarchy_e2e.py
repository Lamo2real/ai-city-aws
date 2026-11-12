"""One prompt walks the whole job on the project board with a fake model runner (decision 298).

owner → VAIC → the board's planner writes three parts for Builders → each part's worker starts as it is written →
workers report → the tests run → the Builders reviewer rejects one (FAIL) → the worker fixes it → PASS → the
whole-app check → the board closes the job → VAIC reports.
"""

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import Any, cast

from city_support import Call, City, Script, make_city, make_department, scripted_engine, session_id_for
from vaic.runtime.engine import EngineRequest
from vaic.shared.hierarchy.actions import instruct_agent
from vaic.shared.hierarchy.dispatch import Dispatcher, DispatcherDeps, resume_stale
from vaic.shared.hierarchy.queue import WorkMessage
from vaic.shared.ledger import ALL_STATUSES

GOAL = "Add a power(a, b) function to add.js with a matching test"
PARTS = ["implement power", "write the test", "update the docs"]


async def vaic(req: EngineRequest, call: Call) -> str:
    if "(task) from owner" in req.turn.prompt:
        await call("start_job", {"goal": GOAL, "owner_words": GOAL, "confirm": True})
        return "On it — the team is starting."
    return "Done: power(a, b) is in add.js with a test, reviewed and checked. About a cent of model time."


async def orchestrator(req: EngineRequest, call: Call) -> str:
    """The board's planner (it runs on the runtime still called "orchestrator" inside)."""
    if "Board planning" not in req.turn.prompt:
        return "Nothing to plan."
    for part in PARTS:
        await call(
            "add_part",
            {
                "name": part,
                "goal": part,
                "acceptance": f"{part} is done and checked",
                "department": "Builders",
                "files": [f"{part.replace(' ', '-')}.js"],
            },
        )
    await call("finish_plan", {})
    return "Planned."


def make_manager() -> Script:
    """The Builders reviewer: it fails "write the test" once, then passes everything."""
    failed_once: set[str] = set()

    async def manager(req: EngineRequest, call: Call) -> str:
        if "Board review" not in req.turn.prompt:
            return "Nothing to review."
        t = await req.ledger.get_ticket(req.ctx.ticket_id)
        assert t
        if t["goal"] == "write the test" and t["id"] not in failed_once:
            failed_once.add(t["id"])
            await call(
                "review",
                {"ticket_id": t["id"], "verdict": "FAIL", "reasons": "The test does not cover negative exponents."},
            )
            return "FAIL"
        await call("review", {"ticket_id": t["id"], "verdict": "PASS", "reasons": "Meets the acceptance criteria."})
        return "PASS"

    return manager


async def worker(req: EngineRequest, call: Call) -> str:
    fixing = "(fix)" in req.turn.prompt
    checking = "whole-app check" in req.turn.prompt
    summary = (
        "power(a, b) is in add.js with a test and docs; every part fits."
        if checking
        else "Added negative exponent cases; all tests pass."
        if fixing
        else "Done."
    )
    await call(
        "report_to_manager", {"summary": summary, "artifacts": ["branch vaic/power"], "checks": "npm test: pass"}
    )
    return "Reported."


async def builders_city(engine: Any) -> City:
    city = make_city(engine)
    await make_department(city, "Builders")
    return city


async def test_walks_one_prompt_from_the_owner_to_aces_report() -> None:
    city = await builders_city(
        scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": make_manager(), "worker": worker})
    )
    await city.owner_says(GOAL)
    await city.run()

    # Ledger tickets
    every = await city.ledger.list_tickets(ALL_STATUSES)
    task = next(t for t in every if t["from"] == "vaic")
    assert task["status"] == "done" and task["path"] == "board" and task["planned"]
    assert "power" in task["result"]
    dept = next(t for t in every if t["from"] == "orchestrator")
    assert (dept["status"], dept["department"], dept["to"]) == ("done", "Builders", "mgr-builders")
    assignments = [t for t in every if t["from"] == "mgr-builders"]
    assert len(assignments) == 4  # three parts and the whole-app check
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
    assert len(city.bus.of_type("agent.hired")) == 4  # one worker per part, and the check's
    reviews = city.bus.of_type("review.result")
    assert sum(r["verdict"] == "FAIL" for r in reviews) == 1
    assert sum(r["verdict"] == "PASS" for r in reviews) == 4  # three reviewed parts and the check
    signoffs = city.bus.of_type("signoff.result")
    assert len(signoffs) == 1 and signoffs[0]["verdict"] == "PASS" and signoffs[0]["ticket_id"] == task["id"]
    assert len(city.bus.of_type("result")) == 1
    assert types.index("signoff.result") < types.index("result")
    replies = [r for r in city.bus.of_type("vaic.reply") if r["done"]]
    assert replies[-1]["text"].startswith("Done: power")

    # Costs recorded for every agent that took a turn, on the build map's models
    workers = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    for id in ["vaic", "orchestrator", "mgr-builders", *[w["id"] for w in workers]]:
        turns = await city.ledger.turns_of(id)
        assert turns, id
        assert all(t["usd"] > 0 and t["input"] == 400 and t["cache_read"] == 3000 for t in turns)
    o = (await city.ledger.turns_of("orchestrator"))[0]
    assert (o["model"], o["role"]) == ("sonnet-5-5", "orchestrator")  # the planner of a small job
    assert {t["model"] for t in await city.ledger.turns_of("mgr-builders")} == {"opus-5-5"}  # the reviewer
    models = sorted(w["model"] for w in workers)
    assert models == ["opus-5-5", "sonnet-5-5", "sonnet-5-5", "sonnet-5-5"]  # the check on the reviewer's model
    today = await city.ledger.spend("day", "GLOBAL")
    assert today["turns"] == len(city.bus.of_type("cost.update"))

    # Agents released, slots returned
    assert all(w["state"] == "retired" and w["worker_state"] == "released" for w in workers)
    assert len(city.bus.of_type("agent.retired")) == 4
    assert await city.ledger.active_workers() == 0

    # Sessions follow the agreed shapes
    sessions = [i["sessionId"] for i in city.invocations]
    assert any(s.startswith("vaic-owner-c1") for s in sessions)
    assert any(s.startswith(f"orch-{task['id']}") for s in sessions)
    assert any(s.startswith(f"mgr-builders-{task['id']}") for s in sessions)
    assert any(s.startswith("wkr-builders-wkr-builders-") for s in sessions)
    # Everyone but VAIC is handed off as an async job; only VAIC's call waits for its reply (decision 178)
    assert all(i["async"] == (i["role"] != "vaic") for i in city.invocations)


async def test_a_crash_mid_turn_resumes_from_the_ledger_without_duplicate_parts() -> None:
    crashed = False

    async def crashing(req: EngineRequest, call: Call) -> str:
        nonlocal crashed
        if not crashed and "Board planning" in req.turn.prompt:
            await call(
                "add_part",
                {"name": PARTS[0], "goal": PARTS[0], "acceptance": "done", "department": "Builders"},
            )
            crashed = True
            raise RuntimeError("microVM lost mid-turn")
        return await orchestrator(req, call)

    city = await builders_city(
        scripted_engine({"vaic": vaic, "orchestrator": crashing, "manager": make_manager(), "worker": worker})
    )
    await city.owner_says(GOAL)
    await city.run()
    assert crashed
    workers = [a for a in await city.ledger.list_agents() if a["kind"] == "worker"]
    assert len(workers) == 4  # the re-run found the first part on the board and added only the other two
    task = next(t for t in await city.ledger.list_tickets(["done"]) if t["from"] == "vaic")
    assert "power" in task["result"]


async def _manager_agent(city: City, name: str = "Builders") -> str:
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


async def _lost_worker_message(city: City) -> tuple[WorkMessage, dict[str, Any]]:
    await _manager_agent(city)
    w = await city.factory.hire(
        {"specialty": "Dev", "instructions": "Write the code please.", "tools": ["Bash"]},
        "mgr-builders",
        "Builders",
    )
    parent = await city.ledger.create_ticket(
        {
            "id": "t-mgr",
            "goal": "g",
            "from": "orchestrator",
            "to": "mgr-builders",
            "department": "Builders",
            "parent_id": "t-task",
            "kind": "assignment",
        }
    )
    t = await city.ledger.create_ticket(
        {
            "goal": "write it",
            "from": "mgr-builders",
            "to": w["id"],
            "department": "Builders",
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
            "department": "Builders",
            "ticketId": t["id"],
            "taskId": "t-task",
            "kind": "task",
            "from": "mgr-builders",
            "body": "Assignment: write it",
        },
    )
    return msg, t


async def test_a_worker_turn_whose_microvm_died_is_re_sent_by_the_stale_lease_sweep() -> None:
    city = make_city(scripted_engine({"worker": worker}))
    msg, t = await _lost_worker_message(city)
    # The dispatcher started it, then the microVM died: the lease is taken, the turn never finished.
    await city.ledger.acquire_worker_slot("Builders", 100, 100)
    await city.ledger.begin_work(msg["id"], 60_000, dict(msg))
    assert await resume_stale(city.ledger, city.queue) == 0  # lease still live
    city.advance(61_000)
    assert await resume_stale(city.ledger, city.queue) == 1
    await city.run()
    assert (await city.ledger.get_ticket(t["id"]) or {})["status"] == "in_review"
    assert await city.ledger.active_workers() == 0  # the dead turn's slot was given back
    assert await city.ledger.is_work_done("m-lost")


class _Accepts:
    """Like AgentCore for a worker: the job is accepted and runs later, on its own."""

    async def invoke(self, inv: dict[str, Any]) -> None:
        return None


def _async_dispatcher(city: City) -> Dispatcher:
    return Dispatcher(
        DispatcherDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            invoker=_Accepts(),
            settings=city.deps.settings,
            session_id_for=session_id_for,
            worker_lease_ms=451 * 60_000,
        )
    )


async def test_a_long_worker_turn_is_not_sent_again_while_it_is_still_running() -> None:
    city = make_city(scripted_engine({"worker": worker}))
    msg, _ = await _lost_worker_message(city)
    assert await _async_dispatcher(city).handle(msg) == "started"
    city.advance(60 * 60_000)  # an hour in: far past a normal turn's lease, well inside a worker's long job
    assert await resume_stale(city.ledger, city.queue) == 0
    assert await city.ledger.active_workers() == 1
    city.advance(400 * 60_000)  # past the long-job limit: now it is a dead turn
    assert await resume_stale(city.ledger, city.queue) == 1


async def test_a_worker_starts_in_its_own_folder_which_exists_before_claude_does() -> None:
    # Claude refuses a working directory that doesn't exist: every worker turn failed on it (decision 205).
    seen: list[str | None] = []

    async def looks(req: EngineRequest, _: Call) -> str:
        seen.append(req.cwd)
        assert req.cwd and await asyncio.to_thread(Path(req.cwd).is_dir)
        return "ok"

    city = make_city(scripted_engine({"worker": looks}))
    msg, _ = await _lost_worker_message(city)
    shutil.rmtree(f"/tmp/work/{msg['agentId']}", ignore_errors=True)
    assert await _async_dispatcher(city).handle(msg) == "started"
    await city.host.run_turn({**msg, "sessionId": "s-1", "async": True})
    assert seen == [f"/tmp/work/{msg['agentId']}"]


async def test_a_worker_turn_that_fails_gives_its_slot_back_once_and_is_sent_again_soon() -> None:
    async def boom(req: EngineRequest, call: Call) -> str:
        raise RuntimeError("the model call failed")

    city = make_city(scripted_engine({"worker": boom}))
    msg, _ = await _lost_worker_message(city)
    assert await _async_dispatcher(city).handle(msg) == "started"
    try:
        await city.host.run_turn({**msg, "sessionId": "s-1", "async": True})
    except RuntimeError:
        pass
    else:
        raise AssertionError("the turn should have failed")
    assert await city.ledger.active_workers() == 0
    # The city shows it failed, with the reason, instead of the "understanding" the turn started with.
    last = [e for e in city.bus.of_type("activity") if e["id"] == msg["agentId"]][-1]
    assert last["activity"] == "failed"
    assert last["detail"] == "Its last try failed: RuntimeError: the model call failed"
    assert await resume_stale(city.ledger, city.queue) == 1  # at once, not after the long lease
    assert await city.ledger.active_workers() == 0  # and the slot is not given back a second time


async def test_a_turn_for_a_stopped_job_is_finished_so_the_sweep_does_not_send_it_again() -> None:
    city = make_city(scripted_engine({"worker": worker}))
    msg, t = await _lost_worker_message(city)
    assert await _async_dispatcher(city).handle(msg) == "started"
    await city.ledger.set_ticket_status(t["id"], "cancelled", "stopped")
    assert await city.host.run_turn({**msg, "sessionId": "s-1", "async": True}) == ""
    assert await city.ledger.is_work_done(msg["id"])
    assert await city.ledger.active_workers() == 0


async def test_the_next_vaic_turn_sees_the_earlier_exchange_typed_or_spoken() -> None:
    prompts: list[str] = []

    async def vaic_chat(req: EngineRequest, _: Call) -> str:
        prompts.append(req.turn.prompt)
        return "Eighteen." if len(prompts) == 1 else "You asked about 9 + 9."

    city = make_city(scripted_engine({"vaic": vaic_chat}))
    await city.owner_says("yo VAIC, what's 9 + 9?")
    await city.run()
    await city.owner_says("what did I just ask?")
    await city.run()
    assert "Owner: yo VAIC, what's 9 + 9?" in prompts[1]
    assert "VAIC: Eighteen." in prompts[1]


async def test_agent_instructions_reach_the_right_worker_with_its_manager_copied() -> None:
    async def quiet_worker(_: EngineRequest, __: Call) -> str:
        return "working on it"

    city = await builders_city(
        scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": make_manager(), "worker": quiet_worker})
    )
    await city.owner_says(GOAL)
    await city.run()
    workers = [a for a in await city.ledger.list_agents("active") if a["kind"] == "worker"]
    assert len(workers) == 3
    target = workers[1]
    before = len(city.queue.sent)
    r = await instruct_agent(city.deps, target["id"], "use BigInt for large exponents")
    assert "mgr-builders copied" in r
    sent = city.queue.sent[before:]
    assert len(sent) == 1  # the worker is woken; the manager is copied without a turn
    assert (sent[0]["role"], sent[0]["agentId"], sent[0]["kind"]) == ("worker", target["id"], "instruction")
    assert "BigInt" in sent[0]["body"]
    ev = city.bus.of_type("instruction")[-1]
    assert ev["to"] == target["id"] and ev["cc"] == ["mgr-builders"]
    assert "no working agent" in await instruct_agent(city.deps, "nobody", "x")


async def test_500_concurrent_hires_have_no_city_ceiling_and_wait_out_aws_throttling() -> None:
    # No agent-count limit (decision 288): only AWS says "not now", here an AgentCore session quota of 150.
    city = make_city(scripted_engine({}), max_new_sessions_per_second=20)
    for name, n in (("Builders", 300), ("Research", 200)):
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

    class ServiceQuotaExceededException(Exception):
        pass

    class Invoker:
        async def invoke(self, inv: dict[str, Any]) -> None:
            if len(running) >= 150:
                raise ServiceQuotaExceededException("Active session workloads per account exceeded")
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
            out = await dispatcher.handle(m)  # throttling never raises: the message waits and tries again
            if out == "started":
                this_second += 1
            else:
                assert out in ("deferred:throttled", "deferred:rate")
                deferred += 1
            eng = sum(1 for d in running.values() if d == "Builders")
            peak = max(peak, len(running))
            peak_eng = max(peak_eng, eng)
            peak_res = max(peak_res, len(running) - eng)
        per_second_max = max(per_second_max, this_second)
        await finish(5)  # a few turns end every second
        city.advance(1000)
        second += 1
    assert len(started) == 500  # every one started, none failed
    assert peak == 150  # AWS's quota was reached; the city itself never stopped one
    assert per_second_max <= 20
    assert deferred > 0  # the rest waited in the queue


async def test_a_spoken_request_runs_as_a_turn_although_it_comes_with_no_session_id() -> None:
    async def says(req: EngineRequest, call: Call) -> str:
        return "Good morning, Sir."

    city = make_city(scripted_engine({"vaic": says}))
    spoken = {
        "id": "voice-1",
        "role": "vaic",
        "agentId": "vaic",
        "department": None,
        "ticketId": "conv-main",
        "taskId": "conv-main",
        "kind": "task",
        "from": "owner",
        "body": "good morning",
        "conversation": "main",
        "voice": True,
    }
    assert await city.host.run_turn(spoken) == "Good morning, Sir."
