---
id: marketing.measurement.ga4-2026-changes-and-audit
department: marketing
domain: measurement
title: GA4 changes in 2026 and the advertiser audit order
summary: GA4's 2026 releases added an AI Assistant channel, custom conversion windows, Data Manager and more; audit the Ads link, key events, channels-eligible setting, lookback windows, consent mode and export volume, in that order.
type: checklist
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- ga4
objectives: []
sources:
- https://support.google.com/analytics/answer/9164320
related:
- marketing.measurement.ga4-configuration
- marketing.geo.measure-with-repeated-sampling
seed_version: 1
---

**When to use this:** When auditing a GA4 property or explaining a 2026 change in GA4 reports.

## GA4 configuration: the settings that change what Google Ads bids on

**[FAST-MOVING, 2026 release log]** Google's GA4 release notes for 2026 record: 16 January, cross-channel budgeting, web conversion management and conversion attribution analysis (beta), including per-conversion attribution settings for Google Ads; 29 April, a Task Assistant for configuration recommendations; 7 May, the Data Manager API for server-side events as an alternative to Measurement Protocol; **13 May, an "AI Assistant" channel grouping visits from tools such as ChatGPT, Gemini and Claude**; 8 June, a Google Business Profile integration with seven local metrics; 11 June, a Source Group dimension and hostname exclude filters; 13 July, AdMob links that let ad impressions count as conversions for target ROAS campaigns; 28 July, currency required for imported campaign cost data; 30 July, an aggregate parameter diagnostic flagging URLs missing GBRAID or gad_ identifiers; 10 August, a campaign data import validation report; **11 August, custom conversion windows (engaged-view 1 to 30 days, click-through 1 to 90 days)**; 9 September, dashboards; 29 September, app conversions for Google Ads customers with separate attribution settings; and 6 November, Data Manager in Google Analytics (beta) ([Analytics Help, What's new](https://support.google.com/analytics/answer/9164320)). **[INFERENCE]** An advertiser audit should check, in order: the Google Ads link and auto-tagging, key events marked and shared as conversions, the channels-eligible-for-credit setting, lookback windows, consent mode status, and whether daily event volume is approaching the BigQuery export cap.
