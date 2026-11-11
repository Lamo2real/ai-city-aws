---
id: research.desk-research.desk-research
department: research
domain: desk-research
title: 'Research: Desk research'
summary: 'Desk research: judge sources by leaving them and tracing claims to origin. Evaluating a source; Search strategy and review discipline.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- web
objectives:
- evidence
sources:
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3048994
- https://hapgood.us/2019/06/19/sift-the-four-moves/
- https://en.wikipedia.org/wiki/Admiralty_code
- https://archive.dni.gov/files/documents/ICD/ICD-203.pdf
- https://esomar.org/representation/icc-esomar-code-of-conduct
- https://researchworld.com/articles/why-the-icc-esomar-code-will-matter-more-than-ever-in-2026
- https://www.norc.org/content/dam/norc-org/pdf2026/cpss-research-brief-fraud-lit-review.pdf
- https://library.csuchico.edu/sites/default/files/craap-test.pdf
- https://developers.google.com/search/docs/monitor-debug/search-operators
- https://www.bmj.com/content/372/bmj.n71
- https://www.prisma-statement.org/prisma-2020
- https://www.bmj.com/content/384/bmj-2023-076335
related:
- research.ai-research.reliable-ai-assisted-research
- research.academic-tech.academic-and-technology-research
seed_version: 1
---

**When to use this:** When judging whether a source, statistic or claim can be trusted, and when planning a search strategy or review.

**Source section:** 2. Desk research: judge sources by leaving them and tracing claims to origin

## 2. Desk research: judge sources by leaving them and tracing claims to origin

### 2.1 Evaluating a source

[DURABLE] Read laterally. A 2017 Stanford History Education Group study of 45 people (10 professional fact-checkers, 10 PhD historians and 25 Stanford undergraduates) found that fact-checkers left the site quickly, opened new tabs and used other sources to judge it, and reached more warranted conclusions in less time, while historians and students stayed on the page and were misled by logos and domain names ([SSRN, Lateral Reading, 2017](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3048994)). An agent should judge an unfamiliar site by what others say about it, not by how it presents itself.

