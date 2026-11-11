---
id: finance.pricing.pricing-and-packaging
department: finance
domain: pricing
title: 'Finance: Pricing and packaging from a finance view'
summary: 'Pricing and packaging from a finance view: blended AI pricing models, Bessemer''s taxonomy and hybrid construction, a finance checklist for credit-priced plans, forecasting usage revenue, price increases, discount governance and value metrics.'
type: playbook
audience: both
confidence: vendor
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- pricing
sources:
- https://www.saastr.com/the-builders-economy-10-metrics-from-iconiqs-newest-2026-state-of-ai-report
- https://www.iconiq.com/growth/insights/state-of-ai-2026
- https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook
- https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf
- https://www.highalpha.com/blog/webinar-recap-unpacking-the-saas-benchmarks-report-2025
- https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained
- https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf
- https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/
related:
- finance.house-style.money-models-cash-flow-design
- finance.precedence.law-evidence-house-style
- finance.metrics.saas-metrics-formulas-benchmarks
seed_version: 1
---

**When to use this:** When finance reviews pricing models, AI or credit-priced plans, price increases, discounts or the value metric.

**Source section:** 15. Pricing and packaging from a finance view

### AI builders now blend pricing models

**[VENDOR; FAST-MOVING, Q2 2026]** Among AI builders surveyed by ICONIQ in Q2 2026, 57% use subscription pricing, 42% consumption-based (up from 35% six months earlier) and 23% outcome-based (up from 18%), with 1.7 pricing models blended on average (up from 1.5). Among companies using consumption pricing, 15% absorb 100% of inference cost and 84% pass at least part of it to customers ([SaaStr summary of ICONIQ 2026](https://www.saastr.com/the-builders-economy-10-metrics-from-iconiqs-newest-2026-state-of-ai-report); [ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026)).

### Bessemer's taxonomy of AI pricing models

**[VENDOR; FAST-MOVING, Feb 2026]** Bessemer distinguishes seat-based pricing; consumption pricing per API call or token, with predictable margin but hard budgeting for non-technical buyers; workflow-based pricing per completed task; outcome-based pricing per successful result, where the vendor carries cost variability; and hybrid pricing with a base subscription plus usage or outcome tiers, which it recommends under uncertainty ([Bessemer, AI pricing and monetization playbook, Feb 2026](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)).

### Bessemer's hybrid construction

**[VENDOR; FAST-MOVING, Feb 2026]** Bessemer's suggested hybrid is a platform fee of about twice the calculated delivery cost plus outcome credits, with the example of a $12k annual fee including 100 resolutions and then $5k per additional 100. It names prepaid credits, usage caps and tiers as tools for balancing variable compute cost against predictable revenue, warns that unit economics which fail at 10 customers will also fail at 1,000, and says reliable AI pricing benchmarks are scarce. Its named examples are Intercom Fin at $0.99 per resolution and Leena AI per auto-closed ticket with minimums ([Bessemer, AI pricing and monetization playbook, Feb 2026](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)).

### Pricing model and performance: correlation only

**[VENDOR; FAST-MOVING, CY-2024 data]** In Benchmarkit's sample, usage-based companies grew a median 44% against 25% for subscription, usage-based GRR was 92% against 88%, and hybrid NRR was 110% against 101% overall, on samples of 149 to 228 ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)). High Alpha reports that a common packaging approach is AI credits bundled into subscription plans, with customers expected to buy more as they see a return ([High Alpha webinar recap, late 2025](https://www.highalpha.com/blog/webinar-recap-unpacking-the-saas-benchmarks-report-2025)). These are correlations in self-selected samples and do not show that changing the pricing model causes the difference.

### Finance checklist for an AI or credit-priced plan

**[INFERENCE]** Before approving any AI or credit-priced plan, finance checks: cost per unit of the value metric, including retries and failed runs (the $0.10 to $1.50 overrun example comes from [ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026)); gross margin at median and heavy-usage customers; a cap, overage price or fair-use limit on anything described as unlimited; the credit expiry and breakage policy; and how unused prepaid credits are recognised, which is a contract liability until used or expired, to be confirmed with the auditor.

### Forecast usage revenue separately

**[INFERENCE]** Usage-based revenue is harder to forecast than seat subscriptions. Forecast it from usage drivers by cohort and present committed revenue (minimums and platform fees) separately from variable revenue in ARR reporting.

### Price increases: where house style and evidence meet

**[CONTESTED] [HOUSE STYLE] [VENDOR; FAST-MOVING, April 2026]** The house style says to raise price before lowering it and reads a high close rate as a sign of underpricing, with an explicit exception for scalable software ([Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained)). The Nordic evidence is an average annual increase of 5.9% in 2025 ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)), and price increases count inside NRR and outside GRR ([SaaS Capital, retention benchmarks, 18 Sept 2025](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/)). The department's default, by inference, is an annual price review, increases tested on new customers first, installed-base increases sized against the peer range, and GRR watched for three to six months after each change.

### Discount governance and value-metric selection

**[GAP; unverified working knowledge]** No source was opened on discount norms or governance. The unsourced outline is a discount-approval matrix by discount size and deal value; discounts traded for something (term, prepay, volume, case study); time limits written into the order form; average discount and the share of deals above threshold tracked as KPIs; and a quarterly review of list-price integrity. Unsourced value-metric criteria are that the metric scales with customer value, is easy to understand and measure, is predictable for the buyer and aligns with cost to serve.

### Gaps on pricing

**[GAP]** Not found: data on the share of companies changing pricing and typical price-increase size from pricing specialists; sourced outcomes of price increases in B2B SaaS, including churn impact; discount norms; and accounting guidance specific to prepaid AI credits and breakage.
