---
id: infrastructure.observability.observability
department: infrastructure
domain: observability
title: 'IT infrastructure: Observability'
summary: SLO burn-rate alerting, OpenTelemetry and Prometheus, AI in observability, deployment-safety alarms, monitoring that can worsen an outage, and telemetry cost governance.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- reliability
- cost
sources:
- https://sre.google/workbook/alerting-on-slos/
- https://sre.google/sre-book/being-on-call/
- https://opentelemetry.io/docs/specs/status/
- https://grafana.com/observability-survey/2026/
- https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://blog.cloudflare.com/18-november-2025-outage/
- https://aws.amazon.com/message/101925
- https://www.finops.org/wg/finops-for-ai-overview/
seed_version: 1
---

**When to use this:** Before designing alerts, dashboards, telemetry pipelines or deployment-safety alarms.

**Source section:** 8. Observability

## 8. Observability

### Alert on SLO burn rate, not on resource thresholds

**[DURABLE]** Google's recommended multi-window, multi-burn-rate alerts for a 99.9% SLO are in the table below; alert only when both the long and the short window exceed the threshold ([Google SRE Workbook: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)).

| Action | Burn rate | Long window | Short window | Budget consumed | Source |
|---|---|---|---|---|---|
| Page | 14.4 | 1 hour | 5 minutes | 2% | [Google SRE Workbook](https://sre.google/workbook/alerting-on-slos/) |
| Page | 6 | 6 hours | 30 minutes | 5% | [Google SRE Workbook](https://sre.google/workbook/alerting-on-slos/) |
| Ticket | 1 | 3 days | 6 hours | 10% | [Google SRE Workbook](https://sre.google/workbook/alerting-on-slos/) |

**[DURABLE]** Judge alert rules on precision, recall, detection time and reset time. For low-traffic services, use synthetic traffic, aggregate small services, add client retries, or lower the SLO or lengthen the window ([Google SRE Workbook: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)). Pages should fire on symptoms that threaten the SLO and be actionable ([Google SRE Book: Being On-Call](https://sre.google/sre-book/being-on-call/)).

**[INFERENCE]** An alert-design checklist: every page maps to an SLO burn-rate rule or a hard safety signal (data loss, security); everything else is a ticket or a dashboard; each page links to a runbook; and pages are reviewed monthly, with any that did not need human action deleted or demoted. This follows from Google's 1:1 alert-to-incident target.

### OpenTelemetry and Prometheus are the mainstream stack

**[FAST-MOVING, 2026]** OpenTelemetry's specification status as read: the tracing API, SDK and protocol are stable with long-term support; the metrics API and protocol are stable with the SDK shown as mixed; the logs bridge API is stable; baggage is stable; and OTLP is stable for traces and metrics ([OpenTelemetry specification status](https://opentelemetry.io/docs/specs/status/)). **[GAP]** The status of the profiles signal, the logs SDK and semantic conventions could not be read.

**[FAST-MOVING, 2026] [VENDOR]** Grafana's 2026 survey (1,363 respondents; 1 October 2025 to 10 January 2026; vendor-run and self-selected) reports 77% investing in Prometheus, 76% in OpenTelemetry and 65% in both; OpenTelemetry in use for metrics by 57%, traces by about half, logs by 48% and profiles by 9%; and 47% increasing OpenTelemetry investment year on year. Top concerns are complexity and overhead (38%), signal-to-noise (34%) and cost (31%); about three-quarters use SLOs in some form; 50% expect to spend more on observability next year and 10% less; and 49% use SaaS observability in some form, up from 42% ([Grafana Observability Survey 2026](https://grafana.com/observability-survey/2026/)).

**[FAST-MOVING, 20 Jan 2026]** CNCF reports OpenTelemetry as its second-highest-velocity project with more than 24,000 contributors, and nearly 20% of survey respondents using profiling ([CNCF announcement, 20 Jan 2026](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/)).

### AI in observability: wanted, not yet trusted to act

**[FAST-MOVING, 2026] [VENDOR]** In Grafana's 2026 survey, 92% see value in AI anomaly detection, 77% see value in autonomous action but 15% do not yet trust it, and 95% say AI must show its reasoning ([Grafana Observability Survey 2026](https://grafana.com/observability-survey/2026/)). **[INFERENCE]** For the department's agents this supports recording the reasoning behind every recommendation and action.

### Deployment-safety alarms

**[DURABLE] [PLATFORM CLAIM]** Amazon describes deployment-safety alarms on fault rate, latency at the 50th, 90th and 99th percentiles, CPU, memory, disk, log errors and health checks, rolled into one aggregate alarm per team that blocks or rolls back deployments, plus separate alarms scoped to the one-box canary because a 10% slice hides in fleet-wide metrics. The article dates from 2020 ([AWS Builders' Library: safe hands-off deployments](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

### Monitoring and health checks can make an outage worse

**[FAST-MOVING, 2025] [PLATFORM CLAIM]** During Cloudflare's 18 November 2025 incident, debugging and error-reporting systems consumed heavy CPU and added latency, and one remediation is to stop core dumps and error reports from overwhelming resources ([Cloudflare 18 Nov 2025 post-mortem](https://blog.cloudflare.com/18-november-2025-outage/)). In the AWS October 2025 event, NLB health checks flapped against instances whose network state had not propagated and triggered zone failovers that removed healthy capacity; AWS is adding a velocity limit on capacity removal ([AWS post-event summary](https://aws.amazon.com/message/101925)).

**[INFERENCE]** Two design rules follow. Fail open when most targets look unhealthy at once and rate-limit automatic capacity removal, because a mass "unhealthy" signal is more likely a monitoring or dependency fault than a real mass failure. Monitoring must not share fate with what it monitors, so keep at least external synthetic checks and paging outside the primary Region or provider.

### Telemetry cost needs the same governance as cloud spend

**[INFERENCE] [GAP]** Cost-of-observability controls, for which no benchmark was sourced: instrument with OpenTelemetry so the backend can be swapped; sample traces, keeping errors and slow requests through tail-based sampling; set log retention by class and drop debug logs in production; cap metric cardinality (no user or request identifiers as labels); and allocate telemetry cost per team like any other spend. No benchmark for observability spend as a share of infrastructure cost is offered.

**[FAST-MOVING, 28 Oct 2026]** For AI workloads the FinOps Foundation advises monitoring tokens per minute at application level, not only daily spend, to catch anomalies early ([FinOps Foundation: FinOps for AI overview, updated 28 Oct 2026](https://www.finops.org/wg/finops-for-ai-overview/)).

### Gaps in this section

**[GAP]** Not verified: AWS observability services (CloudWatch Application Signals, X-Ray's OpenTelemetry direction, the AWS Distro for OpenTelemetry), and current CloudWatch, managed Prometheus and managed Grafana pricing.
