---
id: operations.vendors.vendor-and-procurement-management
department: operations
domain: vendors
title: 'Operations: Vendor and procurement management'
summary: 'Vendor and procurement management: large SaaS estates and unpredictable AI pricing, GDPR Article 28 terms for any
  vendor processing personal data, Swedish MBL duties when work goes to non-employees, and vendor templates (register, selection,
  renewal).'
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- cost
- compliance
sources:
- https://zylo.com/reports/2026-saas-management-index/
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/
- https://techstrong.ai/features/ai-agent-fallout-more-than-40-of-projects-will-be-canceled-in-two-years-gartner-predicts/
- https://gdpr-info.eu/art-28-gdpr/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1976580-om-medbestammande-i-arbetslivet_sfs-1976-580/
- https://www.svenskforfattningssamling.se/sites/default/files/sfs/2026-06/SFS2026-886.pdf
related: []
seed_version: 1
---

**When to use this:** When buying, renewing or reviewing software or a vendor: SaaS estate and AI pricing, GDPR Article 28 processor contracts, MBL before work goes to non-employees, and the vendor templates.

**Source section:** 8. Vendor and procurement management

### SaaS estates are large and AI pricing is unpredictable

**[VENDOR] [FAST-MOVING, 2026]** Zylo's 2026 SaaS Management Index (eighth edition) reports an average of 305 SaaS applications per company (median 240) and average annual SaaS spend of $55.7M (median $20.6M), up 8% year on year. Zylo's customer base skews large, so the absolute figures do not transfer to a small company. The same report finds spend on AI-native applications up 108%, 78% of IT leaders reporting unexpected charges tied to AI features or consumption pricing, and 61% cutting projects because of unplanned SaaS cost increases; it still finds unused seats and overlapping tools ([Zylo 2026 SaaS Management Index](https://zylo.com/reports/2026-saas-management-index/)).

**[FAST-MOVING, 2026]** In McKinsey's survey fielded 4 May to 8 June 2026 (1,719 respondents), 32% said their organisation chose not to buy at least one software product or feature because it could be built in-house with agentic coding tools, and about 20% said AI operating costs including tokens constrain their AI use ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[CONTESTED] [FAST-MOVING, 2025]** The MIT NANDA 2025 report, read only through a press summary, found that buying from specialised vendors or building through partnerships succeeded about 67% of the time, with internal builds succeeding about one-third as often ([Fortune, 18 Aug 2025](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/)). This sits in tension with the McKinsey build-in-house finding above, and the report's quality is contested.

**[VENDOR] [FAST-MOVING, Jun 2025]** Gartner estimated in June 2025, as reported by trade press, that only about 130 of the thousands of vendors claiming agentic AI were genuine, a practice it called agent washing ([Techstrong.ai, 26 Jun 2025](https://techstrong.ai/features/ai-agent-fallout-more-than-40-of-projects-will-be-canceled-in-two-years-gartner-predicts/)).

### GDPR Article 28 sets the contract for any vendor that processes personal data

**[DURABLE]** Legal status: checked on primary source (a reproduction of the regulation text); orientation, not legal advice. Under GDPR Article 28 a controller uses only processors offering sufficient guarantees, under a written contract that sets out subject matter, duration, nature and purpose, data types and data-subject categories. The contract requires processing only on documented instructions, staff confidentiality, Article 32 security, assistance with data-subject requests and with breach and impact-assessment obligations, deletion or return of data at the end of service, and audit and inspection rights ([GDPR Art. 28](https://gdpr-info.eu/art-28-gdpr/)).

**[DURABLE]** Legal status: checked on primary source; orientation only. Under GDPR Article 28(2) and (4) a processor engages no sub-processor without the controller's prior written authorisation. Under a general authorisation the processor must announce changes so the controller can object, the same obligations flow down, and the original processor stays fully liable ([GDPR Art. 28](https://gdpr-info.eu/art-28-gdpr/)).

### Swedish specifics: MBL when work goes to non-employees

**[DURABLE]** Legal status: checked on primary source; orientation only. Under MBL 38 § an employer bound by a collective agreement must on its own initiative negotiate with the union before deciding to have work performed by someone who is not an employee, with exceptions for short-term temporary work or work requiring special expertise; the exception does not cover hiring agency staff. The duty applies towards unions the employer has a collective agreement with ([MBL, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1976580-om-medbestammande-i-arbetslivet_sfs-1976-580/)).

**[FAST-MOVING, 1 Jul 2026]** Legal status: checked on primary source. SFS 2026:886, issued 28 May 2026 and in force 1 July 2026, amends MBL 39 § on the union veto against engaging a contractor: for public procurement the veto declaration may rest only on circumstances listed in the procurement statutes. It does not alter negotiation duties for a private SaaS employer ([SFS 2026:886](https://www.svenskforfattningssamling.se/sites/default/files/sfs/2026-06/SFS2026-886.pdf)).

### Vendor templates

**[INFERENCE]** Vendor selection outline: requirements split into must and should; a longlist reduced to a shortlist of three; a weighted scorecard covering fit, security and privacy, total cost over three years including usage-based charges, integration with the system of record, vendor viability and exit terms; reference calls; a time-boxed trial with success criteria; and a decision record with one decider.

**[INFERENCE]** Due-diligence checklist for a Sweden-based SaaS company: a data processing agreement meeting Article 28; the sub-processor list and change-notice mechanism; data location and transfer mechanism; security attestations such as an ISO 27001 certificate or SOC 2 report; an incident-notification commitment; uptime agreement and credits; data export and deletion on exit; AI terms (training on customer data, consumption caps); liability cap; auto-renewal and price-uplift clauses; and whether MBL 38 § negotiation is triggered when work is outsourced, which applies only where a collective agreement binds the employer and should be confirmed with counsel.

**[INFERENCE]** Renewals calendar fields: vendor; product; owner; contract start and end; notice deadline; auto-renew yes or no; annual cost; pricing model (seat, usage or hybrid); seats bought against seats active; price-uplift clause; data processing agreement on file; criticality tier; next review date. Set alerts at 120, 90 and 60 days before the notice deadline; those intervals are the researchers' suggested default.

**[INFERENCE]** SaaS spend control: a single intake route for new tools; monthly reconciliation of card and invoice data against the register; a quarterly licence true-down; and usage caps and budget alerts on every consumption-priced or AI product, given the 78% unexpected-charge finding in the Zylo 2026 report ([Zylo 2026 SaaS Management Index](https://zylo.com/reports/2026-saas-management-index/)).

**[INFERENCE]** Vendor performance review, quarterly for critical vendors and annual for others: service-level attainment; incidents; support responsiveness; cost against plan; roadmap fit; security or compliance changes; and a keep, renegotiate or exit decision. A single owner per vendor and a renewals calendar are the baseline controls.

**[GAP]** Not verified: licence utilisation and SaaS spend per employee for 2026; Sweden's NIS2 implementation (the Cybersecurity Act), including its entry-into-force date, scope thresholds, supply-chain duties and incident-reporting deadlines, which must be checked before use; DORA for sales to financial entities; Swedish public procurement law for sales to public bodies; ISO 27001 supplier controls; vendor onboarding and procure-to-pay practice; and procurement best-practice sources such as CIPS or Gartner.
