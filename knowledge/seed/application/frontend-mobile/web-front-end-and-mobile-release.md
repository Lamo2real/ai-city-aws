---
id: application.frontend-mobile.web-front-end-and-mobile-release
department: application
domain: frontend-mobile
title: 'Application: Web front end and mobile release: platform-defined numbers belong in gates'
summary: 'Web front end and mobile release: Core Web Vitals thresholds and how to measure them, front-end signals from the
  Technology Radar, iOS phased release, Google Play staged rollout, Android vitals bad-behaviour thresholds, and why mobile
  risk sits behind server-side flags.'
type: benchmark
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- web
- ios
- android
objectives:
- quality
- ship
sources:
- https://web.dev/articles/vitals
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/
- https://support.google.com/googleplay/android-developer/answer/6346149
- https://developer.android.com/topic/performance/vitals
related: []
seed_version: 1
---

**When to use this:** When setting web performance gates or releasing an iOS or Android build.

**Source section:** 3. Web front end and mobile release: platform-defined numbers belong in gates

### Core Web Vitals thresholds

**[FAST-MOVING, Oct 2024]** Google's "good" thresholds for Core Web Vitals are Largest Contentful Paint of 2.5 seconds or less, Interaction to Next Paint of 200 milliseconds or less and Cumulative Layout Shift of 0.1 or less, each assessed at the 75th percentile of page loads and split by mobile and desktop; a page passes only when all three pass. The page was last updated on 31 October 2024 ([web.dev Web Vitals](https://web.dev/articles/vitals)). **[GAP]** The "needs improvement" and "poor" bands appear only as images on that page and were not extracted, and no 2026 change to the thresholds was confirmed.

### Measuring Core Web Vitals in the field and in the lab

**[DURABLE]** Field data for Core Web Vitals comes from the Chrome User Experience Report, PageSpeed Insights and Search Console; lab data comes from Lighthouse and browser developer tools. Lighthouse cannot measure Interaction to Next Paint, so Total Blocking Time serves as the lab proxy, and the `web-vitals` JavaScript library collects all three metrics from real users ([web.dev Web Vitals, updated 31 Oct 2024](https://web.dev/articles/vitals)). **[INFERENCE]** A reasonable web performance budget fails continuous integration on lab regressions in Largest Contentful Paint, Cumulative Layout Shift and Total Blocking Time and alerts when field 75th-percentile values cross the "good" thresholds.

### Front-end technology and testing signals from the Radar

**[FAST-MOVING, Apr 2026]** Thoughtworks Radar Volume 34 (April 2026) has React, React Native and Svelte in Adopt, axe-core in Adopt for automated accessibility checks in continuous integration, and browser-based component testing (for example with Playwright) in Trial as more reliable than emulated DOMs ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). **[GAP]** Volume 35 ring assignments for tools, platforms and languages were not retrieved; only its techniques quadrant was.

### iOS phased release

**[PLATFORM CLAIM]** Apple's phased release for iOS runs over seven days at 1%, 2%, 5%, 10%, 20%, 50% and 100% of users who have automatic updates on. It can be paused for a cumulative 30 days with any number of pauses, anyone can still update manually so the percentages are not a hard cap, and the "Release to All Users" action ends the phase early ([App Store Connect help](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/)). The help page was read in November 2026 and carries no version date in the notes.

### Google Play staged rollout

**[PLATFORM CLAIM]** Google Play staged rollouts apply only to updates and not to first publication, and the percentage never increases automatically. Halting a rollout stops new users receiving the version but those who already have it keep it, the recommended fix for a bad build is a new corrected release, and country targeting cannot be narrowed after the rollout starts ([Play Console help](https://support.google.com/googleplay/android-developer/answer/6346149)). The help page was read in November 2026.

### Android vitals bad-behaviour thresholds

**[FAST-MOVING, Nov 2026]** Android vitals defines bad-behaviour thresholds of a 1.09% user-perceived crash rate overall and 8% per phone model, a 0.47% user-perceived ANR rate overall and 8% per phone model, and 5% for excessive partial wake locks, assessed on a 28-day average. Exceeding them can reduce an app's visibility on Google Play or add a warning to its store listing, and further thresholds for memory, bitmap memory and code optimisation may affect visibility from February 2027 ([Android vitals](https://developer.android.com/topic/performance/vitals)). The page was read in November 2026.

### Mobile has no true rollback, so risk sits behind server-side flags

**[INFERENCE]** Neither mobile store supports a true rollback, since Apple pauses and Google halts but neither removes an installed build. Risky mobile behaviour should therefore sit behind server-side feature flags, and backend APIs must stay compatible with at least the previous app versions still in the field. The store behaviours are sourced in this section; the design rule is the researchers' synthesis.
