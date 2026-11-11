---
id: marketing.lifecycle.sender-requirements
department: marketing
domain: lifecycle
title: Gmail, Yahoo and Microsoft sender requirements are enforced by rejection
summary: Bulk senders need SPF, DKIM, aligned DMARC, one-click unsubscribe and a spam rate below 0.3% (target 0.1%) at Gmail and Yahoo, and SPF, DKIM and DMARC at Microsoft; non-compliant mail is rejected.
type: policy
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- email
objectives:
- retention
- sales
sources:
- https://support.google.com/a/answer/81126?hl=en
- https://support.google.com/a/answer/14229414?hl=en
- https://senders.yahooinc.com/best-practices/
- https://techcommunity.microsoft.com/blog/outlook/strengthening-email-security-outlook-new-requirements-for-high-volume-senders/4399730
related:
- marketing.lifecycle.deliverability-operating-rules
- marketing.lifecycle.warm-up-hygiene-and-sunsetting
seed_version: 1
---

**When to use this:** Before any marketing email programme sends, and when auditing a sending domain.

## Mailbox-provider rules are now enforced by rejection

**[DURABLE since Feb 2024; Google's own pages, read Nov 2026]** All senders to personal Gmail accounts need SPF or DKIM, valid forward and reverse DNS, TLS, RFC 5322 formatting and a spam rate in Postmaster Tools below 0.3%. Senders of more than 5,000 messages a day to Gmail additionally need **SPF and DKIM, DMARC (the policy may be p=none), a From domain aligned with either the SPF or the DKIM domain, and one-click unsubscribe on marketing and subscribed messages plus a clearly visible unsubscribe link in the body**. Google's wording on complaints is to keep the spam rate "below 0.10% and avoid ever reaching a spam rate of 0.30% or higher". One-click unsubscribe needs both headers, `List-Unsubscribe-Post: List-Unsubscribe=One-Click` and `List-Unsubscribe: <https://...>` (RFC 8058); preference centres are allowed but must not replace one-click. DKIM keys must be 1024 bits or longer, with 2048 recommended ([Google Email sender guidelines](https://support.google.com/a/answer/81126?hl=en)). A bulk sender is one sending close to 5,000 or more messages to personal Gmail accounts in 24 hours, counted across the same primary domain, and a sender that meets the threshold once is permanently treated as a bulk sender. Bulk senders above 0.3% user-reported spam are ineligible for mitigation until they stay under 0.3% for 7 consecutive days. **"Starting November 2025, Gmail is ramping up its enforcement on non-compliant traffic"**, with temporary and permanent rejections. Google recommends honouring unsubscribes within 48 hours; transactional messages are excluded from the one-click requirement; and the guidelines apply only to personal Gmail accounts, not Google Workspace recipients ([Google sender guidelines FAQ](https://support.google.com/a/answer/14229414?hl=en)).

**[DURABLE; Yahoo's own page, read Nov 2026]** Yahoo requires SPF or DKIM at minimum for all senders and, for bulk senders, SPF and DKIM, DMARC of at least p=none that passes, a working List-Unsubscribe header with one-click, a visible unsubscribe link, unsubscribes honoured within 2 days, and a spam rate below 0.3% calculated on mail delivered to the inbox. Yahoo adds: send marketing mail from different IPs and DKIM domains than transactional mail, use confirmed opt-in, enrol every DKIM domain in the Complaint Feedback Loop, and remove invalid addresses promptly ([Yahoo Sender Hub](https://senders.yahooinc.com/best-practices/)). **[DURABLE; Microsoft, April 2025]** For domains sending more than 5,000 emails a day to outlook.com, hotmail.com and live.com, SPF and DKIM must pass and DMARC must be at least p=none aligned with SPF or DKIM; enforcement began 5 May 2025 and non-compliant mail is rejected with error 550 5.7.515 ([Microsoft Tech Community](https://techcommunity.microsoft.com/blog/outlook/strengthening-email-security-outlook-new-requirements-for-high-volume-senders/4399730)).
