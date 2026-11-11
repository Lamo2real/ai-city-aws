---
id: support.compliance.ai-disclosure-and-liability
department: support
domain: compliance
title: 'Customer support: AI disclosure and liability'
summary: 'AI disclosure and liability (orientation, not legal advice): AI Act Article 50 notice at first interaction, the Commission guidelines, the Digital Omnibus, penalties, disclosure in practice, Moffatt v. Air Canada and OLG Hamm (the company answers for its chatbot), and consumer rights regardless of channel.'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
sources:
- https://artificialintelligenceact.eu/article/50/
- https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- https://www.mondaq.com/uk/privacy-protection/1825278/european-commission-press-release-eu-ai-act-transparency-enforcement-starts-this-sunday-do-you-know-who-your-chatbots-are-we-break-down-the-commissions-guidelines-on-transparency-below
- https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/
- https://siliconcanals.com/the-eus-ai-act-starts-requiring-chatbot-and-deepfake-labels-on-august-2-while-its-tougher-rules-on-hiring-biometrics-and-migration-are-pushed-back-to-december-2027/
- https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/
- https://www.mme.ch/en/magazine/articles/liability-for-ai-german-court-takes-action
- https://cms.law/en/swe/publication/artificial-intelligence-and-copyright-case-tracker/germany-verbraucherzentrale-nordrhein-westfalen-e.v.v.-aesthetify-gmbh-12-may-2026
- https://lagen.nu/2022:260
- https://lagen.nu/1994:1512
- https://lagen.nu/2005:59
related:
- support.ai-support.ai-led-support-and-limits
- support.agent-guardrails.ai-agent-guardrails
seed_version: 1
---

**When to use this:** Before an AI agent speaks to a customer, and when deciding what an agent may promise.

**Source section:** 25. AI disclosure and liability

### Article 50: tell people they are dealing with an AI, at first interaction

