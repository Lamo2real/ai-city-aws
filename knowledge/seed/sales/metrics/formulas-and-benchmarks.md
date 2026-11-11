---
id: sales.metrics.formulas-and-benchmarks
department: sales
domain: metrics
title: 'Sales: Metrics, formulas and benchmarks'
summary: 'Sales metric formulas and current benchmarks: win rates, cycle length, coverage, retention and expansion, with each figure''s source and date.'
type: benchmark
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- closing
- retention
- expansion
sources:
- https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf
- https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en
- https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf
- https://www.gong.io/files/gong-labs-state-of-revenue-ai-2026.pdf
- https://www.bridgegroupinc.com/research/2026-ae-models-motions-metrics
- https://www.everstage.com/resources/sales-quota-attainment-benchmarks-2026
- https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group
- https://www.glencoco.com/2026-state-of-sales-development
- https://userpilot.com/blog/free-trial-conversion-rate/
- https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/
- https://chartmogul.com/saas-retention-report/
- https://www.growthunhinged.com/p/2025-saas-benchmarks-report
- https://www.monterro.com/benchmark-report-2026/
- https://offers.hubspot.com/european-saas-benchmark-2025
related:
- sales.pipeline.design-and-stage-criteria
- sales.management.forecasting-and-crm
- sales.saas-b2b.gtm-motions-and-pricing
seed_version: 1
---

**When to use this:** When computing or judging win rate, cycle length, pipeline, retention, CAC payback and other sales metrics.

**Source section:** 19. Metrics, formulas and benchmarks

### Core funnel formulas

**[DURABLE; INFERENCE]** Standard definitions, written from general practice and not fetched: stage conversion rate is opportunities advancing from stage N to N+1 divided by opportunities that entered stage N, on a cohort basis. Win rate is closed-won divided by closed-won plus closed-lost; always state whether by count or value and from which stage, because win rate from qualified stage 1 and from all created opportunities differ widely. Average deal size is closed-won recurring revenue divided by won deals; annual contract value excludes one-off fees and total contract value covers the full term. Sales cycle length is average days from opportunity creation (or stage 1) to closed-won; report the median too. The Bowtie definition of win rate is commitments over qualified opportunities ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)).

### Pipeline velocity and coverage

**[DURABLE; INFERENCE]** Pipeline velocity is qualified opportunities multiplied by win rate multiplied by average deal size, divided by sales cycle length in days, giving revenue per day. Pipeline coverage is open pipeline for the period divided by quota minus closed-won to date. The folk target is about three times; the arithmetically correct target is one divided by win rate, so a 19% new-business win rate implies more than five times coverage on early-stage pipeline. **[GAP]** No primary benchmark for coverage was found. **[VENDOR]** Ebsta's per-deal channel efficiency index is win rate multiplied by contract value, divided by sales cycle ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)).

### Acquisition efficiency formulas

**[DURABLE; INFERENCE]** Customer acquisition cost is total sales and marketing cost divided by new customers acquired in the same period, or lagged by cycle length. Payback in months is acquisition cost divided by new monthly recurring revenue per customer multiplied by gross margin. The magic number is the change in quarterly revenue multiplied by four, divided by the prior quarter's sales and marketing spend. Lifetime value is average revenue per account multiplied by gross margin, divided by churn rate; the rule of thumb for lifetime value to acquisition cost is at least three to one. **[FAST-MOVING, 2024 data]** Benchmarkit's survey gives a median new-customer acquisition-cost ratio of $2.00 of sales and marketing spend per $1 of new recurring revenue (fourth quartile $2.82), an expansion ratio of $1.00 (against $0.61 to $0.69 in 2020 to 2022), magic-number thresholds of 0.75 minimum and above 1.0 ideal, and about 12 months as commonly cited good payback ([Benchmarkit 2025 B2B SaaS Performance Metrics](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)). **[GAP]** The survey's stated fieldwork window is internally inconsistent and should be verified before dates are quoted.

### Retention formulas

