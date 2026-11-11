---
id: data.quality.tests-slos-owners
department: data
domain: quality
title: 'Data and AI: Data quality and observability'
summary: 'Data quality and observability: the six quality dimensions, the minimum test bar per layer, freshness and correctness SLOs, AWS Glue Data Quality rules, OpenLineage lineage, experiment-data checks and handling data incidents like software incidents.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
- dbt
- iceberg
- databricks
objectives:
- data-platform
sources:
- https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance
- https://joereis.github.io/practical_data_data_eng_survey
- https://www.gov.uk/government/news/meet-the-data-quality-dimensions
- https://dama.org/about-dama/what-is-data-management/
- https://docs.getdbt.com/best-practices/best-practice-workflows
- https://docs.getdbt.com/docs/mesh/govern/model-contracts
- https://docs.databricks.com/aws/en/lakehouse/medallion
- https://sre.google/workbook/data-processing/
- https://bitol.io/bitol-announces-odcs-v3-1-0-stronger-smarter-and-stricter/
- https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity
- https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html
- https://docs.aws.amazon.com/glue/latest/dg/dqdl.html
- https://openlineage.io/docs/
- https://arxiv.org/pdf/2212.11366.pdf
- https://docs.aws.amazon.com/athena/latest/ug/workgroups-setting-control-limits-cloudwatch.html
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before setting data tests, quality rules, freshness or correctness SLOs, lineage, alerting or a data incident process.

**Source section:** 4. Data quality and observability: tests at build time, SLOs end to end, named owners

### Trust is the fastest-rising priority and ownership is the obstacle

**[VENDOR] [FAST-MOVING, 14 April 2026]** Trust in data rose from 66% in 2025 to 83% in 2026 as an organisational priority, the largest one-year rise of any objective in dbt Labs' vendor survey (n=363, press release 14 April 2026); ambiguous data ownership is cited by 41%, while technical integration problems fell from 35% to 27% ([dbt Labs press release, 14 Apr 2026](https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance)).

**[FAST-MOVING, December 2025 to January 2026]** Firefighting consumes significant time for 26.2% of teams in the Practical Data Community survey (n=1,101), and the top bottlenecks are legacy systems and technical debt at 25.4%, lack of leadership direction at 21.3% and poor requirements or upstream issues at 18.8% ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)).

### The six data quality dimensions

**[DURABLE]** The six data quality dimensions are DAMA UK's, as relayed by the UK Government Data Quality Hub (published 24 June 2021, page updated March 2026, read by machine extraction): accuracy (data reflects reality), completeness (all data needed for a given use is present), uniqueness (a record appears once), consistency (values do not conflict within a record or across datasets), timeliness (data is available when expected and needed) and validity (data conforms to the expected format, type and range) ([Government Data Quality Hub](https://www.gov.uk/government/news/meet-the-data-quality-dimensions)). This is DAMA UK's list, not text from the paid DMBOK2 book.

**[DURABLE]** How to use the quality dimensions, per the same UK government page: one dimension is never enough; choose the dimensions that describe fitness for the intended use; identify the critical data items and measure those; measure regularly because data changes; and note that statistical outputs may suit the European Statistical System's quality dimensions better ([Government Data Quality Hub](https://www.gov.uk/government/news/meet-the-data-quality-dimensions)).

