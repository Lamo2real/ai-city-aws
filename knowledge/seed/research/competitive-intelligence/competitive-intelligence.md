---
id: research.competitive-intelligence.competitive-intelligence
department: research
domain: competitive-intelligence
title: 'Research: Competitive intelligence'
summary: 'Competitive intelligence: public sources, honest methods, hard stops. Ethical baseline; Trade-secret law (EU and Sweden); Competition law and inside information; Competitor profiles, tracking and win/loss.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- web
objectives:
- compliance
- evidence
sources:
- https://www.scip.org/page/CodeofEthics
- https://www.aqute.com/blog/is-it-impossible-to-stick-to-scips-code-of-ethics
- https://esomar.org/representation/icc-esomar-code-of-conduct
- https://archive.dni.gov/files/documents/ICD/ICD-203.pdf
- https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016L0943
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/
- https://www.konkurrensverket.se/globalassets/dokument/informationsmaterial/rapporter-och-broschyrer/informationsmaterial/konkurrera_pa_ratt_satt2015.pdf
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0596
- https://www.taylorwessing.com/de/campaigns/de/2025/ai-and-copyright-tracker
- https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html
- https://www.epo.org/en/searching-for-patents/technical/espacenet
- https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/
- https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program
related:
- research.guardrails.agent-guardrails
- research.compliance.web-scraping-and-data-access
- research.security.confidential-information
seed_version: 1
---

**When to use this:** Before any competitor research: what public sources and honest methods allow, trade-secret and competition-law hard stops, competitor profiles and win/loss.

**Source section:** 5. Competitive intelligence: public sources, honest methods, hard stops

## 5. Competitive intelligence: public sources, honest methods, hard stops

### 5.1 Ethical baseline

