---
id: support.tickets.intake-severity-sla-escalation
department: support
domain: tickets
title: 'Customer support: Ticket handling: intake, severity, SLAs, escalation and incidents'
summary: Severity and priority as separate fields, observable severity levels, SLI, SLO and SLA, example SLA tables, promising response and update cadence, the intake checklist, the bug-report minimum, tickets waiting on engineering, incident communication via the status page, hourly updates, and post-incident review.
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- resolution
sources:
- https://www.atlassian.com/incident-management/kpis/severity-levels
- https://rootly.com/incident-response/support-levels
- https://incident.io/blog/slo-sla-sli
- https://www.jitbit.com/news/helpdesk-ticket-priority-levels/
- https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/
- https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn
- https://www.atlassian.com/incident-management/incident-communication
related:
- support.support-model.model-and-channels
- support.compliance.b2b-support-obligations
- support.handoffs.cross-department-handoffs
seed_version: 1
cross_refs:
  '17':
  - support.voice-of-customer.voice-of-the-customer
  '21':
  - support.compliance.swedish-and-eu-consumer-law
  '22':
  - support.compliance.b2b-support-obligations
  '23':
  - support.compliance.gdpr-in-support
---

**When to use this:** When triaging a ticket, setting severity and priority, promising response times, escalating a bug, or communicating an incident.

**Source section:** 11. Ticket handling: intake, severity, SLAs, escalation and incidents

### Keep severity and priority as two separate fields

[DURABLE] Atlassian defines severity as a measure of impact and priority as a measure of urgency, and the two can diverge: a homepage typo is low severity but may be high priority, while a crash affecting 0.05% of users is high severity but may not be top priority ([Atlassian](https://www.atlassian.com/incident-management/kpis/severity-levels)). Rootly warns that tools mislabel the fields (some call severity "priority"), so integrations should map on definitions and not on numbers ([Rootly, updated 14 October 2026](https://rootly.com/incident-response/support-levels)).

### Write severity levels as observable thresholds

[DURABLE] Atlassian's own three levels are: SEV 1, a customer-facing service down for all customers, a privacy or confidentiality breach, or customer data loss; SEV 2, service unavailable for a subset of customers or core functionality significantly impaired; SEV 3, a minor inconvenience with a workaround. SEV 1 and 2 page on-call staff at any hour and SEV 3 waits for working hours ([Atlassian](https://www.atlassian.com/incident-management/kpis/severity-levels)). Rootly advises defining levels from critical customer journeys using observable thresholds (scope, functionality, workaround, data or security risk, trajectory), specifying what each level triggers (paging, roles, communications cadence, follow-up), and testing the definitions against past incidents before adoption ([Rootly, updated 14 October 2026](https://rootly.com/incident-response/support-levels)).

### SLI, SLO and SLA are three different things

[DURABLE] The service level indicator is the measurement, the service level objective is the internal target, and the service level agreement is the contractual commitment with consequences; set objectives tighter than agreements ([incident.io](https://incident.io/blog/slo-sla-sli)).

### Example SLA tables are conventions, not standards

[FAST-MOVING, 2026] Two practitioner tables are commonly quoted. Neither is a standard, and the Jitbit source itself says there is no universal standard and that an SLA you cannot meet is worse than a looser one. Set targets the team can actually hit.

| Priority | Jitbit example: acknowledge / resolve | incident.io example: respond / resolve | Source |
|---|---|---|---|
| P1 | 15 minutes / 1 to 2 hours | 15 minutes / 4 hours, escalates to VP Engineering | [Jitbit](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/); [incident.io](https://incident.io/blog/slo-sla-sli) |
| P2 | 1 hour / 4 to 8 hours | 1 hour / 24 hours | [Jitbit](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/); [incident.io](https://incident.io/blog/slo-sla-sli) |
| P3 | 4 hours / 24 to 48 hours | 4 hours / 72 hours | [Jitbit](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/); [incident.io](https://incident.io/blog/slo-sla-sli) |
| P4 | next business day / 3 to 5 business days | 24 hours / best effort | [Jitbit](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/); [incident.io](https://incident.io/blog/slo-sla-sli) |

### Promise response and update cadence, not resolution time

[INFERENCE] For a small EU SaaS vendor the researchers recommend publishing two clocks per priority: first response and next-update interval. Resolution-time promises are risky in contracts because fix time depends on engineering, whereas an update cadence is controllable. For comparison with real performance, the Freshworks 2025 benchmark (2024 data, via a secondary summary) puts the software and internet median first response on tickets at about 47 minutes ([thisandthat.chat](https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/)).

### Intake checklist for worker agents

[INFERENCE] The researchers' intake sequence: identify the account and plan; classify the contact type (how-to, bug, billing, account or security, feature request, complaint, data-protection request, cancellation or withdrawal); set severity from written criteria; set priority from severity plus business urgency (contract tier, renewal date, number of users blocked); check for an open incident and attach the ticket to it; then route. For consumer claims, record the date of the first complaint in the ticket, because ARN's one-year filing clock runs from it (section 21).

### Bug-report minimum before escalating to engineering

[INFERENCE] Standard practice, not sourced to a study: a one-sentence summary; customer impact and number of affected accounts; environment (browser, operating system, app version, region); exact steps to reproduce; expected versus actual result; timestamps with time zone; error text and identifiers; screenshots or recordings; a workaround if any; and severity with justification. Include no personal data beyond what is needed.

### Tickets waiting on engineering are not resolved for the customer

[DURABLE] Tickets handed to engineering often show as pending in the support queue while nothing has changed for the customer; link tickets to bug records and track how long each affected account has been waiting ([Rework, updated 11 October 2026](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn)). Unresolved bugs are also one of the churn-signal families in section 17.

### Incident communication: the status page is the single source of truth

[DURABLE] Atlassian's guidance: use a dedicated status page as the single source of truth and point every other channel (email, in-app banner, social, chat) back to it; offer subscriptions; embed status on high-traffic pages. Communicate outward in this order: on-call team, front-line support, managers and executives, all employees, then customers, because front-line support needs accurate information early so that it can relay it ([Atlassian](https://www.atlassian.com/incident-management/incident-communication)).

### Incident updates: acknowledge early, update at least hourly

[DURABLE] The first message should acknowledge the issue even before details are known, summarise known impact, promise further updates, and address security or data-loss concerns where relevant; templates should be written and approved before any incident. While customers are still affected, update at least hourly, always state when the next update will come, and post even when nothing has changed ([Atlassian](https://www.atlassian.com/incident-management/incident-communication)). [INFERENCE] AI agents must never invent an incident explanation; during an open incident they quote the status-page text verbatim and link to it.

### Post-incident review and security incidents

[DURABLE] After resolution, publish a post-incident review that acknowledges and apologises, explains what went wrong and why, describes the fix and the prevention steps, and apologises again in a plain tone. Security or data-loss incidents need a pre-agreed, faster external communication plan with Legal and security involved ([Atlassian](https://www.atlassian.com/incident-management/incident-communication)). The statutory clocks that sit behind this are in sections 22 and 23.

### What was not found on ticket handling

[GAP] No authoritative, dated benchmark was found for SLA attainment rates or for typical B2B SaaS contractual support SLAs, and no measured evidence on which routing method (skills-based, round-robin, account-owner) performs best.
