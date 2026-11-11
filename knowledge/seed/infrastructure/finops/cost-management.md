---
id: infrastructure.finops.cost-management
department: infrastructure
domain: finops
title: 'IT infrastructure: Cost management (FinOps)'
summary: The 2026 FinOps Framework, State of FinOps 2026, AWS Savings Plans including the Database plan, tagging and allocation, and AI and GPU cost control.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
objectives:
- cost
sources:
- https://www.finops.org/insights/2026-finops-framework/
- https://focus.finops.org/
- https://www.finops.org/wg/finops-for-ai-overview/
- https://data.finops.org/
- https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html
- https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html
- https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html
- https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/building-your-tagging-strategy.html
related:
- infrastructure.handoffs.cross-department
seed_version: 1
---

**When to use this:** Before any spend decision, commitment purchase, tagging plan or AI and GPU cost control.

**Source section:** 10. Cost management (FinOps)

## 10. Cost management (FinOps)

### The FinOps Framework 2026 covers all technology spend

**[FAST-MOVING, 19 Mar 2026]** The FinOps Framework 2026 was published on 19 March 2026, with the mission reworded to cover the value of technology and not only cloud. It adds one capability, Executive Strategy Alignment (executive priority alignment, multi-year investment strategy, product prioritisation, strategic decision support), in the Manage the FinOps Practice domain. Six capabilities were renamed to be technology-neutral: Usage Optimization (formerly Workload Optimization); Governance, Policy and Risk; Automation, Tools and Services; KPI and Benchmarking; Architecting and Workload Placement (formerly Architecting for Cloud); and Sustainability (formerly Cloud Sustainability). A new Technology Categories section lists Public Cloud, SaaS, Data Center, Data Cloud Platforms and AI, and scopes are redefined as spend segments aligned to business constructs, started from a business question ([FinOps Foundation: 2026 Framework](https://www.finops.org/insights/2026-finops-framework/)).

**[FAST-MOVING, Oct 2026]** FOCUS, the billing-data specification, is at version 1.4 and now spans AI, cloud, SaaS and data-centre billing; AWS, Azure and Google Cloud are listed as generating version 1.2 data ([FOCUS](https://focus.finops.org/)). Version 1.5 is scheduled for ratification in December 2026 and is expected to add model identity and token labels ([FinOps for AI overview, updated 28 Oct 2026](https://www.finops.org/wg/finops-for-ai-overview/)).

### State of FinOps 2026: AI and SaaS spend are now in scope

**[FAST-MOVING, 2026]** The State of FinOps 2026 survey (1,192 respondents representing more than $83 billion in annual cloud spend; 35% from EMEA) reports that 98% manage AI spend, up from 63% in 2025 and 31% in 2024; FinOps for AI is the top forward-looking priority and AI cost management the top skill to add; and many teams are asked to fund AI from optimisation savings. On scope, 90% manage or plan to manage SaaS (65% in 2025), licensing 64%, private cloud 57% and data centre 48%, while workload optimisation and waste reduction remains the top current priority ([State of FinOps 2026](https://data.finops.org/)).

**[FAST-MOVING, 2026]** In the same survey, 78% of FinOps teams report into the CTO or CIO and 8% into the CFO; 60% use centralised enablement and 21% hub-and-spoke; teams with engagement at vice-president level or above show two to four times more influence on technology selection, though the report gives inconsistent comparison figures between sections; and pre-deployment architecture costing is a top tooling request ([State of FinOps 2026](https://data.finops.org/)). **[GAP]** The survey's publication date was not shown on the page.

### AWS Savings Plans, including the Database plan

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** AWS Savings Plan types and their maximum discounts against On-Demand are in the table below. Terms are one or three years with all-upfront, partial-upfront or no-upfront payment; the commitment is a dollar-per-hour amount and cannot be changed after purchase. The overview page's headline "up to 72%" corresponds to the EC2 Instance plan ([Savings Plans: plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html); [Savings Plans overview](https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html)).

| Plan | Maximum discount (as documented 2026) | Coverage | Source |
|---|---|---|---|
| Compute | Up to 66% | EC2 of any family, size, Region, OS or tenancy, plus Fargate and Lambda | [Plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html) |
| EC2 Instance | Up to 72% | One instance family in one Region | [Plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html) |
| SageMaker AI | Up to 64% | SageMaker AI usage | [Plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html) |
| Database | Up to 35% | Aurora, RDS, DynamoDB, ElastiCache, DocumentDB, Timestream, Neptune, Keyspaces, DMS, OpenSearch Service; any engine, family, size or Region; latest instance generations and serverless | [Plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html) |

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** Compute and EC2 Instance Savings Plans cover the EC2 instances behind EKS, ECS and EMR but not the EKS cluster fee ([Savings Plans: plan types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html)). EKS extended support, the 12 months after the 14-month standard window, is on by default and carries an extra per-cluster-hour charge ([EKS Kubernetes version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)).

**[INFERENCE]** A commitment approach for a growing SaaS company: cover a conservative baseline (for example the lowest hourly spend of the past 30 to 60 days) with no-upfront one-year Compute and Database Savings Plans, add small purchases monthly or quarterly instead of one large buy, and reserve EC2 Instance plans and three-year terms for provably stable fleets. Target coverage and utilisation figures were not sourced, so any numbers are house policy. Database Savings Plans are directly relevant to an estate that includes Neptune, OpenSearch, Aurora and DynamoDB because one commitment floats across them and across Regions, but the 35% ceiling is lower than the compute plans, so rightsizing and serverless or auto-pause settings come first.

**[INFERENCE]** The order of operations is allocate (accounts as the primary cost boundary, tags second), remove waste, rightsize, and only then commit; committing first locks in waste. This sequencing is common FinOps practice consistent with the framework's capabilities, but the ordering is the researchers' synthesis.

### Tagging and allocation

**[DURABLE] [PLATFORM CLAIM]** AWS frames tagging strategy as iterative, starting from the most pressing use case, with named owners for defining and maintaining the scheme through a policy, a RACI or a shared-responsibility model ([AWS tagging best practices](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/building-your-tagging-strategy.html)).

**[INFERENCE]** Unit economics for a SaaS company: cost per active customer or tenant, per 1,000 requests, per GB stored and per successful AI outcome, tracked as a trend against revenue per customer. A multi-account structure makes per-product allocation simple; per-tenant allocation needs application-level metering.

### AI and GPU cost control

**[FAST-MOVING, 28 Oct 2026]** The FinOps Foundation's AI guidance (updated 28 October 2026) names the cost drivers: billed tokens exceed user input because of system prompts, history and retrieved context; idle GPUs and unused provisioned throughput; volatile model pricing; runaway usage from agent loops or prompt changes; cross-region data transfer; and capacity scarcity. Its unit metrics are cost per inference, cost per million tokens, cost per successful outcome, GPU utilisation (used divided by provisioned), cache hit rate, anomaly cost share and "model fit" (the share of requests sent to an over-qualified model), reported as distributions because per-run cost varies ([FinOps for AI overview](https://www.finops.org/wg/finops-for-ai-overview/)).

**[FAST-MOVING, 28 Oct 2026]** The FinOps Foundation's AI cost levers are the cheapest model that meets the quality bar plus routing; shorter prompts, output caps, history trimming, prompt caching and batching; autoscaling and shutting down idle GPUs; spot capacity with checkpointing for training and batch; co-locating data and compute; committing only after usage is understood; and modelling break-even utilisation before buying provisioned capacity. For allocation, tag training versus inference and production versus experimentation separately, use one API key per team, application or cost centre (with a proxy where tags are unsupported), and prefer showback before chargeback; example tag keys are Project, Environment, Workload, Team, CostCenter, Purpose, Criticality and ShutdownEligible ([FinOps for AI overview](https://www.finops.org/wg/finops-for-ai-overview/)).

**[INFERENCE]** Cost guardrails for the department's agents: budgets and anomaly alerts per account, token-per-minute alarms per API key, hard spend caps on experimentation accounts, and a rule that agents may not purchase commitments without human approval, because a Savings Plan commitment cannot be changed after purchase.

### Gaps in this section

**[GAP]** Not sourced: benchmarks for good commitment coverage, utilisation, waste percentage or tag coverage; Reserved Instance versus Savings Plan trade-offs and the RI marketplace; the launch date of Database Savings Plans; current return or exchange rules; Compute Optimizer and Cost Optimization Hub capabilities; Graviton and Spot savings benchmarks; cost-allocation tag mechanics; split cost allocation for EKS; Bedrock pricing modes and GPU capacity reservations; and the total capability and domain counts of the 2026 Framework.
