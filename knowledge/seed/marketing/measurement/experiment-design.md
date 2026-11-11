---
id: marketing.measurement.experiment-design
department: marketing
domain: measurement
title: Fix the test design before launch, analyse once, and expect most tests not to win
summary: Set confidence, power, minimum detectable effect and runtime before launch and analyse once; most A/B tests do not win, so plan for it, and use qualitative research when traffic is too thin for a powered test.
type: checklist
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives: []
sources:
- https://cxl.com/ab-test-calculator/
- https://ppc.land/meta-says-partnership-ads-cut-incremental-purchase-costs-45-in-emea-tests/
- https://www.optimizely.com/insights/blog/metrics-for-your-experimentation-program/
- https://www.metricuno.com/experimentation-benchmarks
- https://www.exp-platform.com/Documents/2016-12PavelUPittNR.pdf
- https://www.conversionteam.com/ab-test-win-rate/
- https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/
- https://www.nngroup.com/articles/which-ux-research-methods/
related:
- marketing.measurement.triangulation
- marketing.conversion.what-converts
- marketing.creative.cross-platform-creative-rules
seed_version: 1
---

**When to use this:** Before launching any A/B test, lift test or landing-page experiment.

## Fix the test design before launch and analyse once

**[DURABLE]** CXL's guidance for A/B tests is 95% confidence and 80% power, with baseline conversion rate, number of variants, minimum detectable effect and weekly traffic as inputs that determine runtime. Reach the planned sample before analysing and analyse once, because repeated looks inflate false positives ([CXL](https://cxl.com/ab-test-calculator/)). **[INFERENCE]** With low traffic, compute the detectable effect first; if it exceeds any plausible uplift, test bolder variants or use qualitative research instead of an under-powered test. **[PLATFORM CLAIM, Oct 2026]** Meta's suggested durations are 3 to 4 weeks for brand lift and 3 to 8 weeks for conversion lift, covering at least one conversion cycle ([PPC Land, 11 Oct 2026](https://ppc.land/meta-says-partnership-ads-cut-incremental-purchase-costs-45-in-emea-tests/)). Base rates for how often tests win are in section 14.

## Most A/B tests do not win; plan for it

**[DURABLE]** Optimizely reports that only **12% of experiments win** (blog dated 23 December 2024; reported as drawn from more than 127,000 experiments), that over 90% of experiments target five metrics (call-to-action clicks, revenue, checkout, registration, add-to-cart), and that the highest-uplift programmes run more complex tests with more variations ([Optimizely](https://www.optimizely.com/insights/blog/metrics-for-your-experimentation-program/); [Metricuno](https://www.metricuno.com/experimentation-benchmarks)). At Microsoft roughly one third of ideas tested were positive and significant, one third flat and one third negative, with Bing's success rate lower ([Dmitriev, 2016](https://www.exp-platform.com/Documents/2016-12PavelUPittNR.pdf)). Other reported rates are unverified secondary figures (VWO roughly 1 in 7; 20% of 28,304 tests at CXL and Convert) ([Conversion Team](https://www.conversionteam.com/ab-test-win-rate/)). **[INFERENCE]** With base win rates of 12 to 33%, a programme reporting much higher win rates probably has weak stopping rules or metric selection. Agents should plan on most tests being flat, value them for learning, and apply the design discipline in section 3 (fixed sample, one analysis).

## Use qualitative research when traffic is thin

**[DURABLE; Jakob Nielsen, 2000]** Nielsen Norman Group recommends usability testing with no more than 5 users per round and running many small rounds, and maps 20 research methods by attitudinal versus behavioural and qualitative versus quantitative dimensions ([NN/g](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/); [NN/g](https://www.nngroup.com/articles/which-ux-research-methods/)). Switch interviews with recent buyers (section 1) are the equivalent for messaging.
