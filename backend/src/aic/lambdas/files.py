"""The files Lambda (docs/FILES.md §5): describes each file that lands in the files bucket.

EventBridge calls it with:
- ``{"action": "object_created", "key"}``: an object under ``files/`` or ``hires/<hire>/files/`` (S3);
- ``{"action": "mediaconvert_done", "detail"}``: a MediaConvert job of ours finished or failed;
- ``{"action": "transcribe_done", "detail"}``: a Transcribe job of ours finished or failed;
and the api (Try again) with ``{"action": "index", "file_id"}``.
"""

from __future__ import annotations

from typing import Any

from aic.shared.aws import aws_city, require_env
from aic.shared.caps import default_settings
from aic.shared.clients import client
from aic.shared.files.describe import FilesModel
from aic.shared.files.indexer import Indexer, MediaClients
from aic.shared.files.wiring import files_from_env
from aic.shared.utility import UtilityDeps, bedrock_converse_runner

from ._runtime import run

_indexer: Indexer | None = None


def adapt(event: dict[str, Any]) -> dict[str, Any]:
    """EventBridge's ``detail`` → the indexer's fields."""
    d = event.get("detail")
    if not isinstance(d, dict):
        return event
    if event.get("action") == "mediaconvert_done":
        return {
            "action": "mediaconvert_done",
            "job_id": d.get("jobId"),
            "status": d.get("status"),
            "user_metadata": d.get("userMetadata") or {},
            "error": d.get("errorMessage") or d.get("errorCode"),
        }
    if event.get("action") == "transcribe_done":
        return {
            "action": "transcribe_done",
            "job_name": d.get("TranscriptionJobName"),
            "status": d.get("TranscriptionJobStatus"),
        }
    return event


async def _build() -> Indexer:
    city = aws_city()
    f = files_from_env(city.session)
    if not f:
        raise RuntimeError("missing FILES_TABLE or FILES_BUCKET")

    async def department(hire: str) -> str | None:
        a = await city.ledger.get_agent(hire)
        return str(a["department"]) if a and a.get("department") else None

    model = FilesModel(
        UtilityDeps(
            ledger=city.ledger,
            bus=city.bus,
            settings=await city.settings(),
            runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
        )
    )
    return Indexer(
        store=f.store,
        blobs=f.blobs,
        bus=city.bus,
        model=model,
        embedder=f.embedder,
        media=MediaClients(
            mediaconvert=client(city.session, "mediaconvert"),
            transcribe=client(city.session, "transcribe"),
            mediaconvert_role_arn=require_env("MEDIACONVERT_ROLE_ARN"),
        ),
        agent_department=department,
    )


async def _handle(event: dict[str, Any]) -> dict[str, Any]:
    global _indexer
    if _indexer is None:
        _indexer = await _build()
    elif _indexer.model is not None:
        _indexer.model.deps.settings = await _indexer.model.deps.ledger.settings(default_settings())
    return await _indexer.run(adapt(event))


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    return run(_handle(event))
