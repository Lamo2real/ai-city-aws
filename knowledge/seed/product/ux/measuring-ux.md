---
id: product.ux.measuring-ux
department: product
domain: ux
title: 'Product: Measuring UX'
summary: 'Measuring UX: pair a behavioural measure with a standard attitude scale; System Usability Scale scoring and benchmarks (average
  68); UMUX-Lite; post-task and workload scales; Net Promoter Score and its limits for UX; HEART and performance metrics as UX measures.'
type: benchmark
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- measurement
sources:
- https://measuringu.com/sus/
- https://www.nngroup.com/articles/measuring-perceived-usability/
- https://measuringu.com/umux-lite/
- https://www.nngroup.com/articles/nps-ux/
- https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf
- https://web.dev/articles/vitals
related:
- product.metrics.metrics-and-experimentation
- product.ux.ux-fundamentals
seed_version: 1
cross_refs:
  '9':
  - product.metrics.metrics-and-experimentation
  '13':
  - product.ux.ux-fundamentals
---

**When to use this:** When measuring usability or satisfaction: scoring SUS or UMUX-Lite, choosing a post-task scale, or deciding whether NPS answers the question.

**Source section:** 16. Measuring UX

### Pair a behavioural measure with a standard attitude scale

**[INFERENCE]** The department pairs behavioural measures (task success, time on task, errors) with a standard attitude scale. A minimal set for a SaaS product: task success and time on 5 to 8 key tasks; the Single Ease Question after each task; UMUX-Lite in-product every quarter, because it is short enough for in-app surveys; the System Usability Scale in periodic benchmark studies; and Net Promoter Score only as a company-level loyalty number. The set is the researchers' synthesis from the NN/g and MeasuringU sources below.

### System Usability Scale: scoring

**[DURABLE]** The System Usability Scale (SUS) has 10 items on a 5-point scale. For odd-numbered items subtract 1 from the response; for even-numbered items subtract the response from 5; sum the results and multiply by 2.5 for a score from 0 to 100 ([MeasuringU, Measuring Usability with the SUS](https://measuringu.com/sus/)). A SUS score is not a percentage ([NN/g, How Do You Quantitatively Assess Usability?, reviewed 19 Aug 2026](https://www.nngroup.com/articles/measuring-perceived-usability/)).

### System Usability Scale: benchmarks

**[DURABLE; benchmark dataset first described in 2011, still cited in 2026]** The average SUS score across about 500 studies is 68. Above 80.3 is an A, the top 10%; 74 is about the 70th percentile; about 73 is the top 30%; below 51 is an F, the bottom 15%. Users who score a product above about 80 are more likely to recommend it. SUS can be run with very few users, but the estimate is imprecise, so report a confidence interval ([MeasuringU, Measuring Usability with the SUS](https://measuringu.com/sus/); [NN/g, How Do You Quantitatively Assess Usability?, reviewed 19 Aug 2026](https://www.nngroup.com/articles/measuring-perceived-usability/)). **[INFERENCE]** A reasonable internal bar is 74 or more with about 80 as the stretch goal; the grade bands are MeasuringU's curve and not a formal standard. **[GAP]** No refreshed 2025 to 2026 SUS norm was found.

### UMUX-Lite

**[DURABLE; pre-2024]** UMUX-Lite has two items: the system's capabilities meet my requirements, and the system is easy to use, on a 7-point scale in the original and a 5-point variant. It correlates with SUS at r = .83 and with Net Promoter Score at r = .72, and its reliability alpha is .86 against .91 for SUS. The published conversion on the 7-point version is: SUS-equivalent = 0.65 × ((item 1 + item 2 − 2) × 100/12) + 22.9 ([MeasuringU, UMUX-Lite](https://measuringu.com/umux-lite/)). **[GAP]** No numeric UMUX-Lite benchmark table was on the fetched page.

### Post-task and workload scales

**[DURABLE]** NN/g's guidance is to use the Single Ease Question after every task to find the hardest parts, to use SUS after the whole session for benchmarking, and to reserve NASA-TLX for complex, high-consequence domains, since it rarely suits consumer UX ([NN/g, How Do You Quantitatively Assess Usability?, reviewed 19 Aug 2026](https://www.nngroup.com/articles/measuring-perceived-usability/)).

### Net Promoter Score and its limits for UX

**[DURABLE; 21 Jun 2024]** Net Promoter Score is the percentage of promoters (scores of 9 to 10) minus the percentage of detractors (0 to 6) on a 0 to 10 likelihood-to-recommend question, with a range of −100 to +100 ([NN/g, Net Promoter Score, 21 Jun 2024](https://www.nngroup.com/articles/nps-ux/)).

**[CONTESTED; practitioner opinion with reasoning]** NN/g lists the limits of Net Promoter Score as a UX measure: it measures perception, so struggling users can still score high; its three bins discard detail, so a move from 2s to 5s shows no change; price, mandated use and brand also drive it; it rarely moves for specific interface changes; it is easy to game; and scores vary by country and industry. NN/g's recommendations are to keep the standard calculation, also report the mean rating with a margin of error, track it over time, pair it with task success and task time, and use adequate samples ([NN/g, Net Promoter Score, 21 Jun 2024](https://www.nngroup.com/articles/nps-ux/)).

### HEART and performance metrics as UX measures

**[DURABLE]** The HEART categories and the Goals-Signals-Metrics process (section 9; [Rodden, Hutchinson and Fu, Google, CHI 2010 paper (PDF)](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf)) and the Core Web Vitals thresholds (section 13; [web.dev, Web Vitals, updated 31 Oct 2024](https://web.dev/articles/vitals)) also serve as UX metrics. **[GAP]** Customer satisfaction (CSAT) benchmarks, task-success benchmarks such as an average completion rate, and time-on-task analysis methods were not sourced.