**[DURABLE]** DAMA International defines data management as developing, executing and supervising the plans, policies, programmes and practices that deliver, control, protect and enhance the value of data across its lifecycle, and data quality is one of 11 DMBOK knowledge areas ([DAMA International](https://dama.org/about-dama/what-is-data-management/)).

### Minimum test bar and quality by layer

**[PLATFORM CLAIM] [DURABLE]** The minimum test bar in dbt is a primary key on every model tested for uniqueness and non-null. dbt data tests report the number of failing rows and support severity thresholds and `store_failures`, and contracts fail the build on shape violations ([dbt docs, Best practice workflows](https://docs.getdbt.com/best-practices/best-practice-workflows); [dbt docs, Model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts)).

**[PLATFORM CLAIM] [DURABLE]** Quality expectations differ by layer in the Databricks medallion guidance: bronze prioritises completeness and fidelity, silver is validated, deduplicated and schema-enforced, and gold is curated and performance-tuned ([Databricks docs, medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)).

### Data SLOs: freshness and correctness, measured end to end

**[DURABLE]** Google's SRE workbook gives three wordings for a data freshness objective: a percentage of data processed within a time, the oldest data being no older than a time, or a job completing within a time. Its worked example is 99% of score-affecting user actions visible within 30 minutes ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)). The chapter predates 2024 and the figures are illustrations, not benchmarks.

**[DURABLE]** For a data correctness objective, Google's SRE workbook advises building "golden" data, such as test accounts with known expected output, comparing pipeline output to it and alerting past a threshold. Its example backward-looking target is at most 0.1% of invoices wrong per quarter, and it advises also tracking how long bad data was served ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)).

**[DURABLE]** Measure data SLOs end to end and not per stage. Google's example is a field added upstream and silently dropped downstream, which leaves every stage looking healthy while users see nothing; the workbook also advises planning for the worst failure that each dependency's service level permits ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)).

**[DURABLE]** Google's SRE workbook offers a pipeline maturity matrix that scores failure tolerance, scalability, monitoring and debugging, ease of implementation and transparency, and testing from 1 (chaotic) to 5 (continuous improvement) ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)).

**[INFERENCE]** An SLO card for each tier-1 dataset can be worded from the SRE forms: a freshness line ("99% of events queryable within N minutes"), a correctness line ("at most X% of rows fail golden-data comparison per quarter"), and "hours of bad data served" as the incident measure, plus completeness (row count within an agreed band of the trailing average), validity (zero failing rows on primary-key and not-null tests) and time-to-detect and time-to-resolve targets. The values are to be calibrated locally; Google's 99%, 30 minutes and 0.1% are illustrations ([Google SRE Workbook, data processing](https://sre.google/workbook/data-processing/)).

**[FAST-MOVING, December 2025]** ODCS expresses service levels for latency, availability and freshness and quality rules inside the data contract, and v3.1.0 of December 2025 lets those checks run on a cron or interval ([Bitol, ODCS v3.1.0 announcement](https://bitol.io/bitol-announces-odcs-v3-1-0-stronger-smarter-and-stricter/)). **[VENDOR]** Thoughtworks reports on 16 January 2026 that contracts, SLO definitions and data-quality dashboards are now common in mature data-product organisations, and that lineage and catalogue entries with ownership are expected per product ([Thoughtworks, State of data mesh in 2026](https://www.thoughtworks.com/insights/blog/data-strategy/the-state-of-data-mesh-in-2026-from-hype-to-hard-won-maturity)).

### AWS Glue Data Quality and its rule language

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** AWS Glue Data Quality is serverless, built on open-source Deequ, with rules written in the Data Quality Definition Language (DQDL). It has two entry points: the Data Catalog, for governance checks on tables at rest through the console or API, and Glue ETL jobs, for checks in the pipeline before load ([AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** The AWS Glue data quality score is the percentage of rules in a ruleset that pass. Documented limits are 2,000 rules per ruleset, a 65 KB ruleset size, and 100,000 statistics per account kept for up to two years; rules cannot evaluate nested or list columns, which must be flattened first ([AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** AWS Glue Data Quality capabilities split between the two paths: rule recommendations exist only for the Data Catalog (an ADVANCED mode uses Amazon Bedrock with table metadata and sampled rows); record-level identification of failing rows exists only in ETL jobs; anomaly detection, generally available since 7 August 2024, learns from statistics over time; and rule labels and constants were added on 21 November 2025 ([AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Supported sources for AWS Glue Data Quality in the Data Catalog path include S3, Redshift, JDBC sources, Iceberg, Hudi, Delta Lake and Athena views; S3 Tables and lakehouse Iceberg tables were added on 7 July 2025, and cross-account and nested Athena views on 18 September 2026. Results integrate with EventBridge and CloudWatch and are written to S3 ([AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** DQDL rule types include `IsComplete`, `Completeness`, `IsPrimaryKey`, `IsUnique`, `Uniqueness`, `RowCount`, `RowCountMatch`, `ColumnCount`, `ColumnExists`, `SchemaMatch`, `ColumnValues`, `ColumnDataType`, `ColumnLength`, `Mean`, `Sum`, `StandardDeviation`, `Distribution`, `ReferentialIntegrity`, `DatasetMatch`, `AggregateMatch`, `DataFreshness`, `CustomSql`, `DetectAnomalies`, and the file rules `FileFreshness` and `FileSize` ([DQDL reference](https://docs.aws.amazon.com/glue/latest/dg/dqdl.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** A DQDL ruleset template worth keeping is shown below. In DQDL, `with threshold` works only with `ColumnValues`, `ColumnDataType` and `CustomSql`; dynamic rules that use `last(k)` run only in Glue ETL, and `last(k)` with k above 1 must be wrapped in an aggregate; analyzers collect statistics without asserting and are not available in the Data Catalog path ([DQDL reference](https://docs.aws.amazon.com/glue/latest/dg/dqdl.html)).

```
Rules = [
    IsPrimaryKey "order_id",
    RowCount > avg(last(10)),
    ColumnValues "status" in ["A","B"] with threshold > 0.8,
    ColumnValues "load_date" > (now() - 3 days),
    (IsComplete "id") and (IsUnique "id")
]
```

**[INFERENCE]** On AWS a sensible split is DQDL rules inside Glue ETL for gates that stop a load, because dynamic thresholds and failing-row capture only work there, and Data Catalog rulesets for scheduled monitoring of gold tables ([AWS Glue Data Quality](https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html)).

### Lineage with OpenLineage

**[FAST-MOVING, docs version 1.55.0]** OpenLineage is an open lineage standard with three core entities (dataset, job and run), each consistently named and enriched by "facets", which are atomic pieces of metadata attached to an entity. The specification is defined in OpenAPI and is extensible with custom facets; it is a Graduate project of the LF AI & Data Foundation; listed integrations are Airflow, Flink, Hive, Spark, dbt, Feast, Great Expectations, SQL and Trino; and Marquez is the reference implementation ([OpenLineage docs, v1.55.0](https://openlineage.io/docs/)). **[GAP]** OpenLineage run-state event types are on the Object Model page, which was not read.

### Experiment data and operational alerting as quality checks

**[DURABLE]** A/A tests and sample-ratio-mismatch checks are standard data-quality checks for experiment data, according to a peer-reviewed review of online controlled experiments ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)). **[PLATFORM CLAIM]** For operational alerting on AWS, Athena exposes CloudWatch metrics, such as failed queries, on which alarms can be set ([Athena docs, data usage control limits](https://docs.aws.amazon.com/athena/latest/ug/workgroups-setting-control-limits-cloudwatch.html)).

### Data incidents handled like software incidents

**[INFERENCE]** Treat data incidents like software incidents: severity levels, a named incident owner, a stakeholder notice on the affected dashboards, and a blameless review that ends in a new test or contract clause. No fetched source specifies this for data; it mirrors SRE practice.

### Gaps in the data quality evidence

**[GAP]** No benchmark was found for data downtime, incident counts or typical SLO targets; vendor "data downtime" figures were not reviewed and must be treated as vendor claims if used. The 11 DMBOK knowledge areas as a list and the status of the "DAMA-DMBOK 3.0 Project" listed on dama.org were not obtained ([DAMA International](https://dama.org/about-dama/what-is-data-management/)).
