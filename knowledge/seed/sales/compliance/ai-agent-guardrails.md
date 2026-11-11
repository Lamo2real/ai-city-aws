---
id: sales.compliance.ai-agent-guardrails
department: sales
domain: compliance
title: 'Sales: AI-agent guardrails'
summary: 'The guardrails for AI sales agents: AI disclosure, human approval before prices, discounts, guarantees, contracts and new outreach lists, logging and other hard gates outside the model.'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- prospecting
- closing
sources:
- https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force
- https://artificialintelligenceact.eu/article/50/
- https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/
- https://www.federalregister.gov/documents/2024/09/10/2024-19028/implications-of-artificial-intelligence-technologies-on-protecting-consumers-from-unwanted-robocalls
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/marknadsforingslag-2008486_sfs-2008-486/
- https://www.gesetze-im-internet.de/englisch_uwg/englisch_uwg.html
- https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/forbrukertilsynets-veiledning-markedsforing-via-e-post-sms-o-l
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://curia.europa.eu/juris/liste.jsf?num=C-634/21
- https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/
- https://www.konsumentverket.se/marknadsratt-foretag/telefonforsaljning-regler-for-foretag/
- https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/
- https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- https://www.linkedin.com/legal/user-agreement
- https://genai.owasp.org/llm-top-10/
- https://fin.ai/learn/ai-guardrails-customer-service
- https://www.salesforce.com/welcome-to-the-agentic-enterprise/ai-guardrails/
- https://www.ytt-ai.com/post/sales-ai-guardrails-what-your-agent-should-never-say
- https://iccwbo.org/news-publications/policies-reports/icc-advertising-and-marketing-communications-code/
related:
- sales.compliance.outreach-by-country-and-channel
- sales.compliance.sweden
- sales.compliance.recording-and-eu-sales-tactics
- sales.compliance.contracting-bribery-competition-data
- sales.ai-in-sales.supported-and-not
seed_version: 1
cross_refs:
  '11':
  - sales.precedence.compliance-evidence-house-style
  '24':
  - sales.outbound.channels
  '27':
  - sales.compliance.outreach-by-country-and-channel
---

**When to use this:** Before any agent action that reaches a customer: disclosure, approvals, price and contract gates, logging.

**Source section:** 31. AI-agent guardrails

### Disclose that the agent is an AI at first interaction

**[FAST-MOVING, Aug 2026; secondary source only]** The AI Act's Article 50 duties became applicable on 2 August 2026. Providers must design systems so that people know they are interacting with AI unless that is obvious to a reasonably well-informed person; synthetic audio, image, video and text must carry machine-readable marking; the information must be clear and given at the latest at first interaction; generative systems already on the market before 2 August 2026 have until 2 December 2026 for marking; and fines reach EUR 15 million or 3% of turnover ([Goodwin, Aug 2026](https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force); [artificialintelligenceact.eu, Article 50](https://artificialintelligenceact.eu/article/50/)). The same sources say the AI Omnibus (Regulation (EU) 2026/1744, in force 27 July 2026) moved high-risk deadlines to 2 December 2027 without moving the chatbot disclosure duty, that the Commission adopted transparency guidelines on 20 July 2026, that deployers must disclose deepfakes, and that deployers of emotion-recognition systems must inform the people exposed ([Goodwin, Aug 2026](https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force); [artificialintelligenceact.eu, Article 50](https://artificialintelligenceact.eu/article/50/)). **[INFERENCE]** Every outbound agent message on a new thread, chat or call opens with an AI disclosure; "obvious from context" is too uncertain to rely on in email or voice. **[GAP]** The amending regulation and the Commission's guidelines were not opened on the official site, and who enforces Article 50 in Sweden today was not confirmed; an inquiry proposed the telecoms regulator as main market surveillance authority ([Regeringen, 6 Oct 2025](https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/)).

### AI voices need prior consent

