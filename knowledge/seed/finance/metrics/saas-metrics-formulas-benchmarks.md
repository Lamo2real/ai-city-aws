---
id: finance.metrics.saas-metrics-formulas-benchmarks
department: finance
domain: metrics
title: 'Finance: SaaS metrics: formulas, mistakes and 2025 to 2026 benchmarks'
summary: 'SaaS metrics: formulas with definitions (ARR, NRR, GRR, churn, CAC ratios and payback, LTV, burn, runway, burn multiple, Rule of 40), common mistakes and 2025 to 2026 benchmarks (Benchmarkit, SaaS Capital, High Alpha, KeyBanc, Monterro Nordic, ICONIQ and Bessemer on AI margins).'
type: benchmark
audience: both
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- metrics
- planning
sources:
- https://chartmogul.com/reports/saas-retention-report/
- https://a16z.com/16-startup-metrics/
- https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/
- https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf
- https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200
- https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf
- https://www.growthunhinged.com/p/2025-saas-benchmarks-report
- https://www.highalpha.com/blog/webinar-recap-unpacking-the-saas-benchmarks-report-2025
- https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey
- https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf
- https://www.monterro.com/news/monterro-benchmark-report-2026/
- https://www.iconiq.com/growth/insights/state-of-ai-2026
- https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook
- https://www.bvp.com/atlas/the-state-of-ai-2025
- https://www.bvp.com/atlas/scaling-to-100-million
related:
- finance.planning.budgeting-and-forecasting
- finance.cash.cash-runway-treasury-currency
- finance.house-style.money-models-cash-flow-design
seed_version: 1
---

**When to use this:** When calculating or benchmarking a SaaS metric: ARR, NRR, GRR, churn, CAC and payback, LTV, burn multiple, Rule of 40, and 2025 to 2026 benchmarks including the Nordic set.

**Source section:** 13. SaaS metrics: formulas, mistakes and 2025 to 2026 benchmarks

### State the definition next to every metric

**[INFERENCE]** Formula definitions differ between sources, so every reported metric carries its definition, period and source. The mistakes the sources imply are: mixing bookings, billings and revenue; counting one-off fees in ARR; reporting NRR without GRR; presenting blended CAC as paid CAC; computing payback on revenue instead of gross margin; building LTV from a churn rate measured on a young, small cohort; and ignoring inference and token costs in COGS when claiming a SaaS-like gross margin.

### ARR and what it excludes

**[DURABLE]** ARR equals MRR times 12 in ChartMogul's glossary, which calls ARR "annual run rate" ([ChartMogul SaaS Retention Report, Nov 2023, 2022 data](https://chartmogul.com/reports/saas-retention-report/)). ARR counts recurring revenue only and excludes one-time and professional-service fees; common errors are including non-recurring fees and using bookings in place of recurring revenue ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)).

### NRR, GRR and churn

**[DURABLE]** Net revenue retention is current-period recurring revenue from customers who were customers 12 months earlier, divided by total recurring revenue 12 months earlier, and includes upsell, cross-sell and price increases. Gross revenue retention uses the same formula excluding upsell, cross-sell and price increases, so it cannot exceed 100%. Churn is approximately one minus GRR, and retention should be measured by following a cohort ([SaaS Capital, retention benchmarks, 18 Sept 2025](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/)). Monthly logo churn is customers lost divided by prior-month customers; gross MRR churn is MRR lost divided by opening MRR; net churn subtracts upsell MRR, and relying on net churn alone understates losses ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). **[INFERENCE]** Because price increases inflate NRR and not GRR, report both, and show NRR with and without the price effect in any period where a price rise lands.

### CAC ratios, payback and related efficiency formulas

**[DURABLE; VENDOR definitions]** Benchmarkit's definitions are: blended CAC ratio equals total sales and marketing divided by new-customer ARR plus expansion ARR; new CAC ratio equals total sales and marketing divided by new-customer ARR; expansion CAC ratio equals sales and marketing plus customer-success cost allocated to expansion, divided by expansion ARR; CAC payback in months equals sales and marketing divided by new-customer ARR times subscription gross margin, times 12; CLTV:CAC equals average ARR per account times gross margin divided by churn rate, divided by CAC per new customer; magic number equals current-quarter revenue minus prior-quarter revenue, divided by prior-quarter sales and marketing; burn multiple equals net burn divided by net new ARR over the last twelve months; ARR per FTE equals period-end ARR divided by period-end employees; ARR to capital equals period-end ARR divided by lifetime capital raised; and expansion ARR share equals expansion ARR divided by new plus expansion ARR ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)). A magic number of 0.75 is described as the low-water mark and above 1.0 as ideal ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### LTV and CAC as a16z defines them

