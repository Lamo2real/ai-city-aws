---
id: legal.orientation.orientation-and-regime-map
department: legal
domain: orientation
title: 'Legal: Orientation: what the department does and which regimes apply'
summary: The Legal department's job, why Swedish contracting leaves so much to drafting, the regime applicability map for
  a Sweden-based SaaS and AI company (GDPR, AI Act, Data Act, NIS2/Cybersäkerhetslagen, DSA, consumer law, employment, sanctions)
  and the eight dates that need action before February 2027. Orientation as of 11 November 2026, not legal advice.
type: policy
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
- eu
objectives:
- compliance
sources:
- https://lagen.nu/1915:218
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://rkrattsbaser.gov.se/sfst?bet=2022:482
- https://eur-lex.europa.eu/eli/reg/2026/1744/oj
- https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf
- https://pts.se/internet-och-telefoni/dataforordningen/
- https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act
- https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/
- https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- https://lagen.nu/2005:59
- https://rkrattsbaser.gov.se/sfst?bet=1994:1512
- https://rkrattsbaser.gov.se/sfst?bet=2008:486
- https://data.riksdagen.se/dokument/HE0312.html
- https://rkrattsbaser.gov.se/sfst?bet=2025:327
- https://eur-lex.europa.eu/eli/reg/2021/821/oj
- https://rkrattsbaser.gov.se/sfst?bet=2017:630
- https://rkrattsbaser.gov.se/sfst?bet=1962:700
- https://rkrattsbaser.gov.se/sfst?bet=2008:579
- https://rkrattsbaser.gov.se/sfst?bet=2021:890
- https://eur-lex.europa.eu/eli/reg/2022/2554/oj
related:
- legal.pending-changes.pending-changes-and-dated-milestones
seed_version: 1
cross_refs:
  '20':
  - legal.pending-changes.pending-changes-and-dated-milestones
---

**When to use this:** At intake: which legal regimes apply to a Sweden-based SaaS and AI company and which dates need action before February 2027.

**Source section:** 1. Orientation: what the department does and which regimes apply

### The department's job in one paragraph

**[INFERENCE]** The Legal department's AI agents, one manager agent directing worker agents, exist to do four things well: draft and review routine documents from approved templates and playbooks; spot issues and route them; keep a current map of which legal regimes apply to the company, its products and each transaction; and recognise the point at which a human lawyer must decide. The research supports a simple ordering of authority for every task. Mandatory law comes first, then the company's approved playbook positions, then market-standard benchmarks, and only then drafting preference. When an agent cannot verify a legal point on a primary source it says so and escalates instead of filling the hole from memory, which is the same rule this document applies to itself.

### Why Swedish contracting leaves so much to drafting

**[DURABLE]** Swedish business-to-business contracting is largely freedom of contract policed by one general clause, section 36 of the Contracts Act (Avtalslagen), which lets a court adjust or disregard an unreasonable term; drafting quality and the choice of standard form therefore matter more than statute for a SaaS supplier. Status: section 36 was checked on lagen.nu, not the official publication ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)). The practical consequence for agents is that most commercial review work is comparison against a playbook, while the mandatory-law overlay comes from EU regulation (Data Act, GDPR, AI Act, DSA) and from consumer, employment and competition law.

### Regime applicability map for a Sweden-based SaaS and AI company

**[INFERENCE]** The table below is the researchers' synthesis of when each regime bites, built from the sourced findings in the later sections; use it as the first screen at intake and then open the detailed section. The "status" column gives the verification level of the trigger itself, and every row should be read with the detailed paragraphs it points to.

