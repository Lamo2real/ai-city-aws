---
id: support.metrics.metrics-and-benchmarks
department: support
domain: metrics
title: 'Customer support: Metrics and benchmarks'
summary: 'Support metrics and benchmarks: benchmark against your own history first, first response and resolution time, resolution time with AI, CSAT, FCR and why internal FCR overstates it, cost per contact, survey bias, AI-era measurement, a metric set for an AI-led department, and Swedish dispute outcomes.'
type: benchmark
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- resolution
sources:
- https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/
- https://www.getmacha.com/blog/customer-service-response-time-benchmarks
- https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai
- https://www.lorikeetcx.ai/articles/contact-center-benchmarks
- https://www.sqmgroup.com/pdf/WhatIsAGoodFCRRate2022.pdf
- https://www.gartner.com/en/newsroom/press-releases/2026-01-26-gartner-predicts-genai-cost-per-resolution-for-customer-service-will-exceed-offshore-human-agent-costs-by-2030
- https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/
- https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/
- https://www.intercom.com/blog/customer-service-transformation-report-2026/
- https://www.tsia.com/blog/the-state-of-support-services-2025
- https://www.arn.se/om-arn/statistik/
related:
- support.quality.quality-assurance
- support.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** When setting targets or judging performance: response and resolution times, CSAT, FCR, cost per contact, AI-era metrics.

**Source section:** 13. Metrics and benchmarks

### Benchmark against your own history first

[DURABLE] Published support benchmarks come almost entirely from vendors' own customer bases and vary by an order of magnitude between channels. Use them as rough orientation and measure mainly against your own trailing data. Report the median together with the 90th percentile for response time, since the median alone hides the slowest tickets ([thisandthat.chat](https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/)).

### First response and resolution time

[VENDOR] [FAST-MOVING, 2024 data published 2025] The Freshworks Customer Service Benchmark Report 2025 (1.2 billion tickets, more than 32,000 companies) was reached only through secondary summaries because the PDF returned an error; verify before publishing these figures externally.

