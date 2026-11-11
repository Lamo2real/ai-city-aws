---
id: marketing.lifecycle.deliverability-operating-rules
department: marketing
domain: lifecycle
title: Deliverability operating rules for marketing email
summary: One From address per message type, no fake Re or Fwd, honest display names, no bought lists or pre-ticked boxes; block sends from unauthenticated domains, alert at 0.1% spam rate, pause at 0.25%, and honour unsubscribes within 2 days.
type: checklist
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
related:
- marketing.lifecycle.sender-requirements
- marketing.agent-guardrails.guardrail-design
seed_version: 1
---

**When to use this:** When setting up or running email sends, or reviewing an email before it goes out.

## Mailbox-provider rules are now enforced by rejection

**[DURABLE; Google]** Other Google rules that shape marketing practice: use one From address per message category; do not mix promotions into transactional messages; no "Re:" or "Fwd:" subject lines unless real; display names must identify the sender only (no "Last Chance", no recipient name, no emojis imitating verification); do not hide content with HTML or CSS; do not buy lists; avoid pre-checked opt-in boxes; confirm addresses before subscribing; and consider unsubscribing people who do not open or read. Google also states that it does not track open rates and that low open rates are not necessarily a sign of deliverability problems ([Google Email sender guidelines](https://support.google.com/a/answer/81126?hl=en)). **[INFERENCE]** A safe operating rule for an agent: block any marketing send from a domain that lacks SPF, DKIM and DMARC alignment or one-click headers; alert at a 0.1% Gmail spam rate and pause non-essential sends at 0.25%, because recovery from 0.3% requires 7 clean days; and build to the 2-day unsubscribe standard, which is far tighter than the 10 business days in US law. B2B senders to Workspace and corporate Outlook are not formally bound by these consumer-mailbox rules, but the same authentication is the practical baseline.
