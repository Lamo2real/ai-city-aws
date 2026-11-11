---
id: marketing.measurement.unit-economics-formulas
department: marketing
domain: measurement
title: Unit economics definitions and formulas to apply consistently
summary: Definitions and formulas for blended and paid CAC, margin-based LTV, LTV:CAC, CAC payback, ROAS, target ROAS, break-even ROAS and MER, with the definitional traps an agent must state.
type: glossary
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives:
- sales
- leads
- retention
sources:
- https://a16z.com/16-startup-metrics/
- https://a16z.com/2023/08/22/why-do-investors-care-so-much-about-ltvcac/
- https://www.wallstreetprep.com/knowledge/cac-payback-period/
- https://www.geckoboard.com/resources/kpi-examples/cac-payback-period/
- https://support.google.com/google-ads/answer/6268637?hl=en
- https://www.shopify.com/blog/break-even-roas-calculator
- https://sellforte.com/dictionary/marketing-efficiency-ratio
- https://www.bloomanalytics.io/blog/the-smart-way-to-calculate-mer-in-ecommerce
related:
- marketing.measurement.ltv-cac-benchmarks
- marketing.google-ads.bidding
- marketing.strategy.budget-setting
seed_version: 1
---

**When to use this:** Whenever computing or comparing CAC, LTV, payback, ROAS, break-even ROAS or MER.

## Definitions and formulas an agent should apply consistently

**[DURABLE; a16z, 21 Aug 2015]** Customer acquisition cost (CAC) is the full cost of acquiring users on a per-user basis. Blended CAC is total acquisition cost divided by total new customers across all channels; paid CAC is total acquisition cost divided by new customers acquired through paid marketing. Omitting referral fees, credits or discounts understates CAC, and blended CAC does not show whether paid campaigns are profitable. Lifetime value (LTV) is the present value of future net profit from the customer over the relationship. The building blocks are revenue per customer per month (average order value × number of orders), contribution margin per customer per month (revenue from the customer minus variable costs associated with the customer, including selling, administrative and operational costs), and average lifespan in months (1 ÷ monthly churn, where monthly unit churn is lost customers ÷ prior-month total); LTV is contribution margin per customer × average lifespan. a16z warns that treating LTV as revenue or gross margin instead of net profit is a common mistake and prefers 12- and 24-month LTV when history is short ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). **[DURABLE; a16z, 22 Aug 2023]** For LTV:CAC, LTV is taken as gross profit from a customer over time and CAC as total sales and marketing spend to acquire that customer; investors often use 3x as a rough benchmark for consumer companies, with LTV reaching 3x CAC or more within five years ([a16z](https://a16z.com/2023/08/22/why-do-investors-care-so-much-about-ltvcac/)).

**[DURABLE]** CAC payback period is the months needed to recoup acquisition cost: sales and marketing expense ÷ (new monthly recurring revenue × gross margin), or per customer, CAC ÷ (average revenue per account × gross margin %); for example $560 ÷ ($50 × 80%) = 14 months ([Wall Street Prep](https://www.wallstreetprep.com/knowledge/cac-payback-period/); [Geckoboard](https://www.geckoboard.com/resources/kpi-examples/cac-payback-period/)). ROAS per Google Ads Help is conversion value ÷ cost × 100%, and target ROAS is the average conversion value wanted per unit of ad spend ($5 of sales for $1 of spend is 500%) ([Google Ads Help](https://support.google.com/google-ads/answer/6268637?hl=en)). Break-even ROAS per Shopify is 1 ÷ gross profit margin before ad spend: a $100 product costing $60 has a 40% margin and a break-even ROAS of 2.5 ([Shopify](https://www.shopify.com/blog/break-even-roas-calculator)). **[VENDOR and practitioner definitions]** Marketing efficiency ratio (MER), also called blended ROAS, is total revenue ÷ total marketing or ad spend across all channels for the same period; it is a blended health check, not causal and not a profit measure, and it has no standards-body definition ([Sellforte](https://sellforte.com/dictionary/marketing-efficiency-ratio); [Bloom Analytics](https://www.bloomanalytics.io/blog/the-smart-way-to-calculate-mer-in-ecommerce)).

**[INFERENCE]** Three definitional traps follow. Sources disagree on the LTV base (a16z in 2015 says contribution margin or net profit; a16z in 2023 uses gross profit as a proxy), so an agent must state which base it used. Sources disagree on the MER denominator (ad spend versus all marketing spend), so fix one definition per account. Break-even ROAS on gross margin ignores variable costs outside cost of goods (shipping, payment fees), so using contribution margin before ad spend gives a stricter and safer threshold.