| Regime | Trigger for this company | Legal status on 11 Nov 2026 | Swedish authority | Verification of the trigger | Source |
|---|---|---|---|---|---|
| GDPR | Any processing of personal data, as controller or as processor for customers | In force | IMY | Checked on primary source (core articles) | [Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Cookie rule (LEK 2022:482) | Storing or reading information on a user's device | In force | PTS for the cookie rule, IMY for the processing that follows | Unverified background, not fetched | [SFS 2022:482](https://rkrattsbaser.gov.se/sfst?bet=2022:482) |
| AI Act, Article 50 transparency | Chatbots, generative output, deepfakes | Applicable since 2 Aug 2026; legacy marking by 2 Dec 2026 | PTS (Art. 50(1), (2), (4)); IMY (Art. 50(3)) | Dates checked on primary source; article content unverified background | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| AI Act, high-risk duties | Annex III use cases (for example employment, education, credit) or Annex I products | Adopted, applicable 2 Dec 2027 (Annex III) and 2 Aug 2028 (Annex I) | PTS, IMY, Finansinspektionen, Läkemedelsverket by area, under an assignment ending 31 Dec 2026 | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj); [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| Data Act cloud switching | Offering a data processing service (IaaS, PaaS, SaaS) to EU customers | In force since 12 Sep 2025; switching charges banned from 12 Jan 2027 | PTS, with limited powers pending Swedish supplementary law | Application date checked on PTS page; switching detail secondary source only | [PTS: Dataförordningen](https://pts.se/internet-och-telefoni/dataforordningen/); [DLA Piper, July 2025](https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act) |
| Digital Services Act, hosting tier | Storing content provided by users | In force | PTS as Digital Services Coordinator (unverified background) | Articles 6, 11, 12, 14, 16, 17, 19 checked on primary source | [Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) |
| Cybersäkerhetslagen (NIS2) | Cloud, SaaS or managed-service provider with at least 50 employees, or turnover and balance sheet each above EUR 10 million | In force since 15 Jan 2026 | MCF receives reports; sector supervisors | Thresholds checked on Swedish authority pages; sector scope unverified background | [Transportstyrelsen](https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/) |
| Cyber Resilience Act | Downloadable software, agents, SDKs, apps placed on the market | Reporting from 11 Sep 2026, full application 11 Dec 2027 | Not verified | Unverified background, not fetched | [Regulation (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) |
| Consumer distance-contract and unfair-terms law | Any sale to consumers online | In force; amendment SFS 2026:1018 from 20 Nov 2026 | Konsumentverket | Checked on lagen.nu and on primary source (1994:1512) | [Lag (2005:59), lagen.nu](https://lagen.nu/2005:59); [SFS 1994:1512](https://rkrattsbaser.gov.se/sfst?bet=1994:1512) |
| Marknadsföringslagen | Any marketing | In force | Konsumentverket / Consumer Ombudsman; Patent- och marknadsdomstolen | Checked on primary source | [SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486) |
| Product liability for software | Software placed on the market that injures persons, damages property or corrupts data | Proposed: new act from 1 Jan 2027, not adopted | Courts | Checked on primary source (bill and Riksdag status) | [Prop. 2026/27:12](https://data.riksdagen.se/dokument/HE0312.html) |
| Sanctions | Every customer, reseller and payment counterparty | In force; lagen (2025:327) since 10 Jun 2025 | ISP and others (unverified background) | Swedish act checked on primary source; EU regulations unverified background | [Lag (2025:327)](https://rkrattsbaser.gov.se/sfst?bet=2025:327) |
| Export control | Encryption, AI models or technology made available outside the EU | In force | ISP | Unverified background, not fetched | [Regulation (EU) 2021/821](https://eur-lex.europa.eu/eli/reg/2021/821/oj) |
| AML Act | Only if the company performs a listed activity (payments, e-money, crypto, bookkeeping services and others) | In force; new scope wording from 20 Nov 2026 | Finansinspektionen and others | Scope list checked on primary source | [Lag (2017:630)](https://rkrattsbaser.gov.se/sfst?bet=2017:630) |
| Bribery offences | Any benefit given or received in connection with work | In force; amended by SFS 2026:1318 from 1 Aug 2026 | Prosecutors | Checked on primary source | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |
| Competition law | Any agreement with competitors, resellers or distributors | In force | Konkurrensverket | Checked on primary source | [Konkurrenslag (2008:579)](https://rkrattsbaser.gov.se/sfst?bet=2008:579) |
| Whistleblowing channels | 50 or more workers at the start of the calendar year | In force | Arbetsmiljöverket | Checked on primary source | [Lag (2021:890)](https://rkrattsbaser.gov.se/sfst?bet=2021:890) |
| DORA contract terms | Selling to financial entities | In force since 17 Jan 2025 | Finansinspektionen | Unverified background, not fetched | [Regulation (EU) 2022/2554](https://eur-lex.europa.eu/eli/reg/2022/2554/oj) |

### The eight dates that need action before February 2027

**[FAST-MOVING, 11 Nov 2026]** Eight near-term dates should already be in the department's calendar: 20 November 2026 (amendments to the distance-contract act by SFS 2026:1018 and a new wording of the AML Act's scope section by SFS 2026:1023); 25 November 2026 (planned Riksdag decision on the new Produktansvarslag); 2 December 2026 (AI Act marking deadline for generative systems placed on the market before 2 August 2026, start of the two new AI Act prohibitions, and the 90% salary floor reaching work-permit extensions); 5 December 2026 (SFS 2026:783 amending Aktiebolagslagen for public-company matters); 31 December 2026 (end of the Swedish AI-authority assignment); 1 January 2027 (proposed start of the new Produktansvarslag); 12 January 2027 (Data Act ban on switching charges); and 2 February 2027 (watermark-detection interoperability for signatories of the AI transparency code). Each date is sourced and given its verification status in section 20.
