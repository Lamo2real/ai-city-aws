---
id: marketing.meta-ads.sensitive-data-sources
department: marketing
domain: meta-ads
title: Meta restricts data from health, finance and other sensitive sources
summary: Meta categorises domains and apps (health, finance, politics and more) and can block URL parameters, custom parameters and lower-funnel events from them; health and finance advertisers should plan for that loss and describe the product, not the viewer.
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
- https://www.facebook.com/business/help/1402913027039332
- https://www.facebook.com/business/help/124742407297678
- https://tealium.com/blog/customer-experience/metas-new-data-sharing-restrictions-and-what-it-means-to-healthcare-marketing/
- https://oursprivacy.com/blog/meta-platform-restrictions-explained-core-setup
- https://www.triplewhale.com/blog/meta-health-and-wellness-brands
- https://www.wetracked.io/post/meta-ads-new-sensitive-categories-restrictions
related:
- marketing.meta-ads.special-ad-categories
- marketing.meta-ads.capi-emq-and-conversion-lift
seed_version: 1
---

**When to use this:** When a health, wellness, finance or other sensitive advertiser sets up Meta tracking or writes ad copy.

## Meta policy points for pre-flight checks

**[FAST-MOVING; Meta Help Center read 10 Nov 2026]** Meta categorises the data sources (domains and apps) that send it data through its business tools. Listed categories include Health and wellness, Financial service, Unsuitable content, Politics, Race, Religion, Sexuality and gender identity, Nationality, Trade union, Personal hardship and Economic vulnerability. Health and wellness covers medical conditions, provider and patient relationships, patient portals, wellness trackers, telemedicine, pharmacies, health insurance marketplaces and condition-specific support groups; a review can be requested ([Meta Business Help Center](https://www.facebook.com/business/help/1402913027039332)). "Core setup", which Meta or the advertiser can apply, blocks custom parameters and everything in a URL after the domain. Affected custom audiences cannot be prefilled, may populate slowly or not at all, and cannot be created or updated if they rely on device rules or aggregation with custom parameters or URLs; custom events must be confirmed before use in campaigns, custom conversions and audiences ([Meta Business Help Center](https://www.facebook.com/business/help/124742407297678)). Secondary sources report that the system was announced in November 2024, rolled out from early 2025 and has three tiers (core setup, restriction of mid- and lower-funnel standard events, and full restriction) ([Tealium](https://tealium.com/blog/customer-experience/metas-new-data-sharing-restrictions-and-what-it-means-to-healthcare-marketing/); [Ours Privacy](https://oursprivacy.com/blog/meta-platform-restrictions-explained-core-setup); [Triple Whale](https://www.triplewhale.com/blog/meta-health-and-wellness-brands)). **[INFERENCE]** Health and finance advertisers should plan for URL-parameter and custom-parameter loss by default and treat lower-funnel event loss as account-specific. **[VENDOR, 2026]** In sensitive verticals describe the product, not the viewer: no references to a person's condition, no before-and-after imagery for health or weight, no guaranteed results; landing pages are reviewed too ([wetracked.io](https://www.wetracked.io/post/meta-ads-new-sensitive-categories-restrictions)).
