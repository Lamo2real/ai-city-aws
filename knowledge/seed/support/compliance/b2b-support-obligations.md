---
id: support.compliance.b2b-support-obligations
department: support
domain: compliance
title: 'Customer support: B2B support obligations'
summary: 'B2B support duties (orientation, not legal advice): mostly contractual, an SLA example, service-credit claims, the processor''s breach-notice duty, Cybersäkerhetslagen (NIS2) and its incident clocks, the support runbook and house-style practice for B2B accounts.'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
sources:
- https://lagen.nu/2022:260
- https://aws.amazon.com/compute/sla/
- https://gdpr-info.eu/art-33-gdpr/
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/
- https://lagen.nu/2025:1506
- https://rosetta.to/u/alexhormozi/watch-this-to-keep-more-customers
related:
- support.compliance.gdpr-in-support
- support.tickets.intake-severity-sla-escalation
seed_version: 1
---

**When to use this:** When a business customer claims service credits, reports an incident or a data breach, or asks what we owe them.

**Source section:** 22. B2B support obligations

### B2B support duties are mostly contractual

[DURABLE] Konsumentköplagen's mandatory protection is for consumers; B2B support terms are a matter of contract ([lagen.nu 2022:260](https://lagen.nu/2022:260); checked on primary source). [INFERENCE] Typical SaaS support terms define support hours and channels, severity levels with first-response and target-resolution times, an uptime commitment measured monthly with stated exclusions, service credits as a capped percentage of the monthly fee claimed within a set period and stated to be the sole remedy, a termination right for repeated SLA failure, a status page and incident communication cadence, and a post-incident report for major incidents. This list is the researchers' general knowledge; no survey of SaaS SLA norms was found.

### One hyperscaler's SLA as an example of form

[PLATFORM CLAIM] AWS's compute SLA (document dated 25 May 2022; an example of structure, not a market norm) commits to 99.99% monthly uptime at region level and 99.5% per single instance on a commercially-reasonable-efforts basis. Credits are 10% of the monthly bill below the commitment down to 99.0%, 30% from 99.0% down to 95.0% and 100% below 95.0%; they apply against future bills and are non-refundable; the customer must claim through a support case by the end of the second billing cycle after the incident with dates, affected resources and logs, and incomplete claims are disqualified; the SLA is the sole and exclusive remedy, with exclusions for causes beyond reasonable control, the customer's own actions and suspension under the agreement ([AWS](https://aws.amazon.com/compute/sla/)).

### Handling service-credit claims

[INFERENCE] Support agents never promise credits beyond the contract schedule. They are given the claim window and required evidence for each contract, log the customer's claim date on receipt, and route the claim to Finance, because under AWS-style terms a late or incomplete claim is void.

### Processor duty: tell the customer about a personal data breach without undue delay

[DURABLE] GDPR Article 33(2): a processor must notify the controller without undue delay after becoming aware of a personal data breach; the controller then has 72 hours from awareness to notify the authority unless risk is unlikely, must explain any delay, may report in phases and must document every breach ([gdpr-info.eu Art. 33](https://gdpr-info.eu/art-33-gdpr/); republished text of the regulation). IMY confirms that the processor reports to the controller and the controller remains responsible for notifying IMY ([IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/); checked on primary source). The customer will need the nature of the breach, approximate numbers and categories of people and records, a contact point, likely consequences and measures taken (Art. 33(3)). [INFERENCE] Many data processing agreements set a 24 to 48 hour vendor deadline; that is common practice, not a statutory number.

### Cybersäkerhetslagen: Sweden's NIS2 law since 15 January 2026

[FAST-MOVING, January 2026] Cybersäkerhetslag (2025:1506) has been in force since 15 January 2026. It covers entities in the NIS2 annex sectors that are established in Sweden and at least medium-sized (1 kap. 4 §), and digital providers with main establishment or a representative in Sweden, including cloud services, data-centre services, managed services and managed security services (7 §); DORA-covered entities are exempt (11 §) ([lagen.nu 2025:1506](https://lagen.nu/2025:1506); checked on primary source). [INFERENCE] A Swedish SaaS is a cloud service provider in these terms; if it has 50 or more staff or exceeds the EU medium-size financial thresholds it is probably in scope itself, and smaller firms will receive the same duties by contract from in-scope customers. The size figures come from EU Recommendation 2003/361, which was not opened.

### NIS2 incident clocks and customer notification

[FAST-MOVING, January 2026] Under Cybersäkerhetslagen 2 kap., a significant incident must be notified to the authority as soon as possible and within 24 hours of awareness (5 §), with a fuller notification within 72 hours (6 §), an interim report on request (7 §) and a final report within one month (8 §). Where appropriate, service recipients must be informed without delay of a significant incident likely to harm service delivery (9 §), and for a significant cyber threat told what protective measures they can take (10 §). Sanction fees run from 5,000 SEK up to the higher of 2% of worldwide turnover or EUR 10 million for essential entities, and 1.4% or EUR 7 million for important entities ([lagen.nu 2025:1506](https://lagen.nu/2025:1506); checked on primary source).

### The support runbook consequence

[INFERENCE] A suspected security incident must reach the security owner within the same hour, because the first statutory clock is 24 hours and customers' own clocks (72 hours under GDPR, 24 hours under NIS2) start when the vendor tells them. Support never characterises an incident's cause or scope to customers before the incident lead has approved the wording.

### House-style practice for B2B accounts

[HOUSE STYLE] For B2B accounts Hormozi's applicable practice is a single named contact, every meeting ending with the next one booked, and notes sent after each session (own-video transcript, 28 August 2024, [Rosetta](https://rosetta.to/u/alexhormozi/watch-this-to-keep-more-customers)).

### What was not found on B2B obligations

[GAP] Not researched: SaaS SLA and service-credit market norms, the supervisory authority and registration duties for digital providers under Cybersäkerhetslagen, DORA requirements passed down by financial customers, the Data Act's switching and exit rules, and Swedish standard cloud terms.
