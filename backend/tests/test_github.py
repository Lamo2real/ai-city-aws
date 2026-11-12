"""The owner's GitHub token (docs/GITHUB_ACCESS.md, decision 110): the Settings routes, git and gh signed in
inside the runtime, VAIC's run_command through the policy gate, and the GitHub connector hints."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from city_support import make_city
from connector_fakes import FakeNet, Recorder, control, resolver
from test_api import ev, js, make
from test_speech import FakeSecrets
from vaic.lambdas.api import handle_http
from vaic.lambdas.connectors_api import ConnectorsApi
from vaic.runtime.connector_tool import add_connector_tool
from vaic.runtime.github_auth import HELPER, GitAuth
from vaic.runtime.prompts import load_prompt
from vaic.runtime.tools import TurnCtx, cap_output, tools_for
from vaic.shared.connectors import GITHUB_MCP_URL, ConnectorStore, event, github_page_hint, is_github_query
from vaic.shared.github import GitHubDeps, github_token_secret, noreply_email, redact, token_from_secret

TOKEN = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
PAT = "github_pat_" + "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789"
USER = {"login": "lamo2real", "id": 4242}


class FakeGitHub:
    """``GET /user`` as the module calls it: answers in order, each (status, body) or an exception."""

    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.calls: list[dict[str, Any]] = []

    async def get(self, url: str, headers: dict[str, str], timeout_s: float) -> Any:
        self.calls.append({"url": url, "headers": headers})
        a = self.answers.pop(0) if self.answers else (200, USER)
        if isinstance(a, Exception):
            raise a
        return a


def secrets_with(value: str | None = None) -> FakeSecrets:
    s = FakeSecrets()
    s.values = {} if value is None else {"vaic/prod/github": value}
    return s


def deps(value: str | None = None, *answers: Any) -> tuple[GitHubDeps, FakeGitHub, FakeSecrets]:
    gh = FakeGitHub(*answers)
    s = secrets_with(value)
    return GitHubDeps(secrets=s, get=gh.get, tags={"Project": "ai-city"}), gh, s


# ---------- the token itself ----------
def test_only_a_whole_classic_or_fine_grained_token_is_accepted() -> None:
    assert json.loads(github_token_secret({"token": f" {TOKEN} "})) == {"token": TOKEN}
    assert json.loads(github_token_secret({"token": PAT})) == {"token": PAT}
    for bad in ("", "ghp_short", "sk-abcdefghijklmnopqrstuvwxyz", f"token {TOKEN}"):
        with pytest.raises(ValueError, match="ghp_ or github_pat_"):
            github_token_secret({"token": bad})


def test_the_secret_holds_json_from_settings_or_a_bare_token_pasted_in_the_console() -> None:
    assert token_from_secret(json.dumps({"token": TOKEN})) == TOKEN
    assert token_from_secret(TOKEN) == TOKEN
    for empty in (None, "", "{}", '{"token": ""}', "not a token", "{broken"):
        assert token_from_secret(empty) is None


def test_redaction_hides_the_token_and_anything_shaped_like_one() -> None:
    assert redact(f"remote: https://x-access-token:{TOKEN}@github.com", TOKEN) == (
        "remote: https://x-access-token:<github-token>@github.com"
    )
    assert redact(f"export GH_TOKEN={PAT}", None) == "export GH_TOKEN=<github-token>"
    assert redact("nothing here", TOKEN) == "nothing here"
    assert noreply_email(USER) == "4242+lamo2real@users.noreply.github.com"
    assert noreply_email(None) == "ai-city@users.noreply.github.com"


# ---------- Settings → GitHub (the routes) ----------
async def test_the_token_is_stored_checked_with_github_and_never_echoed(capsys: pytest.CaptureFixture[str]) -> None:
    d, gh, secrets = deps(None)
    api = make(github=d)
    before = await handle_http(ev("GET", "/github"), api)
    assert js(before) == {"configured": False, "login": None, "error": None, "saved_at": None}
    r = await handle_http(ev("PUT", "/github/token", {"token": TOKEN}), api)
    assert r["statusCode"] == 200 and js(r)["login"] == "lamo2real" and js(r)["saved_at"]
    assert json.loads(secrets.values["vaic/prod/github"]) == {"token": TOKEN}
    assert gh.calls[0]["url"] == "https://api.github.com/user"
    assert gh.calls[0]["headers"]["Authorization"] == f"Bearer {TOKEN}"
    after = js(await handle_http(ev("GET", "/github"), api))
    assert after["configured"] is True and after["login"] == "lamo2real" and after["error"] is None
    assert after["saved_at"] == js(r)["saved_at"]
    # The token is in Secrets Manager and nowhere else: not in an answer, the ledger or the logs.
    everything = r["body"] + after.__repr__() + json.dumps(list(api.ledger.table.items.values()), default=str)
    assert TOKEN not in everything
    logs = capsys.readouterr()
    assert TOKEN not in logs.err + logs.out


async def test_a_rejected_token_is_refused_in_plain_words_and_not_stored() -> None:
    d, _gh, secrets = deps(None, (401, {"message": "Bad credentials"}))
    api = make(github=d)
    r = await handle_http(ev("PUT", "/github/token", {"token": TOKEN}), api)
    assert r["statusCode"] == 400 and js(r)["error"] == "bad_token"
    assert "GitHub rejected the token" in js(r)["message"]
    assert "vaic/prod/github" not in secrets.values
    bad = await handle_http(ev("PUT", "/github/token", {"token": "nope"}), api)
    assert bad["statusCode"] == 400 and "ghp_ or github_pat_" in js(bad)["message"]
    none = await handle_http(ev("PUT", "/github/token", {"token": TOKEN}), make())
    assert none["statusCode"] == 503


async def test_status_says_so_when_a_stored_token_stopped_working_and_remove_clears_it() -> None:
    d, _gh, secrets = deps(json.dumps({"token": TOKEN}), (401, {}))
    api = make(github=d)
    st = js(await handle_http(ev("GET", "/github"), api))
    assert st["configured"] is True and st["login"] is None and "GitHub rejected the token" in st["error"]
    r = await handle_http(ev("DELETE", "/github/token"), api)
    assert js(r) == {"ok": True}
    assert token_from_secret(secrets.values["vaic/prod/github"]) is None  # the container stays, empty
    assert js(await handle_http(ev("GET", "/github"), api))["configured"] is False


async def test_github_unreachable_keeps_the_token_and_the_status_says_who_later() -> None:
    d, _gh, secrets = deps(None, OSError("no network"), (200, USER))
    api = make(github=d)
    r = await handle_http(ev("PUT", "/github/token", {"token": TOKEN}), api)
    assert r["statusCode"] == 200 and js(r)["login"] is None
    assert json.loads(secrets.values["vaic/prod/github"]) == {"token": TOKEN}
    assert js(await handle_http(ev("GET", "/github"), api))["login"] == "lamo2real"


# ---------- git and gh inside the runtime ----------
class FakeRun:
    def __init__(self, gh_exit: int = 0) -> None:
        self.calls: list[tuple[list[str], dict[str, str]]] = []
        self.gh_exit = gh_exit

    def __call__(self, argv: list[str], env: Any) -> tuple[int, str]:
        self.calls.append((argv, dict(env)))
        return (self.gh_exit, "Logged in to github.com") if argv[0] == "gh" else (0, "")


async def test_the_runtime_signs_git_and_gh_in_from_the_environment_and_writes_no_token_to_disk(
    tmp_path: Path,
) -> None:
    d, _gh, secrets = deps(json.dumps({"token": TOKEN}))
    env: dict[str, str] = {"PATH": "/usr/bin"}
    run = FakeRun()
    auth = GitAuth(d, env=env, run=run, config_path=tmp_path / "git" / "config")
    assert await auth.ensure() is True
    assert env["GH_TOKEN"] == TOKEN and env["GITHUB_TOKEN"] == TOKEN
    assert env["GIT_CONFIG_GLOBAL"] == str(tmp_path / "git" / "config")
    settings = {a[4]: a[5] for a, _ in run.calls if a[:3] == ["git", "config", "--file"]}
    assert settings["credential.https://github.com.helper"] == HELPER and "$GH_TOKEN" in HELPER
    assert settings["user.name"] == "AI City"
    assert settings["user.email"] == "4242+lamo2real@users.noreply.github.com"
    assert run.calls[-1][0] == ["gh", "auth", "status", "--hostname", "github.com"]
    assert all(TOKEN not in " ".join(argv) for argv, _ in run.calls)  # the token travels only in the environment
    for f in tmp_path.rglob("*"):  # noqa: ASYNC240
        if f.is_file():
            assert TOKEN not in f.read_text()
    # The same token again: nothing to redo. A removed token: everything comes out again.
    n = len(run.calls)
    assert await auth.ensure() is True and len(run.calls) == n
    secrets.values["vaic/prod/github"] = "{}"
    d.forget()
    assert await auth.ensure() is False
    assert "GH_TOKEN" not in env and "GITHUB_TOKEN" not in env and "GIT_CONFIG_GLOBAL" not in env
    assert not (tmp_path / "git" / "config").exists()


@pytest.mark.skipif(shutil.which("git") is None, reason="needs git")
def test_real_git_answers_the_token_for_github_through_the_helper_only(tmp_path: Path) -> None:
    d, _gh, _s = deps(json.dumps({"token": TOKEN}))
    env = {"PATH": os.environ.get("PATH", ""), "HOME": str(tmp_path / "home")}
    (tmp_path / "home").mkdir()

    def run(argv: list[str], e: Any) -> tuple[int, str]:
        if argv[0] == "gh":
            return 0, ""
        r = subprocess.run(argv, env=dict(e), capture_output=True, text=True, check=False)
        return r.returncode, r.stdout + r.stderr

    auth = GitAuth(d, env=env, run=run, config_path=tmp_path / "git" / "config")
    assert asyncio.run(auth.ensure()) is True
    config = (tmp_path / "git" / "config").read_text()
    assert TOKEN not in config and "x-access-token" in config
    fill = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert "username=x-access-token" in fill.stdout and f"password={TOKEN}" in fill.stdout
    other = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=gitlab.com\n\n",
        env={**env, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/false"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert TOKEN not in other.stdout  # the helper answers for github.com only


# ---------- VAIC's terminal ----------
async def _run_command(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Any, Any]:
    monkeypatch.setenv("VAIC_VAIC_WORKSPACE", str(tmp_path / "workspace"))
    monkeypatch.setenv("GH_TOKEN", TOKEN)
    city = make_city(lambda req: None)  # type: ignore[arg-type,return-value]
    await city.host.ensure_core()
    ctx = TurnCtx("vaic", "vaic", None, "conv-c1", "conv-c1", "c1", from_owner=True)
    from vaic.runtime.tools import gate_tools

    tools = {t.name: t for t in gate_tools(city.deps, ctx, tools_for(city.deps, ctx))}
    return tools["run_command"], city


async def test_run_command_runs_in_the_workspace_with_the_signed_in_environment(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    tool, _city = await _run_command(monkeypatch, tmp_path)
    assert tool.step({"command": "git push origin main"}) == "Running: git push origin main"
    out = await tool.handler({"command": "pwd && echo hi && printf 'tok=%s' \"$GH_TOKEN\""})
    assert out.startswith("exit 0\n") and str(tmp_path / "workspace") in out and "hi" in out
    assert TOKEN not in out and "tok=<github-token>" in out  # the token never reaches the owner
    (tmp_path / "workspace" / "repo").mkdir()
    out = await tool.handler({"command": "pwd", "cwd": "repo"})
    assert out.endswith("workspace/repo")
    assert "inside your workspace" in await tool.handler({"command": "ls", "cwd": "../.."})
    assert "no folder 'missing'" in await tool.handler({"command": "ls", "cwd": "missing"})
    failed = await tool.handler({"command": "exit 3"})
    assert failed == "exit 3"


async def test_run_command_is_denied_by_the_same_rules_as_a_workers_bash(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    tool, city = await _run_command(monkeypatch, tmp_path)
    for cmd in ("aws iam create-user --user-name x", "terraform apply", "cat ~/.aws/credentials", "rm -rf /"):
        out = await tool.handler({"command": cmd})
        assert out.startswith("Denied by policy:"), cmd
    allowed = await tool.handler({"command": "echo git push -f origin main"})
    assert allowed.startswith("exit 0")
    audits = [t for t in await city.ledger.tool_calls("vaic") if t.get("decision") == "deny"]
    assert len(audits) == 4 and all(a.get("tool") == "Bash" for a in audits)


async def test_run_command_stops_at_the_timeout_and_caps_long_output(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    tool, _city = await _run_command(monkeypatch, tmp_path)
    out = await tool.handler({"command": f"{sys.executable} -c 'import time; time.sleep(5)'", "timeout_s": 1})
    assert out.startswith("stopped at the timeout") and "still running after 1 s" in out
    out = await tool.handler({"command": f"{sys.executable} -c \"print('x' * 60000)\""})
    assert len(out) < 21_000 and "cut out of the middle" in out
    assert "x" * 100 in out
    bad = await tool.handler({"command": "echo hi", "timeout_s": 5000})
    assert bad.startswith("Invalid input")
    assert cap_output("short") == "short"


def test_vaic_has_the_terminal_and_the_prompts_say_git_and_gh_work() -> None:
    vaic = load_prompt("vaic.md")
    assert "run_command" in vaic.tools and "run_command" in vaic.body and "/workspace" in vaic.body
    body = load_prompt("worker.md", {"department": "Eng"}).body  # the workers push; the reviewer only reviews
    assert "gh repo create" in body and "git push" in body
    text = (Path(__file__).resolve().parents[2] / "services" / "agent-runtime" / "Dockerfile").read_text()
    assert "gh_${GH_VERSION}_linux_arm64.deb" in text and "sha256sum -c" in text and "curl" in text
    assert "/workspace" in text


# ---------- the GitHub connector ----------
@pytest.mark.parametrize(
    "url",
    [
        "https://github.com/github/github-mcp-server.git",
        "https://github.com/github/github-mcp-server",
        "https://www.github.com/x/y",
        "https://gist.github.com/x/1",
        "https://example.com/org/repo.git",
    ],
)
def test_a_repository_page_or_clone_address_is_not_a_server(url: str) -> None:
    hint = github_page_hint(url)
    assert hint and "code repository page, not a server" in hint and GITHUB_MCP_URL in hint
    assert github_page_hint(GITHUB_MCP_URL) is None and github_page_hint("https://mcp.higgsfield.ai/mcp") is None


def test_github_by_name_means_githubs_own_server() -> None:
    for q in ("GitHub", "github", "the GitHub MCP server", "github mcp"):
        assert is_github_query(q)
    for q in ("github issues tracker", "gitlab", "https://github.com/x", "hub"):
        assert not is_github_query(q)


def _ctx() -> TurnCtx:
    return TurnCtx("vaic", "vaic", None, "conv-c1", "conv-c1", "c1", message_id="owner-m1", from_owner=True)


async def test_add_connector_points_a_github_page_to_the_real_server_and_resolves_github_by_name() -> None:
    city = make_city(lambda req: None)  # type: ignore[arg-type,return-value]
    d = city.deps
    d.net, d.resolve = FakeNet(), resolver  # the registry answers 404: nothing found
    tool = add_connector_tool(d, _ctx())
    out = await tool.handler({"query": "https://github.com/github/github-mcp-server.git"})
    assert "not a server" in out and GITHUB_MCP_URL in out
    assert await ConnectorStore(d.ledger.table).list() == []
    out = await tool.handler({"query": "GitHub"})
    assert "card is waiting" in out
    [rec] = await ConnectorStore(d.ledger.table).list()
    assert rec["url"] == GITHUB_MCP_URL and rec["label"] == "GitHub" and rec["source"] == "registry:official"


def _api(**kw: Any) -> tuple[Any, list[dict[str, Any]], ConnectorsApi]:
    invoked: list[dict[str, Any]] = []

    async def invoke(p: dict[str, Any]) -> None:
        invoked.append(p)

    d = make()
    c = ConnectorsApi(ConnectorStore(d.ledger.table, d.ledger.now), d.bus, invoke=invoke, resolve=resolver, **kw)
    d.connectors = c
    return d, invoked, c


async def test_settings_add_by_link_refuses_a_github_page_in_plain_words() -> None:
    d, invoked, _c = _api()
    r = await handle_http(ev("POST", "/connectors", {"url": "https://github.com/github/github-mcp-server.git"}), d)
    assert r["statusCode"] == 400 and "not a server" in js(r)["error"] and GITHUB_MCP_URL in js(r)["fix"]
    assert invoked == []


async def test_githubs_server_uses_the_saved_city_token_without_asking_again(
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def token() -> str | None:
        return TOKEN

    secrets = Recorder(
        {"create_secret": {"ARN": "arn:aws:secretsmanager:eu-north-1:1:secret:vaic/prod/connectors/github-AbC"}}
    )
    ctl = control()
    d, invoked, _c = _api(secrets=secrets, control=ctl, github_token=token)
    r = await handle_http(ev("POST", "/connectors", {"url": GITHUB_MCP_URL, "roles": {"worker": "all"}}), d)
    assert r["statusCode"] == 201
    rec = js(r)["connector"]
    assert rec["auth"] == "api_key" and rec["status"] == "syncing" and rec["key_header"] == "Authorization"
    assert rec["key_prefix"] == "Bearer "
    assert json.loads(secrets.calls[0][1]["SecretString"]) == {"api_key": TOKEN}
    assert dict(ctl.calls)["create_api_key_credential_provider"]["name"] == f"vaic-conn-{rec['id']}"
    assert invoked == [{"action": "sync", "id": rec["id"]}]
    assert TOKEN not in r["body"] + json.dumps(d.bus.events) + capsys.readouterr().err
    # Without a saved token the usual probe runs (OAuth, or the key card).
    d2, invoked2, _c2 = _api(secrets=secrets, control=ctl)
    r2 = await handle_http(ev("POST", "/connectors", {"url": GITHUB_MCP_URL, "roles": {"vaic": "all"}}), d2)
    assert js(r2)["connector"]["status"] == "provisioning" and invoked2[0]["action"] == "provision"


async def test_i_have_a_token_instead_turns_a_github_sign_in_into_a_bearer_key() -> None:
    secrets = Recorder({"create_secret": {"ARN": "arn:x"}})
    ctl = control()
    d, invoked, c = _api(secrets=secrets, control=ctl)
    rec = {
        "id": "github",
        "label": "GitHub",
        "url": GITHUB_MCP_URL,
        "status": "needs_login",
        "auth": "oauth",
        "provider_name": "vaic-conn-github",
        "oauth": {"authorization_server": "https://github.com", "scopes": [], "metadata": {}},
        "roles": {"vaic": "all"},
    }
    await c.store.create(rec)
    e = event(rec)
    assert e["oauth_host"] == "github.com"  # the HUD offers "I have a token instead" on this
    r = await handle_http(ev("PUT", "/connectors/github/key", {"api_key": TOKEN}), d)
    assert js(r) == {"ok": True}
    after = await c.store.get("github")
    assert after and after["auth"] == "api_key" and after["provider_name"] == "vaic-conn-github-key"
    assert after["key_header"] == "Authorization" and after["key_prefix"] == "Bearer " and after["oauth"] is None
    names = ctl.names()
    assert "create_api_key_credential_provider" in names and "delete_oauth2_credential_provider" in names
    assert invoked == [{"action": "sync", "id": "github"}]
    assert TOKEN not in json.dumps(list(d.ledger.table.items.values()), default=str)