[DURABLE] Hold competitive-intelligence work to the SCIP Code of Ethics as a minimum. Its seven points are to elevate the profession; comply with all applicable domestic and international laws; be transparent by disclosing identity, organisation and all relevant information before any interview; avoid conflicts of interest; give honest, realistic recommendations and conclusions; act as an ambassador for the code inside the company and with contractors; and stay aligned with company policies, objectives and guidelines ([SCIP, Code of Ethics](https://www.scip.org/page/CodeofEthics)). The page gave no date for the current code.

[CONTESTED] The SCIP code is criticised as vague at the points agents will hit. A CI consultancy blog argues that "all relevant information" and "interview" are undefined, that the code is unclear on visiting competitor sites, viewing LinkedIn profiles or registering for gated downloads with a throwaway address, and that disclosure does not settle the issue of obtaining information a competitor expects to keep confidential ([Aqute](https://www.aqute.com/blog/is-it-impossible-to-stick-to-scips-code-of-ethics)). This is opinion from an undated blog; it is the reason the department needs its own explicit rules.

[FAST-MOVING, 2025] The ICC/ESOMAR Code's fifth principle keeps overall responsibility and oversight with the researcher whatever method or technology is used, with contributors responsible in line with their activity, expertise and control; Article 10 requires fair competition and declared conflicts of interest; Article 4 requires researchers to identify themselves in primary data collection ([ESOMAR, ICC/ESOMAR Code](https://esomar.org/representation/icc-esomar-code-of-conduct)). Outsourcing or automating collection does not move the responsibility.

[DURABLE] Apply intelligence tradecraft to competitor assessments: state source quality, separate facts from assumptions and judgments, include analysis of alternatives, explain changes from earlier judgments and express uncertainty ([ICD 203](https://archive.dni.gov/files/documents/ICD/ICD-203.pdf)). Add the forecasting habit of acknowledging the strongest opposing case and deciding beforehand what evidence would change the assessment ([Good Judgment, 10 commandments](https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/)).

### 5.2 Trade-secret law (EU and Sweden)

[DURABLE] EU Trade Secrets Directive 2016/943, checked on primary source: a trade secret is information that is secret, commercially valuable because it is secret, and subject to reasonable protective steps (Article 2(1)). Lawful acquisition includes independent discovery, studying or reverse-engineering a product that is publicly available or lawfully held, and other honest commercial practices (Article 3). Unlawful acquisition includes unauthorised access to or copying of documents or files and conduct contrary to honest commercial practices, and use is also unlawful for a recipient who knew or should have known the secret came from an unlawful source (Article 4) ([EUR-Lex 32016L0943](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016L0943)).

[DURABLE] Swedish lag (2018:558) om företagshemligheter, consolidated to SFS 2025:1281, checked on primary source: under 2 § a trade secret is information on a trader's or research institution's business or operating conditions that is not generally known or readily accessible to those who normally handle such information, that the holder has taken reasonable steps to keep secret, and whose disclosure is likely to cause competitive harm. An employee's ordinary experience and skills are excluded, and information about a crime or other serious wrongdoing is not a trade secret ([riksdagen.se SFS 2018:558](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

[DURABLE] Under the Swedish trade-secrets act, checked on primary source, an attack is acquiring, using or disclosing the secret without the holder's consent (3 §), and only unauthorised attacks are covered; disclosure to publish or report suspected crime punishable by prison, or other wrongdoing in the public interest, is never unauthorised (4 §) ([riksdagen.se SFS 2018:558](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

[DURABLE] Criminal liability under the Swedish trade-secrets act, checked on primary source: företagsspioneri, intentionally and unlawfully obtaining access to a trade secret, carries a fine or prison up to 2 years, and 6 months to 6 years if gross (26 §); unlawful use or disclosure of a technical trade secret obtained through employment or a business relationship carries a fine or up to 2 years, 6 months to 6 years if gross, with no liability in minor cases (26 a §); olovlig befattning, intentionally acquiring a secret knowing that the provider or someone earlier in the chain obtained it by företagsspioneri, carries a fine or up to 2 years, up to 4 years if gross (27 §) ([riksdagen.se SFS 2018:558](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

[DURABLE] Damages under the Swedish trade-secrets act, checked on primary source: 5 to 11 §§ provide for damages, including 9 § liability for someone who knows or should know that an earlier party attacked the secret, and 24 § limits damages to harm in the five years before the claim ([riksdagen.se SFS 2018:558](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

[INFERENCE] The Swedish act puts criminal liability on two points an agent can hit: getting access (26 §) and taking delivery of something already stolen (27 §). Because 9 § uses a knows-or-should-know test, an agent log showing that a document looked confidential and was still used would be evidence against the company. If a leaked or confidential-looking competitor document surfaces, do not open it further, summarise it or store it; stop and report to Legal.

[INFERENCE] Lawful competitive intelligence in Sweden follows from 2 §: information that is generally known or readily accessible is not a trade secret, so public pricing pages, filings, patents, job ads and marketing material are safe on trade-secret grounds. Copyright, database right, contract terms and GDPR still apply to how that material is collected and reused.

### 5.3 Competition law and inside information

[DURABLE] Swedish competition guidance, checked on a primary source but thinly: Konkurrensverket's 2015 brochure tells companies not to exchange strategically important information and not to exchange information on prices or other sensitive, strategic information with competitors; only these two lines were extracted ([Konkurrensverket, 2015](https://www.konkurrensverket.se/globalassets/dokument/informationsmaterial/rapporter-och-broschyrer/informationsmaterial/konkurrera_pa_ratt_satt2015.pdf)).

[INFERENCE] [GAP] Competition-law line, unverified background: collecting a competitor's public information unilaterally is permitted, while receiving or swapping non-public, forward-looking commercial information with a competitor, directly or through a customer, trade body or shared tool, is the risk. The EU Horizontal Guidelines 2023 chapter on information exchange (https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:52023XC0721(01)) and konkurrenslagen (2008:579) 2 kap. 1 § were not read. Agents must never contact a competitor to ask for pricing or plans and must not relay information between competitors.

[DURABLE] EU Market Abuse Regulation 596/2014, checked on primary source: inside information is precise, non-public, related to an issuer or instrument and likely to affect prices significantly (Article 7); trading on it, recommending on its basis and disclosing it outside normal duties are prohibited (Articles 8, 10 and 14); issuers and those acting for them keep insider lists, retained five years (Article 18) ([EUR-Lex 32014R0596](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0596)).

[DURABLE] Research built on public data is not in itself inside information, per recital 28 of the Market Abuse Regulation, checked on primary source, but it can become so where the market routinely expects its publication or it comes from a recognised commentator able to move prices ([EUR-Lex 32014R0596](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0596)).

[FAST-MOVING, 22 Oct 2025] A Danish court in BoligPortal v ReData (22 October 2025) treated scraping a competitor's database as contrary to good marketing practice as well as an infringement of database right; secondary source only ([Taylor Wessing tracker](https://www.taylorwessing.com/de/campaigns/de/2025/ai-and-copyright-tracker)). This is the only Nordic ruling in the research and shows that scraping a competitor carries marketing-law risk in a neighbouring jurisdiction.

[INFERENCE] For a listed employer or client, internal non-public research material may itself need insider-list handling; agents should not mix it into outputs meant for wider circulation, and non-public information about any listed company is a stop-and-escalate trigger.

### 5.4 Competitor profiles, tracking and win/loss

[FAST-MOVING, 3 Feb 2025] Free inputs for a Swedish competitor profile are registration data, status, SNI codes and digitally filed annual reports from Bolagsverket and SCB, free since 3 February 2025 ([Bolagsverket](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)), patent families and legal-event data from Espacenet ([EPO](https://www.epo.org/en/searching-for-patents/technical/espacenet)), and public funding records from Vinnova ([Vinnova](https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/)).

[INFERENCE] Competitor profile template, unsourced common practice: identity and ownership; financials from filings; product and feature matrix; pricing and packaging with dated screenshots; target segments and positioning; go-to-market and partners; hiring signals from job ads; technology and intellectual property; customer evidence from reviews and case studies; strategy hypotheses with confidence; indicators of what would change the view; and a last-verified date per field.

[INFERENCE] Pricing and feature tracking: capture dated snapshots of public pricing pages, changelogs, release notes and documentation on a fixed schedule; record changes as events with date, before, after and source URL; and never infer discounting from list prices alone. Unsourced common practice.

[VENDOR] [FAST-MOVING, 20 Jul 2026] Klue, a competitive-intelligence software vendor, defines win/loss analysis as the systematic practice of finding out why a buyer chose you or a competitor and using it for positioning, messaging and product decisions; its data sources are structured buyer interviews, seller interviews, surveys, sales-call analysis and the CRM record ([Klue, 20 Jul 2026](https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program)).

[VENDOR] [FAST-MOVING, 20 Jul 2026] Klue's four programme steps for win/loss are to define coverage first (every closed competitive deal, a sample, or only escalated deals, with programmes tending to slide to the last); match method to deal stakes (human interviews for strategic accounts, AI-led interviews for breadth, automated call and CRM analysis for patterns); name an owner who can update battlecards, brief sellers and flag product issues; and set a cadence that revisits top competitors at least quarterly and sooner after a major competitor move ([Klue, 20 Jul 2026](https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program)).

[VENDOR] [FAST-MOVING, 20 Jul 2026] Klue names three win/loss pitfalls: measuring activity such as interviews done and reports delivered instead of outcomes, having no route from finding to update, and limiting coverage to the deals sellers remember to flag ([Klue, 20 Jul 2026](https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program)).

[INFERENCE] Win/loss practice for the department, unsourced: interview buyers from both won and lost deals soon after the decision, ideally by someone outside the sales team, with a consistent guide covering trigger, alternatives considered, decision criteria and weights, perceived strengths and weaknesses, the role of price and the decision process; code reasons thematically; report rates by segment and competitor with counts; and avoid percentages on fewer than about 30 deals, which is the researchers' rule of thumb. Coverage bias is a sampling problem, so report which deals were eligible, which were covered and how they were selected.

[INFERENCE] A win/loss or customer interview must not turn into a sales pitch without fresh consent, because ICC/ESOMAR Article 1 requires research to be kept clearly separate from non-research activity such as selling ([ESOMAR](https://esomar.org/representation/icc-esomar-code-of-conduct)); interviews run by sales staff sit close to this line.

[INFERENCE] [GAP] Battlecards, war-gaming and monitoring cadence have no retrieved source. As unsourced defaults: a battlecard is one page per competitor covering where we win, where we lose, objection responses, proof points, pricing position, last-updated date and owner, with every claim linked to evidence and a review date; a war-game role-plays the company, two or three competitors and the customer over two or three move rounds and yields likely responses and early-warning indicators, not a prediction; a suggested cadence is continuous alerts for pricing, product, funding and leadership events, a weekly digest, a monthly battlecard review, a quarterly profile refresh and win/loss synthesis, and an annual war-game.