| Measure (Freshworks 2025 report, 2024 data) | Top 20% | Median | Slowest tier | Source |
|---|---|---|---|---|
| All industries, ticket first response | about 3 min 10 s | about 1 hour | not given | [Macha summary](https://www.getmacha.com/blog/customer-service-response-time-benchmarks) |
| All industries, ticket resolution | not given | about 6 h 15 min | not given | [Macha summary](https://www.getmacha.com/blog/customer-service-response-time-benchmarks) |
| Software and internet, ticket first response | 2 min 20 s | 46 min 51 s | 6 h 10 min | [thisandthat.chat](https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/) |
| Software and internet, messaging first response | 10 s | 32 s | 2 min 40 s | [thisandthat.chat](https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/) |
| Software and internet, ticket resolution | 38 min | 7 h 14 min | 42 h 30 min | [thisandthat.chat](https://www.thisandthat.chat/blog/b2b-saas-first-response-time-benchmarks/) |

### Resolution time with AI assistance

[VENDOR] [FAST-MOVING, 2024 data] Freshworks reports resolution on real-time conversations falling from 41 minutes without AI assistance to 2 minutes with AI copilots, ticket resolution falling from 36 hours to 32 minutes with extensive AI use, and copilot users spending 56% less time summarising tickets; these are top-team figures with no stated sample size ([Freshworks, The Works](https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai)). Treat as an upper bound.

### CSAT

[VENDOR] [FAST-MOVING, 2024 data] Freshworks' top-quintile CSAT on messaging channels was 97.92% on Instagram, 96.15% on mobile apps and 95.63% on WhatsApp; these are best-in-class and not typical ([Freshworks, The Works](https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai)). [GAP] A blended CSAT target of 85% or higher is commonly quoted, but the page listing it gives no primary source ([Lorikeet](https://www.lorikeetcx.ai/articles/contact-center-benchmarks)).

### First contact resolution

[VENDOR] [FAST-MOVING, 2022] SQM Group, which sells benchmarking and QA services, studied more than 500 North American call centres (phone only, at least 400 post-call surveys each) in 2022: the industry average first call resolution was 71%, with individual centres from 40% to 91%; 70 to 79% is rated good, 80% or more world class and reached by about 5% of centres, and 49% of centres are below 70%; retail, non-profit and insurance average highest at 75%, while tech support and telecommunications sit in the needs-improvement group ([SQM Group, 2022](https://www.sqmgroup.com/pdf/WhatIsAGoodFCRRate2022.pdf)). This is the only traceable FCR benchmark found and it is four years old.

### Internally measured FCR overstates the true rate

[VENDOR] [FAST-MOVING, 2022] SQM measures FCR by asking the customer after the contact and says FCR measured internally from ticket data overstates the rate by 10 to 20 percentage points. Its claimed relationships are that each 1 point of FCR improvement goes with 1 point of customer satisfaction, 1% lower operating cost and 1.4 points of transactional NPS, and that 95% of customers stay when the issue is resolved on first contact ([SQM Group, 2022](https://www.sqmgroup.com/pdf/WhatIsAGoodFCRRate2022.pdf)). [INFERENCE] A team that measures FCR from its own ticket system should apply that 10 to 20 point correction until it adds a post-contact survey question; a realistic target band for a B2B SaaS desk is 70 to 79% customer-reported FCR.

### Cost per contact

[GAP] [FAST-MOVING, year not stated] A Gartner median cost per contact of $1.84 for self-service against $13.50 for assisted channels is quoted by a secondary source with no year ([Lorikeet citing Gartner](https://www.lorikeetcx.ai/articles/contact-center-benchmarks)); use it only as a ratio of roughly one to seven. [FAST-MOVING, January 2026] Gartner forecasts that GenAI cost per resolution will exceed $3 by 2030, above many offshore B2C human agents, driven by data-centre costs, vendors ending subsidised pricing and more complex use cases ([Gartner, 26 January 2026](https://www.gartner.com/en/newsroom/press-releases/2026-01-26-gartner-predicts-genai-cost-per-resolution-for-customer-service-will-exceed-offshore-human-agent-costs-by-2030)).

### Survey metrics understate dissatisfaction

[FAST-MOVING, October 2025] The Qualtrics XM Institute (more than 20,000 consumers in 14 countries including Sweden, third quarter of 2025) found only 29% of customers tell the company directly after a bad experience (down 7.5 points since 2021), 30% say nothing (up 9 points), and 47% of bad experiences lead to reduced spending ([Qualtrics, 7 October 2025](https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/)). [INFERENCE] Low survey volumes therefore understate dissatisfaction; pair surveys with behavioural signals such as recontact, reopening and silent abandonment of AI chats.

### AI-era measurement

[VENDOR] [FAST-MOVING, 2025 to 2026] Zendesk reports that organisations it classes as high-maturity achieve automation success rates of 66% against 21% for low-maturity ones and track AI-specific metrics at three times the rate ([Zendesk, 18 November 2025](https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/)). Intercom's 2026 report (more than 2,400 support professionals) says 62% saw metrics improve after implementing AI, 87% among those with mature deployment, but only 10% report mature deployment ([Intercom blog](https://www.intercom.com/blog/customer-service-transformation-report-2026/)). TSIA frames AI-era measurement around self-service success plus implicit and explicit case deflection, with benchmark values available to members only ([TSIA](https://www.tsia.com/blog/the-state-of-support-services-2025)).

### A metric set for an AI-led department

[INFERENCE] The researchers' recommended set, in six groups. Outcome: resolution rate verified by no recontact within 7 days, CSAT on both AI and human conversations, and customer effort on a sample. Speed: first response and time to resolution by priority, median and 90th percentile. Quality: QA score, incorrect-answer rate and policy-violation rate. Flow: backlog age, reopen rate, escalation rate and handoff wait time. Demand: contact rate per active account and top contact drivers. Cost: cost per resolved contact including AI fees and human review time. Vendor resolution metrics that count a customer going silent as resolved overstate success, so define a stricter measure of your own.

### Swedish dispute outcomes as a benchmark for escalated complaints

[FAST-MOVING, 2026] ARN's own statistics (primary source): 24,603 cases were filed in 2025 and 16,291 in the first half of 2026; consumers won wholly or partly in 39% of decided cases in 2024 and 2025 and 38% in the first half of 2026; companies followed the recommendation in 76% of cases the consumer won in 2024 and 2025, against 79% in 2023 ([ARN statistik](https://www.arn.se/om-arn/statistik/)).

### What was not found on metrics

[GAP] No sourced 2025 to 2026 figures were retrieved for NPS by industry, backlog norms, contact rate per customer, self-service or deflection rate, or cost per ticket. The Zendesk Benchmark, HubSpot's State of Service and TSIA values were not retrieved; one site's 5.4-hour SaaS median first reply was excluded as untraceable.
