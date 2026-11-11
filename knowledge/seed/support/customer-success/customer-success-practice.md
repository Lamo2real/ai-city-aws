---
id: support.customer-success.customer-success-practice
department: support
domain: customer-success
title: 'Customer support: Customer success practice'
summary: Retention benchmarks and their samples, voluntary and involuntary churn, dunning, health scoring with four to six inputs and its pitfalls, segment scorecards, score-driven plays and expansion signals, renewals, the cancellation flow and win-back.
type: playbook
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- retention
- expansion
sources:
- https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/
- https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/
- https://www.bvp.com/atlas/scaling-to-100-million
- https://recurly.com/research/churn-rate-benchmarks/
- https://www.gainsight.com/customer-success-best-practices/how-to-score-customer-health/
related:
- support.voice-of-customer.voice-of-the-customer
- support.house-style.usage-tracking-and-belonging
seed_version: 1
cross_refs:
  '9':
  - support.house-style.upsell-downsell-continuity
  '21':
  - support.compliance.swedish-and-eu-consumer-law
---

**When to use this:** When working on retention benchmarks, failed payments, health scores, renewals or win-back.

**Source section:** 20. Customer success practice

### Retention benchmarks differ by sample, so name the sample

[VENDOR] [FAST-MOVING, 2025] Three benchmark sets were found and they disagree because their samples differ. ChartMogul starts at $250,000 ARR and includes many small self-serve companies; SaaS Capital starts at $1 million ARR and the quoted band is mid-ACV; Bessemer is a venture portfolio of selected high-growth companies and is five years old.

| Source and date | Sample | Figures | Link |
|---|---|---|---|
| ChartMogul and Kyle Poyar, 10 December 2025 | About 3,500 software companies above $250k ARR (about 2,700 B2B SaaS, 600 B2C SaaS, 200 AI-native), annualised 2025 retention | B2B SaaS median NRR 82%, upper quartile 97%; B2C SaaS median NRR 49%; AI-native median GRR 40% and NRR 48% | [ChartMogul](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/) |
| ChartMogul, same report, AI-native by price point (about 50 companies per bucket, directional) | AI-native companies | Above $250 a month: GRR 70%, NRR 85%. $50 to $249: GRR 45%, NRR 61%. Under $50: GRR 23%, NRR 32% | [ChartMogul](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/) |
| SaaS Capital, 18 September 2025 | Private B2B SaaS above $1M ARR, ACV $25k to $50k band | Median NRR 102%, top quartile 111%, bottom quartile 97%; median growth 24% | [SaaS Capital](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/) |
| Bessemer, 21 September 2021 | Bessemer's own cloud portfolio, 2010 to first half 2021, not a random sample | Gross retention 85 to 90%; median NRR 125% at $1 to 10M ARR, 117% at $10 to 25M, 120% at $25 to 100M, 115% above $100M | [Bessemer](https://www.bvp.com/atlas/scaling-to-100-million) |

### What the retention benchmarks imply for support

[VENDOR] [FAST-MOVING, 2025] In ChartMogul's data AI-native gross retention rose from 27% in January 2025 to 40% in September 2025, median NRR is 10 to 20 percentage points higher on annual than monthly plans, and retention rises steeply with price point ([ChartMogul, 10 December 2025](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/)). SaaS Capital finds companies with NRR of 110% or more grew faster than the median and those under 100% slower, with retention rising with ACV ([SaaS Capital, 18 September 2025](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/)). [INFERENCE] Spend human time where price per account is high, and automate the long tail.

### Voluntary and involuntary churn

[VENDOR] [CONTESTED] [FAST-MOVING, July 2026] Recurly's network benchmarks (labelled July 2026, sample size not stated) give average total churn of 3.27% with 2.34% voluntary and 1.25% involuntary, and for SaaS 3.22% total, 2.16% voluntary and 1.06% involuntary; another section of the same page gives 3.04% for software with a top quartile of 1.78% or lower. The page is internally inconsistent and the period is unclear: the fetched summary called the rates annual, while figures of this size are what Recurly has usually reported as monthly. Check the period on the page before quoting ([Recurly](https://recurly.com/research/churn-rate-benchmarks/)).

### Involuntary churn falls steeply as price rises

[VENDOR] [FAST-MOVING, July 2026] Recurly by average revenue per customer per month, with the same period caveat as above.

