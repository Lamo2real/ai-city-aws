"""The team listens to the owner, and only to the owner: questions are answered with the owner's own words,
never a default VAIC fills in; hard ceilings stop runaway hiring, jobs and departments even if prompts fail."""

from typing import Any

from aic.runtime.tools import TurnCtx, tools_for
from aic.shared.utility import about_ai_city
from test_task_control import SPEC, ace_tools, city, department, job


async def test_aic_cannot_answer_a_question_with_words_the_owner_did_not_say() -> None:
    c = await city()
    task = await job(c, "Build a snake game", "snake game", department_name="Apps", workers=1)
    q = await c.ledger.ask_question(
        {"asked_by": "mgr-apps", "path": "mgr-apps", "ticket_id": task["id"], "text": "Dark or light theme?",
         "options": ["Dark", "Light"], "default_answer": "Dark"}
    )  # fmt: skip
    ctx = TurnCtx(
        agent_id="ace", role="ace", department=None, ticket_id="conv-main", task_id="conv-main", conversation="main"
    )
    tools = {t.name: t for t in tools_for(c.host.d, ctx)}
    # The default, invented: refused, the question stays open, nothing is sent to the manager.
    out = await tools["answer_question"].handler({"question_id": q["id"], "answer": "Dark"})
    assert out.startswith("Not sent: the owner hasn't said that")
    assert (await c.ledger.get_question(q["id"]))["status"] == "open"
    assert not [m for m in c.queue.sent if m.get("kind") == "answer"]
    # The owner's own words: sent.
    await c.ledger.add_conversation_line("main", "owner", "go with light please")
    assert (await tools["answer_question"].handler({"question_id": q["id"], "answer": "dark"})).startswith("Not sent")
    out = await tools["answer_question"].handler({"question_id": q["id"], "answer": "Light"})
    assert out == "Answer sent to mgr-apps."
    assert (await c.ledger.get_question(q["id"]))["status"] == "answered"
    assert [m for m in c.queue.sent if m.get("kind") == "answer"][-1]["body"].endswith(": Light")


async def test_no_more_workers_than_the_city_ceiling_whatever_the_prompts_do() -> None:
    c = await city()
    await job(c, "Write a book", "the book", department_name="Writing", workers=3)
    await job(c, "Build a game", "the game", department_name="Apps", workers=3)
    await c.ledger.update_settings(
        {"max_live_workers_city": 7, "max_workers_per_goal": 9, "max_concurrent_workers_per_department": 9}
    )
    ctx = TurnCtx(agent_id="mgr-apps", role="manager", department="Apps", ticket_id="g-apps", task_id="t-apps")
    hire = {t.name: t for t in tools_for(c.host.d, ctx)}["hire_worker"].handler
    assert (await hire(SPEC)).startswith("Hired ")
    assert (await hire(SPEC)).startswith(
        "Hire refused: the whole city already has 7 workers at work (the ceiling is 7)"
    )


async def test_no_more_departments_than_the_ceiling() -> None:
    c = await city()
    for n in range(3):
        await department(c, f"Dept{n}")
    await c.ledger.update_settings({"max_departments": 3})
    ctx = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t1", task_id="t1")
    create = {t.name: t for t in tools_for(c.host.d, ctx)}["create_department"].handler
    out = await create({"name": "Voice Engineering", "mission": "voices"})
    assert out.startswith("Refused: the city already has 3 departments of its own") and "(the ceiling is 3)" in out
    assert "Dept0" in out
    assert len(await c.ledger.list_departments()) == 3
    assert (await create({"name": "Dept1", "mission": "again"})).endswith("already exists; use it.")


def test_what_counts_as_about_ai_city() -> None:
    for text in ("the voice is bugged", "make the voice more humane", "why is the city so slow", "I don't want the button",
                 "VAIC you're not listening", "the app crashed"):  # fmt: skip
        assert about_ai_city(text), text
    for text in ("build me a snake game", "write me an email to Anna", "have the team fix the voice recorder app",
                 "what's 9 + 9", "research the best CRMs"):  # fmt: skip
        assert not about_ai_city(text), text


async def test_ace_tools_list_has_the_gate(ace_tools_fn: Any = ace_tools) -> None:
    c = await city()
    spec = ace_tools_fn(c)["delegate_to_orchestrator"]
    assert "confirm" in spec.schema["properties"] and "confirm" in spec.description
