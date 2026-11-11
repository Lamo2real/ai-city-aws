---
id: marketing.conversion.speed-and-checkout-burden
department: marketing
domain: conversion
title: Page speed and checkout burden have the strongest conversion evidence
summary: A 0.1-second speed gain was associated with about 8 to 10% more conversions; average cart abandonment is about 70%, and the average checkout has 11.3 fields where about 8 are needed, so remove fields that are not needed.
type: playbook
audience: worker
confidence: vendor
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives:
- sales
- leads
sources:
- https://web.dev/case-studies/milliseconds-make-millions
- https://baymard.com/blog/cart-abandonment-rate
- https://baymard.com/research-articles/checkout-flow-average-form-fields
- https://baymard.com/research-articles/ecommerce-checkout-usability-report-and-benchmark
related:
- marketing.conversion.what-converts
- marketing.seo.technical-and-content-basics
- marketing.market-sweden.ecommerce-payment-and-delivery
seed_version: 1
---

**When to use this:** When improving landing pages, checkout or forms.

## Speed has the strongest quantified evidence

**[DURABLE; Google-commissioned study by 55 and Deloitte, data late 2019]** "Milliseconds Make Millions" tracked mobile load times hourly for 30 days across 37 European and US brand sites and over 30 million sessions. A **0.1-second improvement across four speed metrics lifted conversions 8.4% in retail and 10.1% in travel**, and retail consumer spend rose 9.2%. In the funnel, retail product-detail-to-basket rose 9.1%, luxury product-detail-to-basket rose 40.1% on a small base, and lead-generation form step one to submission rose 21.6% ([web.dev](https://web.dev/case-studies/milliseconds-make-millions)). **[INFERENCE]** The study is observational across sites with no redesigns during the window; it shows association, not a randomised effect. The Core Web Vitals thresholds to hit are in section 8.

## Checkout and form burden: remove fields that are not needed

**[DURABLE; Baymard, vendor research]** Average documented cart abandonment is **70.22%** across 50 studies (range 55 to 84%). Reasons given by US shoppers include extra costs too high (40%), delivery too slow (20%), not trusting the site with card details (19%), having to create an account (18%) and a checkout that is too long or complicated (17%) ([Baymard](https://baymard.com/blog/cart-abandonment-rate)). The average checkout in 2024 had 5.1 steps and **11.3 form fields** (12.7 in 2019), while most sites need about 8; the number of fields matters more than the number of steps, and the average US checkout shows 23.48 form elements by default against an ideal of 12 to 14 ([Baymard](https://baymard.com/research-articles/checkout-flow-average-form-fields)). Baymard estimates the average large ecommerce site could gain 35.26% in conversion from checkout design fixes alone, a vendor estimate ([Baymard](https://baymard.com/research-articles/ecommerce-checkout-usability-report-and-benchmark)). **[INFERENCE]** The advice is "remove fields that are not needed", not "fewer is always better": the evidence concerns checkout burden, no rigorous lead-generation form study was found, and platform data shows that shorter lead forms raise volume while lowering lead quality (section 4). Swedish checkout specifics (Swish, BankID, delivery options) are in section 20, where the abandonment reasons are locally measured.
