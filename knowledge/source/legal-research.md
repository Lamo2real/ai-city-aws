# Legal agents must verify before advising

As of 11 November 2026, the foundation an AI Legal department needs is less a library of answers than a discipline: every legal point carries a verification status, a legal status (in force, adopted but not yet applicable, or proposed) and a date, and a human lawyer decides wherever the law is unsettled, criminal exposure exists, or something leaves the building under the company's name. For a Sweden-based SaaS and AI company the core substantive stack is now largely checked on primary text: the Aktiebolagslag board, meeting, share-issue and capital-deficiency rules; the GDPR articles behind notices, processor contracts, breach clocks and fines; the AI Act as amended by Regulation (EU) 2026/1744 (high-risk duties moved to 2 December 2027 and 2 August 2028, with two new prohibitions and the legacy marking deadline both landing on 2 December 2026); the 2025 Swedish sanctions act; the bribery offences; and the Swedish limitation, marketing, trademark and employee-invention statutes. Commercial contracting rests on freedom of contract policed by section 36 of the Contracts Act, with TechSverige's Molntjänster 2023 terms (15% of annual fee cap, general courts, 90-day notice) and Common Paper's cloud agreement (12 months' fees cap) as the two benchmark anchors, and the EU Data Act's switching rules overriding lock-in terms, with switching charges banned from 12 January 2027. Three corrections matter immediately: the "Leo rules" nine-tenths majority does not bind an ordinary private company; the new Swedish Produktansvarslag is proposed for 1 January 2027 and was not yet adopted (Riksdag decision planned for 25 November 2026); and Sweden replaced its 1996 sanctions act with lagen (2025:327), which punishes grossly negligent breaches. The Swedish AI supervisory set-up (PTS, IMY, Finansinspektionen, Läkemedelsverket, Swedac) rests on a government assignment that expires on 31 December 2026 with no successor found, and no Swedish penalty mechanism for the AI Act was located. The evidence on AI doing legal work argues for hard gates: benchmarked legal research tools hallucinated on more than 17% to more than 34% of queries in 2024, a database counted 2,289 court decisions involving AI-fabricated material on 10 November 2026, a newer benchmark still shows roughly a one-in-five miss rate, and in-house legal work in Sweden carries no privilege, so logs and prompts must be treated as disclosable. Large areas remain unverified and are listed as gaps instead of being filled from memory: export control, shareholder agreements and fundraising documents, employer of record, PTS cookie practice, Dataskyddslagen, most consumer subscription rules and nearly all digital-regulation detail outside the Cybersäkerhetslagen. This document is orientation for agents and their supervisors, not professional legal advice.

## How to read and split this document

**[DURABLE]** This document is written to be cut into atomic knowledge-base entries. Every paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and source link. Section numbers group domains, and sub-headings name the single topic of the paragraphs beneath them. Tables repeat their source link and verification status in every row so that a row can be split out as its own entry. When splitting, keep the label, the verification status, the date and the link together with the claim.

**[DURABLE]** The labels mean the following. **[DURABLE]** marks a principle, definition or long-standing legal rule that has held for years and is unlikely to age quickly. **[FAST-MOVING, date]** marks a figure, fee, deadline, enforcement decision or legal status that will age, with the date of the source or of the reading. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion, which here includes law-firm client alerts used as secondary sources for market practice, contract-standard publishers and legal-tech benchmark reporting. **[PLATFORM CLAIM]** marks a platform's or tool maker's own statement about itself or its terms that nobody has independently verified, for example the model vendors' published commercial terms. **[CONTESTED]** marks a point where sources disagree or where the legal position is openly unsettled. **[INFERENCE]** marks a synthesis, checklist or design rule written by the researchers that no single fetched source states; adopt it as a default and have a human lawyer confirm it before it gates a live decision. **[GAP]** marks something the research did not verify or could not find. **[HOUSE STYLE]** is reserved for Alex or Leila Hormozi's published frameworks; no paragraph in this Legal document relies on them, so the label does not appear below.

**[DURABLE]** Every legal, tax and regulatory point also carries one of four verification statuses in plain words. "Checked on primary source" means the statute, EU act, authority page, court host or standard text itself was read during the research in November 2026; Swedish statutes were read in Regeringskansliets rättsdatabas or on riksdagen.se, and EU acts were read in the Publications Office copy of the Official Journal text because EUR-Lex would not serve pages to the research tooling, with the EUR-Lex ELI link given as the citable address. "Checked on lagen.nu" means the text was read on a faithful consolidated reproduction that is not the official publication and should be re-checked on the official database before reliance. "Secondary source only" means a law-firm briefing, trade body or press report was read and the primary text was not. "Unverified background, not fetched" means the point comes from the researchers' background knowledge with a link to where it should be confirmed; agents must not gate a live decision on such a point without confirmation. "Headline only" marks items seen as a feed headline or summary without the body being opened.

**[DURABLE]** Seven caveats apply to the whole document. First, it is orientation as of 11 November 2026 and not professional legal, tax or regulatory advice; a qualified human lawyer decides on anything that matters. Second, statute consolidation levels seen during the research were Aktiebolagslagen up to SFS 2026:783, Brottsbalken up to SFS 2026:1656, Penningtvättslagen up to SFS 2026:1075, Konkurrenslagen up to SFS 2026:580 and Marknadsföringslagen up to SFS 2022:656; later amendments are not reflected. Third, where the later gap-fill research corrected or superseded the first research round, only the corrected claim appears here. Fourth, case law was almost never retrieved, so the document states statutory rules and a handful of named judgments, not how courts apply them. Fifth, regulator decisions were mostly read as press items and not as the decisions themselves. Sixth, market-standard contract positions come from two published standards and a few vendor terms; no Swedish market-median data on caps or service credits was found. Seventh, benchmarks on legal operations and on legal-AI accuracy are US-weighted and describe large enterprises or US law.

**[INFERENCE]** Three status tags should travel with every legal point an agent stores or outputs, in addition to the labels above: "in force" (binding today), "adopted, not yet applicable" (binding from a stated future date) and "proposed" (not law). The Digital Omnibus on data, the Digital Fairness Act, the Swedish Produktansvarslag bill and the Swedish pay-transparency rules are all "proposed" or unsettled on 11 November 2026, and the single most damaging error class for a legal agent is applying a proposal as law or missing that a deferred duty has started to apply.

## 1. Orientation: what the department does and which regimes apply

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

## 2. SaaS and commercial contracts and market-standard positions

### Contract structure: order form plus incorporated standard terms

**[VENDOR] [FAST-MOVING, Nov 2026]** Use a two-part structure for supplier-side SaaS paper: a short cover page or order form that carries the commercial variables, and standard terms incorporated by reference that are never edited deal by deal. Common Paper's Cloud Service Agreement, at version 3.0 when read in November 2026, is a neutral benchmark for this structure: the Cover Page holds the Order Form (fees, subscription period, service levels) and Key Terms (caps, indemnity scope, governing law), and all changes are made on the Cover Page and never in the Standard Terms. Status: checked on the publisher's own page; the publisher is a standards vendor and the standard was drafted with US law in mind ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/)).

### Benchmark positions in the Common Paper Cloud Service Agreement v3.0

**[VENDOR] [FAST-MOVING, Nov 2026]** Common Paper CSA v3.0 default positions, as read in November 2026, are a general liability cap of one times the fees paid or payable in the prior 12 months; an optional "increased claims" super-cap for privacy, security and confidentiality breaches; no uncapped claims selected by default; a waiver of indirect and consequential damages; and a rule that the cap never limits gross negligence, wilful misconduct or fraud. Status: checked on the publisher's own page ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/)).

**[VENDOR] [FAST-MOVING, Nov 2026]** On indemnities, Common Paper CSA v3.0 has the provider indemnify third-party intellectual-property claims against the service and the customer indemnify for customer content and breach of use restrictions, with standard exclusions for modifications, misuse, combinations and old versions, and with the indemnity as the exclusive remedy for covered claims. Status: checked on the publisher's own page ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/)).

**[VENDOR] [FAST-MOVING, Nov 2026]** On term and exit, Common Paper CSA v3.0 defaults to auto-renewal with a non-renewal notice date set on the order form (the publisher notes 30 days as most common), termination for uncured material breach after 30 days' notice, no termination for convenience, deletion of customer content within 60 days on request, provider use of usage data only in aggregated and non-identifying form, and a warranty of no material reduction of functionality with a 45-day notice, 45-day cure and pro-rata refund remedy. Status: checked on the publisher's own page ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/)).

**[VENDOR] [FAST-MOVING, Nov 2026]** Two adaptation points apply when a Swedish company borrows the Common Paper standard. Version 3 removed the default machine-learning clause, so the neutral standard no longer gives the provider machine-learning rights by default. And the publisher reports that 71% of its benchmarked cloud agreements choose Delaware law, so governing law and venue must be re-set for Swedish use. Status: checked on the publisher's own page, November 2026 ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/)).

### What gets negotiated versus what causes disputes

