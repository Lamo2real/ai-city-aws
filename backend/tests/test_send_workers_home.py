"""The owner's "send the workers home": every worker drops its work and walks home; the city is not paused."""

from aic.runtime.prompts import load_prompt
from test_task_control import ace_tools, city, job


async def test_asks_first_then_sends_everyone_home_without_pausing() -> None:
    c = await city()
    porsche = await job(c, "Write 50 sentences comparing the GT3 and GT3 RS engines", "porsche sentences", workers=2)
    game = await job(c, "Build a snake game", "snake game", department_name="Apps", workers=1)
    tools = ace_tools(c)
    before = await c.ledger.settings({})

    ask = await tools["send_workers_home"].handler({"confirm": False})
    assert ask.startswith("Send all 3 workers home now? They'll drop what they're doing.")
    assert all(w["state"] == "active" for w in await c.ledger.list_agents() if w["kind"] == "worker")  # not yet

    said = await tools["send_workers_home"].handler({"confirm": True})
    assert said.startswith("Sent 3 workers home.") and "3 parts" in said and "still running" in said
    workers = [a for a in await c.ledger.list_agents() if a["kind"] == "worker"]
    assert len(workers) == 3 and all(w["state"] == "retired" and w["worker_state"] == "released" for w in workers)
    assert len(c.bus.of_type("agent.retired")) == 3  # one per worker: the City walks each one home
    # Their parts wait for a new worker; the jobs themselves stay, and so do the managers' goals.
    for task in (porsche, game):
        assert (await c.ledger.get_ticket(task["id"]))["status"] == "in_progress"
    parts = [
        t
        for t in await c.ledger.list_tickets(["cancelled"])
        if t.get("kind") == "assignment" and t["to"].startswith("wkr-")
    ]
    assert len(parts) == 3
    for p in parts:
        assert "sent home by the owner" in (await c.ledger.ticket_history(p["id"]))[-1]["note"]
    # Each manager hears once, listing its parts.
    notes = [m for m in c.queue.sent if m.get("from") == "city" and "sent the workers home" in m["body"]]
    assert sorted(m["agentId"] for m in notes) == ["mgr-apps", "mgr-writing"]
    assert sum(m["body"].count(": part ") for m in notes) == 3
    # Nothing paused.
    after = await c.ledger.settings({})
    assert not after.get("paused") and after.get("paused") == before.get("paused")
    assert c.bus.of_type("city.state") == []

    assert await tools["send_workers_home"].handler({"confirm": True}) == "Nobody is at work right now."
    assert await tools["send_workers_home"].handler({"confirm": False}) == "Nobody is at work right now."


def test_the_prompt_keeps_pause_send_home_and_stop_apart() -> None:
    body = load_prompt("ace.md").body
    assert "send_workers_home" in load_prompt("ace.md").tools
    assert "Never pause for this" in body and "The four controls" in body
    assert body.index("`send_workers_home` with `confirm=false`") < body.index("## The four controls")
