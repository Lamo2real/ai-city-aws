---
id: application.ci-cd.ci-cd-and-release
department: application
domain: ci-cd
title: 'Application: CI/CD: one automated path, small first exposure, automatic rollback'
summary: 'CI/CD: the four-phase pipeline, pre-production stages, the path to production and agent pipeline responsibility,
  progressive delivery (one-box, waves, bake times), rollback rules and deployment windows, rollback during a schema change,
  DORA 2025 delivery benchmarks, CircleCI CI-health benchmarks and preview environments.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- github
- aws
objectives:
- ship
- reliability
sources:
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://dora.dev/capabilities/test-automation/
- https://12factor.net/
- https://www.thoughtworks.com/radar/techniques
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
- https://martinfowler.com/bliki/ParallelChange.html
- https://dora.dev/capabilities/database-change-management/
- https://dora.dev/guides/dora-metrics/
- https://circleci.com/blog/five-takeaways-2026-software-delivery-report
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
related: []
seed_version: 1
---

**When to use this:** When building or changing a pipeline, planning a release or rollout, or deciding when and how to roll back.

**Source section:** 5. CI/CD: one automated path, small first exposure, automatic rollback

### Pipeline shape: four phases and one pipeline per change type

**[VENDOR]** Amazon's deployment pipelines have four phases (source, build, test, production) and a separate pipeline for each change type (application code, infrastructure, operating-system patches, configuration and feature flags, operator tools), each with the same safety mechanisms including automatic rollback. Builds run without network access for reproducibility, artifacts are signed, and packages are immutable and checksummed so that a rollback restores a known-good artifact ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). The article's date was not captured, and the researchers believe it predates 2024, so its structure is durable and its timings are Amazon-specific.

### Pre-production stages

**[VENDOR]** Amazon's pre-production stages are alpha and beta, which run functional API and end-to-end tests, and gamma, which is as production-like as possible with the same configuration, alarms and canary tests; integration tests call real dependencies and include negative cases ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). **[DURABLE]** DORA wants all suites run on every pipeline trigger in the order unit and static analysis, then acceptance and non-functional, then manual exploration ([DORA test automation](https://dora.dev/capabilities/test-automation/)), and twelve-factor asks for strict separation of build, release and run with development, staging and production kept as similar as possible ([12factor.net](https://12factor.net/)).

### Path-to-production mapping and agent pipeline responsibility

**[FAST-MOVING, Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) places path-to-production mapping in Adopt, meaning a workshop that traces the whole delivery path to find bottlenecks beyond coding speed, and places agent pipeline responsibility, where agents are held accountable for keeping the build green, in Assess ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).

### Progressive delivery: Amazon's one-box, waves and bake times

**[VENDOR]** Amazon's rollout pattern starts with a one-box stage that takes at most about 10% of traffic with alarms scoped to that box, then proceeds in waves of growing size, one availability zone or cell at a time, with rolling batches replacing at most 33% of hosts. Rollback is automatic on a team-level aggregate alarm covering fault rate, latency percentiles, resource use and canary tests. Bake time is about 1 hour after the one-box stage, at least 12 hours after the first regional wave and 2 to 4 hours after later waves, and promotion requires a minimum number of data points ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). A typical Amazon pipeline takes about four to five business days to reach all regions because of bake times, and urgent fixes may shorten bake time only with senior review and manual monitoring ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

**[INFERENCE]** Amazon's multi-day, multi-region bake schedule is sized for a hyperscale blast radius. A single-region EU SaaS can keep the structure (production-like stage, small first exposure, alarm-gated promotion, automatic rollback) and compress the timings to minutes or hours; no source prescribing bake times for small systems was found. **[GAP]** No AWS-native progressive-delivery documentation (CodeDeploy, ECS, Lambda traffic shifting) was fetched.

### Rollback rules and deployment windows

**[VENDOR]** Amazon triggers rollback automatically from alarms, scopes one-box alarms to that box, allows rollbacks to replace hosts faster than a roll-forward, and blocks new production deployments while the high-severity alarm is firing. Deployments are limited to business hours, avoiding nights, weekends, holidays, Fridays and late afternoons so that on-call engineers are available, with a warning that very narrow windows cause changes to pile up ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). **[FAST-MOVING, Sep 2025]** DORA's 2025 report identifies frequent use of rollback as the version-control behaviour that amplifies team performance under AI adoption, and "fortify safety nets" is one of its recommendations to leaders ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf); [Google Cloud announcement, 23 Sep 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)).

