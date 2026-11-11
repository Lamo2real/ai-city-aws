---
id: marketing.lifecycle.warm-up-hygiene-and-sunsetting
department: marketing
domain: lifecycle
title: Email warm-up, list hygiene and sunsetting
summary: Ramp volume slowly to engaged recipients, tier sending frequency by recent engagement, sunset long-inactive profiles on evidence rather than a blanket date, and know BIMI needs DMARC at enforcement and a mark certificate.
type: playbook
audience: worker
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- email
objectives:
- retention
sources:
- https://support.google.com/a/answer/81126?hl=en
- https://help.gohighlevel.com/support/solutions/articles/155000001021-email-sending-guide-email-best-practices-email-warm-up
- https://www.mailforge.ai/blog/domain-warming
- https://help.klaviyo.com/hc/en-us/articles/360037527052
- https://help.klaviyo.com/hc/en-us/articles/360017518492
- https://www.validity.com/blog/the-2026-dma-email-benchmark-report-what-the-numbers-really-mean-for-revenue/
- https://redsift.com/blog/bimi-in-2026-verified-logos-cmcs-and-the-fastest-path-to-inbox-display
related:
- marketing.lifecycle.sender-requirements
- marketing.lifecycle.email-metrics-and-ai-inbox
seed_version: 1
---

**When to use this:** When starting a new sending domain or IP, or cleaning a list.

## Warm-up, hygiene and sunsetting

**[DURABLE; Google]** Google's ramp guidance has no numeric schedule: start with low volume to engaged users and increase slowly; send at a consistent rate, not in bursts; "immediately doubling previously sent volumes suddenly could result in rate limiting or reputation drops"; ramp separately after changing infrastructure, headers or format; and if bounces or deferrals start, cut volume until errors fall. Gmail tracks volume per domain and per IP, and a shared IP's quota is shared by everyone on it ([Google Email sender guidelines](https://support.google.com/a/answer/81126?hl=en)). **[VENDOR]** One platform's warm-up for a new dedicated sending domain takes about 4 weeks, capped at 100 an hour and 1,000 a day in stage one and 300 an hour and 2,500 a day in stage two, sending only to opted-in, likely-to-engage contacts ([HighLevel](https://help.gohighlevel.com/support/solutions/articles/155000001021-email-sending-guide-email-best-practices-email-warm-up)); another advises starting at 20 to 100 emails a day and treats a bounce rate above 5% as a hygiene warning ([Mailforge, 13 Sep 2026](https://www.mailforge.ai/blog/domain-warming)). **[VENDOR; Klaviyo help centre]** Engagement-tiered sending: a daily sender should send daily only to profiles engaged or added within 30 days, three times a week to those engaged within 60 to 90 days, and weekly to those engaged within 180 days; profiles added more than 180 days ago who have never opened or clicked go to a re-engagement or sunset flow ([Klaviyo](https://help.klaviyo.com/hc/en-us/articles/360037527052); [Klaviyo](https://help.klaviyo.com/hc/en-us/articles/360017518492)). **[VENDOR, 17 Jul 2026]** Validity cautions that inactive segments can reach 50% of a list yet account for about 25% of programme revenue, so suppress on evidence instead of a blanket date rule; it puts global inbox placement at 87% (UK about 91%), a gap that a 99% "delivered" rate hides ([Validity](https://www.validity.com/blog/the-2026-dma-email-benchmark-report-what-the-numbers-really-mean-for-revenue/)). **[VENDOR, modified 16 Mar 2026]** BIMI (the brand logo in the inbox) needs DMARC at enforcement (p=quarantine or p=reject), an SVG Tiny PS logo and in practice a certificate: a Verified Mark Certificate requires a registered trademark and gives the Gmail blue checkmark, while a Common Mark Certificate needs no trademark but the logo must have been publicly displayed for at least 12 months ([Red Sift](https://redsift.com/blog/bimi-in-2026-verified-logos-cmcs-and-the-fastest-path-to-inbox-display)).
