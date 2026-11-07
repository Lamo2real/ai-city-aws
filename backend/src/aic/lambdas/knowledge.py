"""The knowledge ingest Lambda (``docs/KNOWLEDGE.md`` §10).

Step Functions ``aic-prod-knowledge-ingest`` calls it once per step with ``{"action": …, "item_id": …}``:
route, fetch_link, prepare_document, describe_image, start_mediaconvert, check_mediaconvert,
start_transcribe, check_transcribe, transcript_to_text, enrich, start_sync, check_sync, finish, fail,
mark_unsupported. Errors propagate by class name so the state machine can retry ``ConflictException`` and
send everything else to ``fail``, which stores plain words and tells the HUD.
"""

from __future__ import annotations

from typing import Any

from aic.shared.aws import aws_city, require_env
from aic.shared.caps import default_settings
from aic.shared.knowledge.haiku import KnowledgeModel
from aic.shared.knowledge.pipeline import MediaClients, Pipeline
from aic.shared.knowledge.wiring import knowledge_from_env
from aic.shared.utility import UtilityDeps, bedrock_converse_runner

from ._runtime import run

_pipeline: Pipeline | None = None


async def _build() -> Pipeline:
    city = aws_city()
    k = knowledge_from_env(city.session)
    if not k or not k.blobs or not k.kb:
        raise RuntimeError("missing KNOWLEDGE_TABLE, KNOWLEDGE_BUCKET, KNOWLEDGE_BASE_ID or KNOWLEDGE_DATA_SOURCE_ID")
    model = KnowledgeModel(
        UtilityDeps(
            ledger=city.ledger,
            bus=city.bus,
            settings=await city.settings(),
            runner=bedrock_converse_runner(city.session.client("bedrock-runtime")),
        )
    )
    return Pipeline(
        store=k.store,
        blobs=k.blobs,
        kb=k.kb,
        bus=city.bus,
        model=model,
        media=MediaClients(
            mediaconvert=city.session.client("mediaconvert"),
            transcribe=city.session.client("transcribe"),
            mediaconvert_role_arn=require_env("MEDIACONVERT_ROLE_ARN"),
        ),
    )


async def _handle(event: dict[str, Any]) -> dict[str, Any]:
    global _pipeline
    if _pipeline is None:
        _pipeline = await _build()
    else:
        # Settings (spend caps, profile prefix) can change between warm invocations.
        assert _pipeline.model is not None
        _pipeline.model.deps.settings = await _pipeline.model.deps.ledger.settings(default_settings())
    return await _pipeline.run(event)


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    return run(_handle(event))