| Revenue per customer per month | Total churn | Voluntary | Involuntary | Source |
|---|---|---|---|---|
| $10 to $25 | 4.29% | 2.99% | 1.30% | [Recurly](https://recurly.com/research/churn-rate-benchmarks/) |
| $25 to $50 | 3.84% | 2.73% | 1.11% | [Recurly](https://recurly.com/research/churn-rate-benchmarks/) |
| $50 to $100 | 3.15% | 2.41% | 0.74% | [Recurly](https://recurly.com/research/churn-rate-benchmarks/) |
| $100 to $250 | 2.87% | 2.40% | 0.46% | [Recurly](https://recurly.com/research/churn-rate-benchmarks/) |
| Over $250 | 3.07% | 2.90% | 0.18% | [Recurly](https://recurly.com/research/churn-rate-benchmarks/) |

### Support should see the dunning flow

[INFERENCE] Recurly's split means roughly a third of subscription churn is involuntary on average and far more at low price points. Failed-payment contacts are saveable, so support should own or at least see the dunning flow and treat payment-failure tickets as retention work shared with Finance.

### Health scoring: four to six predictive inputs, weighted and banded

[VENDOR] Gainsight's published method (first published 16 March 2022, modified 22 August 2025; its weights and bands are examples, not validated benchmarks) uses five input families: behavioural (feature adoption, login frequency), support (ticket volume, resolution time), relationship (executive engagement, customer-success interactions), financial (renewals, invoice history, upsells) and feedback (NPS, CSAT, community activity). Choose four to six metrics that actually correlate with success or risk, prefer a 0 to 100 number over plain red, amber, green, and set a refresh cadence. Its example weighting is usage 40%, support 25%, sentiment 20% and executive engagement 15%, with bands of healthy 71 to 100, at risk 31 to 70 and critical 0 to 30 ([Gainsight](https://www.gainsight.com/customer-success-best-practices/how-to-score-customer-health/)).

### Health-score pitfalls and validation

[VENDOR] Gainsight says to weight by what has historically predicted churn or renewal and retest often, and names four pitfalls: too much reliance on subjective inputs, too many or too few metrics, unvalidated weights, and never revisiting the model; it gives no backtesting procedure and does not say how raw metrics are normalised ([Gainsight](https://www.gainsight.com/customer-success-best-practices/how-to-score-customer-health/)). [INFERENCE] Start with Gainsight's example weights, then re-weight after two quarters by comparing the scores of churned and renewed accounts, and drop inputs that do not predict.

### Segment scorecards by lifecycle and touch model

[VENDOR] Gainsight recommends separate scorecards with different emphasis. Onboarding: milestone completion, login activation, support volume. Mature: ROI delivered, product depth, NPS and CSAT, upsell activity. High-touch: CSM sentiment, executive engagement, QBR cadence, roadmap alignment. Digital or tech-touch: in-app activity, knowledge-base use, feature-adoption trend ([Gainsight](https://www.gainsight.com/customer-success-best-practices/how-to-score-customer-health/)). [INFERENCE] The usual three tiers are high-touch (named CSM, business reviews, success plan) for the largest accounts, low-touch (pooled CSMs, triggered outreach) for the mid tier, and tech-touch (in-app guides, email sequences, community, AI support) for the long tail.

### Score-driven plays and expansion signals

[VENDOR] A score drop triggers an alert by segment or threshold and a playbook of tasks, email and outreach; remediation is a direct conversation to find the cause, targeted walkthroughs where usage fell, and shared data across customer success, product and sales; rising usage, positive sentiment or new teams appearing are expansion signals routed to customer success or sales ([Gainsight](https://www.gainsight.com/customer-success-best-practices/how-to-score-customer-health/)). [INFERENCE] Further expansion triggers visible in tickets are seat or usage limits being reached, a new team or use case appearing, and a customer asking how to do something a higher plan does; the house-style menu upsell in section 9 is the conversation structure.

### Renewals, cancellation flow and win-back

[INFERENCE] [GAP] No sourced renewal timeline, QBR format, CSM-to-account ratio, time-to-value benchmark or win-back rate was retrieved. As unsourced convention: start annual B2B renewals 90 to 120 days before term end; for Swedish consumers on fixed-term auto-renewing plans, build the sequence around the statutory reminder in section 21; design the cancellation flow as reason, one matched alternative, then cancellation in the same channel; and for win-back, record the cancellation reason and contact permission at exit and contact again when the stated reason is fixed, subject to marketing-consent rules that were not researched.
