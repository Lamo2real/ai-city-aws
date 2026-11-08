import asyncio
import json
import re
from pathlib import Path
from typing import Any

import httpx

from aic.runtime.engine import activity_for, usage_from_model_usage
from aic.runtime.prompts import Prompt, load_prompt, parse_prompt, render
from aic.runtime.server import create_app
from aic.shared.cost import Usage

ROOT = Path(__file__).resolve().parents[2]


def inv(**over: Any) -> dict[str, Any]:
    return {
        "id": "m1",
        "role": "worker",
        "agentId": "w1",
        "department": "Eng",
        "ticketId": "t1",
        "taskId": "t0",
        "kind": "task",
        "from": "mgr",
        "body": "go",
        "sessionId": "s" * 33,
        "async": False,
        **over,
    }


class Host:
    def __init__(self, fn: Any) -> None:
        self.fn = fn

    async def run_turn(self, i: dict[str, Any]) -> str:
        r: str = await self.fn(i)
        return r


def client(host: Host) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(host)), base_url="http://runtime")


# ---------- runtime HTTP contract ----------
async def test_answers_ping_and_runs_a_synchronous_turn_on_invocations() -> None:
    async def hello(_: dict[str, Any]) -> str:
        return "hello"

    async with client(Host(hello)) as c:
        assert (await c.get("/ping")).json()["status"] == "Healthy"
        r = await c.post("/invocations", content=json.dumps(inv()))
        assert r.json() == {"status": "success", "response": "hello"}


async def test_accepts_an_async_job_at_once_and_reports_healthy_busy_until_it_ends() -> None:
    gate = asyncio.Event()

    async def slow(_: dict[str, Any]) -> str:
        await gate.wait()
        return "done"

    async with client(Host(slow)) as c:
        r = await c.post("/invocations", content=json.dumps(inv(**{"async": True})))
        assert r.status_code == 202
        await asyncio.sleep(0)
        assert (await c.get("/ping")).json()["status"] == "HealthyBusy"
        gate.set()
        for _ in range(50):
            await asyncio.sleep(0.01)
            if (await c.get("/ping")).json()["status"] == "Healthy":
                break
        assert (await c.get("/ping")).json()["status"] == "Healthy"


async def test_rejects_malformed_invocations_and_hides_error_details() -> None:
    async def boom(_: dict[str, Any]) -> str:
        raise RuntimeError("secret detail")

    async with client(Host(boom)) as c:
        assert (await c.post("/invocations", content="{")).status_code == 400
        r = await c.post("/invocations", content=json.dumps(inv()))
        assert r.status_code == 500
        assert "secret detail" not in r.text
        assert (await c.get("/nope")).status_code == 404


# ---------- prompts ----------
def test_every_role_prompt_exists_and_lists_its_tools() -> None:
    assert "delegate_to_orchestrator" in load_prompt("ace.md").tools
    assert "sign_off" in load_prompt("orchestrator.md").tools
    assert "review" in load_prompt("manager.md", {"department": "Eng"}).tools


def test_managers_hire_few_and_the_orchestrator_never_staffs_a_one_off() -> None:
    manager = load_prompt(
        "manager.md", {"id": "m", "department": "Eng", "mission": "x", "department_template": ""}
    ).body
    assert "fewest workers" in manager and "3 workers per goal" in manager
    assert "Never one worker per item, sentence or section" in manager
    assert "no limit" not in manager.lower()
    orchestrator = load_prompt("orchestrator.md").body
    assert "One department per goal" in orchestrator
    assert "Never create a department for a one-off question or writing task" in orchestrator
    assert "never more than three per goal" in orchestrator
    assert load_prompt("worker.md").tools == [
        "ask_manager",
        "report_to_manager",
        "submit_app",
        "search_knowledge",
        "load_app",
    ]


def test_aces_prompt_states_its_name_greetings_spoken_style_and_limits() -> None:
    body = load_prompt("ace.md").body
    for s in (
        "AIC",
        "AIC",
        "yo AIC",
        "hi AIC",
        "what's up AIC",
        "how's it going AIC",
        "what's the status of the product, AIC?",
        "Short",
        "can't",
    ):
        assert s in body
    assert "Jarvis" in body and "\"Sir\"" in body  # the owner's rule: always called Sir
    for s in ("get_task_status", "cancel_task", "confirm=true", "Never stop a job without the yes", "seven-year-old"):
        assert s in body
    for s in ("send_workers_home", "The three controls", "always on"):  # send home ≠ stop; no pause
        assert s in body
    assert 'Never say "ticket"' in body  # no inside words to the owner
    assert "Never ask for a password or key in chat" in body  # access goes through the HUD, never chat


def test_values_put_into_a_prompt_cannot_add_placeholders() -> None:
    assert render("Mission: {{mission}} {{secret}}", {"mission": "{{secret}}", "secret": "S"}) == "Mission: secret S"


def test_parses_frontmatter() -> None:
    assert parse_prompt("---\nname: x\ntools: a, b\n---\nbody") == Prompt(name="x", tools=["a", "b"], body="body")


# ---------- engine helpers ----------
def test_splits_cache_writes_by_lifetime_attributing_unlabelled_writes_to_the_roles_ttl() -> None:
    u = usage_from_model_usage(
        {
            "m": {
                "inputTokens": 10,
                "outputTokens": 5,
                "cacheReadInputTokens": 100,
                "cacheCreationInputTokens": 50,
                "cacheCreationEphemeral5mInputTokens": 20,
                "cacheCreationEphemeral1hInputTokens": 10,
            }
        },
        "1h",
    )
    assert u == Usage(input=10, output=5, cache_read=100, cache_write_5m=20, cache_write_1h=30)


def test_names_activities_for_the_city_view() -> None:
    assert activity_for("Edit") == "coding"
    assert activity_for("mcp__city__hire_worker") == "hiring"
    assert activity_for("mcp__city__review") == "reviewing"


# ---------- Dockerfile ----------
def test_dockerfile_builds_for_arm64_serves_8080_runs_as_non_root_keeps_bedrock_on() -> None:
    text = (ROOT / "services" / "agent-runtime" / "Dockerfile").read_text()
    assert len(re.findall(r"--platform=linux/arm64", text)) == 2
    assert "EXPOSE 8080" in text
    assert re.search(r"^USER aic$", text, re.M)
    assert "CLAUDE_CODE_USE_BEDROCK=1" in text
    assert "bubblewrap" in text  # workers' env scrubbing needs it; the flag itself is set per role
    assert "aic.runtime.server" in text
    assert not re.search(r"ANTHROPIC_API_KEY|awscli|aws-cli", text)


async def test_a_warm_ping_answers_at_once_without_running_a_turn() -> None:
    turns: list[dict[str, Any]] = []

    async def fn(i: dict[str, Any]) -> str:
        turns.append(i)
        return "ran"

    async with client(Host(fn)) as c:
        r = await c.post("/invocations", content=json.dumps({"kind": "warm", "sessionId": "s" * 33}))
        assert r.status_code == 200 and r.json() == {"status": "warm"}
        assert turns == []  # no ledger, no model: the container just says it is up
        assert (await c.get("/ping")).json()["status"] == "Healthy"
