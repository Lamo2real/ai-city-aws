---
id: infrastructure.change.change-management
department: infrastructure
domain: change
title: 'IT infrastructure: Change management'
summary: Why external approval boards slow delivery without reducing failures, the five delivery metrics, progressive deployment and Amazon's bake times, safeguards missing in the 2025 incidents, and a change policy template.
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
objectives:
- delivery
- reliability
sources:
- https://dora.dev/capabilities/streamlining-change-approval/
- https://dora.dev/guides/dora-metrics/
- https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW
- https://blog.cloudflare.com/5-december-2025-outage/
related:
- infrastructure.iac.infrastructure-as-code
- infrastructure.guardrails.agent-guardrails
cross_refs:
  '14':
  - infrastructure.itsm.it-service-management
  '18':
  - infrastructure.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** Before any production change: approval model, delivery metrics, progressive deployment and the change policy template.

**Source section:** 9. Change management

## 9. Change management

### External approval boards slow delivery without reducing failures

**[DURABLE]** DORA's research finds that approval by an external body such as a change advisory board or a senior manager has a negative effect on software delivery performance, with no evidence that more formal external review lowers change fail rates; heavy approval increases batch size, which raises risk. The DORA page cites the 2019 State of DevOps research and gives no effect sizes. Teams with a clearly understood approval process perform better even before simplifying it, and responding to incidents by adding approval steps creates a cycle of longer lead times and bigger batches ([DORA: streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)).

**[DURABLE]** DORA's recommended controls are peer review by someone other than the author, recorded in the development platform to satisfy segregation of duties; automated tests, continuous integration and monitoring to catch bad changes; risk-based extra scrutiny for high-risk changes; a normal process fast enough to serve as the emergency process; and change boards repurposed to cross-team coordination, process improvement and business trade-offs. Metrics to watch for the approval process are the share of changes needing manual approval by risk level, time spent waiting for approval, and team confidence in the process ([DORA: streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)).

### The five delivery metrics

**[FAST-MOVING, 5 Jan 2026]** DORA now defines five software delivery metrics (page updated 5 January 2026). Throughput is change lead time, deployment frequency and failed deployment recovery time; instability is change fail rate and deployment rework rate. Use them per service and never as targets, and reduce batch size to improve both groups ([DORA metrics guide](https://dora.dev/guides/dora-metrics/)). DORA's 2025 research finds AI adoption positively associated with throughput but negatively with delivery stability, so higher change volume needs strong automated testing, version control and fast feedback ([Google Cloud blog on the 2025 DORA report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)).

### Progressive deployment: Amazon's published numbers

**[DURABLE] [PLATFORM CLAIM]** Amazon's 2020 description of its pipelines gives these numbers: a one-box stage serves at most about 10% of a Region's or zone's traffic; rolling batches replace at most 33% of hosts so at least 66% stay healthy; bake time is at least 1 hour after each one-box stage, at least 12 hours after the first regional wave and 2 to 4 hours after later waves; bake can require a minimum request count (for example 100 calls to an API); deployment proceeds one zone or cell at a time; and a full global rollout takes about four to five business days ([AWS Builders' Library: safe hands-off deployments](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

**[DURABLE] [PLATFORM CLAIM]** In Amazon's model, any firing alarm in the team's aggregate alarm rolls back all in-progress deployments in that Region, new deployments do not start while the alarm is firing, and anomaly detection on request count, latency and faults also triggers rollback. Backward compatibility is tested by running old and new versions side by side in a production-like stage before production ([AWS Builders' Library: safe hands-off deployments](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

**[DURABLE] [PLATFORM CLAIM]** Amazon excludes automated deployments at night, on weekends, holidays, Fridays and late afternoon so on-call staff are available, and notes that overly narrow windows cause changes to pile up, which is itself a risk ([AWS Builders' Library: safe hands-off deployments](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

**[INFERENCE]** Scaled-down bake times for a single-Region SaaS company: a canary at 5 to 10% of traffic for 15 to 60 minutes with a minimum request count, then per-zone or 33% batches. The Amazon durations are a ceiling for a hyperscaler, not a requirement for a small fleet.

### Missing safeguards in the 2025 incidents

**[FAST-MOVING, 2025] [PLATFORM CLAIM]** Google shipped a code path without a feature flag and with globally replicated policy data; Cloudflare's global configuration system had no gradual rollout; and both imposed change freezes afterwards ([Google Cloud incident report](https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW); [Cloudflare 5 Dec 2025 post-mortem](https://blog.cloudflare.com/5-december-2025-outage/)).

### Change policy template

**[INFERENCE]** A change policy consistent with the DORA evidence: standard changes (infrastructure or application changes that pass pipeline checks, are peer-reviewed and have automatic rollback) need no extra approval; high-risk changes (data migrations, network, DNS, IAM or SCP changes, and anything that cannot be canaried or reversed) need a second senior reviewer, a written rollback plan and a staffed window; emergency changes use the same pipeline with a shortened bake. Section 14 gives the ITIL vocabulary and section 18 the agent-specific rules.

**[INFERENCE]** Deployment strategy by workload, which is general practice with no primary source fetched: blue/green suits stateful cut-overs and fast full rollback at double-capacity cost; canary or rolling suits stateless services with good metrics; feature flags decouple deployment from release.

**[INFERENCE]** Treating the pipeline as the audit trail (recorded peer review plus automated evidence) is how DORA suggests meeting segregation-of-duties expectations; whether that satisfies a specific ISO 27001 or SOC 2 auditor must be confirmed with the compliance function and the auditor.

### Gaps in this section

**[GAP]** Not sourced: DORA's 2019 effect sizes for change boards, DORA 2025 performance benchmarks for the five metrics, AWS-native deployment mechanics (CodeDeploy configurations, ECS blue/green and built-in strategies, Lambda aliases and weighted shifting, Argo Rollouts, Flagger), and database schema-change practice (expand and contract).
