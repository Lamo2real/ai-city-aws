---
id: marketing.google-ads.lift-testing
department: marketing
domain: google-ads
title: 'Lift testing in Google Ads: Conversion Lift, Brand Lift and Search Lift'
summary: Conversion Lift needs 1,000 conversions and a US$5,000 budget with no representative; Brand Lift and Search Lift need a representative and country-tiered budgets; a campaign can be in only one study at a time.
type: playbook
audience: manager
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
- youtube
objectives:
- sales
- leads
- awareness
sources:
- https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html
- https://www.relevantaudience.com/google-ads-en/google-ads-conversion-lift-search-pmax-thresholds/
- https://ppc.land/google-lowers-incrementality-testing-threshold-to-5-000-for-advertisers/
- https://support.google.com/google-ads/answer/9049373
- https://support.google.com/google-ads/answer/9049825
- https://support.google.com/google-ads/answer/14716878
- https://blog.google/products/ads-commerce/demand-gen-drop-january-2026/
related:
- marketing.measurement.lift-tests-and-mmm-tools
- marketing.youtube-ads.measurement-and-costs
seed_version: 1
---

**When to use this:** When planning an incrementality or brand study on Google or YouTube.

## Lift testing in Google Ads: Conversion Lift, Brand Lift and Search Lift

**[FAST-MOVING, Oct 2026; via trade reports of the help page]** Conversion Lift requires **at least 1,000 observed conversions and a US$5,000 minimum study campaign budget**, plus at least one compatible conversion action. As reported on 7 to 9 October 2026, the help page says a representative is no longer needed and lists Display, Search, Video, Demand Gen, App and Performance Max for user-based studies; iOS App campaigns and Travel Ads are excluded and Shopping is not named. A campaign can sit in only one study (Brand, Search or Conversion Lift) at a time. The design is a user-based holdback of 1 to 50% (30% when combined with Brand Lift and Search Lift); outputs are incremental conversions, incremental CPA and incremental ROAS; minimum duration is 7 days with more than 14 recommended; Google reports up to a 17% drop in absolute lift for long-lag businesses on studies shorter than 14 days; and study power is shown from 50% to 95% with 90% recommended. "Delayed Incremental Conversions", a cool-down projection, began on 14 April 2026 for eligible Demand Gen-only studies ([Search Engine Roundtable, 8 Oct 2026](https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html); [Relevant Audience, 9 Oct 2026](https://www.relevantaudience.com/google-ads-en/google-ads-conversion-lift-search-pmax-thresholds/)). Google announced the US$5,000 minimum on 11 November 2025, down from a level described as "approaching $100,000"; the method is Bayesian, feasibility is rated in the interface ("High" equals a 60 to 90% probability of a conclusive result), and **[PLATFORM CLAIM]** improved models give up to 50% more conclusive results. Google's own observations are that upper- and mid-funnel actions show higher lift than purchases, conversion-based bidding shows higher lift than manual CPC, and most advertisers run one to two studies a year ([PPC Land, 13 Nov 2025](https://ppc.land/google-lowers-incrementality-testing-threshold-to-5-000-for-advertisers/)). **[INFERENCE]** Standard Shopping incrementality still needs a representative or a third-party geo test.

**[DURABLE; Google Ads Help]** Brand Lift requires a Google account representative and applies to Video, audio and Demand Gen campaigns, measuring ad recall, awareness, consideration and brand association through surveys on YouTube. Minimum budgets over a 10-day window depend on country tier and number of questions: tier A (including Brazil, India, Mexico and Indonesia) US$5,000, US$10,000 and US$20,000 for one, two and three questions; tier B (including the US, UK, France and Spain) US$10,000, US$20,000 and US$60,000; tier C (including Australia, Canada, Germany, Japan, South Korea and Switzerland) US$15,000, US$30,000 and US$60,000. Multi-country studies use the highest tier. Enhanced Lift needs three times the standard minimum, and budgets should not be adjusted until the study reaches 100% ([Google Ads Help](https://support.google.com/google-ads/answer/9049373); [Google Ads Help](https://support.google.com/google-ads/answer/9049825)). **[DURABLE; Google Ads Help]** Search Lift estimates how ads change the likelihood of searching for the brand or product on Google Search and YouTube; it requires a representative, and its minimum budget equals the one-question Brand Lift minimum and is not additive. Use up to 5 search term groups (one or two usually suffice) with one to three specific brand or product terms per group ([Google Ads Help](https://support.google.com/google-ads/answer/14716878)). Demand Gen also has "Attributed Branded Searches", introduced in the January 2026 product drop and activated through a Google representative ([Google Ads & Commerce blog, 22 Jan 2026](https://blog.google/products/ads-commerce/demand-gen-drop-january-2026/)); a later headline saying the metric was narrowed to a 7-day window and dropped Performance Max support was seen but not fetched.
