---
id: legal.legal-ai.ai-doing-legal-work
department: legal
domain: legal-ai
title: 'Legal: AI doing legal work: evidence and professional rules'
summary: 'AI doing legal work: measured accuracy (the 2024 Stanford benchmark, the 2025 Vals benchmark), court sanctions and
  AI-hallucination incidents, the Swedish Bar Association''s guidance, the CCBE guide and other bar guidance, confidentiality
  and privilege (assume in-house work is disclosable), limits on giving legal advice to others and the four converging duties.
  Orientation as of 11 November 2026, not legal advice.'
type: benchmark
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- sweden
- eu
- us
objectives:
- ai
sources:
- https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries
- https://hai.stanford.edu/news/hallucinating-law-legal-mistakes-large-language-models-are-pervasive
- https://www.legalcheek.com/2025/10/ai-beats-lawyers-at-legal-research-study-finds
- https://www.damiencharlotin.com/hallucinations/
- https://www.realtid.se/juridik/jurist-missade-fyra-ai-pahittade-hd-domar/
- https://www.realtid.se/juridik/advokaternas-ai-logner-ledde-till-boter-avskracka-och-straffa/
- https://www.realtid.se/juridik/domstolarna-har-fatt-nog-av-advokaternas-ai-slarv/
- https://www.realtid.se/juridik/ai-hallucineringar-skakar-juridiken-nu-kravs-chefsansvar/
- https://www.advokatsamfundet.se/Nyhetsarkiv/2024/juni/allmanna-rad-om-generativa-ai-modeller-i-advokatverksamhet/
- https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf
- https://www.advokatforeningen.no/contentassets/185dd73ac1e14031ac016b1567e4b7a6/ccbe-guide-on-the-use-of-the-use-of-generative-ai-for-lawyers.pdf
- https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf
- https://www.sra.org.uk/sra/research-publications/artificial-intelligence-legal-market/
- https://resourcehub.bakermckenzie.com/en/resources/global-attorney-client-privilege-guide/europe-middle-east--africa/sweden/topics/07---artificial-intelligence
- https://rkrattsbaser.gov.se/sfst?bet=1942:740
- https://curia.europa.eu/juris/liste.jsf?num=C-550/07
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
related:
- legal.guardrails.agent-guardrails
seed_version: 1
cross_refs:
  '4':
  - legal.contracts.routine-documents
  '5':
  - legal.contracts.ai-contract-terms
  '18':
  - legal.guardrails.agent-guardrails
---

**When to use this:** Before relying on AI for legal work: measured accuracy, court sanctions for fabricated citations, bar guidance, confidentiality and privilege, limits on giving advice.

**Source section:** 17. AI doing legal work: evidence and professional rules

### Measured accuracy: the 2024 Stanford benchmark

**[FAST-MOVING, May 2024]** The Stanford RegLab and HAI benchmark, published 23 May 2024 and updated 30 May 2024, ran over 200 pre-registered open-ended legal queries and found hallucination rates above 17% for Lexis+ AI and Ask Practical Law AI and above 34% for Westlaw AI-Assisted Research. It distinguishes two failure types: "incorrect" (misstates the law or facts) and "misgrounded" (a correct proposition whose cited source does not support it). Retrieval-based legal tools did reduce errors compared with general chatbots, but vendors' hallucination-free claims did not hold. Status: checked on the publisher's own page; the figures describe 2024 product versions ([Stanford HAI](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries)).