### Rollback during a schema change

**[DURABLE]** Each expand, migrate and contract phase is separately releasable, which is what makes application rollback safe during a schema change ([ParallelChange, 13 May 2014](https://martinfowler.com/bliki/ParallelChange.html)); migrations themselves are numbered, tracked per instance and run by the same automated process as code ([DORA database change management](https://dora.dev/capabilities/database-change-management/)).

### Delivery benchmarks from DORA 2025

**[FAST-MOVING, Sep 2025]** The table below gives the DORA 2025 survey distributions (survey fielded 13 June to 21 July 2025, nearly 5,000 respondents, published 23 September 2025). DORA publishes distributions in 2025 and no longer publishes elite, high, medium and low cut-offs in the material extracted.

| Metric (DORA 2025, survey June to July 2025) | Distribution of respondents | Source |
|---|---|---|
| Deployment frequency | On demand 16.2%; hourly to daily 6.5%; daily to weekly 21.9%; weekly to monthly 31.5%; monthly to six-monthly 20.3%; less often than six-monthly 3.6% | [DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf) |
| Change lead time | Under one hour 9.4%; under one day 15%; one day to one week 31.9%; one week to one month 28.3%; one to six months 13.2%; over six months 2% | [DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf) |
| Failed deployment recovery time | Under one hour 21.3%; under one day 35.3%; one day to one week 28%; one week to one month 9.4%; longer 5.9% | [DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf) |
| Change fail rate | 0 to 2% for 8.5%; 2 to 4% for 8.1%; 4 to 8% for 19.6%; 8 to 16% for 26%; 16 to 32% for 19.5%; 32 to 64% for 12.5%; above 64% for 5.9% | [DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf) |

**[INFERENCE]** Reasonable department targets read off the 2025 distribution are to deploy at least daily (roughly the top 23% deploy daily or more often), keep lead time under one day (about the top quarter) and recover in under one hour (about the top fifth). These are positions in a survey distribution and not DORA-endorsed targets, and DORA warns against turning the metrics into goals ([DORA metrics guide](https://dora.dev/guides/dora-metrics/)). DORA's guide names reducing batch size as the common lever that improves all five delivery metrics ([DORA metrics guide](https://dora.dev/guides/dora-metrics/)).

### CI health benchmarks from CircleCI telemetry

**[VENDOR]** CircleCI's 2026 State of Software Delivery (blog of 18 February 2026, based on 28,738,317 workflows run on its platform in September 2025 from projects with at least two contributors) reports that main-branch success rate fell to 70.8% and typical time to return to green was 72 minutes, 13% longer than a year earlier; CircleCI's own stated benchmarks are a 90% success rate and 60-minute recovery ([CircleCI, 18 Feb 2026](https://circleci.com/blog/five-takeaways-2026-software-delivery-report)). Average daily workflow runs rose 59% year on year, but the median team rose 4%, the bottom quartile not at all, and the top 5% rose 97% ([CircleCI, 18 Feb 2026](https://circleci.com/blog/five-takeaways-2026-software-delivery-report)).

**[VENDOR]** The same CircleCI data (September 2025 workflows, published 18 February 2026) shows that for the median team feature-branch throughput rose 15% while main-branch throughput fell 7%; for a top-10% team feature-branch activity rose almost 50% and main-branch throughput 1%; only the top 5% converted activity into delivery, with main-branch throughput up 26%. Companies of 21 to 50 employees had the lowest throughput and recovery times near three hours, almost four times those of the smallest (2 to 5) and largest (1,000 or more) cohorts ([CircleCI, 18 Feb 2026](https://circleci.com/blog/five-takeaways-2026-software-delivery-report)).

**[INFERENCE]** Code generation is no longer the constraint; review, pipeline reliability and merge are. Track main-branch success rate (target 90%), time to green (target under 60 minutes) and main-branch throughput, and do not track feature-branch activity or pull-request counts. CircleCI attributes the changes to AI without a controlled comparison, and its figures cover its own platform only.

### Development environments and preview deployments

**[FAST-MOVING, Apr 2026]** Thoughtworks Radar Volume 34 (April 2026) has Dev Containers in Trial for isolated, reproducible development environments and pixel-streamed development environments in Caution ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). **[GAP]** No primary source on preview or ephemeral environments was read in any research pass. **[INFERENCE]** Preview deployments per pull request fit the parity and fast-feedback principles, but only when each preview gets isolated data and no production secrets; this is inference and not evidence.
