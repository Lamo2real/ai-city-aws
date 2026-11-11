---
id: marketing.meta-ads.capi-emq-and-conversion-lift
department: marketing
domain: meta-ads
title: Conversions API and Event Match Quality, and self-serve Conversion Lift on Meta
summary: Run Pixel plus Conversions API with shared event IDs; Meta's only EMQ numbers are above 5 (lift eligibility) and over 6 (best practice); Conversion Lift is self-serve at $5,000 and 500 conversions, and EU advertisers need the Conversions API route.
type: checklist
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
objectives:
- sales
- leads
sources:
- https://www.facebook.com/business/help/765081237991954
- https://www.facebook.com/business/help/221353413010930
- https://www.facebook.com/business/news/unlock-businesss-potential-with-the-new-performance-5
- https://developers.facebook.com/documentation/ads-commerce/conversions-api/best-practices
- https://jetfuel.agency/meta-ads-attribution-settings-in-2026-windows-best-practices-and-what-dtc-brands-get-wrong/
related:
- marketing.meta-ads.attribution-changes-2026
- marketing.measurement.lift-tests-and-mmm-tools
- marketing.compliance.sweden-cookies-and-meta-pixel
seed_version: 1
---

**When to use this:** When setting up Meta tracking, auditing signal quality, or planning a Meta lift test.

## Conversions API and Event Match Quality: what Meta says versus what vendors say

**[DURABLE]** Run Pixel plus Conversions API with the same event_id on both for deduplication, and turn on extended matching. **[FAST-MOVING, Meta Help Center read 10 Nov 2026]** Event Match Quality (EMQ) is scored 0 to 10 from the quality of customer information sent with a server event and the share of event instances matched to Meta accounts, using the last 48 hours of data, and exists only for website events sent through the Conversions API. Parameter priority is high for email and click ID; medium for Facebook Login ID, birthdate, country, phone number, external ID and browser ID; and low for lead ID, first name, last name, city and postal code. The help page states no numeric "good" score ([Meta Business Help Center](https://www.facebook.com/business/help/765081237991954)). The only Meta numbers found are an EMQ "greater than 5" for self-serve Conversion Lift eligibility and a Meta business post saying "the best practice for the EMQ score is over 6" ([Meta Business Help Center](https://www.facebook.com/business/help/221353413010930); [Meta for Business, Performance 5](https://www.facebook.com/business/news/unlock-businesss-potential-with-the-new-performance-5)). Developer documentation updated 28 June 2026 adds that for offline, app and conversion-lead events advertisers must contact a Meta representative, and that events carrying only very broad parameter combinations (for example gender, city, state and country) are rejected as invalid ([Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/conversions-api/best-practices)). **[VENDOR, Aug 2026]** Agency guidance is to check Purchase EMQ monthly, flag below 7 and target 7.5 to 9.3; a 20 to 30% gap between Meta-reported and Shopify purchases is typical and a larger gap suggests a Conversions API problem; use 7-day click for most DTC products, hold the window constant across comparisons, and cross-check against total revenue over total ad spend, since a window change alone can move reported ROAS 30 to 50% ([Jetfuel](https://jetfuel.agency/meta-ads-attribution-settings-in-2026-windows-best-practices-and-what-dtc-brands-get-wrong/)). EMQ targets of "8+" in vendor content are not Meta figures.

## Conversion Lift is self-serve at $5,000 and 500 conversions

**[FAST-MOVING, Meta Help Center read 9 Nov 2026]** Conversion Lift is available self-serve in Experiments or through a Meta representative at no extra fee. Guide thresholds are a campaign started in the past year with spend of **$5,000 or more and 500 or more conversions** on 1-day click, 7-day click or 1-day view, prorated beyond 90 days (180 days needs $10,000 and 1,000 conversions). One signal-quality condition also applies: either the Conversions API is adopted with any event at EMQ above 5, or a supported data source sends a lower-funnel or mobile app install event; this second route is unavailable to advertisers mainly targeting ePrivacy-Directive countries, so **EU advertisers need the Conversions API route** ([Meta Business Help Center](https://www.facebook.com/business/help/221353413010930)). The page's window wording has not been updated for engage-through, so expect wording drift across Meta pages during rollout.
