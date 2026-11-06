import json
from pathlib import Path

from aic.shared.utility import wake_match

FIXTURE = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "wake-cases.json"


def test_the_server_gives_the_answers_in_the_shared_wake_fixture() -> None:
    """The browser (web/src/voice/wake.ts) is checked against the same file by the web tests."""
    for c in json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]:
        assert wake_match(c["text"]) == c["want"], c["text"]
