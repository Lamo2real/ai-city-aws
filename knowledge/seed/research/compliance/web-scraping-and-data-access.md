---
id: research.compliance.web-scraping-and-data-access
department: research
domain: compliance
title: 'Research: Web scraping and data access'
summary: 'Web scraping and data access: any technical barrier is a stop sign. Data-protection regulators'' position; Swedish criminal law on access; United States decisions and why they do not transfer.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- web
objectives:
- compliance
sources:
- https://www.cnil.fr/en/legal-basis-legitimate-interests-focus-sheet-measures-implement-case-data-collection-web-scraping
- https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf
- https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf
- https://www.imy.se/verksamhet/dataskydd/innovationsportalen/vagledning-om-gdpr-och-ai/
- https://lagen.nu/1962:700
- https://www.fbm.com/technology/publications/major-decision-affects-law-of-scraping-and-online-data-collection-meta-platforms-v-bright-data/
- https://www.davispolk.com/insights/client-update/recent-district-court-decision-casts-doubt-terms-use-barring-data-scraping
- https://en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn
- https://www.zwillgen.com/alternative-data/how-artificial-intelligence-shaping-web-scraping-litigation/
related:
- research.compliance.copyright-and-text-and-data-mining
- research.guardrails.agent-guardrails
- research.compliance.personal-data-in-research
seed_version: 1
---

**When to use this:** Before any scraping or automated collection: any technical barrier is a stop sign; regulators' positions, Swedish criminal law on access and why US decisions do not transfer. Orientation for a human to confirm, not legal advice.

**Source section:** 13. Web scraping and data access: any technical barrier is a stop sign

## 13. Web scraping and data access: any technical barrier is a stop sign

### 13.1 Data-protection regulators' position

[INFERENCE] No single rule makes scraping lawful or unlawful; the answer is the combined result of contract, database right, copyright, GDPR and computer-misuse law. This framing is the researchers' synthesis of the sources in this section; no single source states it.

