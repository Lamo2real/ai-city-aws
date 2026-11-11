---
id: data.architecture.iceberg-lakehouse
department: data
domain: architecture
title: 'Data and AI: Data architecture'
summary: 'Data architecture in 2026: Apache Iceberg v3 lakehouse with one catalogue, Delta Lake for Databricks-first teams, the AWS reference architecture, bronze/silver/gold layering, batch by default and streaming only for a stated freshness need, ELT as the default.'
type: principle
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- sagemaker
- dbt
- iceberg
- snowflake
- databricks
- bigquery
objectives:
- data-platform
sources:
- https://datalakehousehub.com/blog/iceberg-market-2026
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://joereis.github.io/practical_data_data_eng_survey
- https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/
- https://docs.databricks.com/aws/en/lakehouse/medallion
- https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview
- https://aws.amazon.com/compare/kinesis-and-msk/
- https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-considerations.html
- https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-destination.html
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before choosing a table format, catalogue, storage layout, layering, or batch versus streaming for a data platform.

**Source section:** 1. Data architecture: an Iceberg lakehouse with one catalogue is the 2026 default

### Apache Iceberg version 3 is the interoperable table format

**[FAST-MOVING, mid-2026]** Apache Iceberg is the table format to choose for new interoperable builds. A mid-2026 market overview reports that the format is at version 3 and that the Java library Apache Iceberg 1.11 shipped in May 2026; version 3 adds deletion vectors that replace positional delete files, row lineage with stable row IDs that survive compaction, a native variant type for semi-structured data, and geometry and geography types ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). The same overview reports Iceberg v3 as generally available in Snowflake and in Databricks Unity Catalog, Google BigLake managed Iceberg tables as generally available, and Microsoft OneLake serving Delta tables as Iceberg through Apache XTable ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). This is a secondary practitioner source, not vendor documentation.

**[FAST-MOVING, mid-2026]** Iceberg version 4 is not released and no v4 table setting exists as of mid-2026. The settled items are relative paths in metadata and content statistics; single-file commits and an adaptive metadata tree, both aimed at cutting the cost of frequent commits, are in development; partition tuples and column-level updates remain contested ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). Do not plan a platform around v4 features.

**[FAST-MOVING, April 2026]** The Thoughtworks Technology Radar Volume 34 of April 2026 places Apache Iceberg in Adopt, the semantic layer in Trial, and DuckLake (SQL-catalogue metadata plus Parquet with the DuckDB engine) in Assess ([Thoughtworks Radar Vol 34, Apr 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). The Radar is consultancy opinion, useful as a maturity signal and not as measured evidence.

### Delta Lake remains reasonable for Databricks-first organisations

**[FAST-MOVING, mid-2026]** Delta Lake continues in its own ecosystem. Databricks bought Tabular, the company of Iceberg's founders, in 2024, and Delta and Iceberg convergence work followed inside Unity Catalog; external-engine write access to Unity Catalog managed Delta tables reached public preview at the Data and AI Summit 2026; and "OpenSharing", a Delta Sharing successor under the Linux Foundation that adds Iceberg REST clients as recipients, was announced on 10 June 2026 ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). **[INFERENCE]** Choose Iceberg over Delta for a new AWS-native build because every major engine now reads and writes it; Delta remains a sound choice where the organisation is Databricks-first. **[GAP]** The 2026 status of Delta Lake UniForm was not confirmed by any fetched source.

### The catalogue, not the file format, is where lock-in now sits

**[FAST-MOVING, mid-2026]** The contested layer has moved from the table format to the catalogue. Apache Polaris was donated to the Apache Software Foundation in August 2024, reached 1.0 in summer 2025 and 1.3.0 in January 2026, and became a Top-Level Project on 18 February 2026; the Unity Catalog core is open source; AWS Glue gained federation to remote Iceberg catalogues with Lake Formation enforcing permissions; S3 Tables provides built-in Iceberg maintenance and later added sort and z-order compaction, replication and intelligent tiering; other options are Lakekeeper, Apache Gravitino and Project Nessie ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). The same source notes that catalogue competition has shifted to governing data, models and agents together, with Unity Catalog leading that framing ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)). **[INFERENCE]** Pick a catalogue that exposes the Iceberg REST API so that engines can be swapped without migrating metadata.