**[DURABLE]** In a16z's definition LTV equals monthly contribution margin times one divided by monthly churn; the stated common error is using revenue or gross margin where contribution belongs, and with little history a company should measure realised 12-month and 24-month LTV instead of projecting a lifespan. Blended CAC across all new customers, including organic, hides whether paid acquisition is profitable, so paid CAC is shown separately by channel, and CAC includes referral fees, credits and discounts ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)).

### Burn, runway and the burn multiple

**[DURABLE]** Gross burn is monthly cash outlays, net burn is gross burn less incoming cash, and investors use net burn for runway ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). The burn multiple is net burn divided by net new ARR; its originator's text reference points are that about 2x is reasonable for an early-stage company, 3x or more signals heavy spend for the growth achieved, and 5x is poor. **[FAST-MOVING, April 2020]** Those thresholds were published in April 2020 and may be dated, and the full threshold table is an image that was not readable ([David Sacks, The Burn Multiple, April 2020](https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200)). Benchmarkit reports a burn multiple target below 1.0 at $25 to 50M ARR (N=130) ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### Rule of 40

**[GAP; unverified working knowledge]** The Rule of 40 is commonly computed as revenue or ARR growth percentage plus a profit margin percentage (EBITDA or free cash flow, stated explicitly). No page read defines it; the benchmark sources use it without a formula. State the margin measure whenever it is reported.

### Benchmarkit 2025: growth, CAC and retention medians

**[VENDOR; FAST-MOVING, CY-2024 data]** Benchmarkit's 2025 report (roughly 563 to 583 participants, with much smaller samples per metric) reports median growth of 26%, the third straight annual decline, with the 75th percentile at 50% (N=149); 30% for venture-backed and 13% for private-equity-backed companies; and 44% for usage-based pricing against 25% for subscription. The median new CAC ratio was $2.00 of sales and marketing per $1.00 of new-customer ARR, up 14% in 2024, with the fourth quartile at $2.82 (N=73); the expansion CAC ratio median was $1.00, against $0.61 to $0.69 in 2020 to 2022. GRR was 88% (N=225, down from 90% over three years), with usage-based at 92% and subscription and hybrid at 88%; NRR was 101% (N=228, against 105% in calendar 2021), with hybrid pricing at a 110% median; both rise with ACV. Expansion ARR was 40% of total new ARR at the median (N=81) and 58% at $50 to 100M ARR ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### Benchmarkit 2025: margins, cost ratios and productivity

**[VENDOR; FAST-MOVING, CY-2024 data]** Benchmarkit reports total gross margin of 77% at the median (N=196), subscription gross margin of 81% (N=76), professional-services margin of 30% (N=38), and services at about 15% of revenue. Median operating costs as a share of revenue were 37% for sales and marketing, 34% for R&D and 24% for G&A, with sales and marketing at 45% for venture-backed against 33% for private-equity-backed companies; public medians are 23% for R&D and 17% or lower for G&A. ARR per FTE was $240,000 at $50 to 100M ARR and $283,379 above $100M (N=174), and Rule of 40 medians for Canadian and EMEA companies were 23 to 25% ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)). The PDF states participant counts of both 583 and 563 and gives a survey window that looks like a typo, and several charts, including CAC payback and CLTV:CAC, were unreadable images.

### Derived payback from Benchmarkit's medians

**[INFERENCE]** Benchmarkit's median new CAC ratio of $2.00 and subscription gross margin of 81% imply a new-logo CAC payback of about 30 months under Benchmarkit's own formula (2.00 divided by 0.81, times 12). The report's own payback chart was unreadable, so this figure is derived and not reported ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### SaaS Capital 2025: growth by ARR band

**[VENDOR; FAST-MOVING, Q1 2025 survey of 2024 results]** SaaS Capital's survey of more than 1,000 private B2B SaaS companies above $1M ARR found overall median growth of 25% in 2024, against 30% in 2023. The table gives growth by ARR band ([SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf)).

| ARR band | 25th percentile | Median | 75th percentile | Source |
|---|---|---|---|---|
| Under $1M | 20% | 40% | 100% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |
| $1M to $3M | 14% | 28% | 50% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |
| $3M to $5M | 10% | 24% | 40% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |
| $5M to $10M | 13% | 24% | 42% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |
| $10M to $20M | 8% | 20% | 37% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |
| Over $20M | 10% | 20% | 31% | [SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf) |

### SaaS Capital 2025: bootstrapped versus equity-backed, and growth by NRR

