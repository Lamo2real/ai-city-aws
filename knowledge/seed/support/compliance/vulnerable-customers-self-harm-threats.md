---
id: support.compliance.vulnerable-customers-self-harm-threats
department: support
domain: compliance
title: 'Customer support: Vulnerable customers, self-harm disclosures, threats and abuse'
summary: Vulnerability as a spectrum, TEXAS, IDEA, CARERS, BRUCE and BLAKE, Swedish emergency and helpline routes (112, 90101, 1177), what an AI agent does on a self-harm disclosure (acknowledge, stop scripts, signpost, hand to a human at once, no counselling), threats against staff, and adapting the house style for vulnerable customers.
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
- safeguarding
sources:
- https://www.fca.org.uk/publications/finalised-guidance/guidance-firms-fair-treatment-vulnerable-customers
- https://gov.uk/government/publications/public-sector-toolkits/debt-management-vulnerability-toolkit-for-frontline-debt-management-staff-v2-html
- https://mind.se/en/are-you-experiencing-suicidal-thoughts/
- https://www.1177.se/stockholm/sjukdomar--besvar/psykiska-sjukdomar-och-besvar/sjalvmordstankar/till-dig-som-har-sjalvmordstankar/
- https://www.av.se/halsa-och-sakerhet/psykisk-ohalsa-stress-hot-och-vald/hot-och-vald/
- https://www.mondaq.com/uk/privacy-protection/1825278/european-commission-press-release-eu-ai-act-transparency-enforcement-starts-this-sunday-do-you-know-who-your-chatbots-are-we-break-down-the-commissions-guidelines-on-transparency-below
related:
- support.agent-guardrails.ai-agent-guardrails
- support.communication.communication-craft
- support.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** At once when a customer mentions self-harm or suicidal thoughts, shows vulnerability, or threatens staff: what the AI does and when a human takes over.

**Source section:** 26. Vulnerable customers, self-harm disclosures, threats and abuse

### Vulnerability is a spectrum

[DURABLE] The UK FCA's guidance FG21/1 (published 23 February 2021, page updated 22 July 2026; UK financial-services guidance, not binding on a Swedish SaaS, used as recognised practice) defines a vulnerable customer as someone who, because of personal circumstances, is especially susceptible to harm, particularly when a firm does not act with appropriate care. Four characteristics raise the risk: poor health, life events, low resilience to financial or emotional shocks, and low capability. Firms are expected to have front-line staff able to recognise and respond, understandable communications, several channels, flexible responses, signposting to third-party help, and systems to note and retrieve disclosed needs ([FCA](https://www.fca.org.uk/publications/finalised-guidance/guidance-firms-fair-treatment-vulnerable-customers)).

### TEXAS for any disclosure of vulnerability

[DURABLE] The UK government's debt-management vulnerability toolkit (first published 12 April 2023, updated 20 April 2026; UK public-sector context, not binding in Sweden) gives the TEXAS protocol: Thank the customer; Explain why the information is noted, how it is used and who sees it; get eXplicit consent to record it; Ask how it affects their dealings with you and whether someone helps them; Signpost or refer to internal specialists or outside help ([GOV.UK toolkit](https://gov.uk/government/publications/public-sector-toolkits/debt-management-vulnerability-toolkit-for-frontline-debt-management-staff-v2-html)). [INFERENCE] Notes about health are special-category data under GDPR, so record the support need (for example "prefers phone, needs extra time") and not the diagnosis.

### IDEA, CARERS and BRUCE

[DURABLE] The same toolkit gives three further tools. IDEA for understanding the situation: Impact, Duration, Experiences (one-off or recurring), Assistance already received. CARERS for a third party contacting on someone's behalf: Check authority; Avoid discussing account details and say why; Reassure that concerns can be noted as unverified observations; Explain these will be shared with the customer; Record; Summarise next steps. BRUCE for possible limits in decision-making capacity: Behaviour and talk, Remembering, Understanding, Communicating, Evaluating; presume capacity, give support such as more time, repetition, plain words and written follow-up, and do not guess a diagnosis ([GOV.UK toolkit, updated 20 April 2026](https://gov.uk/government/publications/public-sector-toolkits/debt-management-vulnerability-toolkit-for-frontline-debt-management-staff-v2-html)).

