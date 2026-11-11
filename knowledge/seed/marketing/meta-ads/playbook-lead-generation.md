---
id: marketing.meta-ads.playbook-lead-generation
department: marketing
domain: meta-ads
title: 'Meta playbook: lead generation, B2B leads and cost-per-lead benchmarks'
summary: Judge leads on value, sync to the CRM, choose the instant form type, and use the qualified-leads goal only with a CRM-to-Conversions-API link; US cost per lead averages $27.39 with wide industry spread, and B2B needs higher-intent forms.
type: playbook
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
objectives:
- leads
sources:
- https://www.jonloomer.com/meta-ads-lead-generation/
- https://www.facebook.com/business/help/252352181957512
- https://www.facebook.com/business/help/761812391313386
- https://www.facebook.com/business/help/782657799338685
- https://www.wordstream.com/blog/facebook-ads-benchmarks-2026
- https://localiq.com/blog/facebook-advertising-benchmarks/
- https://www.digitalapplied.com/blog/facebook-ads-benchmarks-2026-cpc-cpm-ctr-industry
- https://www.growthspreeofficial.com/blogs/meta-lead-ads-b2b-saas-2026
related:
- marketing.meta-ads.capi-emq-and-conversion-lift
- marketing.conversion.what-converts
- marketing.google-ads.benchmarks-lead-gen-and-b2b
requires:
- marketing.meta-ads.capi-emq-and-conversion-lift
seed_version: 1
---

**When to use this:** When planning or judging Meta lead generation, including B2B leads.

## Playbooks by objective

**Lead generation.** **[DURABLE]** Start simple with few questions and high volume, fix internal follow-up speed first, sync leads to the CRM immediately, and judge on lead value, since a sub-$1 lead can be worthless and a $50 lead worthwhile. Instant forms suit advertisers with a weak landing page; test both against website forms ([Jon Loomer](https://www.jonloomer.com/meta-ads-lead-generation/)). **[FAST-MOVING; official pages, form-type page read as excerpt]** Meta has three instant form types: More volume (the default, for quick mobile submission and larger lead counts), Higher intent (for very intentional leads; Meta's example is booking a test drive) and Rich creative (a more flexible, personalised form whose intro section is mandatory) ([Meta Business Help Center](https://www.facebook.com/business/help/252352181957512); [Meta Business Help Center](https://www.facebook.com/business/help/761812391313386)). Lead performance goals are Maximize number of leads, Maximize number of qualified leads (formerly "conversion leads"), Maximize number of leads through messaging, and Maximize value of conversions. **Since April 2026 the qualified leads goal is unavailable for new campaigns without a Conversions API (CRM) integration, and existing campaigns were affected from August 2026.** **[PLATFORM CLAIM]** Meta says the qualified-leads goal with a CRM integration gave 21% lower cost per quality lead on instant forms and 9.5% lower on website forms against Maximize leads. For value optimisation on leads, send value and currency through Pixel and Conversions API, with at least 5 unique values per event and 100 or more conversions in the past 14 days; run at least 3 weeks aiming for 50 or more conversions per week, with peak performance typically after 2 weeks ([Meta Business Help Center, read 10 Nov 2026](https://www.facebook.com/business/help/782657799338685)). **[INFERENCE]** An agent should not recommend the qualified-leads goal unless a CRM-to-Conversions-API connection exists.

**[VENDOR, published 14 Sep 2026; US campaigns, April 2025 to June 2026]** WordStream and LocaliQ report leads-objective averages of **$27.39 cost per lead** (previously $27.66), $1.80 cost per click (previously $1.92), 2.70% CTR and 8.54% conversion rate; traffic campaigns average $0.60 per click. Cost per lead by industry: Career and Employment $12.30; Real Estate $13.74; Arts and Entertainment $14.59; Sports and Recreation $15.49; Education $26.31; Health and Fitness $27.11; Physicians and Surgeons $32.14; Automotive for sale $35.52; Industrial and Commercial $35.87; Personal Services $38.09 (the largest year-on-year rise at +24.60%); Furniture $39.25; Home and Home Improvement $42.95; Beauty and Personal Care $50.91; Dentists $61.56 ([WordStream](https://www.wordstream.com/blog/facebook-ads-benchmarks-2026); [LocaliQ](https://localiq.com/blog/facebook-advertising-benchmarks/); [Digital Applied](https://www.digitalapplied.com/blog/facebook-ads-benchmarks-2026-cpc-cpm-ctr-industry)). The dataset skews to US local-service businesses, so it doubles as the best available local-business benchmark and is not representative of B2B SaaS or ecommerce.

**B2B.** **[VENDOR, Oct 2026]** Use the Higher intent form type (typically 20 to 40% less volume), require work email, end the form for unqualified answers, and optimise to a downstream CRM event through the Conversions API once about 50 such events arrive weekly. Instant-form leads reach an appointment at roughly 2% versus about 17% for landing-page leads ([Growthspree, 16 Oct 2026](https://www.growthspreeofficial.com/blogs/meta-lead-ads-b2b-saas-2026)).