[FAST-MOVING, 5 Jan 2026] CNIL's focus sheet dated 5 January 2026, checked on primary source, says that scraping under legitimate interest requires defining collection criteria in advance, filtering out unneeded categories, deleting irrelevant data at once, and excluding sites that oppose scraping through robots.txt or CAPTCHA, because collection from such sites cannot fall within people's reasonable expectations. Recommended extras are an exclusion list of sensitive sites, collecting only freely accessible data, public notice, a prior objection route and prompt pseudonymisation ([CNIL](https://www.cnil.fr/en/legal-basis-legitimate-interests-focus-sheet-measures-implement-case-data-collection-web-scraping)). CNIL is the French authority; its sheet is persuasive and not binding in Sweden.

[DURABLE] EDPB Opinion 28/2024 (adopted 18 December 2024), checked on primary source: legitimate interest needs a three-step test of a lawful, specific interest, necessity and balancing; a mention in a privacy policy alone does not create reasonable expectations; balancing weighs the nature of the data, context, scale, consequences and reasonable expectations; public availability alone is not decisive; the Article 21 right to object applies; and a deployer should check, in proportion to risk, that a model it uses was not built on unlawful processing ([EDPB Opinion 28/2024](https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf)).

[FAST-MOVING, 7 Jul 2026] EDPB Guidelines 03/2026 on web scraping in the context of generative AI, version 1.0 adopted 7 July 2026 as a consultation version, cover scraping of internet sources by private entities, directly or through a contractor, for training generative AI; other scraping purposes are outside the stated scope. Checked on the primary document through an extraction tool ([EDPB Guidelines 03/2026](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf)). Whether a final version has since been adopted was not found.

[FAST-MOVING, 7 Jul 2026] Main points of EDPB Guidelines 03/2026 on lawfulness: personal data being public online is not consent, and a missing robots.txt is not consent; legitimate interest needs the three cumulative steps; and before collecting, a controller should exclude sites that clearly oppose scraping through technical measures such as login walls, robots.txt or ai.txt files, or CAPTCHA ([EDPB Guidelines 03/2026](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf)).

[FAST-MOVING, 7 Jul 2026] Main points of EDPB Guidelines 03/2026 on minimisation: define collection criteria, map sources, filter out unneeded categories such as financial and location data, exclude sites that structurally hold data on minors or vulnerable people, apply pattern filters after collection, and pseudonymise or anonymise. Special-category data needs an Article 9(2) derogation as well as a legal basis, and incidental residual collection is assessed in light of the controller's preventive measures ([EDPB Guidelines 03/2026](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf)). CNIL adds that incidental residual sensitive data is not unlawful if filtering was applied but must be deleted once noticed ([CNIL, 5 Jan 2026](https://www.cnil.fr/en/legal-basis-legitimate-interests-focus-sheet-measures-implement-case-data-collection-web-scraping)).

[FAST-MOVING, 7 Jul 2026] Main points of EDPB Guidelines 03/2026 on transparency and responsibility: where individual notice is impossible or disproportionate under Article 14(5)(b), publish the information, including sources and crawler characteristics; offer a prior right to object or an opt-out list; a scraper and a later reuser are in principle each responsible for their own processing, and a buyer of scraped datasets should name and link to the original controller; and a published DPIA counts as a protective measure ([EDPB Guidelines 03/2026](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_2020603_webscraping_v1_en_0.pdf)).

[FAST-MOVING, 26 May 2026] The Swedish authority IMY publishes guidance on GDPR and AI (page updated 26 May 2026) with sections on legal basis and AI training, and states that GDPR applies whenever personal data is processed in developing or using AI. Only the overview page was read ([IMY](https://www.imy.se/verksamhet/dataskydd/innovationsportalen/vagledning-om-gdpr-och-ai/)). IMY's detailed position on scraping was not opened.

[INFERENCE] The EDPB guidelines formally cover only generative-AI training, so a research department scraping for market analysis is outside their stated scope; but their legitimate-interest, opt-out-signal, minimisation and Article 14 points restate general GDPR logic and match the CNIL sheet, so the department should apply them by analogy.

### 13.2 Swedish criminal law on access

[DURABLE] Swedish brottsbalken 4 kap. 9 c § (dataintrång), checked on lagen.nu, an unofficial mirror, reading the first part of the page: unlawfully obtaining access to data intended for automated processing, or unlawfully altering, deleting, blocking or entering such data, or seriously disrupting its use, carries a fine or prison up to 2 years; gross dataintrång carries 1 to 8 years, weighing serious damage, a large volume of data or particular danger ([lagen.nu 1962:700](https://lagen.nu/1962:700)).

[INFERENCE] Dataintrång turns on acting without permission. Using credentials not issued to the company, or getting past a login, is the obvious risk; reading openly published pages is not access without permission in the ordinary sense. This is the researchers' reading, and no Swedish case law on scraping was checked.

### 13.3 United States decisions and why they do not transfer

[FAST-MOVING, 23 Jan 2024] Meta v Bright Data (N.D. Cal., 23 January 2024): logged-off scraping of public data did not breach Meta's terms because the scraper was not using the service as a user, a ruling limited to logged-off public data. Secondary source only ([Farella Braun + Martel](https://www.fbm.com/technology/publications/major-decision-affects-law-of-scraping-and-online-data-collection-meta-platforms-v-bright-data/)).

[FAST-MOVING, May 2024] X Corp v Bright Data (N.D. Cal., May 2024): contract and tort claims over scraping public user content were dismissed as pre-empted by the Copyright Act. Secondary source only ([Davis Polk](https://www.davispolk.com/insights/client-update/recent-district-court-decision-casts-doubt-terms-use-barring-data-scraping)).

[DURABLE] hiQ Labs v LinkedIn: hiQ won a preliminary injunction in 2017, the Ninth Circuit affirmed on 9 September 2019, the Supreme Court vacated and remanded on 14 June 2021, the Ninth Circuit reaffirmed in April 2022, and in November 2022 the district court held that hiQ had breached LinkedIn's User Agreement and the parties settled. Read on a tertiary source ([Wikipedia](https://en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn)).

[FAST-MOVING, February 2026] The US litigation trend as of February 2026 is a shift to DMCA section 1201 anti-circumvention claims aimed at bypassing rate limits, CAPTCHAs and identity masking: Reddit v SerpApi and Perplexity (filed 22 October 2025), Google v SerpApi, and Reddit v Anthropic (filed 4 June 2025, pending). Secondary source only ([ZwillGen](https://www.zwillgen.com/alternative-data/how-artificial-intelligence-shaping-web-scraping-litigation/)).

[INFERENCE] US rulings favouring scrapers of public data do not transfer to the EU, where database right and GDPR apply independently. hiQ ended in a contract loss for the scraper despite its win on the computer-crime point; combined with Ryanair, both jurisdictions point to contract as the live risk when scraping public pages.

[INFERENCE] Circumventing a technical barrier is the common trigger across regimes: the EU's lawful-access condition, US anti-circumvention theories, CNIL's and the EDPB's reasonable-expectations reasoning, and Swedish dataintrång. Treat any barrier (login, paywall, CAPTCHA, rate limit, block) as a stop sign that needs human sign-off.

[INFERENCE] Scraping rules for agents: stay logged out unless the account's terms allow automated use; obey robots.txt and AI-preference signals; no CAPTCHA solving, IP rotation to evade blocks, or fake accounts; rate-limit requests; collect no personal data unless the task needs it; and prefer official APIs and bulk downloads.
