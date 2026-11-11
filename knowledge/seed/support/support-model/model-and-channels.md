---
id: support.support-model.model-and-channels
department: support
domain: support-model
title: 'Customer support: Support model and channels'
summary: Choosing channels by issue complexity, customer channel expectations in 2025 to 2026, third-party AI assistants as a channel, not forcing AI first, synchronous speed, a default channel set for a small SaaS, tiers versus swarming, and help-centre quality.
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
- https://hbr.org/2010/07/stop-trying-to-delight-your-customers
- https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/
- https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0
- https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai
- https://library.serviceinnovation.org/Intelligent_Swarming/Practices_Guide/15_Why_Intelligent_Swarming
- https://community.intercom.com/analyze-fin-93/what-is-considered-a-good-fin-resolution-rate-4784
related:
- support.tickets.intake-severity-sla-escalation
- support.ai-support.ai-led-support-and-limits
seed_version: 1
cross_refs:
  '15':
  - support.knowledge-management.knowledge-management
  '24':
  - support.compliance.accessibility-and-language
---

**When to use this:** When choosing or changing support channels, tiering or swarming, and the role of the help centre and AI.

**Source section:** 10. Support model and channels

### Choose channels by issue complexity and keep switching to a minimum

[DURABLE] The CEB study behind "Stop Trying to Delight Your Customers" (more than 75,000 people with contact-centre or self-service interactions; published July 2010, so a durable principle and not a current benchmark) recommends five effort-reducing tactics: head off the next issue instead of only closing the current one, equip agents for the emotional side, minimise channel switching, learn from frustrated customers, and prioritise solving the problem over speed ([HBR, July 2010](https://hbr.org/2010/07/stop-trying-to-delight-your-customers)). Use self-service and AI for known issues and people for new or emotionally loaded ones; every added channel raises switching risk.

### What customers expect from channels in 2025 to 2026

[VENDOR] [FAST-MOVING, November 2025] Zendesk's CX Trends 2026 (two surveys in June 2025, 6,182 consumers and 5,115 business respondents in 22 countries including Sweden and Denmark) reports that 74% of consumers now expect 24/7 service because of AI, 74% are frustrated when they must repeat information, 81% want conversations to continue without backtracking, and 76% would choose a company that lets them share text, images and video in one thread ([Zendesk press release, 18 November 2025](https://www.zendesk.com/newsroom/press-releases/contextual-intelligence-becomes-the-new-standard-for-exceptional-customer-experience-in-2026/)). In the same report 85% of CX leaders said customers will leave brands that cannot resolve an issue on first contact; that is leader opinion, not observed churn.

### Third-party AI assistants are now a self-service channel

[FAST-MOVING, August 2026] A Gartner survey of 3,566 B2B and B2C customers (February to March 2026) found customers were about three times more likely to have used a third-party GenAI tool such as ChatGPT, Gemini or Copilot than a company chatbot in their most recent service interaction ([Gartner, 4 August 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)). [INFERENCE] External assistants are therefore reading the public help centre on the customer's behalf, so public articles should be correct when read out of context: one question per article, explicit product, plan and version scope, a date, and no reliance on screenshots alone.

### Do not force AI as the compulsory first step

[FAST-MOVING, August 2026] Gartner recommends against making GenAI the mandatory first step for every issue, because customers pushed through repeated failed AI attempts are less likely to use it again ([Gartner, 4 August 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)). Offer a visible route to a human from the start of every conversation.

### Synchronous channels carry a different speed expectation

[VENDOR] [FAST-MOVING, 2024 data] Freshworks' 2025 CX benchmark shows top-quintile teams answering messaging channels in seconds (web widget about 10 seconds, WhatsApp about 18 seconds) and resolving in under 4 minutes, against hours for tickets ([Freshworks, The Works](https://www.freshworks.com/theworks/experience/freshworks-20205-cx-benchmark-thriving-with-ai)). These are best-in-class vendor figures; they illustrate the gap between chat and ticket expectations and are not typical performance.

### A default channel set for a small SaaS

[INFERENCE] The researchers' rule of thumb: offer one asynchronous channel (email or in-app ticket) plus one synchronous or near-synchronous channel (chat or messaging, AI-first with human handoff) before adding phone, community or social. Add phone only for high-severity B2B accounts or regulated or emotional issues. A small Sweden-based team probably cannot staff true 24/7 human coverage; a reasonable design is AI coverage around the clock with clearly stated human hours in Central European Time and an on-call path for Severity 1 only. For consumer products the accessibility rules in section 24 argue for at least two channels of different modality.

### Tiered support versus swarming

[DURABLE] The Consortium for Service Innovation argues tiered support works well only when most issues are simple and solved at first contact; at moderate complexity it produces queues, handoffs, bouncing between teams, overloaded upper tiers and an us-versus-them culture. Swarming connects people to people for new issues on the basis of relevance and routes known issues to knowledge articles; it fits environments where self-service already absorbs known issues so that the remaining human workload is mostly novel ([Intelligent Swarming Practices Guide](https://library.serviceinnovation.org/Intelligent_Swarming/Practices_Guide/15_Why_Intelligent_Swarming)). [GAP] The Consortium offers no swarming-specific outcome data and no independent, dated comparison of swarming and tiering was found.

### Help-centre quality drives AI resolution

[PLATFORM CLAIM] An Intercom support engineer said AI agent resolution depends on set-up, volume and help-centre quality, and one customer in the same community thread reported a 25% resolution rate that improved after a team reviewed and maintained content snippets ([Intercom Community thread, 2023 to 2026](https://community.intercom.com/analyze-fin-93/what-is-considered-a-good-fin-resolution-rate-4784)). Treat knowledge maintenance (section 15) as the main lever on AI performance.

### What was not found on channels

[GAP] No reliable source was found for channel preference among Swedish or Nordic B2B SaaS buyers, and no independent benchmark for community-forum or social-support effectiveness.
