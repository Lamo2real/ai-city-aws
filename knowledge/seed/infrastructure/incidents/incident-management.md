---
id: infrastructure.incidents.incident-management
department: infrastructure
domain: incidents
title: 'IT infrastructure: Incident management'
summary: On-call load limits, incident roles and conduct, severity levels, postmortems, communication and tooling that survive the incident, runbooks and the incident response standard.
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- reliability
- security
sources:
- https://sre.google/sre-book/being-on-call/
- https://sre.google/workbook/incident-response/
- https://docs.pagerduty.com/ops-guides/incident-response-guide/severity-levels
- https://sre.google/sre-book/postmortem-culture/
- https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW
- https://blog.cloudflare.com/18-november-2025-outage/
- https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025
- https://blog.cloudflare.com/5-december-2025-outage/
- https://grafana.com/observability-survey/2026/
- https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026
- https://csrc.nist.gov/pubs/sp/800/61/r3/final
- https://doi.org/10.6028/NIST.SP.800-61r3
related:
- infrastructure.reliability.backup-and-disaster-recovery
- infrastructure.observability.observability
- infrastructure.compliance.eu-and-swedish-regulation
cross_refs:
  '13':
  - infrastructure.compliance.eu-and-swedish-regulation
seed_version: 1
---

**When to use this:** During or before an incident: on-call limits, roles, severity levels, postmortems, communication, runbooks and the response standard.

**Source section:** 7. Incident management

## 7. Incident management

### On-call load limits