[FAST-MOVING, August 2026] AI Act Article 50(1) requires AI systems that interact directly with people to be designed so that those people are informed they are interacting with an AI system, unless that is obvious to a reasonably well-informed, observant and circumspect person in context; Article 50(5) requires the information to be clear and distinguishable, given at the latest at first interaction, and accessible ([artificialintelligenceact.eu Art. 50](https://artificialintelligenceact.eu/article/50/); republished text of the regulation). The European Commission states that Article 50 applies from 2 August 2026 ([European Commission FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act); regulator page).

### Commission guidelines: helpdesk agents are not "obvious"

[FAST-MOVING, July 2026] According to a law-firm summary of the Commission's Article 50 guidelines (announced 30 July 2026, about 50 pages, not legally binding; secondary source only, final text not read): disclosure must be easy to notice at the point of interaction and not buried in terms or privacy notices; text, audio or visual formats are acceptable; no fixed wording is required; children, older users and assistive technology must be accounted for; helpdesk agents are generally not obvious enough for the exception; and the duty sits with the provider ([Mondaq](https://www.mondaq.com/uk/privacy-protection/1825278/european-commission-press-release-eu-ai-act-transparency-enforcement-starts-this-sunday-do-you-know-who-your-chatbots-are-we-break-down-the-commissions-guidelines-on-transparency-below)). A practitioner source adds that a footer or privacy-policy mention is not sufficient once the customer believes they are talking to a person ([CMSWire](https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/)).

### The Digital Omnibus did not delay the chatbot notice

[FAST-MOVING, July 2026] The Council gave final approval to the Digital Omnibus on 29 June 2026; it delays Annex III high-risk obligations to 2 December 2027 and product-embedded high-risk AI to 2 August 2028, but Article 50 was not delayed, except that legacy systems get until 2 December 2026 for machine-readable marking under Article 50(2) ([Silicon Canals, 18 July 2026](https://siliconcanals.com/the-eus-ai-act-starts-requiring-chatbot-and-deepfake-labels-on-august-2-while-its-tougher-rules-on-hiring-biometrics-and-migration-are-pushed-back-to-december-2027/); [Jones Walker, 16 July 2026](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html); secondary sources only). The Official Journal citation and exact entry-into-force date were not confirmed on EUR-Lex.

### Penalties and the code of practice

[FAST-MOVING, July 2026] Law-firm summaries (secondary sources only) put penalties for Article 50 breaches at up to EUR 15 million or 3% of worldwide annual turnover, whichever is higher, with the lower of the two for SMEs, enforced by the AI Office and national market surveillance authorities. A Code of Practice on marking and labelling AI-generated content was finalised on 10 June 2026 and found adequate by the Commission on 8 July 2026; adherence helps show compliance but is not conclusive ([Jones Walker, 16 July 2026](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html); [Mondaq](https://www.mondaq.com/uk/privacy-protection/1825278/european-commission-press-release-eu-ai-act-transparency-enforcement-starts-this-sunday-do-you-know-who-your-chatbots-are-we-break-down-the-commissions-guidelines-on-transparency-below)). Which Swedish authority supervises Article 50 was not researched.

### Disclosure in practice

[INFERENCE] The first message of every chat, email reply and voice call from an AI agent states that it is an AI assistant, in the customer's language, visible without scrolling, and the notice is repeated when a conversation resumes on a new channel. Although the statutory duty is on the provider, the deploying company controls the greeting and should treat it as its own duty. Keep per-interaction evidence that the notice appeared, and never give an AI agent a human-sounding persona without the notice.

### Moffatt v. Air Canada: the company answers for its chatbot

[DURABLE] In Moffatt v. Air Canada (British Columbia Civil Resolution Tribunal, 14 February 2024) a website chatbot told a customer he could claim a bereavement fare within 90 days after ticketing, contrary to the airline's policy. The tribunal found negligent misrepresentation, rejected the argument that the chatbot was a separate entity, held that correct information elsewhere on the site was no defence, and awarded about CAD 650 plus interest and fees ([American Bar Association, Business Law Today](https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/); reliable secondary source, decision text not read). It is a Canadian tribunal decision and persuasive only.

### OLG Hamm 2026: a European appellate court reaches the same attribution

[FAST-MOVING, May 2026] In Verbraucherzentrale Nordrhein-Westfalen v. Aesthetify GmbH (Oberlandesgericht Hamm, case I-4 UKl 3/25) a clinic's booking chatbot wrongly described two doctors as specialists in plastic and aesthetic surgery; the court granted an injunction for a misleading commercial practice, reasoning that the chatbot is part of the company's own business organisation and its statements are the company's, even if it was fed only correct data. Leave to appeal to the Federal Court of Justice was granted, so the decision is not final ([MME, 4 June 2026](https://www.mme.ch/en/magazine/articles/liability-for-ai-german-court-takes-action); [CMS case tracker](https://cms.law/en/swe/publication/artificial-intelligence-and-copyright-case-tracker/germany-verbraucherzentrale-nordrhein-westfalen-e.v.v.-aesthetify-gmbh-12-may-2026); secondary sources only). The two summaries differ on whether 12 May 2026 is the judgment date or the claim date.

### What the liability decisions mean for a Swedish SaaS

[INFERENCE] The German rule rests on the EU Unfair Commercial Practices Directive, which Sweden implements in Marknadsföringslagen, so a Swedish court or Konsumentombudsmannen could reach the same attribution; no Swedish decision was found, so this is a prediction. Both decisions treat "the bot said it" and "the right answer was elsewhere" as non-defences, so chat-window disclaimers are weak protection and accuracy controls matter more. A practical policy: when a bot has given a consumer a wrong but plausible commitment, honour it or compensate, then fix the source content; this follows the Moffatt outcome and the house-style recovery rule.

### Consumer rights apply regardless of channel

[DURABLE] Statutory consumer rights cannot be reduced by terms, unclear non-negotiated terms are read for the consumer, and a withdrawal message sent in time counts ([lagen.nu 2022:260](https://lagen.nu/2022:260); [lagen.nu 1994:1512](https://lagen.nu/1994:1512); [lagen.nu 2005:59](https://lagen.nu/2005:59); checked on primary source). [INFERENCE] A withdrawal, complaint or data request made to the bot counts as received by the company, so the bot must log and route it with a timestamp.

### What was not found on AI law

[GAP] No source was found for a general legal right to a human agent in customer service; the AI Act does not give one in the material read. The status of the AI Liability Directive proposal, the revised Product Liability Directive's application to software, any Swedish supplementary act, and sector rules on human intervention were not checked.