**[VENDOR; FAST-MOVING, Q1 2025 survey of 2024 results]** Bootstrapped companies grew a median 23% against 25% for equity-backed companies; 85% of bootstrapped companies were at breakeven or better (within two points) against 46% of equity-backed; and equity-backed companies spend 89% more on sales and 100% more on marketing. Median growth rises with NRR: 15% below 100% NRR, 20% at 100 to 110%, 30% at 110 to 120%, 32% at 120 to 130% and 44% above 130% ([SaaS Capital, Benchmarking Private SaaS Company Growth Rates 2025 (PDF)](https://www.saas-capital.com/wp-content/uploads/2025/06/RB33WS5-2025-B2B-Benchmarking-Private-SaaS-Company-Growth-Rates.pdf)). At ACV of $25k to $50k, NRR was 97% at the bottom quartile, 102% at the median and 111% at the top quartile; the sample size and overall medians were in charts only ([SaaS Capital, retention benchmarks, 18 Sept 2025](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/)).

### High Alpha 2025: AI-native versus other B2B SaaS

**[VENDOR; FAST-MOVING, fielded Aug to Sept 2025, published 12 Nov 2025]** High Alpha's report on more than 800 companies (69% US, 17% Europe) gives median growth for AI-native against other B2B SaaS by ARR band: under $1M, 100% against 75%; $1M to $5M, 110% against 40%; $5M to $20M, 90% against 30%; $20M to $50M, 60% against 35%; above $50M, 40% against 15%. Gross margin fell nearly 10 points year on year for early-stage companies, and AI-native companies run about 5 points below SaaS peers. Best-in-class ARR per FTE was $350k at $20M to $50M ARR and $400k above $50M ([Kyle Poyar, Growth Unhinged, 2025 SaaS benchmarks report, 12 Nov 2025](https://www.growthunhinged.com/p/2025-saas-benchmarks-report)).

### High Alpha 2025: retention and payback together predict growth

**[VENDOR; FAST-MOVING, fielded Aug to Sept 2025]** In High Alpha's matrix, companies with high NRR and low CAC payback (13% of the sample) averaged 71% growth and a Rule of 40 score of 47%, while those with low NRR and high payback (12%) averaged 10% growth and a score of 5%. Seventy per cent had launched AI features, 22% had them on the roadmap, and 36% said AI is core to the product ([Kyle Poyar, Growth Unhinged, 2025 SaaS benchmarks report, 12 Nov 2025](https://www.growthunhinged.com/p/2025-saas-benchmarks-report)). Reported AI-linked headcount reductions were most common in engineering (42%), customer success and support (27%) and marketing (26%), more often at larger companies ([High Alpha webinar recap, late 2025](https://www.highalpha.com/blog/webinar-recap-unpacking-the-saas-benchmarks-report-2025)).

### KeyBanc and Sapphire 2025

**[VENDOR; FAST-MOVING, 2025]** The 16th annual KeyBanc and Sapphire survey reports gross retention near 90% and net retention above 100%, EBITDA margins improving since 2022 and expected to turn positive by 2026, account-executive payback expected to shorten to 18 months by 2026, over half of respondents planning AI budget increases of 20% or more, and two-thirds already monetising AI through subscription or hybrid pricing. The sample size was not on the landing page and the full report was not opened ([Sapphire Ventures, 2025 KeyBanc and Sapphire SaaS Survey page](https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey)).

### Monterro 2026: the Nordic reference set

**[VENDOR; FAST-MOVING, 2025 data, published 19 April 2026]** Monterro's fifth Nordic B2B software benchmark covers 236 companies with about EUR 1.7 billion of combined revenue and 12,000 employees: Sweden 57%, Denmark 14%, Norway 13%, Finland 12%; 52% enterprise-sales led and 7% product-led; 47% vertical, 46% horizontal and 7% business-to-government. The publisher is an investor in the segment. Average revenue growth was 25% in 2025 (32% in 2024, 35% in 2023); average EBIT margin 4% (0% in 2024, minus 1% in 2023); the Rule of 40 median 22%, down 4 points, and average 28%; and revenue per FTE EUR 150k (160k in 2024, 180k in 2023) ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)).

### Monterro 2026: retention and go-to-market

**[VENDOR; FAST-MOVING, 2025 data, published 19 April 2026]** Average NRR was 104.4% (105.3% in 2024), with median NRR of 103 to 106% across customer-size bands and the top quartile at 108 to 112%. Average churn was 5.5% (5.6%); median gross churn falls from 6% for accounts under EUR 15k a year to 3% at EUR 35k to 100k and 2% above EUR 100k, with the top quartile from 4% down to 0%. Average CAC payback was 14.0 months (14.6), with the top quartile at about 6 months and the bottom quartile at about 18. Enterprise sales cycles run about 9 months, inside sales 4.3 months, and deals above EUR 100k average 11.7 months; median marketing spend is 3% of revenue ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)).