**[DURABLE]** Google's SRE guidance caps operational work at 50% of an engineer's time and on-call at 25%. For 24/7 primary and secondary cover with week-long shifts it needs at least 8 engineers on one site or 6 per site on two sites, and prefers multi-site to avoid night shifts. Response expectations are about 5 minutes for user-facing, time-critical services and about 30 minutes for less sensitive systems, derived from the SLO ([Google SRE Book: Being On-Call](https://sre.google/sre-book/being-on-call/)).

**[DURABLE]** Google estimates one incident consumes about 6 hours including follow-up, so the maximum is 2 incidents per 12-hour shift; the median should be zero pages per day; example overload targets are fewer than 5 tickets a day and fewer than 2 pages per shift; and the aim is a 1:1 ratio of alerts to incidents. Out-of-hours on-call is compensated with time off or capped pay. Underload is also a risk, so each engineer should be on-call at least once or twice a quarter and practise with "Wheel of Misfortune" drills and annual disaster-recovery exercises ([Google SRE Book: Being On-Call](https://sre.google/sre-book/being-on-call/)).

**[INFERENCE]** A small company cannot staff Google's eight-person rotation. A practical adaptation is a business-hours primary with a best-effort or paid secondary out of hours, SLOs set to match that cover, and heavy investment in automated rollback so that fewer pages need a human. **[GAP]** Swedish working-time and on-call compensation rules were not researched, and no 2025 to 2026 data on on-call load or pay norms in Sweden or the EU was found.

### Incident roles and conduct

**[DURABLE]** Google's incident roles are the Incident Commander (owns coordination and any role not delegated), the Operations Lead (the only person changing the system) and the Communications Lead (periodic updates to responders and stakeholders); the three aims are to coordinate, communicate and control. Practices: declare early and often, using criteria written in advance; mitigate first with generic mitigations such as rollback or draining traffic before finding root cause; agree the communication channel in advance; prepare two or three message templates; open a shared document once three or more people are involved; rotate the commander and on-call roughly every four hours in long incidents; and run drills ([Google SRE Workbook: Incident Response](https://sre.google/workbook/incident-response/)).

### Severity levels

**[VENDOR] [DURABLE]** PagerDuty's public five-level scheme is a citable reference. SEV-1 is a critical system issue affecting many customers, an SLA-breaking impairment or a security flaw exposing customer data. SEV-2 is many customers unable to use the product, or the application down or badly degraded for most users. SEV-3 is minor customer impact or partial loss of function needing immediate owner attention, including loss of redundancy. SEV-4 needs action but customers are not affected (one host down in a cluster, a performance delay). SEV-5 is a cosmetic issue or bug ([PagerDuty Incident Response Guide](https://docs.pagerduty.com/ops-guides/incident-response-guide/severity-levels)).

**[VENDOR] [DURABLE]** PagerDuty's response by level: SEV-1 pages an incident commander, notifies internal stakeholders, posts a public notice and involves an executive liaison; SEV-2 pages an incident commander; SEV-3 is a high-urgency page to the owning team, with rollback if a recent deployment is the cause; SEV-4 is a low-urgency page; SEV-5 is a ticket. SEV-1 and SEV-2 are automatically major incidents. When unsure, treat the incident as the higher severity, do not argue about the level during the incident, and review it in the postmortem ([PagerDuty Incident Response Guide](https://docs.pagerduty.com/ops-guides/incident-response-guide/severity-levels)).

**[INFERENCE]** A company scheme adapted from PagerDuty and tied to the EU thresholds in section 13, for a Swedish SaaS company that falls under the cloud-provider rules: SEV-1 is a full outage of the service or any confirmed or suspected malicious data compromise (both can be significant incidents under NIS2, so page the incident commander and the person accountable for regulatory notification at once); SEV-2 is degraded service for more than 5% of users (start a one-hour timer); SEV-3 is loss of redundancy or minor impact; SEV-4 is no customer impact; SEV-5 is cosmetic. Require a postmortem for SEV-1 and SEV-2 plus Google's trigger list below.

### Postmortems

**[DURABLE]** Google's postmortem triggers, to be defined before incidents happen, are user-visible downtime or degradation over a threshold, any data loss, on-call intervention such as a rollback or rerouting, resolution time over a threshold, a monitoring failure, and any stakeholder request. Blameless practice focuses on contributing causes and on why people had incomplete information; every postmortem is reviewed (data collected, impact assessed, root cause deep enough, action plan prioritised, outcomes shared), stored in a shared repository, and good ones are rewarded and surveyed for usefulness ([Google SRE Book: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)).

### Communication and tooling must survive the incident

**[FAST-MOVING, 2025] [PLATFORM CLAIM]** Three 2025 incidents show status and management tooling failing with the thing it reports on: Google's status dashboard was affected by its own outage and the first update took about an hour; Cloudflare's independently hosted status page failed coincidentally and fed a wrong attack hypothesis; and Microsoft had to fail its portal away from the broken edge service to regain management access ([Google Cloud incident report](https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW); [Cloudflare 18 Nov 2025 post-mortem](https://blog.cloudflare.com/18-november-2025-outage/); [ThousandEyes on Azure Front Door](https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025)).

**[FAST-MOVING, 2025] [PLATFORM CLAIM]** Provider benchmarks for detection and declaration: Cloudflare declared its 5 December 2025 incident 2 to 3 minutes after impact began and reverted in about 23 minutes; Google began triage within 2 minutes and found root cause within 10 on 12 June 2025 ([Cloudflare 5 Dec 2025 post-mortem](https://blog.cloudflare.com/5-december-2025-outage/); [Google Cloud incident report](https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW)).

**[FAST-MOVING, 2026] [VENDOR]** Alert fatigue is named as the biggest obstacle to faster incident response by 30% of respondents in Grafana's 2026 survey (1,363 respondents, fielded 1 October 2025 to 10 January 2026) ([Grafana Observability Survey 2026](https://grafana.com/observability-survey/2026/)), and failure to follow established procedures is the leading driver of human-error outages in Uptime's 2026 analysis ([Uptime Institute press release, 13 May 2026](https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026)).

### Runbooks

**[INFERENCE]** A runbook's minimum fields are the trigger alert and SLO, the impact, first-five-minutes diagnostic steps, generic mitigations (rollback, scale, shift traffic, disable a feature flag), escalation contacts, links to dashboards and a last-tested date. Keep incident communications and runbooks reachable when the primary cloud or single sign-on is down. For a company under the EU rules in section 13, the incident process also needs a timer on complete unavailability with an automatic prompt to the accountable person at 30 minutes, per-tenant impact data so affected users can be counted quickly, and a recorded "awareness" timestamp that starts every regulatory and contractual clock.

### Incident response standard

**[FAST-MOVING, 3 Apr 2025]** NIST SP 800-61 Revision 3 was published on 3 April 2025 as a CSF 2.0 Community Profile for incident response and supersedes Revision 2 from 2012 ([NIST CSRC](https://csrc.nist.gov/pubs/sp/800/61/r3/final)). **[GAP: unverified background]** The researchers recall that Revision 3 replaces the old four-phase lifecycle with a mapping to CSF 2.0 (Govern, Identify and Protect as preparation, then Detect, Respond and Recover, with continuous improvement); this was not re-read in the PDF ([NIST SP 800-61r3](https://doi.org/10.6028/NIST.SP.800-61r3)).

### Gaps in this section

**[GAP]** Not sourced: customer-communication cadences, Atlassian's or Google's severity definitions for comparison, current MTTR benchmarks, and incident tooling (AWS Systems Manager Incident Manager status, AI-assisted incident tools).