**[VENDOR] [FAST-MOVING, 2024]** WorldCC's "Most Negotiated Terms 2024" ranks the ten most negotiated terms as limitation of liability, price and price changes, indemnification, termination, payment, scope and specification, warranty, intellectual property, delivery and liquidated damages; service levels rank 12, cybersecurity and data privacy 13, term 17 and dispute resolution 24. Status: checked on the publisher's own report; WorldCC is a membership body ([WorldCC Most Negotiated Terms 2024](https://www.worldcc.com/static/b79aea6b-1803-405f-8e132261a2c8edcb/Most-Negotiated-Terms-2024.pdf)).

**[VENDOR] [FAST-MOVING, 2024]** The same WorldCC 2024 report finds that the most disputed terms are led by price, charges and changes, then scope and specification, then delivery; its point is that negotiation effort on liability and indemnity is misaligned with what actually causes disputes. For agents this means review time on a routine deal is better spent making price-change mechanics, scope and delivery obligations unambiguous than on a third round of cap wording. Status: checked on the publisher's own report ([WorldCC Most Negotiated Terms 2024](https://www.worldcc.com/static/b79aea6b-1803-405f-8e132261a2c8edcb/Most-Negotiated-Terms-2024.pdf)).

**[GAP]** A "Most Negotiated Terms 2026" edition exists with 1,344 respondents and coverage of negotiation priorities, contract performance and AI, but it is members-only and was not read; no 2026 ranking can be stated ([WorldCC report library](https://www.worldcc.com/Portals/IACCM/Reports/Most-Negotiated-Terms-2024.pdf)).

### The Swedish standard: TechSverige's agreement family

**[FAST-MOVING, Nov 2026]** TechSverige (formerly IT&Telekomföretagen) publishes the dominant Swedish IT standard agreements. Its catalogue covers Molntjänster (cloud including SaaS, which replaced "Cloud Computing"), IT-Tjänster (time-based consulting), IT-Projekt (fixed delivery with acceptance test), Agila Projekt (with an optional risk and profit-sharing annex), IT-Infrastrukturtjänster (which replaced IT-Drift), IT-Underhåll, Avtal 90 (system deliveries of integrated standard products plus services), Allmänna leveransvillkor 91 (hardware), Internetprojekt, a Sekretessavtal (NDA), service-level annexes and GDPR processor terms in three variants with specification annexes. Status: checked on TechSverige's own page ([TechSverige: standard agreements](https://techsverige.se/om-oss-2/var-verksamhet/standardavtal/kort-beskrivning-av-alla-vara-standardavtal/)).

**[FAST-MOVING, Nov 2026]** The Molntjänster family (general terms, service-level annex, processor terms and processing specification) is available in Swedish and English by subscription at SEK 6,500 per year for members and SEK 13,000 per year for non-members, as shown on TechSverige's shop page in November 2026. The texts are copyrighted and must be licensed, not copied, so agents must never paste TechSverige wording into company templates without a licence. Status: checked on TechSverige's own page ([TechSverige Molntjänster shop page](https://techsverige.se/product-category/molntjanster/)).

### Molntjänster 2023: liability, claim window and service credits

**[FAST-MOVING, 2023 text]** Molntjänster Allmänna bestämmelser 2023 is meant for a standardised and lasting internet-based service. Clause 18.2 caps supplier liability at 15% of the annual fee per calendar year, excludes lost profit and other indirect loss, and lifts the cap for intent, gross negligence, personal injury and the intellectual-property and third-party indemnities in clauses 11 and 12.2. Clause 18.3 requires damages claims within six months of the damage. Status: read on copies of the standard hosted by licensees, not on a currently licensed copy; one copy carried a licence expiry of 12 April 2025, so check a current licensed copy before quoting ([Molntjänster 2023, copy hosted by a supplier](https://nssonab.se/wp-content/uploads/2025/01/Molntjanster-Allmanna-bestammelser-2023.pdf)).

**[FAST-MOVING, 2023 text]** The Molntjänster service-level annex limits the price reduction for missed availability to a maximum of 10% of the monthly service fee. Status: read on a copy hosted by a licensee ([Molntjänster SLA annex, copy](http://hostingservicegroup.se/wp-content/uploads/2023/04/Underbilaga-33_Molntjanster-Villkor-Servicenivaer-SLA-bilaga.pdf)).

### Molntjänster 2023: commercial defaults and clause map

**[FAST-MOVING, 2023 text]** The commercial defaults read in Molntjänster 2023 are payment 30 days from invoice date; where no term is agreed, an agreement running until further notice with 90 days' mutual notice; termination of a fixed term at least 90 days before the period ends; several supplier-initiated changes (service changes, third-party licence fee changes) taking effect three months after notice; fee indexation by Statistics Sweden's Labour Cost Index for salaried employees, SNI 2007 code J; and return of customer data tied to a 60-day period after termination. Status: read on a licensee-hosted copy from a two-column PDF extract, so clause numbers for these defaults are not given and should be confirmed on a licensed copy ([Molntjänster 2023, licensee copy](https://cms.momentum.se/wordpress/uploads/2024/04/molntjanster-allmanna-bestammelser-2023.pdf)).

**[FAST-MOVING, 2023 text]** The clause map of Molntjänster 2023 is: 2 supplier undertakings (2.3 subcontractors), 3 customer undertakings, 5 changes to the service, 10 fees and payment, 11 intellectual property, 14 personal data, 15 security, 16 confidentiality, 17 responsibility for the service, 18 liability and force majeure, 20 term, 21 early termination, 22 wind-down and data return, 24 assignment, and 25 governing law and disputes. Status: read on a licensee-hosted copy ([Molntjänster 2023, copy](https://nssonab.se/wp-content/uploads/2025/01/Molntjanster-Allmanna-bestammelser-2023.pdf)).

### Molntjänster 2023 sends disputes to the general courts

**[FAST-MOVING, 2023 text]** Clause 25.1 of Molntjänster 2023 applies Swedish law without its conflict-of-law rules, and clause 25.2 sends disputes arising from the agreement to the general courts; there is no arbitration clause. This resolves an open question from the first research round. Status: clause 25 read on a licensee-hosted copy of the standard ([Molntjänster 2023, licensee copy](https://cms.momentum.se/wordpress/uploads/2024/04/molntjanster-allmanna-bestammelser-2023.pdf)).

**[INFERENCE]** Because the TechSverige cloud terms default to the general courts, a supplier that wants confidentiality or arbitration must add an arbitration clause in the main agreement; the standard terms will not supply it. Court proceedings are public in principle, which is the usual reason to prefer arbitration for disputes that would expose pricing or security detail; that rationale is general knowledge and was not sourced in the research.

### Contract formation under the Swedish Contracts Act

**[DURABLE]** Under Avtalslagen section 1, offer and acceptance are each binding, and the formation rules in sections 2 to 9 are default rules displaced by the offer or reply, trade usage or custom. A late acceptance counts as a new offer (section 4) and an acceptance with additions or reservations counts as a rejection plus a new offer (section 6), but in both cases the recipient must object without unreasonable delay if the sender evidently believes a contract was formed, or a contract arises. Status: checked on lagen.nu, not the official publication ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)).

**[DURABLE]** Avtalslagen contains no general form requirement; form requirements exist only where another statute says so (section 1, third paragraph). Contracts can therefore be formed by e-mail, click or conduct, and agents must treat e-mail exchanges with counterparties as capable of binding the company. Status: checked on lagen.nu ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)).

**[DURABLE]** The invalidity grounds in Avtalslagen are duress (sections 28 and 29), fraud (section 30), exploitation or usury (section 31), mistake in expression (section 32) and the rule against relying on a contract contrary to good faith and honour (section 33). Status: checked on lagen.nu ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)).

### Section 36 and the limits of liability caps

**[DURABLE]** Section 36 of Avtalslagen allows a term to be adjusted or disregarded if it is unreasonable in view of the contract's content, the circumstances at formation, later events and other circumstances; the whole contract can be adjusted or set aside, and special regard goes to consumers and others in an inferior position. Status: checked on lagen.nu ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)).

**[DURABLE]** In NJA 2017 s. 113 the Swedish Supreme Court held that limitation-of-liability clauses are in principle tested under section 36 by an overall assessment, not by an automatic rule that gross negligence breaks the cap; gross negligence can still be reason enough to set a cap aside, and where the parties have agreed that the cap falls away for gross negligence or intent, that agreement applies. A monetary cap equal to roughly 163 times the fee was upheld. Status: judgment read on lagen.nu, not the official report ([NJA 2017 s. 113, lagen.nu](https://lagen.nu/dom/nja/2017s113)).

**[INFERENCE]** Always carve out intent and gross negligence expressly in a liability clause: the Supreme Court said an agreed carve-out applies as written, which gives predictability that the bare section 36 test does not. A very low cap relative to foreseeable loss is the position most exposed to section 36 adjustment, so the 15% TechSverige anchor should not be assumed safe in every deal.

### A negotiation ladder for supplier-side liability caps

**[INFERENCE]** A practical negotiation ladder for supplier-side SaaS paper, built from the two published benchmarks, opens with a cap of 12 months' fees (the Common Paper default) or, as the supplier-friendly Swedish anchor, 15% of the annual fee (TechSverige); the first fallback is a higher multiple for data and confidentiality breaches (a super-cap); the second fallback is uncapped liability only for the intellectual-property indemnity, intent and gross negligence. No data on Swedish market-median caps or service-credit levels was found, so the ladder is a design default and not a benchmark ([Common Paper CSA](https://commonpaper.com/standards/cloud-service-agreement/); [Molntjänster 2023, copy](https://nssonab.se/wp-content/uploads/2025/01/Molntjanster-Allmanna-bestammelser-2023.pdf)).

### "Indirect loss" and the Sale of Goods Act by analogy

**[DURABLE]** Köplagen (1990:931) applies to purchases of movable property (section 1) and does not apply where the supplier of goods must also perform work or another service and the service is the predominant part (section 2); it yields to the contract, to practice between the parties and to trade usage (section 3) and does not apply where the international sales act applies (section 5). It therefore reaches SaaS only by analogy. Status: checked on primary source ([SFS 1990:931](https://rkrattsbaser.gov.se/sfst?bet=1990:931)).

**[DURABLE]** Köplagen section 67 defines indirect loss as loss from reduced or lost production or turnover, other loss from being unable to use the goods as intended, lost profit from a third-party contract that fell through, and similar loss that was hard to foresee; damages otherwise cover expenses, price difference, lost profit and other direct or indirect loss. Under section 32 a buyer must give notice of a defect within a reasonable time and loses the right after two years from receipt unless a guarantee says otherwise. Status: checked on primary source ([SFS 1990:931](https://rkrattsbaser.gov.se/sfst?bet=1990:931)).

**[INFERENCE]** When a SaaS contract excludes "indirect loss" without defining it, the Köplagen section 67 definition is a useful reference point, and defining the term in the contract is safer than leaving it open. Using the Sale of Goods Act by analogy is a common Swedish drafting habit, but the researchers did not verify that habit with case law.

### Late payment between businesses

**[FAST-MOVING, Nov 2026]** Between businesses, statutory default interest is the Riksbank reference rate plus 8 percentage points, running from 30 days after invoice if nothing is agreed, and the right to default interest cannot be contracted away between traders. A flat late-payment compensation of SEK 450 can be charged to businesses and authorities and absorbs reminder and collection fees; otherwise the reminder fee is SEK 60 only if agreed, a collection demand SEK 180 and an instalment plan SEK 170. Status: checked on the government business portal in November 2026, not on the statutes ([verksamt.se](https://verksamt.se/avtal-fakturering/betalningspaminnelse-och-drojsmalsranta)).

### EU Data Act: switching terms that override the contract

**[FAST-MOVING, Nov 2026]** The EU Data Act has applied since 12 September 2025. PTS is the Swedish competent authority but, pending supplementary Swedish legislation, has only limited powers to act on complaints; an inquiry report on supplementary provisions (SOU 2025:118) was delivered in December 2025. Status: checked on PTS's own page and the inquiry report; the status of the Swedish supplementary legislation after the inquiry was not found ([PTS: Dataförordningen](https://pts.se/internet-och-telefoni/dataforordningen/); [SOU 2025:118](https://www.regeringen.se/contentassets/3fa2e0b39110403490045e3418eb8d2c/okad-och-rattvis-tillgang-till-data-sou-2025118.pdf)).

**[VENDOR] [FAST-MOVING, July 2025]** The Data Act's switching rules cover data processing services (IaaS, PaaS and SaaS) offered to EU customers, including by non-EU providers. The maximum notice period to start switching is two months (Articles 23(a) and 25); contracts must allow switching to another provider or to on-premises and porting of exportable data and digital assets; termination must be available regardless of the agreed minimum term; and the rules reach contracts concluded before 12 September 2025. Status: secondary source only (law-firm briefing); the regulation's articles were not read ([DLA Piper, July 2025](https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act)).

**[VENDOR] [FAST-MOVING, July 2025]** From 12 January 2027 providers can no longer impose switching charges, including egress fees (Data Act Article 29). Early-termination penalties are a separate concept and may be permissible if disclosed before contract, with validity depending on national contract law; prepaid fees for the terminated portion may be retained if disclosed and not labelled as switching fees. Status: secondary source only ([DLA Piper, July 2025](https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act)).

**[VENDOR] [FAST-MOVING, July 2025]** Two exemptions from the Data Act switching rules are reported: services whose main features are custom-built for one customer and not offered at broad commercial scale, and time-limited test or evaluation services. Status: secondary source only ([DLA Piper, July 2025](https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act)).

**[GAP]** Further Data Act switching detail held only as unverified background, not fetched: a 30-day transition period extendable where technically unfeasible up to seven months, a duty to list exportable data and guarantee erasure after switching, switching charges limited to cost since 11 January 2024, functional equivalence for IaaS, and unfair-terms rules in Article 13 that apply to contracts concluded after 12 September 2025 and from 12 September 2027 to certain older long-term contracts. Confirm on the regulation before relying on any of these ([Regulation (EU) 2023/2854](https://eur-lex.europa.eu/eli/reg/2023/2854/oj)).

**[INFERENCE] [CONTESTED]** Any SaaS template with fixed multi-year terms, more than two months' termination or exit notice, or exit or egress fees needs a Data Act review now and a hard check before 12 January 2027. "Early termination fee" wording must be kept distinct from "switching charge" and disclosed before contract. Whether a fee equal to the full remaining term survives scrutiny under section 36 of Avtalslagen is undecided, so a human lawyer decides that position.

### Governing law and arbitration: the SCC model clause

**[DURABLE]** The SCC Arbitration Institute publishes model clauses under which disputes are finally settled by arbitration under its Arbitration Rules; a parallel clause exists for the Rules for Expedited Arbitrations, together with a combined clause under which the SCC decides which rules apply, a mediation clause and submission agreements for existing disputes. The clause is completed with seat and language, and the Expedited Rules page is labelled 2023. Status: checked on the institute's own pages; fee schedules and thresholds for expedited arbitration were not checked ([SCC dispute resolution clauses](https://sccarbitrationinstitute.se/en/dispute-resolution-clauses/english/); [SCC Expedited Arbitration Rules 2023](https://sccarbitrationinstitute.se/en/scc-expedited-arbitration-rules-english-2023/)).

### Signature authority (firmateckning) in a Swedish limited company

**[DURABLE]** In a Swedish aktiebolag the board represents the company and signs for it, and documents the Act requires the board to sign need at least half of all directors (Aktiebolagslagen 8 kap. 35 §). The managing director may always represent the company within day-to-day management (8 kap. 36 §), and the board may appoint special signatories, at least one of whom must reside in the EEA (8 kap. 37 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Bolagsverket's guidance adds that the board's signing power is always registered, that special signatories may be natural persons inside or outside the board acting alone or jointly unless the articles restrict this, that the managing director's solo authority covers only day-to-day management whose scope depends on the company's business and size, and that powers of attorney filed with Bolagsverket are normally accepted when signed by more than half of the full board. Status: checked on the authority's own page ([Bolagsverket: Firmateckning i aktiebolag](https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/firmateckningiaktiebolag.519.html)).

**[DURABLE]** If the board or a special signatory acts outside statutory competence, the act does not bind the company; if the managing director exceeds day-to-day authority, or anyone exceeds internal instructions, the company is released only if it shows the counterparty knew or should have known (Aktiebolagslagen 8 kap. 42 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Under Avtalslagen section 10, second paragraph (ställningsfullmakt), a person whose position by law or custom carries authority to act is treated as authorised within that scope; under section 11 an act breaching internal restrictions does not bind the principal if the counterparty knew or should have known; under section 25 a person acting without authority is liable for the counterparty's loss. Status: checked on lagen.nu ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218)).

**[INFERENCE]** Signature checklist for agents: pull the counterparty's registration certificate; match the signatories to the registered signing rule; if the signer is the managing director alone, ask whether the contract is plainly day-to-day for that company and, where size, term or exclusivity is unusual, require board-level signatories or a power of attorney; and for the company's own signing follow the internal delegation of authority, because authority by position can bind the company even when internal limits are exceeded.

### Electronic signatures

**[DURABLE]** The eIDAS Regulation defines three levels in Article 3: an electronic signature is electronic data attached to or logically associated with other data and used to sign; an advanced electronic signature meets Article 26; and a qualified electronic signature is an advanced signature created by a qualified signature creation device and based on a qualified certificate. Article 26 requires an advanced signature to be uniquely linked to the signatory, capable of identifying the signatory, created with data under the signatory's sole control with a high level of confidence, and linked to the signed data so that later changes are detectable. Status: checked on primary source, original 2014 version only ([Regulation (EU) No 910/2014](https://eur-lex.europa.eu/eli/reg/2014/910/oj)).

**[DURABLE]** Under eIDAS Article 25 no electronic signature may be denied legal effect or admissibility as evidence solely because it is electronic or not qualified, while only a qualified electronic signature has the equivalent legal effect of a handwritten signature and is recognised across Member States. Status: checked on primary source, original 2014 version; the regulation as amended by Regulation (EU) 2024/1183 was not read ([Regulation (EU) No 910/2014](https://eur-lex.europa.eu/eli/reg/2014/910/oj)).

**[FAST-MOVING, Nov 2026]** PTS, the Swedish supervisor for trust services, describes three levels (simple, advanced and qualified), gives BankID and Freja eID+ as examples of advanced electronic signatures, and states that there is currently no Swedish statutory requirement to use qualified electronic signatures. Status: checked on the authority's own page ([PTS: Elektroniska underskrifter](https://pts.se/internet-och-telefoni/elektroniska-underskrifter/)).

**[INFERENCE]** BankID-based signing is adequate for ordinary commercial contracts because Swedish contract law has no general form requirement and eIDAS Article 25 protects admissibility; the practical question is proof, not validity. Documents with statutory form requirements, including corporate filings and anything involving real property, need separate checking. The evidentiary value of BankID in court was not researched beyond an article title ([SvJT 2023 s. 562](https://svjt.se/svjt/2023/562)).

### When a commercial contract goes to a human lawyer

**[INFERENCE]** Escalate a commercial contract to a human lawyer when it contains uncapped liabilities, non-standard indemnities, exclusivity or most-favoured-customer clauses, change-of-control or assignment restrictions, governing law outside Sweden or the EU, source-code escrow, a customer demand for audit rights on premises, or any deviation from the Data Act switching terms.

### Gaps in the commercial contracts research

**[GAP]** Not retrieved for commercial contracts: the content of Avtal 90; any Swedish law-firm negotiation playbook; Swedish market-median caps or service-credit levels; Bonterms standard terms; the European Commission's model contractual terms or standard clauses for cloud switching under the Data Act; the status of Swedish supplementary Data Act legislation after SOU 2025:118; SCC rule versions beyond the 2023 label, SCC fee schedules and SCC Express; contract lifecycle management practice from any source; and the effect of NIS2 and the Cyber Resilience Act on security clauses.

## 3. Consumer-facing terms

### When consumer rules apply to a mostly B2B SaaS company

**[INFERENCE]** A SaaS company that sells mainly to businesses still meets consumer law whenever a natural person buys for mainly private use, for example through a self-service checkout; the first research round notes, as unverified background, that sole traders can be consumers in edge cases. The safe intake question for agents is whether any plan can be bought online by an individual without a business identity check; if so, the consumer rules in this section apply to that flow.

### Pre-contract information and the order-button rule

**[DURABLE]** The Swedish distance-contract act, Distansavtalslagen (2005:59), chapter 2 lists 21 categories of pre-contract information (2 §), requires a standard withdrawal form to be supplied (2 a §), obliges online marketplaces to disclose ranking parameters and whether the seller is a trader (2 b §), and makes the information part of the contract (8 §). Status: checked on lagen.nu, not the official publication ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

**[DURABLE]** For web orders, Distansavtalslagen 2 kap. 9 § binds the consumer to pay only if the payment obligation was made clear and expressly accepted, which is the order-button rule: button wording must state that the order carries an obligation to pay. Status: checked on lagen.nu ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

**[DURABLE]** For telephone sales, Distansavtalslagen 2 kap. 3 a § makes a contract after an unsolicited call valid only if the consumer accepts the offer in writing afterwards. Status: checked on lagen.nu ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

### The 14-day withdrawal right and its digital-content carve-out

**[DURABLE]** The withdrawal period under Distansavtalslagen is 14 days (10 §). For services and certain digital content the period runs from conclusion of the contract; it does not start until withdrawal information is given and expires at the latest one year after it would otherwise have ended (12 §); the refund is due within 14 days of the notice by the same payment method (14 §). Status: checked on lagen.nu ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

**[DURABLE]** The exceptions in Distansavtalslagen 11 § include fully performed services with prior express consent, and digital content not on a physical medium once performance has begun with the consumer's consent and acknowledgement of losing the right. A consumer who asked for a service to start during the period pays a proportionate share on withdrawal (15 §); no payment is owed for digital content delivered before withdrawal (15 a §); and after withdrawal the trader generally may not use the consumer's non-personal content (14 a §). Status: checked on lagen.nu ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

### The withdrawal function ("ångerknapp") for contracts from 19 June 2026

**[FAST-MOVING, 2026]** Distansavtalslagen 2 kap. 10 a § requires an online withdrawal function that is easy to find throughout the withdrawal period, with acknowledgement of receipt, and 10 b § treats a breach as unfair marketing under Marknadsföringslagen. Status: checked on lagen.nu ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

**[VENDOR] [FAST-MOVING, June 2026]** A law-firm briefing reports that the withdrawal function applies to contracts concluded after 19 June 2026, must be clearly labelled, must let the consumer enter or confirm name and contract details, must require express confirmation, and must trigger an acknowledgement on a durable medium without delay; pre-contract information must say that the function exists and where. The same amendments replaced chapter 3 on financial services and added, in the financial-services context, a prohibition on misleading or manipulative online interfaces and a right to request human intervention. Status: secondary source only ([Baker McKenzie, June 2026](https://www.bakermckenzie.com/en/insight/publications/2026/06/sweden-the-cancellation-button-new-consumer-protection-rule)).

**[FAST-MOVING, Nov 2026]** Konsumentverket states that the withdrawal function must be free, easy to find and available on the website or app during the whole withdrawal period. Status: checked on the authority's own page ([Konsumentverket: distansavtalslagen](https://www.konsumentverket.se/lagar/lagen-om-distansavtal-och-avtal-utanfor-affarslokaler-konsument/)).

**[FAST-MOVING, Nov 2026]** A pending change: SFS 2026:1018 amends Distansavtalslagen 2 kap. 16 § (connected contracts) and 3 kap. 7 § with effect from 20 November 2026. Status: seen in the consolidated text on lagen.nu; the content of the change was not analysed ([Lag (2005:59), lagen.nu](https://lagen.nu/2005:59)).

### Automatic renewal of fixed-term consumer contracts

**[DURABLE]** Under lag (2014:1449), a fixed-term consumer contract may renew automatically only if the contract says so and the trader reminds the consumer in writing no later than one month before the last cancellation date; otherwise the consumer may terminate immediately, and the trader bears the burden of proving a timely reminder. Status: checked on Konsumentverket's page, not on the statute text ([Konsumentverket: Automatisk avtalsförlängning](https://www.konsumentverket.se/konsumentratt/automatisk-avtalsforlangning/)).

### Unfair terms in consumer contracts

**[DURABLE]** Lag (1994:1512) om avtalsvillkor i konsumentförhållanden applies to terms traders use when offering goods, services or other benefits to consumers (1 §). Patent- och marknadsdomstolen may prohibit a trader from using an unfair term in future, normally under penalty of a fine, and the prohibition can also reach employees and trade associations (3 §). Status: checked on primary source ([SFS 1994:1512](https://rkrattsbaser.gov.se/sfst?bet=1994:1512)).

**[DURABLE]** Under lag (1994:1512), an unclear term that was not individually negotiated is interpreted in the consumer's favour (10 §) and a term is presumed not individually negotiated unless shown otherwise (12 §). For non-negotiated terms, section 36 of Avtalslagen applies with consumer-protective limits: later circumstances may not be counted against the consumer, and if a term is set aside the consumer can require the rest of the contract to stand (11 §). Status: checked on primary source ([SFS 1994:1512](https://rkrattsbaser.gov.se/sfst?bet=1994:1512)).

**[DURABLE]** Three specific rules in lag (1994:1512) matter for checkout and support design. A term making the consumer pay more than the stated price has no effect unless the consumer expressly approved it, and the consumer can reclaim what was paid (13 §). A term forcing the consumer to use a premium-rate phone number to contact the trader about a concluded contract is deemed unfair (3 a §). And for online sales the Consumer Ombudsman can order the trader, a hosting provider or an internet provider to display a warning message where no other effective means exist (3 b §). Status: checked on primary source ([SFS 1994:1512](https://rkrattsbaser.gov.se/sfst?bet=1994:1512)).

### Limitation of consumer debts

**[DURABLE]** A trader's claim against a consumer for goods, services or other benefits supplied for mainly private use is time-barred after three years, and an agreement for a longer period for consumer claims is invalid (Preskriptionslagen 2 § and 12 §). Status: checked on primary source ([SFS 1981:130](https://rkrattsbaser.gov.se/sfst?bet=1981:130)).

### Consumer checkout checklist for a SaaS product

**[INFERENCE]** Consumer SaaS checkout checklist: give the full 2 kap. 2 § information before the order; use button wording that states the payment obligation; collect express consent and an acknowledgement tick-box if access starts immediately, because otherwise the 14-day right survives and can extend to one year plus 14 days; send confirmation on a durable medium; keep the withdrawal function live in web and app for the whole period; and run a reminder workflow at least one month before the cancellation deadline for fixed-term plans.

**[INFERENCE]** Dark-pattern exposure in Sweden currently runs mainly through Marknadsföringslagen, the Digital Services Act for platforms, and the withdrawal-function design rules. The express statutory ban on manipulative interfaces found in the research sits in the financial-services chapter of the distance-contract act, so agents must not cite it for ordinary SaaS without checking.

### Software product liability towards injured persons

**[FAST-MOVING, 11 Nov 2026]** Government bill prop. 2026/27:12, "En ny produktansvarslag", was submitted to the Riksdag on 15 October 2026. It extends strict liability from physical products to standalone software, adds compensation for loss or corruption of data, widens the circle of liable parties where the manufacturer is outside the EEA and eases the burden of proof. It proposes entry into force on 1 January 2027 and repeals produktansvarslagen (1992:18), which continues to apply to products placed on the market or put into service before that date. Status: checked on primary source; this corrects an earlier 9 December 2026 date taken from the August 2026 draft ([Prop. 2026/27:12, Riksdagen](https://data.riksdagen.se/dokument/HE0312.html)).

**[FAST-MOVING, 11 Nov 2026]** On 11 November 2026 the new Produktansvarslag was not adopted: Civil Affairs Committee report 2026/27:CU4 was in preparation, with committee handling on 5 November, adjustment planned for 19 November, debate on 24 November and decision planned for 25 November 2026. Status: checked on the Riksdag's document-status record ([Riksdagen, bet. 2026/27:CU4](https://data.riksdagen.se/dokumentstatus/HE01CU4.json)).

**[INFERENCE]** If the bill passes as proposed, software suppliers should expect strict liability for defective software causing personal injury, property damage or data loss to natural persons from 1 January 2027, while software placed on the market before that date stays under the 1992 act. Contractual caps do not bind injured third parties, so insurance and B2B recourse clauses need human review. Sweden would transpose about three weeks after the directive's 9 December 2026 deadline, a deadline known in this research from a secondary source only ([Faegre Drinker, 24 June 2026](https://www.faegredrinker.com/en/insights/publications/2026/6/transposing-the-eus-new-product-liability-directive-a-member-state-progress-report)).

### Gaps in the consumer-terms research

**[GAP]** Not opened: Konsumenttjänstlagen, the digital-content rules in Konsumentköplagen (2022:260), and the statute text of lag (2014:1449). Consumer rules on monthly rolling subscriptions, price-change clauses and maximum notice periods remain unsourced. No Swedish or EU subscription cancellation-button rule beyond the withdrawal function was found. European Accessibility Act duties for consumer-facing digital services are covered only as unverified background in section 12.

## 4. Routine documents: NDAs, DPAs, reseller and partner agreements, consultancy, terms of use, open source

### NDAs: what the Trade Secrets Act protects without a contract

**[DURABLE]** Under section 2 of the Swedish Trade Secrets Act, lag (2018:558), a trade secret is information on business or operating conditions that is not generally known or readily accessible, that the holder has taken reasonable measures to keep secret, and whose disclosure is likely to cause competitive harm. Experience and skills gained in normal work, and information about crimes or serious misconduct, are not trade secrets. Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[DURABLE]** Business partners who received a secret in confidence in connection with a business relationship are liable in damages for an intentional or negligent attack on it under section 6 of lag (2018:558), independently of any NDA. Remedies include an injunction under penalty of a fine (12 §), an interim injunction on probable cause (14 §) and delivery-up or destruction (17 §); damages claims reach back five years only, and injunction actions must be brought within five years of knowledge (24 §). Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[INFERENCE]** NDA drafting implications from the Trade Secrets Act: define and mark confidential information and record access controls, because reasonable secrecy measures are a condition of statutory protection; do not attempt to restrict whistleblowing or reporting of crimes or serious misconduct, since such information is outside the definition; and include a contractual confidentiality term and liquidated damages, because statutory damages require proof of loss and the look-back is five years.

**[FAST-MOVING, Nov 2026]** TechSverige publishes a standard Sekretessavtal (NDA) and GDPR processor terms tailored to cloud, infrastructure and other IT services, each with a processing-specification annex to be completed at signing. Status: existence checked on TechSverige's own page; the content is subscription-only and was not read ([TechSverige standard agreements](https://techsverige.se/om-oss-2/var-verksamhet/standardavtal/kort-beskrivning-av-alla-vara-standardavtal/)).

### DPAs: the mandatory Article 28(3) content

**[DURABLE]** GDPR Article 28(3) requires a binding contract between controller and processor that sets out the subject matter, duration, nature and purpose of the processing, the type of personal data, the categories of data subjects and the controller's obligations and rights. Under Article 28(1) and (2) a controller may use only processors offering sufficient guarantees, and a processor may not engage a sub-processor without prior specific or general written authorisation; under a general authorisation the processor must inform the controller of intended changes so that the controller can object. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** The table below sets out the eight processor obligations that GDPR Article 28(3)(a) to (h) requires every data processing agreement to contain; agents reviewing a DPA check each row is present and not diluted. Status: all rows checked on primary source.

| Art. 28(3) point | What the contract must require of the processor | Verification | Source |
|---|---|---|---|
| (a) | Process only on documented instructions, including for third-country transfers, unless law requires otherwise, in which case it informs the controller first unless that law prohibits it | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (b) | Ensure authorised persons are bound by confidentiality | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (c) | Take all Article 32 security measures | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (d) | Respect the sub-processor conditions | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (e) | Assist the controller with data-subject requests through appropriate technical and organisational measures, as far as possible | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (f) | Assist with the controller's duties under Articles 32 to 36 (security, breach notification, DPIA, prior consultation) | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (g) | At the controller's choice, delete or return all personal data at the end of the services and delete copies unless law requires storage | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (h) | Make available all information needed to demonstrate compliance, allow and contribute to audits and inspections, and tell the controller immediately if it considers an instruction unlawful | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |

**[DURABLE]** GDPR Article 28(4) requires the same data-protection obligations to be imposed on any sub-processor by contract. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** The EDPB flags a common drafting defect in processor contracts: wording that allows processing outside instructions whenever required by law or by a binding order of a governmental body, without limiting the exception to EU or Member State law as Article 28(3)(a) does. Status: checked on the EDPB's own opinion ([EDPB Opinion 22/2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf)).

**[DURABLE]** EDPB Guidelines 07/2020 walk through each Article 28(3) element, including documented instructions, confidentiality commitments of personnel, assistance with the Articles 32 to 36 obligations and the modalities of audits and inspections, remote and on-site. Status: checked on the EDPB's own guidelines ([EDPB Guidelines 07/2020](https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf)).

**[INFERENCE]** DPA review checklist: the Article 28(3)(a) to (h) items, plus sub-processor authorisation mechanics under Article 28(2) and (4), the transfer mechanism, breach-notification timing, and deletion or return on exit aligned with the main agreement's wind-down clause. From IMY's 2026 Miljödata decision (section 10), add two concrete items to the security annex: change control for new software and real-time intrusion monitoring.

### Reseller, agent and partner agreements: the Commercial Agents Act

**[DURABLE]** Under section 1 of lag (1991:351) om handelsagentur, a commercial agent is someone who, in business, has agreed with a principal to act independently and continuously to promote the sale or purchase of goods by taking offers or concluding contracts in the principal's name. The Act is default law except where it says a rule cannot be set aside (2 §). Status: checked on primary source ([Lag (1991:351)](https://rkrattsbaser.gov.se/sfst?bet=1991:351)).

**[DURABLE]** Mandatory protections in the Commercial Agents Act include minimum notice of one month in the first year, rising by one month per started year to six months, with no shorter notice agreed in advance (24 §); a fixed-term agreement that continues becomes indefinite (25 §); termination with immediate effect only for material breach or other important reason (26 §); and a termination indemnity where the agent brought new customers or substantially increased business and the principal continues to benefit, capped at one year's remuneration averaged over the last five years (28 §) and lost in the cases listed in 29 §. Status: checked on primary source ([Lag (1991:351)](https://rkrattsbaser.gov.se/sfst?bet=1991:351)).

**[INFERENCE] [CONTESTED]** The Commercial Agents Act is written for the sale or purchase of goods. Whether a referral or sales partner for SaaS subscriptions is covered directly or only by analogy is not settled by the text. The cautious drafting approach is to assume the notice and indemnity rules may be applied by analogy and to structure partners as resellers buying and reselling in their own name where the indemnity is unwanted; a human lawyer confirms the structure.

### Reseller agreements: the EU vertical block exemption

**[DURABLE]** The EU vertical block exemption, Regulation (EU) 2022/720, applies only where supplier and buyer each hold no more than 30% of their relevant markets (Article 3). Hardcore restrictions that remove the exemption include restricting the buyer's ability to set its resale price, although maximum or recommended prices remain possible if they do not amount to fixed or minimum prices, and territorial or customer restrictions beyond the listed exceptions, for example restricting an exclusive distributor's active sales into territories reserved for the supplier or allocated exclusively to up to five other distributors (Article 4). Status: checked on primary source ([Regulation (EU) 2022/720](https://eur-lex.europa.eu/eli/reg/2022/720/oj)).

**[DURABLE]** Excluded obligations under Article 5 of Regulation (EU) 2022/720 include non-compete obligations that are indefinite or longer than five years, and post-termination non-competes. The regulation expires on 31 May 2034. Status: checked on primary source ([Regulation (EU) 2022/720](https://eur-lex.europa.eu/eli/reg/2022/720/oj)).

**[INFERENCE]** Reseller agreements should avoid fixed or minimum resale prices and broad territorial bans on passive sales; recommended price lists and exclusive territories with only active-sales restrictions fit within the block exemption below the 30% share threshold. Any resale-price, exclusivity or most-favoured-customer clause goes to a human lawyer.

### Consultancy agreements and the contractor-versus-employee screen

**[DURABLE]** Swedish copyright defaults make a written assignment essential in every consultancy agreement: unless agreed otherwise, a transferee may not alter the work or transfer the rights onward (Upphovsrättslagen 28 §); the author has a right to fair remuneration and to an adjustment if pay proves disproportionately low (29 §); there is an annual reporting duty to authors (29 a §); and the author may terminate an unexploited exclusive grant on six months' notice (29 d §). Status: checked on lagen.nu, not the official publication ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

**[DURABLE]** Under section 38 of the Co-determination Act (MBL), an employer bound by a collective agreement must negotiate with the union before deciding to let a non-employee, such as a consultant, perform work in its business. Status: checked on lagen.nu ([Medbestämmandelagen, lagen.nu](https://lagen.nu/1976:580)).

**[DURABLE]** On the tax side, business income requires activity carried on professionally and independently, and in judging a contractor's independence particular weight goes to what was agreed with the principal, how dependent the contractor is on the principal, and how far the contractor is integrated into the principal's business (Inkomstskattelagen 13 kap. 1 §). Status: checked on primary source ([Inkomstskattelag (1999:1229)](https://rkrattsbaser.gov.se/sfst?bet=1999:1229)).

**[INFERENCE] [CONTESTED]** The three factors in the tax rule (agreement, dependence, integration) are a workable first screen for consultant engagements. Labour-law classification is a separate overall assessment in which F-tax status is not decisive, and it can differ from the tax outcome; that description rests on a secondary record only, and neither the criteria nor the Labour Court case law was retrieved ([Lund University publication record](https://www.lu.se/publikation/4239269)).

**[INFERENCE]** Consultancy template essentials for Sweden: an express written assignment of all intellectual property including the right to modify and to assign onward (to displace Upphovsrättslagen 28 §), a waiver or undertaking on moral rights to the extent permitted, confidentiality, confirmation of F-tax status, and a check of whether a union negotiation under MBL 38 § is triggered.

### Terms of use and acceptable use policies: the DSA hosting duties

**[DURABLE]** Under Article 6 of the Digital Services Act, a provider storing information for a user is not liable for it if it has no actual knowledge of illegal content (and, for damages, no awareness of facts making it apparent), or acts expeditiously to remove or disable access once it knows; the exemption does not apply where the user acts under the provider's authority or control. Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[DURABLE]** DSA Article 14 requires providers of intermediary services to state in their terms any restrictions on user-provided information, including content-moderation policies, procedures, measures and tools (algorithmic decision-making and human review) and the internal complaint-handling rules, in clear and user-friendly language and in a publicly available, machine-readable format; significant changes must be notified, and restrictions must be applied diligently, objectively and proportionately. Points of contact for authorities and for users are required under Articles 11 and 12. Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[DURABLE]** DSA Article 16 requires hosting providers to offer an electronic notice mechanism for alleged illegal content, and Article 17 requires a clear and specific statement of reasons to affected users when the provider removes or demotes content, suspends payments, or suspends or terminates the service or account because content is illegal or breaches the terms. The additional online-platform section does not apply to micro and small enterprises (Article 19). Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[INFERENCE]** A B2B SaaS product that stores customer content is a hosting service under the DSA, so the terms of use and acceptable use policy should describe prohibited content, moderation and suspension procedures, and the company needs a notice channel and a statement-of-reasons template for suspensions. Whether it is also an online platform depends on public dissemination of user content, which most B2B SaaS tools do not do.

**[DURABLE]** Licence or terms-of-use clauses that ban reverse engineering must carve out the non-waivable rights of lawful software users: copies and changes needed for intended use including error correction, one back-up, and observing, studying and testing (Upphovsrättslagen 26 g §), and decompilation for interoperability under strict conditions (26 h §). Contrary contract terms are void. Status: checked on lagen.nu ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

### B2B unfair terms

**[DURABLE]** Under lag (1984:292) om avtalsvillkor mellan näringsidkare, a court may prohibit a trader from continuing to impose an unfair term on another trader (1 §); particular regard is given to the need to protect a party in a weaker position, and a prohibition requires a public interest (2 §); only trade associations or an affected trader may apply (3 §). Status: checked on primary source ([SFS 1984:292](https://rkrattsbaser.gov.se/sfst?bet=1984:292)).

### Open-source licences: the two clauses verified

**[DURABLE]** Section 13 of the GNU Affero General Public License version 3 provides that if you modify the program, the modified version must prominently offer all users who interact with it remotely over a computer network an opportunity to receive the corresponding source from a network server at no charge. The section also permits combining AGPL code with GPLv3 code, each part staying under its own licence. Status: checked on the licence text ([GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.txt)).

**[DURABLE]** Section 4 of the Apache License 2.0 requires anyone redistributing the work, modified or not, in source or object form, to give recipients a copy of the licence, mark modified files with prominent change notices, retain copyright, patent, trademark and attribution notices in source form, and reproduce the attribution notices of any NOTICE file. Status: checked on the licence text ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)).

**[INFERENCE]** Permissive licences (MIT, BSD, Apache-2.0) mainly require preserving notices and licence text when distributing, while GPL-family copyleft requires offering corresponding source for the covered work and derivatives when distributing. Pure SaaS use usually does not distribute GPL code, which is why the AGPL adds the network-interaction trigger. Only the AGPL and Apache clauses above were verified; the MIT, BSD, GPL and LGPL texts were not opened.

**[INFERENCE]** Practical open-source rule for a SaaS product: AGPL components that the company modifies and exposes to users over a network trigger a source-offer duty for the modified version; using an unmodified AGPL service behind an API is a narrower question that needs case-by-case review by a human. Licence obligations still bite on anything shipped to customers, such as on-premises agents, SDKs, mobile apps and front-end JavaScript.

### Gaps in the routine-documents research

**[GAP]** Nothing was retrieved on Swedish shareholder agreements and fundraising documents (drag-along, tag-along, vesting, leaver terms, pre-emption, convertible instruments, model documents), or on employer-of-record arrangements (lag (2012:854) om uthyrning av arbetstagare, permanent-establishment risk, social security); only vendor marketing was found on employer of record, including one vendor's unverified statement that Sweden has no licensing regime for it ([Boundless](https://boundlesshq.com/blog/best-eor-sweden/)). Also not read: lag (1914:45) om kommission, distributor case law on reasonable notice, the TechSverige NDA and processor-terms content, SBOM practice and Cyber Resilience Act duties for open-source components. Agents must not fill these from memory.

## 5. AI-specific contract terms in 2026

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

## 6. Corporate law: Aktiebolagslagen, registers, options

### Verification note for the company-law section

**[DURABLE]** Unless a paragraph in this section says otherwise, every Aktiebolagslag rule below was read in the consolidated Aktiebolagslag (2005:551) in Regeringskansliets rättsdatabas, consolidated up to SFS 2026:783, in November 2026, and is "checked on primary source" ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)). No case law on director liability or on the timing of control balance sheets was retrieved.

### Basics: liability, share capital, share classes

**[DURABLE]** Shareholders of a Swedish limited company have no personal liability for company obligations (1 kap. 3 §), the exception being 25 kap. 19 §. Minimum share capital for a private company is SEK 25,000 (1 kap. 5 §). All shares carry equal rights unless the articles create share classes (4 kap. 1–2 §§), and where classes differ in economic or voting rights the articles must state the pre-emption rule for new issues (4 kap. 3 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Board composition, residence and term

**[DURABLE]** A Swedish limited company must have a board of one or more directors, and with fewer than three directors there must be at least one deputy (8 kap. 1 and 3 §§). At least half the directors must reside in the EEA unless Bolagsverket grants an exemption (8 kap. 9 §), the managing director must reside in the EEA (8 kap. 30 §), and at least one special signatory must reside in the EEA (8 kap. 37 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** A director's term runs to the end of the first annual general meeting after the year of appointment; the articles may extend it, at most to the annual general meeting in the fourth financial year after appointment. Changes in the board take effect when the notification reaches Bolagsverket, or later if the decision says so (8 kap. 13 §). A board with more than one member needs a chair, who leads the work and checks that the board does its statutory tasks (8 kap. 17 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Board duties and written instructions

**[DURABLE]** The board is responsible for the company's organisation and the management of its affairs, must continuously assess the financial position of the company and group, and must ensure that bookkeeping, asset management and finances are controlled in a satisfactory way; if it delegates tasks it must act with care and keep checking whether the delegation can stand (8 kap. 4 §). The board must issue written instructions on when and how financial information is collected and reported to it, unless that would be pointless given the company's limited size and business (8 kap. 5 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[INFERENCE]** Sections 8 kap. 6 and 7 §§ of Aktiebolagslagen were repealed by SFS 2014:539, so written rules of procedure for the board and a written instruction to the managing director are no longer a statutory duty for private companies; what those sections used to require was not read. Keeping both documents remains sensible governance and investors usually expect them. The repeal itself was checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Board meetings, quorum and minutes

**[DURABLE]** The chair must see that board meetings are held when needed, and a meeting must always be called if a director or the managing director asks (8 kap. 18 §); the managing director may attend and speak unless the board decides otherwise in a specific case (8 kap. 19 §). The board is quorate when more than half of all directors, or a higher number in the articles, are present; conflicted directors count as absent; and no decision may be made unless, as far as possible, all directors had the chance to take part and received satisfactory material (8 kap. 21 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Board decisions need more than half of those present, with the chair holding the casting vote; if the board is not at full strength, those voting in favour must be more than a third of all directors unless the articles say otherwise (8 kap. 22 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Board minutes are mandatory, must record decisions, and must be signed by the minute-taker and verified by the chair, and by one further director where the board has several members; directors and the managing director may have a dissent recorded (8 kap. 24 §). Minutes are numbered consecutively and kept safely (8 kap. 26 §). In a single-shareholder company, agreements between the shareholder and the company that are not ordinary-course transactions on normal terms must be recorded in or attached to the board minutes (8 kap. 25 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### The managing director

**[DURABLE]** Appointing a managing director (VD) is optional in a private company (8 kap. 27 §). The managing director runs day-to-day management under the board's guidelines and instructions; unusual or very significant measures need board authority unless waiting would cause significant inconvenience, in which case the board must be told as soon as possible; and the managing director must ensure lawful bookkeeping and sound asset management (8 kap. 29 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Conflicts of interest and the duty not to favour

**[DURABLE]** A director may not handle an agreement between the director and the company, an agreement between the company and a third party where the director has a material conflicting interest, or an agreement with a legal entity the director may represent; the exceptions are a director who owns all the shares and, for the third case, intra-group counterparties, and litigation is treated like an agreement (8 kap. 23 §). The same rule applies to the managing director (8 kap. 34 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Company representatives may not take measures likely to give an undue advantage to a shareholder or anyone else to the detriment of the company or another shareholder, and may not follow a general-meeting instruction that is contrary to the Act, the accounting legislation or the articles (8 kap. 41 §); the general meeting is under the same prohibition (7 kap. 47 §). A shareholder may not vote on a claim against himself or herself or on his or her own release from liability (7 kap. 46 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### General meetings: timing, notice and content

**[DURABLE]** The annual general meeting must be held within six months of the financial year-end (7 kap. 10 §) and must decide on adoption of the accounts, allocation of profit or loss, and discharge from liability for directors and the managing director (7 kap. 11 §). An extraordinary meeting must be called if the auditor or holders of at least one tenth of all shares ask in writing for a specified matter, and the notice must then go out within two weeks (7 kap. 13 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Notice of an annual general meeting, and of an extraordinary meeting that will consider amending the articles, is issued at the earliest six weeks and at the latest four weeks before the meeting, and a private company's articles may shorten the latest date to two weeks (7 kap. 18–19 §§); other extraordinary meetings need notice at the earliest six weeks and at the latest two weeks before (7 kap. 20 §). Notice is given in the way the articles prescribe and must also be posted to every shareholder with a known address in certain cases, including higher-majority article amendments and liquidation decisions (7 kap. 23 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** A general-meeting notice must state time and place, how to take part if the meeting is digital, and a numbered proposed agenda with the main content of each proposal; the main content of a proposed article amendment must always be stated (7 kap. 24 §). The meeting is held where the board has its seat, and the articles may allow another named place in Sweden or a digital meeting (7 kap. 15 §); Bolagsverket confirms that fully digital general meetings are possible only if the articles provide for them. Status: checked on primary source and on the authority's page ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551); [Bolagsverket: Digital bolagsstämma](https://bolagsverket.se/foretag/aktiebolag/drivaaktiebolag/tabeslutiaktiebolaget/bolagsstamma/digitalbolagsstamma.5364.html)).

**[DURABLE]** Proxies for a general meeting must be written, signed and dated and last at most one year in a company that is not a CSD-registered company (7 kap. 3 §). Accounts and the audit report must be available to shareholders at the company for at least two weeks before the annual general meeting (7 kap. 25 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### General meetings: majorities and minutes

**[DURABLE]** The table below sets out the general-meeting majority thresholds in chapter 7 of Aktiebolagslagen; agents preparing resolutions pick the row before drafting the notice. Status: all rows checked on primary source.

| Decision | Required majority | Section | Source |
|---|---|---|---|
| Ordinary decisions | More than half of the votes cast, chair's casting vote; elections go to whoever gets most votes | 7 kap. 40–41 §§ | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Amending the articles | Two thirds of both the votes cast and the shares represented | 7 kap. 42 § | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Amendments reducing existing shareholders' rights to profit or assets, restricting transferability by consent, pre-emption or post-sale purchase-right clauses, or disturbing the legal relationship between shares | Unanimity of those present, who must together hold nine tenths of all shares | 7 kap. 43 § | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Voting caps and certain restrictions on the use of profits | Two thirds of votes cast plus nine tenths of shares represented; relaxed by 7 kap. 45 § where only some shares or one class are affected and those holders consent in the stated proportions | 7 kap. 44–45 §§ | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Deviation from shareholders' pre-emption rights in a cash issue | Two thirds of both votes cast and shares represented | 13 kap. 2 § | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Issues or transfers to directors, the managing director, employees and their close relations in public companies and subsidiaries of public companies only | Nine tenths of both votes cast and shares represented | 16 kap. 1–2 and 8 §§ | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |

**[DURABLE]** General-meeting minutes are the chair's responsibility; they record date and place, or that the meeting was digital, the decisions and vote outcomes, with the voting list attached, and are signed by the minute-taker and verified by the chair and at least one verifier (7 kap. 48 §). They must be available to shareholders at the company no later than two weeks after the meeting (7 kap. 49 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Share issues and board authorisations

**[DURABLE]** Share issue decisions are made by the general meeting, and the board may decide under an authorisation or subject to later approval (11 kap. 2 §). Existing shareholders have pre-emption rights pro rata in a cash issue (13 kap. 1 §). New shares may not receive dividends until the capital increase is registered (11 kap. 10 §), and a share issue decision must be notified for registration within six months of the decision (13 kap. 27 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** The general meeting may authorise the board to issue new shares within the limits of the articles, including with deviation from pre-emption rights (13 kap. 35 §). The proposal must state the period, ending before the next annual general meeting, within which the authorisation may be used (13 kap. 36 §); the authorisation must be notified for registration immediately, and the board may not use it before it is registered (13 kap. 37 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### The "Leo rules" do not bind an ordinary private company

**[DURABLE]** Chapter 16 of Aktiebolagslagen, the "Leo rules", applies when public companies and subsidiaries of public companies decide on issues or transfers to directors, the managing director, other employees and their close relations (16 kap. 1–2 §§), and such decisions need nine tenths of both votes cast and shares represented (16 kap. 8 §). A private company that is not a subsidiary of a public company is outside the chapter. This corrects the first research round, which had listed the nine-tenths rule as a general rule for directed issues to directors and employees. Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[INFERENCE]** Employee option or warrant issues in a privately held start-up therefore need the ordinary two-thirds majority for deviating from pre-emption rights, not nine tenths. If the company is later owned by, or becomes, a public company, the nine-tenths rule starts to apply, so agents should re-check the ownership structure before each incentive programme.

### Share register

**[DURABLE]** Every Swedish limited company must have a share register (5 kap. 1 §). In a company that is not CSD-registered it lists each share's number, the holders' names, identity numbers and postal addresses, the share class, whether certificates were issued, and any transfer restrictions (5 kap. 5 §). The board is responsible for keeping, preserving and making the register available (5 kap. 7 §), and it must be available at the company to anyone who wants to see it (5 kap. 10 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Auditor opt-out thresholds

**[DURABLE]** A private company may opt out of having an auditor through its articles unless it exceeds more than one of these thresholds in each of the two latest financial years: more than 3 employees on average, a balance-sheet total above SEK 1.5 million, and net turnover above SEK 3 million (9 kap. 1 §, as read November 2026). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Personal liability of directors and the managing director

**[DURABLE]** Directors and the managing director must compensate damage they cause the company intentionally or negligently in their role, and damage caused to shareholders or others by breaching the Act, the accounting legislation or the articles (29 kap. 1 §). Shareholders are liable for intent or gross negligence (29 kap. 3 §), and damages can be adjusted (29 kap. 5 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** A company claim against a director can be brought if a majority, or a minority holding at least one tenth of all shares, supported it at a general meeting or voted against discharge (29 kap. 7 §). A claim based on a financial year's decisions must be brought within one year of the accounts and audit report being presented to the meeting (29 kap. 10 §), and the outer limit against directors and the managing director for non-criminal claims is five years from the end of the relevant financial year (29 kap. 13 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

### Capital deficiency: the control balance sheet steps

**[DURABLE]** The board must immediately prepare a control balance sheet (kontrollbalansräkning), and have the auditor examine it, when there is reason to assume equity is below half the registered share capital, or when enforcement shows the company lacks assets (25 kap. 13 §). If the control balance sheet confirms the shortfall, the board must as soon as possible call a first control meeting (25 kap. 15 §). If equity is not restored to the full registered share capital, a second control meeting must be held within eight months (25 kap. 16 §), and if it is still not restored the board must apply to the district court for liquidation within two weeks (25 kap. 17 §). Status: checked on primary source ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Directors who fail any of the three capital-deficiency steps are jointly and severally liable for obligations the company incurs while the failure lasts, as is anyone who acts for the company knowing of the failure; a person who shows they were not negligent escapes (25 kap. 18 §). Shareholders who knowingly vote to continue the business can also be liable (25 kap. 19 §). Status: checked on primary source, except that the fourth paragraph of 25 kap. 18 §, a limitation linked to the level of equity, was cut off in the extract and is not reported ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551)).

**[DURABLE]** Bolagsverket's guidance on the control balance sheet adds that the entire registered share capital must be restored by the second control meeting, for example through a new issue at a premium, a shareholder contribution or a reduction of share capital, and that the board prepares a new control balance sheet for the second meeting, reviewed by the auditor. Status: checked on the authority's own page ([Bolagsverket: Kontrollbalansräkning](https://bolagsverket.se/foretag/aktiebolag/arsredovisningforaktiebolag/kontrollbalansrakningvidmisstankeomatthalftenavdetregistreradeaktiekapitaletarforbrukat.3074.html)).

**[INFERENCE]** The control balance sheet is the riskiest company-law rule for directors of a loss-making, venture-funded SaaS company. Agents should flag whenever management accounts show equity approaching 50% of registered share capital, and a human must own the timeline: immediate preparation, first meeting, the eight-month deadline and the two-week court application.

### Corporate housekeeping checklist

**[INFERENCE]** A routine corporate-housekeeping checklist for a private Swedish limited company follows directly from the statute text: numbered and verified board minutes; written financial reporting instructions; an annual general meeting within six months of year-end; notice inside the six-to-four-week (or two-week) window; a share register kept current and shown on request; issue authorisations registered before use and limited to the period before the next annual general meeting; and share issues registered within six months.

### The 2026 amendment to Aktiebolagslagen

**[FAST-MOVING, 2026]** SFS 2026:783, published on 2 June 2026, enters into force on 5 December 2026. The provisions read concern public companies: a new 7 kap. 59 a § on the majority for introducing or changing multiple-vote share structures when applying for admission to a multilateral trading facility, and extension of the share buy-back rules in chapter 19 to companies listed on such facilities. Status: checked on primary source; the researchers infer, without having opened the bill, that this implements the EU Listing Act directive on multiple-vote shares ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551); [SFS 2026:783](https://svenskforfattningssamling.se/doc/2026783.html)).

### Beneficial-owner register

**[DURABLE]** Under lagen (2017:631) om registrering av verkliga huvudmän, a company must keep reliable, current and documented information on its beneficial owner and retain superseded documentation for at least five years (2 kap. 1 §); it must file with Bolagsverket at the same time as the company registration and notify changes without delay (2 kap. 3 §); and Bolagsverket can order compliance under a conditional fine directed at the company, the managing director or a director (3 kap. 6 §). Status: checked on primary source ([Lag (2017:631)](https://rkrattsbaser.gov.se/sfst?bet=2017:631)).

**[FAST-MOVING, Nov 2026]** Bolagsverket explains that a beneficial owner is typically someone controlling more than 25% of the votes, so four owners at exactly 25% each means none qualifies on that test, that filing is mandatory through its e-service, and that around 800,000 legal entities including limited companies are covered. Status: checked on the authority's own page ([Bolagsverket: FAQ verklig huvudman](https://bolagsverket.se/omoss/flerverksamheter/omverklighuvudman/vanligafragorfranallmanhetenomverklighuvudman.2543.html)).

**[FAST-MOVING, 2026]** SFS 2026:316 ended general public access to the Swedish beneficial-owner register. Bolagsverket is controller of the register (9 b §); authorities and self-regulatory bodies get immediate and unrestricted access (9 c §); obliged entities doing customer due diligence may receive data electronically (9 d §); and others get electronic access only with a legitimate interest under Article 12 of Directive (EU) 2024/1640, limited to the beneficial owner's name, month and year of birth, country of residence and nationality, and the nature and extent of the interest (9 e §). Bolagsverket issues a certificate of legitimate interest valid for three years (9 f §), EEA certificates are recognised (9 h §), and requests are refused where the recipient is outside the EEA and disclosure would breach GDPR Chapter V, or where misuse is suspected (9 i §). Status: checked on primary source; the in-force date of SFS 2026:316 was not read, and the bill had proposed 1 July 2026 ([Lag (2017:631)](https://rkrattsbaser.gov.se/sfst?bet=2017:631); [Prop. 2025/26:129](https://data.riksdagen.se/dokument/HD03129.html)).

### Qualified employee stock options

**[FAST-MOVING, 2026 edition]** Tax-favoured qualified employee stock options (kvalificerade personaloptioner), for options acquired after 31 December 2021, require the company to have fewer than 150 employees and working owners on average; net turnover or balance-sheet total of at most SEK 280 million group-wide; operations begun no more than 10 years before, counted from the end of the year operations began; no listing on a regulated market; and public bodies controlling less than 25%. Excluded sectors include banking and finance, insurance, coal or steel, trading in land, real estate, commodities or financial instruments, long-term letting, and legal, accounting or audit services. Status: checked on Skatteverket's legal guidance, edition 2026.14 ([Skatteverket Rättslig vägledning 2026.14](https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/399929.html)).

**[FAST-MOVING, 2026 edition]** The option and holder conditions for qualified employee stock options are a per-holder option value of at most SEK 3 million and a company-wide value of at most SEK 75 million at grant; exercise no earlier than 3 years and no later than 10 years after grant; the holder employed or on the board for the whole vesting period; employees working on average at least 30 hours a week and receiving at least 13 income base amounts in salary over the vesting period (1.5 for directors); the holder with relatives controlling at most 5% of capital or votes; and exercise for a share or a warrant in the company or a group company. The tax effect is no employment-income benefit taxation, with the sale of the shares taxed as capital income. Status: checked on Skatteverket's legal guidance, edition 2026.14 ([Skatteverket Rättslig vägledning 2026.14](https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/399929.html)).

**[INFERENCE]** Qualified employee stock option plans need a yearly eligibility re-test (headcount, SEK 280 million, the 10-year age limit) before each grant, because scale-ups cross these limits quickly; after that, warrants bought at market value or ordinary taxed options are the alternatives. Tax design of any incentive programme goes to a human adviser.

### Foreign direct investment screening

**[FAST-MOVING, Nov 2026]** Sweden has a foreign direct investment screening regime handled by ISP through a notification form covering investments that give influence over protection-worthy activities. Status: only the existence of the notification regime was checked, on ISP's own form; thresholds, covered activities and timelines were not researched ([ISP notification form](https://isp.se/media/jpvlvj5o/anmalan-av-utlandsk-direktinvestering.pdf)).

**[INFERENCE]** Any funding round with non-EU or non-EEA investors, or EU investors with non-EU owners, should include an early screening check with a human lawyer, since SaaS and AI businesses handling emerging technology or sensitive data may be in scope.

### Gaps in the corporate research

**[GAP]** Not read in Aktiebolagslagen: chapters 14 and 15 (warrants and convertibles), chapter 18 (dividends and the prudence rule), chapter 21 (loans to shareholders and directors) and the transfer-restriction clauses in chapter 4. Not retrieved at all: shareholder agreements, investment documentation standards, warrant programme mechanics, Bolagsverket's application procedure and fee for a certificate of legitimate interest, other 2025–2026 anti-company-crime measures at Bolagsverket, and the thresholds of the foreign direct investment act.

## 7. Intellectual property

### Copyright in software and who owns it

**[DURABLE]** Under the Swedish Copyright Act, computer programs are protected as literary works, including preparatory design material (1 §), and copyright lasts 70 years after the author's death (43 §). Under 40 a §, copyright in a computer program created by an employee as part of their duties or on the employer's instructions passes to the employer unless otherwise agreed. Status: checked on lagen.nu, not the official publication ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

**[DURABLE]** Outside the employee-software rule, rights stay with the creator unless assigned: under Upphovsrättslagen 28 §, absent agreement an assignee may not alter the work or transfer the rights onward, although rights forming part of a business may pass with the business. The catalogue and database right in 49 § lasts until 15 years after the year the work was produced. Status: checked on lagen.nu; the full conditions of 49 § and the sanctions in 53–54 §§ were not read ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

**[FAST-MOVING, 2026]** The Copyright Act is amended through SFS 2026:1120, published 16 June 2026, which touches at least provisions in chapter 8 on the Act's scope and applies also to works created before it took effect. Status: amendment reference checked on riksdagen.se; its exact subject was not read ([Upphovsrättslagen, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)).

**[INFERENCE]** Intellectual-property assignment checklist: employment contracts should assign all work results beyond the 40 a § software rule (documentation, designs, interface text, training data, models), include a right to modify and assign onward, and cover inventions; contractor agreements must contain a full written assignment because no statutory transfer exists for non-employees. The Swedish default for non-software works created by employees, often described as an implied licence for the employer's normal business, is not statutory and was not verified on a primary source.

### Employee inventions

**[DURABLE]** Lag (1949:345) om rätten till arbetstagares uppfinningar covers patentable inventions by employees in public or private service, with university teachers excluded (1 §). It is default law that yields to express agreement or to what follows from the employment, except for the mandatory compensation and post-employment rules (2 §). Status: checked on primary source ([SFS 1949:345](https://rkrattsbaser.gov.se/sfst?bet=1949:345)).

**[DURABLE]** The Employee Inventions Act sorts inventions into three categories (3 §). For research inventions within the employer's field, where research or inventing is the employee's main task or the invention solves a specified assigned task, the employer may take over the right wholly or partly. For other inventions connected with the employment and within the employer's field, the employer gets a right to use them and priority to negotiate more. For inventions unconnected with the employment but within the employer's field, the employer gets priority to negotiate. Status: checked on primary source ([SFS 1949:345](https://rkrattsbaser.gov.se/sfst?bet=1949:345)).

**[DURABLE]** The employee must notify the employer of an invention without delay (4 §), and the employer must claim its right within four months of receiving the notice; during that period the employee may not dispose of or disclose the invention but may file a Swedish patent application and must tell the employer within one week of filing (5 §). Status: checked on primary source ([SFS 1949:345](https://rkrattsbaser.gov.se/sfst?bet=1949:345)).

**[DURABLE]** The employee is entitled to reasonable compensation for an invention the employer takes over even if otherwise agreed before the invention was made; for research inventions, compensation beyond costs is due only to the extent the value exceeds what could reasonably be expected given salary and benefits (6 §). A patent applied for within six months after employment ends is treated as made during employment for the research category unless the inventor shows it likely arose afterwards, and a restriction on the employee's right to dispose of inventions made more than one year after employment ended is void (7 §). Patent- och marknadsdomstolen is the competent court (9 §) and a special board, Statens nämnd för arbetstagares uppfinningar, can give opinions (10 §). Status: checked on primary source ([SFS 1949:345](https://rkrattsbaser.gov.se/sfst?bet=1949:345)).

### Trade secrets after employment and the 2025 criminal provisions

**[DURABLE]** Employees are liable for attacks on trade secrets learned in employment, but for use or disclosure after employment ends, liability arises only for extraordinary reasons (synnerliga skäl) under 7 § of lag (2018:558). Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[FAST-MOVING, 2025]** The criminal provisions of the Trade Secrets Act were tightened by lag (2025:1281): corporate espionage (26 §) carries up to two years, or six months to six years if gross; a new offence (26 a §) criminalises unlawful use or disclosure of a technical trade secret obtained through employment or a business relationship; and attempt and preparation are punishable (26 b §). Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[INFERENCE]** Because post-employment trade-secret liability needs extraordinary reasons, contractual post-termination confidentiality clauses are the practical protection, and since late 2025 misuse of technical secrets by former employees or partners can also be criminal.

### Trademarks: what can be registered and how protection arises

**[DURABLE]** Under the Swedish Trademarks Act, a trademark can be any sign with distinctive character that can be clearly represented in the register, including words, figures, letters, numerals, colours, sounds and shapes (1 kap. 4 §). Signs that merely describe the kind, quality or other characteristics of the goods or services, or that have become customary terms, lack distinctiveness, though it can be acquired through use (1 kap. 5 §). Status: checked on primary source ([Varumärkeslag (2010:1877)](https://rkrattsbaser.gov.se/sfst?bet=2010:1877)).

**[DURABLE]** Exclusive trademark rights arise by registration with PRV or by international registration (1 kap. 6 §), or without registration through establishment on the market, meaning the sign is known among a significant part of the relevant public in Sweden (1 kap. 7 §). Protection covers an identical sign for identical goods or services, an identical or similar sign for identical or similar goods or services where there is a likelihood of confusion, and extended protection for marks known to a significant part of the relevant public (1 kap. 10 §). Status: checked on primary source ([Varumärkeslag (2010:1877)](https://rkrattsbaser.gov.se/sfst?bet=2010:1877)).

**[DURABLE]** An opposition must reach PRV within three months of publication of the registration (2 kap. 24 §); registration lasts ten years from the filing date and is renewable for ten years at a time (2 kap. 34–35 §§); a registration can be revoked for non-use if there has been no genuine use in Sweden within five years of the final registration decision or for five consecutive years, absent proper reasons (3 kap. 2 §); and infringement damages comprise reasonable compensation for the use plus further loss, considering lost profit, the infringer's profit, reputational harm and non-economic harm (8 kap. 4 §). Status: checked on primary source ([Varumärkeslag (2010:1877)](https://rkrattsbaser.gov.se/sfst?bet=2010:1877)).

### Trademark and domain fees

**[FAST-MOVING, Nov 2026]** The table below gives trademark fees as read on the offices' own pages in November 2026; fees change, so agents re-check before quoting a budget.

| Item | Fee as read Nov 2026 | Verification | Source |
|---|---|---|---|
| Swedish trademark application, one class, PRV e-service | SEK 2,700, plus SEK 1,000 per additional class | Checked on primary source | [PRV: avgifter och betalning](https://www.prv.se/sv/varumarke/avgifter-och-betalning/) |
| Swedish trademark application, one class, paper or other route | SEK 3,900, plus SEK 1,000 per additional class | Checked on primary source | [PRV: avgifter och betalning](https://www.prv.se/sv/varumarke/avgifter-och-betalning/) |
| Swedish trademark renewal, one class | SEK 2,700 in one fee table and SEK 3,900 in the other (apparently e-service versus form), plus SEK 1,000 per additional class; SEK 200 per class surcharge for late renewal | Checked on primary source | [PRV: Avgifter för varumärke](https://www.prv.se/sv/varumarke/forbered-dig-infor-varumarkesansokan/avgifter-for-varumarke/) |
| Recording a new owner at PRV; administrative revocation application | SEK 1,000; SEK 900 | Checked on primary source | [PRV: Avgifter för varumärke](https://www.prv.se/sv/varumarke/forbered-dig-infor-varumarkesansokan/avgifter-for-varumarke/) |
| EU trade mark, online application | EUR 850 for one class, EUR 50 for the second class, EUR 150 for each class from the third | Checked on primary source | [EUIPO fees and payments](https://www.euipo.europa.eu/en/trade-marks/before-applying/fees-payments) |
| EU trade mark, online renewal | EUR 850 basic fee | Checked on primary source | [EUIPO fee list](https://www.euipo.europa.eu/en/trade-marks/before-applying/fees-payable-direct-to-the-euipo) |

**[FAST-MOVING, Jan 2026]** Domains under .se are allocated first come, first served without prior examination, and disputes go to the Alternative Dispute Resolution procedure (ATF) administered by WIPO, which tests three conditions including bad-faith registration or use by the holder; registration terms dated 15 January 2026 and procedural rules dated January 2026 are in force. Status: checked on the registry's own page ([Internetstiftelsen](https://internetstiftelsen.se/domaner/tvistlosning/tvistlosning-for-se-domaner/)).

### Text and data mining and AI training

**[DURABLE]** Under Upphovsrättslagen 15 a §, anyone with lawful access to a work may make copies for text and data mining; copies may be kept only as long as needed and not used for other purposes; and the exception does not apply if the rightsholder has reserved the right in an appropriate manner. Under 15 b §, research organisations and cultural-heritage institutions have a separate research exception, not for computer programs, that cannot be overridden by contract, and 15 c § defines text and data mining as automated analysis of digital text and data to generate information. Status: checked on lagen.nu ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

**[FAST-MOVING, Nov 2026]** Rights reservations against text and data mining exist in practice in Sweden: the collecting society Bildupphovsrätt has published a blanket reservation for the works it represents. Status: checked on the society's own page ([Bildupphovsrätt](https://www.bildupphovsratt.se/bildanvandare/om-upphovsratt/forbehall-text-och-datautvinning)).

**[FAST-MOVING, 3 Nov 2026]** In CJEU case C-250/25, Like Company v Google Ireland, First Advocate General Szpunar delivered his Opinion on 3 November 2026; it examines whether a chatbot's retrieval and reuse of press publications is reproduction and communication to the public. There is no judgment yet. Status: existence and date of the Opinion checked on the Court's own site ([Curia: Opinion in C-250/25](https://curia.europa.eu/site/jcms/p1_1000088866/en/opinion-case-c-250/25-like-company)).

**[CONTESTED] [FAST-MOVING, Nov 2026]** According to commentary on the Opinion in C-250/25, the Advocate General considers the training questions inadmissible but states that training of large language models is mostly covered by the text-and-data-mining concept and exceptions if their conditions are met (lawful access, no effective opt-out such as robots.txt or website terms); that an output reproduces a press publication only if protected expression remains recognisable, the decisive question being whether the answer is a direct substitute for the original; that provider responsibility turns on business-model design and reasonable safeguards instead of occasional errors; and that EU law may apply to scraping from EU servers even if training occurs abroad. Two further referrals are pending (C-806/26 and C-829/26). The Opinion is not binding. Status: secondary source only for the content of the Opinion ([Kluwer Copyright Blog](https://legalblogs.wolterskluwer.com/copyright-blog/first-reflections-on-ag-szpunars-opinion-in-like-company/); [VitalLaw](https://www.vitallaw.com/news/copyright-news-european-advocate-general-ai-training-can-fall-within-copyright-exception/ipm01d6a2ac79c59840968d4ff7270d68ca85)).

**[INFERENCE]** For any in-house model training or scraping: record lawful access, honour machine-readable and terms-of-use opt-outs, and delete copies when no longer needed. Treat the Advocate General's view as a likely but unconfirmed direction until the Court rules; the timing of the judgment is unknown.

**[INFERENCE]** AI-generated code or content with little human authorship may be unprotectable, so protect it through confidentiality and contract and keep records of the human contribution, in line with the DIGG guidance in section 5.

### Gaps in the intellectual-property research

**[GAP]** Not researched or not read: the 1995 collective agreement on employee inventions, beyond confirming that the 2015 Svenskt Näringsliv–PTK settlement also amended it ([PTK agreement 2015](https://www.ptk.se/wp-content/uploads/2021/04/Svenskt-Naringsliv-PTK-2015-Avtal-Konkurrensklausuler-1.pdf)); any Swedish government inquiry specifically on AI and copyright (none found); the copyright-policy duties for general-purpose AI model providers under AI Act Article 53 beyond unverified background; UDRP and other top-level-domain procedures; and patent basics. Copyright rulings in other courts in 2025 and 2026 on AI training were recalled only from memory and are not stated as findings.

## 8. Employment law

### First question: is the company bound by a collective agreement?

**[INFERENCE]** Before drafting any employment document, an agent should establish whether the company is bound by a collective agreement, for example through an employer association. It changes which rules of the Employment Protection Act, working-time act and holiday act apply, whether union negotiation duties attach to ordinary business decisions, and whether the PTK non-compete agreement binds directly. The current collective-agreement landscape for tech and SaaS companies, and occupational pension and insurance obligations, were not researched.

### Employment Protection Act (LAS): scope and forms of employment

**[DURABLE]** The Swedish Employment Protection Act, lag (1982:80), amended through SFS 2022:836 in the text read, excludes employees in a managerial or comparable position, the employer's family members and certain subsidised employees from most protections (1 §). Individual contracts cannot waive rights under the Act (2 a §), while collective agreements may deviate from listed sections, some only at central-organisation level (2 b §). Status: checked on primary source; amendments after SFS 2022:836 were not checked ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

**[DURABLE]** Permanent employment is the default under LAS (4 §). Fixed-term employment is allowed only as special fixed-term employment, temporary cover or seasonal work (5 §); special fixed-term employment converts to permanent after more than 12 months in a five-year period, and cover employment after more than two years in five (5 a §). Probation may last up to six months (6 §), and written information on essential terms is due, for the basics, by the seventh calendar day after start (6 c §). Status: checked on primary source ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

### LAS: termination, notice and redundancy

**[DURABLE]** Dismissal under LAS requires objective reasons (sakliga skäl), meaning redundancy or personal circumstances, and redeployment where reasonable (7 §); summary dismissal is allowed only for gross breach (18 §); and minimum notice is one month for both sides, rising with tenure to two months after two years and up to six months after ten years (11 §). Status: checked on primary source ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

**[DURABLE]** In a redundancy, the employer may exempt up to three key employees before last-in-first-out ranking (22 §), and employees with more than 12 months' service in the last three years have re-employment priority for nine months (25 §). Status: checked on primary source ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

**[DURABLE]** LAS procedure runs on short deadlines: advance notice to the employee, and to the union if the employee is a member, two weeks before a personal-reasons dismissal and one week before summary dismissal, with consultation on request within a week (30 §); the employee must notify an invalidity claim within two weeks and a damages claim within four months, or the claim is lost (40–42 §§). Status: checked on primary source ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

**[DURABLE]** An unfounded dismissal can be declared invalid, but the court cannot order the employment to continue pending final judgment in dismissal disputes (34 §). An employer refusing to comply with an invalidity judgment pays 16 monthly salaries for under five years' service, rising to 32 for ten years or more (39 §), and an employee has the right to remain until the end of the month they turn 69 (32 a §). Status: checked on primary source ([LAS, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)).

**[INFERENCE]** Termination matters always go to a human lawyer: the two-week and four-month employee deadlines, the 30 § notice sequence, the union negotiation duty that applies to redundancies even without a collective agreement, and the 16 to 32 monthly salaries of buy-out exposure make procedural errors expensive.

### Union consultation under the Co-determination Act (MBL)

**[DURABLE]** Under MBL 11 §, an employer bound by a collective agreement must on its own initiative negotiate with the union before deciding on important changes to the business or to members' working or employment conditions. Under 13 § second paragraph, an employer with no collective agreement must still negotiate with all affected unions on redundancy dismissals and transfers of undertakings. Status: checked on lagen.nu, not the official publication ([Medbestämmandelagen, lagen.nu](https://lagen.nu/1976:580)).

**[VENDOR] [FAST-MOVING, Sept 2026]** An employer association reports that breach of the negotiation duty in MBL 11–13 §§ triggers damages and notes a Labour Court ruling, AD 2026 nr 40 of 27 May 2026, bearing on how the duties compare with and without a collective agreement. Status: secondary source only; the ruling was not read ([Almega, September 2026](https://www.almega.se/2026/09/medbestammandelagen-mbl-vad-galler-for-dig-som-arbetsgivare/)).

### Working time

**[DURABLE]** The Swedish Working Hours Act does not apply to managerial staff or employees trusted to set their own hours (2 §) and can be replaced or varied by central collective agreement within EU-directive limits (3 §). Ordinary time is at most 40 hours a week (5 §); general overtime at most 48 hours per four weeks or 50 hours per month and 200 hours per year (8 §), with extra overtime up to 150 hours a year for special reasons (8 a §); and total working time at most 48 hours per seven days averaged over up to four months (10 b §). Status: checked on lagen.nu ([Arbetstidslagen, lagen.nu](https://lagen.nu/1982:673)).

**[DURABLE]** The Working Hours Act also requires records of on-call time, overtime and additional time (11 §), 11 hours' daily rest including midnight to 05:00 (13 §), 36 hours' weekly rest (14 §) and no more than five hours' work without a break (15 §), with a sanction fee of 1% of the price base amount per unlawful hour per employee (26 §). Status: checked on lagen.nu ([Arbetstidslagen, lagen.nu](https://lagen.nu/1982:673)).

**[INFERENCE]** Senior staff with trusted working time can fall outside the Working Hours Act, but the exemption is narrow; overtime-inclusive salary clauses for ordinary staff do not remove the record-keeping and rest rules.

### Annual leave

**[DURABLE]** Under the Swedish Annual Leave Act, employees have 25 days' annual leave, or 5 if hired after 31 August (4 §); the holiday year runs 1 April to 31 March (3 §); holiday pay follows the same-pay rule (a supplement of 0.43% of monthly salary per day, and 12% on variable pay) or the percentage rule (12% of earnings) (16–16 b §§); and four consecutive weeks fall in June to August unless agreed otherwise (12 §). Status: checked on lagen.nu ([Semesterlagen, lagen.nu](https://lagen.nu/1977:480)).

**[DURABLE]** Under the Annual Leave Act, the employer decides placement of leave absent agreement and must notify two months ahead (11 §); days above 20 can be saved for up to five years (18 §); holiday compensation is paid within one month of termination (30 §); and claims are time-barred two years after the holiday year (33 §). Status: checked on lagen.nu ([Semesterlagen, lagen.nu](https://lagen.nu/1977:480)).

### Parental leave

**[DURABLE]** Under the Parental Leave Act, a parent may shorten normal working time by up to a quarter until the child turns eight or finishes the first school year (7 §), leave may be split into at most three periods per calendar year (10 §), and the employee must notify at least two months before the leave or as soon as possible (13 §). Status: checked on primary source; the 7 § wording is marked to cease on 1 July 2028 and the new wording was not read ([Föräldraledighetslag (1995:584)](https://rkrattsbaser.gov.se/sfst?bet=1995:584)).

**[DURABLE]** The Parental Leave Act, amended through SFS 2025:733 in the text read, also provides full leave until the child is 18 months (5 §), reduced hours (6–7 §§), early return (15 §), a ban on unfavourable treatment (16 §), dismissal protection (17 §) and damages (22 §). Status: section contents checked at heading level on lagen.nu ([Föräldraledighetslagen, lagen.nu](https://lagen.nu/1995:584)).

### Discrimination and the annual pay survey

**[DURABLE]** The Swedish Discrimination Act, amended through SFS 2025:736 in the text read, lists seven grounds (sex, transgender identity or expression, ethnicity, religion or other belief, disability, sexual orientation, age) and six forms of discrimination including inadequate accessibility and instructions to discriminate (1 kap. 4 §). It protects employees, applicants and enquirers, trainees and hired-in staff (2 kap. 1 §), imposes a duty to investigate and act on harassment (2 kap. 3 §), bans reprisals (2 kap. 18 §) and shifts the burden of proof (6 kap. 3 §). Status: checked on lagen.nu ([Diskrimineringslagen, lagen.nu](https://lagen.nu/2008:567)).

**[DURABLE]** The Discrimination Act requires an annual pay survey (3 kap. 8–10 §§), with written documentation of active measures for employers with 25 or more employees and of the pay survey for those with 10 to 24 (3 kap. 13–14 §§). Status: checked on lagen.nu ([Diskrimineringslagen, lagen.nu](https://lagen.nu/2008:567)).

### Pay transparency: no Swedish in-force date can be stated

**[CONTESTED] [FAST-MOVING, 21 July 2026]** Sweden missed the 7 June 2026 deadline for the EU Pay Transparency Directive. The Equality Ombudsman (DO) states that in March 2026 the government announced it would not for now present a bill, and that in early June 2026 it nevertheless tasked DO to continue preparations; how Swedish law will be shaped is not yet clear. Status: checked on DO's own page, updated 21 July 2026 ([DO](https://www.do.se/for-arbetsgivare-och-utbildningsanordnare/lonetransparens-och-jamstallda-loner/vad-ar-lonetransparensdirektivet)).

**[CONTESTED] [VENDOR] [FAST-MOVING, Jan–Mar 2026]** A January 2026 draft had proposed entry into force on 1 July 2026 with pay information to applicants, a ban on asking about pay history, an employee right to sex-disaggregated pay statistics for equal work, annual information on pay criteria, and pay reporting to DO for employers with 100 or more employees (annual at 250 or more). In March 2026 the government moved to postpone to 1 January 2027, with a first pay report on 20 May 2028, and to seek renegotiation of the directive; trade bodies report 1 January 2027 as expected. DO's page still shows directive-based reporting dates of 7 June 2027 for 150 or more employees and 7 June 2031 for 100 to 149. None of these dates is enacted Swedish law. Status: secondary sources only for the draft and the postponement, plus a government press release ([KPMG, January 2026](https://kpmg.com/se/en/insights/newsletters/legalnews/2026/regeringen-lagger-fram-lagradsremiss-om-lonetransparens.html); [TechSverige, March 2026](https://techsverige.se/en/2026/03/sverige-skjuter-upp-genomforandet-av-lonetransparensdirektivet-valkommet-besked/); [Almega, March 2026](https://www.almega.se/2026/03/reglerna-om-lonetransparens-skjuts-upp/); [Regeringen, March 2026](https://regeringen.se/pressmeddelanden/2026/03/regeringen-vill-omforhandla-lonetransparensdirektivet/)).

**[INFERENCE]** On pay transparency, prepare (pay-structure criteria, salary-range practice in recruitment, stop asking for pay history) but do not state a Swedish in-force date in any document, and re-check DO and regeringen.se monthly.

### Non-compete clauses

**[DURABLE]** Under section 38 of Avtalslagen a non-compete undertaking does not bind beyond what is reasonable, and the Labour Court applies section 38 as the starting point for employee non-competes (AD 2017 nr 38). Status: both checked on lagen.nu ([Avtalslagen, lagen.nu](https://lagen.nu/1915:218); [AD 2017 nr 38, lagen.nu](https://lagen.nu/dom/ad/2017:38)).

**[DURABLE]** The 2015 agreement between Svenskt Näringsliv and PTK, which applies to clauses agreed from 1 December 2015 for unions that adopted it, requires a balancing of interests, limits the restricted period to normally no more than 18 months absent special reasons, provides employer compensation during the restriction of up to 60% of previous monthly income, and stresses that non-competes are not meant for a wide circle of staff. Status: checked on the agreement text; whether the compensation formula is the difference between old and new income capped at 60% was not read in full ([Svenskt Näringsliv–PTK 2015](https://www.ptk.se/wp-content/uploads/2021/04/Svenskt-Naringsliv-PTK-2015-Avtal-Konkurrensklausuler-1.pdf)).

**[INFERENCE]** For employers not bound by it, the PTK agreement is still the benchmark courts look to when applying section 38, so the default for a non-compete is at most 18 months (shorter for most roles), compensation around 60% of salary, and key personnel only. Any non-compete outside that default goes to a human lawyer.

### Hiring from outside the EU: the work-permit salary floor

**[FAST-MOVING, 16 June 2026]** From 1 June 2026 a Swedish work permit requires a salary of at least 90% of the Swedish median at application: SEK 34,470 per month on a median of SEK 38,300 as updated 16 June 2026, with exempted categories needing at least 75% (SEK 28,725). Extensions for permits granted before 1 June 2026 use the old 80% rule (SEK 30,640) until 1 December 2026, and from 2 December 2026 the new requirement applies to them too. Status: checked on Migrationsverket's own pages ([Migrationsverket: Lönekrav](https://www.migrationsverket.se/ordforklaringar/lonekrav-for-arbetstillstand.html); [Migrationsverket: God försörjning](https://www.migrationsverket.se/ordforklaringar/god-forsorjning---forsorjningskrav-for-arbetstillstand.html)).

### Monitoring employees and handling employee data

**[DURABLE]** IMY states that employers must set and communicate rules for IT use, that monitoring must never be more intrusive than necessary, that individual-level checks need a GDPR legal basis and proportionality, and that employers normally may not read employees' private files or e-mail except on serious suspicion of disloyal or criminal conduct. Status: checked on the authority's own page ([IMY: Kontroll och övervakning av anställda](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/kontroll-och-overvakning-av-anstallda/)).

**[FAST-MOVING, since 1 April 2025]** Since 1 April 2025 no permit from IMY is needed for camera surveillance; the operator must itself document a balancing of interests and keep a register of surveillance, including any ended in the last five years. Cameras may not be used to routinely check how employees work, changing and break rooms and audio are as a rule off-limits, and a DPIA and a union negotiation may be required. Status: checked on the authority's own page ([IMY: Kontroll och övervakning av anställda](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/kontroll-och-overvakning-av-anstallda/)).

**[DURABLE]** Employees must be informed about processing of their data at collection, for example when logging starts, or within one month if the data come from another source. Status: checked on the authority's own page; the underlying Articles 13 and 14 were checked on primary source ([IMY: Information till anställda](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/tillaten-behandling--vilka-krav-galler/information-till-anstallda/)).

**[GAP]** Further employee-data points are unverified background, not fetched: that Sweden has no general employee-data act; that employee consent is rarely valid because of the power imbalance, so contract, legal obligation or legitimate interests with a documented balancing test are the usual bases; that the AI Act prohibits emotion recognition in the workplace (Article 5(1)(f)), classes AI for recruitment, task allocation, monitoring and evaluation as high-risk (Annex III point 4) and requires employers deploying a high-risk system to inform workers' representatives and affected workers first (Article 26(7)). Confirm on the texts before relying on them ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).

### Whistleblowing channels

**[DURABLE]** Under the Swedish Whistleblowing Act, lag (2021:890), an operator with 50 or more workers at the start of the calendar year must have internal reporting channels (5 kap. 2 §). The reporter must be able to report in writing and orally, receive an acknowledgment within seven days, and receive feedback on follow-up measures within three months of the acknowledgment (5 kap. 8 §). Those handling a case have a duty of confidentiality on identities (9 kap. 1 §), and supervisory orders may carry a conditional fine (10 kap. 4 §). Status: checked on primary source ([Lag (2021:890)](https://rkrattsbaser.gov.se/sfst?bet=2021:890)).

**[DURABLE]** Arbetsmiljöverket's guidance on the Whistleblowing Act adds that all employment forms, part-timers and staff on leave count towards the 50-worker threshold; that crossing 50 mid-year does not trigger the duty until the next year; and that private employers with 50 to 249 workers have been covered since 17 December 2023 and those with 250 or more since 17 July 2022. Status: checked on the authority's own pages ([Arbetsmiljöverket: Interna kanaler](https://www.av.se/arbetsmiljoarbete-och-inspektioner/lagar-och-regler-om-arbetsmiljo/visselblasarlagen/interna-kanaler-for-visselblasning/); [Arbetsmiljöverket: Visselblåsarlagen](https://www.av.se/arbetsmiljoarbete-och-inspektioner/lagar-och-regler-om-arbetsmiljo/visselblasarlagen/)).

**[DURABLE]** Channel requirements under Arbetsmiljöverket's guidance are designated independent and autonomous persons or units; written, oral and in-person reporting; clear information on internal and external reporting and on the reprisal ban; documentation of oral reports by recording with consent or by minutes the reporter can check; and, for private employers, keeping reports no longer than two years after the follow-up case is closed. Status: checked on the authority's own page ([Arbetsmiljöverket: Interna kanaler](https://www.av.se/arbetsmiljoarbete-och-inspektioner/lagar-och-regler-om-arbetsmiljo/visselblasarlagen/interna-kanaler-for-visselblasning/)).

**[DURABLE]** The whistleblowing channel may be used by employees, volunteers, trainees, persons working under the operator's direction such as agency staff, self-employed contractors, members of management and supervisory bodies, and active shareholders. Private operators with 50 to 249 workers may share channels and the receipt and investigation procedures, but not contact with the reporter. Status: checked on the authority's own page ([Arbetsmiljöverket: Interna kanaler](https://www.av.se/arbetsmiljoarbete-och-inspektioner/lagar-och-regler-om-arbetsmiljo/visselblasarlagen/interna-kanaler-for-visselblasning/)).

### Gaps in the employment research

**[GAP]** Not researched or not read: labour-law criteria for employee status and Skatteverket guidance; employer of record, agency-work law, permanent-establishment risk, social-security certificates and posting rules; the collective-agreement landscape for tech companies and occupational pension obligations; amendments to LAS after SFS 2022:836; the EU Platform Work Directive implementation, recalled as due in December 2026; minimum-wage developments; AD 2026 nr 40; sick pay, work-environment rules and remote-work rules; and any 2026 case law on the Whistleblowing Act.

## 9. Disputes and enforcement

### Limitation periods and how to interrupt them

**[DURABLE]** Under the Swedish Limitations Act, a claim is time-barred ten years after it arose unless limitation is interrupted first; the period is three years for a trader's claim against a consumer for goods, services or other benefits supplied for mainly private use, except claims based on negotiable promissory notes (2 §). Status: checked on primary source ([SFS 1981:130](https://rkrattsbaser.gov.se/sfst?bet=1981:130)).

**[DURABLE]** Limitation is interrupted when the debtor promises payment, pays interest or instalments or otherwise acknowledges the debt; when the debtor receives a written demand or written reminder from the creditor; or when the creditor brings proceedings or invokes the claim before a court, Kronofogden, arbitration, bankruptcy or reconstruction proceedings (5 §). After interruption by acknowledgment, demand or reminder, a new full period runs from the day of interruption (6 §); after legal proceedings, the new period runs from judgment or the end of the proceedings (7 §). Status: checked on primary source ([SFS 1981:130](https://rkrattsbaser.gov.se/sfst?bet=1981:130)).

**[DURABLE]** Limitation means the creditor loses the right to demand payment, and interest and guarantees fall with the principal (8 §); a time-barred claim may still be used for set-off in limited cases (10 §); and agreements that a claim shall not be time-barred are invalid (12 §). Status: checked on primary source ([SFS 1981:130](https://rkrattsbaser.gov.se/sfst?bet=1981:130)).

**[INFERENCE]** A collection routine that sends a written reminder restarts the ten-year, or three-year consumer, clock; keeping proof that the debtor received it matters, because 5 § turns on receipt.

### Special short deadlines to calendar

**[DURABLE]** The table below collects the short claim windows found in the research; agents calendar them at signature or at the triggering event. Each row carries its own verification status.

| Claim | Deadline | Verification | Source |
|---|---|---|---|
| Damages under TechSverige Molntjänster 2023 | Within six months of the damage (clause 18.3) | Read on licensee-hosted copy | [Molntjänster 2023, copy](https://nssonab.se/wp-content/uploads/2025/01/Molntjanster-Allmanna-bestammelser-2023.pdf) |
| Employee's invalidity claim; employee's damages claim under LAS | Two weeks; four months | Checked on primary source | [LAS](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/) |
| Holiday-pay claims | Two years after the holiday year | Checked on lagen.nu | [Semesterlagen, lagen.nu](https://lagen.nu/1977:480) |
| Trade-secret damages | Only for the last five years before suit | Checked on primary source | [Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/) |
| Company claim against a director based on a financial year's decisions | One year from presentation of accounts and audit report; outer limit five years from the end of the financial year | Checked on primary source | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| Buyer's defect notice under Köplagen | Reasonable time; right lost after two years from receipt | Checked on primary source | [SFS 1990:931](https://rkrattsbaser.gov.se/sfst?bet=1990:931) |
| Opposition to a Swedish trademark registration | Three months from publication | Checked on primary source | [Varumärkeslag (2010:1877)](https://rkrattsbaser.gov.se/sfst?bet=2010:1877) |
| Employer's claim to an employee invention | Four months from the employee's notice | Checked on primary source | [SFS 1949:345](https://rkrattsbaser.gov.se/sfst?bet=1949:345) |

### Payment orders at Kronofogden

**[FAST-MOVING, Nov 2026]** Kronofogden charges SEK 300 to apply for a payment order (betalningsföreläggande), a European payment order, or ordinary or special assistance (handräckning). Status: checked on the authority's own page, November 2026 ([Kronofogden: Avgifter och kostnader](https://kronofogden.se/kontakta-oss/avgifter-och-kostnader)).

**[FAST-MOVING, Nov 2026]** In payment-order cases the applicant's recoverable costs are the SEK 300 application fee plus compensation for own work or representation, which may exceed SEK 380 only for special reasons; a contested case can be handed over to the district court, where an additional court fee applies and cost exposure is higher than if the claim is admitted at Kronofogden. Status: checked on the authority's handbook ([Kronofogden: Handbok summarisk process](https://www.kronofogden.se/download/18.4d3e9d9a18be02f5b2a367/1700733280711/Handbok%20f%C3%B6r%20summarisk%20process.pdf)).

### District court fees and costs

**[FAST-MOVING, 2026]** The district court application fee is SEK 900 if the value is at most half a price base amount (at most SEK 29,600 in 2026) and otherwise SEK 2,800; a case transferred from Kronofogden attracts a top-up of SEK 600 or SEK 2,500 respectively. Status: checked on the courts' own page; the 2027 price base amount, which changes the threshold from 1 January 2027, was not checked ([Sveriges Domstolar](https://www.domstol.se/amnen/tvist-om-pengar/sa-hanteras-ett-tvistemal-i-tingsratten/)).

**[DURABLE]** In Swedish civil litigation the loser, or a party who withdraws or sues unnecessarily, can be ordered to pay the other side's litigation costs; in simplified small-claims cases of at most half a price base amount, recoverable costs are restricted, for example for legal representation. Status: checked on the courts' own page ([Sveriges Domstolar](https://www.domstol.se/amnen/tvist-om-pengar/sa-hanteras-ett-tvistemal-i-tingsratten/)).

### A collection ladder for routine receivables

**[INFERENCE]** Collection ladder for routine B2B receivables: invoice with interest terms; reminder; written demand or collection letter, which adds SEK 180 or the SEK 450 flat compensation and, once received by the debtor, interrupts limitation; a Kronofogden payment order if undisputed; and the district court if contested. Agents can draft the first three steps; a human decides on court or arbitration. Fee levels are from the government business portal as read November 2026 ([verksamt.se](https://verksamt.se/avtal-fakturering/betalningspaminnelse-och-drojsmalsranta)).

**[INFERENCE] [CONTESTED]** An arbitration clause blocks the ordinary court route for disputed claims and can make small debts uneconomic to pursue, so templates should consider carving out undisputed payment claims or small claims to Kronofogden and the district court. Whether Kronofogden will handle a claim covered by an arbitration clause if the debtor objects was not verified, so a human lawyer decides.

### Gaps in the disputes research

**[GAP]** Not retrieved: the debt-collection act and good debt-collection practice; requirements for a formal demand letter and the content of a payment-order application; Kronofogden's enforcement fee, the debtor's response time and the effect of a ruling; the European Small Claims Procedure; Brussels I recast jurisdiction rules; enforcement of arbitral awards; interim measures outside trade-secret cases; and Patent- och marknadsdomstolen routes for intellectual-property and marketing disputes.

## 10. Privacy: GDPR, Swedish law, IMY practice, cookies

### Verification note for the privacy section

**[DURABLE]** The GDPR articles in this section were read in the Official Journal text of Regulation (EU) 2016/679 in November 2026 and are "checked on primary source" unless a paragraph says otherwise ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). The Swedish supplementary act, Dataskyddslagen (2018:218), the cookie rule in LEK (2022:482) and PTS cookie practice were not read and appear only as unverified background.

### Operating rule while the Digital Omnibus is pending

**[INFERENCE] [FAST-MOVING, 11 Nov 2026]** GDPR is unchanged in law in November 2026. The safe operating rule for agents is the current one: 72 hours for breach notification, one month for data-subject requests, and consent for non-essential cookies. The proposed 96-hour breach clock and cookie exemptions in the Digital Omnibus are not yet usable (see the pending-change paragraphs at the end of this section).

### Lawful bases

**[DURABLE]** GDPR Article 6(1) lists six lawful bases: (a) consent for specific purposes; (b) necessity for a contract with the data subject or pre-contract steps at their request; (c) a legal obligation on the controller; (d) vital interests; (e) a public-interest task or official authority; and (f) legitimate interests of the controller or a third party. Status: checked on primary source; the additional conditions for special-category data in Article 9 and the restriction on criminal-offence data in Article 10 are unverified background ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Privacy notices

**[DURABLE]** When data are collected from the person, GDPR Article 13(1) requires the controller to give its identity and contact details, the data protection officer's contact details, the purposes and legal basis, the legitimate interests relied on, the recipients or categories of recipients, and any third-country transfers with the safeguard relied on and how to get a copy. Article 13(2) adds the retention period or criteria, the data-subject rights, the right to withdraw consent, the right to complain to a supervisory authority, whether providing data is a statutory or contractual requirement and the consequences of not providing it, and the existence of automated decision-making including profiling with meaningful information about the logic and consequences. The information is due at the time the data are obtained. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** When data come from elsewhere, GDPR Article 14(3) requires the information within a reasonable period and at the latest one month, or at the first communication with the person, or at first disclosure to another recipient; Article 14(5) lists exceptions, including where the person already has the information. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Data-subject requests

**[DURABLE]** Under GDPR Article 12(3) to (5), the controller must inform the person of any extension, with reasons, within one month of receipt of a request; if it takes no action it must say why within one month; and information and action are free of charge. Status: checked on primary source. The list of rights in Articles 15 to 22, the two-month extension for complex or numerous requests and the exception for manifestly unfounded or excessive requests are unverified background ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Records of processing

**[DURABLE]** GDPR Article 30(1) requires the controller's record to contain its name and contacts (and the data protection officer's), the purposes, the categories of data subjects and data, the categories of recipients, third-country transfers, envisaged erasure time limits where possible and a general description of security measures where possible. Under Article 30(2) processors keep a record of the categories of processing done for each controller, transfers and security measures; under Article 30(3) records are in writing, including electronic form. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** Under GDPR Article 30(5), organisations with fewer than 250 employees are exempt from records of processing unless the processing is likely to result in a risk, is not occasional, or includes special-category or criminal-offence data. Status: checked on primary source. The researchers infer that the exemption rarely helps a SaaS company, because its processing is not occasional ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Security

**[DURABLE]** GDPR Article 32(1) requires appropriate measures according to risk, including as appropriate pseudonymisation and encryption, ongoing confidentiality, integrity, availability and resilience, timely restoration after an incident, and regular testing. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Breach notification

**[DURABLE]** Under GDPR Article 33, the controller notifies the supervisory authority without undue delay and where feasible within 72 hours of becoming aware of a personal-data breach, unless the breach is unlikely to result in a risk; a late notification must give reasons; and the processor notifies the controller without undue delay. The notification must describe the nature of the breach with approximate numbers, a contact point, likely consequences and measures taken or proposed; information may be given in phases; and every breach must be documented. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** Under GDPR Article 34(1), the controller must tell the affected individuals without undue delay where the breach is likely to result in a high risk. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Data protection impact assessments

**[DURABLE]** GDPR Article 35(1) and (3) require a data protection impact assessment before processing likely to result in a high risk, in particular for (a) systematic and extensive automated evaluation, including profiling, on which decisions with legal or similarly significant effects are based; (b) large-scale processing of special-category or criminal-offence data; and (c) large-scale systematic monitoring of publicly accessible areas. Under Article 35(7) the minimum content is a description of the processing and purposes, a necessity and proportionality assessment, a risk assessment, and the measures to address the risks; under Article 36(1) the controller consults the authority first if the assessment shows high risk without mitigation. Status: checked on primary source; IMY's national list of processing that requires an assessment was seen only as a menu entry ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Data protection officer

**[DURABLE]** Under GDPR Article 37(1) a data protection officer is mandatory for (a) public authorities and bodies; (b) core activities that require regular and systematic monitoring of data subjects on a large scale; and (c) core activities consisting of large-scale processing of special-category or criminal-offence data. This applies to processors as well as controllers. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### International transfers

**[DURABLE]** GDPR transfers outside the EEA need an adequacy decision (Article 45); otherwise appropriate safeguards under Article 46(2), namely a public-body instrument, binding corporate rules, Commission standard clauses, authority-adopted standard clauses approved by the Commission, or an approved code of conduct or certification with binding commitments; and failing both, the Article 49(1) derogations of explicit informed consent, contract necessity, important public interest, legal claims, vital interests and public registers. Status: checked on primary source; the 2021 standard contractual clauses decision and the practice of transfer impact assessments are unverified background ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [Decision (EU) 2021/914](https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj)).

### EU–US Data Privacy Framework: valid, under appeal

**[FAST-MOVING, 31 Oct 2025]** The General Court ruled in T-553/23 Latombe v Commission on 3 September 2025, and the appeal C-703/25 P was brought on 31 October 2025. Status: checked on the Official Journal notice ([OJ C/2025/6610](https://eur-lex.europa.eu/eli/C/2025/6610/oj/eng)).

**[VENDOR] [FAST-MOVING, 2025–June 2026]** According to a law-firm briefing, the General Court dismissed the annulment action and confirmed adequacy, and the appeal targets the independence of the Data Protection Review Court and bulk collection without prior authorisation; companies are told to keep applying Chapter V, map transfers and keep transfer impact assessments and fallback tools ready. A report dated 28 June 2026 says the appeal is pending and that the Court of Justice admitted Microsoft as an intervener in support of the Commission; no hearing date, Advocate General opinion or judgment date is given. Status: secondary sources only; the Court's own register was not consulted and nothing after June 2026 was found ([Baker McKenzie](https://connectontech.bakermckenzie.com/eu-us-data-privacy-framework-still-business-as-usual/); [IEU Monitoring, 28 Jun 2026](https://ieu-monitoring.com/editorial/microsoft-backs-eu-commission-in-eu-court-case-on-transatlantic-data-flows-and-privacy/1244467/)).

**[FAST-MOVING, 3 July 2026]** On 3 July 2026, after the US Supreme Court's Trump v. Slaughter ruling that a president may remove an FTC commissioner without cause, IMY said the adequacy decision for the US remains in force, that the EDPB will analyse the consequences, and that organisations should stay informed and be prepared, for example to bring data back from suppliers, if the decision is later annulled. Status: checked on the authority's own page ([IMY, 3 Jul 2026](https://www.imy.se/nyheter/amerikansk-dom-kan-paverka-overforingar-till-usa/)).

**[INFERENCE]** Treat reliance on the Data Privacy Framework as revocable: keep standard contractual clauses signed as a fallback with every US vendor, and add a standing fallback item to vendor reviews recording whether clauses are already in place behind each framework-reliant transfer and whether data can be repatriated. That the framework covers only self-certified US recipients, to be checked per vendor, is unverified background ([Decision (EU) 2023/1795](https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj)).

### Fines

**[DURABLE]** Under GDPR Article 83(4) and (5), fines reach up to EUR 10 million or 2% of worldwide annual turnover, whichever is higher, for breaches of controller and processor obligations in Articles 8, 11, 25 to 39, 42 and 43, and up to EUR 20 million or 4% for breaches of the basic principles and the other items listed in paragraph 5. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Swedish supplementary law: unverified

**[GAP]** The following points about Dataskyddslagen (2018:218) are unverified background, not fetched, and must be confirmed before use: a child's consent for information-society services is valid from age 13 (2 kap. 4 §); personal identity numbers may be processed without consent only when clearly justified by the purpose, the need for secure identification or another notable reason (3 kap. 10 §); private bodies need a specific legal ground, regulation or IMY decision to process criminal-offence data (3 kap. 8–9 §§), which matters for background checks and sanctions or fraud screening; fines on public authorities are capped at SEK 5 million and SEK 10 million (6 kap. 2 §); and GDPR does not apply where it would conflict with the constitutional freedom-of-expression laws (1 kap. 7 §) ([SFS 2018:218](https://rkrattsbaser.gov.se/sfst?bet=2018:218)).

### IMY enforcement pattern

**[VENDOR] [FAST-MOVING, 2025 data]** A law firm's enforcement review counts IMY decisions against legal persons at 37 in 2023, 86 in 2024 and 153 in 2025, with fines numbering 12 in 2023 (SEK 50,000 to SEK 58 million), 5 in 2024 (SEK 60.58 million in total) and 3 in 2025; reprimands were about 61% of 2025 decisions and orders about 27%. The firm notes it did not independently verify the authority data. The same review describes IMY supervision as complaint-based, risk-based or planned. Status: secondary source only ([Vinge, Contentious Regulatory 2026](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

**[FAST-MOVING, 26 Jan 2026]** IMY fined Sportadmin i Skandinavien AB SEK 6,000,000 (about EUR 566,000) in a final decision of 26 January 2026 for breach of Article 32(1). An attacker took data on more than 2.1 million people, mainly children and young people, including identity numbers, some health data and protected-identity data; IMY found known but insufficiently fixed weaknesses, no routine to detect security gaps and no real-time intrusion detection. Status: checked on the EDPB's news item from the Swedish authority; the decision PDF was not opened ([EDPB news](https://www.edpb.europa.eu/news/swedish-sa-administrative-fine-against-sportadmin_fi)).

**[FAST-MOVING, 22 Sept 2026]** On 22 September 2026 IMY fined Miljödata i Karlskrona AB SEK 1.8 million for breach of Article 32(1). The August 2025 intrusion affected 2.2 million people according to the company and included sickness-absence and rehabilitation data; IMY found insufficient checks when installing new software and no automatic real-time monitoring for intrusions, and found the company negligent. Reviews of two municipalities and a region that were its customers are still open. Status: checked on the authority's own news item; the decision itself was not opened ([IMY, 22 Sep 2026](https://www.imy.se/nyheter/sanktionsavgift-mot-miljodata-for-bristande-sakerhet/)).

**[INFERENCE]** The Miljödata decision is the closest Swedish precedent for a B2B software supplier, because the fine was imposed on the supplier itself. The news item does not say whether Miljödata was treated as controller or processor, so the decision must be read before it is used to argue processor exposure. The two failings IMY named, change control for new software and real-time intrusion monitoring, are concrete items for the company's own controls.

**[FAST-MOVING, 3 Nov 2026]** On 3 November 2026 IMY issued reprimands to four people-search services. Lexbase (Legal Newsdesk Sweden AB) and Krimfup (Fuplex AB) processed criminal-offence data without legal support and were ordered to stop such data being found by name, identity number or address; MrKoll (Nusvar AB) and Upplysning (Upplysning Checknode AB) failed to honour erasure requests. IMY held that the Swedish exemption for voluntary publishing certificates goes further than EU law allows and that EU law takes precedence; it had received about 3,800 complaints. Status: checked on the authority's own news item ([IMY, 3 Nov 2026](https://www.imy.se/nyheter/soktjanster-behandlar-personuppgifter-pa-otillatet-satt/)).

**[FAST-MOVING, 2026]** The table below lists IMY and EDPB items from 2026 that were seen only as feed headlines and summaries; agents treat each as a lead to open, not as a verified finding. Status: headline only, from IMY's news feed ([IMY news feed](https://www.imy.se/nyheter/rss)).

| Date (2026) | Item as headlined | Status | Source |
|---|---|---|---|
| 7 May | Supervision opened against Region Gävleborg's AI transcription in primary care | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 11 May | IMY asked the government to rename it Dataskyddsmyndigheten | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 10 Jun | IMY report on controller and processor roles for companies that fine-tune AI applications; the role depends on the company's influence over the processing | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 11 Jun | EDPB adopted a common template for personal-data breach notification | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 16 Jun | IMY criticised Securitas Sverige AB for in-vehicle camera monitoring of drivers using image analysis and, for a period, recording | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 8–9 Jul | EDPB adopted guidelines on web scraping for training generative AI (IMY lead rapporteur) and guidelines on anonymisation | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 9 Jul | CJEU judgment on a Swedish search service with a voluntary publishing certificate | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 21 Sep | EDPB adopted guidelines on the method for deciding when to impose administrative fines | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 30 Sep | Review opened of ICA's drug testing of job applicants | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 20 Oct | IMY is preparing guidance on cloud services in the public sector and has questioned 19 public bodies | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |
| 5 Nov | Review opened of Arbetsförmedlingen's AI system for assessing jobseekers | Headline only | [IMY news feed](https://www.imy.se/nyheter/rss) |

**[GAP]** Earlier IMY fines often used as benchmarks are held only as unverified background with amounts from memory: Spotify SEK 58 million (2023), Trygg-Hansa SEK 35 million (2023), Apoteket SEK 37 million and Apohem SEK 8 million (2024, Meta pixel), Avanza SEK 15 million (2024, Meta pixel), Bonnier News SEK 13 million (2023) and Klarna SEK 7.5 million (2022). Confirm each on IMY's site before citing ([IMY tillsyner](https://www.imy.se/tillsyner/)).

**[INFERENCE]** IMY's pattern of many reprimands and orders, few fines, and the largest fines for security lapses and tracking-pixel leaks suggests the main exposure for a Swedish SaaS vendor is Article 32 security, tracking technologies and data-subject request handling, not paperwork gaps alone. Sportadmin also shows that IMY weighs children's data and protected identities heavily when assessing security failures.

### Cookies and electronic marketing

**[GAP]** The Swedish cookie rule is unverified background, not fetched: storing or reading information on a user's device requires prior consent after clear information, except what is strictly necessary for the requested service or transmission (LEK 2022:482, 9 kap. 28 §, implementing ePrivacy Article 5(3)), with the GDPR consent standard, PTS supervising the cookie rule itself and IMY the personal-data processing that follows. PTS cookie supervision practice and any 2026 cookie guidance could not be retrieved in either research round ([SFS 2022:482](https://rkrattsbaser.gov.se/sfst?bet=2022:482)).

**[VENDOR] [FAST-MOVING, 2025 data]** PTS issued 12 orders and 2 fines under LEK in 2025, the fines being SEK 8.1 million and SEK 100,000; the source does not say how many concerned cookies. Status: secondary source only ([Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

**[DURABLE]** Under Marknadsföringslagen 19 §, marketing to a natural person by e-mail, fax or automated calling requires prior consent, with one exception: the address was obtained in connection with a sale to that person, the person has not objected, the marketing concerns the trader's own similar products, and a clear, free and easy opt-out is offered at collection and in every message. Under 20 §, every marketing e-mail must contain a valid address for opt-out requests, including when sent to legal persons. Status: checked on primary source ([SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486)).

### Children's data

**[GAP]** Beyond the Sportadmin decision, the children's-data rules are unverified background: GDPR Article 8 with the Swedish age of 13, child-appropriate notices, and DSA Article 28's duties for online platforms accessible to minors, including a ban on profiling-based advertising to known minors ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

### Pending: the Digital Omnibus on data, GDPR and ePrivacy is not law

**[VENDOR] [FAST-MOVING, 21 Oct 2026]** The Digital Omnibus proposal on data, GDPR, ePrivacy and cybersecurity, COM(2025) 837 of 19 November 2025, is separate from the AI Omnibus adopted in July 2026 and is still in the legislative process. Coreper approved the Council's negotiating mandate on 21 October 2026 (document 14756/26, published 22 October). Status: secondary source only ([Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position)).

**[VENDOR] [CONTESTED] [FAST-MOVING, 21 Oct 2026]** The Council position on the Digital Omnibus, as reported, rejects the Commission's relative redefinition of personal data and adds an Article 25a on pseudonymised data instead; keeps an express reference to legitimate interests for AI development and operation, but with the ordinary objection right and a recital that AI development is not automatically a legitimate interest; requires the controller to prove abusive intent to refuse a data-subject request; keeps the proposed 96-hour breach deadline and a high-risk notification threshold; has the EDPB, not the Commission, approve DPIA and breach lists; keeps cookie rules in ePrivacy Article 5(3) with consent exemptions for audience and contextual-advertising measurement and a four-month no-re-ask period after refusal (the Commission proposed six); deletes the browser-signal obligations; prefers national single entry points for incident reporting; keeps the P2B Regulation; and strengthens the Data Act trade-secret safeguard. Status: secondary source only ([Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position)).

**[VENDOR] [FAST-MOVING, Aug–Oct 2026]** In the European Parliament the Digital Omnibus is a joint ITRE and LIBE file with co-rapporteurs Aura Salla and Marina Kaljurand and up to 1,840 amendments; a committee vote is targeted before February 2027 with no formal date, and trilogues cannot start until Parliament adopts a position. Status: secondary sources only ([EU Perspectives, Aug 2026](https://euperspectives.eu/2026/08/after-1840-amendemnts-the-eu-fight-over-data-will-begin/); [Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position)).

**[INFERENCE]** Both the Council and Commission texts keep a 96-hour clock and a high-risk threshold, so that change looks likely to survive, while the personal-data definition and the AI legitimate-interest wording are the contested items. The earliest realistic adoption is 2027; that is the researchers' estimate and not a sourced date.

### Minimum privacy pack for a small SaaS and AI company

**[INFERENCE]** Minimum privacy pack: a record of processing; privacy notices for customers, website visitors, employees and candidates; a DPA template as processor, with a sub-processor list and a change-notice mechanism; vendor DPAs; a transfer register with the clauses or framework basis and transfer impact assessments; a DPIA procedure, always used for AI features processing personal data at scale; a breach register and 72-hour playbook; a data-subject request procedure with a 30-day tracker; a retention schedule; a cookie consent tool; and a decision memo on whether to appoint a data protection officer.

### Gaps in the privacy research

**[GAP]** Not retrieved: PTS cookie practice; the IMY decisions themselves, so fine calculations and reasoning are unverified beyond press items; IMY's AI guidance pages and DPIA list; Dataskyddslagen; EDPB 2025–2026 guidelines; and whether Swedish camera-surveillance or employee-monitoring rules changed in 2026.

## 11. AI regulation: the EU AI Act as amended and the Swedish supervisory set-up

### The amending regulation and its dates, verified on the Official Journal text

**[FAST-MOVING, 24 July 2026]** Regulation (EU) 2026/1744, the Digital Omnibus on AI, was adopted on 8 July 2026 and published in the Official Journal on 24 July 2026. It amends Regulations (EU) 2024/1689 (the AI Act), 2018/1139 and 2023/1230 and entered into force on the third day after publication, 27 July 2026 (Article 4). Status: checked on primary source; the regulation was read selectively, and the detailed changes to Articles 6, 10, 49 and 50(7), the new Articles 4a and 60a and the AI Office supervision powers were not read through ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Under the new Article 113 of the AI Act, the high-risk requirements in Chapter III Sections 1 to 3 apply from 2 December 2027 for systems classified under Article 6(2) and Annex III, and from 2 August 2028 for systems classified under Article 6(1) and Annex I. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Chapters I and II of the AI Act apply from 2 February 2025, except the new prohibitions in Article 5(1) points (ba) and (bb) and Article 5(1a) and (1b), which apply from 2 December 2026. The new prohibitions cover AI systems that generate or manipulate realistic intimate or sexually explicit material of an identifiable person without that person's explicit consent (ba), and child sexual abuse material (bb), subject to the conditions in paragraphs 1a and 1b. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Under the new Article 111(4) of the AI Act, providers of generative systems placed on the market before 2 August 2026 must comply with the Article 50(2) marking duty by 2 December 2026. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Under Article 111(2) of the AI Act as replaced, high-risk systems already on the market before Chapter III applies are caught only if significantly changed in design after that date, and providers and deployers of high-risk systems intended for public authorities must comply by 2 August 2030. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Article 4 of the AI Act on AI literacy is replaced: providers and deployers must take measures to support the development of AI literacy of staff and others operating AI on their behalf, and the text states that this does not require guaranteeing any specific level of literacy for any individual. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[FAST-MOVING, 24 July 2026]** Other verified changes in Regulation (EU) 2026/1744: small mid-cap enterprises are added alongside SMEs, defined by reference to Recommendation (EU) 2025/1099, and under the new Article 99(6a) each fine for a small mid-cap is capped at the lower of the percentage or the amount; each Member State's national AI sandbox must be operational by 2 August 2027 (Article 57); the Commission must adopt delegated acts by 2 August 2027 on limiting overlapping requirements for Annex I Section A products (new Article 2(13)); the Machinery Regulation moves from Annex I Section A to Section B; and Articles 102 to 110 apply from 27 July 2026. Status: checked on primary source ([Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

**[VENDOR] [FAST-MOVING, July 2026]** Law-firm alerts add points about the AI Omnibus that were not confirmed on the text: Parliament adopted it on 16 June 2026 and the Council on 29 June 2026; registration of self-assessed non-high-risk systems is retained in lighter form; special-category data may be processed for bias detection and correction by providers and deployers of all AI systems and models under a strict-necessity test; small mid-caps get simplified documentation and a proportionate quality-management system; the notion of safety component is narrowed; and the AI Office gains supervision of AI systems built on the same provider's general-purpose model and of AI in very large platforms and search engines, with inspection and fining powers. Status: secondary sources only ([Freshfields](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/eu-ai-act-unpacked-34-the-final-digital-omnibus-on-ai-key-amendments-to-the-a-102nber); [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement); [White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act)).

### Timeline table for the AI Act

**[FAST-MOVING, 11 Nov 2026]** The table below is the AI Act timeline as the research leaves it on 11 November 2026, with the verification status of each date.

| Date | What applies | Verification | Source |
|---|---|---|---|
| 2 Feb 2025 | Chapters I and II: original prohibited practices and AI literacy | Checked on primary source (new Article 113(a)) | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Aug 2025 | General-purpose AI model obligations, governance, penalties framework | Unverified background, not fetched | [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) |
| 2 Aug 2026 | General application including Article 50 transparency duties; Commission enforcement powers over general-purpose models | Secondary source only for Article 50 start; otherwise unverified background | [White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act) |
| 2 Dec 2026 | Article 50(2) marking for generative systems on the market before 2 Aug 2026; new prohibitions (ba) and (bb) | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Feb 2027 | Watermark-detection interoperability for signatories of the transparency code | Secondary source only | [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations) |
| 2 Aug 2027 | National AI sandboxes operational; Commission delegated acts on Annex I overlaps; general-purpose models placed on the market before 2 Aug 2025 must comply (last item unverified background) | Checked on primary source for the first two | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Dec 2027 | High-risk requirements for Annex III systems | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Aug 2028 | High-risk requirements for Annex I product-embedded systems | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Aug 2030 | High-risk systems intended for public authorities | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |

### Roles, prohibited practices and high-risk duties: orientation only

**[GAP]** The role definitions in the AI Act are unverified background, not fetched: a provider develops, or has developed, an AI system or general-purpose model and places it on the market or puts it into service under its own name; a deployer uses an AI system under its authority in a professional capacity; a deployer or distributor becomes a provider of a high-risk system if it rebrands it, substantially modifies it or changes its intended purpose to a high-risk one (Article 25); and the Act reaches output used in the EU (Article 2). On that reading a SaaS company embedding a third-party model in its own product is normally the provider of that AI system and a downstream user of the model. Confirm on the text before classifying a product ([AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).

**[GAP]** The original prohibited practices in Article 5 are unverified background: harmful subliminal or manipulative techniques; exploiting vulnerabilities; social scoring; individual predictive policing based on profiling; untargeted facial-image scraping; emotion recognition at work and in education; biometric categorisation inferring sensitive traits; and real-time remote biometric identification by law enforcement with narrow exceptions. The two 2026 additions are verified above ([AI Act, Article 5](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).

**[GAP]** The high-risk duties that start on 2 December 2027 and 2 August 2028 are unverified background. For providers: risk management (Article 9), data governance (10), technical documentation (11), logging (12), instructions and transparency (13), human oversight (14), accuracy, robustness and cybersecurity (15), quality management (17), conformity assessment, declaration, CE marking and registration (Articles 43 to 49), and post-market monitoring and serious-incident reporting (72 and 73, with a 15-day reporting period recalled for serious incidents). For deployers under Article 26: use per instructions, competent human oversight, relevant input data, monitoring and keeping logs at least six months, informing workers and affected persons, suspension and reporting on risk, and a fundamental-rights impact assessment for public bodies and certain private deployers (Article 27). Annex III areas are recalled as biometrics; critical infrastructure; education; employment and worker management; essential private and public services such as credit scoring and insurance pricing; law enforcement; migration; and administration of justice and democratic processes, with Article 6(3) letting a provider document that an Annex III system is not high-risk, never where it profiles individuals ([AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).

**[GAP]** General-purpose AI model obligations are unverified background: technical documentation, information for downstream providers, a copyright-compliance policy honouring machine-readable rights reservations and a public training-content summary (Article 53), with extra duties for systemic-risk models (Article 55), a voluntary Code of Practice published 10 July 2025, and fines up to EUR 15 million or 3% (Article 101) enforceable by the Commission from 2 August 2026 ([AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj); [Commission: GPAI Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai)).

### Article 50 transparency: duties, code and guidelines

**[GAP]** The content of Article 50 is unverified background, not fetched: under 50(1) people must be told they are interacting with an AI system unless obvious; under 50(2) providers of generative systems mark outputs in a machine-readable way; under 50(3) deployers of emotion-recognition or biometric-categorisation systems inform those exposed; and under 50(4) deployers label deepfakes, and AI-generated text published to inform the public on matters of public interest unless it was human-reviewed under editorial responsibility ([AI Act, Article 50](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).

**[VENDOR] [FAST-MOVING, June–July 2026]** The final Code of Practice on marking and labelling AI-generated content was published on 10 June 2026. It is voluntary, has a provider section for Article 50(2) and a deployer section for Article 50(4), and describes multi-layer marking (for example signed metadata plus an imperceptible watermark), detection tools, and an EU icon or equivalent label. Status: secondary source only ([Jones Day](https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content)).

**[VENDOR] [FAST-MOVING, July 2026]** The Commission and the AI Board confirmed the transparency Code as adequate in early July 2026, and final Article 50 Guidelines were published on 20 July 2026, replacing a May 2026 draft. The Code is not a safe harbour; it covers Article 50(2), (4) and (5), while 50(1) and 50(3) are addressed only in the Guidelines. Signatories need watermark-detection interoperability by 2 February 2027. Content generated before 2 August 2026 generally needs no retroactive marking, but public-interest text published on or after that date must be labelled unless the editorial exception applies. Fines are reported as up to EUR 15 million or 3%. Status: secondary source only ([Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

### Penalties

**[FAST-MOVING, Oct 2025]** A Swedish government inquiry press release of 6 October 2025 repeats the AI Act penalty tiers of EUR 35 million or 7% for prohibited practices and EUR 15 million or 3% for most other obligations, and proposes sanctions also against public bodies. Status: the two tiers are confirmed on the government's own press release; the third tier (EUR 7.5 million or 1% for incorrect information to authorities) and the rule that the lower figure applies for SMEs are unverified background; the small mid-cap rule in Article 99(6a) is checked on primary source ([Regeringen, 6 Oct 2025](https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/); [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)).

### The Swedish supervisory set-up: five authorities, mandate ending 31 December 2026

**[FAST-MOVING, 4 June 2026]** By government decision of 4 June 2026 (Fi2026/01365), PTS, IMY, Finansinspektionen, Läkemedelsverket and Swedac are Sweden's national competent authorities under Article 70(1) of the AI Act, and the assignment runs until 31 December 2026. Status: checked on primary source ([Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf)).

**[FAST-MOVING, 4 June 2026]** The table below gives the allocation of AI Act supervision in the Swedish government decision of 4 June 2026. Status: every row checked on primary source.

| Authority | Allocation in the 4 June 2026 decision | Source |
|---|---|---|
| PTS | Market surveillance for prohibited practices and high-risk systems in Annex III points 2–4, 5(a) and 5(d); high-risk systems linked to radio equipment; the transparency duties in Article 50(1), (2) and (4); single point of contact; the national AI regulatory sandbox | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| IMY | Prohibited practices not covered by PTS or Finansinspektionen; high-risk systems in Annex III points 1, 5(b) outside Finansinspektionen's remit, and 6–8; Article 50(3) | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| Finansinspektionen | Annex III point 5(b) within its remit, and point 5(c) | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| Läkemedelsverket | High-risk AI in medical devices and in vitro diagnostics, and notifying authority for those | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| Swedac | Notifying authority otherwise | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |

**[FAST-MOVING, 15 June 2026]** IMY's own announcement confirms its market-surveillance role under the AI Act and that it will work with PTS and Finansinspektionen. Status: checked on the authority's own page ([IMY, 15 Jun 2026](https://www.imy.se/nyheter/imy-blir-marknadskontrollmyndighet-for-ai-forordningen/)).

**[FAST-MOVING, Oct 2025]** The background to the Swedish set-up is inquiry SOU 2025:101, "Anpassningar till AI-förordningen", delivered on 6 October 2025, which proposed PTS as main market-surveillance authority and Sweden's AI Board representative, shared roles for IMY and Finansinspektionen, new secrecy rules, a PTS-run sandbox and entry into force on 2 August 2026. Status: checked on the government's own pages ([Regeringen, 6 Oct 2025](https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/); [SOU 2025:101](https://regeringen.se/rattsliga-dokument/statens-offentliga-utredningar/2025/10/sou-2025101/)).

**[GAP] [FAST-MOVING, 11 Nov 2026]** Sweden has no permanent supplementary AI Act law that the research could find. A search of the Riksdag open-data register for 2026 statutes mentioning the AI Regulation returned only the act and ordinance on police use of real-time facial recognition (SFS 2026:806 and 2026:815); no act with supplementary provisions and no bill for one appeared, and no Swedish penalty levels or administrative-fine mechanism for AI Act breaches were found. Who supervises AI from 1 January 2027 is not settled in any document found. Continuation of the same allocation is the researchers' guess; check regeringen.se and the PTS and IMY sites in December 2026. Status of the search itself: checked on primary source ([Riksdagen open data](https://data.riksdagen.se/dokumentlista/?sok=AI-f%C3%B6rordning&doktyp=sfs&from=2026-01-01&utformat=json)).

**[INFERENCE]** Mapping the Swedish allocation to a SaaS and AI vendor, using Annex III numbering from memory (2 critical infrastructure, 3 education, 4 employment, 5 essential services, 6–8 law enforcement, migration, justice): PTS is the authority for HR and education use cases and for the chatbot-disclosure and synthetic-content marking duties; IMY for biometrics, law-enforcement-type uses and the emotion-recognition and biometric-categorisation notice duty; Finansinspektionen for credit scoring and insurance pricing within its remit.

### How a typical SaaS company with AI features is classified

**[INFERENCE]** A typical B2B SaaS company with AI features is a provider of limited-risk AI systems (chatbot disclosure, and marking if it generates synthetic content), a deployer of third-party tools internally (AI literacy measures, with HR tools potentially high-risk from December 2027), and not a general-purpose model provider unless it trains or fine-tunes and releases general-purpose models. This is the researchers' classification, to be confirmed per product by a human lawyer.

**[INFERENCE]** An AI Legal department is itself a deployer use case. On the researchers' reading of Annex III point 8, which targets AI used by or for judicial authorities, an in-house legal assistant is not high-risk on that ground, but the chatbot-disclosure duty still requires telling external people when they are dealing with an AI agent.

### AI liability

**[VENDOR] [FAST-MOVING, 24 June 2026]** The revised Product Liability Directive (EU) 2024/2853 covers software and AI, gives claimants disclosure rights and presumptions of defect and causation (Article 10(4)), broadens damage types, and has a transposition deadline of 9 December 2026; Hungary and Croatia had completed transposition by June 2026 and many states lagged. A law firm reports that the Swedish draft drops the word "excessive" from the Article 10(4)(a) presumption test, keeps the development-risk defence and omits the directive's reference to mandatory safety requirements in the defect test. Status: secondary source only; the directive was not opened. The Swedish bill and its 1 January 2027 date are covered in section 3 ([Faegre Drinker, 24 June 2026](https://www.faegredrinker.com/en/insights/publications/2026/6/transposing-the-eus-new-product-liability-directive-a-member-state-progress-report)).

**[GAP]** Unverified background on AI liability: the directive is recalled as excluding free non-commercial open-source software, with a 3-year limitation and 10-year long-stop (25 years for latent personal injury) and no contractual exclusion towards injured persons; and the proposed AI Liability Directive is recalled as withdrawn by the Commission in 2025, leaving fault-based AI liability to national tort law. Neither was re-checked ([Directive (EU) 2024/2853](https://eur-lex.europa.eu/eli/dir/2024/2853/oj); [Commission work programme 2025](https://commission.europa.eu/strategy-and-policy/strategy-documents/commission-work-programme/commission-work-programme-2025_en)).

### AI compliance action list by date

**[INFERENCE]** AI compliance action list. Now: an AI inventory with the company's role per system, AI literacy measures on file, a prohibited-practice screen, and chatbot disclosure. By 2 December 2026: marking for legacy generative features, and safeguards against the two new prohibited uses if image or video generation is offered. Before 1 January 2027: a product-liability and insurance review, and a check of who the Swedish AI authorities are after the assignment ends. By 2 February 2027: detection interoperability if the company signed the transparency code. By 2 December 2027: Annex III high-risk compliance for any in-scope product or internal HR tool.

### Gaps in the AI-regulation research

**[GAP]** Not checked: Commission guidelines on high-risk classification and the status of harmonised standards; the current signatory list of the general-purpose AI Code; the amendments Regulation (EU) 2026/1744 makes to Regulations 2018/1139 and 2023/1230; and the AI Act's own articles on roles, Article 50 content, penalties and high-risk duties, which were not re-read on the consolidated text.

## 12. Digital and data regulation

### Verification note for the digital-regulation section

**[DURABLE]** Outside the Cybersäkerhetslagen thresholds and duties (checked on Swedish authority pages), the DSA articles named in section 4 (checked on primary source), the Data Act application date (checked on PTS's page) and the Digital Fairness Act status (checked on the European Parliament's tracker), almost everything in this section is unverified background, not fetched, and is a map of where to look. Agents confirm each point on the linked text before relying on it.

### A decision tree for which digital regimes apply

**[INFERENCE]** Decision tree for agents. First, does the company store customer content? Then the DSA hosting duties (notice-and-action, statement of reasons) apply regardless of size. Second, does the company have 50 or more staff, or turnover and balance sheet each above EUR 10 million, and provide cloud, SaaS or managed services? Then Cybersäkerhetslagen registration and 24-hour, 72-hour and one-month reporting apply, and smaller vendors still receive these duties by contract from regulated customers. Third, is there any downloadable agent, plugin, SDK or on-premises component? Then the Cyber Resilience Act is in play. Fourth, can consumers buy online? Then the accessibility act and consumer law apply. Fifth, for every customer contract, the Data Act switching clauses apply now, with no exit fees from 12 January 2027.

### Digital Services Act tiers

**[GAP]** The DSA's tier structure beyond the articles verified in section 4 is unverified background: all intermediaries owe contact points, a legal representative if non-EU, clear terms on moderation and an annual transparency report (Articles 11 to 15); hosting services add notice-and-action, statements of reasons and reporting of suspected serious crimes (Articles 16 to 18); online platforms that disseminate to the public add complaints handling, trusted flaggers, a dark-pattern ban, advertising and recommender transparency and minors' protection (Articles 20 to 28); business-to-consumer marketplaces add trader traceability (Articles 30 to 32); and very large platforms with 45 million or more EU monthly users add risk assessments and audits. Micro and small enterprises are recalled as exempt from the platform tier and transparency reports but not from hosting duties, all platforms as publishing average monthly active recipients every six months (Article 24(2)), and fines as reaching 6% of worldwide turnover. PTS is recalled as Sweden's Digital Services Coordinator, with Konsumentverket and Mediemyndigheten sharing supervision ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

### Digital Markets Act

**[GAP]** The Digital Markets Act is unverified background: it applies only to designated gatekeepers (recalled thresholds of EUR 7.5 billion EEA turnover or EUR 75 billion market capitalisation, 45 million monthly end users and 10,000 yearly business users for a core platform service), and its relevance to a SaaS company is as a business user with rights to app-store alternatives, anti-steering freedom, data access and portability and fair access terms from gatekeepers (Articles 5 to 7) ([Regulation (EU) 2022/1925](https://eur-lex.europa.eu/eli/reg/2022/1925/oj)).

### Data Act beyond switching, and the Data Governance Act

**[GAP]** Beyond cloud switching (section 2), the Data Act is unverified background: connected-product access by design for products placed on the market after 12 September 2026; unfair business-to-business terms on data access and use that are unilaterally imposed being non-binding (Article 13); and safeguards against unlawful third-country government access to non-personal data (Article 32). A secondary source reports that the Council's October 2026 Digital Omnibus mandate would strengthen the trade-secret refusal mechanism and require quarterly reporting of refusals ([Regulation (EU) 2023/2854](https://eur-lex.europa.eu/eli/reg/2023/2854/oj); [Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position)).

**[GAP]** The Data Governance Act is unverified background: applicable since 24 September 2023 and relevant only if the company acts as a data-intermediation service, a data-altruism organisation or a re-user of protected public-sector data; the Commission's Digital Omnibus is recalled as proposing to merge it into the Data Act ([Regulation (EU) 2022/868](https://eur-lex.europa.eu/eli/reg/2022/868/oj)).

### Cybersäkerhetslagen (NIS2 in Sweden): thresholds and registration

**[FAST-MOVING, since 15 Jan 2026]** The Swedish Cybersäkerhetslagen entered into force on 15 January 2026, replacing the 2018 NIS law. Operators self-assess whether they are covered and register through the national notification service. The "important" threshold is at least 50 employees, or turnover and balance sheet each above EUR 10 million; "essential" is at least 250 employees, or turnover above EUR 50 million and balance sheet above EUR 43 million; group companies may be counted together. Essential operators are supervised proactively and important ones after indications of non-compliance; MCF regulations (MCFFS 2026:1) govern notification. Status: checked on a Swedish authority's own page, not on the statute ([Transportstyrelsen](https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/)).

### Cybersäkerhetslagen: duties and incident clocks

**[FAST-MOVING, 2026]** Duties under the Cybersäkerhetslagen are systematic risk-based security work, risk analysis, and technical, organisational and operational measures in at least ten areas (including incident handling, continuity, supply-chain security, cyber hygiene and training, cryptography, personnel security and access control), plus training of management and staff. Significant incidents require an initial notice within 24 hours, an incident report within 72 hours and a final report within one month after that, to MCF, which is to issue binding detailed regulations during 2026. Status: checked on a Swedish authority's own page ([Länsstyrelsen Västmanland](https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html)).

**[GAP]** Unverified background on NIS2 scope and sanctions: the sectors relevant to SaaS are recalled as digital infrastructure (cloud computing services, data centres, DNS, trust services), ICT service management (managed service and managed security providers) and digital providers; cloud and managed-service providers as falling under the Member State of main establishment and Commission Implementing Regulation (EU) 2024/2690; management as having to approve measures and being accountable (Article 20); fine ceilings as EUR 10 million or 2% for essential and EUR 7 million or 1.4% for important entities; and PTS as supervising digital infrastructure in Sweden. Swedish sanction amounts, the registration deadline and MCF's detailed regulations were not retrieved, and whether a given SaaS product meets the cloud definition needs case-by-case analysis by a human ([Directive (EU) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj); [SFS 2025:1506](https://rkrattsbaser.gov.se/sfst?bet=2025:1506)).

### Cyber Resilience Act

**[GAP]** The Cyber Resilience Act is unverified background, with dates from memory: in force 10 December 2024; vulnerability and incident reporting by manufacturers from 11 September 2026 (24-hour early warning, 72-hour notification, final report 14 days after a fix for exploited vulnerabilities); full application 11 December 2027; coverage of products with digital elements placed on the market, including downloadable software, apps and hardware and their remote data processing, with pure SaaS generally outside and handled by NIS2; fines up to EUR 15 million or 2.5%. Confirm on the regulation ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj)).

### European Accessibility Act

**[GAP] [VENDOR]** The European Accessibility Act is mostly unverified background: applicable since 28 June 2025 to listed consumer products and services including e-commerce; micro-enterprises providing services (under 10 staff and at most EUR 2 million turnover or balance sheet) exempt; service contracts concluded before 28 June 2025 able to run until 28 June 2030; purely business-to-business SaaS outside, but any consumer checkout or self-service purchase flow counting as e-commerce. A law-firm review confirms, as a secondary source, that the Swedish accessibility act entered into force on 28 June 2025 with PTS among its enforcers ([Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj); [SFS 2023:254](https://rkrattsbaser.gov.se/sfst?bet=2023:254); [Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

### eIDAS 2 and the EU Digital Identity Wallet

**[GAP]** eIDAS 2, Regulation (EU) 2024/1183, is unverified background: in force 20 May 2024; each Member State to offer at least one wallet around the end of 2026; private relying parties legally required to use strong user authentication, and very large online platforms, to accept the wallet around the end of 2027; relying parties to register. Sweden's wallet launch status and exact acceptance dates were not verified ([Regulation (EU) 2024/1183](https://eur-lex.europa.eu/eli/reg/2024/1183/oj)).

### Digital Fairness Act: announced, not proposed

**[FAST-MOVING, Nov 2026]** The European Parliament's Legislative Train page describes the Digital Fairness Act as planned: announced in the Commission's 2026 work programme with a legislative initiative for the fourth quarter of 2026, with the public consultation closed on 24 October 2025. The page shows no adopted proposal and carries no last-update date. Expected scope, per the same page as read in the first research round, is dark patterns, addictive design, influencer marketing, unfair personalisation, subscription cancellation and renewal traps and unfair terms, plus some simplification of information duties. Status: checked on the Parliament's own tracking page, which is an undated tracker and not the Commission's register; whether a proposal was published in October or November 2026 is not confirmed either way ([EP Legislative Train: Digital Fairness Act](https://www.europarl.europa.eu/legislative-train/theme-protecting-our-democracy-upholding-our-values/file-digital-fairness-act)).

**[INFERENCE]** Even if proposed in the fourth quarter of 2026, the Digital Fairness Act will not create duties before roughly 2028, given the ordinary legislative procedure plus a transition period; that is the researchers' estimate. Agents must never cite it as current law.

### One incident, several clocks

**[INFERENCE]** One security incident can start several clocks in parallel: the GDPR 72 hours to IMY, the Cybersäkerhetslagen 24 hours and 72 hours to MCF, a customer's contractual notice period, and for finance customers their own regulatory clock. The breach playbook in section 15 should run them together.

## 13. Marketing and consumer regulation pointers, and sector add-ons

### Marknadsföringslagen: the core rules

**[DURABLE]** Under the Swedish Marketing Act, marketing must comply with good marketing practice (5 §) and is unfair if it appreciably affects the recipient's ability to make an informed business decision (6 §). Misleading marketing is unfair if it affects or is likely to affect that ability, and the practices in points 1 to 23 of Annex I to Directive 2005/29/EC are always unfair (8 §). Marketing must be clearly identifiable as marketing and must show who is responsible (9 §). Status: checked on primary source, consolidated up to SFS 2022:656 ([SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486)).

**[DURABLE]** Marknadsföringslagen 10 § prohibits false or misleading statements, in particular about the product's existence, nature, quality and characteristics, origin and risks, price and payment terms, the trader's qualifications, market position, commitments and rights, awards, delivery terms, adherence to codes of conduct, and the consumer's legal rights; omitting material information, or giving it unclearly, is also misleading. Status: checked on primary source ([SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486)).

**[DURABLE]** Under Marknadsföringslagen 18 §, comparative advertising is allowed only if it is not misleading, compares products meeting the same needs, objectively compares material, relevant, verifiable and representative features, causes no confusion, does not discredit, and does not take unfair advantage of a competitor's reputation. Status: checked on primary source ([SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486)).

**[DURABLE]** Sanctions under Marknadsföringslagen are prohibition orders, also against employees and anyone who materially contributed (23 §); a market disruption fee for intentional or negligent breaches (29 §) of between SEK 10,000 and 4% of the trader's annual turnover, or up to the SEK equivalent of EUR 2 million where turnover data are missing (31 §); and damages to consumers and other traders (37 §). Status: checked on primary source, as consolidated up to SFS 2022:656 ([SFS 2008:486](https://rkrattsbaser.gov.se/sfst?bet=2008:486)).

### Green claims: EU rules apply, Swedish implementation not located

**[CONTESTED] [FAST-MOVING, Nov 2026]** The Empowering Consumers for the Green Transition Directive, (EU) 2024/825, has applied in the EU since 27 September 2026 according to the Commission's page, with new rules on environmental claims and a harmonised guarantee notice and label; Sweden's inquiry on implementation reported as SOU 2025:124 in January 2026. The consolidated Marknadsföringslag shows no amendment later than SFS 2022:656, which suggests the Swedish changes had not been enacted into that Act when the database was last updated, and a July 2026 trade-body item says Swedish changes were still awaited. Status: the application date and the inquiry are checked on primary sources; the Swedish in-force date is unknown; the description of the bans (generic environmental claims without recognised excellent performance, offset-based climate-neutral product claims, non-certified sustainability labels) is unverified background ([European Commission](https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/sustainable-consumption_en); [SOU 2025:124](https://www.regeringen.se/rattsliga-dokument/statens-offentliga-utredningar/2026/01/sou-2025124/); [Företagarna, July 2026](https://www.foretagarna.se/nyheter/riks/2026/juli/otydliga-regler-kan-leda-till-kasserade-produkter/)).

### Price reductions and other pointers

**[GAP]** Unverified background on further marketing rules: the advertiser bears the burden of proving claims; price-reduction announcements must show the lowest price in the preceding 30 days (prisinformationslagen 2004:347); and paid ranking, whether reviews are verified, and personalised pricing must be disclosed, under rules recalled as in Swedish law since 1 September 2022. Confirm before relying ([SFS 2004:347](https://rkrattsbaser.gov.se/sfst?bet=2004:347); [Directive (EU) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)).

### What marketing copy should be flagged for legal review

**[INFERENCE]** Agents reviewing marketing copy should flag any discount claim (prior-price rule), "AI-powered" or performance claims (a substantiation file is needed), environmental claims (stricter EU rules since 27 September 2026), comparative claims (the 18 § conditions), and customer logos or testimonials (consent). Unsolicited e-mail marketing to individuals needs prior consent except under the existing-customer exception in 19 §, and every marketing e-mail needs a valid opt-out address under 20 § (section 10).

### Finance customers: DORA contract terms

**[GAP] [VENDOR]** DORA, Regulation (EU) 2022/2554, is unverified background: applicable since 17 January 2025 to financial entities, reaching ICT third-party providers through mandatory contract terms (Article 30) on service description and locations, data protection, availability and security, incident assistance, cooperation with authorities and termination rights, and, for critical or important functions, service levels, notice periods, business-continuity testing, participation in threat-led penetration tests, unrestricted audit and access rights, exit strategies and subcontracting conditions. As secondary context, Finansinspektionen took 14 decisions in 2025, including a SEK 170 million AML fine against a bank and a SEK 12.5 million fine under the protective security act ([Regulation (EU) 2022/2554](https://eur-lex.europa.eu/eli/reg/2022/2554/oj); [Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

### Health customers

**[GAP]** Health-sector rules are unverified background: health data is special-category; Swedish care providers are bound by patientdatalagen (2008:355) and secrecy; software with a medical purpose is a medical device under Regulation (EU) 2017/745; and the European Health Data Space Regulation (EU) 2025/327 phases in from 2027 to 2029. What is verified is that Läkemedelsverket is the AI Act authority for medical-device AI in Sweden under the 4 June 2026 decision (section 11) ([SFS 2008:355](https://rkrattsbaser.gov.se/sfst?bet=2008:355); [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf)).

### Public-sector customers: procurement and secrecy

**[GAP] [VENDOR]** Public-sector rules are unverified background: the procurement act LOU (2016:1145) requires advertised tenders above thresholds, has exclusion grounds including corruption, competition infringements and tax debts, and restricts contract changes after award, so negotiation happens before bidding; under the secrecy act OSL (2009:400), 10 kap. 2 a § has since 1 July 2023 allowed disclosure to a supplier for purely technical processing or storage unless inappropriate, with foreign-law access central to that assessment; suppliers' staff are bound by tystnadspliktslagen (2020:914); and bid documents become public records subject to commercial-secrecy protection. A law-firm review reports, as a secondary source, that Konkurrensverket decided 17 procurement-fine cases in 2025 of about SEK 40,000 to SEK 7.2 million, mostly for unlawful direct awards. Current LOU thresholds and direct-award limits were not retrieved ([SFS 2016:1145](https://rkrattsbaser.gov.se/sfst?bet=2016:1145); [SFS 2009:400](https://rkrattsbaser.gov.se/sfst?bet=2009:400); [Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

### Vendor readiness kit for regulated buyers

**[INFERENCE]** Vendor readiness kit for regulated buyers: a DORA addendum mapped to Article 30, a security annex aligned with NIS2 measures, a sub-processor and subcontractor register with locations, an audit-rights procedure, an exit and transition plan (which also serves the Data Act switching rules), an incident-notice service level, and for public buyers a data-residency and foreign-access statement plus staff confidentiality undertakings. Any deal with a finance, health or public-sector buyer goes to a human lawyer.

## 14. Sanctions, export control, anti-money-laundering scope, anti-bribery and competition

### No size threshold applies to these regimes

**[INFERENCE]** Sanctions prohibitions, export-control licensing, bribery offences and the cartel prohibition apply to a ten-person SaaS company as much as to a bank; only AML customer-due-diligence duties are limited to listed obliged entities, which an ordinary SaaS vendor is not.

### Sweden's 2025 sanctions act

**[FAST-MOVING, since 10 June 2025]** Lag (2025:327) om internationella sanktioner was issued on 8 May 2025 and entered into force on 10 June 2025. It repeals lagen (1996:95), which still applies to earlier conduct under the transitional provisions, implements Directive (EU) 2024/1226 and contains the criminal provisions for breaches of international sanctions. This corrects the first research round, which had cited the 1996 act as current. Status: checked on primary source ([Lag (2025:327)](https://rkrattsbaser.gov.se/sfst?bet=2025:327)).

**[FAST-MOVING, since 10 June 2025]** Under lag (2025:327), the sanctions offence (sanktionsbrott) carries imprisonment of up to three years and covers breaches committed intentionally or with gross negligence (3 §); minor cases are a lesser offence punished by a fine or up to six months' imprisonment; a scale of two to six years' imprisonment applies to the aggravated form; attempts are punishable (10 §); and circumvention is covered. Status: checked on primary source, but sections 4 to 9 were read only through keyword lines, so the exact labelling of the two-to-six-year scale should be read in full before quoting ([Lag (2025:327)](https://rkrattsbaser.gov.se/sfst?bet=2025:327)).

**[FAST-MOVING, 2026]** Two related instruments were seen in the statute register by title only: Tillkännagivande (2026:62) listing the EU regulations covered by the sanctions act, and Förordning (2026:982) on a cooperation council for measures against sanctions breaches. Status: headline only ([Riksdagen open data](https://data.riksdagen.se/dokumentlista/?sok=internationella+sanktioner&doktyp=sfs&from=2025-01-01&utformat=json)).

### EU and US sanctions: orientation only

**[GAP]** The EU sanctions rules themselves are unverified background, not fetched: EU sanctions regulations apply directly to any EU-incorporated company and EU nationals anywhere; they impose an asset freeze and a ban on making funds or economic resources available, directly or indirectly, to listed persons (for Russia, Regulation (EU) No 269/2014) and sectoral bans (Regulation (EU) No 833/2014, recalled as including bans on supplying certain enterprise and industrial-design software and IT consultancy and legal advisory services to the Russian government and Russia-established entities); and entities owned more than 50% or controlled by a listed person are treated as caught. The latest Russia sanctions package and its software and IT-services prohibitions as of November 2026 were not checked ([Reg. 269/2014](https://eur-lex.europa.eu/eli/reg/2014/269/oj); [Reg. 833/2014](https://eur-lex.europa.eu/eli/reg/2014/833/oj); [EU sanctions map](https://www.sanctionsmap.eu/)).

**[GAP]** US sanctions reach is unverified background: OFAC rules are recalled as reaching non-US companies through US persons, US-dollar payments, US-origin items and secondary sanctions, with a 50% ownership rule and strict liability for civil penalties, while the EU Blocking Statute (Regulation (EC) No 2271/96) restricts complying with certain US extraterritorial sanctions ([OFAC](https://ofac.treasury.gov/); [Reg. 2271/96](https://eur-lex.europa.eu/eli/reg/1996/2271/oj)).

**[INFERENCE]** Sanctions screening matters even though a SaaS company is outside the AML Act, because the 2025 sanctions act punishes grossly negligent breaches and not only intentional ones. No statute prescribes a screening method for non-financial companies; the duty is the result. The practical control is to screen customers, resellers, beneficial owners and payment counterparties at onboarding and on list updates against the EU consolidated list and the US and UK lists, geo-block comprehensively sanctioned territories, and add sanctions clauses to contracts ([EU consolidated list](https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions)).

### Export control: not retrieved

**[GAP]** Export control was not retrieved in either research round; ISP's dual-use page returned only navigation text, and Regulation (EU) 2021/821 and its current Annex I were not opened. The following is unverified background only: a licence is needed to export Annex I dual-use items outside the EU; software and technology are covered, including intangible transfers such as downloads, cloud access and technical assistance; encryption sits in Category 5 Part 2 and many commercial products qualify for a mass-market exemption that needs a documented self-classification; catch-all controls apply to non-listed items for certain end-uses; ISP is the Swedish licensing authority; and US export rules can follow US-origin software, models and chips into Swedish products. Controls on encryption software, cloud delivery and any AI-specific controls remain unverified, so a named human must make every classification ([Regulation (EU) 2021/821](https://eur-lex.europa.eu/eli/reg/2021/821/oj); [ISP](https://www.isp.se/)).

### AML Act scope: a SaaS company is normally outside

**[DURABLE]** The Swedish AML Act, lagen (2017:630), applies to the businesses listed in 1 kap. 2 §: banks and financing businesses, life insurance, securities businesses, payment institutions and registered payment service providers, e-money, fund managers, crowdfunding and crypto-asset service providers, estate agents, gambling operators, traders in goods handling cash payments of EUR 5,000 or more, pawnbrokers, auditors, bookkeeping and auditing services, tax advisers, advocates and other independent lawyers for specified services, other professionals providing the services listed in 4 § second paragraph (not read), and art dealers for transactions of EUR 10,000 or more. Software or SaaS provision is not a listed category. Status: checked on primary source, consolidated up to SFS 2026:1075 ([Lag (2017:630)](https://rkrattsbaser.gov.se/sfst?bet=2017:630)).

**[FAST-MOVING, 20 Nov 2026]** The scope section of the AML Act has a new wording from 20 November 2026 under SFS 2026:1023; the tail of the list that was compared (points 20 to 24) is unchanged, and what else changes was not established. Status: checked on primary source for the existence of the new wording ([Lag (2017:630)](https://rkrattsbaser.gov.se/sfst?bet=2017:630)).

**[INFERENCE]** A SaaS company comes inside the AML Act if it adds a listed activity, for example payment services, e-money, crypto-asset services, or bookkeeping services offered professionally. A product that only supplies software to bookkeepers is different from one that performs bookkeeping for clients, and that line needs individual assessment by a human lawyer.

**[GAP] [VENDOR]** Unverified background on AML: the EU AML Regulation (EU) 2024/1624 is recalled as applying from 10 July 2027 and replacing most national rules. As secondary context for enforcement scale against obliged entities, Finansinspektionen's AML fines against banks were SEK 170 million in 2025, SEK 500 million in 2024 and SEK 850 million in 2023 ([Reg. 2024/1624](https://eur-lex.europa.eu/eli/reg/2024/1624/oj); [Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

### Bribery offences in Brottsbalken

**[DURABLE]** The table below sets out the Swedish bribery offences in Brottsbalken chapter 10 as read in November 2026; sections 5 a to 5 d carry the amendment reference SFS 2026:1318, which entered into force on 1 August 2026. Status: every row checked on primary source, consolidated up to SFS 2026:1656.

| Offence | Conduct | Penalty as read Nov 2026 | Source |
|---|---|---|---|
| Tagande av muta (5 a §) | An employee or contractor receives, accepts a promise of or requests an undue benefit for the performance of the employment or assignment | Up to two years' imprisonment | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |
| Givande av muta (5 b §) | Giving, promising or offering such a benefit | Up to two years | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |
| Gross offences (5 c §) | Considering abuse of a position of particular responsibility, significant value, or systematic or large-scale conduct | One year and six months to six years | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |
| Handel med inflytande (5 d §) | Taking or giving an undue benefit to influence someone else's decision in the exercise of public authority or public procurement | Up to two years | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |
| Vårdslös finansiering av mutbrott (5 e §) | A business provides money or assets to a representative and thereby, through gross negligence, promotes bribery in that matter | Fine or up to two years | [Brottsbalk (1962:700)](https://rkrattsbaser.gov.se/sfst?bet=1962:700) |

**[INFERENCE]** The negligent-financing offence in 5 e § is the statutory reason to run due diligence on agents, resellers and consultants who deal with customers on the company's behalf. The minimum for gross bribery in the current text (one year and six months) appears higher than the researchers recall from before the 2026 reform, but the earlier figure is from memory, so the change is unconfirmed while the current text is as stated. Corporate fines of up to SEK 500 million for large companies, the absence of a facilitation-payment exception, and exposure under the UK Bribery Act and the US FCPA are unverified background.

### The IMM business code on gifts and hospitality

**[DURABLE]** The Code to Prevent Corruption in Business (Näringslivskoden) of Institutet Mot Mutor was first adopted on 31 August 2012 and revised in 2014; the current version was adopted by the institute's board on 10 June 2020 and applies from 14 August 2020. It supplements the legislation, sets requirements for preventive anti-corruption work and gives guidance on benefits and intermediaries. Status: checked on the institute's own page ([IMM: Näringslivskoden](https://www.institutetmotmutor.se/naringslivskoden/)).

**[DURABLE]** The IMM code's preventive measures are top-level commitment, analysis of corruption risk, internal anti-corruption rules, communication and training, due diligence of intermediaries and other third parties, reporting (whistleblowing) systems, and tools for checking and monitoring. A benefit is anything of tangible or intangible value given to an employee or contractor by someone other than the employer in connection with the performance of duties; benefits of insignificant value in a normal working relationship, such as coffee at a meeting, do not count. Status: checked on the code's English text ([IMM Code, English PDF](http://immse.wpenginepowered.com/wp-content/uploads/2020/10/IMM-Code-to-prevent-corruption-in-business.pdf)).

**[DURABLE]** The IMM code treats three recipient situations differently: the exercise of public authority and public procurement, where giving or receiving a benefit is prohibited regardless of timing, illustrated by an example in which a company may not offer inspecting officials even a simple lunch; other public-sector and publicly financed activities, where the starting point is caution; and the private sector. Where giving or receiving is not permitted, offering, promising, requesting or accepting is not permitted either. Status: checked on the code's English text; the private-sector and intermediary sections were not read in detail ([IMM Code, English PDF](http://immse.wpenginepowered.com/wp-content/uploads/2020/10/IMM-Code-to-prevent-corruption-in-business.pdf)).

**[INFERENCE]** A gifts-and-hospitality policy can be built directly on the IMM structure: a flat prohibition for anyone involved in public authority decisions or procurement affecting the company, a cautious regime for other public-sector contacts, and a moderation-and-openness test for private-sector contacts. No monetary thresholds were seen in the parts of the code that were read, so agents must not invent one.

### Competition law basics

**[DURABLE]** Under the Swedish Competition Act, agreements are prohibited where they appreciably prevent, restrict or distort competition, in particular price fixing, limiting production or markets, market sharing, discriminatory terms and tying (2 kap. 1 §), subject to a four-condition efficiency exemption (2 kap. 2 §); abuse of a dominant position is prohibited (2 kap. 7 §). Status: checked on primary source, consolidated up to SFS 2026:580 ([Konkurrenslag (2008:579)](https://rkrattsbaser.gov.se/sfst?bet=2008:579)).

**[DURABLE]** Konkurrensverket may itself decide that an undertaking shall pay a competition fine for intentional or negligent infringements (3 kap. 5 §), and the fine may not exceed 10% of the undertaking's turnover in the preceding financial year (3 kap. 6 §). Status: checked on primary source ([Konkurrenslag (2008:579)](https://rkrattsbaser.gov.se/sfst?bet=2008:579)).

**[VENDOR] [FAST-MOVING, 2025 data]** Konkurrensverket set three competition fines in 2025 (SEK 5 million, SEK 6.5 million and SEK 15 million), all three companies received full leniency, and the authority took 21 decisions in total in 2025. Status: secondary source only ([Vinge](https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf)).

**[GAP]** Unverified background on competition law: the Swedish merger-filing thresholds are recalled as combined Swedish turnover above SEK 1 billion with at least two parties each above SEK 200 million, and in-house lawyer communications are recalled as not privileged in EU competition investigations (CJEU, C-550/07 P Akzo Nobel, 2010). Konkurrensverket guidance, including any on algorithms or AI, was not fetched ([Konkurrensverket](https://www.konkurrensverket.se/); [CJEU C-550/07 P](https://curia.europa.eu/juris/liste.jsf?num=C-550/07)).

### Escalation triggers for financial crime and trade

**[INFERENCE]** Escalation triggers an AI legal agent should hard-code: any counterparty or end user in or owned from Russia, Belarus, Iran, North Korea, Syria, Cuba or occupied Ukrainian regions; any screening hit or close name match; requests to ship or give access to encryption, AI models or surveillance-capable features outside the EU and EEA; payments via third countries or to third parties; gifts or hospitality to public officials or during a tender; any contact with competitors about prices, customers, bids, hiring or roadmap; trade-association information exchanges; and exclusivity, most-favoured-customer or resale-price clauses.

**[INFERENCE]** Sanctions and export classification are areas where no agent signs off: an AI agent can screen and prepare the file, but a named human must clear hits and classifications because of the criminal liability involved. Pricing algorithms and shared AI pricing tools can create collusion risk, so any use of third-party pricing software shared with competitors is flagged; that point is the researchers' inference from general competition principles.

## 15. The corporate compliance programme

### What a small company's programme needs

**[INFERENCE]** A small company needs a short, owned and evidenced set of policies tied to the regimes in this document, a dated compliance calendar, a single regulatory-change register, and one integrated incident playbook that runs the GDPR, cybersecurity and contractual clocks together. No Swedish authority checklist for small-company compliance programmes was retrieved, so the policy list and calendar below are the researchers' synthesis of common practice and not sourced requirements.

### Minimum policy set

**[INFERENCE]** Minimum policy set for a small SaaS and AI company: a code of conduct; a privacy policy set (external notices, internal data-protection policy, retention schedule, data-subject request and breach procedures); an information-security policy with an incident-response plan; an acceptable-use and AI-use policy (approved tools, banned inputs, human review, AI literacy training record); an AI governance procedure (inventory, role classification, prohibited-practice screen, Article 50 controls); an anti-bribery and gifts policy aligned with the IMM code; a sanctions and export-control procedure; competition-law dos and don'ts; a whistleblowing procedure, mandatory at 50 or more workers; a vendor and sub-processor due-diligence procedure; a contract-signature and delegation-of-authority policy; a marketing-claims review rule; and a document-retention and legal-hold rule.

### Management accountability

**[DURABLE]** The Swedish board is responsible for the company's organisation and for ensuring that bookkeeping, asset management and finances are controlled in a satisfactory way, and must act with care when delegating (Aktiebolagslagen 8 kap. 4 §). Swedish authority guidance on the Cybersäkerhetslagen lists training of management and staff as a duty. Status: both checked on primary sources; the NIS2 rule that management bodies must approve and oversee cybersecurity measures (Article 20) is unverified background ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551); [Länsstyrelsen Västmanland](https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html)).

### Recurring calendar entries

**[INFERENCE]** Recurring compliance calendar entries: an annual review of the record of processing and of DPIAs; annual policy attestation and training (privacy, security, AI literacy, anti-bribery, competition); the semi-annual DSA active-recipient publication if the company is a platform, and an annual DSA transparency report if it is not small; a quarterly check of the sub-processor list and transfer register; the annual report filing and beneficial-owner check with Bolagsverket; the annual general meeting within six months of year-end; an annual penetration test and incident-playbook exercise; an insurance renewal review covering cyber, professional indemnity and, from 2027, software product liability; a yearly re-test of employee-option eligibility; a 1 January headcount check against the 50-worker whistleblowing threshold; and a whistleblowing channel test.

### Regulatory change tracking

**[INFERENCE]** Keep one regulatory-change register with columns for regime, instrument, status, next milestone and date, owner, impact and action. Run a weekly sweep of the EUR-Lex Official Journal, the Commission's AI Office and digital-strategy news, the EDPB, IMY, PTS, MCF, Finansinspektionen, Konkurrensverket, ISP, regeringen.se (draft bills and bills) and riksdagen.se, plus two or three law-firm trackers. Tag every entry "in force", "adopted, not yet applicable" or "proposed", so that agents never apply a proposal as law. The Riksdag open-data service proved usable in this research for checking both statute registers and the status of a bill in committee ([Riksdagen document status example](https://data.riksdagen.se/dokumentstatus/HE01CU4.json)).

### Incident and breach clocks

**[FAST-MOVING, Nov 2026]** The table below lists the incident-reporting clocks for the integrated playbook, with the verification status of each.

| Regime | Clock | Recipient | Verification | Source |
|---|---|---|---|---|
| GDPR Article 33 | Without undue delay and where feasible within 72 hours of awareness, unless risk is unlikely; processor to controller without undue delay; every breach documented | IMY | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| GDPR Article 34 | Without undue delay where high risk is likely | Affected individuals | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Cybersäkerhetslagen | Initial notice within 24 hours, incident report within 72 hours, final report within one month after that | MCF | Checked on Swedish authority page | [Länsstyrelsen Västmanland](https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html) |
| Cyber Resilience Act | 24 hours, 72 hours and 14 days for actively exploited vulnerabilities, from 11 Sep 2026 | Not verified | Unverified background, not fetched | [CRA](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) |
| AI Act Article 73 | Serious incidents with high-risk systems within 15 days, shorter for deaths or widespread incidents, once high-risk rules apply | Market-surveillance authority | Unverified background, not fetched | [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) |
| Whistleblowing Act | Acknowledgment within seven days; feedback within three months of acknowledgment | Reporter | Checked on primary source | [Lag (2021:890)](https://rkrattsbaser.gov.se/sfst?bet=2021:890) |
| Proposed GDPR change (not law) | 96-hour deadline with a high-risk threshold; national single entry points with a 30-month lead time | — | Secondary source only; proposal | [Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position) |

### Integrated incident playbook

**[INFERENCE]** Integrated incident playbook skeleton: detect and log, with a timestamp for "awareness"; contain; classify (personal data, significant under the cybersecurity act, a customer-contract trigger, an AI serious incident, a product vulnerability); start all applicable clocks; notify customers as processor first where required; make regulator notifications (IMY within 72 hours; MCF at 24 hours, 72 hours and one month); notify individuals if high risk; preserve evidence and apply a legal hold; and run a post-incident review and register update. A human incident lead and a human lawyer approve every external notification.

**[INFERENCE]** The two Swedish security fines in 2026 give the playbook its preventive checklist: known-but-unfixed weaknesses, no gap-detection routine and no real-time intrusion detection drove the Sportadmin fine, and insufficient checks when installing new software and no automatic real-time monitoring drove the Miljödata fine ([EDPB news](https://www.edpb.europa.eu/news/swedish-sa-administrative-fine-against-sportadmin_fi); [IMY, 22 Sep 2026](https://www.imy.se/nyheter/sanktionsavgift-mot-miljodata-for-bristande-sakerhet/)).

### Gaps in the compliance-programme research

**[GAP]** Not researched: sustainability reporting and due-diligence rules after the 2025–2026 EU simplification package, which a company near the thresholds should check separately; Arbetsmiljöverket guidance beyond the pages cited in section 8; and any Swedish authority checklist for small-company compliance programmes.

## 16. Legal operations

### Evidence base for this section

**[GAP]** Almost no fresh sources on legal operations practice could be retrieved, so the operating design in this section is the researchers' synthesis of common practice, labelled as inference, and should be treated as a design starting point and not as benchmarked fact. The CLOC "Core 12" functional areas and the ACC Legal Operations Maturity Model are recalled as useful scoping and self-assessment frameworks but their pages were not opened ([CLOC](https://cloc.org/what-is-legal-operations/); [ACC maturity model](https://www.acc.com/maturity)).

### Benchmark direction from CLOC's 2026 report

**[VENDOR] [FAST-MOVING, 2 Mar 2026]** CLOC released its 2026 State of the Industry Report on 2 March 2026, based on the 2025 Harbor Law Department Survey of 135 law departments across more than 15 industries with median company revenue of USD 13 billion. Workload increases are driven by regulatory compliance (63%) and cybersecurity (58%); 37% of departments expect outside counsel spend to rise, down from 58% the year before; 47% expect inside legal spend to rise, down from 65%; 32% expect attorney headcount increases; 85% have dedicated AI oversight or resources; and legal operations focus areas are technology strategy (80%), financial management (72%) and outside counsel and vendor management (62%). Status: checked on CLOC's own press release; the full report was not opened, and CLOC is an industry association ([CLOC press release, 2 Mar 2026](https://cloc.org/newsdesk/cloc-releases-2026-state-of-the-industry-report-rising-legal-demand-outpaces-budget-and-staffing-growth-forcing-operational-shift/)).

**[INFERENCE]** The CLOC figures describe very large companies. For a small in-house team they support priorities and not targets: expect compliance and security work to grow faster than budget, treat outside counsel spend as capped, and put AI governance in writing.

### Intake and triage

**[INFERENCE]** Run one front door (form, e-mail alias or chat) that captures requester, business unit, counterparty, value, deadline, data types, jurisdiction and request type. Classify each request automatically into self-service, agent-handled or lawyer-required using a risk matrix of value, novelty, regulatory touchpoints, counterparty paper versus own paper, and dispute or regulator involvement. Acknowledge each request against a service level per tier, and run a conflicts and sanctions check at intake.

### Matter management

**[INFERENCE]** Every request gets a matter ID, owner, status, risk rating, key dates (limitation, renewal, notice), linked documents, a decisions and approvals log, time and cost, outcome and lessons. Legal holds and confidentiality markings are recorded on the matter, and closed matters feed the knowledge base.

### Playbooks and clause libraries

**[INFERENCE]** For each contract type keep a playbook with the preferred position, acceptable fallbacks, walk-away points, rationale and approval level for each clause: liability caps, indemnities, intellectual property, data protection and the DPA, AI-specific terms, security, service levels, termination, governing law, Data Act switching and regulated-sector add-ons. Keep a clause library with version control, owner, last-reviewed date and the legal source behind each mandatory clause, and log deviations to refine the playbook.

### Self-service contracting

**[INFERENCE]** Standard NDAs, order forms, DPAs and low-value vendor terms can be generated from templates with guardrails: no edits outside fields; automatic escalation on counterparty redlines beyond fallbacks, non-standard governing law, unlimited liability, exclusivity, or public-sector or regulated-sector counterparties; and e-signature under a delegation-of-authority matrix.

### Outside counsel management

**[INFERENCE]** Keep a panel of firms by specialism and jurisdiction, with engagement letters covering scope, staffing, rate card or fixed or capped fees, budget by phase, matter-level purchase orders, billing guidelines, accruals and after-action reviews. Require firms to disclose and control their own generative-AI use and confidentiality safeguards, and instruct an external advokat where privilege matters (section 17).

### Metrics

**[INFERENCE]** Legal operations metrics: volume by type and business unit; cycle time from intake to signature; service-level attainment; share handled by self-service and agents versus lawyers; deviation rate from playbook; outside-counsel spend against budget; contract value under management and renewals; compliance indicators (data-subject requests closed within one month, breach-notification timeliness, training completion); and AI-quality indicators (citation-check failure rate, human-override rate, escalations, error reports). No benchmark values for these metrics were retrieved, so targets come from the company's own trailing data.

### Contract lifecycle management tooling

**[INFERENCE]** A contract lifecycle management tool should provide a repository with metadata and obligations extraction, template and clause management, workflow and approvals, e-signature, integrations with CRM and procurement, reporting, audit logs and role-based access. Selection criteria for a Swedish or EU company include EU data hosting, a GDPR-compliant DPA with sub-processor transparency, Data Act exit terms, no vendor training on customer data, AI-feature transparency and export of all data in open formats. No market survey of vendors or pricing was done.

### Gaps in the legal-operations research

**[GAP]** The ACC 2026 Chief Legal Officers Survey key-findings document exists but the server refused the download, so no ACC figures are reported ([ACC 2026 CLO Survey key findings](https://www.acc.com/sites/default/files/2026-01/2026-ACC-Chief-Legal-Officers-Survey-Key-Findings.pdf)). No figures on legal spend as a share of revenue, lawyers per billion of revenue or contract-management adoption were retrieved.

## 17. AI doing legal work: evidence and professional rules

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

## 18. Guardrails for the department's AI agents

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

## 19. Hand-offs with the other departments

### How to read this section

**[INFERENCE]** The research did not source any model for inter-departmental hand-offs, so everything in this section is the researchers' inference from the legal findings in the earlier sections. Each row says what Legal receives, what Legal hands back, and the trigger that makes the hand-off mandatory. "Legal" in the department list refers to this department itself; the row for it covers hand-offs between its own agents and the human lawyer or external counsel.

| Department | Legal receives | Legal hands back | Mandatory triggers | Basis |
|---|---|---|---|---|
| IT infrastructure | Incident and vulnerability reports with an awareness timestamp; architecture, hosting-location and sub-processor changes; logs for legal holds | Classification of the incident and the running clocks; draft regulator and customer notices for human approval; security-annex and DPA requirements; legal-hold instructions | Any suspected breach or significant incident; new vendor with data access; new region or US vendor | Sections 10, 12, 15 |
| Marketing | Campaign copy, claims, discount mechanics, testimonials and logos, e-mail audiences, cookie and tracking plans | Cleared or amended copy; substantiation-file requirements; consent and opt-out requirements; a flag where a human must decide | Discount, comparative, environmental or AI-performance claims; e-mail to individuals without prior sale; any new tracking technology | Sections 10, 13 |
| Application | Feature plans touching user content, sign-up and checkout flows, open-source components, shipped clients or SDKs | Terms-of-use and acceptable-use requirements; DSA notice and statement-of-reasons templates; consumer checkout checklist; open-source licence review | Consumer-facing purchase flow; AGPL or other copyleft component; downloadable component; user-content storage or sharing | Sections 3, 4, 12 |
| Data and AI | AI inventory entries, model and vendor choices, training-data sources, scraping plans, new AI features | Role classification proposal for human sign-off; Article 50 controls; flow-down terms from model vendors; text-and-data-mining conditions; DPIA trigger | Any new AI feature; training on customer data; scraping; Annex III use case; image or video generation | Sections 5, 7, 10, 11 |
| Finance | Aged receivables, management accounts, payment-counterparty data, option and issue plans, insurance renewals | Reminder and demand drafts; limitation and claim-window calendar; control-balance-sheet alert; screening results; corporate documents for human approval | Equity approaching half of registered share capital; debt approaching limitation; third-party or third-country payment; share or option issue | Sections 6, 9, 14 |
| Sales | Deal requests, counterparty paper, redlines, reseller and partner proposals, customer sector and country | Template contracts; issues list against the playbook; approved fallbacks; signature-authority check; escalation where beyond fallback | Uncapped liability, exclusivity, most-favoured-customer or resale-price terms; regulated-sector or public buyer; sanctions-sensitive country; consumer buyer; gifts or hospitality in a tender | Sections 2, 3, 4, 13, 14 |
| Customer Support | Data-subject requests, complaints, withdrawal and cancellation requests, content notices, suspension decisions, threats of legal action | Request tracker with the one-month clock; response templates; statement-of-reasons text; escalation of disputes | Any data-subject request; any notice of illegal content; any consumer withdrawal; any threatened claim or regulator mention | Sections 3, 4, 9, 10 |
| Legal (human lawyer and external counsel) | Escalation packages from the manager agent; drafts for sign-off | Decisions, signed approvals, corrections to playbooks and to this knowledge base | Every item in the "needs human approval" tier; every "must never do" item that the business still requires | Section 18 |
| Media | Content plans using third-party works, AI-generated images, video or text, synthetic voices or likenesses | Rights and licence check; labelling requirements for synthetic content; consent requirements for persons depicted | Deepfake-type content; public-interest text generated by AI; use of works under a rights reservation; real persons' likeness | Sections 7, 11 |
| Operations | Vendor onboarding requests, contractor and consultant engagements, office and travel arrangements, policy roll-outs | Vendor due-diligence checklist; consultancy template; contractor-status screen; policy texts and training records | Vendor processing personal data; consultant integrated like an employee; agent or intermediary dealing with customers | Sections 4, 8, 14, 15 |
| Product | Roadmap items, pricing and packaging changes, term and renewal mechanics, exit and export features | Data Act switching requirements; consumer renewal and price-term rules; product-liability and accessibility flags; contract-template updates | Fixed terms, exit fees or notice above two months; auto-renewal for consumers; material service change; software with safety or data-loss impact | Sections 2, 3, 12 |
| Research | Source lists, competitor and market research plans, scraping or data-collection methods, survey designs | Lawful-access and rights-reservation conditions; privacy basis for personal data; limits on competitor contact and information exchange | Scraping; collection of personal data; any contact with competitors; use of leaked or confidential material | Sections 7, 10, 14 |

**[INFERENCE]** Two hand-off rules apply across all departments. First, Legal's output to another department always states the verification status of the legal point it relies on, so that a department does not treat an unverified pointer as a clearance. Second, no department's agent treats silence from Legal as approval; an item in the "needs human approval" tier stays blocked until a named human has signed.

## 20. Pending changes and dated milestones

### How to use the calendar

**[FAST-MOVING, 11 Nov 2026]** The table below lists every pending change and dated milestone established in the research, in date order, with its legal status on 11 November 2026 and the verification level of the date. Agents load each row into the regulatory-change register and re-verify it on the linked source before acting, because several dates rest on secondary sources or background knowledge.

| Expected date | Change or milestone | Legal status on 11 Nov 2026 | Verification of the date | Source |
|---|---|---|---|---|
| 19, 24 and 25 Nov 2026 | Committee adjustment, debate and planned Riksdag decision on the new Produktansvarslag (bet. 2026/27:CU4) | Bill pending, not adopted | Checked on primary source | [Riksdagen, bet. 2026/27:CU4](https://data.riksdagen.se/dokumentstatus/HE01CU4.json) |
| 20 Nov 2026 | SFS 2026:1018 amends Distansavtalslagen 2 kap. 16 § and 3 kap. 7 § | Adopted, not yet applicable | Checked on lagen.nu | [Lag (2005:59), lagen.nu](https://lagen.nu/2005:59) |
| 20 Nov 2026 | SFS 2026:1023: new wording of the AML Act scope section | Adopted, not yet applicable | Checked on primary source | [Lag (2017:630)](https://rkrattsbaser.gov.se/sfst?bet=2017:630) |
| 2 Dec 2026 | 90% salary floor applies to extensions of work permits granted before 1 June 2026 (old 80% rule ends 1 Dec 2026) | In force, phased | Checked on primary source | [Migrationsverket](https://www.migrationsverket.se/ordforklaringar/lonekrav-for-arbetstillstand.html) |
| 2 Dec 2026 | AI Act Article 50(2) marking deadline for generative systems on the market before 2 Aug 2026 | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Dec 2026 | New AI Act prohibitions on non-consensual intimate material and child sexual abuse material start to apply | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 5 Dec 2026 | SFS 2026:783 amends Aktiebolagslagen (public-company matters) | Adopted, not yet applicable | Checked on primary source | [Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551) |
| 9 Dec 2026 | Transposition deadline for the revised Product Liability Directive | EU deadline; Sweden will miss it by about three weeks if the bill passes as proposed | Secondary source only | [Faegre Drinker, 24 June 2026](https://www.faegredrinker.com/en/insights/publications/2026/6/transposing-the-eus-new-product-liability-directive-a-member-state-progress-report) |
| Q4 2026 | Commission proposal for a Digital Fairness Act expected | Announced, not proposed as far as verified | Checked on the Parliament's undated tracker | [EP Legislative Train](https://www.europarl.europa.eu/legislative-train/theme-protecting-our-democracy-upholding-our-values/file-digital-fairness-act) |
| 31 Dec 2026 | Swedish government assignment of AI Act authorities ends; successor arrangement not found | In force until that date | Checked on primary source | [Regeringsbeslut Fi2026/01365](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf) |
| 1 Jan 2027 | Proposed entry into force of the new Produktansvarslag (software in scope) | Proposed | Checked on primary source | [Prop. 2026/27:12](https://data.riksdagen.se/dokument/HE0312.html) |
| 1 Jan 2027 (reported as expected) | Swedish pay-transparency rules | Not enacted; contested dates | Secondary sources only | [Almega, March 2026](https://www.almega.se/2026/03/reglerna-om-lonetransparens-skjuts-upp/); [DO](https://www.do.se/for-arbetsgivare-och-utbildningsanordnare/lonetransparens-och-jamstallda-loner/vad-ar-lonetransparensdirektivet) |
| 1 Jan 2027 | New price base amount changes the small-claims threshold (2027 value not checked) | Annual change | Not verified | [Sveriges Domstolar](https://www.domstol.se/amnen/tvist-om-pengar/sa-hanteras-ett-tvistemal-i-tingsratten/) |
| 12 Jan 2027 | Data Act: switching charges, including egress fees, banned | Adopted, not yet applicable | Secondary source only | [DLA Piper, July 2025](https://www.dlapiper.com/en/insights/publications/2025/07/understanding-switching-termination-rights-under-the-data-act) |
| 2 Feb 2027 | Watermark-detection interoperability for signatories of the AI transparency code | Voluntary code commitment | Secondary source only | [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations) |
| Before Feb 2027 (target) | European Parliament committee vote on the Digital Omnibus (GDPR, ePrivacy, data, cyber) | Proposed | Secondary source only | [EU Perspectives, Aug 2026](https://euperspectives.eu/2026/08/after-1840-amendemnts-the-eu-fight-over-data-will-begin/) |
| 10 Jul 2027 | EU AML Regulation applies | Adopted, not yet applicable | Unverified background, not fetched | [Reg. 2024/1624](https://eur-lex.europa.eu/eli/reg/2024/1624/oj) |
| 2 Aug 2027 | National AI sandboxes operational; Commission delegated acts on Annex I overlaps | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Aug 2027 | General-purpose AI models placed on the market before 2 Aug 2025 must comply | Adopted, not yet applicable | Unverified background, not fetched | [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) |
| 12 Sep 2027 | Data Act unfair-terms rules reach certain older long-term contracts | Adopted, not yet applicable | Unverified background, not fetched | [Data Act](https://eur-lex.europa.eu/eli/reg/2023/2854/oj) |
| 2 Dec 2027 | AI Act high-risk requirements for Annex III systems | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 11 Dec 2027 | Cyber Resilience Act full application | Adopted, not yet applicable | Unverified background, not fetched | [CRA](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) |
| 20 May 2028 or 7 Jun 2027 | First pay-gap report under Swedish pay-transparency rules (trade bodies cite 20 May 2028; DO's page shows directive dates of 7 Jun 2027 for 150+ employees and 7 Jun 2031 for 100–149) | Not enacted; contested | Secondary source and authority page disagree | [TechSverige, March 2026](https://techsverige.se/en/2026/03/sverige-skjuter-upp-genomforandet-av-lonetransparensdirektivet-valkommet-besked/); [DO](https://www.do.se/for-arbetsgivare-och-utbildningsanordnare/lonetransparens-och-jamstallda-loner/vad-ar-lonetransparensdirektivet) |
| 1 Jul 2028 | Current wording of Föräldraledighetslagen 7 § ceases; new wording not read | Adopted change | Checked on primary source | [Föräldraledighetslag (1995:584)](https://rkrattsbaser.gov.se/sfst?bet=1995:584) |
| 2 Aug 2028 | AI Act high-risk requirements for Annex I product-embedded systems | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 2 Aug 2030 | AI Act: high-risk systems intended for public authorities must comply | Adopted, not yet applicable | Checked on primary source | [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) |
| 31 May 2034 | EU vertical block exemption expires | In force until that date | Checked on primary source | [Regulation (EU) 2022/720](https://eur-lex.europa.eu/eli/reg/2022/720/oj) |

### Pending matters without a date

**[FAST-MOVING, 11 Nov 2026]** Several pending matters have no known date and must be watched instead of calendared. The appeal against the EU–US Data Privacy Framework, C-703/25 P, is pending with no hearing or judgment date found, on secondary sources only ([IEU Monitoring, 28 Jun 2026](https://ieu-monitoring.com/editorial/microsoft-backs-eu-commission-in-eu-court-case-on-transatlantic-data-flows-and-privacy/1244467/)). The CJEU judgment in C-250/25 Like Company v Google has not been given after the Opinion of 3 November 2026, and two further referrals (C-806/26 and C-829/26) are pending ([Curia](https://curia.europa.eu/site/jcms/p1_1000088866/en/opinion-case-c-250/25-like-company)). Swedish supplementary legislation for the Data Act after SOU 2025:118, the Swedish implementation of Directive (EU) 2024/825 after SOU 2025:124, and a permanent Swedish supplementary act for the AI Act after SOU 2025:101 were not found as adopted law ([PTS](https://pts.se/internet-och-telefoni/dataforordningen/); [SOU 2025:124](https://www.regeringen.se/rattsliga-dokument/statens-offentliga-utredningar/2026/01/sou-2025124/); [SOU 2025:101](https://regeringen.se/rattsliga-dokument/statens-offentliga-utredningar/2025/10/sou-2025101/)).

**[FAST-MOVING, 11 Nov 2026]** Open IMY matters to watch, the first checked on IMY's own news item and the rest seen as headlines only: reviews of two municipalities and a region that were customers of Miljödata; guidance in preparation on cloud services in the public sector; and reviews of AI systems at Region Gävleborg and Arbetsförmedlingen ([IMY, 22 Sep 2026](https://www.imy.se/nyheter/sanktionsavgift-mot-miljodata-for-bristande-sakerhet/); [IMY news feed](https://www.imy.se/nyheter/rss)).

## 21. Consolidated gaps

### How to treat a gap

**[INFERENCE]** A gap in this section means the research did not verify the point. Agents treat every gap as "ask a human lawyer or fetch the primary source first" and never answer from model memory. The gaps are grouped by domain so that each paragraph can be loaded as its own entry.

### Gaps: commercial contracts and routine documents

**[GAP]** Not verified for commercial contracts and routine documents: Swedish market-median liability caps and service-credit levels; any Swedish law-firm negotiation playbook; the 2026 WorldCC ranking; the content of Avtal 90 and of the TechSverige NDA and processor terms; clause numbers for the Molntjänster commercial defaults, and the wording of a currently licensed copy; Bonterms; EU model clauses for cloud switching; the Data Act articles themselves; Swedish supplementary Data Act law; SCC fee schedules and expedited thresholds; the evidentiary value of BankID; contract lifecycle management practice; lag (1914:45) om kommission and distributor notice case law; whether SaaS referral partners fall under the Commercial Agents Act; shareholder agreements and fundraising documents; employer of record; open-source licences other than AGPL section 13 and Apache section 4, and SBOM and Cyber Resilience Act duties for open-source components.

### Gaps: consumer and marketing

**[GAP]** Not verified for consumer and marketing law: Konsumenttjänstlagen; the digital-content rules in Konsumentköplagen (2022:260); the statute text of the auto-renewal act (2014:1449); rules on rolling subscriptions, price changes and notice periods for consumers; the content of SFS 2026:1018; the Swedish implementation and in-force date of Directive (EU) 2024/825; the 30-day prior-price rule and review-disclosure rules; Konsumentverket and court practice on AI-related or green claims; whether a Digital Fairness Act proposal has been published; and European Accessibility Act duties.

### Gaps: corporate

**[GAP]** Not verified for corporate law: Aktiebolagslagen chapters 14, 15, 18 and 21 and the transfer-restriction clauses in chapter 4; the fourth paragraph of 25 kap. 18 §; case law on director liability; what the repealed 8 kap. 6–7 §§ required; the in-force date of SFS 2026:316 and Bolagsverket's certificate procedure and fee; foreign direct investment thresholds and timelines; warrant programme mechanics; and any 2026 proposal to widen the qualified employee stock option limits (none found).

### Gaps: intellectual property

**[GAP]** Not verified for intellectual property: the Swedish default for non-software works created by employees; Upphovsrättslagen 49 § conditions and 53–54 §§ sanctions; the subject of SFS 2026:1120; the 1995 collective agreement on employee inventions; the content of the Advocate General's Opinion in C-250/25 beyond secondary commentary; AI Act Article 53 copyright duties; domain procedures other than .se; and patents.

### Gaps: employment

**[GAP]** Not verified for employment law: labour-law criteria for employee status; employer of record and agency-work rules; the collective-agreement landscape and pension obligations; LAS amendments after SFS 2022:836; the Platform Work Directive implementation; AD 2026 nr 40; the full PTK compensation formula; the new wording of Föräldraledighetslagen 7 § from 1 July 2028; sick pay, work-environment and remote-work rules; the enacted shape and date of Swedish pay-transparency rules; and the employee-data points listed as unverified in section 8.

### Gaps: disputes

**[GAP]** Not verified for disputes: the debt-collection act; payment-order application content and Kronofogden enforcement fees; whether Kronofogden handles claims under an arbitration clause when the debtor objects; the European Small Claims Procedure; Brussels I recast; enforcement of arbitral awards; interim measures; Patent- och marknadsdomstolen procedures; and the 2027 price base amount.

### Gaps: privacy

**[GAP]** Not verified for privacy: Dataskyddslagen (2018:218) in full; the cookie rule in LEK and PTS cookie practice and guidance; the IMY decisions themselves, including whether Miljödata was fined as controller or processor; IMY's AI guidance and DPIA list; the items seen only as IMY feed headlines; earlier IMY fine amounts; EDPB 2025–2026 guidelines; GDPR Articles 8, 9, 10, 15 to 22 and the two-month extension rule; the standard contractual clauses decision; the status of C-703/25 P after June 2026; and the Digital Omnibus texts themselves.

### Gaps: AI regulation

**[GAP]** Not verified for AI regulation: the AI Act's own articles on roles, prohibited practices, Article 50 content, general-purpose model duties, high-risk duties and penalty tiers beyond the two tiers repeated in a Swedish press release; the parts of Regulation (EU) 2026/1744 not read (Articles 6, 10, 49, 50(7), 4a, 60a, AI Office powers); who supervises AI in Sweden from 1 January 2027; Swedish penalty levels and fine mechanism; high-risk classification guidelines and harmonised standards; the Product Liability Directive text; and the status of the withdrawn AI Liability Directive.

### Gaps: digital regulation and sector rules

**[GAP]** Not verified for digital regulation and sector rules: the DSA tier structure beyond Articles 6, 11, 12, 14, 16, 17 and 19; the Digital Markets Act; the Data Governance Act; NIS2 sector scope, Swedish sanction amounts, the registration deadline and MCF's regulations; the Cyber Resilience Act; the European Accessibility Act; eIDAS 2 and the Swedish wallet; DORA and its technical standards; health-sector rules; procurement thresholds; and secrecy-act practice on cloud services.

### Gaps: sanctions, export control, bribery, competition

**[GAP]** Not verified for financial crime and trade: export control in its entirety, including Regulation (EU) 2021/821, its Annex I, encryption, cloud delivery and AI-specific controls; the EU sanctions regulations and the latest Russia package; sections 4 to 9 of the 2025 sanctions act in full; what SFS 2026:1023 changes in the AML Act; the services listed in the AML Act's 4 § second paragraph; the EU Anti-Corruption Directive and its link to SFS 2026:1318; the earlier minimum penalty for gross bribery; corporate fines; the private-sector and intermediary sections of the IMM code; Konkurrensverket guidance and merger thresholds; and US and UK extraterritorial rules.

### Gaps: legal operations and AI in legal work

**[GAP]** Not verified for legal operations and AI in legal work: any benchmark for a small in-house team; ACC survey figures; the full CLOC report; contract-management tool market data; any legal-AI benchmark on Swedish or EU law; the Vals report itself; the peer-reviewed Stanford paper; Bar disciplinary decisions and court practice directions on AI; the Swedish and EU privilege rules, held only as background; the ABA and SRA materials; and any authority for numeric sign-off thresholds.

## Conclusion

**[INFERENCE]** The research changes the picture of what "foundational knowledge" means for a legal agent. The statute book for a Swedish SaaS company turned out to be the easy part: once the primary texts were opened, the company-law, GDPR, limitation, marketing, trademark and bribery rules confirmed with only three corrections, and they are stable enough to load as durable entries. The hard part is everything that moves or was never reachable: a supervisory set-up for AI that expires in seven weeks with no successor on record, a product-liability act two weeks from a vote, consumer and pay-transparency rules without a Swedish date, and whole domains (export control, investment documents, cookies in practice) where the honest entry is a gap. An agent that knows which of its entries are which is safer than one that knows more law.

**[INFERENCE]** That points to where the department's value lies. The evidence on legal AI says a tool can now match or beat a lawyer's average on bounded research questions and still miss one answer in five, and Swedish in-house work has no privilege to hide a bad log behind. The durable design is therefore procedural: one drafter, one separate checker, a status tag on every rule, a calendar that treats 2 December 2026, 31 December 2026, 1 January 2027 and 12 January 2027 as work items, and a human lawyer whose sign-off is an actual review. The first maintenance task for this knowledge base is to close its largest gaps on primary text, starting with export control, Dataskyddslagen and the cookie rule, and to re-verify every fast-moving entry before the end of 2026.
