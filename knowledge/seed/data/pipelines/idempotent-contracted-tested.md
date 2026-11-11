---
id: data.pipelines.idempotent-contracted-tested
department: data
domain: pipelines
title: 'Data and AI: Pipelines'
summary: 'Pipelines: orchestrators in use, the dbt workflow baseline, idempotent incremental loads and backfills with microbatch, schema evolution and model contracts, the Open Data Contract Standard, unit and data tests, gates for AI-written pipeline code and a pipeline definition of done.'
type: playbook
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- dbt
- iceberg
- snowflake
- databricks
- bigquery
objectives:
- data-platform
sources:
- https://astronomer.io/blog/state-of-airflow-2026
- https://www.astronomer.io/docs/astro/airflow3/features-af3
- https://joereis.github.io/practical_data_data_eng_survey
- https://docs.getdbt.com/best-practices/best-practice-workflows
- https://docs.getdbt.com/docs/build/incremental-microbatch
- https://sre.google/workbook/data-processing/
- https://docs.getdbt.com/docs/mesh/govern/model-contracts
- https://bitol.io/bitol-announces-odcs-v3-1-0-stronger-smarter-and-stricter/
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
- https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity
- https://docs.getdbt.com/docs/build/unit-tests
- https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before building, changing or backfilling a pipeline, adding a data contract or deciding what tests a pipeline needs.

**Source section:** 3. Pipelines: idempotent, partitioned, contracted and tested in CI

### Orchestrators in use

**[VENDOR] [FAST-MOVING, 22 January 2026]** Astronomer's State of Airflow 2026 survey (vendor-run, published 22 January 2026, more than 5,800 respondents in 122 countries) reports that Airflow 3 shipped in April 2025 as the first major version in over four years, that 26% of Airflow users have upgraded and 84% of 2.x users plan to, that 32% run GenAI or MLOps use cases in production, and that dbt is the most commonly paired tool at 44% ([Astronomer, State of Airflow 2026](https://astronomer.io/blog/state-of-airflow-2026)).

**[VENDOR] [FAST-MOVING, 2026]** Astronomer's documentation lists Airflow 3 features as DAG versioning (each run tied to its code snapshot), scheduler-managed backfills that can be triggered by API or UI and paused or cancelled, event-driven scheduling from message queues, a task execution interface that moves toward multi-language tasks, and remote execution on Astro ([Astronomer docs, Airflow 3 features](https://www.astronomer.io/docs/astro/airflow3/features-af3)).

