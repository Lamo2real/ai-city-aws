---
id: support.ai-support.ai-led-support-and-limits
department: support
domain: ai-support
title: 'Customer support: AI-led support and its limits'
summary: Vendor AI resolution claims versus real deployments, what staff and customers report, outcome pricing, customers insisting on a human, AI failure rates, explanations of AI decisions, gather-attempt-hand-off design, a compliance and control checklist, failure cases (Cursor, DPD, Klarna), economics and what to keep human.
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- resolution
sources:
- https://www.intercom.com/blog/from-resolutions-to-outcomes-evolving-how-fin-delivers-value
- https://fin.ai/learn/ai-resolution-rate
- https://community.intercom.com/analyze-fin-93/what-is-considered-a-good-fin-resolution-rate-4784
- https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai
- https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0
- https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service
- https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/
- https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/
- https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/
- https://arstechnica.com/ai/2025/04/cursor-ai-support-bot-invents-fake-policy-and-triggers-user-uproar/
- https://www.open.cx/blog/ai-hallucination-examples
- https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/
- https://www.entrepreneur.com/business-news/klarna-ceo-reverses-course-by-hiring-more-humans-not-ai/491396
- https://www.gartner.com/en/newsroom/press-releases/2026-01-26-gartner-predicts-genai-cost-per-resolution-for-customer-service-will-exceed-offshore-human-agent-costs-by-2030
- https://www.cxtoday.com/conversational-ai/gartner-no-fortune-500-firms-will-fully-replace-customer-support-staff-with-ai-by-2028/
- https://onlinelibrary.wiley.com/doi/10.1002/cb.70226
related:
- support.compliance.ai-disclosure-and-liability
- support.agent-guardrails.ai-agent-guardrails
seed_version: 1
---

**When to use this:** When designing or judging what the AI agents handle alone, and when they hand off to a human.

**Source section:** 16. AI-led support and its limits

### Vendor resolution claims sit far above what users report

[PLATFORM CLAIM] [FAST-MOVING, 2026] Intercom states that Fin's average resolution rate across customers is 76% (chart labelled June 2026; more than 12,000 teams), with no published methodology, and its marketing says top implementations exceed 80% and some reach 93% ([Intercom blog, 12 March 2026, modified September 2026](https://www.intercom.com/blog/from-resolutions-to-outcomes-evolving-how-fin-delivers-value); [fin.ai](https://fin.ai/learn/ai-resolution-rate)). Intercom staff said a conversation counts as resolved if the customer clicks that the answer helped or simply stops replying after an answer ([Intercom Community](https://community.intercom.com/analyze-fin-93/what-is-considered-a-good-fin-resolution-rate-4784)). Freshworks reports AI agents deflecting up to 53% of queries in retail, its best industry, on 2024 data ([Freshworks, The Works](https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai)).

### What staff and customers report in practice

