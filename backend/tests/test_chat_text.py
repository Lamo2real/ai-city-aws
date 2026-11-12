"""Owner-facing chat words (2026-11-12): the Chief of Staff's digest is short and plain, and no id reaches a chat."""

import re

from test_api import make
from vaic.runtime.live import LiveReply
from vaic.shared.chat_text import ID_PATTERN, clip, no_ids, worker_name
from vaic.shared.chief_of_staff import MAX_BULLETS, digest_text, review_reason
from vaic.shared.events import parse_event

JOB = "t-0a1b2c3d4e5f"
JOBS = {JOB: "Change the kids' animal memory game to 4 pairs (8 cards)"}


def _row(title: str, choice: str, job: str = JOB, dept: str = "Application") -> dict[str, str]:
    return {"title": title, "choice": choice, "job_id": job, "department": dept, "kind": "question"}


def _fail(worker: str, n: int, reason: str = "FAIL") -> str:
    return f"{worker}'s work failed review {n} times. Latest reasons: {reason}. What should happen?"


# The owner's screenshot of 2026-11-12, newest first, with the text the old digest cut off filled back in.
SCREENSHOT = [
    _row(
        'The 4-pair (8-card) change to the kids\' animal memory game ("Animal Pairs") is ready, but no app has '
        "that name yet. What should happen?",
        'Ship the 8-card game as a new app draft named "Animal Pairs"',
    ),
    _row(_fail("wkr-application-3032a482e8b7", 3), "Try once more"),
    _row(_fail("wkr-application-3777a7d90f2a", 4), "Stop this assignment"),
    _row(_fail("wkr-application-3777a7d90f2a", 3), "Try once more"),
    _row(
        "The kids' animal memory game change (4 pairs / 8 cards): when a worker calls load_app it cannot find "
        "the game. What should happen?",
        "Don't block. Search the Apps list yourself for the kids' animal memory game and update it.",
    ),
    _row(
        _fail("wkr-application-f4b694e9ea42", 4),
        "Stop this assignment. The code is accepted; the only gap is the missing link to the app.",
    ),
    _row("Should the game play a sound when two cards match?", "Yes, a short soft chime."),
    _row(
        "Can the worker look up the game by itself (load_app keeps failing)?",
        "Don't block. Search the Apps list yourself for the kids' animal memory game and update it.",
    ),
]

SNAPSHOT = """Quick one, bro: while you were away I made eight calls so “Change the kids' animal memory game to 4 pairs…” kept moving:

- Three Application workers' work didn't pass review: I gave one another try and stopped two.
- The 4-pair (8-card) change to the kids' animal memory game… — I said: Ship the 8-card game as a new app draft named "Animal Pairs".
- The kids' animal memory game change (4 pairs / 8 cards)… — I said: Don't block. Search the Apps list yourself for the kids' animal memory game…
- Should the game play a sound when two cards match — I said: Yes, a short soft chime.

[See every call and why](#/tickets/decided)"""


def _chat_ids(text: str) -> list[str]:
    """Ids in a chat text, outside links (a link to an app may carry its id)."""
    return ID_PATTERN.findall(re.sub(r"\[[^\]]*\]\([^)]*\)", "", text))


def test_the_screenshot_rewritten() -> None:
    assert digest_text(SCREENSHOT, JOBS) == SNAPSHOT


def test_no_ids_no_fail_no_empty_fields() -> None:
    text = digest_text(SCREENSHOT, JOBS)
    assert _chat_ids(text) == []
    assert "FAIL" not in text and "→" not in text and ";" not in text
    assert not re.search(r"\s[,.;:]", text)  # nothing like "the only gap is ,"


def test_never_cut_mid_word() -> None:
    words = set(re.findall(r"\w+", " ".join(r["title"] + " " + r["choice"] for r in SCREENSHOT) + " " + JOBS[JOB]))
    text = digest_text(SCREENSHOT, JOBS)
    for w in re.findall(r"\w+(?=…)", text):
        assert w in words, w
    for n in (5, 12, 33, 61):
        cut = clip("The kids' animal memory game change, when a worker calls load_app", n)
        assert (
            len(cut) <= n
            and (cut.endswith("…") or cut.endswith("."))
            and re.sub(r"\W+$", "", cut[:-1].split()[-1]) in words
        )


