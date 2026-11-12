"""VAIC's casual voice (the owner, 2026-11-12): one shared section sets the address and the slang level for VAIC's
own prompt and both voice prompts; facts stay plain, no emoji, and only VAIC talks this way."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from city_support import Call, make_city, scripted_engine
from vaic.runtime.engine import EngineRequest
from vaic.runtime.owner_tools import SAVE_QUESTION
from vaic.runtime.prompts import load_prompt
from vaic.shared import workflows as wf
from vaic.shared.speech import _live_prompt
from vaic.shared.utility import agents_dir, vaic_voice


def test_the_address_and_the_slang_level_are_set_in_one_place() -> None:
    v = vaic_voice()
    assert v.startswith("## Your voice")
    assert '**Address:** call the owner "bro"' in v and '"Sir"' in v
    assert "**Slang level: medium.**" in v
    for word in ('"sup"', '"lowkey"', '"no cap"', '"bet"', '"say less"', '"ngl"', '"fr"'):
        assert word in v, word
    assert "never in every sentence" in v and "Never cringe, never forced" in v


def test_facts_stay_plain_and_there_is_no_emoji() -> None:
    v = vaic_voice()
    assert "Slang goes around the facts, never instead of them" in v
    assert "No emoji, ever" in v
    assert "keeps a normal professional voice" in v  # emails, posts, briefs for the team


def test_the_address_lives_only_in_the_shared_section() -> None:
    """Changing the address later is one edit: no prompt pins "Sir" as the rule any more."""
    for name in ("vaic.md", "voice.md", "voice_live.md"):
        body = load_prompt(name).body
        assert "Your voice" in body, name
        assert "like Jarvis does" not in body and "Always address the owner as" not in body, name
    for name in ("orchestrator.md", "manager.md", "worker.md", "chief_of_staff.md"):
        body = (agents_dir() / name).read_text(encoding="utf-8")
        assert "bro" not in body and "Your voice" not in body, name  # the team keeps its professional voice


def test_both_voice_prompts_carry_the_voice_and_still_forbid_markdown_and_emoji() -> None:
    live = _live_prompt()
    assert live.endswith(vaic_voice())
    sonic = load_prompt("voice.md").body
    for body in (live, sonic):
        assert "no emoji" in body.lower() and "Markdown" in body
    assert "leave out links, code and Markdown symbols" in sonic


def test_questions_are_short_and_casual() -> None:
    assert SAVE_QUESTION == "Save it?"
    assert "Sir" not in wf.MODE_QUESTION
    assert 'ask "Save it?"' in load_prompt("vaic.md").body


async def test_a_vaic_turn_gets_the_voice_and_its_reply_reaches_the_chat_as_written() -> None:
    seen: dict[str, str] = {}
    reply = "Sup, bro. Two jobs running, ngl the game's almost done."

    async def vaic(req: EngineRequest, call: Call) -> str:
        seen["system"] = req.system
        return reply

    c = make_city(scripted_engine({"vaic": vaic}))
    await c.owner_says("yo Vice, what's up?")
    await c.run()
    sys = seen["system"]
    assert vaic_voice() in sys and sys.index("You are VAIC") < sys.index(vaic_voice())
    shown: list[dict[str, Any]] = [e for e in c.bus.of_type("vaic.reply") if e.get("done")]
    assert shown and shown[-1]["text"] == reply


def test_vaics_fixed_messages_are_casual_too() -> None:
    """Not only the voice: every line that reaches the owner as VAIC (chat reports, pushes) talks the same way."""
    from vaic.shared.chief_of_staff import digest_text

    text = digest_text([{"title": "Pick a logo", "choice": "the blue one"}])
    assert (
        text.startswith("Quick one, bro:") and "made one call" in text and "Pick a logo — I said: the blue one." in text
    )
    from vaic.lambdas import notifier
    from vaic.shared import calls, chief_of_staff, executives

    for m in (chief_of_staff, executives, calls, notifier):
        assert "Sir" not in Path(str(m.__file__)).read_text(encoding="utf-8"), m.__name__
