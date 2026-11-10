"""Decision 173: a connected tool's sign hangs by the doors of the departments that use it.

On every successful connection the utility model (a hardcoded prompt) picks the departments, checked against the
real ones, and the service's favicon becomes a small pixel sign in the City's palette (fetched as untrusted bytes)."""

import io
from typing import Any

from PIL import Image

from aic.lambdas import connectors as lam
from aic.shared import connector_signs as cs
from aic.shared.connectors import DEFAULT_ROLES, ConnectorStore, city_signs, event
from aic.shared.cost import Usage
from aic.shared.events import MemoryBus
from aic.shared.mcp_http import HttpResponse
from aic.shared.table import MemoryTable
from aic.shared.turn import TurnInput, TurnOutput
from aic.shared.utility import UtilityDeps
from city_support import make_city, scripted_engine
from connector_fakes import TOOLS, FakeNet, Recorder, control, mcp_server, resolver

DEPTS = [
    {"name": "Media", "mission": "Videos, channels and creators."},
    {"name": "Marketing", "mission": "Campaigns and brand."},
    {"name": "Research", "mission": "Markets and papers."},
    {"name": "Finance", "mission": "Books and payments."},
]


def runner_saying(text: str) -> Any:
    seen: list[str] = []

    async def run(input: TurnInput) -> TurnOutput:
        seen.append(input.prompt)
        return TurnOutput(text=text, usage=Usage(input=40, output=12))

    run.seen = seen  # type: ignore[attr-defined]
    return run


async def deps(runner: Any) -> UtilityDeps:
    city = make_city(scripted_engine({}))
    return UtilityDeps(ledger=city.ledger, bus=city.bus, settings=await city.deps.settings(), runner=runner)


