"""Lead lists into the knowledge base (decision 121).

A worker following the ``lead-research`` skill ends its report with the leads as one fenced ```` ```csv ```` block.
When the Orchestrator reports the finished job to AIC, AIC's runtime (the only role that may add to the knowledge
base) walks the job's tickets, saves each CSV block it finds as a ``.csv`` document and tells AIC its title, so the
owner gets the table in the chat and the file under Knowledge. Plain code, no model: nothing is retyped.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from .log import log

_CSV = re.compile(r"```csv[^\n]*\n(.*?)```", re.S)


def is_job_report(role: str, inv: dict[str, Any]) -> bool:
    """AIC's turn on the Orchestrator's finished-job report (``report_to_ace``)."""
    return role == "ace" and inv.get("kind") == "report" and inv.get("from") == "orchestrator"


def csv_blocks(text: str) -> list[str]:
    """The ```csv fenced blocks in a report, in order, each ending with a newline."""
    return [b.strip("\n") + "\n" for b in _CSV.findall(text or "") if b.strip()]


async def _results(ledger: Any, task_id: str) -> list[str]:
    """Every ticket's result in the job, the deepest (the workers') first."""
    out: list[str] = []
    level = [task_id]
    for _ in range(4):  # task → department → worker; one more level for safety
        kids = [k for p in level for k in await ledger.child_tickets(p)]
        if not kids:
            break
        out = [str(k.get("result") or "") for k in kids] + out
        level = [k["id"] for k in kids]
    task = await ledger.get_ticket(task_id)
    return [*out, str((task or {}).get("result") or "")]


async def save_lead_csvs(ledger: Any, service: Any, task_id: str) -> list[str]:
    """Saves the job's CSV blocks (once each, even when a report is delivered twice); returns their titles."""
    if service is None:
        return []
    task = await ledger.get_ticket(task_id)
    goal = " ".join(str((task or {}).get("goal") or "").split())
    base = f"Leads: {goal[:80]}" if goal else "Leads"
    seen: set[str] = set()
    titles: list[str] = []
    for result in await _results(ledger, task_id):
        for block in csv_blocks(result):
            digest = hashlib.sha256(block.encode()).hexdigest()[:16]
            if digest in seen:
                continue  # the manager or the Orchestrator quoted the worker's block
            seen.add(digest)
            if not await ledger.claim(f"LEADCSV#{task_id}#{digest}"):
                continue
            title = base if not titles else f"{base} ({len(titles) + 1})"
            try:
                await service.add_csv(block, title, "relevant")
            except Exception as e:  # the owner still gets the table in the chat
                log("warn", "leads.csv_not_saved", task=task_id, error=type(e).__name__)
                continue
            titles.append(title)
    return titles
