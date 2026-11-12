"""The team listens to the owner, and only to the owner: questions are answered with the owner's own words,
never a default VAIC fills in; hard ceilings stop runaway hiring, jobs and departments even if prompts fail."""

from typing import Any

from test_task_control import city, department, job, vaic_tools
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared.utility import about_ai_city


async def test_vaic_cannot_answer_a_question_with_words_the_owner_did_not_say() -> None:
    c = await city()
    task = await job(c, "Build a snake game", "snake game", department_name="Apps", workers=1)
    q = await c.ledger.ask_question(
        {"asked_by": "mgr-apps", "path": "mgr-apps", "ticket_id": task["id"], "text": "Dark or light theme?",
         "options": ["Dark", "Light"], "default_answer": "Dark"}
    )  # fmt: skip
    ctx = TurnCtx(
        agent_id="vaic", role="vaic", department=None, ticket_id="conv-main", task_id="conv-main", conversation="main"
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


async def test_no_city_wide_ceiling_on_workers_any_more() -> None:
    # The owner removed every agent-count limit (decision 288): a busy city never refuses a new job's hire.
    from vaic.shared.hierarchy.board_path import start_small

    c = await city()
    await job(c, "Write a book", "the book", department_name="Writing", workers=3)
    await job(c, "Build a game", "the game", department_name="Apps", workers=3)
    for n in range(2):
        task = await c.ledger.create_ticket(
            {
                "goal": f"Fix typo {n}",
                "from": "vaic",
                "to": "orchestrator",
                "department": None,
                "parent_id": None,
                "kind": "task",
                "size": "small",
            }
        )
        apps = await c.ledger.get_department("Apps")
        assert apps
        w = await start_small(c.host.d, task, apps, None)
        assert w["state"] == "active"


async def test_no_more_departments_than_the_ceiling() -> None:
    # Departments are built only by the owner's word now (VAIC's build_department, or the owner's pick when a job
    # would overlap one, decision 298), and the ceiling holds there.
    from vaic.shared.hierarchy.departments import DepartmentError, build_department

    c = await city()
    for n in range(3):
        await department(c, f"Dept{n}")
    await c.ledger.update_settings({"max_departments": 3})
    try:
        await build_department(c.host.d, "Voice Engineering", "voices")
        raise AssertionError("the ceiling did not hold")
    except DepartmentError as e:
        assert "already has 3 departments of your own" in str(e) and "(the limit is 3)" in str(e)
    assert len(await c.ledger.list_departments()) == 3
    assert (await build_department(c.host.d, "Dept1", "again"))[1] == "exists"


def test_what_counts_as_about_ai_city() -> None:
    for text in ("the voice is bugged", "make the voice more humane", "why is the city so slow", "I don't want the button",
                 "VAIC you're not listening", "the app crashed"):  # fmt: skip
        assert about_ai_city(text), text
    for text in ("build me a snake game", "write me an email to Anna", "have the team fix the voice recorder app",
                 "what's 9 + 9", "research the best CRMs"):  # fmt: skip
        assert not about_ai_city(text), text


async def test_vaic_tools_list_has_the_gate(vaic_tools_fn: Any = vaic_tools) -> None:
    c = await city()
    spec = vaic_tools_fn(c)["start_job"]
    assert "confirm" in spec.schema["properties"] and "confirm" in spec.description
