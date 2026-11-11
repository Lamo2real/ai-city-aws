---
id: infrastructure.operating-model.platform-team-with-hard-gates
department: infrastructure
domain: operating-model
title: 'IT infrastructure: Operating model: the department as a platform team with hard gates'
summary: 'The department as a platform team: developers and agents as customers, manager and worker roles in incidents and changes, five evidence-backed priorities, model availability as a continuity risk.'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
objectives:
- reliability
- delivery
sources:
- https://dora.dev/capabilities/platform-engineering/
- https://sre.google/workbook/incident-response/
- https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report
seed_version: 1
---

**When to use this:** When deciding how the department works: who its customers are, how manager and worker map onto incident and change roles, the five priorities, and model availability as a continuity risk.

**Source section:** 1. Operating model: the department as a platform team with hard gates

## 1. Operating model: the department as a platform team with hard gates

### The department's customers are developers and other agents

**[INFERENCE]** An AI infrastructure department is a platform team: its customers are the company's developers and the other departments' agents, so it should be measured on DORA's platform scorecard (software delivery metrics, user satisfaction, adoption and task success) and not on ticket counts. This is the researchers' synthesis of the DORA platform guidance ([DORA platform engineering capability, updated 12 Jan 2026](https://dora.dev/capabilities/platform-engineering/)); no source describes an agent-run department.

### Manager and worker agents map onto incident and change roles

**[INFERENCE]** The manager agent maps to the coordinating role (in incidents, the incident commander who holds the single source of truth), one worker agent is the only actor changing production at any time (the operations lead), and another handles communication drafts. Irreversible actions pass through a human approval gate and every role change is written down as a handoff. This applies Google's incident role separation ([Google SRE Workbook: Incident Response](https://sre.google/workbook/incident-response/)) to agents; it does not come from a source on AI operations.

### Five priorities the evidence supports in every domain

**[INFERENCE]** Across the research, five priorities recur and should break ties when guidance conflicts. Stage every change, including configuration and data, because global unstaged pushes caused the largest 2025 outages. Keep recovery independent of control planes and of the thing that failed. Protect identity and backups first, because attackers and faulty automation both go for them. Produce machine-readable evidence for every control, because auditors and regulators sample records over time. Enforce limits on agents in the platform (accounts, roles, service control policies) and not in prompts. Each priority is sourced in the sections that follow; the ranking is the researchers' synthesis.

### Model availability is itself a continuity risk for an agent-run department

**[FAST-MOVING, Jun 2026] [VENDOR]** A status-page aggregator lists a suspension of access to Anthropic's Claude Fable 5 and Mythos 5 models from 13 June to 1 July 2026, attributed to compliance with an export-control directive, with downstream effect on Amazon Bedrock and products built on those models ([IncidentHub H1 2026 report](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report)). This was read only in the aggregator; the provider notices it links were not opened, so treat the detail as secondary and unconfirmed. **[INFERENCE]** The runbook should state what happens when the model endpoint is unavailable for days (a fallback model, or humans take over), and no production control should depend solely on an agent being reachable.