**[FAST-MOVING, December 2025 to January 2026]** Orchestration shares in the Practical Data Community survey (n=1,101): 24.4% cloud-managed services such as Composer and MWAA, 22.9% self-managed Airflow, 20.5% none or ad hoc, 6.2% Dagster, 1.3% Prefect, and 24.7% other tools such as Databricks Jobs, dbt and SSIS ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)). **[INFERENCE]** With a fifth of teams running no orchestrator, a small team can start with dbt plus a managed scheduler (MWAA or the warehouse's native jobs) and add Dagster or Airflow 3 when cross-system dependencies appear.

### dbt workflow baseline

**[PLATFORM CLAIM] [DURABLE]** dbt Labs' workflow baseline: keep everything in version control with pull-request review; separate development and production targets; use `ref()` and `source()` instead of hard-coded relations; give every model a primary key tested `unique` and `not_null`; materialise as views by default, as tables for BI-facing or multi-descendant models, and as incremental only when build time is unacceptable; and limit data in development, for example to the last 3 days ([dbt docs, Best practice workflows](https://docs.getdbt.com/best-practices/best-practice-workflows)).

**[PLATFORM CLAIM] [DURABLE]** Slim CI builds only what changed. The command `dbt build --select state:modified+ --defer --state <prod artifacts>` builds changed models and their descendants in a sandbox and defers unchanged parents to production ([dbt docs, Best practice workflows](https://docs.getdbt.com/best-practices/best-practice-workflows)).

### Idempotent incremental loads and backfills with dbt microbatch

**[PLATFORM CLAIM] [FAST-MOVING, dbt v1.9 and later]** The dbt microbatch incremental strategy (dbt v1.9 and later) splits a run into per-period batches (`batch_size` of hour, day, month or year) keyed on an `event_time` column. Each batch is atomic, independent and idempotent; `lookback` (default 1) reprocesses recent batches to catch late data; and `begin` sets the start for full builds ([dbt docs, Microbatch](https://docs.getdbt.com/docs/build/incremental-microbatch)).

**[PLATFORM CLAIM] [FAST-MOVING, dbt v1.9 and later]** A dbt microbatch backfill is run as `dbt run --event-time-start <d1> --event-time-end <d2>`, with both flags required; `dbt retry` reruns only failed batches; dbt Labs recommends setting `full_refresh: false` and using targeted backfills; all times are UTC; and upstream models without `event_time` are fully scanned for every batch ([dbt docs, Microbatch](https://docs.getdbt.com/docs/build/incremental-microbatch)).

**[PLATFORM CLAIM] [FAST-MOVING, dbt v1.9 and later]** dbt microbatch uses different mechanics per adapter: delete-plus-insert on Redshift and Snowflake; insert-overwrite on BigQuery, Spark and Athena-Hive; merge on Athena-Iceberg and Postgres; and replace-where on Databricks ([dbt docs, Microbatch](https://docs.getdbt.com/docs/build/incremental-microbatch)). **[INFERENCE]** Prefer delete-plus-insert or insert-overwrite by partition over append for idempotency; append-only loads are safe only in bronze.

**[DURABLE]** Google's SRE workbook chapter on data processing pipelines (pre-2024, durable; the first 100,000 of 116,036 characters were read) lists failure-prevention techniques: idempotent mutations, two-phase mutations (write to a temporary location, validate, then apply), checkpointing, staged rollout (a dry run on about 1% of production data, then roughly 10%, 50% and 100%), and reprocessing only the affected accounts ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)).

### Schema evolution and dbt model contracts

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** dbt model contracts (`contract.enforced: true`) check column names and types before the build and push constraints into the table definition, but across most platforms only `not_null` is actually enforced by the engine. Contracts are supported for tables, for incremental models (with `on_schema_change` set to `append_new_columns` or `fail`) and for views (names and types only). dbt Labs advises using them on public models once the project is stable, because this governance slows change ([dbt docs, Model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)).

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** dbt flags these as breaking changes in state comparison: removing a column, changing a `data_type`, removing or modifying constraints (v1.6 and later), and deleting, renaming or disabling a contracted model (v1.9 and later; an error if the model is versioned and a warning otherwise). Contracts validate shape at build time, while data tests validate content after the build ([dbt docs, Model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)).

### The Open Data Contract Standard is the vendor-neutral contract format

**[FAST-MOVING, December 2025]** The Open Data Contract Standard (ODCS) v3.1.0, a Linux Foundation AI & Data standard released in December 2025, is YAML with an official JSON Schema under Apache 2.0, governed by a technical steering committee with an RFC process. It covers schema (including new foreign-key-style relationships), quality rules, service-level properties for latency, availability and freshness (now with schedulable checks on a cron or interval), support channels and custom properties. Its strict schema now rejects undefined fields, and it has no breaking changes from v3.0.2 ([Bitol, ODCS v3.1.0 announcement](https://bitol.io/bitol-announces-odcs-v3-1-0-stronger-smarter-and-stricter/)).

**[FAST-MOVING, November 2026]** ODCS is in Adopt on the Thoughtworks Technology Radar Volume 35 of November 2026 ([Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf)). **[VENDOR]** Thoughtworks' field experience, published 16 January 2026, recommends versioned data contracts that cover schema, quality objectives, terms of use and access policies ([Thoughtworks, State of data mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity)).

### Testing: unit tests in development and CI, data tests after the build

**[PLATFORM CLAIM] [FAST-MOVING, dbt v1.8 and later]** dbt unit tests (v1.8 and later) validate SQL logic on static fixtures before materialisation. Add them for complex logic (regular expressions, date arithmetic, window functions, many-branch CASE statements), past bugs, unseen edge cases, refactors and critical or public models; skip them for trivial aggregates. Run them in development and CI only, not in production, excluding them with `--exclude-resource-type` (an environment variable from v1.11). For incremental models they test the inserted or merged rows, not the merge itself ([dbt docs, Unit tests](https://docs.getdbt.com/docs/build/unit-tests)).

**[VENDOR] [FAST-MOVING, 14 April 2026]** AI-assisted coding is outrunning AI-assisted testing. dbt Labs' 2026 State of Analytics Engineering survey (vendor survey, n=363, fielded late 2025 to early 2026, press release of 14 April 2026) found 72% prioritise AI-assisted coding but only 24% prioritise AI-assisted testing or observability, and 71% worry about incorrect or hallucinated outputs reaching stakeholders ([dbt Labs press release, 14 Apr 2026](https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance)). Only the press release was read; the full report sits behind a form. **[INFERENCE]** Quality checks are likely to lag code volume, so budget test-coverage growth explicitly.

### AI-written pipeline code needs the same gates as human code

**[VENDOR] [FAST-MOVING, 22 January 2026]** Only 9% of respondents in Astronomer's survey (published 22 January 2026, more than 5,800 respondents) are happy with DAGs written by generic AI tools; 43% cite hallucinations and 42% outdated syntax ([Astronomer, State of Airflow 2026](https://astronomer.io/blog/state-of-airflow-2026)). **[INFERENCE]** Ground agents in current framework documentation and hold AI-written pipeline code to the same CI gates as human code.

### Pipeline definition of done

**[INFERENCE]** A pipeline is done, by the researchers' checklist assembled from the dbt and ODCS sources, when it has a declared grain and a tested primary key; is time-partitioned and re-runnable for any date range with an identical result; has a lookback window sized to observed lateness; has an enforced contract if it is consumed outside the team; has unit tests for non-trivial logic; passes slim CI; and records an owner and a freshness service level in the contract ([dbt docs, Microbatch](https://docs.getdbt.com/docs/build/incremental-microbatch); [Bitol, ODCS v3.1.0 announcement](https://bitol.io/bitol-announces-odcs-v3-1-0-stronger-smarter-and-stricter/)).

### Gaps in the pipeline evidence

**[GAP]** Not fetched: Dagster documentation on assets, partitions and backfills (https://docs.dagster.io/guides/build/partitions-and-backfills/backfilling-data); Airflow 3.x point-release notes (https://airflow.apache.org/docs/apache-airflow/stable/release_notes.html), so asset-aware scheduling, human-in-the-loop and deadline alerts are unverified; any source on Debezium or DMS operational practice, schema-registry practice or Iceberg schema-evolution rules; SQLMesh, dbt Fusion engine status and the dbt Labs and Fivetran corporate situation in 2026.
