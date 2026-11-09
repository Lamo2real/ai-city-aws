import re
from pathlib import Path

from aic.shared.models import ROLES, model_name_for, resolve_role, resolve_role_from_env

ROOT = Path(__file__).resolve().parents[2]


def test_maps_every_role_to_its_pinned_model_on_global_profiles() -> None:
    want = {
        "ace": "haiku-5-5",
        "orchestrator": "fable-5-1",
        "manager": "fable-5-1",
        "worker": "opus-5-5",
        "utility": "haiku-5-5",
        "chief_of_staff": "opus-5-5",
    }
    for role in ROLES:
        r = resolve_role(role)
        assert r.primary.name == want[role]
        assert r.primary.profile_id.startswith("global.")
        assert r.primary.invoke_id == r.primary.profile_id
        assert not r.degraded


def test_only_fable_roles_fall_back_to_opus_others_have_none() -> None:
    assert resolve_role("orchestrator").fallback.name == "opus-5-5"  # type: ignore[union-attr]
    assert resolve_role("manager").fallback.name == "opus-5-5"  # type: ignore[union-attr]
    for r in ("ace", "worker", "utility", "chief_of_staff"):
        assert resolve_role(r).fallback is None  # type: ignore[arg-type]


def test_fable_for_the_orchestrator_every_manager_and_media_research_legal_workers() -> None:
    """The owner's rules (2026-11-09): every other worker, and the Chief of Staff, is on Opus 5.5."""
    for dept in ("Media", "Research", "Legal", "legal"):
        r = resolve_role("worker", department=dept, application_profiles={"worker": "arn:x"})
        assert r.primary.name == "fable-5-1" and r.fallback.name == "opus-5-5"  # type: ignore[union-attr]
        assert r.primary.invoke_id == r.primary.profile_id  # the worker profile copies Opus
        assert model_name_for("worker", dept) == "fable-5-1"
    for dept in ("Sales", "Marketing", "Application", "Customer Support", None):
        assert resolve_role("worker", department=dept).primary.name == "opus-5-5"
        assert model_name_for("worker", dept) == "opus-5-5"
    for dept in ("Sales", "Media", None):
        r = resolve_role("manager", department=dept, application_profiles={"manager": "arn:m"})
        assert r.primary.name == "fable-5-1" and r.primary.invoke_id == "arn:m"  # its own tagged profile
        assert model_name_for("manager", dept) == "fable-5-1"
    assert resolve_role("orchestrator", department="Sales").primary.name == "fable-5-1"
    assert resolve_role("chief_of_staff", department="Media").primary.name == "opus-5-5"


def test_uses_the_roles_application_inference_profile_when_configured() -> None:
    arn = "arn:aws:bedrock:eu-north-1:111122223333:application-inference-profile/abc"
    r = resolve_role("worker", application_profiles={"worker": arn})
    assert r.primary.invoke_id == arn
    assert r.primary.profile_id == "global.anthropic.claude-opus-5-5"


def test_on_eu_profiles_fable_roles_fall_back_to_opus_as_primary() -> None:
    r = resolve_role("manager", prefix="eu")
    assert r.degraded
    assert r.primary.name == "opus-5-5"
    assert r.primary.profile_id == "eu.anthropic.claude-opus-5-5"
    assert r.fallback is None


def test_reads_prefix_and_application_profile_from_the_environment() -> None:
    r = resolve_role_from_env("ace", {"AIC_PROFILE_PREFIX": "us", "AIC_APP_PROFILE_ACE": "arn:x"})
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
