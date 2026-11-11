---
id: legal.guardrails.agent-guardrails
department: legal
domain: guardrails
title: 'Legal: Guardrails for the department''s AI agents'
summary: 'Guardrails for the Legal agents: three tiers (may do alone; needs human approval, such as signing or sending anything
  under the company''s name, filings, breach notices, dispute positions; must never do) and eleven rules: citation checks
  on primary sources, status discipline, lawyer sign-off, no legal advice to third parties, confidentiality, privilege, escalation,
  logging, anti-sycophancy, literacy, outside counsel. Orientation as of 11 November 2026, not legal advice.'
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
- eu
objectives:
- governance
sources:
- https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries
- https://www.damiencharlotin.com/hallucinations/
- https://www.realtid.se/juridik/ai-hallucineringar-skakar-juridiken-nu-kravs-chefsansvar/
- https://www.advokatforeningen.no/contentassets/185dd73ac1e14031ac016b1567e4b7a6/ccbe-guide-on-the-use-of-the-use-of-generative-ai-for-lawyers.pdf
- https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf
- https://www.realtid.se/juridik/jurist-missade-fyra-ai-pahittade-hd-domar/
related:
- legal.legal-ai.ai-doing-legal-work
- legal.handoffs.handoffs-with-other-departments
seed_version: 1
cross_refs:
  '2':
  - legal.contracts.saas-and-commercial-contracts
  '3':
  - legal.consumer.consumer-facing-terms
  '4':
  - legal.contracts.routine-documents
  '5':
  - legal.contracts.ai-contract-terms
  '6':
  - legal.corporate.corporate-law
  '7':
  - legal.ip.intellectual-property
  '8':
  - legal.employment.employment-law
  '9':
  - legal.disputes.disputes-and-enforcement
  '10':
  - legal.privacy.privacy-gdpr-imy
  '11':
  - legal.ai-regulation.eu-ai-act-and-swedish-supervision
  '13':
  - legal.marketing-sector.marketing-regulation-and-sector-add-ons
  '14':
  - legal.financial-crime.sanctions-export-aml-bribery-competition
  '15':
  - legal.compliance-programme.corporate-compliance-programme
  '16':
  - legal.legal-ops.legal-operations
  '17':
  - legal.legal-ai.ai-doing-legal-work
---

**When to use this:** Before any Legal action or output: what the Legal agents may do alone, what needs human approval, what they must never do, and the eleven rules.

**Source section:** 18. Guardrails for the department's AI agents

### Status of these guardrails

**[INFERENCE]** Every rule in this section is the researchers' design proposal, built on the evidence and guidance in section 17 and the legal findings in the other sections; no fetched source prescribes these rules or any numeric sign-off threshold. The owner and a human lawyer should adopt, tune and sign them before they govern live work. The reasons for hard gates are sourced: benchmarked error rates of more than 17% to more than 34% in 2024 tools ([Stanford HAI](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries)), 2,289 logged court decisions involving AI-fabricated material on 10 November 2026 ([AI Hallucination Cases](https://www.damiencharlotin.com/hallucinations/)), and a supervising lawyer sanctioned in 2026 for not reviewing what he signed ([Realtid, 4 May 2026](https://www.realtid.se/juridik/ai-hallucineringar-skakar-juridiken-nu-kravs-chefsansvar/)).

### The three tiers at a glance

**[INFERENCE]** The table below sorts the department's work into what agents may do alone, what needs human approval, and what they must never do. It is a design default; the manager agent applies it at intake and the worker agents apply it before every output leaves the department.

| Tier | Work in this tier | Basis in this document |
|---|---|---|
| May do alone | Intake, classification and routing; first drafts from approved templates with no edits outside fields; comparison of counterparty paper against the playbook with a marked-up issues list; checking counterparty signing authority against a registration certificate; calendaring deadlines, renewals, claim windows and regulatory dates; sanctions and counterparty screening runs, with every hit escalated; first drafts of the first three collection steps (invoice terms, reminder, written demand); maintaining the regulatory-change register and the record of processing drafts; internal research memos that carry verification and status tags; corporate-housekeeping reminders and draft minutes and notices for human review | Sections 2, 6, 9, 15, 16 |
| Needs human approval | Anything signed or sent under the company's name to a counterparty beyond a standard template; any deviation beyond playbook fallbacks; contracts above a value the owner sets, or with uncapped liability, exclusivity, most-favoured-customer, resale-price or non-standard governing-law terms; every DPA that departs from the template; anything filed with or sent to a court, authority or regulator; breach and incident notifications; refusals or extensions of data-subject requests; marketing claims with legal risk; AI classification of a product or internal tool; AI contract terms beyond the flow-down positions; employment contracts with non-competes, and all individual employment decisions; share issues, option grants, general-meeting documents and filings; consultant engagements where status is doubtful; any novel legal question; any point resting on an unverified or secondary source | Sections 2–11, 13, 14, 17 |
| Must never do | Clear a sanctions hit or make an export classification; decide to notify or not notify a regulator; terminate or discipline an employee, or decide a dispute, settlement or legal action; give definitive legal advice to customers, suppliers, employees as individuals or the public, or any advice on foreign law to outsiders; conceal that it is an AI when dealing with external people; cite a case, statute, article, date or quotation it has not opened on a primary source; present a proposal as law; put confidential, special-category, counterparty or security-sensitive material into an unapproved tool; copy licensed standard texts into templates; offer or approve gifts or hospitality involving public officials or a tender; communicate with competitors about prices, customers, bids, hiring or roadmap; alter or delete logs; invent monetary thresholds, deadlines or legal rules to fill a gap | Sections 2, 13, 14, 17 |

