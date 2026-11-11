---
id: support.communication.communication-craft
department: support
domain: communication
title: 'Customer support: Communication craft'
summary: 'How to write support replies: effort reduction and solving outrank delight and speed, recovery and loyalty, apologies after serious failures, solution versus empathy messages, a reply structure for worker agents, saying no, abusive contacts (warn, then restrict), macros, and Swedish and English.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- resolution
- recovery
sources:
- https://hbr.org/2010/07/stop-trying-to-delight-your-customers
- https://www.helpscout.com/helpu/high-effort-customer-experiences/
- https://www.si-labs.com/en/articles/customer-effort-score/
- https://en.wikipedia.org/wiki/Service_recovery_paradox
- https://onlinelibrary.wiley.com/doi/10.1002/cb.70226
- https://www.academia.edu/180623627/Seeking_empathy_or_suggesting_a_solution_Effects_of_chatbot_messages_on_service_failure_recovery
- https://www.sciencedirect.com/science/article/pii/S0148296325005260
- https://www.gov.uk/guidance/unacceptable-customer-behaviour-policy
- https://www.callcentrehelper.com/policy-angry-abusive-customers-123183.htm
- https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/
- https://csa-research.com/l/media/Consumers-Prefer-their-Own-Language
related:
- support.house-style.complaints-mistakes-and-refunds
- support.compliance.vulnerable-customers-self-harm-threats
seed_version: 1
cross_refs:
  '6':
  - support.house-style.complaints-mistakes-and-refunds
  '21':
  - support.compliance.swedish-and-eu-consumer-law
  '24':
  - support.compliance.accessibility-and-language
---

**When to use this:** When writing any reply: effort reduction, recovery, apologies, saying no, abusive contacts, macros, Swedish and English.

**Source section:** 12. Communication craft

### Effort reduction and problem solving outrank delight and speed

[DURABLE] CEB's research concluded that solving the problem takes precedence over speed and that preventing follow-on contacts and handling the emotional side of the interaction reduce effort ([HBR, July 2010](https://hbr.org/2010/07/stop-trying-to-delight-your-customers)). [CONTESTED] The widely repeated figure that 96% of customers with a high-effort interaction became more disloyal versus 9% with low effort comes from the original CEB research (pre-2013, read only through a secondary summary, [Help Scout](https://www.helpscout.com/helpu/high-effort-customer-experiences/)); one analysis notes it has not been replicated at that magnitude, although the direction of the effect has been confirmed ([SI Labs](https://www.si-labs.com/en/articles/customer-effort-score/)). Use the direction, not the number.

### Good recovery lifts satisfaction but does not reliably create loyalty

[DURABLE] The service recovery paradox (McCollough and Bharadwaj, 1992) holds that a customer whose problem is satisfactorily resolved may end up more satisfied than if no failure had happened. A 2007 meta-analysis by de Matos, Henrique and Rossi found a significant positive effect on satisfaction but no consistent effect on repurchase intention, word of mouth or corporate image. Magnini and colleagues (2007) found the paradox most likely when the failure is seen as minor and outside the firm's control, and Michel and Meuter (2008) found it real but very rare and of little managerial relevance ([Wikipedia summary with citations](https://en.wikipedia.org/wiki/Service_recovery_paradox)). What to do: fix the cause first, keep compensation proportionate and rule-based, and never treat failures as opportunities.

### Apologies after serious failures should involve a human

[FAST-MOVING, 2025 to 2026] A consumer-behaviour study reports that an apology delivered by a human-plus-robot team earns more forgiveness than a robot-only apology after a high-severity failure, with perceived empathy as the mechanism ([Journal of Consumer Behaviour](https://onlinelibrary.wiley.com/doi/10.1002/cb.70226)). [INFERENCE] For high-severity failures the manager agent should route the apology to, or have it co-signed by, a named human. The studies are lab or scenario experiments, mostly outside Europe, and their validity for B2B SaaS is unknown.

### Solution messages signal competence, empathy messages signal warmth

[DURABLE] A chatbot recovery study found that solution-oriented messages raise perceived competence while empathy-seeking messages raise perceived warmth ([Academia.edu copy of the paper](https://www.academia.edu/180623627/Seeking_empathy_or_suggesting_a_solution_Effects_of_chatbot_messages_on_service_failure_recovery)), and prior studies summarised in a 2025 Journal of Business Research paper indicate that warm, emotional language from AI agents tends to raise satisfaction and willingness to forgive ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0148296325005260)). Combine both: a concrete fix plus one specific acknowledgement beats either alone. This agrees with the house-style rule in section 6 of validating before solving.

### A reply structure for worker agents

[INFERENCE] The researchers' synthesis for written replies: put the answer or outcome first; add one sentence acknowledging the specific inconvenience in the customer's own terms; give numbered steps if action is needed; say what happens next and when; and pre-empt the likely follow-up question. Avoid stacked apologies. No controlled evidence was found on specific de-escalation scripts or "positive language" techniques in written support.

### Saying no

[INFERENCE] Practitioner convention without controlled evidence: state the decision plainly, give the real reason, offer the nearest alternative or workaround, and say whether the request has been logged as feedback. Never imply a roadmap commitment. Where the "no" rejects a consumer's claim wholly or partly, the Swedish duty to include ARN's details applies (section 21).

### Abusive contacts: warn, then restrict, and still read the message

[DURABLE] The UK Valuation Office Agency's policy separates three categories (aggressive or abusive behaviour; inappropriate behaviour such as insults, innuendo or malicious allegations; and unreasonable demands or vexatious contact), requires a warning before any action so the customer can change behaviour, and permits ending calls and not replying to abusive emails while still reviewing the correspondence for any new issue raised ([GOV.UK](https://www.gov.uk/guidance/unacceptable-customer-behaviour-policy)). Call Centre Helper describes the traditional pattern of two warnings before ending the contact ([Call Centre Helper](https://www.callcentrehelper.com/policy-angry-abusive-customers-123183.htm)). [INFERENCE] For AI agents: one clear warning naming the behaviour, then restrict the channel or hand to a human supervisor, and always scan the abusive message for a legitimate issue before closing.

### Macros are building blocks, not finished replies

[VENDOR] Zendesk's QA guidance lists personalisation, tone and empathy as scorecard categories alongside solution accuracy, which is the usual control against robotic macro use ([Zendesk blog, updated 5 March 2026](https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/)). [INFERENCE] Treat macros as building blocks with mandatory variable slots (the customer's situation, the exact next step, a date) and audit the share sent unmodified.

### Swedish and English

[DURABLE] CSA Research (8,709 consumers in 29 countries, published July 2020) found 76% of online shoppers prefer to buy products with information in their own language; the finding concerns consumer purchase information, not B2B support ([CSA Research](https://csa-research.com/l/media/Consumers-Prefer-their-Own-Language)). [INFERENCE] Convention, with no study found: reply in the language the customer wrote in; keep Swedish informal ("du"), the normal business register in Sweden; keep product interface terms identical to the language the customer sees; and have a native speaker review Swedish macros instead of relying on machine translation. The legal position on language is in section 24.