**[DURABLE; checked on primary source]** In the US, AI-generated and cloned voices are artificial voices under the TCPA ([Federal Register, 10 Sep 2024](https://www.federalregister.gov/documents/2024/09/10/2024-19028/implications-of-artificial-intelligence-technologies-on-protecting-consumers-from-unwanted-robocalls)). In Sweden, Germany and Norway automated calling systems to natural persons need prior consent ([Marknadsföringslag (2008:486)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/marknadsforingslag-2008486_sfs-2008-486/); [UWG, English text](https://www.gesetze-im-internet.de/englisch_uwg/englisch_uwg.html); [Forbrukertilsynet guidance, updated 8 May 2026](https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/forbrukertilsynets-veiledning-markedsforing-via-e-post-sms-o-l)), and in the UK automated calls require specific consent ([ICO, B2B marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)). **[GAP]** No Swedish regulator statement on cloned voices in sales was found.

### Automated decisions about individuals

**[DURABLE; unverified, not fetched]** GDPR Article 22 gives a right not to be subject to solely automated decisions with legal or similarly significant effects unless an exception applies, with human-intervention safeguards; the EU Court of Justice held in December 2023 that producing a score on which a third party draws strongly can itself be such a decision ([GDPR on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [CJEU C-634/21](https://curia.europa.eu/juris/liste.jsf?num=C-634/21)). **[INFERENCE]** Lead scoring that only prioritises outreach is unlikely to be such a decision, but automated individual pricing, credit or eligibility refusal for natural persons likely is, so those need human review and an explanation path.

### The company answers for what its agent says

**[DURABLE; secondary source only]** In Moffatt v. Air Canada (14 February 2024) a Canadian tribunal held an airline liable for negligent misrepresentation after its chatbot misstated a fare policy, rejecting the argument that the chatbot was a separate entity and holding that correct information elsewhere on the site was no defence ([American Bar Association, Feb 2024](https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/)). Swedish marketing law makes the principal primarily responsible and helpers liable as accessories (checked on primary source, [Konsumentverket, rules for companies, reviewed 6 Sep 2026](https://www.konsumentverket.se/marknadsratt-foretag/telefonforsaljning-regler-for-foretag/)). **[INFERENCE]** Together with the offer-binding principle of Swedish contract law, a price or term stated by an agent is likely to bind or create liability, which is the legal reason for human approval of pricing, discounts and contract terms. **[GAP]** No Swedish or EU case on contracts concluded by an AI agent was found.

### Platform terms that constrain agents

**[FAST-MOVING, 2025-2026; secondary source only]** From 15 January 2026 the WhatsApp Business interface bars providers whose main offering is a general-purpose AI assistant, while businesses using AI to serve their own customers are unaffected ([TechCrunch, 18 Oct 2025](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)). US SMS needs brand and campaign registration ([Twilio docs](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)). LinkedIn bans bots and automated messaging (unverified, not fetched, [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement)). Mailbox-provider rules are in section 24.

### Security risks specific to language-model agents

**[DURABLE; checked on primary source]** The OWASP Top 10 for LLM Applications 2025 names prompt injection, sensitive information disclosure, improper output handling, excessive agency, system prompt leakage and misinformation among the top risks ([OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/)). **[INFERENCE]** Inbound emails, web pages and CRM notes are untrusted input; worker agents must not be able to change prices, terms, recipients or tools on the strength of text found in them.

### Guardrail patterns documented by vendors

**[VENDOR]** One support-agent vendor describes four guardrail types (input, output, action, escalation), threshold limits such as refunds above a set value needing human approval, escalation on explicit request, negative sentiment or unresolved intent with full history handed over, and logging of every block, escalation and approval ([Fin.ai](https://fin.ai/learn/ai-guardrails-customer-service)). A CRM vendor advises defining data-access permissions, action authorisation, topic scope and escalation protocols, requiring human sign-off on high-stakes decisions and logging everything ([Salesforce on AI guardrails](https://www.salesforce.com/welcome-to-the-agentic-enterprise/ai-guardrails/)). A third says an AI sales rep should never negotiate custom pricing tiers, generate spontaneous discounts or alter standard payment terms ([YTT AI](https://www.ytt-ai.com/post/sales-ai-guardrails-what-your-agent-should-never-say)).

### The hard gates for this department

**[INFERENCE]** Gates enforced outside the model, drawn from sections 11 and 27 to 31: a send gate keyed on country, recipient type, channel, consent and suppression; a register and calling-hours gate for phone; a block on in-call acceptance and payment for Swedish consumers; a block on synthetic-voice outbound without recorded consent; human approval for quotes, discounts, non-standard terms, credit, gifts and public-sector benefits; a truth gate that blocks urgency, scarcity, proof and competitor claims without a system-of-record source; a hard stop after a refusal; a recording announcement on every call; an AI disclosure at first interaction; sanctions screening before a quote; and a log of what was said and why each gate fired.

### A compact code of conduct for agents

**[INFERENCE]** Drawn from the Swedish codes and regulator expectations: identify yourself and that you are an AI; state the commercial purpose first; tell the truth about product, price, scarcity and competitors; take the first clear refusal as final; do not pressure; do not exploit vulnerability; offer a human on request; log what was said. **[DURABLE; unverified, not fetched]** The International Chamber of Commerce's marketing code (11th revision, 2024) covers direct marketing and AI use and is applied in Sweden by the advertising ombudsman ([ICC Advertising and Marketing Communications Code](https://iccwbo.org/news-publications/policies-reports/icc-advertising-and-marketing-communications-code/)). **[GAP]** No international professional sales code was researched.
