---
name: aws-well-architected
description: "Design and review AWS architectures against the AWS Well-Architected Framework's six pillars, using the AWS Knowledge connector for current guidance."
---
# AWS Well-Architected

Use for any AWS design, infrastructure change or review.

## Before you design
1. Look up current guidance with the **AWS Knowledge** connector (AWS docs, Well-Architected, regional availability, What's New). Never rely on memory for service limits, prices, regions or API shapes.
2. Write down the workload's requirements: users, data, availability target, recovery point and time, budget, compliance.

## The six pillars: check each, in this order of questions
- **Security**: least-privilege IAM (no `*` actions or resources without a reason written next to them), encryption at rest (KMS) and in transit (TLS 1.2+), no public buckets, secrets in Secrets Manager, CloudTrail on, guardrails before features.
- **Reliability**: multi-AZ for anything stateful, backups with a tested restore, timeouts and retries with backoff, dead-letter queues, quotas checked.
- **Operational excellence**: everything in code (Terraform), logs and metrics with alarms on what users feel, runbooks for the alarms.
- **Performance efficiency**: managed and serverless first (Lambda, Fargate, DynamoDB, Aurora Serverless), right-sized, caching where reads dominate.
- **Cost optimization**: tags on every resource (`Project`, `Environment`, `Owner`, `CostCenter`), Graviton/arm64 by default, lifecycle rules, budgets and alerts, nothing idle.
- **Sustainability**: fewest resources that meet the requirement; scale to zero when idle.

## Deliverable
A short design note: the choice, one alternative rejected and why, the pillar trade-offs, the estimated monthly cost, and the risks left open.