**[DURABLE; INFERENCE]** Net revenue retention is starting recurring revenue plus expansion minus contraction minus churn, divided by starting recurring revenue, for a cohort over 12 months. Gross revenue retention is starting revenue minus contraction minus churn, divided by starting revenue, and cannot exceed 100%. Logo churn is customers lost divided by customers at start. Annual churn is one minus (one minus monthly churn) to the twelfth power. The Bowtie definitions agree: gross retention is recurring revenue kept after downgrades and cancellations, and expansion rate is expansion revenue over post-churn cohort revenue ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)).

### Response-time, attainment and activity metrics

**[DURABLE; INFERENCE]** Lead response time is the time from inbound form submission to the first human or qualified automated contact attempt; track the median and the share within the service level. Quota attainment is closed-won bookings over quota; participation rate is the share of reps at or above 100%. Activity metrics (dials, emails, social touches, conversations, meetings booked and held, show rate) are diagnostics, not targets.

### Win rate and cycle benchmarks

**[VENDOR; FAST-MOVING, 2024 data]** Ebsta and Pavilion report a new-business win rate of 19% with a 91-day cycle and an expansion win rate of 45% with a 52-day cycle; the overall cycle was 9% shorter and contract value 54% higher than in the prior-year report; the base stage for win rate is not stated ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)). **[VENDOR; FAST-MOVING, 2024-2025 data]** Gong's analysis of 7.1 million opportunities at 3,613 companies found average win rates and deal duration flat year over year in 2025 and average revenue growth of 16%, down three points for US organisations ([Gong, State of Revenue AI 2026](https://www.gong.io/files/gong-labs-state-of-revenue-ai-2026.pdf)). **[GAP]** Win rate and cycle by deal size from a primary 2025 to 2026 dataset were not found.

### Quota attainment benchmarks conflict by method

