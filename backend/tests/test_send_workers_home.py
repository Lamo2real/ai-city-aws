"""The owner's "send the workers home": every worker drops its work and walks home; nothing else changes."""

from aic.runtime.prompts import load_prompt
from aic.runtime.tools import TurnCtx, tools_for
from test_task_control import SPEC, ace_tools, city, job


async def test_asks_first_then_stops_every_job_and_everyone_stays_home() -> None:
    c = await city()
    porsche = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences", workers=2)
    game = await job(c, "Build a snake game", "snake game", department_name="Apps", workers=1)
    tools = ace_tools(c)
    before = await c.ledger.settings({})

    ask = await tools["send_workers_home"].handler({"confirm": False})
    assert ask.startswith("Send everyone home and stop all 2 jobs? 3 workers will drop everything.")
    assert all(w["state"] == "active" for w in await c.ledger.list_agents() if w["kind"] == "worker")  # not yet

    said = await tools["send_workers_home"].handler({"confirm": True})
    assert said.startswith("Sent 3 workers home and stopped 2 jobs.") and "until the owner starts a new job" in said
    workers = [a for a in await c.ledger.list_agents() if a["kind"] == "worker"]
    assert len(workers) == 3 and all(w["state"] == "retired" and w["worker_state"] == "released" for w in workers)
    assert len(c.bus.of_type("agent.retired")) == 3  # one per worker: the City walks each one home
    for task in (porsche, game):
        assert (await c.ledger.get_ticket(task["id"]))["status"] == "cancelled"
    assert [t for t in await c.ledger.list_tickets(["open", "in_progress", "in_review", "waiting_on_owner"])] == []
    # Managers stand down: dormant, their departments hire nothing, nobody is asked to re-assign.
    for mgr, dept in (("mgr-writing", "Writing"), ("mgr-apps", "Apps")):
        assert (await c.ledger.get_agent(mgr))["state"] == "dormant"
        assert (await c.ledger.get_department(dept)).get("stood_down_at")
    assert not [m for m in c.queue.sent if "Assign again" in str(m.get("body"))]
    assert (await c.ledger.settings({})) == before

    # A manager that somehow gets a turn cannot hire; a new goal from the Orchestrator lifts the stand-down.
    mgr_ctx = TurnCtx(agent_id="mgr-writing", role="manager", department="Writing", ticket_id="g-old", task_id="t-old")
    mgr_tools = {t.name: t for t in tools_for(c.host.d, mgr_ctx)}
    refused = await mgr_tools["hire_worker"].handler(SPEC)
    assert refused.startswith("Hire refused: The owner sent everyone home")
    new_task = await c.ledger.create_ticket(
        {"goal": "Write a haiku", "from": "ace", "to": "orchestrator", "department": None, "parent_id": None,
         "kind": "task", "owner_words": "write me a haiku", "status": "open"}
    )  # fmt: skip
    orch_ctx = TurnCtx(
        agent_id="orchestrator", role="orchestrator", department=None, ticket_id=new_task["id"], task_id=new_task["id"]
    )
    orch_tools = {t.name: t for t in tools_for(c.host.d, orch_ctx)}
    await orch_tools["assign_to_department"].handler(
        {"department": "Writing", "goal": "A haiku", "acceptance": "17 syllables"}
    )
    assert not (await c.ledger.get_department("Writing")).get("stood_down_at")
    assert (await mgr_tools["hire_worker"].handler(SPEC)).startswith("Hired ")

    assert (await tools["send_workers_home"].handler({"confirm": False})).startswith(
        "Send everyone home and stop all 1 job?"
    )


def test_the_prompt_keeps_send_home_and_stop_apart_and_never_pauses() -> None:
    body = load_prompt("ace.md").body
    assert "send_workers_home" in load_prompt("ace.md").tools
    assert "The three controls" in body and "always on" in body and "stops every job" in body
    assert "never argue" in body and "builder session" in body and "Never answer for them" in body
    assert "confirm=false`, which gives you the one short question" in body
    assert "pause_city" not in body and "resume_city" not in body
    assert "pause_city" not in load_prompt("ace.md").tools and "resume_city" not in load_prompt("ace.md").tools
    assert body.index("`send_workers_home` with `confirm=false`") < body.index("## The three controls")


