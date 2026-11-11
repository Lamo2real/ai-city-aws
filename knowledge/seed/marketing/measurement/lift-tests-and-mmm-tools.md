---
id: marketing.measurement.lift-tests-and-mmm-tools
department: marketing
domain: measurement
title: Lift tests are within reach of small accounts, and open-source MMM matured in 2026
summary: Meta and Google Conversion Lift are self-serve from US$5,000 with 500 or 1,000 conversions; GeoLift, Meridian and GeoX make geo tests and MMM accessible, though platform-built models grade their own media.
type: playbook
audience: manager
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives: []
sources:
- https://www.facebook.com/business/help/221353413010930
- https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html
- https://geniusmonkey.com/blog/incrementality-testing/
- https://ppc.land/googles-meridian-geox-exits-beta-claiming-31-cheaper-geo-experiments/
- https://ppc.land/google-marketing-live-2026-every-announcement-that-actually-matters
related:
- marketing.measurement.triangulation
- marketing.meta-ads.capi-emq-and-conversion-lift
- marketing.google-ads.lift-testing
requires:
- marketing.measurement.experiment-design
seed_version: 1
---

**When to use this:** When planning an incrementality test or a media mix model.

## Lift tests are now within reach of small accounts

**[FAST-MOVING, Oct to Nov 2026]** Platform experiments have become self-service at low thresholds. Meta's Conversion Lift is available in Experiments or through a representative at no extra fee for a campaign started in the past year with about US$5,000 of spend and 500 conversions, plus a signal-quality condition (details in section 4) ([Meta Business Help Center](https://www.facebook.com/business/help/221353413010930)). Google's Conversion Lift needs a US$5,000 study budget and 1,000 observed conversions and no longer needs a representative for Search, Performance Max, Display, Video, Demand Gen and App campaigns (details in section 6) ([Search Engine Roundtable, 8 Oct 2026](https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html)). For geo experiments, Meta's open-source GeoLift is described as needing at least 25 pre-test periods across 20 or more regions with other media held constant ([Genius Monkey, Oct 2026](https://geniusmonkey.com/blog/incrementality-testing/)). **[INFERENCE]** The binding constraint for small advertisers is now conversion volume, not budget; an account below 500 to 1,000 conversions per study should use geo holdouts or accept directional evidence.

## Open-source tooling matured in 2026, with a conflict of interest

**[FAST-MOVING, Sept 2026]** Google's Meridian is an open-source Bayesian MMM; version 2.0.0 (2 September 2026) added an automated module that converts experiment results into model inputs, a code-free Scenario Planner arrived in February 2026, and an "agentic skills" repository supports model building. Meridian does not forecast by default. Google's GeoX geo-experiment tool reached general availability on 9 September 2026 with holdback, go-dark and heavy-up designs and multi-cell tests sharing one control; its results feed Meridian as priors. Google's claims for GeoX (more than 31% budget savings, design generation more than 94% faster) are **[PLATFORM CLAIM]** with no sample disclosed. Platform-built MMMs mean the media seller builds the model that grades its own media ([PPC Land](https://ppc.land/googles-meridian-geox-exits-beta-claiming-31-cheaper-geo-experiments/)). **[FAST-MOVING, May 2026]** Meridian is also integrated into Google Analytics 360 and analyses Google, TikTok, Pinterest and Snap together ([PPC Land, GML 2026](https://ppc.land/google-marketing-live-2026-every-announcement-that-actually-matters)).
