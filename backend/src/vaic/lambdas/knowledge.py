"""The knowledge ingest Lambda (``docs/KNOWLEDGE.md`` §10).

Step Functions ``vaic-prod-knowledge-ingest`` calls it once per step with ``{"action": …, "item_id": …}``:
route, fetch_link, prepare_document, describe_image, start_mediaconvert, check_mediaconvert,
start_transcribe, check_transcribe, transcript_to_text, enrich, ingest, check_ingest, finish, fail,
mark_unsupported. The S3 ``raw/`` rule calls it with ``{"action": "start", "bucket", "key"}``, which starts the
run named after the item (EventBridge cannot name a run). Errors propagate by class name so the state machine can retry ``ThrottlingException`` and
send everything else to ``fail``, which stores plain words and tells the HUD.

The deploy pipeline also calls it after Terraform (§17): ``{"action": "seed_knowledge", "dry_run": false}``
reconciles the department knowledge seeds and answers the report (``ok`` false fails the deploy), and
``{"action": "seed_status"}`` answers how many entries are still being indexed, and
``{"action": "knowledge_eval"}`` runs each department's retrieval evaluation against the live index.
"""

from __future__ import annotations

import json
import re
from typing import Any

from vaic.shared.aws import aws_city, require_env
from vaic.shared.caps import default_settings
from vaic.shared.clients import client
from vaic.shared.knowledge.entries import embedding_model, load_seeds
from vaic.shared.knowledge.fetch import Fetched, fetch_link
from vaic.shared.knowledge.haiku import KnowledgeModel
from vaic.shared.knowledge.pipeline import MediaClients, Pipeline
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.registry import EntryRegistry
from vaic.shared.knowledge.seeder import refresh_status, run_seed
from vaic.shared.knowledge.wiring import knowledge_from_env
from vaic.shared.utility import UtilityDeps, bedrock_converse_runner

from ._runtime import run

_pipeline: Pipeline | None = None
_sfn: Any = None
_RAW_KEY = re.compile(r"^raw/(k-[A-Za-z0-9_-]{12})/[^/]+$")


def fetch_site_asset(url: str, max_bytes: int) -> Fetched:
    """A site profile's stylesheet, logo or extra page: https only, the address guard, tighter caps (§16)."""
    from vaic.shared.knowledge.site_profile import ASSET_TIMEOUT_S

    return fetch_link(url, max_bytes=max_bytes, timeout_s=ASSET_TIMEOUT_S, https_only=True)


def start_run(event: dict[str, Any], sfn: Any, state_machine_arn: str) -> dict[str, Any]:
    """An object landed under ``raw/``: start the ingest run named after its item, once per item."""
    m = _RAW_KEY.match(str(event.get("key", "")))
    if not m:
        return {"started": False, "reason": "not an item upload"}
    item_id = m.group(1)
    try:
        sfn.start_execution(stateMachineArn=state_machine_arn, name=item_id, input=json.dumps({"item_id": item_id}))
    except Exception as e:  # boto3 raises a modelled error class per service; match it by name
        if type(e).__name__ != "ExecutionAlreadyExists":
            raise
        return {"item_id": item_id, "started": False, "reason": "already ran"}
    return {"item_id": item_id, "started": True}


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
            runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
        )
    )
    return Pipeline(
        store=k.store,
        blobs=k.blobs,
        kb=k.kb,
        bus=city.bus,
        model=model,
        fetch_asset=fetch_site_asset,
        media=MediaClients(
            mediaconvert=client(city.session, "mediaconvert"),
            transcribe=client(city.session, "transcribe"),
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


async def _seed(event: dict[str, Any]) -> dict[str, Any]:
    k = knowledge_from_env(aws_city().session)
    if not k or not k.blobs or not k.kb:
        return {"ok": False, "errors": ["the knowledge base is not configured on this function"]}
    registry = EntryRegistry(k.store.table)
    projector = EntryProjector(k.blobs, k.kb, k.store.graph)
    seeds = load_seeds()
    if event.get("action") == "seed_status":
        return {"ok": True, **(await refresh_status(registry, projector, list(seeds.taxonomies), seeds.taxonomies))}
    if event.get("action") == "knowledge_eval":
        from vaic.shared.knowledge.evaluation import live_eval, retrieve_probe

        probe = await retrieve_probe(
            k.kb, "How should I structure a Meta account for a new ecommerce brand?", "marketing"
        )
        results = [(await live_eval(k.kb, k.store, d)).as_json() for d in seeds.taxonomies]
        return {"ok": True, "probe": probe, "results": results}
    report = await run_seed(
        seeds, registry, projector, embedding_model(), dry_run=bool(event.get("dry_run")), by="deploy"
    )
    return report.as_json()


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    if event.get("action") in ("seed_knowledge", "seed_status", "knowledge_eval"):
        return run(_seed(event))
    if event.get("action") == "start":
        global _sfn
        if _sfn is None:
            _sfn = client(aws_city().session, "stepfunctions")
        return start_run(event, _sfn, require_env("KNOWLEDGE_STATE_MACHINE_ARN"))
    return run(_handle(event))
