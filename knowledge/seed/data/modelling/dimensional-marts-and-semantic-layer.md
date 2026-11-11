---
id: data.modelling.dimensional-marts-and-semantic-layer
department: data
domain: modelling
title: 'Data and AI: Data modelling'
summary: 'Data modelling: Kimball dimensional marts with declared grain, slowly changing dimensions, dbt staging and marts rules, and when to build wide marts versus normalised marts under a semantic layer.'
type: playbook
audience: both
confidence: platform-claim
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- dbt
- snowflake
- databricks
objectives:
- data-platform
- analytics
sources:
- https://joereis.github.io/practical_data_data_eng_survey
- https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/
- https://docs.getdbt.com/best-practices/how-we-structure/2-staging
- https://docs.getdbt.com/best-practices/how-we-structure/4-marts
- https://docs.databricks.com/aws/en/lakehouse/medallion
- https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before designing a fact or dimension table, a dbt staging or mart model, a slowly changing dimension or a semantic layer.

**Source section:** 2. Data modelling: dimensional marts, declared grain, and a semantic layer on top

### What teams use and where modelling hurts

**[FAST-MOVING, December 2025 to January 2026]** Kimball-style dimensional modelling is the most used named approach. The Practical Data Community survey (n=1,101, December 2025 to January 2026, skewed to senior practitioners) reports modelling approaches of 36.8% mixed, 27.8% Kimball dimensional, 17.4% ad hoc, 5.4% canonical or semantic, 3.8% One Big Table, 3.3% event-driven and 3.3% Data Vault ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)).

**[FAST-MOVING, December 2025 to January 2026]** Modelling pain comes from speed pressure and ownership, not tooling. In the same survey (multi-select, about 90% reporting at least one), 59.3% cite pressure to move fast, 50.7% no clear ownership, 39.2% models that are hard to maintain, 18.7% tools that do not support good modelling, and 4.3% AI tools producing inconsistent schemas ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)). **[INFERENCE]** Because ownership (50.7%) outranks tooling (18.7%), assign a named owner per mart before investing in modelling tools.

### Kimball techniques and slowly changing dimensions

**[DURABLE]** The Kimball Group's technique index, which predates 2024 and remains the reference, covers the four-step design process, grain declaration, transaction, periodic-snapshot, accumulating-snapshot and factless fact tables, conformed dimensions and the enterprise bus matrix, surrogate keys, and degenerate and junk dimensions ([Kimball Group, Dimensional Modeling Techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)). Only the index page was read, not the detail pages.

**[DURABLE]** Kimball's slowly changing dimension (SCD) types are defined as follows; use the table to choose how attribute history is kept.

| SCD type | What it does | Source |
|---|---|---|
| Type 0 | Retain the original value | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 1 | Overwrite the value | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 2 | Add a new row | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 3 | Add a prior-value attribute | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 4 | Mini-dimension for rapidly changing attributes | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 5 | Mini-dimension plus a Type 1 outrigger | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 6 | Type 1 attributes on a Type 2 dimension | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |
| Type 7 | Dual Type 1 and Type 2 dimensions | [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/) |

**[INFERENCE]** For a B2B SaaS product the core conformed entities are account or tenant, user, subscription, plan, invoice and product event. Model the account and user dimensions as SCD Type 2 where plan, segment or owner history affects revenue and retention analysis, and as Type 1 for cosmetic attributes. This applies the Kimball definitions and is not a quoted recommendation.

### dbt staging rules

**[PLATFORM CLAIM] [DURABLE]** dbt Labs' staging rules: build one staging model per source table; limit it to renaming, type casting, basic computation and categorisation; do not join (except through "base" models) and do not aggregate, because staging must not change grain; materialise staging as views; use `source()` only in this layer; name models `stg_[source]__[entity]s`; and organise folders per source system, not per loader or business domain ([dbt docs, Staging](https://docs.getdbt.com/best-practices/how-we-structure/2-staging)).

### dbt marts rules

**[PLATFORM CLAIM] [DURABLE]** dbt Labs' marts rules: build one mart per business entity at a declared grain with plain-English names such as `customers` and `orders`; do not create departmental duplicates (`finance_orders` next to `marketing_orders` is an anti-pattern); do not put time rollups in mart names such as `orders_per_day`, and express those as metrics instead; start a mart as a view, move to a table when queries are slow and to incremental when builds are slow; and do not make all marts incremental by default ([dbt docs, Marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts)).

**[PLATFORM CLAIM] [DURABLE]** dbt Labs' join heuristic: when a mart joins more than roughly four or five concepts, introduce intermediate models; with fewer than about ten marts, skip subfolders ([dbt docs, Marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts)).

**[PLATFORM CLAIM] [DURABLE]** If a concept's logic truly differs between departments, name two distinct concepts (for example `tax_revenue` and `revenue`) instead of forking one concept per department, and use tables or incremental models for BI-facing marts so that dashboards do not recompute on refresh ([dbt docs, Marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts)).

### Wide marts without a semantic layer, normalised marts with one

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** The presence of a semantic layer changes the modelling advice. Without one, dbt Labs advises wide denormalised marts on the reasoning that storage is cheap and compute is expensive; with the dbt Semantic Layer, it advises keeping marts as normalised as possible so that MetricFlow can join flexibly ([dbt docs, Marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts)). Databricks likewise says the gold layer should use a dimensional model with defined relationships and measures ([Databricks docs, medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)).

**[VENDOR] [FAST-MOVING, 7 April 2026]** Modelling quality is the strongest lever for AI answer accuracy in dbt Labs' own benchmark of 7 April 2026: three additional LLM-generated dbt models were enough for the semantic layer to answer all 11 benchmark questions, modelling quality mattered more than model choice or reasoning effort, and questions needing too many entity hops scored 0% through MetricFlow until they were modelled ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)). The benchmark was run by the semantic-layer vendor on one dataset.

**[INFERENCE]** Treat One Big Table as a serving artefact generated from dimensional or entity models, not as the modelling method; this is consistent with dbt's wide-marts advice and with its 3.8% standalone usage in the December 2025 to January 2026 survey ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)).

**[INFERENCE]** Data Vault's 3.3% share in the December 2025 to January 2026 survey ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)) suggests a niche choice suited to many-source, audit-heavy enterprises; a single-product SaaS company rarely needs it. **[GAP]** No primary Data Vault source was read. The primary text is Linstedt and Olschimke's paid book on Data Vault 2.0 (Elsevier, ISBN 9780128025109), so hub, link and satellite definitions are unsourced here.

### Gaps in the modelling evidence

**[GAP]** Not fetched: Kimball detail pages (four-step process wording, bus matrix method); any source on activity-schema or entity-centric modelling for SaaS; dbt snapshots for implementing SCD Type 2 (https://docs.getdbt.com/docs/build/snapshots); and Snowflake semantic views (https://docs.snowflake.com/en/user-guide/views-semantic/overview), Databricks metric views and the Open Semantic Interchange initiative, whose 2026 status is unverified.
