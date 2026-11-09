"""The AI City guide: AIC answers "how do I…" from it at once, it covers every screen, and it sits in Knowledge."""

import re
from pathlib import Path
from typing import Any

from aic.runtime.prompts import load_prompt
from aic.shared.app_guide import FLAG, TITLE, app_guide, ensure_guide_in_knowledge, guide_hash
from test_api import make

ROOT = Path(__file__).resolve().parents[2]


def test_the_guide_covers_every_tab_and_every_settings_page() -> None:
    g = app_guide()
    app = (ROOT / "web/src/App.tsx").read_text()
    screens = (ROOT / "web/src/components/Screens.tsx").read_text()
    pages = re.findall(r'id: "([a-z-]+)",\s*\n?\s*title: "([^"]+)"', screens)
    assert len(pages) >= 10
    for _id, title in pages:
        assert title.split(" ")[0] in g, f"the guide doesn't mention Settings → {title}"
    for tab in ("AIC", "City", "Work", "Projects", "Knowledge", "Skills", "Costs", "Settings"):
        assert f"**{tab}**" in g
    assert '"ace"' in app or "ace" in app
    # The how-tos the owner asked about by name.
    for q in ("add a connector", "start a project", "add knowledge", "tour"):
        assert q in g.lower()


def test_aic_carries_the_guide_and_answers_from_it_at_once() -> None:
    ace = load_prompt("ace.md").body
    assert "Questions about using AI City" in ace and "answer at once" in ace
    assert "never invent a button or a page" in ace


class Knowledge:
    def __init__(self) -> None:
        self.added: list[tuple[str, str]] = []
        self.deleted: list[str] = []

    async def add_text(self, text: str, title: str, scope: Any = None) -> dict[str, Any]:
        self.added.append((title, text))
        return {"id": f"kn-{len(self.added)}"}

    async def delete(self, item_id: str) -> None:
        self.deleted.append(item_id)


async def test_the_guide_is_added_to_knowledge_once_and_replaced_when_it_changes(monkeypatch: Any) -> None:
    d = make()
    k = Knowledge()
    assert await ensure_guide_in_knowledge(d.ledger.table, k) is True
    assert await ensure_guide_in_knowledge(d.ledger.table, k) is False  # same guide: nothing to do
    assert k.added[0][0] == TITLE and "How do I" in k.added[0][1]
    assert (await d.ledger.table.get(*FLAG))["hash"] == guide_hash()
    import aic.shared.app_guide as g

    monkeypatch.setattr(g, "guide_hash", lambda: "changed")
    assert await ensure_guide_in_knowledge(d.ledger.table, k) is True
    assert k.deleted == ["kn-1"]  # the old copy goes
    assert await ensure_guide_in_knowledge(d.ledger.table, None) is False


def test_every_prompt_a_lambda_reads_is_in_the_bundle() -> None:
    build = (ROOT / "backend/scripts/build_lambdas.py").read_text()
    assert 'shutil.copytree(ROOT / "agents", OUT / "aic" / "_agents")' in build
    for f in ("help/app_guide.md", "voice_live.md", "chief_of_staff.md", "executives/ceo.md"):
        assert (ROOT / "agents" / f).is_file(), f