### Monterro 2026: pricing, AI and sentiment

**[VENDOR; FAST-MOVING, 2025 data, published 19 April 2026]** The average price increase was 5.9% in 2025 (6.8% in 2024), and nearly half of companies use three or more pricing models, with feature-based and usage-based pricing rising. Sixty per cent are implementing or integrating AI in the product (42% in 2024); 43% earn some AI-related revenue (34%), 9% see significant monetisation, and 36% say customers use AI features without paying; AI-monetising companies average NRR of 116% against 104%. Internally, 97% report positive effects from AI but only 27% report measurable cost reductions. Sixty-four per cent expect faster growth in 2026 (51% a year earlier), and NPS fell from 47 to 42 overall and from 42 to 30 in the SMB segment ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf); [Monterro press release, 2026](https://www.monterro.com/news/monterro-benchmark-report-2026/)).

### Nordic reference points for a board pack

**[INFERENCE]** For a Swedish SaaS company the Monterro figures give indicative reference points: growth about 25%, NRR about 104%, annual churn about 5 to 6%, CAC payback about 14 months and price increases about 6%. They are mostly averages from a self-reported survey run by an investor, and several chart-derived figures were hard to read and are left out, so treat them as indicative.

### AI product economics: ICONIQ and Bessemer

**[VENDOR; FAST-MOVING, 2025-2026]** ICONIQ's 2026 survey (about 300 to 305 executives building AI products, Q2 2026, 87% North America and 13% Europe) reports AI product gross margin of 45% in 2025, with 53% projected for 2026 and 59% for 2027; inference's share of cost rises as products move from beta to general availability; and internal AI productivity spend is projected at 11% of revenue in 2025, 16% in 2026 and 19% in 2027, with G&A headcount planned to contract ([ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026)). Bessemer puts AI companies at roughly 50 to 60% gross margin against 80 to 90% for SaaS in February 2026 ([Bessemer, AI pricing and monetization playbook, Feb 2026](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)), and in August 2025 described AI "Supernovas" reaching about $40M ARR in year one at about 25% (often negative) gross margin and about $1.13M ARR per FTE, and "Shooting Stars" growing from about $3M to $12M, $40M and $103M over four years at about 60% gross margin and about $164k ARR per FTE ([Bessemer, State of AI 2025, Aug 2025](https://www.bvp.com/atlas/the-state-of-ai-2025)).

### Report AI gross margin separately

**[INFERENCE]** For AI features, gross margin should be reported both in total and for the AI product line, with inference cost per unit of the value metric tracked monthly, because the 45% AI product average is far below the 77 to 81% SaaS medians ([ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026); [Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### Older benchmarks that should not be used as current

**[VENDOR; FAST-MOVING, Sept 2021 and Nov 2023, possibly outdated]** Bessemer's September 2021 peak-market data gave median and top ARR growth at $1M to $10M ARR of 165% and 230% or more, NRR of 125% and 145% or more, gross retention of 85 to 90%, CAC payback averaging 15 months at $1M to $10M ARR with targets below 12 months for SMB, 18 for mid-market and 24 for enterprise, and a best-in-class cash conversion score of 1x or more ([Bessemer, Scaling to $100 Million, Sept 2021](https://www.bvp.com/atlas/scaling-to-100-million)). ChartMogul's November 2023 report on 2022 data from more than 2,100 SaaS businesses gave top-quartile NRR of 94% at $1M to $3M ARR, 99% at $3M to $15M and above 105% at $15M to $30M; top-quartile NRR of 65.1% for ARPA under $10 a month and 109.3% above $500 a month; top-quartile GRR above 90% for ARPA above $500 a month against 60 to 70% below $50; contraction of up to 40% of MRR lost; and top-quartile new-customer cohorts retaining about 90% at 3 months and 70% at 12 months ([ChartMogul SaaS Retention Report, Nov 2023, 2022 data](https://chartmogul.com/reports/saas-retention-report/)). Use them only for the direction of relationships such as retention rising with price point.

### Gaps on SaaS metrics

**[GAP]** Not captured: 2026 editions of Benchmarkit and High Alpha; ChartMogul's 2025 or 2026 retention data and any AI-native churn findings; the KeyBanc and Sapphire sample size, gross margin, CAC payback and Rule of 40 medians; High Alpha's exact NRR, GRR, CAC payback and burn-multiple medians; SaaS Capital's overall median NRR and GRR for 2025; Monterro's median and top-quartile growth, cost ratios and valuation data; and any cohort-analysis method beyond the SaaS Capital and a16z definitions.
