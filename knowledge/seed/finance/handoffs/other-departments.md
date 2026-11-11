---
id: finance.handoffs.other-departments
department: finance
domain: handoffs
title: 'Finance: Handoffs between Finance and the other departments'
summary: 'Handoffs between Finance and the other departments: what Finance receives from and hands over to Sales, Marketing, Customer Support, Product, Application, Data and AI, IT infrastructure, Legal, Operations, Research, Media and its own workers.'
type: playbook
audience: both
confidence: inference
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- planning
sources:
- https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/forsaljningtillandraeulander.4.18e1b10334ebe8bc80004737.html
- https://a16z.com/16-startup-metrics/
- https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook
- https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html
- https://www.iconiq.com/growth/insights/state-of-ai-2026
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/bokforingslag-19991078_sfs-1999-1078/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/
- https://regeringen.se/contentassets/a57a22d3f04c4a10b86509f88c90b529/ett-nytt-skatteincitament-for-forskning-och-utveckling.pdf
- https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/vaxastod.4.361dc8c15312eff6fd37447.html
- https://www.skatteverket.se/privat/skatter/beloppochprocent/2026
- https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf
related:
- finance.guardrails.agent-guardrails
- finance.precedence.law-evidence-house-style
seed_version: 1
cross_refs:
  '23':
  - finance.gaps.consolidated-gaps
---

**When to use this:** When passing work to or requesting work from another department, or between the finance manager and its workers.

**Source section:** 20. Handoffs between Finance and the other departments

### How handoffs are framed

**[INFERENCE]** No source in the research describes inter-departmental handoffs; the table is the researchers' design, derived from the rules in this document. "Finance" in the owner's list is this department, so the corresponding row covers handoffs between the manager agent and its workers. Each handoff carries a named owner, a due date and the data definition, and Finance returns its output with the labels used in this document.

| Department | Finance receives | Finance hands over | Basis |
|---|---|---|---|
| Sales | Signed order forms, customer VAT numbers, billing terms, requested discounts, prepay and payment-plan proposals, expected close dates | Discount and terms approvals, invoice and credit-note status, overdue accounts and stop-service flags, commission calculations, cash-payback and LTGP:CAC by segment | Researchers' design; [Skatteverket, försäljning till andra EU-länder](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/forsaljningtillandraeulander.4.18e1b10334ebe8bc80004737.html) |
| Marketing | Spend by channel, campaign calendars, offer designs (attraction, upsell, downsell, continuity) | Paid CAC by channel separate from blended CAC, budget against actual, 30-day cash payback per offer, refund assumptions | Researchers' design; [a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/) |
| Customer Support | Refund and credit requests, churn reasons, billing disputes, failed-payment contacts | Approved refunds and credits, dunning status, account standing, cost-to-serve per customer | Researchers' design |
| Product | Pricing and packaging proposals, value metric, usage definitions, roadmap items that change cost to serve | Margin at median and heavy usage, cap and overage recommendations, revenue-recognition consequences of new packaging | Researchers' design; [Bessemer, AI pricing and monetization playbook, Feb 2026](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook) |
| Application | Billing-system events, usage metering, checkout and tax-calculation logic changes | Invoice content requirements, VAT rules by customer type and country, OSS threshold alerts, reconciliation breaks | Researchers' design; [Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html) |
| Data and AI | Inference and token cost by workflow, metric pipelines, cohort tables, model and prompt versions | Metric definitions, cost budgets and retry limits, forecast drivers, control requirements for logs | Researchers' design; [ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026) |
| IT infrastructure | Cloud and tool invoices, data-storage locations, access-rights lists, backup and retention status | Retention and storage-location requirements, software renewal calendar, access-segregation requirements, budget | Researchers' design; [Bokföringslag (1999:1078), riksdagen.se, consolidated through SFS 2024:342](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/bokforingslag-19991078_sfs-1999-1078/) |
| Legal | Contract templates and terms, consumer-law and credit-law opinions, option-programme documents, data-processing terms | Financial data for contracts, late-payment and reminder clauses needed, questions flagged as legal gates (payment plans, guarantees, permanent establishment) | Researchers' design; [Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/) |
| Operations | Headcount plans, hires and leavers, time allocation for R&D staff, purchase requests, vendor onboarding data | Payroll calendar, holiday-pay liabilities, R&D deduction evidence requirements, purchase approvals, växa-stöd eligibility checks | Researchers' design; [regeringen.se, lagrådsremiss on a new R&D tax incentive, 13 Aug 2026](https://regeringen.se/contentassets/a57a22d3f04c4a10b86509f88c90b529/ett-nytt-skatteincitament-for-forskning-och-utveckling.pdf); [Skatteverket, regler för växa-stöd](https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/vaxastod.4.361dc8c15312eff6fd37447.html) |
| Research | Benchmark updates, regulatory monitoring (budget bill, ViDA, K2 and K3), competitor pricing | List of gaps to close (section 23), questions with deadlines, feedback on which sources proved reliable | Researchers' design |
| Media | Production and sponsorship spend, creator and freelancer invoices | Budget against actual, invoice requirements for foreign suppliers, representation and gift limits | Researchers' design; [Skatteverket, belopp och procent 2026](https://www.skatteverket.se/privat/skatter/beloppochprocent/2026) |
| Finance (manager and workers) | Worker outputs with logs and labels | Assignments, calendar, approvals routed to humans, cross-review by a different worker | Researchers' design; [COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf) |
