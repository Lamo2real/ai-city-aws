---
id: marketing.google-ads.conversion-tracking-and-consent
department: marketing
domain: google-ads
title: Google conversion tracking after June 2026, and Consent Mode as a performance input in the EEA
summary: Offline conversion imports moved to the Data Manager API on 15 June 2026; pass several identifiers; in the EEA send consent mode v2 signals, because without ad_user_data and ad_personalization remarketing and personalisation stop.
type: checklist
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
- ga4
objectives:
- sales
- leads
sources:
- https://support.google.com/google-ads/answer/16884284?hl=en
- https://ppc.land/google-kills-3-enhanced-conversion-methods-replaces-all-with-single-toggle/
- https://support.google.com/google-ads/answer/14693848
- https://lineardesign.com/blog/google-performance-max-a-practical-guide/
- https://business.safety.google/privacy/google-services/
- https://support.google.com/google-ads/answer/13695607
- https://www.uniconsent.com/blog/google-ads-consent-mode-change-2026
related:
- marketing.measurement.ga4-configuration
- marketing.compliance.eu-cookie-consent-and-pending-reforms
- marketing.compliance.sweden-cookies-and-meta-pixel
seed_version: 1
---

**When to use this:** When setting up or auditing Google Ads conversion tracking, especially for EEA traffic.

## Tracking changed materially on 15 June 2026

**[FAST-MOVING, June 2026]** Enhanced conversions for web and for leads merged into one setting, and **offline conversion imports moved to the Data Manager API on 15 June 2026**; uploads through the Google Ads API are blocked, so unmigrated integrations fail ([Google Ads Help](https://support.google.com/google-ads/answer/16884284?hl=en); [PPC Land](https://ppc.land/google-kills-3-enhanced-conversion-methods-replaces-all-with-single-toggle/)). **[DURABLE]** Pass multiple identifiers on conversions (click ID, hashed customer data, transaction ID), at least three for offline imports; for lead generation define quality stages, import later-stage outcomes and keep shallow actions as secondary ([Google Ads Help](https://support.google.com/google-ads/answer/14693848); [Linear Design](https://lineardesign.com/blog/google-performance-max-a-practical-guide/)).

## Consent Mode and the Digital Markets Act make consent a performance input in the EEA

**[DURABLE since March 2024; Google's own pages]** Under the Digital Markets Act, Google requires user consent to link Search, YouTube, Ad services, Google Play, Google Shopping and Google Maps for data sharing with each other and with other Google services; unlinked services keep working but personalise only on that service's own data ([Google Business Safety](https://business.safety.google/privacy/google-services/)). For EEA traffic, advertisers must collect consent and send it through the consent mode v2 parameters `ad_user_data` (sending user data to Google for advertising) and `ad_personalization` (personalised advertising) to keep measurement, ad personalisation and remarketing; conflicting values disable personalisation, and the requirement also covers Google Analytics data used in Google Ads, Search Ads 360 and Display & Video 360. If tags are blocked until banner interaction, Google cannot verify consent choices, which "may lead to loss in data"; status can be checked in the conversion diagnostics tab, and uploaded data such as enhanced conversions for leads or store sales must meet customer data policies ([Google Ads Help](https://support.google.com/google-ads/answer/13695607)).

**[FAST-MOVING, June 2026; VENDOR source]** Consent Mode became the single control for Google Ads data on 15 June 2026. When `ad_storage` is denied, only URL parameters reach Google Ads; `ad_user_data` governs whether first-party data can be sent for matching, so enhanced conversions can fail without it. Conversion modelling partly compensates but needs enough consented sessions, and smaller accounts in high-refusal markets can fall below thresholds. The audit checklist: default `ad_storage` and `analytics_storage` to denied in GDPR regions, send all four parameters in default and update calls, check every page type, and test the update call on first and return visits ([UniConsent, 2026](https://www.uniconsent.com/blog/google-ads-consent-mode-change-2026)). The June 2026 detail rests on a consent-platform vendor blog; the underlying EEA consent requirement is confirmed on Google's own pages above. **[INFERENCE]** In the EEA consent rate is a direct performance lever: without `ad_user_data` and `ad_personalization` signals, remarketing lists and personalisation for those users are unavailable.
