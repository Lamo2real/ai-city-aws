---
id: marketing.measurement.ga4-configuration
department: marketing
domain: measurement
title: GA4 settings that change what Google Ads bids on, and why BigQuery numbers differ
summary: GA4's attribution model, lookback windows and "channels eligible for credit" setting affect Google Ads bidding; the daily BigQuery export is last-click, unmodelled and capped at 1 million events a day on standard properties.
type: checklist
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- ga4
- google-ads
objectives: []
sources:
- https://support.google.com/analytics/answer/10597962
- https://support.google.com/analytics/answer/9358801
related:
- marketing.measurement.ga4-2026-changes-and-audit
- marketing.measurement.utm-governance
- marketing.google-ads.conversion-tracking-and-consent
seed_version: 1
---

**When to use this:** When configuring GA4 for advertising or reconciling GA4, Google Ads and BigQuery numbers.

## GA4 configuration: the settings that change what Google Ads bids on

**[DURABLE; Analytics Help, fetched 11 Nov 2026]** Attribution settings sit under Admin > Data display > Events > Attribution settings. The reporting attribution model applies to historical and future data and affects event-scoped traffic dimensions, not session- or user-scoped ones. First click, linear, time decay and position-based models were deprecated in November 2023; data-driven attribution assigns fractional credit across touchpoints and affects key events and revenue metrics, and the help page does not explain its algorithm. Lookback windows default to 30 days for acquisition key events (`first_open`, `first_visit`, with a 7-day option) and 90 days for all other key events (with 30- or 60-day options), and changes apply going forward. **"Channels eligible for credit"** can be set to "Google paid channels" or "Paid and organic channels"; the choice applies to all linked Google Ads accounts going forward, **can affect Google Ads bidding and reporting**, and can take a few days to appear. Paid and organic applies to web conversions only; Google Ads reports default to Google paid channels and Analytics reports default to Paid and organic. With Paid and organic selected, conversion window and counting method are managed in Analytics under Advertising > Conversion management. Time zones can differ between the property and the Google Ads account; to compare, use the "All conv." or "All conv. (by conv. time)" columns in Google Ads ([Analytics Help](https://support.google.com/analytics/answer/10597962)).

**[DURABLE; Analytics Help]** The daily BigQuery export on standard properties is capped at **1 million events per day** (20 billion on 360), and filtering can keep a property under the cap. Streaming export has no volume limit, is best-effort, costs an added $0.05 per GB (about 600,000 events) and omits traffic source fields for new users. The daily export uses "Last click observed, no modeling" attribution, includes cookieless pings when consent mode is implemented, and excludes wBRAID and gBRAID identifiers; exported data cannot be re-exported, and changing property time zone can cause skipped exports ([Analytics Help](https://support.google.com/analytics/answer/9358801)). **[INFERENCE]** BigQuery numbers will not match the GA4 interface or Google Ads because the export is last-click and unmodelled.