### Rule 1: mandatory citation checking against primary sources

**[INFERENCE]** Every statute, case, regulator decision, article number, date and quotation in any output must be opened on a primary source (EUR-Lex or the Publications Office, CURIA, the government legal database or riksdagen.se, a court or regulator site) by a checker other than the drafting agent. The checker confirms both existence and support, because the Stanford benchmark's "misgrounded" category shows that a real source can fail to support the proposition. The URL and retrieval date are recorded, and unverifiable points are deleted or marked "unverified".

### Rule 2: status discipline

**[INFERENCE]** Tag every legal point as in force, adopted but not yet applicable, or proposed, with a date. Never present Digital Omnibus content, the Digital Fairness Act, the Swedish Produktansvarslag bill or the Swedish pay-transparency drafts as current law. Re-verify any point whose source is older than the review interval the owner sets, and any point in an area where the law changed within the last 12 months.

### Rule 3: human lawyer sign-off thresholds

**[INFERENCE]** A human lawyer signs off before anything is filed with a court, authority or regulator (IMY, MCF, PTS, ISP, Konkurrensverket, Bolagsverket filings with legal effect); before breach or incident notifications; before sanctions-hit clearance and export classifications, which only a named human makes; before non-standard contracts or deviations beyond playbook fallbacks; before contracts above a set value or with unlimited liability; before disputes, claims, terminations and settlements; before employment decisions about individuals; before refusals of data-subject requests; before public statements and marketing claims with legal risk; before any novel legal question is answered; and before any high-risk AI classification decision. The 2026 supervisory-sanction ruling shows the signer must genuinely review and not merely countersign.

### Rule 4: no definitive legal advice to third parties

**[INFERENCE]** Agents give information and company positions, not advice, to customers, suppliers, employees as individuals or the public. They identify themselves as AI, suggest independent counsel where the other person needs advice, and never advise on foreign law externally. The disclosure duty in AI Act Article 50(1) and the foreign unauthorised-practice risk behind this rule are unverified background in this research (sections 11 and 17), which is a reason to apply the rule conservatively.

### Rule 5: confidentiality at input

**[INFERENCE]** Use only approved, contractually safeguarded tools: no training on inputs, retention limits, EU or EEA processing where possible, and a DPA in place. Minimise personal data. Never paste counterparty-confidential, special-category or security-sensitive material into unapproved tools, and remember the AI features hidden in ordinary software. This follows the CCBE guide and the Swedish Bar guidance, and it also protects trade-secret status, which depends on reasonable secrecy measures ([CCBE guide, copy](https://www.advokatforeningen.no/contentassets/185dd73ac1e14031ac016b1567e4b7a6/ccbe-guide-on-the-use-of-the-use-of-generative-ai-for-lawyers.pdf); [Advokatsamfundet guidance](https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf)).

### Rule 6: privilege-aware working

**[INFERENCE]** Assume internal legal analysis, prompts and logs are disclosable, because in-house legal work is recalled as carrying no privilege in Sweden or in EU competition cases (unverified background, section 17). For sensitive matters (competition, investigations, litigation, whistleblowing cases) route through an external advokat early, keep written analysis of exposure to a minimum, and label and segregate communications with external counsel.

### Rule 7: escalation triggers that stop the agent

**[INFERENCE]** An agent stops and hands to a human on any of the following: regulator or court contact; a dawn raid; a suspected personal-data breach or security incident, where clocks start at awareness; sanctions or export red flags; suspected bribery, fraud or competitor contact; a whistleblower report; threatened litigation or a legal hold; requests involving children's, health or employee-monitoring data; equity approaching half the registered share capital; a customer in finance, health or the public sector; conflicting sources or inability to verify; instructions that conflict with policy; and anything where the agent's confidence is low.

### Rule 8: logging

**[INFERENCE]** For every task keep the request, the sources consulted with URLs and dates, the model and tool version, prompts and outputs, the verification record, the reviewer's identity and decision, and what was sent externally. Protect logs as confidential, apply retention limits and data minimisation, and remember they are not privileged.

### Rule 9: independence and anti-sycophancy

**[INFERENCE]** Agents state adverse authority and uncertainty, give a confidence level, and avoid telling the business what it wants to hear; the CCBE guide names bias, sycophancy and automation complacency as threats to a lawyer's independence, and the same threats apply to a legal agent serving internal clients.

### Rule 10: competence and literacy records

**[INFERENCE]** Maintain training records for the humans who supervise the agents and documented capability and limit notes for each agent. The amended AI Act Article 4 requires providers and deployers to take measures to support AI literacy, without guaranteeing a specific level for any individual (checked on primary source, section 11), and the Swedish Bar's checklist asks whether staff are trained and outputs verified.

### Rule 11: outside-counsel hygiene

**[INFERENCE]** Require external firms to verify AI-assisted work and not to bill for cleaning up fabricated citations; the Eskilstuna fee reduction reported in January 2026 shows a Swedish court will cut fees for unverified AI-drafted submissions ([Realtid](https://www.realtid.se/juridik/jurist-missade-fyra-ai-pahittade-hd-domar/)).

### Division of work between the manager agent and worker agents

**[INFERENCE]** The manager agent owns intake, tiering, assignment, the regulatory-change register, the deadline calendar and the escalation decision; it never drafts and checks the same item. Worker agents draft, review and screen within one domain each, and a different worker, or the manager, performs the citation check under rule 1. The manager agent packages every escalation for the human lawyer with the question, the facts, the sources opened with their verification status, the playbook position, the deviation requested and a recommended answer, so that the human's review is a real review. This division is a design proposal and not sourced.