[FAST-MOVING, 2023 to 2026] In an Intercom community thread, a support engineer called roughly 30 to 50% a good starting resolution rate in 2023 and said there is no standard figure; customers reported 25% (November 2024), 55 to 60% over about 3,000 conversations (December 2024), and about 45% by design because many conversations are routed to humans (May 2026) ([Intercom Community](https://community.intercom.com/analyze-fin-93/what-is-considered-a-good-fin-resolution-rate-4784)). [INFERENCE] A realistic planning range is 25 to 50% true autonomous resolution in the first months on a decent knowledge base, rising with content work; any figure above about 60% needs a strict definition check (no recontact within 7 days, no silent abandonment). [GAP] No independent, audited measurement across vendors was found.

### Pricing is moving from resolutions to outcomes

[PLATFORM CLAIM] [FAST-MOVING, 2026] Intercom is moving Fin pricing from per-resolution to per-"outcome", where an outcome includes completing a configured procedure that then hands off to a human ([Intercom blog](https://www.intercom.com/blog/from-resolutions-to-outcomes-evolving-how-fin-delivers-value)). Finance should model AI cost per resolved contact on the company's own definition of resolved.

### Customers insist on a route to a human

[FAST-MOVING, August 2026] Gartner (3,566 B2B and B2C customers, February to March 2026): 87% say access to a human agent is essential when a company uses GenAI for service; 50% say GenAI makes interactions easier; 58% of GenAI users have had it complete a task for them, 74% in B2B ([Gartner, 4 August 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)). An older baseline (5,728 customers, December 2023): 64% would prefer companies not use AI in customer service, 53% would consider switching if they learned a company would, and the top worry was that AI makes it harder to reach a person ([Gartner, 9 July 2024](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)).

### AI customer service fails about one user in five

[FAST-MOVING, October 2025] Qualtrics XM Institute (more than 20,000 consumers, 14 countries including Sweden, third quarter 2025): nearly one in five who used AI for customer service saw no benefit, a failure rate almost four times that of AI use generally; top concerns were misuse of personal data (53%, up 8 points), losing human contact (50%) and job losses (47%); only 39% trust companies to use personal data responsibly and 46% say transparency would make them more willing to share data. Its analyst attributes the gap to firms deploying AI to cut costs instead of solving problems ([Qualtrics, 7 October 2025](https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/)).

### Customers expect explanations of AI decisions

[VENDOR] [FAST-MOVING, November 2025] Zendesk reports that 95% of consumers expect an explanation for AI-made decisions and 79% say plain-language reasoning matters ([Zendesk, 18 November 2025](https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/)).

### Design practice: gather, attempt only when confident, hand off with context

[FAST-MOVING, 2024 to 2026] Gartner's recommendations: use GenAI to gather information and identify intent, let it attempt resolution only when highly confident, always give a clear route to a human, tell customers when they will be connected to an agent if the AI cannot solve the issue, and pass context so the agent picks up where the bot stopped ([Gartner, 4 August 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0); [Gartner, 9 July 2024](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)). [INFERENCE] No published numeric confidence threshold was found; gate autonomous answers on three conditions: retrieval found an approved article matching the product and plan, the action is reversible and low-value, and no risk flag is present (legal threat, security, billing dispute, vulnerable or angry customer, churn intent).

### A compliance and control checklist for customer-facing AI

[DURABLE] CMSWire's checklist: inventory all customer-facing AI including auto-drafted emails; confirm provider and deployer roles; test that the AI notice appears at first interaction in every channel; keep per-interaction evidence that it appeared; record what the AI concluded at escalation and what the human changed; and give AI agents their own identities with least-privilege access, audit logs and human review for consequential actions ([CMSWire](https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/)).

### Failure case: Cursor's invented policy

[DURABLE] In April 2025 an AI support agent at Cursor, presented under the human name "Sam", invented a one-device-per-subscription policy; users announced cancellations publicly, the co-founder apologised and refunded the affected user, and many users had assumed Sam was human ([Ars Technica](https://arstechnica.com/ai/2025/04/cursor-ai-support-bot-invents-fake-policy-and-triggers-user-uproar/)). Lessons: never state a policy that is not in an approved source, and never use a human-sounding persona without an explicit AI notice.

### Failure case: DPD's overridden chatbot

[DURABLE] In January 2024, after a user told DPD's chatbot to disregard its rules, it swore and wrote a poem criticising the company; the screenshot drew about 1.3 million views before DPD disabled the bot (secondary source, [open.cx roundup](https://www.open.cx/blog/ai-hallucination-examples)). Lesson: agents must resist instruction-override attempts from customers.

### Failure case: Klarna's partial reversal

[PLATFORM CLAIM] [DURABLE] Klarna said in February 2024 that its AI assistant handled two-thirds of service chats (2.3 million conversations) in its first month, did work equivalent to 700 full-time agents, matched human CSAT, cut repeat inquiries by 25% and cut resolution time from 11 minutes to under 2 ([Klarna press release, 27 February 2024](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/)). In May 2025 its CEO said the company was hiring human service staff again so that a person is always available, conceding that the cheaper AI route had produced lower quality ([Entrepreneur, 9 May 2025](https://www.entrepreneur.com/business-news/klarna-ceo-reverses-course-by-hiring-more-humans-not-ai/491396)). A press account's "about 75% of chats" conflicts with Klarna's own two-thirds; use the primary figure. Klarna's position after May 2025 was not verified on a primary source.

### Economics: full automation is forecast to get more expensive

[FAST-MOVING, January 2026] Gartner predicts that by 2028 AI-related regulation will raise assisted-service volume by 30% as customers use rights to opt out of AI, says full automation will be prohibitively expensive for most organisations, and expects many organisations to retain or rehire human agents, possibly at higher pay ([Gartner, 26 January 2026](https://www.gartner.com/en/newsroom/press-releases/2026-01-26-gartner-predicts-genai-cost-per-resolution-for-customer-service-will-exceed-offshore-human-agent-costs-by-2030)). It is also reported, via a secondary source, as predicting that no Fortune 500 firm will fully replace support staff with AI by 2028 ([CX Today](https://www.cxtoday.com/conversational-ai/gartner-no-fortune-500-firms-will-fully-replace-customer-support-staff-with-ai-by-2028/)).

### What to keep human

[INFERENCE] Drawing on the academic apology finding and the practitioner rule that consequential AI actions need human review ([Journal of Consumer Behaviour](https://onlinelibrary.wiley.com/doi/10.1002/cb.70226); [CMSWire](https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/)), the researchers recommend keeping human or human-approved: security and account-recovery decisions, refunds and credits above a set limit, contract and legal questions, data-protection requests beyond routing, Severity 1 communications, complaints about the AI itself, cancellations with retention implications beyond the standard offer, and apologies for serious failures. For an EU vendor, "talk to a human" should be an always-available command with stated human hours when nobody is online.
