---
id: marketing.meta-ads.attribution-changes-2026
department: marketing
domain: meta-ads
title: Meta attribution changed twice in 2026, breaking year-on-year comparisons
summary: Meta removed 7- and 28-day view windows in January 2026 and in March counted only link clicks as click-through, moving other clicks to engage-through with a 5-second video threshold; caveat any comparison across those dates.
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
objectives: []
sources:
- https://www.dataslayer.ai/blog/meta-ads-attribution-window-removed-january-2026
- https://www.facebook.com/business/news/click-attribution
- https://www.facebook.com/business/help/460276478298895
- https://www.facebook.com/business/help/1055388958765938
- https://theoptimizer.io/blog/how-meta-ads-attribution-actually-works-in-2026
- https://www.facebook.com/business/help/2366718460372682
- https://www.enrichlabs.ai/blog/meta-ads-attribution-settings-best-practices
related:
- marketing.meta-ads.capi-emq-and-conversion-lift
- marketing.measurement.triangulation
seed_version: 1
---

**When to use this:** When reporting Meta results over time, choosing an attribution setting, or comparing Meta with analytics.

## Tracking: two 2026 definition changes break year-on-year comparisons

**[FAST-MOVING, Jan and Mar 2026]** From 12 January 2026 the 7-day view and 28-day view windows were removed from the Ads Insights API, leaving 1-day view, 1-day click, 7-day click and 28-day click for reporting only ([Dataslayer, 19 Jan 2026](https://www.dataslayer.ai/blog/meta-ads-attribution-window-removed-january-2026)). On 3 March 2026 Meta announced that click-through attribution counts link clicks only (previously any click such as a like, share or save); conversions after those other actions moved into engaged-view, which was renamed **engage-through**; and the engaged video view threshold was cut from 10 seconds to **5 seconds**. Rollout began later in March 2026 for website and in-store conversion campaigns. Meta says this brings its numbers closer to tools such as Google Analytics and names Northbeam and Triple Whale as partners adding view signals ([Meta for Business, 3 Mar 2026](https://www.facebook.com/business/news/click-attribution)).

**[FAST-MOVING, Meta Help Center read 10 Nov 2026]** The Standard attribution model's windows for website and in-store conversions are now: click-through at 1 day or 7 days after a link click; view-through at 1 day after an impression; and engage-through at 1 day after a non-link-click action, which for video means the video was played for 5 seconds, or for 97% of its length if shorter than 5 seconds. Fifteen seconds is not a Meta attribution threshold; vendor explainers repeat the 10-to-5-second change and none found supports 15 seconds. Some accounts may still be on prior versions during rollout. Meta offers three attribution models at ad set level: Standard, Incremental, and Custom (which shares attribution data from an external analytics tool so delivery optimises to the advertiser's own logic), and results cannot be compared in the campaign table across ad sets using different models. iOS 14+ app campaigns have restricted settings (1-day for re-engagement under Aggregated Event Measurement, 1-day or 7-day click for installs, SKAdNetwork reported separately) ([Meta Business Help Center](https://www.facebook.com/business/help/460276478298895); [Meta Business Help Center](https://www.facebook.com/business/help/1055388958765938); [TheOptimizer](https://theoptimizer.io/blog/how-meta-ads-attribution-actually-works-in-2026)). **[INFERENCE]** Any comparison of Meta-attributed conversions across the January and March 2026 boundaries needs a caveat or a metric unaffected by the change, such as blended revenue or first-party orders.

**[FAST-MOVING, Meta Help Center read 10 Nov 2026]** Incremental attribution is a model that optimises delivery for incremental conversions using machine-learning models that predict whether a conversion was caused by an ad, and it enables both optimisation and reporting on incremental conversions; the help page gives no eligibility rules, minimums or numbers ([Meta Business Help Center](https://www.facebook.com/business/help/2366718460372682)). It is a platform estimate, not a replacement for geo tests or holdouts ([Enrich Labs](https://www.enrichlabs.ai/blog/meta-ads-attribution-settings-best-practices)).
