---
id: data.governance.owners-and-tag-access
department: data
domain: governance
title: 'Data and AI: Data governance'
summary: 'Data governance: DAMA-DMBOK as the reference map, the transferable parts of data mesh, governance in the transformation layer, Lake Formation tag-based access control, access control at retrieval time, PII tooling and a minimum governance kit for a small EU SaaS company.'
type: playbook
audience: both
confidence: platform-claim
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
- sagemaker
- dbt
objectives:
- governance
sources:
- https://dama.org/about-dama/what-is-data-management/
- https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity
- https://joereis.github.io/practical_data_data_eng_survey
- https://docs.getdbt.com/docs/mesh/govern/model-contracts
- https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/
- https://docs.aws.amazon.com/lake-formation/latest/dg/tag-based-access-control.html
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before assigning data ownership, designing access control (LF-Tags, retrieval-time filters) or setting up governance.

**Source section:** 5. Data governance: product thinking, named owners and tag-driven access

### DAMA-DMBOK as the reference map

**[DURABLE]** DAMA-DMBOK organises data management into 11 knowledge areas, and DAMA highlights Data Governance, Data Quality, Data Security, Data Architecture, Metadata Management, and Data Integration and Interoperability as especially critical now ([DAMA International](https://dama.org/about-dama/what-is-data-management/)). **[GAP]** The full list of 11 areas and the status of the DMBOK 3.0 project were not obtained.

### Data mesh: adopt the transferable parts, not the reorganisation

**[VENDOR] [FAST-MOVING, 16 January 2026]** Thoughtworks' field observations of 16 January 2026 (a consultancy that sells mesh work; no quantified outcomes) describe data mesh as mainly an organisational change. What worked: a central data office acting as an enabling centre of excellence; a hybrid platform with central storage, compute, identity and observability and domain choice of last-mile tools; the platform run as a product with user research and SLOs; and starting from urgent business problems ([Thoughtworks, State of data mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity)).

**[VENDOR] [FAST-MOVING, 16 January 2026]** Thoughtworks' reported data mesh failure patterns, as of 16 January 2026: "domains" that are renamed IT teams without business ownership; analysis paralysis over domain boundaries; project managers relabelled as data product owners without training; underestimated legacy integration (one team spent over a year mapping before delivering); governance committees blocking policy automation; under-funded upskilling; and poor developer experience that leads to shadow IT ([Thoughtworks, State of data mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity)).

**[VENDOR] [FAST-MOVING, 16 January 2026]** Thoughtworks' data product recommendations, as of 16 January 2026: start with a minimum viable data product; avoid one product per use case; size products carefully, because too big creates a new silo and too small creates a discovery problem; adopt FAIR-style characteristics; agree policies before automating them as code; and make product teams accountable for governance ([Thoughtworks, State of data mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity)).

**[CONTESTED] [INFERENCE]** The case for a full data mesh is weak for a single-product SaaS company. The strongest pro-mesh source is a consultancy that sells mesh work and offers no quantified outcomes, while only 16.2% of practitioners prefer a mesh or federated architecture against 40.1% for a centralised warehouse and 34.6% for a lakehouse in the December 2025 to January 2026 survey ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)). Adopt the transferable parts (named owners, data products with contracts, platform-as-product) without decentralising teams.

### Governance in the transformation layer

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** dbt provides governance in the transformation layer through contracts for public models, breaking-change detection and model versions; dbt Labs advises adding this once the project is stable because it slows change ([dbt docs, Model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)).

### Access control on AWS with Lake Formation

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** AWS Lake Formation gives a central, database-style permission model on the Glue catalogue with row-level, column-level and cell-level grants for users and roles, same-account and cross-account. It replaces per-prefix S3 bucket policy management, covers federated Redshift catalogues, and vends credentials to external engines ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Lake Formation tags (LF-Tags) are key-value attributes, such as `classification=restricted`, assigned to databases, tables and columns. Tables inherit tags from databases and columns from tables, and inherited values can be overridden. Access is allowed when a principal's granted tag value matches the resource's. LF-Tags are not IAM tags ([Lake Formation tag-based access control](https://docs.aws.amazon.com/lake-formation/latest/dg/tag-based-access-control.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** AWS recommends Lake Formation tag-based access control when there are many catalogue objects or fast growth, because named-resource grants scale as principals multiplied by resources while tags scale as principals plus resources. AWS's worked case turns 17 named grants into 5 tag assignments plus 8 tag grants. AWS's seven-step rollout ends by verifying access through tags and then revoking the earlier named-resource grants ([Lake Formation tag-based access control](https://docs.aws.amazon.com/lake-formation/latest/dg/tag-based-access-control.html)).

**[INFERENCE]** A starting LF-Tag taxonomy for a small SaaS company is `domain`, `classification` (public, internal, confidential, personal, special) and `layer` (bronze, silver, gold), assigned at database level and overridden at column level for personal data. This is the researchers' suggestion, consistent with the documented inheritance model ([Lake Formation tag-based access control](https://docs.aws.amazon.com/lake-formation/latest/dg/tag-based-access-control.html)). **[GAP]** LF-Tag numeric limits and cross-account behaviour are on a separate page that was not read.

### Access control at retrieval time and PII tooling

**[FAST-MOVING, April 2026]** The Thoughtworks Technology Radar Volume 34 of April 2026 lists "role-based contextual isolation in RAG", meaning access control enforced at retrieval time through chunk metadata, in Assess ([Thoughtworks Radar Vol 34, Apr 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). **[FAST-MOVING, November 2026]** Presidio, a library for detecting and anonymising personal data, appears in Trial on Radar Volume 35 of November 2026; the text read did not describe it further ([Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf)).

### Minimum governance kit for a small EU SaaS company

**[INFERENCE]** A minimum governance kit for a small EU SaaS company is a catalogue entry for every gold dataset carrying owner, steward, classification (public, internal, confidential, personal, special-category), legal basis and purpose, retention period and service level, with tag-driven access so that columns tagged personal are denied by default. No single source states this kit.

**[INFERENCE]** Master data for a SaaS company usually reduces to one golden record each for account and user, with stable surrogate keys shared across billing, CRM and product. No source reviewed covers master data management.

### Gaps in the governance evidence

**[GAP]** No source was read on retention scheduling, master data management, stewardship role definitions, Amazon DataZone or SageMaker Catalog, or Gartner governance research (Gartner material was not retrieved at all). The Thoughtworks "data product thinking" Radar text was not read.