[DURABLE] Apply the four SIFT moves (Caulfield, 2019) to any unfamiliar source: stop and ask whether the source and its reputation are known and what the purpose is; investigate the source, meaning who publishes it and what they know and want, in about a minute; find better coverage by setting the source aside and comparing trusted reporting on the claim; and trace claims, quotes and media back to their original context to see what was cut or reframed ([Mike Caulfield, SIFT](https://hapgood.us/2019/06/19/sift-the-four-moves/)). This is a practitioner method, not a tested standard.

[DURABLE] Rate the source and the item separately. The Admiralty (NATO) system grades source reliability A to F (A completely reliable, E unreliable, F cannot be judged) and information credibility 1 to 6 (1 confirmed by independent sources, 2 probably true, 3 possibly true, 4 doubtful, 5 improbable, 6 cannot be judged), and a source's grade must not determine the grade of a given item ([Wikipedia, Admiralty code](https://en.wikipedia.org/wiki/Admiralty_code)). The description was read on a tertiary source.

[DURABLE] Follow the ICD 203 tradecraft standards that bear on desk research: describe the quality and credibility of sources, data and methods; distinguish underlying information from assumptions and judgments; include analysis of alternatives; and explain change from, or consistency with, earlier judgments ([ICD 203, Analytic Standards](https://archive.dni.gov/files/documents/ICD/ICD-203.pdf)). The directive is dated 2 January 2015 and carries later technical amendments; the extracted text showed amendment dates in 2022 and 12 June 2023, which the researchers could not disambiguate, and the PDF is now served from archive.dni.gov.

[FAST-MOVING, 2025] Honour the secondary-data duties of the ICC/ESOMAR Code, 2025 revision. Article 5 requires that use of secondary data be compatible with the original collection purpose, respect original exclusions and intellectual-property rights, cause no direct harm, and honour data subjects' requests against re-use ([ESOMAR, ICC/ESOMAR Code](https://esomar.org/representation/icc-esomar-code-of-conduct)). A secondary source reports that the revision was approved in June 2025 and replaced the 2016 version ([Research World](https://researchworld.com/articles/why-the-icc-esomar-code-will-matter-more-than-ever-in-2026)); the month was not on ESOMAR's own page.

[FAST-MOVING, April 2026] Treat third-party "a survey says" statistics from non-probability samples as lower-reliability unless fraud controls are disclosed. NORC's April 2026 literature review reports industry estimates of fraud at 15 to 30% of market-research responses and up to 45% on some platforms, and several case studies of social-media-recruited, incentivised open surveys with over 90% fraudulent responses ([NORC, April 2026](https://www.norc.org/content/dam/norc-org/pdf2026/cpss-research-brief-fraud-lit-review.pdf)).

[INFERENCE] Working reliability hierarchy for business desk research, highest first: official statistics and registers, audited annual reports and regulatory filings; peer-reviewed research and standards bodies; a company's primary statements about itself such as press releases, pricing pages and job ads, which are reliable for what the company says and not for what is true; reputable trade press and analyst firms with a disclosed method; vendor white papers and surveys, where sample and method must be checked; and last, aggregators, SEO blogs, unsourced statistics and AI-generated summaries. The ranking is the researchers' synthesis applying the Admiralty logic and SIFT's trace-to-origin move.

[INFERENCE] Primary versus secondary source: a primary source is the originator of the data or statement (the register, the dataset, the filing, the paper), and a secondary source reports or interprets it. Agent rule: cite the primary; if only a secondary is reachable, write "as reported by" the secondary and lower confidence. The definition was not sourced in the research; it is consistent with SIFT's fourth move.

[INFERENCE] Triangulation rule: two sources count as independent only if they do not share an upstream origin, so five articles quoting one vendor report are one source. When sources conflict, first check definitions, units, geography and date; then prefer the source closest to the origin with a disclosed method; and if the conflict is unresolved, report the range and both sources instead of averaging silently. This applies ICD 203's analysis of alternatives.

[GAP] The CRAAP test was not verified. Its criteria are commonly given as currency, relevance, authority, accuracy and purpose, but the wording was not checked; verify at https://library.csuchico.edu/sites/default/files/craap-test.pdf before using it. ICD 206 on sourcing requirements returned no readable text, so its citation rules are not captured.

### 2.2 Search strategy and review discipline

[DURABLE] Use only search operators whose behaviour is documented, and never treat an empty result as proof of absence. Google documents `site:` (domain, URL or prefix) and `filetype:` (content type or extension), plus `imagesize:` and `src:` for Google Images only, and states that operators are bound by indexing and retrieval limits ([Google Search Central, Search operators](https://developers.google.com/search/docs/monitor-debug/search-operators)). No fetched source covered other operators such as `intitle:`, quoted phrases or exclusion terms.

[DURABLE] Report searches so that they can be repeated. PRISMA 2020, published in the BMJ on 29 March 2021, is a 27-item checklist in seven sections that requires the full search strategy for every database, register and website searched, how many reviewers screened each record and whether independently, any automation tools used, and whether data, code and materials are public ([BMJ 2021;372:n71](https://www.bmj.com/content/372/bmj.n71)). The PRISMA site lists the statement, an explanation paper, an abstract checklist and flow-diagram templates and announces no newer version ([PRISMA 2020](https://www.prisma-statement.org/prisma-2020)).

[FAST-MOVING, 6 Feb 2024] For rapid reviews, apply Cochrane's search rules: search at least two bibliographic databases, limit grey-literature and supplementary searching, peer-review the main search or at least double-check it, justify any date limits, and apply language limits at selection and not in the search ([BMJ 2024, Cochrane rapid review guidance](https://www.bmj.com/content/384/bmj-2023-076335)).

[INFERENCE] Search-strategy checklist for agents: define concepts and synonyms in Swedish and English; combine `site:` with official domains (scb.se, bolagsverket.se, ec.europa.eu, vinnova.se, riksdagen.se) and `filetype:pdf` for reports and grey literature; log every query; and search at least two independent indexes for anything important, borrowing the Cochrane two-database minimum. Keep queries short, vary phrasing, search in the source language (Swedish for Swedish law), go to the issuing body's own domain, and fetch the page instead of trusting the snippet.

[INFERENCE] Citation record for agents: every claim carries URL, publisher, publication or last-updated date, access date and a one-word source class. For Eurostat and SCB pulls, also store the dataset code, the query and the retrieval timestamp, because Eurostat keeps no version history.

[GAP] No source was retrieved on Swedish grey-literature sources (government inquiries in the SOU series, Tillväxtanalys, Tillväxtverket), on search-engine coverage limits or ranking bias, or on contamination of search results by AI-generated content.