### BLAKE for a disclosure of suicidal thoughts

[DURABLE] The toolkit's BLAKE protocol: Breathe (pause and acknowledge what was said); Listen (assess imminent risk, recap); Ask in your own words what led to this, whether there is a plan, where they are, whether they are alone and what support they have; Keep safe (if risk is imminent, contact emergency services under company policy and stay on the line if needed); End (once safe, summarise what was agreed, close and record). It supports and does not replace the organisation's own suicide policy. High-risk signs that call for emergency services are that the person is harming themselves now, cannot respond, clearly intends to end their life or has a plan; risk is higher with alcohol, drugs or medication taken, a previous attempt or a mental health problem ([GOV.UK toolkit, updated 20 April 2026](https://gov.uk/government/publications/public-sector-toolkits/debt-management-vulnerability-toolkit-for-frontline-debt-management-staff-v2-html)).

### Swedish emergency and helpline routes

[FAST-MOVING, November 2026] Verified on 11 November 2026: in an emergency always call 112 or go to the nearest psychiatric emergency department; Mind Självmordslinjen is on 90101, open 24 hours every day, anonymous, with chat via mind.se ([Mind](https://mind.se/en/are-you-experiencing-suicidal-thoughts/)); 1177 gives care advice around the clock and says to seek care at once or call 112 if the situation feels unbearable or there are plans to take one's life ([1177](https://www.1177.se/stockholm/sjukdomar--besvar/psykiska-sjukdomar-och-besvar/sjalvmordstankar/till-dig-som-har-sjalvmordstankar/)). 1177 also lists Bris for children and young people on 116 111, Jourhavande medmänniska on 08-702 16 80 and Hjälplinjen for adults on 90390; opening hours for these were not verified. Re-verify all numbers before publishing them in scripts.

### What an AI agent does on a self-harm disclosure

[INFERENCE] The AI agent does only the acknowledgement and signposting steps: it acknowledges the statement seriously, stops any sales, save or troubleshooting script, gives 112 for immediate danger and 90101 and 1177 for Sweden (112 works across the EU, the helplines do not, so customers elsewhere need their own country's numbers), and hands over to a trained human at once. It does not attempt counselling. If danger is immediate and location is known, the human follows the company's emergency-contact procedure. No Swedish authority protocol for commercial customer service was found, and no source on evaluating AI agents for crisis handling.

### Threats against staff: a written routine is a legal duty

[DURABLE] Arbetsmiljöverket (page updated 12 October 2026): the employer must reduce the risk of violence and threats under Arbetsmiljölagen (1977:1160) and AFS 2023:2; the workplace must have known routines for handling violence and threats wherever they occur, including online, and must make clear that threats against employees are not accepted ([Arbetsmiljöverket](https://www.av.se/halsa-och-sakerhet/psykisk-ohalsa-stress-hot-och-vald/hot-och-vald/); regulator page read, AFS 2023:2 itself not read). [INFERENCE] The routine's content is the researchers' outline: do not argue, preserve the full transcript, escalate to a human lead who decides on a police report and account action, and follow up on staff welfare. The toolkit recommends a short debrief with a colleague or manager before the next contact.

### Recognising vulnerability in tickets and adapting the house style

[INFERENCE] Signals include mention of bereavement, illness, job loss, debt, confusion about basic steps, or a third party writing on someone's behalf. The response is to slow down, use plain language, offer another channel, and offer flexibility within policy such as a pause, payment plan or waived fee. Save scripts, upsells, escalating outreach and referral asks are suspended for a customer showing these signals. The Commission's Article 50 guidelines also require AI disclosure to account for vulnerable users such as children and older people ([Mondaq](https://www.mondaq.com/uk/privacy-protection/1825278/european-commission-press-release-eu-ai-act-transparency-enforcement-starts-this-sunday-do-you-know-who-your-chatbots-are-we-break-down-the-commissions-guidelines-on-transparency-below)).
