---
id: marketing.measurement.utm-governance
department: marketing
domain: measurement
title: 'UTM governance: three mandatory parameters, lowercase, one owner'
summary: Always set utm_source, utm_medium and utm_campaign in lowercase from an approved list with one owner, keep Google Ads auto-tagging, and fix renamed conventions with a GA4 custom channel group instead of renaming live campaigns.
type: checklist
audience: worker
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- ga4
objectives: []
sources:
- https://support.google.com/analytics/answer/10917952?hl=en
- https://www.leadfeeder.com/blog/marketing-analytics/utm-best-practices/
- https://www.digitalapplied.com/blog/utm-parameters-guide-complete-tracking-reference
related:
- marketing.measurement.ga4-configuration
- marketing.google-ads.conversion-tracking-and-consent
seed_version: 1
---

**When to use this:** When creating tracked links or campaign naming, or auditing GA4 channel reports.

## UTM governance: three mandatory parameters, lowercase, one owner

**[DURABLE; Google Analytics Help]** In GA4, `utm_source`, `utm_medium` and `utm_campaign` should always be used; `utm_id` and `utm_source_platform` are strongly recommended; `utm_term` and `utm_content` are optional; `utm_creative_format` and `utm_marketing_tactic` are accepted but not currently reported. Missing parameters produce "(not set)" in reports. Values are case sensitive (google and Google are different sources), and Google recommends lowercase, one unique source per platform, one medium per channel (for example `paid_social`), campaign names matching the platform's exact name, and dynamic parameters where the platform supports them ([Google Analytics Help](https://support.google.com/analytics/answer/10917952?hl=en)). **[VENDOR, practitioner norms]** GA4's default channel grouping depends mainly on medium, and on source for paid social and paid search; unrecognised mediums such as qr, event or partner land in Unassigned unless a custom channel group catches them. The practitioner standard is lowercase, no spaces, one separator style, a fixed list of approved sources and mediums, a campaign pattern such as type-topic-yyyy-mm, tagging only external links, one named approver, a shared sheet of every tagged link, a test in GA4 Realtime before launch, and a quarterly review. When conventions change, do not rename live campaigns; use a GA4 custom channel group to merge old and new values, which applies retroactively (standard properties allow two) ([Leadfeeder](https://www.leadfeeder.com/blog/marketing-analytics/utm-best-practices/)). With Google Ads auto-tagging, leave the gclid in place instead of overriding with manual UTMs, and date or version campaign names so they are not reused across years ([Digital Applied](https://www.digitalapplied.com/blog/utm-parameters-guide-complete-tracking-reference)). **[INFERENCE]** Because Google's own examples use `paid_social`, underscores in `utm_medium` are the safer default for channel mapping; `utm_content` is the natural home for creative-variant IDs and `utm_id` for joining cost data.
