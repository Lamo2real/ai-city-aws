---
id: legal.contracts.ai-contract-terms
department: legal
domain: contracts
title: 'Legal: AI-specific contract terms in 2026'
summary: 'AI-specific contract terms in 2026: what the largest model vendors'' business terms give (training on inputs, IP
  indemnities, retention), the standalone AI addendum, copyright in AI output and what not to warrant, and flow-down: never
  promise customers more than the upstream model vendor gives. Orientation as of 11 November 2026, not legal advice.'
type: policy
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
objectives:
- contracts
- ip
- ai
sources:
- https://www.anthropic.com/legal/commercial-terms
- https://openai.com/policies/services-agreement/
- https://www.axiomlaw.com/blog/ai-addendums-contract-clauses-to-negotiate-with-ai-vendors
- https://www.shumaker.com/insight/when-your-saas-vendor-becomes-an-ai-company-overnight/
- https://www.digg.se/ai-for-offentlig-forvaltning/riktlinjer-for-generativ-ai/bedom-upphovsratten-vid-anvandningen-av-generativ-ai
seed_version: 1
cross_refs:
  '11':
  - legal.ai-regulation.eu-ai-act-and-swedish-supervision
---

**When to use this:** When buying or selling AI features: model vendors' business terms, the AI addendum, warranties on AI output and flow-down from upstream vendors.

**Source section:** 5. AI-specific contract terms in 2026

### What the two largest model vendors' business terms give

**[PLATFORM CLAIM] [FAST-MOVING, effective 17 June 2025]** Anthropic's Commercial Terms, effective 17 June 2025, under which EEA, UK and Swiss customers contract with Anthropic Ireland, provide that the customer retains rights in inputs and owns outputs, with Anthropic assigning any rights it has; that Anthropic may not train models on customer content from the services; and that Anthropic defends intellectual-property claims over paid use of the services and outputs, excluding customer modifications, combinations with non-Anthropic technology, customer inputs, knowing infringement, patents practised in an output and trademark use. Direct liability is capped at fees paid in the previous 12 months, the cap does not apply to indemnities, customers may not build competing products or train competing models, and Irish law with Dublin arbitration applies for EEA customers. Status: read on the vendor's own terms page; a vendor's statement of its own terms ([Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)).

**[PLATFORM CLAIM] [FAST-MOVING, effective 17 June 2025]** Anthropic's Commercial Terms put on the customer the duty to evaluate whether outputs fit the use case, including whether human review is needed, and to tell users that factual claims in outputs should be independently verified. A SaaS company embedding the model inherits that duty and should pass it to its own customers. Status: read on the vendor's own terms page ([Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)).

**[PLATFORM CLAIM] [FAST-MOVING, effective 1 Jan 2026]** OpenAI's Services Agreement, effective 1 January 2026, provides that the customer keeps ownership of input and owns all output, with OpenAI assigning its rights; that customer content is not used to develop or improve the services unless the customer explicitly agrees; and that OpenAI indemnifies third-party intellectual-property claims against the services, excluding combinations, third-party modifications, customer content and customer applications. A separate service-specific output indemnity is stated to sit outside any liability cap; liability is capped at amounts paid in the prior 12 months except for gross negligence, wilful misconduct, indemnities and payment obligations; customers may not use output to develop competing AI models; and Irish law applies for EEA, Swiss and UK customers. Status: read on the vendor's own terms page ([OpenAI Services Agreement](https://openai.com/policies/services-agreement/)).

### The standalone AI addendum

**[VENDOR] [FAST-MOVING, Sept 2026]** Practitioner commentary from September 2026 describes the standalone AI addendum as the emerging contracting vehicle, with core clauses covering data-category definitions (customer data, outputs, telemetry, derived data, embeddings), a broad no-training covenant covering prompts, outputs and metadata and the verbs train, fine-tune, optimise and improve, limits on de-identified data, output assignment, logging and audit, human-in-the-loop obligations, an AI-specific indemnity conditioned on responsible use, and deletion at termination. It warns that "improve the services" wording can be read to permit training and that an AI indemnity capped at one or two times annual contract value may not cover a serious dispute. Status: secondary source only, from a legal-services vendor ([Axiom Law, September 2026](https://www.axiomlaw.com/blog/ai-addendums-contract-clauses-to-negotiate-with-ai-vendors)).

**[VENDOR]** Commentary on existing SaaS vendors adding AI features recommends defining "material change" with advance notice and a termination right, a default rule that customer data is not used for training without express written consent, treating ownership of AI-generated outputs as a third intellectual-property category, and extending indemnities to AI output claims. Status: secondary source only, undated law-firm commentary ([Shumaker](https://www.shumaker.com/insight/when-your-saas-vendor-becomes-an-ai-company-overnight/)).

### Copyright in AI output: what not to warrant

**[FAST-MOVING, Nov 2026]** DIGG, the Swedish Agency for Digital Government, states in its generative-AI guidance that copyright can arise only for works created by humans, that AI-assisted works can be protected where the result is mainly the product of human effort, that no clear guideline or case law marks the line, and that documenting the human creative process is recommended. Status: checked on the authority's own page; it is public-sector guidance, not a binding rule ([DIGG](https://www.digg.se/ai-for-offentlig-forvaltning/riktlinjer-for-generativ-ai/bedom-upphovsratten-vid-anvandningen-av-generativ-ai)).

**[INFERENCE]** Ownership of output assigned by a model vendor may assign nothing if no copyright subsists, so contracts should add confidentiality and contractual use restrictions instead of relying on intellectual property alone. Agents must not draft a warranty that AI outputs are protectable by copyright or that they are accurate.

### Flow-down: do not promise more than the upstream vendor gives

**[INFERENCE]** A SaaS company that embeds third-party models cannot promise customers more than the upstream vendor gives. Positions that mirror both vendors' published terms and are therefore safe to offer are: the customer owns outputs to the extent permitted by law; no training of generally available models on customer content; and an output intellectual-property indemnity only with the vendors' exclusions (customer inputs, modifications, combinations, knowing infringement).

**[INFERENCE]** Customer AI-use restrictions worth mirroring in an acceptable use policy, because upstream terms impose them, are: no building competing models from outputs, no reverse engineering, compliance with the model vendor's usage policy, and a duty on the customer to apply human review to consequential uses.

**[INFERENCE]** Contract calendar for AI clauses: Article 50 transparency allocation (who labels AI output, who discloses chatbot interaction) should already be in customer-facing terms since 2 August 2026, and high-risk allocation clauses should be revisited ahead of 2 December 2027 (dates in section 11).

**[INFERENCE]** Escalate to a human lawyer any customer request for an uncapped AI indemnity, any use case in the AI Act Annex III areas (employment, credit, education), any request to train on customer data, and any representation about training-data provenance.

### Gaps in the AI contract-terms research

**[GAP]** Not retrieved: Google (Cloud and Gemini) and Microsoft (Copilot and Azure OpenAI) terms and their indemnity programmes; EU model contractual clauses for AI procurement and any Swedish public-sector AI clauses; any Swedish law-firm briefing on AI contract terms; data on how often AI addenda are used in the Nordic market; and any case law on liability for AI output under Swedish tort or contract law.
