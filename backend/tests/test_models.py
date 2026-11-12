import re
from pathlib import Path

from vaic.shared.models import ROLES, model_name_for, resolve_role, resolve_role_from_env

ROOT = Path(__file__).resolve().parents[2]


def test_maps_every_role_to_the_one_model_map_on_global_profiles() -> None:
    """Decision 300: one map for every agent. Planner turns and reviews name their model on the message (by size);
    these are the role defaults an agent resolves to otherwise."""
    want = {
        "vaic": "haiku-5-5",
        "orchestrator": "sonnet-5-5",  # the planner's runtime (decision 298), medium by default
        "manager": "opus-5-5",  # the department's reviewer
        "worker": "sonnet-5-5",  # every worker, always
        "utility": "haiku-5-5",
        "chief_of_staff": "fable-5-1",  # not in the diagram: unchanged (decision 300)
        "executive": "fable-5-1",  # decision 140, not in the diagram: unchanged
    }
    for role in ROLES:
        r = resolve_role(role)
        assert r.primary.name == want[role], role
        assert r.primary.profile_id.startswith("global.")
        assert r.primary.invoke_id == r.primary.profile_id
        assert not r.degraded


def test_only_the_fable_roles_left_fall_back_to_opus() -> None:
    assert resolve_role("chief_of_staff").fallback.name == "opus-5-5"  # type: ignore[union-attr]
    assert resolve_role("executive").fallback.name == "opus-5-5"  # type: ignore[union-attr]
    for r in ("vaic", "orchestrator", "manager", "worker", "utility"):
        assert resolve_role(r).fallback is None  # type: ignore[arg-type]


def test_every_worker_in_every_department_is_sonnet() -> None:
    """The owner (decision 300): workers are Sonnet 5.5 in every department, never Haiku, Opus or Fable; the old
    Fable departments (decision 129) and a department's own worker model (decision 134) are gone."""
    for dept in ("Media", "Research", "Legal", "Sales", "Application", None):
        assert resolve_role("worker", department=dept).primary.name == "sonnet-5-5"
        assert model_name_for("worker", dept) == "sonnet-5-5"
    for old in ("opus-5-5", "fable-5-1", "fable-5-2"):
        assert resolve_role("worker", department="Design", dept={"worker_model": old}).primary.name == "sonnet-5-5"
        assert model_name_for("worker", "Design", {"worker_model": old}) == "sonnet-5-5"


def test_uses_the_roles_application_inference_profile_when_configured() -> None:
    arn = "arn:aws:bedrock:eu-north-1:111122223333:application-inference-profile/abc"
    r = resolve_role("worker", application_profiles={"worker": arn})
    assert r.primary.invoke_id == arn
    assert r.primary.profile_id == "global.anthropic.claude-sonnet-5-5"


def test_on_eu_profiles_fable_roles_fall_back_to_opus_as_primary() -> None:
    r = resolve_role("executive", prefix="eu")
    assert r.degraded
    assert r.primary.name == "opus-5-5"
    assert r.primary.profile_id == "eu.anthropic.claude-opus-5-5"
    assert r.fallback is None


def test_reads_prefix_and_application_profile_from_the_environment() -> None:
    r = resolve_role_from_env("vaic", {"VAIC_PROFILE_PREFIX": "us", "VAIC_APP_PROFILE_VAIC": "arn:x"})
    assert r.primary.profile_id == "us.anthropic.claude-haiku-5-5"
    assert r.primary.invoke_id == "arn:x"


# "Nothing else in the code may contain a model ID."
_SKIP = {
    "node_modules", ".git", "dist", ".terraform", "docs", "test-results", "playwright-report",
    ".venv", "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache", "build",
}  # fmt: skip
_EXT = re.compile(r"\.(ts|tsx|js|mjs|json|tf|md|yml|sh|py|toml)$")
_ID = re.compile(r"anthropic\.claude-|claude-(opus|sonnet|haiku|fable)-\d|amazon\.titan-embed")


def _files() -> list[Path]:
    out: list[Path] = []
    stack = [ROOT]
    while stack:
        d = stack.pop()
        for p in d.iterdir():
            if p.name in _SKIP:
                continue
            if p.is_dir():
                stack.append(p)
            elif _EXT.search(p.name) and p.name not in ("package-lock.json", "uv.lock"):
                out.append(p)
    return out


def test_model_ids_live_only_in_config_models_json() -> None:
    allowed = {"config/models.json", "backend/tests/test_models.py"}
    offenders = [
        str(p.relative_to(ROOT))
        for p in _files()
        if str(p.relative_to(ROOT)) not in allowed and _ID.search(p.read_text(encoding="utf-8", errors="ignore"))
    ]
    assert offenders == []


def test_records_saved_with_fable_5_2_still_read_as_fable_5_1() -> None:
    """Decision 182: an old record's fable-5-2 reads as Fable 5.1 (labels, history); a worker never runs on it."""
    from vaic.shared.models import current_name, model_label

    assert current_name("fable-5-2") == "fable-5-1"
    assert model_label("fable-5-2") == "Claude Fable 5.1"
