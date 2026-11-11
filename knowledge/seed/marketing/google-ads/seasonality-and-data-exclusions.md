---
id: marketing.google-ads.seasonality-and-data-exclusions
department: marketing
domain: google-ads
title: Seasonality adjustments are for 1 to 7 day events; data exclusions are for broken tracking
summary: Use a seasonality adjustment only for a short sale with a predictable conversion-rate jump, not for month-long periods; use a data exclusion for tag failures or outages, covering the conversion delay.
type: playbook
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- google-ads
objectives:
- sales
sources:
- https://support.google.com/google-ads/answer/10369906
- https://support.google.com/google-ads/answer/10370710
related:
- marketing.google-ads.bidding
- marketing.market-sweden.seasonal-calendar
seed_version: 1
---

**When to use this:** Before a short sale or promotion, during Black Week or Christmas planning, or after a tracking outage.

## Seasonality adjustments are for 1 to 7 day events; data exclusions are for broken tracking

**[DURABLE; Google Ads Help, fetched 11 Nov 2026]** A seasonality adjustment tells Smart Bidding about an expected conversion-rate change from an upcoming event such as a promotion. Google says to use it only for major changes because "Smart Bidding already manages seasonal events", that it is "ideal for short events of 1-7 days", and that it may be less effective over extended periods such as more than 14 days. It is supported for Search, Shopping, Demand Gen and Display campaigns on Target ROAS or Target CPA and for Performance Max and App (beta) campaigns on any bid strategy, and not for Travel campaigns. Google's example is a 3-day sale expected to lift conversion rate 50%, which gets an adjustment of up to 50% for those 3 days; no negative adjustment is needed afterwards because bidding returns to its prior state. Manager accounts can apply one adjustment across client accounts ([Google Ads Help](https://support.google.com/google-ads/answer/10369906)). **[INFERENCE]** For a 1 to 7 day sale with a predictable conversion-rate jump, set an adjustment sized to the realistic lift and bounded to the sale dates. For a month-long sale, or a multi-week period such as Black Week into Christmas, do not use one; adjust targets and budgets and let Smart Bidding learn. Seasonality adjustments address conversion rate, not order value, so a sale that mainly changes average order value is better handled through target ROAS.

**[DURABLE; Google Ads Help]** A data exclusion tells Smart Bidding to ignore a period with faulty conversion data (tag failures, site outages, import failures). It excludes the clicks that could have produced the affected conversions, while excluded conversions still appear in reports. It is supported for Search, Display, Shopping and Performance Max with conversion-based or value-based Smart Bidding, not for Hotel and Travel campaigns, and can be scoped by campaign, account and device. Cover the conversion delay by excluding at least 90% of potentially affected clicks: in Google's example, an issue on 15 to 18 October with a 5-day conversion delay means excluding 10 to 18 October. Performance usually stabilises within a few days; if a week or more of clicks is affected, fluctuation can last one to two conversion cycles, and bids and spend may temporarily drop. Do not use exclusions often or for long periods, do not remove one after it is applied, and avoid backfilling conversions; exclusions for planned outages can be scheduled ahead ([Google Ads Help](https://support.google.com/google-ads/answer/10370710)).
