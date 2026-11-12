"""VAIC does anything the owner can do in AI City (the owner, 2026-11-09, decision 143).

Since decision 206 (the owner, 2026-11-11) a change is staged first: ``city_api`` with PUT, POST or DELETE shows the
owner what will change with Yes / No buttons in the chat ("Do you want to save these changes?") and saves nothing;
``save_change`` saves or discards it on the owner's next message (a tap, typed words or speech). ``find_skill`` looks
up the skill catalog: one match is staged as a skill card with Add, several are offered as choices. ``draft_skill``
(decision 257) writes a new skill, or a new version of one, and stages it with its files, checked by the same rules
the save uses, so the owner reads the whole SKILL.md beside the chat before Add and Yes can't fail for its files.

``city_api`` runs any HUD route as the owner (read and write: settings, connectors, departments, knowledge, skills,
standing orders, apps, mail, calendar…) through the API's own code and checks. ``hud_action`` does what lives on the
owner's device rather than in the city: light or dark mode, opening a page. Both work only on the owner's own message,
so a document, email or worker report can never steer them.
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any

from vaic.lambdas.skills_api import prepare as prepare_skill
from vaic.shared import executives as execs
from vaic.shared import owner_api, skills_catalog
from vaic.shared.ad_spend import AdLimitStore
from vaic.shared.caps import SETTING_KEYS, settings_patch
from vaic.shared.events import now_iso
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.log import log
from vaic.shared.skills import PK as SKILLS_PK
from vaic.shared.skills import SkillInvalid, valid_roles
from vaic.shared.skills import sk as skill_sk

from .tools import ToolSpec, TurnCtx, _obj, _s

NOT_OWNER = (
    "Only the owner's own message can change AI City through you (decision 143). Tell the owner what you would "
    "change and that they can ask you to."
)
THEMES = ("light", "dark", "system")
PAGE = re.compile(r"#/[\w/?=&.-]{0,120}")
PENDING_PK = "VAIC_PENDING"
"""One staged change per conversation (sk = the conversation); a newer one replaces it."""
SAVE_QUESTION = "Do you want to save these changes?"
SETTING_LABELS = {
    "daily_global_usd": "Daily cap, all departments",
    "daily_department_usd": "Daily cap per department",
    "monthly_budget_usd": "Monthly cap",
    "department_caps": "Daily caps by department",
    "max_workers_per_goal": "Workers per goal (one manager's team)",
    "max_concurrent_workers_per_department": "Workers per department",
    "max_concurrent_workers_global": "Workers in total",
    "max_live_workers_city": "Workers at work in the whole city",
    "max_open_jobs": "Jobs running at once",
    "max_departments": "Your own departments",
    "max_new_sessions_per_second": "New workers per second",
    "worker_idle_release_minutes": "Minutes before an idle worker goes home",
    "notify_push": "Push notifications",
    "chief_of_staff_enabled": "Chief of Staff",
    "autopilot": "Autopilot",
    "mail_access": "Mail access",
    "profile_prefix": "Where models run",
}
LIMIT_KEYS = {k for k in SETTING_KEYS if k.startswith(("max_", "worker_")) or k.endswith(("_usd", "_caps"))}
NOT_A_SETTING = (
    "{keys} {verb} not a setting in Settings, so there is nothing to change. The settings are: "
    + ", ".join(k for k in SETTING_KEYS if k != "first_run_done")
    + ". Safety rules, IAM, the policy file and self-improvement are never settings."
)


DRAFT_MAX_BYTES = 48_000
"""A skill VAIC writes in the chat stays readable beside it; bigger ones are uploaded on the Skills page."""


def _show(v: Any, key: str) -> str:
    if v is None:
        return "no limit"
    if isinstance(v, bool):
        return "on" if v else "off"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if key.endswith("_usd"):
        return f"${v}"
    if isinstance(v, dict):
        return ", ".join(f"{k} {x}" for k, x in v.items()) or "none"
    return str(v)


def _money(r: dict[str, Any]) -> str:
    amount = float(r.get("amount") or 0)
    return f"{amount:,.2f}".rstrip("0").rstrip(".") + f" {r.get('currency') or ''}".rstrip()


def _per(r: dict[str, Any]) -> str:
    return "a day" if r.get("per") == "day" else "per campaign"


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def owner_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    if c.role != "vaic":
        return []

    conv = c.conversation or "main"
    staged_now: list[str] = []
    """Ids staged in this turn: they are saved only on the owner's next message, never in the same turn."""

    async def stage(
        method: str, path: str, body: dict[str, Any] | None, summary: str, card: dict[str, Any] | None = None
    ) -> str:
        """Keeps the call for the owner's yes and puts the Yes/No card in the chat. Returns the tool's answer."""
        p = owner_api.clean_path(path)
        question, options = SAVE_QUESTION, ["Yes", "No"]
        title, lines, detail = summary or f"{method} {p}", [], ""
        preview: dict[str, Any] | None = None
        if card is None and method == "POST" and p == "/skills":
            # A skill written in the chat: checked now with the save's own rules (decision 257).
            built_or_why = await drafted(body)
            if isinstance(built_or_why, str):
                return built_or_why
            body, card = built_or_why
        if card is not None:
            title, lines, detail = card["title"], card["lines"], card.get("detail", "")
            question, options = card["question"], card["options"]
            preview = card.get("skill")
        elif method == "PUT" and p == "/settings":
            given = body or {}
            unknown = [k for k in given if k not in SETTING_KEYS or k == "first_run_done"]
            if unknown or not given:
                return NOT_A_SETTING.format(
                    keys=", ".join(unknown) or "An empty change", verb="are" if len(unknown) > 1 else "is"
                )
            cur = await d.settings()
            patch, bad = settings_patch(given, cur)
            if bad:
                return f"Not staged, the setting would be refused: {bad} Tell the owner in one sentence."
            same = [k for k in patch if cur.get(k) == patch[k]]
            if len(same) == len(patch):
                return "Those settings already have those values. Nothing to change; tell the owner."
            lines = [
                f"{SETTING_LABELS.get(k, k)}: {_show(cur.get(k), k)} → {_show(v, k)}"
                for k, v in patch.items()
                if k not in same
            ]
            body = {k: v for k, v in patch.items() if k not in same}
            page = "Limits & spending" if all(k in LIMIT_KEYS for k in body) else "General"
            title = summary or f"Settings → {page}"
        elif method == "PUT" and p == "/executives":
            # Checked now, so a body the save would refuse is fixed before the owner's Yes (decision 215).
            try:
                body = execs.check_config(body)
            except execs.Invalid as why:
                return f"Not staged, the city would refuse it: {why} Fix the body and call city_api again."
            lines = [f"{execs.EXECUTIVES[k]['title']}: {'on' if v else 'off'}" for k, v in body["enabled"].items()]
            for k, v in body["reviews"].items():
                bits = [("on" if v["enabled"] else "off")] if "enabled" in v else []
                if "every_days" in v:
                    bits.append({1: "daily", 7: "weekly", 14: "every two weeks", 30: "monthly"}[v["every_days"]])
                rv = execs.REVIEWS[k]
                lines.append(f"{rv['executive'].upper()} {rv['title'].lower()}: {', '.join(bits)}")
            title = summary or "Settings → Executives"
        elif method == "POST" and (m := re.fullmatch(r"/skills/catalog/([\w-]+)", p)):
            e = skills_catalog.find(m.group(1))
            if e is None:
                return "That skill is not in the catalog. Use find_skill with the owner's words."
            built = skill_card(e, body)
            title, lines, detail, question, options = (
                built["title"],
                built["lines"],
                built["detail"],
                built["question"],
                built["options"],
            )
        elif owner_api.destructive(method, path):
            question, options = "Do you want to go ahead?", ["Yes", "No"]
        pid = f"chg-{d.ledger.now_ms()}"
        await d.ledger.table.put(
            {
                "pk": PENDING_PK,
                "sk": conv,
                "id": pid,
                "method": method,
                "path": path,
                "body_json": json.dumps(body) if body is not None else "",
                "title": title,
                "lines": lines,
                "at": now_iso(d.ledger.now()),
            }
        )
        staged_now.append(pid)
        await d.bus.put(
            {
                "type": "vaic.question",
                "conversation": conv,
                "question": question,
                "options": options,
                "id": pid,
                "title": title[:120],
                "lines": [x[:200] for x in lines][:12],
                "detail": detail[:300],
                **({"skill": preview} if preview else {}),
            }
        )
        said = "; ".join(lines) if lines else title
        return (
            f"Staged, NOT saved yet: {title} ({said}). The owner sees it with {options[0]} / {options[1]} buttons. "
            f'Now say what will change in one short sentence, ask "{question}" and stop. On the owner\'s yes '
            f"(a tap on {options[0]}, or typed or spoken) call save_change with answer yes; on no, answer no. If "
            "they ask for something different instead, stage the new change (it replaces this one)."
        )

    async def drafted(body: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]] | str:
        """The checked body (with the reduced SKILL.md the save will store) and its card, or why it's refused."""
        b = body or {}
        try:
            name, description, files, removed = prepare_skill(b)
            roles = valid_roles(b["roles"]) if b.get("roles") else None
        except SkillInvalid as why:
            return f"Not staged, the city would refuse this skill: {why} Fix it and call draft_skill again."
        size = sum(len(v) for v in files.values())
        if size > DRAFT_MAX_BYTES:
            return (
                f"Not staged: the skill is {size:,} bytes, and one written in the chat can be at most "
                f"{DRAFT_MAX_BYTES:,}. Make it shorter and call draft_skill again (bigger ones are uploaded on the "
                "Skills page)."
            )
        text = {p: v.decode("utf-8", "replace") for p, v in files.items()}
        old = await d.ledger.table.get(SKILLS_PK, skill_sk(name))
        checked: dict[str, Any] = {
            "files": [{"path": p, "content_base64": base64.b64encode(v).decode()} for p, v in sorted(files.items())],
            **({"roles": roles} if roles else {}),
        }
        who = f"For: {', '.join(roles)}." if roles else ("Same roles as now." if old else "For every role.")
        extra = sorted(p for p in text if p != "SKILL.md")
        dropped = f" Removed from the frontmatter: {', '.join(removed)}." if removed else ""
        card = {
            "title": f"{'Update' if old else 'Add'} the skill {name}",
            "lines": [description],
            "detail": " ".join(x for x in (who, f"Also: {', '.join(extra)}." if extra else "", dropped) if x),
            "question": "Save this new version?" if old else "Add this skill?",
            "options": ["Save", "Not now"] if old else ["Add", "Not now"],
            "skill": {
                "name": name,
                "description": description,
                "markdown": text["SKILL.md"],
                "files": extra,
                "replacing": old is not None,
            },
        }
        return checked, card

    async def draft_skill(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        if d.owner_api is None:
            return "The API isn't wired to this runtime yet (VAIC_API_FUNCTION is not set)."
        name = str(a.get("name") or "").strip()
        description = " ".join(str(a.get("description") or "").split())
        body = str(a.get("instructions") or "").strip()
        if not body:
            return "Write the skill's instructions (the SKILL.md body) and call draft_skill again."
        md = f"---\nname: {name}\ndescription: {description}\n---\n\n{body}\n"
        files = [{"path": "SKILL.md", "content_base64": base64.b64encode(md.encode()).decode()}]
        for f in a.get("files") or []:
            if isinstance(f, dict):
                content = str(f.get("content") or "").encode()
                files.append({"path": str(f.get("path") or ""), "content_base64": base64.b64encode(content).decode()})
        roles = a.get("roles")
        req: dict[str, Any] = {"files": files, **({"roles": roles} if isinstance(roles, list) and roles else {})}
        return await stage("POST", "/skills", req, "")

    def skill_card(e: dict[str, Any], body: dict[str, Any] | None) -> dict[str, Any]:
        roles = (body or {}).get("roles")
        who = f"For: {', '.join(map(str, roles))}." if isinstance(roles, list) and roles else "For every role."
        depts = ", ".join(e.get("departments") or [])
        return {
            "title": f"Add the skill {e['title']}",
            "lines": [e["description"]],
            "detail": " ".join(x for x in (e.get("source", ""), f"({depts})" if depts else "", who) if x),
            "question": "Add this skill?",
            "options": ["Add", "Not now"],
        }

    async def call(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        if d.owner_api is None:
            return "The API isn't wired to this runtime yet (VAIC_API_FUNCTION is not set)."
        method, path = str(a.get("method") or "GET").upper(), str(a.get("path") or "")
        why = owner_api.refusal(method, path)
        if why:
            return why
        body = a.get("body")
        body = body if isinstance(body, dict) else None
        if method != "GET":
            return await stage(method, path, body, str(a.get("summary") or "").strip()[:120])
        r = await d.owner_api({"method": method, "path": path, "body": None})
        return owner_api.summarise(r, strip_links=owner_api.clean_path(path).startswith("/files"))

    async def save(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        row = await d.ledger.table.get(PENDING_PK, conv)
        if not row:
            return "Nothing is waiting to be saved. Stage the change with city_api first."
        if row["id"] in staged_now:
            return (
                "You staged this change in this same turn: it waits for the owner's own yes. Ask them and stop; "
                "they answer with the buttons, in words or by voice."
            )
        if d.owner_api is None and row["method"] != "HUD":
            return "The API isn't wired to this runtime yet (VAIC_API_FUNCTION is not set)."
        await d.ledger.table.delete(PENDING_PK, conv)
        if str(a.get("answer")) != "yes":
            await d.bus.put({"type": "vaic.change", "conversation": conv, "id": row["id"], "saved": False})
            return f"Discarded, nothing changed: {row['title']}. Say so in one short sentence."
        body = json.loads(row["body_json"]) if row.get("body_json") else None
        if row["method"] == "HUD":  # the owner's device: light, dark or system
            value = (body or {}).get("value")
            await d.bus.put({"type": "hud.action", "action": "theme", "value": value, "conversation": conv})
            await d.bus.put({"type": "vaic.change", "conversation": conv, "id": row["id"], "saved": True})
            return f"Saved: {row['title']}. Applied on every screen the owner has open."
        r = await d.owner_api({"method": row["method"], "path": row["path"], "body": body})
        ok = 200 <= int(r.get("statusCode", 500)) < 300
        log("info" if ok else "error", "vaic.save", method=row["method"], path=owner_api.clean_path(row["path"]),
            status=int(r.get("statusCode", 500)), detail="" if ok else str(r.get("body") or "")[:300])  # fmt: skip
        await d.bus.put({"type": "vaic.change", "conversation": conv, "id": row["id"], "saved": ok})
        head = "Saved" if ok else "Not saved, the city refused it"
        return f"{head}: {row['title']}. " + owner_api.summarise(r, cap=1500)

    async def find_skill(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        q = str(a.get("query") or "").strip()
        found = skills_catalog.search(q, str(a.get("department") or ""))
        exact = [e for e in found if _norm(q) in (_norm(e["name"]), _norm(e["title"]))]
        found = exact[:1] or found
        if not found:
            return (
                f'No skill in the catalog matches "{q}". Say so, and that the owner can write or upload their own '
                "on the Skills page (or try other words)."
            )
        have = {r["name"] for r in await d.ledger.table.query(SKILLS_PK, "SKILL#")}
        if len(found) == 1:
            e = found[0]
            if e["name"] in have:
                return f"The owner already has the skill {e['title']} ({e['name']}). Nothing to add; say so."
            roles = a.get("roles")
            body: dict[str, Any] = {"roles": roles} if isinstance(roles, list) and roles else {}
            return await stage("POST", f"/skills/catalog/{e['name']}", body, "", skill_card(e, body))
        top = found[:5]
        await d.bus.put(
            {
                "type": "vaic.question",
                "conversation": conv,
                "question": "Which skill do you mean?",
                "options": [e["title"][:60] for e in top],
            }
        )
        listing = "; ".join(
            f"{e['title']} ({e['name']}{', added' if e['name'] in have else ''}): {e['description'][:140]}" for e in top
        )
        more = f" ({len(found) - len(top)} more fit less well.)" if len(found) > len(top) else ""
        return (
            f"{len(found)} skills fit: {listing}.{more} Their titles are on the owner's screen as choices. Ask which "
            "one in one short sentence and stop; when they pick, call find_skill again with that title."
        )

    async def hud(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        action = str(a.get("action") or "")
        event: dict[str, Any] = {"type": "hud.action", "action": action, "conversation": c.conversation or "main"}
        if action == "theme":
            value = str(a.get("value") or "")
            if value not in THEMES:
                return "theme takes light, dark or system."
            card = {
                "title": "Settings → Appearance",
                "lines": [f"Appearance → {value}"],
                "question": SAVE_QUESTION,
                "options": ["Yes", "No"],
            }
            return await stage("HUD", "theme", {"value": value}, "", card)
        elif action == "open":
            page = str(a.get("page") or "")
            if not PAGE.fullmatch(page):
                return 'page is a HUD address such as "#/settings/general" or "#/knowledge".'
            event["page"] = page
        else:
            return "action is theme or open."
        await d.bus.put(event)
        return "Done on the owner's screens (web and iPhone). Say what changed in one short sentence."

    async def ad_limit(a: dict[str, Any]) -> str:
        store = AdLimitStore(d.ledger.table, d.ledger.now)
        action = str(a.get("action") or "")
        waiting = [x for x in await d.ledger.pending_approvals() if x.get("kind") == "ad.spend"]
        if action == "get":
            cur = await store.get()
            head = (
                f"The ad spend limit is {_money(cur)} {_per(cur)} (set {str(cur['set_at'])[:10]})."
                if cur
                else "There is no ad spend limit: every campaign starts without asking."
            )
            if waiting:
                head += " Waiting for the owner: " + "; ".join(f"{x['id']}: {x.get('reason', '')}" for x in waiting)
            return head + " Say so."
        if action == "history":
            rows = await store.history()
            if not rows:
                return "The ad spend limit has never been set."
            return "Changes, newest first: " + "; ".join(
                f"{str(r['at'])[:10]} {'set to ' + _money(r) + ' ' + _per(r) if r['action'] == 'set' else 'removed'}"
                for r in rows
            )
        if not c.from_owner:
            return NOT_OWNER
        if action in ("confirm", "refuse"):
            want = str(a.get("approval_id") or "")
            if not want and len(waiting) > 1:
                return (
                    "Several campaigns are waiting: "
                    + "; ".join(f"{x['id']}: {x.get('reason', '')}" for x in waiting)
                    + ". Ask which one."
                )
            ap = await d.ledger.get_approval(want) if want else (waiting[0] if waiting else None)
            if not ap or ap.get("kind") != "ad.spend" or ap.get("status") != "pending":
                return "No ad campaign is waiting for that answer. Check get_status or Needs you for the right one."
            r = await d.owner_api(
                {"method": "POST", "path": f"/approvals/{ap['id']}", "body": {"approved": action == "confirm"}}
            )
            ok = 200 <= int(r.get("statusCode", 500)) < 300
            log("info" if ok else "error", "vaic.ad_spend_answer", id=ap["id"], approved=action == "confirm", ok=ok)
            if not ok:
                return "The city refused that answer: " + owner_api.summarise(r, cap=400)
            return (
                "Confirmed: the campaign starts now. Say so in one sentence."
                if action == "confirm"
                else "Refused: the campaign won't start. Say so in one sentence."
            )
        if action == "remove":
            gone = await store.remove()
            log("info", "vaic.ad_limit", action="remove", removed=gone)
            return "Removed: there is no ad spend limit now." if gone else "There was no ad spend limit to remove."
        if action == "set":
            try:
                per = "day" if a.get("per") == "day" else "campaign"
                rec = await store.set(float(a.get("amount") or 0), str(a.get("currency") or "USD"), per)
            except (TypeError, ValueError) as e:
                return str(e) or "The limit must be an amount above zero."
            log("info", "vaic.ad_limit", action="set", amount=rec["amount"], currency=rec["currency"], per=per)
            return (
                f"Saved: the ad spend limit is now {_money(rec)} {_per(rec)}. Any campaign planned above it waits "
                "for the owner's yes, and you call the owner's iPhone about it (a message follows if they don't "
                "answer). Confirm the new value back in one sentence."
            )
        return "action is set, get, remove, history, confirm or refuse."

    async def call_owner(a: dict[str, Any]) -> str:
        if not c.from_owner:
            return NOT_OWNER
        reason = " ".join(str(a.get("reason") or "").split())[:200] or "You asked me to call you."
        await d.bus.put({"type": "call.requested", "reason": reason})
        log("info", "vaic.call_owner")
        return (
            "Ringing the owner's iPhone now (the AI City app). If they don't pick up, one message follows. "
            "Say so in one short sentence."
        )

    return [
        ToolSpec(
            "city_api",
            "Read or change anything in AI City for the owner, exactly as the HUD would: the same routes, checks and "
            "results. Use it whenever the owner asks you to look at or change a setting, a connector, a department, "
            "a skill, a standing order, the company brief, the executives, knowledge items, apps, mail rules, the "
            "calendar, workers and anything else on a screen. Do it; don't tell the owner where to click. method: "
            "GET, POST, PUT or DELETE; path: the route (see 'Doing things in AI City for the owner' in your "
            "instructions), with a query string if it takes one; body: the JSON the route takes; summary: what the "
            'change does in a few plain words ("Turn Autopilot off"). GET runs at once. PUT, POST and DELETE are '
            "only staged: the owner sees what will change with Yes / No buttons, and save_change saves it on their "
            "yes. GET first when you need the current values. Routes that take a secret are refused: open the page "
            "instead.",
            _obj(
                {
                    "method": {"type": "string", "enum": list(owner_api.METHODS)},
                    "path": _s(1, 300),
                    "body": {"type": "object"},
                    "summary": _s(0, 120),
                },
                ("body", "summary"),
            ),
            call,
            step=lambda a: (
                f"{'Checking' if str(a.get('method', 'GET')).upper() == 'GET' else 'Preparing a change to'} "
                f"{owner_api.clean_path(str(a.get('path') or ''))}"
            ),
        ),
        ToolSpec(
            "save_change",
            "Save or discard the change you staged with city_api, find_skill or draft_skill, on the owner's answer in their new "
            "message: answer yes when they said yes, save, add, go ahead or tapped Yes / Add; no when they said no, "
            "cancel, not now or tapped No / Not now. Never in the same turn you staged it.",
            _obj({"answer": {"type": "string", "enum": ["yes", "no"]}}),
            save,
            step=lambda a: "Saving the change" if a.get("answer") == "yes" else "Discarding the change",
        ),
        ToolSpec(
            "find_skill",
            'Find a skill in the catalog (Skills → Discover) when the owner asks to add one ("add a skill called '
            'release notes", "get me a skill for NDAs"). query: the owner\'s words for it; department: when they '
            "name one; roles: when they say who gets it. One match: its card with an Add button is shown and staged "
            "(save_change on their yes). Several: they are offered as choices. None: say so.",
            _obj(
                {
                    "query": _s(1, 100),
                    "department": _s(0, 60),
                    "roles": {"type": "array", "items": _s(1, 40)},
                },
                ("department", "roles"),
            ),
            find_skill,
            step=lambda a: f"Looking for the skill {str(a.get('query') or '')[:40]}",
        ),
        ToolSpec(
            "draft_skill",
            "Write a skill for the owner (one that isn't in the catalog, or a new version of one they have) and "
            "stage it: the whole SKILL.md opens beside the chat for the owner to read, with Add / Not now, and "
            "save_change saves exactly that on their yes. Write it in full first; never ask whether to write it. "
            "name: lower-case letters, digits and dashes; description: one or two sentences on what it does and when "
            "to use it (at most 1,024 characters); instructions: the SKILL.md body in Markdown (a # title, then "
            "clear steps, rules and examples); roles: who gets it (vaic, orchestrator, manager, worker), every role "
            "when not said; files: extra text files only when the skill needs them. To change a skill, GET "
            "/skills/<name> with city_api, then draft_skill the whole new version under the same name. When the "
            "owner asks for changes, call it again: the new draft replaces the shown one.",
            _obj(
                {
                    "name": _s(1, 64),
                    "description": _s(1, 1024),
                    "instructions": _s(1, DRAFT_MAX_BYTES),
                    "roles": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["vaic", "orchestrator", "manager", "worker"]},
                    },
                    "files": {
                        "type": "array",
                        "items": _obj({"path": _s(1, 200), "content": _s(0, DRAFT_MAX_BYTES)}),
                    },
                },
                ("roles", "files"),
            ),
            draft_skill,
            step=lambda a: f"Writing the skill {str(a.get('name') or '')[:40]}",
        ),
        ToolSpec(
            "hud_action",
            "Change what lives on the owner's device instead of in the city. action theme with value light, dark or "
            'system (Appearance: "switch to dark mode"; staged with Yes / No like city_api, saved by save_change); '
            'action open with page, a HUD address such as "#/settings/connectors", to bring a screen up (also for '
            "pages where the owner must paste a secret). "
            "Applies at once on every screen the owner has open.",
            _obj(
                {"action": {"type": "string", "enum": ["theme", "open"]}, "value": _s(1, 20), "page": _s(2, 130)},
                ("value", "page"),
            ),
            hud,
            step=lambda a: "Changing your screen",
        ),
        ToolSpec(
            "ad_spend_limit",
            "The owner's ad spend limit, the one approval left (decision 240): a campaign whose total planned spend "
            "(daily budget times days, or the lifetime budget) is over it waits for the owner's yes before it starts "
            'or its budget is raised; below it, it just starts. per day makes it a daily ceiling instead ("max 300 kr '
            'a day", "a $30 daily ceiling"): a campaign planned above it a day, or a spent one raised above it, waits '
            "for the owner. It covers every agent and every ad connector; the city calls the owner's iPhone when one "
            "waits. action set with amount (a number), currency (USD, EUR, SEK...; what the owner said, USD when they "
            'gave $, SEK for kr/kronor) and per (campaign, the default, or day) when the owner says e.g. "confirm '
            'with me before any campaign over $500" or "make it $1,000"; it '
            "replaces the old value at once, no Yes/No card. action get for the current limit (and history for past "
            'changes), action remove to drop it. When the owner answers a waiting campaign in words ("yes, start '
            "it\"), action confirm or refuse with approval_id (the ad.spend approval). Only on the owner's own "
            "message. Say the new value back plainly.",
            _obj(
                {
                    "action": {"type": "string", "enum": ["set", "get", "remove", "history", "confirm", "refuse"]},
                    "amount": {"type": "number", "minimum": 0.01},
                    "currency": _s(3, 8),
                    "per": {"type": "string", "enum": ["campaign", "day"]},
                    "approval_id": _s(3, 64),
                },
                ("amount", "currency", "per", "approval_id"),
            ),
            ad_limit,
            step=lambda a: (
                "Checking your ad spend limit"
                if a.get("action") in ("get", "history")
                else "Saving your ad spend limit"
            ),
        ),
        ToolSpec(
            "call_owner",
            "Ring the owner's iPhone now: the AI City app rings like a phone call (also when locked); answered, they "
            "talk to you by voice with the reason; not answered, one message follows. Only when the owner asks to "
            'be called ("call me", "test the call"). reason: one short sentence they hear first.',
            _obj({"reason": _s(1, 200)}, ()),
            call_owner,
            step=lambda a: "Calling your iPhone",
        ),
    ]
