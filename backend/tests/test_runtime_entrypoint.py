"""The runtime container starts with ``python -m aic.runtime.server``. A definition placed after the
``__main__`` guard, or anything else that only breaks when the module runs as a script, crashes every
AgentCore runtime at deploy time while the import-based tests stay green. So: run it the real way."""

import ast
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend" / "src" / "aic" / "runtime" / "server.py"


def test_the_main_guard_is_the_last_statement_of_the_server_module() -> None:
    body = ast.parse(SERVER.read_text()).body
    last = body[-1]
    assert isinstance(last, ast.If) and "__main__" in ast.unparse(last.test), (
        "put every definition above the `if __name__ == '__main__'` block: the container runs the module as a script"
    )


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@pytest.mark.parametrize("role", ["ace", "worker"])
def test_the_runtime_starts_as_a_script_and_answers_ping(role: str) -> None:
    pytest.importorskip("uvicorn")
    pytest.importorskip("starlette")
    port = _free_port()
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", "/tmp"),
        "PYTHONPATH": str(ROOT / "backend" / "src"),
        "PYTHONUNBUFFERED": "1",
        "PORT": str(port),
        "AIC_ROLE": role,
        "AIC_REGION": "eu-north-1",
        "AIC_LEDGER_TABLE": "t",
        "AIC_EVENT_BUS": "b",
        "AIC_QUEUE_ACE": "q",
        "AIC_QUEUE_ORCHESTRATOR": "q",
        "AIC_QUEUE_MANAGER": "q",
        "AIC_QUEUE_WORKER": "q",
        "AIC_FACTORY_FUNCTION": "f",
        "AIC_WORKSPACES_BUCKET": "w",
        "AIC_WORKSPACE_ROLE_ARN": "arn:aws:iam::111122223333:role/w",
        "AIC_PROFILE_PREFIX": "global",
        "AIC_CONFIG_DIR": str(ROOT / "config"),
        "AIC_AGENTS_DIR": str(ROOT / "agents"),
        "CLAUDE_CODE_USE_BEDROCK": "1",
        "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1",
        "AWS_ACCESS_KEY_ID": "AKIAFAKE",
        "AWS_SECRET_ACCESS_KEY": "fake",
    }
    if role == "worker":
        env["CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"] = "1"
    p = subprocess.Popen(
        [sys.executable, "-m", "aic.runtime.server"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        deadline = time.monotonic() + 30
        status = None
        while time.monotonic() < deadline:
            if p.poll() is not None:
                break
            try:
                status = urllib.request.urlopen(f"http://127.0.0.1:{port}/ping", timeout=1).status
                break
            except Exception:
                time.sleep(0.25)
        if p.poll() is not None:
            out = p.stdout.read() if p.stdout else ""
            pytest.fail(f"the runtime exited at start (code {p.returncode}):\n{out[-3000:]}")
        assert status == 200
    finally:
        p.kill()
        p.wait(timeout=10)