**[CONTESTED; FAST-MOVING, 2024-2026]** Self-reported surveys say roughly half of reps hit quota: 48% of account executives in the Bridge Group's H1 2026 survey (51% in 2024) ([Bridge Group 2026 AE report, 22 Jun 2026](https://www.bridgegroupinc.com/research/2026-ae-models-motions-metrics)), and a fall from 52% in 2024 to 46% in 2025 in Gong's survey ([Gong, State of Revenue AI 2026](https://www.gong.io/files/gong-labs-state-of-revenue-ai-2026.pdf)). Platform data say far fewer: 78% of sellers missed quota in Ebsta's 2024 data, up from 69% ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)), and 77.2% of account executives missed quota with median attainment of 61.7% in Everstage's commission data on 25,112 quota carriers, where attainment rises with quota size from 51.9% at a $126,000 median quota to 73.4% at $3.3 million ([Everstage 2026](https://www.everstage.com/resources/sales-quota-attainment-benchmarks-2026)). SDRs: 60% at quota, the lowest in the Bridge Group study's history ([Bridge Group 2025 SDR report](https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group)). **[INFERENCE]** For planning, assume that about 50% participation is already above the market and set the team plan at a discount to summed quotas.

### SDR productivity benchmarks

**[FAST-MOVING, 2025]** The Bridge Group reports median daily SDR activity of 112 (44 phone, 41 email, 19 LinkedIn, 8 other), 4.1 quality conversations a day (4.6 for phone-centric teams making 56 dials; 3.4 for email-centric teams), and pipeline sourced per SDR of $3.78 million a year, with the middle half between $1.9 million and $6.4 million ([Bridge Group 2025 SDR report](https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group)). **[INFERENCE]** The implied dial-to-quality-conversation rate for phone-centric teams is about 8% (4.6 over 56), which is the researchers' arithmetic and not a stated connect rate. **[VENDOR]** A vendor aggregation cites 8 to 10 qualified meetings per SDR per month and says agency-booked show rates of 40 to 60% are common; its worked example values are assumptions ([Glencoco, 2 May 2026](https://www.glencoco.com/2026-state-of-sales-development)).

### Free-trial and freemium conversion benchmarks

**[VENDOR; FAST-MOVING, Jan 2026]** Free-to-paid conversion, median and 75th percentile, from a report on 200 B2B products relayed by an aggregator: trial without credit card 4 to 6% and 10 to 15%; trial with credit card 25 to 35% and 50 to 60%; freemium 3 to 5% and 8 to 12%; ungated freemium 7 to 9% and 8 to 12%; reverse trial 4 to 6% and 8 to 12%; AI-native products 6 to 8% and 15 to 20%; B2B products 6 to 10% and 15 to 20%; overall trial median 8%. Per 1,000 visitors: freemium yields 90 sign-ups and about 5 payers; a standard trial 45 and 3.6; ungated freemium 70 and 5.6; a card-required trial 35 and 10.5 ([Userpilot summary](https://userpilot.com/blog/free-trial-conversion-rate/)). An agency dataset on the same page shows much higher opt-in trial conversion (18.2%) and should be treated as a selected sample.

### Retention benchmarks depend on price point and sample

**[CONTESTED; FAST-MOVING, 2024-2025 data]** Benchmarkit's survey of venture-scale companies gives median net revenue retention of 101% (105% in 2021), 110% for hybrid subscription-plus-usage pricing, and median gross retention of 88% ([Benchmarkit 2025 B2B SaaS Performance Metrics](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)). ChartMogul's platform data on about 3,500 software companies with at least $250,000 in recurring revenue (as of September 2025, published 10 December 2025) gives a B2B SaaS median net retention of 82% (upper quartile 97%), B2C SaaS 49%, and AI-native medians of 40% gross and 48% net; AI-native by price: above $250 a month 70% gross and 85% net, $50 to $249 a month 45% and 61%, under $50 a month 23% and 32% ([ChartMogul, The AI churn wave, 10 Dec 2025](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/)). **[INFERENCE]** The gap is mainly sample: surveys skew to funded, higher-priced companies and the platform data to small self-serve subscriptions. Pick the benchmark by price point.

### Older retention benchmarks by company size and price

**[VENDOR; FAST-MOVING, 2022 data, possibly outdated]** ChartMogul's 2023 report on more than 2,100 companies gives top-quartile net retention of 94% at $1 to 3 million in recurring revenue, 99% at $3 to 15 million and above 105% at $15 to 30 million; for average revenue per account above $500 a month, top-quartile net retention of 109.3% and logo retention of 85.7%; below $10 a month, 65.1% and 63.1% ([ChartMogul SaaS Retention Report, 2023](https://chartmogul.com/saas-retention-report/)).

### Growth benchmarks

**[FAST-MOVING, 2025]** High Alpha and Growth Unhinged's survey of more than 800 companies (fielded August to September 2025) gives median growth for AI-native against other B2B SaaS companies by recurring revenue: under $1 million, 100% against 75%; $1 to 5 million, 110% against 40%; $5 to 20 million, 90% against 30%; $20 to 50 million, 60% against 35%; above $50 million, 40% against 15%. Companies with high net retention and low payback (13% of the sample) average 71% growth ([Growth Unhinged, 2025 SaaS Benchmarks](https://www.growthunhinged.com/p/2025-saas-benchmarks-report)). That group has a Rule of 40 score of 47, against 10% growth for companies with low retention and high payback, and best-in-class recurring revenue per employee is $350,000 at $20 to 50 million in recurring revenue ([Growth Unhinged, 2025 SaaS Benchmarks](https://www.growthunhinged.com/p/2025-saas-benchmarks-report)). Benchmarkit's median growth is 26% with a top quartile of 50% ([Benchmarkit 2025 B2B SaaS Performance Metrics](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### Nordic benchmarks

**[FAST-MOVING, 2025 data]** Monterro's Nordic survey (236 software companies) reports growth of 25% (32% in 2024), net revenue retention of 104.4% (116% for companies monetising AI), churn of 5.5%, acquisition-cost payback of 14.0 months (top quartile 6, bottom quartile 18), revenue per full-time employee of EUR 150,000 and an average net promoter score of 42 (47 in 2024) ([Monterro Nordic Software Benchmark 2026](https://www.monterro.com/benchmark-report-2026/)). **[GAP]** European data is thin: this is the only regional benchmark with numbers read, and it reports no win rates or quota attainment. A European SaaS benchmark from HubSpot exists but is gated ([HubSpot for Startups, European SaaS Benchmark 2025](https://offers.hubspot.com/european-saas-benchmark-2025)).
