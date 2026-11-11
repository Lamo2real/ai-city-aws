---
id: marketing.lifecycle.sms
department: marketing
domain: lifecycle
title: 'SMS marketing: written consent, registration and quiet hours (US rules and benchmarks)'
summary: US marketing texts need prior express written consent, quiet hours, prompt opt-out handling and 10DLC registration, with uncapped statutory damages; SMS flows convert far better than SMS campaigns, and the "98% open rate" is not a real figure.
type: policy
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- sms
objectives:
- retention
- sales
sources:
- https://www.pierceatwood.com/alerts/fcc-deletes-tcpa-regulations-following-supreme-court-and-eleventh-circuit-rulings
- https://compliancehub.wiki/tcpa-2026-consent-revocation-one-to-one-rule-vacated-compliance/
- https://cdn-web.infobip.com/uploads/markdown-exports/www.infobip.com/blog/tcpa-compliance-sms.md
- https://www.klaviyo.com/products/sms-marketing/benchmarks
- https://www.klaviyo.com/blog/abandoned-cart-benchmarks
- https://www.digitalapplied.com/blog/sms-marketing-statistics-2026-open-ctr-data
- https://postscript.io/sms-benchmarks
- https://www.omnisend.com/2026-ecommerce-marketing-report
related:
- marketing.compliance.eu-email-and-sms-consent
- marketing.lifecycle.automated-flows
- marketing.agent-guardrails.guardrail-design
seed_version: 1
---

**When to use this:** When planning or sending marketing SMS, especially to US numbers.

## SMS: written consent, registration, quiet hours

**[FAST-MOVING, US; law-firm and vendor summaries]** The FCC's one-to-one consent rule was vacated by the Eleventh Circuit in January 2025 and removed from the regulations on 14 July 2025. In McLaughlin Chiropractic v. McKesson (US Supreme Court, 20 June 2025) the court held that district courts are not bound by FCC interpretations of the TCPA, which opens long-standing positions on consent and revocation to challenge and is expected to increase litigation ([Pierce Atwood, 21 Jul 2025](https://www.pierceatwood.com/alerts/fcc-deletes-tcpa-regulations-following-supreme-court-and-eleventh-circuit-rulings)). Prior express written consent remains the standard for marketing texts; opt-outs must be honoured through any reasonable means within about 10 business days; one confirmation text after opt-out is allowed; the "revoke-all" requirement was delayed to 31 January 2027; and statutory damages are $500 to $1,500 per violation, uncapped ([ComplianceHub, 2026](https://compliancehub.wiki/tcpa-2026-consent-revocation-one-to-one-rule-vacated-compliance/)). **[VENDOR summary, verify before relying]** Opt-in must be affirmative, identify the sender, state that consent is not a condition of purchase and include "message and data rates may apply"; quiet hours are 8am to 9pm recipient local time; application-to-person traffic on 10-digit long codes needs brand and campaign registration with The Campaign Registry, and carriers have blocked unregistered traffic since February 2025; restricted categories (sex, hate, alcohol, firearms, tobacco) need age-gating or are barred; and several states are stricter, for example Florida's limit of 3 messages per 24 hours and Texas's extension of its telemarketing law to SMS with a private right of action. The same vendor guide wrongly states that a one-to-one consent rule took effect in January 2026, which the law-firm sources contradict ([Infobip](https://cdn-web.infobip.com/uploads/markdown-exports/www.infobip.com/blog/tcpa-compliance-sms.md)). **[INFERENCE]** Agent guardrails for SMS: never send a marketing text without a stored, dated written-consent record for that brand; enforce recipient-local quiet hours; treat any natural-language opt-out as revocation; and cap frequency, with Florida's 3 per 24 hours as a sensible national floor.

**[VENDOR benchmarks]** Klaviyo's 2026 SMS averages are click rate 5.6% for campaigns and 9.65% for flows, and placed-order rate 0.27% for campaigns and 1.9% for flows; SMS flow revenue per recipient is $4.48 for abandoned cart, $3.33 for welcome and $1.04 for browse abandonment ([Klaviyo SMS benchmarks](https://www.klaviyo.com/products/sms-marketing/benchmarks); [Klaviyo](https://www.klaviyo.com/blog/abandoned-cart-benchmarks)). The widely quoted "98% SMS open rate" traces to a 2010 figure its publisher no longer stands behind ([Digital Applied](https://www.digitalapplied.com/blog/sms-marketing-statistics-2026-open-ctr-data)). Postscript's phone-capture popup conversion is 3.6% at the median and 8.6% at the 90th percentile ([Postscript](https://postscript.io/sms-benchmarks)). Omnisend reports SMS volume up 40% year on year, automated SMS at $0.74 per send against $0.15 for campaigns, and automated push notifications with nearly 10 times the conversion rate of campaign push ([Omnisend](https://www.omnisend.com/2026-ecommerce-marketing-report)).