def test_aic_releases_workers_in_process_never_through_the_factory_lambda() -> None:
    """VAIC's role may not invoke the Agent Factory Lambda (only managers hire), so its send-home and cancel
    must not depend on it: the ace runtime gets the in-process factory, the other roles the Lambda client."""
    from types import SimpleNamespace

    from aic.runtime.server import factory_for
    from aic.shared.aws import LambdaFactoryClient
    from aic.shared.hierarchy.factory import Factory

    class NeverCalled:
        def client(self, *_: object, **__: object) -> object:
            raise AssertionError("VAIC must not build a Lambda client for releasing")

    async def settings() -> dict[str, object]:
        return {}

    city = SimpleNamespace(ledger=object(), bus=object(), settings=settings, session=NeverCalled())
    assert isinstance(factory_for("ace", city, {"AIC_FACTORY_FUNCTION": "aic-prod-factory"}), Factory)

    class Session:
        def client(self, name: str, **_: object) -> object:
            return SimpleNamespace(name=name)

    city.session = Session()
    assert isinstance(factory_for("manager", city, {"AIC_FACTORY_FUNCTION": "aic-prod-factory"}), LambdaFactoryClient)


async def test_send_home_sends_only_the_named_ones_and_leaves_jobs_and_managers_alone() -> None:
    c = await city()
    porsche = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences", workers=2)
    await job(c, "Build a snake game", "snake game", department_name="Apps", workers=1)
    tools = ace_tools(c)
    before = [w["id"] for w in await c.ledger.list_agents() if w["kind"] == "worker" and w["state"] != "retired"]
    apps_worker = next(
        w["id"] for w in await c.ledger.list_agents() if w["kind"] == "worker" and w["department"] == "Apps"
    )

    # The owner's words pick the workers; nothing moves without the yes.
    ask = await tools["send_home"].handler({"who": "the apps one", "confirm": False})
    assert ask.startswith("Send 1 worker home: ") and apps_worker in ask and "confirm=true" in ask
    assert (await c.ledger.get_agent(apps_worker))["state"] == "active"
    assert (await tools["send_home"].handler({"who": "the accountant", "confirm": False})).startswith(
        "Nobody at work matches"
    )

    said = await tools["send_home"].handler({"who": apps_worker, "confirm": True})
    assert said.startswith(f"Sent 1 worker home ({apps_worker}") and "1 unfinished part stopped" in said
    gone = await c.ledger.get_agent(apps_worker)
    assert gone["state"] == "retired" and gone["worker_state"] == "released"
    assert [e["id"] for e in c.bus.of_type("agent.retired")] == [apps_worker]
    # The other job and its workers, and every manager, are untouched; nobody is asked to re-hire.
    assert (await c.ledger.get_ticket(porsche["id"]))["status"] == "in_progress"
    still = [w["id"] for w in await c.ledger.list_agents() if w["kind"] == "worker" and w["state"] != "retired"]
    assert sorted(still) == sorted(set(before) - {apps_worker})
    assert (await c.ledger.get_agent("mgr-apps"))["state"] != "dormant"
    assert not [m for m in c.queue.sent if "Assign again" in str(m.get("body"))]

    # A number sends that many (newest first); "everyone" is the big control.
    assert (await tools["send_home"].handler({"who": "2", "confirm": False})).startswith("Send 2 workers home: ")
    assert (await tools["send_home"].handler({"who": "everyone", "confirm": False})).startswith(
        "Send everyone home and stop all"
    )
    assert (await tools["send_home"].handler({"who": "writing", "confirm": True})).startswith("Sent 2 workers home")
    assert (await tools["send_home"].handler({"who": "anyone", "confirm": False})) == "Nobody is at work right now."


def test_pick_workers_understands_ids_departments_roles_numbers_and_everyone() -> None:
    from aic.shared.hierarchy.actions import pick_workers

    at_work = [
        {"id": "wkr-1", "role": "Writer", "department": "Research & Writing", "hired_at": "2026-11-08T00:01:00Z"},
        {
            "id": "wkr-2",
            "role": "Audio Engineer",
            "department": "Voice Engineering",
            "hired_at": "2026-11-08T00:02:00Z",
        },
        {"id": "wkr-3", "role": "Game Developer", "department": "Apps", "hired_at": "2026-11-08T00:03:00Z"},
    ]
    ids = lambda r: [w["id"] for w in r[0]]  # noqa: E731
    assert ids(pick_workers(at_work, "everyone")) == ["wkr-1", "wkr-2", "wkr-3"]
    assert ids(pick_workers(at_work, "WKR-2")) == ["wkr-2"]
    assert ids(pick_workers(at_work, "the voice engineering guy")) == ["wkr-2"]
    assert ids(pick_workers(at_work, "the writer")) == ["wkr-1"]
    assert ids(pick_workers(at_work, "2")) == ["wkr-3", "wkr-2"]
    assert pick_workers(at_work, "the plumber")[1].startswith("Nobody at work matches")
    assert pick_workers([], "everyone")[1] == "Nobody is at work right now."
