---
id: legal.financial-crime.sanctions-export-aml-bribery-competition
department: legal
domain: financial-crime
title: 'Legal: Sanctions, export control, anti-money-laundering scope, anti-bribery and competition'
summary: 'Sanctions, export control, anti-money-laundering scope, anti-bribery and competition: no size threshold, Sweden''s
  2025 sanctions act (lag 2025:327), EU and US sanctions, export control (not retrieved), why a SaaS company is normally outside
  the AML Act, bribery offences in Brottsbalken, the IMM business code on gifts and hospitality, competition-law basics and
  escalation triggers. Orientation as of 11 November 2026, not legal advice.'
type: policy
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
- eu
- us
objectives:
- compliance
sources:
- https://rkrattsbaser.gov.se/sfst?bet=2025:327
- https://data.riksdagen.se/dokumentlista/?sok=internationella+sanktioner&doktyp=sfs&from=2025-01-01&utformat=json
- https://eur-lex.europa.eu/eli/reg/2014/269/oj
- https://eur-lex.europa.eu/eli/reg/2014/833/oj
- https://www.sanctionsmap.eu/
- https://ofac.treasury.gov/
- https://eur-lex.europa.eu/eli/reg/1996/2271/oj
- https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions
- https://eur-lex.europa.eu/eli/reg/2021/821/oj
- https://www.isp.se/
- https://rkrattsbaser.gov.se/sfst?bet=2017:630
- https://eur-lex.europa.eu/eli/reg/2024/1624/oj
- https://www.vinge.se/media/yehdv0ey/contentious-regulatory-2026-2025-helår-v2-final.pdf
- https://rkrattsbaser.gov.se/sfst?bet=1962:700
- https://www.institutetmotmutor.se/naringslivskoden/
- http://immse.wpenginepowered.com/wp-content/uploads/2020/10/IMM-Code-to-prevent-corruption-in-business.pdf
- https://rkrattsbaser.gov.se/sfst?bet=2008:579
- https://www.konkurrensverket.se/
- https://curia.europa.eu/juris/liste.jsf?num=C-550/07
seed_version: 1
cross_refs:
  '4':
  - legal.contracts.routine-documents
  '5':
  - legal.contracts.ai-contract-terms
---

**When to use this:** For sanctions screening, export control, anti-money-laundering scope, bribery, gifts and hospitality, and competition-law questions.

**Source section:** 14. Sanctions, export control, anti-money-laundering scope, anti-bribery and competition

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