**[GAP]** Earlier Stanford work from January 2024 is recalled as finding that general-purpose language models hallucinated on 58% to 88% of specific legal queries; this is unverified background, not fetched ([Stanford HAI, Hallucinating Law](https://hai.stanford.edu/news/hallucinating-law-legal-mistakes-large-language-models-are-pervasive)).

### Measured accuracy: the 2025 Vals benchmark

**[VENDOR] [CONTESTED] [FAST-MOVING, Oct 2025]** A Vals AI benchmarking report, reported in October 2025, compared four AI tools (Alexi, Counsel Stack, Midpage and ChatGPT) with practising lawyers on the same 200 legal research questions, scored for accuracy, authoritativeness and appropriateness. The AI systems scored 74% to 78% overall against a lawyer average of 69%; on accuracy the AI tools averaged 80% and the lawyers 71%. Lawyers outperformed the tools on four of ten question types, those needing more contextual judgment and multi-jurisdictional reasoning, by an average of nine percentage points. The method was zero-shot and several leading legal-tech vendors did not take part. Status: secondary source only (a news summary); the report itself was not opened ([Legal Cheek, Oct 2025](https://www.legalcheek.com/2025/10/ai-beats-lawyers-at-legal-research-study-finds)).

**[INFERENCE]** The Vals result does not contradict the Stanford findings: it measures different tools on research questions with a different method, and a 20% miss rate on accuracy still means every answer needs checking. Both are US-law benchmarks; no benchmark on Swedish or EU law was found, so agents must not assume either figure describes their own accuracy on Swedish material.

### Court sanctions and incidents

**[FAST-MOVING, 10 Nov 2026]** The AI Hallucination Cases database listed 2,289 cases across roughly 43 to 44 jurisdictions when fetched, last updated 10 November 2026, with its most recent entries dated 4 to 6 November 2026. Typical outcomes are warnings, admonishments and orders to show cause; visible recent monetary sanctions include USD 7,500 (Moore v. Jackson Walker, S.D. Tex., 21 October 2026) and USD 5,000 with bar referrals in two cases in October and November 2026. No Swedish case appeared in the database's jurisdiction filter. Status: checked on the database's own page ([Damien Charlotin, AI Hallucination Cases](https://www.damiencharlotin.com/hallucinations/)).

**[FAST-MOVING, 13 Jan 2026]** In Sweden, Eskilstuna tingsrätt criticised a law-firm lawyer whose AI-drafted submissions cited four non-existent Supreme Court rulings and misdescribed a Contracts Act provision; the court called the material "AI slop", noted the errors were not corrected after being pointed out, and reduced the claimed fee of SEK 2,100 per hour. It was reported on 13 January 2026, with no disciplinary action reported. Status: secondary source only (trade press); the case number was not found, and the incident is absent from the database above, so Swedish incidents are likely under-counted there ([Realtid](https://www.realtid.se/juridik/jurist-missade-fyra-ai-pahittade-hd-domar/)).

**[FAST-MOVING, 2025–2026]** Reported US sanctions include USD 3,000 each for two lawyers in the MyPillow and Lindell defamation case with nearly 30 defective citations (D. Colo., July 2025), USD 31,000 against K&L Gates and Ellis George, USD 6,000 in Indiana, and USD 5,000 in the original New York aviation case (Mata v. Avianca). Large firms are not immune: Latham & Watkins had to explain a citation with an AI-invented title and author in an expert filing in 2025, and Sullivan & Cromwell had AI-generated inaccuracies in a bankruptcy filing in April 2026. Status: secondary sources only (trade press) ([Realtid, 9 July 2025](https://www.realtid.se/juridik/advokaternas-ai-logner-ledde-till-boter-avskracka-och-straffa/); [Realtid, 24 July 2025](https://www.realtid.se/juridik/domstolarna-har-fatt-nog-av-advokaternas-ai-slarv/); [Realtid, 4 May 2026](https://www.realtid.se/juridik/ai-hallucineringar-skakar-juridiken-nu-kravs-chefsansvar/)).

**[FAST-MOVING, 1 May 2026]** Supervisory responsibility for AI-assisted work is being placed on managers and not only on the drafter: a US federal magistrate judge (N.D. Cal., reported 1 May 2026) reprimanded and fined a supervising partner USD 1,001 and ordered training, holding that managers must take reasonable steps to ensure accurate court submissions, after the partner had not reviewed a filing bearing his name. The same article cites a Nordic study reporting that eight in ten lawyers feel they lack sufficient training to use AI effectively. Status: secondary source only (trade press) ([Realtid, 4 May 2026](https://www.realtid.se/juridik/ai-hallucineringar-skakar-juridiken-nu-kravs-chefsansvar/)).

### The Swedish Bar Association's guidance

**[FAST-MOVING, 12 June 2025]** The Swedish Bar Association's board adopted general advice on generative AI models in law practice on 13 June 2024, and that advice was replaced by the 14-page guidance "Vägledning om användning av generativ AI i advokatverksamhet", dated Stockholm, 12 June 2025. Status: both checked on the Bar Association's own pages ([Advokatsamfundet, June 2024](https://www.advokatsamfundet.se/Nyhetsarkiv/2024/juni/allmanna-rad-om-generativa-ai-modeller-i-advokatverksamhet/); [Advokatsamfundet guidance PDF](https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf)).

**[FAST-MOVING, 12 June 2025]** The Bar Association's 2025 guidance covers generative AI used as one internal tool among others when delivering legal services, both open tools accepted on consumer-style terms and tools contracted by the firm; it does not cover a firm offering AI tools for clients to use themselves. Use must comply with the law and the code of conduct, the lawyer must make an overall assessment of each tool, and GDPR applies as for any other tool, including the need for compliant supplier contracts. Status: checked on the guidance text; sections 5 onward were not read in full ([Advokatsamfundet guidance PDF](https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf)).

**[FAST-MOVING, 12 June 2025]** On confidentiality, the Bar Association's 2025 guidance says client information may be used only in tools that ensure it is not disclosed in breach of the duty; the lawyer must review the tool's confidentiality terms and avoid tools that may reuse input in ways that risk disclosure; and where a general system is also available to other users, it is as a rule inappropriate for the tool to use the firm's input and output for further development. Its checklist asks whether staff receive adequate training and whether the firm has routines to verify that AI output is correct and consistent with the law. The guidance does not analyse the AI Act, and a working group reviews it regularly. Status: checked on the guidance text ([Advokatsamfundet guidance PDF](https://www.advokatsamfundet.se/globalassets/advokatsamfundet_sv/advokatyrket/vagledning-om-anvandning-av-generativ-ai-i-advokatverksamhet.pdf)).

**[INFERENCE]** The Bar Association guidance binds advocates, not in-house lawyers, but it is the natural Swedish reference standard for an in-house AI policy: tool-by-tool assessment, no client or confidential information in tools that train on inputs, contract terms checked, staff trained, and outputs verified by a lawyer.

### The CCBE guide and other bar guidance

**[DURABLE]** The CCBE Guide on the use of generative AI by lawyers, dated 2 October 2025, sets out safeguards before entering client data (contractual confidentiality, zero retention, a DPA limiting use, local or secured deployment); checking whether inputs train the model; preferring EU or EEA processing; awareness that a breach can occur at input and that AI is embedded in everyday tools; verifying output before use where the task requires it and never submitting unverified AI content to courts or third parties; understanding tool limits and training; transparency where an informed client would reasonably object or set conditions; guarding independence against bias, sycophancy and automation complacency; and considering cross-client conflicts and provider dependence. Status: read on the Norwegian Bar's copy of the CCBE document, not on the CCBE's own site ([CCBE guide, copy at Advokatforeningen](https://www.advokatforeningen.no/contentassets/185dd73ac1e14031ac016b1567e4b7a6/ccbe-guide-on-the-use-of-the-use-of-generative-ai-for-lawyers.pdf)).

**[GAP]** ABA Formal Opinion 512 of 29 July 2024 and the SRA's materials are unverified background, not re-opened: the ABA opinion is recalled as engaging competence, confidentiality (informed client consent before inputting client information into self-learning tools), communication, candour to tribunals, supervision and reasonable fees; the SRA is recalled as holding firms accountable for AI outputs and as having authorised an AI-driven law firm in May 2025 subject to conditions. Any newer guidance from 2026 is unknown ([ABA Formal Opinion 512](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf); [SRA](https://www.sra.org.uk/sra/research-publications/artificial-intelligence-legal-market/)).

### Confidentiality and privilege: assume in-house work is disclosable

**[VENDOR] [FAST-MOVING, 2026]** A law-firm guide reports that there is no Swedish statutory provision or case law yet on generative AI and privilege under rättegångsbalken 36 kap. 5 §, that the closest precedent extends the seizure ban in 27 kap. 2 § to electronically stored information, and that advocates' confidentiality duties under the code of conduct continue to apply to AI use. Status: secondary source only ([Baker McKenzie, Sweden privilege guide](https://resourcehub.bakermckenzie.com/en/resources/global-attorney-client-privilege-guide/europe-middle-east--africa/sweden/topics/07---artificial-intelligence)).

**[GAP]** The core privilege rules are unverified background, not fetched, and matter enough that a human lawyer should confirm them: in Sweden, testimonial privilege and the seizure ban are recalled as attaching to advocates and their assistants; members of the Bar may not be employed outside law firms, so company lawyers are not advocates and their advice is not privileged; and at EU level, privilege in Commission competition investigations is recalled as covering only communications with independent EU-qualified external lawyers (AM&S; Akzo Nobel, C-550/07 P) ([Rättegångsbalken](https://rkrattsbaser.gov.se/sfst?bet=1942:740); [CJEU C-550/07 P](https://curia.europa.eu/juris/liste.jsf?num=C-550/07)).

**[INFERENCE]** Uncontrolled input of company information into external AI tools can undermine trade-secret protection, because the Trade Secrets Act protects only information the holder has taken reasonable measures to keep secret (section 4). The definition is checked on primary source; the application to AI tools is the researchers' inference ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

### Limits on giving legal advice to others

**[GAP]** Rules on who may give legal advice are unverified background: Sweden is recalled as having no general lawyer monopoly, with regulation biting through the protected advokat title, court control of counsel, liability for negligent advice and consumer law, while many other jurisdictions restrict legal advice to licensed persons, so advice directed at third parties abroad can be unlawful there. GDPR Article 22's restriction on solely automated decisions with legal or similarly significant effects is also unverified background here, and would be engaged by an agent autonomously rejecting a data-subject request or deciding an employment matter ([Rättegångsbalken](https://rkrattsbaser.gov.se/sfst?bet=1942:740); [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### The four converging duties

**[INFERENCE]** The professional guidance read in this research (the CCBE guide and the Swedish Bar guidance, with the ABA opinion recalled) converges on four duties for any lawyer or legal team using AI: protect confidentiality at input, verify output, stay competent and independent, and be transparent. Section 18 turns those duties into operating rules for the department's agents.

### Gaps in the research on AI in legal work

**[GAP]** Not retrieved: any other 2025–2026 benchmark of legal AI tools, or the peer-reviewed version of the Stanford study; any decision of the Bar's disciplinary board on AI use; any Swedish court practice direction on AI use by parties or counsel; US privilege rulings on AI-generated material, recalled but unverified; and any source that prescribes numeric sign-off thresholds, so the thresholds in section 18 are design proposals.