**[FAST-MOVING, January 2026]** A small practitioner survey from January 2026 (multi-select; sample size not stated, so indicative only) reported Iceberg catalogue usage of 39.3% for AWS Glue, 28.6% for Nessie, 25% for S3 Tables, 21.4% for Polaris, 21.4% for Lakekeeper and 17.9% for Hive Metastore ([Data Lakehouse Hub, mid-2026](https://datalakehousehub.com/blog/iceberg-market-2026)).

### What storage environments and architectures teams actually run

**[FAST-MOVING, December 2025 to January 2026]** The Practical Data Community's 2026 State of Data Engineering Survey (self-selected sample of 1,101, fielded December 2025 to January 2026, skewed to senior practitioners) found storage environments of 43.8% cloud data warehouse, 26.8% lakehouse, 11.7% mixed or hybrid, 9.4% on-premises warehouse and 4.3% cloud Postgres or MySQL, and architecture preferences of 40.1% centralised warehouse, 34.6% lakehouse, 16.2% data mesh or federated and 6.8% event-driven ([Practical Data Community 2026 survey](https://joereis.github.io/practical_data_data_eng_survey)). A centralised warehouse or lakehouse is therefore the mainstream choice and a mesh is a minority one.

### AWS reference architecture: combine lake and warehouse under one catalogue

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** AWS's own guidance for the SageMaker lakehouse, published on the AWS Big Data Blog in January 2026, is to combine a lake and a warehouse and not to pick one. The lakehouse is built on Apache Iceberg, the AWS Glue Data Catalog and Lake Formation ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** AWS describes three storage choices for a lakehouse. Use general-purpose S3 with self-managed Iceberg when the team needs full control of compaction and garbage collection and has strong in-house engineering; the team then pays for storage, requests and maintenance compute, and performance degrades without scheduled maintenance. Use S3 Tables when managed compaction, snapshot management and orphan-file clean-up are wanted, accepting no control over when or how compaction runs. Use Redshift Managed Storage for high-concurrency BI, predictable performance service levels and join-heavy SQL ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** AWS describes three ingestion choices. Use traditional ETL for complex transformation, curated datasets, historical migration and enforced quality. Use zero-ETL, which replicates inserts, updates and deletes by change data capture into Redshift, S3 Iceberg or S3 Tables, for low-operations near-real-time replication; light transforms may still be needed on the target. Use federation for occasional queries on live sources, where performance depends on network latency, source capacity and predicate pushdown ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** On the AWS catalogue, the existing account-level Glue Data Catalog becomes the default managed catalogue without migration; federated catalogues mount Redshift, Snowflake, DynamoDB and other sources without moving data; and the Redshift hierarchy of namespace, database and schema is mapped into the lakehouse metadata layer ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[PLATFORM CLAIM] [FAST-MOVING, January 2026]** On engines, open-source Spark and EMR reach Iceberg metadata through the Glue Iceberg REST endpoint and run self-managed table maintenance; Athena can query federated Redshift storage through the Lake Formation credential flow; and AWS advises keeping join-heavy workloads on Redshift data inside Redshift because external engines can cost more when pushdown is unsupported ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

**[INFERENCE]** Default architecture for a Sweden-based SaaS company on AWS, derived from the AWS guidance above: land raw data as Iceberg in S3 (S3 Tables unless the team needs compaction control), catalogue it in Glue, govern it with Lake Formation, transform it with dbt on Athena or Redshift, and serve BI from Redshift, or from Athena if concurrency is low. Use zero-ETL or change data capture from the product's operational database before building custom ingestion. **[GAP]** Availability of S3 Tables and the SageMaker lakehouse in eu-north-1 (Stockholm) was not verified; check per service before committing.

### Layering: bronze, silver, gold and the dbt equivalent

**[PLATFORM CLAIM] [DURABLE]** Databricks documents the medallion architecture as bronze (raw), silver (validated) and gold (enriched), and calls it recommended but not required. Bronze is append-only with full history and minimal validation, stores most fields as string, VARIANT or binary plus provenance metadata, and is not for analyst access. Silver is built only from bronze, is cleaned, deduplicated and schema-enforced, holds at least one validated non-aggregated representation of each record, and handles late and out-of-order data. Gold is business-aligned, dimensionally modelled, aggregated and performance-tuned, and several gold layers per domain are acceptable ([Databricks docs, medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)).

**[PLATFORM CLAIM] [DURABLE]** Land raw and change-data-capture feeds in bronze unchanged before validating them into silver. Databricks warns that writing from ingestion straight to silver risks failures from schema changes or corrupt records ([Databricks docs, medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)).

**[PLATFORM CLAIM] [DURABLE]** dbt Labs' equivalent layering is staging (source-conformed building blocks), intermediate (purpose-specific logic) and marts (business-conformed entities), with the goal that each transformation is applied in only one place ([dbt docs, How we structure our dbt projects](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview)).

### Batch by default; streaming only for a stated freshness need

**[PLATFORM CLAIM] [DURABLE]** Databricks orders ingestion modes by cost and latency: continuous ingestion has the highest cost and lowest latency, triggered ingestion costs less, and manual incremental batch has the lowest cost and highest latency and needs sources partitioned by a datetime field ([Databricks docs, medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion)). **[INFERENCE]** Choose batch by default and adopt streaming only where a consumer has a stated freshness need below the batch interval; this follows from the cost ordering and is not a quoted rule.

**[VENDOR] [FAST-MOVING, 5 November 2026]** AWS's own comparison page, updated 5 November 2026, positions Kinesis Data Streams as the AWS-native choice for real-time ingestion, with each shard giving 1 MB/s in and 2 MB/s out and pricing per shard-hour plus PUT payload units. It positions Amazon MSK as managed Apache Kafka for teams that need Kafka compatibility with existing tooling such as Kafka Connect, Schema Registry and KSQL, priced per broker-hour plus storage, with MSK Serverless removing broker sizing. It describes Firehose as zero-administration delivery into S3 or Redshift without managing consumers ([AWS, Kinesis and MSK comparison, 5 Nov 2026](https://aws.amazon.com/compare/kinesis-and-msk/)).

**[INFERENCE]** Decision rule for streaming on AWS, consistent with AWS's framing: choose Kinesis Data Streams plus Firehose-to-Iceberg when the producers are the company's own services and nobody needs Kafka APIs; choose MSK when the team runs Debezium or Kafka Connect change data capture, needs Kafka-native consumers, or wants portability. If MSK is chosen and Firehose-to-Iceberg is wanted, use provisioned MSK, because MSK Serverless is not a supported Firehose source for Iceberg ([Firehose, Iceberg considerations](https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-considerations.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Data Firehose delivers to Iceberg tables in S3, either self-managed or in S3 Tables. One stream can route records to several tables based on record content, can apply insert, update and delete operations, and supports Lake Formation table-level and column-level permissions; for self-managed tables the customer handles compaction and snapshot expiry ([Firehose, Iceberg destination](https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-destination.html)). Only the introduction of that page was read.

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Firehose-to-Iceberg limits as documented by AWS in November 2026: the feature is available in all regions except China, GovCloud, Taipei, Malaysia, New Zealand and Mexico; sources are Direct PUT, Kinesis Data Streams and provisioned MSK, not MSK Serverless; tables must be created through Iceberg's GlueCatalog API; database and table names cannot contain hyphens; and the Iceberg library version is 1.5.2 ([Firehose, Iceberg considerations](https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-considerations.html)). **[INFERENCE]** Stockholm support is implied by the exclusion list and is not an explicit AWS statement.

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Firehose-to-Iceberg throughput: Direct PUT caps at 5 MiB/s per stream in N. Virginia, Oregon and Ireland and at 1 MiB/s elsewhere; setting `AppendOnly=True` (insert-only, set through the API) lets the stream scale, and limit increases can be requested. Active-partition ceilings fall as throughput rises: about 3,000 at up to 20 MB/s, 1,000 at 20 to 40 MB/s, and 100 at 40 to 400 MB/s ([Firehose, Iceberg considerations](https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-considerations.html)). **[INFERENCE]** In eu-north-1 the 1 MiB/s default is low for a clickstream; set `AppendOnly` for event data or request a limit increase before launch.

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Firehose-to-Iceberg behaviour to design around: each record must be one JSON object or it goes to the S3 error bucket; column names and types must match the table exactly; extra source fields are skipped; updates are written as a delete file plus an insert; AWS advises against several streams writing one table because commits use optimistic concurrency one at a time; and small files are controlled with Glue automatic compaction or Athena `OPTIMIZE` and `VACUUM` ([Firehose, Iceberg considerations](https://docs.aws.amazon.com/firehose/latest/dev/apache-iceberg-considerations.html)).

**[FAST-MOVING, November 2026]** The Thoughtworks Technology Radar Volume 35 of November 2026 places Kafka share groups (queue-style consumption with at-least-once delivery) in Trial and the durable-execution platforms Temporal and Restate in Trial ([Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf)). This is consultancy opinion.

### ELT is the assumed default; classic ETL is the exception

**[INFERENCE]** Load raw data and transform it in the warehouse with dbt (ELT) by default. Every dbt and medallion source reviewed assumes this pattern, and no 2026 source reviewed argued for classic ETL except where complex pre-load transformation or enforced quality is needed, which is AWS's wording for when traditional ETL fits ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)).

### Gaps in the architecture evidence

**[GAP]** Not fetched: AWS prescriptive guidance for Iceberg file sizes, snapshot retention and copy-on-write versus merge-on-read (https://docs.aws.amazon.com/prescriptive-guidance/latest/apache-iceberg-on-aws/best-practices.html), so this document gives no numeric Iceberg tuning thresholds. Also not read: AWS's streaming decision guide and streaming whitepaper, Kinesis retention limits and on-demand mode, MSK Express brokers, Firehose schema evolution and delivery semantics, any primary Snowflake or BigQuery reference architecture, and EMR or Glue job sizing. Snowflake and BigQuery statements in this section rest on one secondary market overview.
