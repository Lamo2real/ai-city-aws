"""Workers go home: released the moment their last assignment passes (or is cancelled), and released by the
sweep after sitting idle. The City scene walks a released worker home."""

from typing import Any

from aic.lambdas.scheduler import run_job
from aic.runtime.tools import TurnCtx, tools_for
from city_support import City, make_city, scripted_engine

SPEC = {"specialty": "Writer", "instructions": "Write the piece.", "tools": ["Read"], "budget_hint_usd": 1}
MIN = 60_000


async def manager(city: City, name: str = "Writing") -> str:
    mgr = f"mgr-{name.lower()}"
    await city.ledger.create_department(name, f"{name} work.", mgr)
    await city.ledger.put_agent(
        {
            "id": mgr,
            "kind": "manager",
            "role": f"{name} Manager",
            "department": name,
            "model": "fable-5-2",
            "parent": "orchestrator",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    return mgr


def tool(city: City, mgr: str, name: str, ticket: str = "goal-1") -> Any:
    ctx = TurnCtx(agent_id=mgr, role="manager", department="Writing", ticket_id=ticket, task_id="task-1")
    return next(t for t in tools_for(city.deps, ctx) if t.name == name).handler


async def hired_and_assigned(city: City, mgr: str, parts: list[str]) -> tuple[str, list[str]]:
    wid = (await tool(city, mgr, "hire_worker")(SPEC)).split()[1]
    tickets = []
    for p in parts:
        said = await tool(city, mgr, "assign")({"worker_id": wid, "goal": p, "acceptance": f"{p} done"})
        tickets.append(said.split()[1])
    return wid, tickets


async def reported(city: City, ticket: str) -> None:
    await city.ledger.set_ticket_status(ticket, "in_review", "reported", {})


def retired(city: City) -> list[str]:
    return [e["id"] for e in city.bus.of_type("agent.retired")]


async def test_a_worker_goes_home_the_moment_its_only_assignment_passes_review() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, (t,) = await hired_and_assigned(city, mgr, ["write it"])
    await reported(city, t)
    said = await tool(city, mgr, "review")({"ticket_id": t, "verdict": "PASS", "reasons": "Good."})
    assert said == f"PASS recorded. {wid} has finished and gone home."
    w = await city.ledger.get_agent(wid)
    assert w and w["state"] == "retired" and w["worker_state"] == "released"
    assert retired(city) == [wid]
    # The manager's own release afterwards changes nothing and raises nothing.
    assert await tool(city, mgr, "release_worker")({"worker_id": wid}) == f"Released {wid}."
    assert retired(city) == [wid]


async def test_a_worker_with_another_open_assignment_stays_until_that_passes_too() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, (t1, t2) = await hired_and_assigned(city, mgr, ["part one", "part two"])
    await reported(city, t1)
    said = await tool(city, mgr, "review")({"ticket_id": t1, "verdict": "PASS", "reasons": "Good."})
    assert "still has other work" in said
    assert (await city.ledger.get_agent(wid) or {})["state"] == "active"
    assert retired(city) == []
    await reported(city, t2)
    await tool(city, mgr, "review")({"ticket_id": t2, "verdict": "PASS", "reasons": "Good."})
    assert (await city.ledger.get_agent(wid) or {})["worker_state"] == "released"
    assert retired(city) == [wid]


async def test_a_cancelled_assignment_sends_its_worker_home_once() -> None:
    from aic.shared.hierarchy.actions import move

    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, (t,) = await hired_and_assigned(city, mgr, ["write it"])
    await move(city.deps, t, "cancelled", "stopped")
    await move(city.deps, t, "cancelled", "stopped again")
    assert retired(city) == [wid]


async def test_the_sweep_sends_an_idle_worker_home_after_15_minutes() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, (t,) = await hired_and_assigned(city, mgr, ["write it"])
    sent = len(city.queue.sent)
    city.advance(10 * MIN)
    assert await run_job("sweep", city.ledger, city.queue, city.bus, {}) == {"resent": 0, "sent_home": 0}
    assert (await city.ledger.get_agent(wid) or {})["state"] == "active"
    city.advance(6 * MIN)
    assert await run_job("sweep", city.ledger, city.queue, city.bus, {}) == {"resent": 0, "sent_home": 1}
    w = await city.ledger.get_agent(wid)
    assert w and w["state"] == "retired" and w["worker_state"] == "released"
    assert retired(city) == [wid]
    # Its unfinished assignment is cancelled with a note, and the manager is told to assign again.
    ticket = await city.ledger.get_ticket(t)
    assert ticket and ticket["status"] == "cancelled"
    note = (await city.ledger.ticket_history(t))[-1]
    assert "went home after 15 idle minutes" in note["note"]
    to_manager = [m for m in city.queue.sent[sent:] if m["agentId"] == mgr]
    assert len(to_manager) == 1 and wid in to_manager[0]["body"] and "Assign again" in to_manager[0]["body"]
    # Nothing to do twice.
    assert await run_job("retire_idle", city.ledger, city.queue, city.bus, {}) == {"dormant": 1, "sent_home": 0}


async def test_a_worker_whose_turn_is_running_is_not_idle() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, _ = await hired_and_assigned(city, mgr, ["write it"])
    msg = next(m for m in city.queue.sent if m["agentId"] == wid)
    # Hired 20 minutes ago, but its turn started 2 minutes ago under the dispatcher's 16-minute lease.
    city.advance(18 * MIN)
    assert await city.ledger.begin_work(msg["id"], 16 * MIN, msg)
    city.advance(2 * MIN)
    assert await run_job("sweep", city.ledger, city.queue, city.bus, {}) == {"resent": 0, "sent_home": 0}
    assert (await city.ledger.get_agent(wid) or {})["state"] == "active"
    await city.ledger.finish_work(msg["id"])
    city.advance(20 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["sent_home"] == 1


async def test_a_lease_longer_than_a_turn_may_take_does_not_keep_a_worker_at_its_desk() -> None:
    """A dead turn's leftover (a lease far in the future) must not count as "busy"."""
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, _ = await hired_and_assigned(city, mgr, ["write it"])
    msg = next(m for m in city.queue.sent if m["agentId"] == wid)
    assert await city.ledger.begin_work(msg["id"], 8 * 60 * MIN, msg)  # 8 hours: not a turn, a leftover
    city.advance(20 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["sent_home"] == 1
    assert (await city.ledger.get_agent(wid) or {})["worker_state"] == "released"


async def test_a_worker_that_never_had_a_turn_counts_from_its_hire_time() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    wid, _ = await hired_and_assigned(city, mgr, ["write it"])
    a = dict(await city.ledger.get_agent(wid) or {})
    del a["last_active_at"]
    await city.ledger.put_agent(a)
    assert "last_active_at" not in (await city.ledger.get_agent(wid) or {})
    city.advance(10 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["sent_home"] == 0
    city.advance(6 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}))["sent_home"] == 1


async def test_one_worker_that_cannot_be_released_does_not_keep_the_others_at_work() -> None:
    city = make_city(scripted_engine({}))
    mgr = await manager(city)
    good, _ = await hired_and_assigned(city, mgr, ["write it"])
    bad, _ = await hired_and_assigned(city, mgr, ["draw it"])

    class Flaky:
        """The factory fails for one worker (a broken record, a lost write): the sweep logs it and goes on."""

        async def hire(self, spec: Any, manager_id: str, department: str) -> Any:
            return await city.factory.hire(spec, manager_id, department)

        async def release(self, worker_id: str, manager_id: str) -> Any:
            if worker_id == bad:
                raise RuntimeError("lost write")
            return await city.factory.release(worker_id, manager_id)

    city.advance(20 * MIN)
    assert (await run_job("sweep", city.ledger, city.queue, city.bus, {}, factory=Flaky()))["sent_home"] == 1
    assert (await city.ledger.get_agent(good) or {})["worker_state"] == "released"
    assert (await city.ledger.get_agent(bad) or {})["state"] == "active"