def png(size: int = 32, bg: tuple[int, ...] | None = None, mark: tuple[int, ...] = (230, 30, 30, 255)) -> bytes:
    img = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    for y in range(size // 4, size - size // 4):
        for x in range(size // 4, size - size // 4):
            img.putpixel((x, y), mark)
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


# ---------- departments ----------
def test_only_real_departments_are_kept_whatever_the_case() -> None:
    names = [d["name"] for d in DEPTS]
    assert cs.parse_departments(
        '{"every_department": false, "departments": ["media", "Sales", "Research"]}', names
    ) == (
        False,
        ["Media", "Research"],
    )
    assert cs.parse_departments('ok {"every_department": true, "departments": []}', names) == (True, names)
    assert cs.parse_departments('{"every_department": false, "departments": ["Sales"]}', names) is None
    assert cs.parse_departments("Media and Research", names) is None


async def test_the_hardcoded_prompt_runs_on_the_utility_model_with_the_tool_and_the_departments() -> None:
    r = runner_saying('{"every_department": false, "departments": ["Media", "Marketing"], "reason": "videos"}')
    d = await deps(r)
    rec = {"id": "youtube", "label": "YouTube", "tools": [{"name": "upload_video", "description": "Upload a video."}]}
    assert await cs.assign_departments(rec, DEPTS, d) == (False, ["Media", "Marketing"])
    prompt = r.seen[0]
    assert "which departments of AI City use a tool" in prompt  # agents/utility/connector-departments.md
    assert "Name: YouTube" in prompt and "upload_video: Upload a video." in prompt and "- Finance:" in prompt
    assert (await d.ledger.spend("day", "ROLE#utility"))["turns"] == 1  # gated and costed like every utility turn


# ---------- the pixel sign ----------
def test_a_logo_becomes_a_small_grid_in_the_citys_palette() -> None:
    s = cs.pixelate(png())
    assert s and s["size"] == cs.SIZE and len(s["px"]) == cs.SIZE * cs.SIZE
    assert set(s["colors"]) <= set(cs.PALETTE)
    assert "#d8392b" in s["colors"]  # the red mark, snapped to the City's red
    assert cs.pixelate(png()) == s  # deterministic


def test_a_solid_background_is_dropped_and_the_mark_fills_the_sign() -> None:
    s = cs.pixelate(png(bg=(255, 255, 255, 255)))
    assert s and "#ffffff" not in s["colors"]
    assert "." not in s["px"]  # cropped to the mark, so it fills the sign


def test_svg_oversize_and_garbage_are_refused() -> None:
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="9" height="9"/></svg>'
    assert cs.pixelate(svg) is None
    assert cs.pixelate(b"not an image") is None
    assert cs.pixelate(b"x" * (cs.MAX_LOGO_BYTES + 1)) is None
    assert cs.pixelate(png(size=cs.MAX_LOGO_SIDE + 8)) is None
    assert cs.pixelate(png(mark=(0, 0, 0, 0))) is None  # nothing visible


def test_icons_are_looked_for_on_the_brands_own_domain_first() -> None:
    hosts = cs.logo_hosts({"id": "x", "url": "https://mcp.example.co.uk/v1/mcp"})
    assert hosts[:3] == ["example.co.uk", "www.example.co.uk", "mcp.example.co.uk"]
    stripe = cs.logo_hosts({"id": "stripe", "url": "https://mcp.stripe.com"})  # the catalog's sign-up page too
    assert stripe[0] == "stripe.com"


class IconNet(FakeNet):
    def __init__(self, icons: dict[str, HttpResponse]) -> None:
        super().__init__()
        self.icons = icons

    def __call__(self, url: str, headers: Any, body: bytes, timeout: float) -> HttpResponse:
        if url in self.icons:
            self.calls.append((url, dict(headers), body))
            return self.icons[url]
        return super().__call__(url, headers, body, timeout)


async def test_the_favicon_is_fetched_over_public_https_following_a_redirect_and_never_as_svg() -> None:
    net = IconNet(
        {
            "https://example.com/apple-touch-icon.png": HttpResponse(200, {"content-type": "image/svg+xml"}, b"<svg/>"),
            "https://example.com/favicon.ico": HttpResponse(301, {"location": "https://www.example.com/i.png"}, b""),
            "https://www.example.com/i.png": HttpResponse(200, {"content-type": "image/png"}, png()),
        }
    )
    assert await cs.fetch_logo({"id": "x", "url": "https://mcp.example.com/mcp"}, net, resolver) == png()
    inside = IconNet(
        {"https://example.com/favicon.ico": HttpResponse(302, {"location": "https://internal.example.com/a"}, b"")}
    )
    assert await cs.fetch_logo({"id": "x", "url": "https://mcp.example.com/mcp"}, inside, resolver) is None
    assert not any("internal.example.com" in c[0] for c in inside.calls)  # a private address is never fetched


# ---------- on every successful connection ----------
URL = "https://mcp.example.com/mcp"


async def test_a_connector_that_connects_gets_its_departments_and_sign_on_its_record_and_event() -> None:
    net = IconNet({"https://example.com/apple-touch-icon.png": HttpResponse(200, {"content-type": "image/png"}, png())})
    net.mcp[URL] = mcp_server(TOOLS)
    r = runner_saying('{"every_department": false, "departments": ["Media"], "reason": "videos"}')
    ud = await deps(r)

    async def labeler(rec: dict[str, Any]) -> dict[str, Any]:
        return await cs.label_connector(rec, DEPTS, ud, net, resolver)

    store = ConnectorStore(MemoryTable())
    bus = MemoryBus()
    d = lam.ConnectorsDeps(
        store,
        bus,
        control(),
        Recorder({"get_workload_access_token_for_user_id": {"workloadAccessToken": "wt"}}),
        Recorder(),
        "gw-1",
        "pe-1",
        "arn:aws:lambda:eu-north-1:123456789012:function:aic-prod-connector-bridge",
        "aic-prod-connectors",
        transport=net,
        resolve=resolver,
        labeler=labeler,
    )
    await store.create(
        {"id": "vids", "label": "Vids", "url": URL, "status": "provisioning", "roles": DEFAULT_ROLES, "tools": []}
    )
    await lam.handle({"action": "provision", "id": "vids"}, d)
    rec = await store.get("vids")
    assert rec and rec["status"] == "ready"
    assert rec["departments"] == ["Media"] and rec["every_department"] is False
    assert rec["sign"]["size"] == cs.SIZE
    last = [e for e in bus.events if e.get("type") == "connector.updated"][-1]
    assert last["status"] == "ready" and last["departments"] == ["Media"] and last["sign"] == rec["sign"]
    # A refresh asks again for the departments but keeps the sign it already has.
    fetched = len(net.calls)
    await lam.handle({"action": "refresh", "id": "vids"}, d)
    assert len(r.seen) == 2
    assert not any("icon" in c[0] for c in net.calls[fetched:])


async def test_a_failing_model_or_icon_never_stops_the_connection() -> None:
    async def broken(input: TurnInput) -> TurnOutput:
        raise RuntimeError("bedrock down")

    ud = await deps(broken)
    patch = await cs.label_connector({"id": "x", "label": "X", "url": URL}, DEPTS, ud, FakeNet(), resolver)
    assert patch == {}


def test_the_snapshot_and_events_carry_only_what_the_city_draws() -> None:
    sign = {"size": 12, "colors": ["#d8392b"], "px": "a" * 144}
    recs = [
        {
            "id": "jira",
            "label": "Jira",
            "status": "ready",
            "departments": ["Media"],
            "every_department": True,
            "sign": sign,
        },
        {"id": "late", "label": "Late", "status": "needs_login"},
    ]
    assert city_signs(recs) == [
        {
            "id": "jira",
            "label": "Jira",
            "status": "ready",
            "departments": ["Media"],
            "every_department": True,
            "sign": sign,
        }
    ]
    e = event({"id": "late", "label": "Late", "status": "needs_login"})
    assert "sign" not in e and "departments" not in e
