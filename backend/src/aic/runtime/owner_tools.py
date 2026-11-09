"""VAIC does anything the owner can do in AI City (the owner, 2026-11-09, decision 143).

``city_api`` runs any HUD route as the owner (read and write: settings, connectors, departments, knowledge, skills,
standing orders, apps, mail, calendar…) through the API's own code and checks. ``hud_action`` does what lives on the
owner's device rather than in the city: light or dark mode, opening a page. Both work only on the owner's own message,
so a document, email or worker report can never steer them.
"""

from __future__ import annotations

import re
from typing import Any

from aic.shared import owner_api
from aic.shared.hierarchy.actions import CityDeps

from .tools import ToolSpec, TurnCtx, _obj, _s

NOT_OWNER = (
    "Only the owner's own message can change AI City through you (decision 143). Tell the owner what you would "
    "change and that they can ask you to."
)
THEMES = ("light", "dark", "system")
PAGE = re.compile(r"#/[\w/?=&.-]{0,120}")


def owner_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    if c.role != "ace":
        return []

    async def call(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        if d.owner_api is None:
            return "The API isn't wired to this runtime yet (AIC_API_FUNCTION is not set)."
        method, path = str(a.get("method") or "GET").upper(), str(a.get("path") or "")
        why = owner_api.refusal(method, path)
        if why:
            return why
        if owner_api.destructive(method, path) and a.get("confirm") is not True:
            return (
                "This deletes or resets something. If the owner's message clearly asked for exactly this, call "
                "again with confirm: true; otherwise ask them in one short question."
            )
        body = a.get("body")
        r = await d.owner_api({"method": method, "path": path, "body": body if isinstance(body, dict) else None})
        return owner_api.summarise(r)

    async def hud(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        action = str(a.get("action") or "")
        event: dict[str, Any] = {"type": "hud.action", "action": action, "conversation": c.conversation or "main"}
        if action == "theme":
            value = str(a.get("value") or "")
            if value not in THEMES:
                return "theme takes light, dark or system."
            event["value"] = value
        elif action == "open":
            page = str(a.get("page") or "")
            if not PAGE.fullmatch(page):
                return 'page is a HUD address such as "#/settings/general" or "#/knowledge".'
            event["page"] = page
        else:
            return "action is theme or open."
        await d.bus.put(event)
        return "Done on the owner's screens (web and iPhone). Say what changed in one short sentence."

    return [
        ToolSpec(
            "city_api",
            "Read or change anything in AI City for the owner, exactly as the HUD would: the same routes, checks and "
            "results. Use it whenever the owner asks you to look at or change a setting, a connector, a department, "
            "a skill, a standing order, the company brief, the executives, knowledge items, apps, mail rules, the "
            "calendar, workers and anything else on a screen. Do it; don't tell the owner where to click. method: "
            "GET, POST, PUT or DELETE; path: the route (see 'Doing things in AI City for the owner' in your "
            "instructions), with a query string if it takes one; body: the JSON the route takes. GET first when you "
            "need the current values. Deletes and resets need confirm: true, which you pass when the owner's own "
            "words asked for exactly that. Routes that take a secret are refused: open the page instead.",
            _obj(
                {
                    "method": {"type": "string", "enum": list(owner_api.METHODS)},
                    "path": _s(1, 300),
                    "body": {"type": "object"},
                    "confirm": {"type": "boolean"},
                },
                ("body", "confirm"),
            ),
            call,
            step=lambda a: (
                f"{'Checking' if str(a.get('method', 'GET')).upper() == 'GET' else 'Changing'} "
                f"{owner_api.clean_path(str(a.get('path') or ''))}"
            ),
        ),
        ToolSpec(
            "hud_action",
            "Change what lives on the owner's device instead of in the city. action theme with value light, dark or "
            'system (Appearance: "switch to dark mode"); action open with page, a HUD address such as '
            '"#/settings/connectors", to bring a screen up (also for pages where the owner must paste a secret). '
            "Applies at once on every screen the owner has open.",
            _obj(
                {"action": {"type": "string", "enum": ["theme", "open"]}, "value": _s(1, 20), "page": _s(2, 130)},
                ("value", "page"),
            ),
            hud,
            step=lambda a: "Changing your screen",
        ),
    ]
