"""Seed the department knowledge bases by hand (docs/KNOWLEDGE.md section 17).

The deploy pipeline runs the same seeder after every Terraform apply; this script is for checking seeds locally
and for running the seeder against an environment from a laptop.

    uv run python scripts/seed_knowledge.py --validate        # no AWS: schema, ids, links, taxonomy
    uv run python scripts/seed_knowledge.py --dry-run         # read the registry, print what would change
    uv run python scripts/seed_knowledge.py                   # apply
    uv run python scripts/seed_knowledge.py --status          # how many entries are still indexing
    uv run python scripts/seed_knowledge.py --eval            # retrieval evaluation, offline (keywords only)
    uv run python scripts/seed_knowledge.py --eval --live     # the same against the environment's hybrid index

Everything but --validate uses your AWS credentials and the environment's names, as the Lambdas get them:
KNOWLEDGE_TABLE, KNOWLEDGE_BUCKET, KNOWLEDGE_BASE_ID, KNOWLEDGE_DATA_SOURCE_ID and KNOWLEDGE_GRAPH_ID
(``terraform output`` in infra/envs/prod lists them), plus AWS_REGION.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter

from vaic.shared.knowledge.entries import embedding_model, load_seeds


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--validate", action="store_true", help="only validate the seed files (no AWS)")
    ap.add_argument("--dry-run", action="store_true", help="print the planned changes without writing")
    ap.add_argument("--status", action="store_true", help="refresh and print indexing status")
    ap.add_argument("--eval", action="store_true", help="run the retrieval evaluation (offline unless --live)")
    ap.add_argument("--live", action="store_true", help="with --eval: against the environment's index")
    a = ap.parse_args()

    seeds = load_seeds()
    if a.eval and not a.live:
        from vaic.shared.knowledge.evaluation import offline_eval

        for d in seeds.taxonomies:
            print(json.dumps(offline_eval(seeds, d).as_json(), indent=2, ensure_ascii=False))
        return 0
    if a.validate:
        for err in seeds.errors:
            print(f"error: {err}")
        per = Counter(e.department for e in seeds.entries.values())
        print(json.dumps({"ok": not seeds.errors, "entries": dict(per), "errors": len(seeds.errors)}))
        return 0 if not seeds.errors else 1

    import boto3

    from vaic.shared.knowledge.projection import EntryProjector
    from vaic.shared.knowledge.registry import EntryRegistry
    from vaic.shared.knowledge.seeder import refresh_status, run_seed
    from vaic.shared.knowledge.wiring import knowledge_from_env

    k = knowledge_from_env(boto3.Session())
    if not k or not k.blobs or not k.kb:
        print(
            "Set KNOWLEDGE_TABLE, KNOWLEDGE_BUCKET, KNOWLEDGE_BASE_ID, KNOWLEDGE_DATA_SOURCE_ID (and KNOWLEDGE_GRAPH_ID)."
        )
        return 2
    registry = EntryRegistry(k.store.table)
    projector = EntryProjector(k.blobs, k.kb, k.store.graph)
    if a.status:
        print(json.dumps(asyncio.run(refresh_status(registry, projector, list(seeds.taxonomies)))))
        return 0
    if a.eval:
        from vaic.shared.knowledge.evaluation import live_eval

        for d in seeds.taxonomies:
            print(json.dumps(asyncio.run(live_eval(k.kb, k.store, d)).as_json(), indent=2, ensure_ascii=False))
        return 0
    report = asyncio.run(run_seed(seeds, registry, projector, embedding_model(), dry_run=a.dry_run, by="script"))
    print(json.dumps(report.as_json(), indent=2, ensure_ascii=False))
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
