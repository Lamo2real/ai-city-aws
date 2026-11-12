"""VAIC's real-time voice on OpenAI GPT-Live (decision 128): the API opens the call with the owner's key."""

import json

import httpx

from test_api import ev, js, make
from test_speech import KEY, deps
from vaic.lambdas.api import ROUTES, handle_http
from vaic.shared.speech import LIVE_URL

OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n"
ANSWER = json.dumps({"session": {"id": "live_123"}, "transport": {"type": "webrtc", "sdp": "v=0 answer"}}).encode()


async def test_the_offer_goes_to_gpt_live_with_client_delegation_and_the_answer_comes_back() -> None:
    d, openai, _ = deps(KEY, (201, ANSWER, "application/json"))
    assert ("POST", "/voice/live") in ROUTES
    r = js(await handle_http(ev("POST", "/voice/live", {"sdp": OFFER}), make(speech=d)))
    assert r == {"sdp": "v=0 answer", "session_id": "live_123"}
    call = openai.calls[0]
    assert call["url"] == LIVE_URL
    assert call["headers"]["Authorization"] == f"Bearer {KEY}"
    s = call["body"]["session"]
    assert s["model"] == "gpt-live-1"
    assert s["delegation"] == {"type": "client"}  # GPT-Live only speaks; VAIC answers
    assert (
        '"bro"' in s["instructions"]
        and "## Your voice" in s["instructions"]
        and "Delegate everything" in s["instructions"]
    )
    assert call["body"]["transport"] == {"type": "webrtc", "sdp": OFFER}


async def test_no_key_bad_key_and_a_missing_offer_are_plain_answers() -> None:
    d, _, _ = deps(None)
    r = await handle_http(ev("POST", "/voice/live", {"sdp": OFFER}), make(speech=d))
    assert r["statusCode"] == 503
    d, _, _ = deps(KEY, (401, b"{}", "application/json"))
    r = await handle_http(ev("POST", "/voice/live", {"sdp": OFFER}), make(speech=d))
    assert r["statusCode"] == 503 and "rejected" in js(r)["message"]
    r = await handle_http(ev("POST", "/voice/live", {}), make(speech=d))
    assert r["statusCode"] == 400
    d, _, _ = deps(KEY, httpx.ConnectError("down"))
    r = await handle_http(ev("POST", "/voice/live", {"sdp": OFFER}), make(speech=d))
    assert r["statusCode"] == 502