def test_bullets_capped_and_repeats_grouped() -> None:
    many = [_row(f"Question number {i} about colours?", f"Answer {i}.") for i in range(9)]
    text = digest_text(many, JOBS)
    bullets = [line for line in text.splitlines() if line.startswith("- ")]
    assert len(bullets) == MAX_BULLETS and bullets[-1] == "- And five more small calls."
    twice = [_row("Same thing?", "Do it."), _row("Same thing again?", "Do it.")]
    assert len([x for x in digest_text(twice).splitlines() if x.startswith("- ")]) == 1


def test_one_worker_and_jobs_grouped() -> None:
    one = digest_text([_row(_fail("wkr-application-3032a482e8b7", 4, "The board does not shuffle"), "Stop")])
    assert "- An Application worker's work didn't pass review, so I stopped that part. Main reason: The board" in one
    two = digest_text(
        [_row("A?", "Yes.", job="t-111111111111"), _row("B?", "No.", job="t-222222222222")],
        {"t-111111111111": "Memory game", "t-222222222222": "Sales deck"},
    )
    assert "so the work kept moving" in two and "- **Memory game:** A — I said: Yes." in two
    assert "- **Sales deck:** B — I said: No." in two


def test_review_reason() -> None:
    assert review_reason(_fail("w", 3)) == "" and review_reason(_fail("w", 3, "")) == ""
    assert review_reason(_fail("w", 3, "Cards don't flip back")) == "Cards don't flip back"


def test_no_ids_names_workers_and_managers() -> None:
    s = no_ids("wkr-application-3032a482e8b7's work failed. Ask mgr-data-ai. Job t-0123456789ab is done.")
    assert s == "An Application worker's work failed. Ask the Data AI manager. Job is done."
    assert (
        no_ids("Open [it](https://x.example/app-0123456789ab) now")
        == "Open [it](https://x.example/app-0123456789ab) now"
    )
    assert worker_name({"specialty": "Game logic", "department": "Application"}) == "the game logic worker"
    assert worker_name({"department": "Application"}) == "an Application worker"
    assert worker_name(None) == "a worker"


async def test_no_id_reaches_a_chat_message() -> None:
    """The one sanitiser sits on every chat output path: conversation lines, vaic.reply events, live replies."""
    raw = "wkr-application-3777a7d90f2a and mgr-application finished t-0a1b2c3d4e5f."
    d = make()
    await d.ledger.add_conversation_line("main", "vaic", raw)
    assert _chat_ids((await d.ledger.recent_conversation("main"))[-1]["text"]) == []
    event = parse_event({"type": "vaic.reply", "conversation": "main", "text": raw, "done": True, "at": "x"})
    assert _chat_ids(str(event["text"])) == []
    sent: list[dict[str, object]] = []

    async def send(e: dict[str, object]) -> None:
        sent.append(e)

    live = LiveReply(send, "main")
    await live.add(raw)
    await live.flush()
    await live.done(raw)
    assert sent and all(_chat_ids(str(e["text"])) == [] for e in sent)


async def test_review_needs_a_real_reason_and_the_owner_question_has_no_id() -> None:
    from test_apps import city_deps, tool
    from vaic.runtime.tools import TurnCtx

    d = city_deps()
    await d.ledger.update_settings({"autopilot": False})
    wid = "wkr-application-3032a482e8b7"
    await d.ledger.put_agent({"id": wid, "kind": "worker", "role": "Game logic", "specialty": "Game logic",
                              "department": "Application", "parent": "mgr-application", "state": "active"})  # fmt: skip
    t = await d.ledger.create_ticket({"id": "t-a", "goal": "flip cards", "from": "mgr-application", "to": wid,
                                      "department": "Application", "parent_id": None, "kind": "assignment",
                                      "status": "in_review", "review_rounds": 2, "pace": "unhurried"})  # fmt: skip
    ctx = TurnCtx(agent_id="mgr-application", role="manager", department="Application", ticket_id="t-a", task_id="t-a")
    review = tool(d, ctx, "review")
    assert (await review({"ticket_id": t["id"], "verdict": "FAIL", "reasons": "FAIL"})).startswith("Not recorded")
    assert (await d.ledger.get_ticket(t["id"]))["review_rounds"] == 2  # type: ignore[index]
    assert "asked the owner" in await review(
        {"ticket_id": t["id"], "verdict": "FAIL", "reasons": "Cards never flip back."}
    )
    q = (await d.ledger.open_questions())[-1]
    assert (
        q["text"]
        == "The game logic worker's work failed review 3 times. Latest reason: Cards never flip back. What should happen?"
    )
