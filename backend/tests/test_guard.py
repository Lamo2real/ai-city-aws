import pytest

from vaic.shared.guard import FORBIDDEN_ENV, StartupRefused, bedrock_env, startup_guard

OK = {"CLAUDE_CODE_USE_BEDROCK": "1", "AWS_REGION": "eu-north-1"}


def test_starts_with_bedrock_on_and_nothing_forbidden() -> None:
    startup_guard(OK)


def test_refuses_when_bedrock_is_off_or_missing() -> None:
    with pytest.raises(StartupRefused):
        startup_guard({})
    with pytest.raises(StartupRefused, match="must be 1"):
        startup_guard({"CLAUDE_CODE_USE_BEDROCK": "0"})


@pytest.mark.parametrize("name", FORBIDDEN_ENV)
def test_refuses_when_a_forbidden_variable_is_set(name: str) -> None:
    with pytest.raises(StartupRefused, match=name):
        startup_guard({**OK, name: "x"})


def test_names_the_variable_but_never_prints_its_value() -> None:
    with pytest.raises(StartupRefused) as e:
        startup_guard({**OK, "ANTHROPIC_API_KEY": "sk-very-secret"})
    assert "sk-very-secret" not in str(e.value)


def test_a_worker_refuses_to_start_without_shell_env_scrubbing() -> None:
    with pytest.raises(StartupRefused, match="SCRUB"):
        startup_guard({**OK, "VAIC_ROLE": "worker", "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "0"})
    with pytest.raises(StartupRefused, match="SCRUB"):
        startup_guard({**OK, "VAIC_ROLE": "worker"})
    startup_guard({**OK, "VAIC_ROLE": "worker", "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "1"})


def test_roles_without_a_shell_start_without_scrubbing() -> None:
    for role in ("vaic", "orchestrator", "manager"):
        startup_guard({**OK, "VAIC_ROLE": role})


def test_the_env_it_hands_agents_keeps_bedrock_on_and_1m_off() -> None:
    env = bedrock_env("eu-north-1")
    assert env["CLAUDE_CODE_USE_BEDROCK"] == "1"
    assert env["CLAUDE_CODE_DISABLE_1M_CONTEXT"] == "1"
    startup_guard(env)
