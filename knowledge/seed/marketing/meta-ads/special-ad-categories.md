---
id: marketing.meta-ads.special-ad-categories
department: marketing
domain: meta-ads
title: Declare Meta special ad categories before launch
summary: Every campaign declares a special ad category or none; financial, employment and housing ads lose most targeting options with a 15 km minimum radius in Europe, and political or social-issue ads cannot be created in the EU.
type: policy
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- meta
objectives: []
sources:
- https://www.facebook.com/business/help/298000447747885
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category
related:
- marketing.meta-ads.sensitive-data-sources
- marketing.compliance.political-ads-eu
seed_version: 1
---

**When to use this:** In the pre-flight check of any Meta campaign, especially finance, jobs, housing or social issues.

## Meta policy points for pre-flight checks

**[DURABLE; Meta Help Center read 11 Nov 2026]** Every campaign must declare a special ad category or none. The current category names are Financial products and services, Employment, Housing, and Social issues, elections or politics; "Financial products and services" became required on 21 January 2025 for advertisers based in or targeting the US, replacing the narrower credit category. For the first three (in the US, and for advertisers reaching Canada and certain European countries) age, gender, postal code, exclusion targeting, lookalike audiences and saved audiences are limited or unavailable, some interests are removed, city and pin-drop targeting gets an expanded radius, and Advantage+ catalog ads carry the same limits ([Meta Business Help Center](https://www.facebook.com/business/help/298000447747885)). Meta's developer documentation describes the mechanics as fixing age at 18 to 65+, removing gender selection and lookalikes, and imposing a minimum radius of **15 km in Europe**, with the rules applying in Europe since 7 December 2021 ([Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/special-ad-category)). **Social issues, elections or politics ads cannot be created or edited in the European Union**; elsewhere they need authorisation, a "Paid for by" disclaimer and seven-year Ad Library retention, and changing such a disclaimer counts as a significant edit ([Meta Business Help Center](https://www.facebook.com/business/help/298000447747885)).
