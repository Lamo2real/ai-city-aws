---
id: marketing.measurement.triangulation
department: marketing
domain: measurement
title: Triangulate attribution, MMM and experiments; platform ROAS errs in both directions
summary: Use attribution for fast feedback, MMM for cross-channel allocation and experiments as ground truth; platform ROAS can overstate or understate incremental ROAS, and user-level data stays incomplete despite Chrome keeping third-party cookies.
type: principle
audience: manager
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives: []
sources:
- https://www.haus.io/open-haus/attribution-vs-traditional-mmm-vs-incrementality-the-ultimate-measurement-showdown
- https://getrecast.com/top-consumer-brands-dont-pick-one-measurement-method-they-triangulate
- https://geniusmonkey.com/blog/incrementality-testing/
- https://jetfuel.agency/meta-ads-attribution-settings-in-2026-windows-best-practices-and-what-dtc-brands-get-wrong/
- https://www.brainlabsdigital.com/meta-ads-strategy-2026-whats-driving-performance-now/
- https://www.freevacy.com/news/consent-brief/whats-changed-in-the-6-months-since-google-killed-its-privacy-sandbox/7280
- https://www.cookieyes.com/knowledge-base/cookies-101/is-google-ending-privacy-sandbox.md
related:
- marketing.measurement.lift-tests-and-mmm-tools
- marketing.measurement.experiment-design
- marketing.measurement.ltv-cac-benchmarks
seed_version: 1
---

**When to use this:** When choosing a measurement approach, reporting platform numbers, or reconciling channels that disagree.

## Use three methods, each for the job it does well

**[DURABLE]** Last-touch attribution gives all credit to the final touchpoint and overvalues paid search and retargeting; multi-touch attribution is not causal; MMM is correlational, and different models can fit the same data while disagreeing on channel contribution; experiments give causal lift but cover one campaign and one period and cost withheld spend. The recommended division is attribution for fast feedback, MMM for cross-channel budget allocation, and experiments as ground truth used to reject MMM variants or to set priors ([Haus](https://www.haus.io/open-haus/attribution-vs-traditional-mmm-vs-incrementality-the-ultimate-measurement-showdown)). **[VENDOR]** Recast reports that of 42 top consumer brands in its database, more than 40% use at least two methods and about 20% use all three; its workflow has lift tests calibrate the MMM, which then produces correction factors for platform numbers, with the largest channel tested quarterly and smaller channels annually ([Recast](https://getrecast.com/top-consumer-brands-dont-pick-one-measurement-method-they-triangulate)). **[VENDOR]** Below roughly $100K a year in ad spend, rely on platform tools and consistency, adding MMM and experiments as spend grows ([Haus](https://www.haus.io/open-haus/attribution-vs-traditional-mmm-vs-incrementality-the-ultimate-measurement-showdown)). **[FAST-MOVING, 2026; secondary]** The IAB's 2026 State of Data is reported as finding that among US buy-side decision-makers 76% use incrementality tests, 73% attribution and 67% media mix modelling ([Genius Monkey, Oct 2026](https://geniusmonkey.com/blog/incrementality-testing/)).

## Platform ROAS errs in both directions

**[VENDOR, Aug 2026]** Haus geo-tests show platform-reported ROAS overstating incremental ROAS by 1.5 to 3 times, widest for retargeting ([Jetfuel, 7 Aug 2026](https://jetfuel.agency/meta-ads-attribution-settings-in-2026-windows-best-practices-and-what-dtc-brands-get-wrong/)). **[PLATFORM CLAIM, via agency]** The opposite bias also exists: 31% of incremental conversions driven by Meta are attributed to other channels, and H&M reported a threefold improvement in incremental ROAS over two years after calibrating MMM with Conversion Lift experiments ([Brainlabs, 19 May 2026](https://www.brainlabsdigital.com/meta-ads-strategy-2026-whats-driving-performance-now/)). **[INFERENCE]** Agents should report platform numbers as directional, keep a blended metric as the top-line check, and label every number with the method that produced it.

## Third-party cookies survive in Chrome, but user-level data stays incomplete

**[FAST-MOVING, status as of mid-2026]** Google retired Privacy Sandbox on 17 October 2025; Chrome continues to support third-party cookies subject to consent, while Safari and Firefox keep strict blocking ([Freevacy, 7 Apr 2026](https://www.freevacy.com/news/consent-brief/whats-changed-in-the-6-months-since-google-killed-its-privacy-sandbox/7280)). The retired technologies include the Topics API, Protected Audience and Attribution Reporting; CHIPS, FedCM and Private State Tokens remain, and consent under GDPR and ePrivacy is still required for cookies ([CookieYes, 25 Jun 2026](https://www.cookieyes.com/knowledge-base/cookies-101/is-google-ending-privacy-sandbox.md)). **[INFERENCE]** Because of browser blocking and EU consent rates, consent-based first-party data and aggregate methods remain the durable foundation regardless of Chrome's reversal.
