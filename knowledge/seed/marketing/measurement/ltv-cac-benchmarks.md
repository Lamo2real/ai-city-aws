---
id: marketing.measurement.ltv-cac-benchmarks
department: marketing
domain: measurement
title: LTV:CAC and payback targets for B2B SaaS and ecommerce, and correcting platform CPA
summary: B2B SaaS medians cluster near 3:1 LTV:CAC and 16 to 18 months payback; DTC ecommerce targets 3:1 on 24 months with payback depending on vertical margin; adjust platform-reported CPA and ROAS by an incrementality factor before using them.
type: benchmark
audience: manager
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- sales
- leads
sources:
- https://www.saashero.net/strategy/b2b-saas-cac-benchmarks-2026/
- https://www.drivetrain.ai/finance-planning-metric/cac-payback-period-formula-benchmarks-and-how-to-reduce-it
- https://eightx.co/blog/ecommerce-kpi-benchmark-report-2026
- https://getrecast.com/top-consumer-brands-dont-pick-one-measurement-method-they-triangulate
related:
- marketing.measurement.unit-economics-formulas
- marketing.measurement.triangulation
seed_version: 1
---

**When to use this:** When judging whether acquisition costs are healthy or setting allowable CAC or cost per lead.

## B2B SaaS benchmarks cluster near 3:1 and 16 to 18 months

**[VENDOR, 2026, single secondary compilation]** For B2B SaaS, median CAC payback is **16 months** (top quartile 6 months or less, bottom quartile 24+; Aleph and Benchmarkit, 198 companies, 2026), with investor heuristics of 12 months as healthy, 18 as a yellow flag and above 24 as a serious concern. Median LTV:CAC is 3.2:1 with a 3:1 floor, and above 5:1 suggests under-investment in growth. Median CAC is about $702 for self-serve versus about $11,400 for enterprise sales-led; payback by contract value runs 8 to 12 months at $5K to $25K, 14 to 18 months at $25K to $50K, and 18 to 24 months above $50K (the source's FAQ says 18 to 36, which is inconsistent). Two measurement cautions from the same source: pixel-only tracking understates CAC by 25 to 45%, and revenue-based LTV overstates LTV by about 30% compared with margin-based LTV ([SaaS Hero, 2026](https://www.saashero.net/strategy/b2b-saas-cac-benchmarks-2026/)). **[VENDOR, secondary]** A second source reports that a 2025 Benchmarkit report put the 2024 median payback at 18 months, up from 14, and repeats 12 months or less as the usual SaaS target ([Drivetrain](https://www.drivetrain.ai/finance-planning-metric/cac-payback-period-formula-benchmarks-and-how-to-reduce-it)).

## Ecommerce targets depend on vertical margin

**[VENDOR, 2026]** For DTC ecommerce, the target is LTV:CAC of at least 3:1 on a 24-month lifetime, with CAC payback under 12 months for venture-backed and under 6 months for bootstrapped brands. Public DTC median payback is 4 to 8 months in beauty and outdoor, 6 to 14 in apparel, 9 to 18 in food and beverage, and 14 to 24+ in low-margin commodity categories. Contribution margin after marketing runs 8 to 22% in aggregate (beauty leaders 22%+, apparel about 12 to 18%, lower-margin CPG about 4 to 10%). The same source's channel-level CAC ranges (for example Meta prospecting $35 to $120) have no stated origin and are low confidence ([Eightx, 2026](https://eightx.co/blog/ecommerce-kpi-benchmark-report-2026)).

## Correct platform numbers before using them

**[VENDOR, 2026]** Platform-reported CPA and ROAS should be adjusted by an incrementality factor from a calibrated model; Recast's example turns a TikTok-reported $27 CPA into about $22 after MMM calibration, anchored on a lift-tested Google Ads incremental cost per signup of $20 ([Recast](https://getrecast.com/top-consumer-brands-dont-pick-one-measurement-method-they-triangulate)). **[INFERENCE]** Use margin-based LTV, decide scale-up on marginal instead of average CAC because returns diminish, and for lead generation compute allowable cost per lead as allowable CAC times the client's own lead-to-customer rate.
