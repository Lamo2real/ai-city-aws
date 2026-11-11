---
id: research.academic-tech.academic-and-technology-research
department: research
domain: academic-tech
title: 'Research: Academic and technology research'
summary: 'Academic and technology research: label the evidence grade. Systematic and rapid reviews; Reading papers and handling preprints; Technology readiness, scouting and patents.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- scholarly-apis
objectives:
- evidence
sources:
- https://www.bmj.com/content/372/bmj.n71
- https://www.bmj.com/content/384/bmj-2023-076335
- https://elifesciences.org/articles/48175
- https://retractionwatch.com/2026/04/30/are-ai-chatbots-infiltrating-online-survey-data-not-yet-says-new-study/
- https://www.gov.uk/government/publications/the-magenta-book
- https://ec.europa.eu/research/participants/data/ref/h2020/wp/2014_2015/annexes/h2020-wp1415-annex-g-trl_en.pdf
- https://www.wipo.int/web/patent-analytics
- https://www.epo.org/en/searching-for-patents/technical/espacenet
related:
- research.ai-research.reliable-ai-assisted-research
- research.data-sources.public-data-sources
cross_refs:
  '3':
  - research.data-sources.public-data-sources
  '11':
  - research.ai-research.reliable-ai-assisted-research
seed_version: 1
---

**When to use this:** When reviewing literature, reading papers and preprints, judging technology readiness, scouting technology or searching patents.

**Source section:** 9. Academic and technology research: label the evidence grade

## 9. Academic and technology research: label the evidence grade

### 9.1 Systematic and rapid reviews

[DURABLE] Report systematic reviews to PRISMA 2020: a 27-item checklist in seven sections plus an abstract checklist. Compared with the 2009 version it adds full search strategies for all sources, reporting of reviewers, independence and automation at screening, certainty-of-evidence items, competing interests, and data and code availability; protocol and registration information sits in an "Other" section; and flow-diagram templates exist for original and updated reviews ([BMJ 2021;372:n71](https://www.bmj.com/content/372/bmj.n71)).

[FAST-MOVING, 6 Feb 2024] A rapid review, in Cochrane's 2024 definition, is an evidence synthesis that accelerates the systematic-review process by streamlining or omitting methods that the authors must clearly define; scope and methods vary by need ([BMJ 2024, Cochrane rapid review guidance](https://www.bmj.com/content/384/bmj-2023-076335)).

[FAST-MOVING, 6 Feb 2024] Cochrane's rapid-review shortcuts for screening: pilot on 50 to 100 records, have two reviewers screen at least 20% of records and check agreement, and let a single reviewer continue if kappa is at least 0.8; the guidance acknowledges that the 20% figure rests on experience and not evidence ([BMJ 2024, Cochrane rapid review guidance](https://www.bmj.com/content/384/bmj-2023-076335)).

[FAST-MOVING, 6 Feb 2024] Cochrane's rapid-review shortcuts for extraction and synthesis: extract only the most important fields, with one extractor and a second verifying critical data; reuse good existing systematic reviews instead of re-extracting primary studies; do not skip risk-of-bias assessment, but use one assessor with verification focused on the most important outcomes; write a narrative synthesis around the question's elements, with meta-analysis only if the data allow; and limit certainty grading to the main comparison and critical outcomes if time is short ([BMJ 2024, Cochrane rapid review guidance](https://www.bmj.com/content/384/bmj-2023-076335)).

[INFERENCE] Rapid-review protocol for a business question, adapted from Cochrane: write the question and inclusion criteria first; search two or more indexes plus targeted grey literature; log queries; calibrate two worker agents on 50 to 100 records, dual-screen 20% and proceed singly only at high agreement; use single extraction with second-agent verification of key numbers; rate each source's quality; write a narrative synthesis; and list every shortcut taken. Time-box to days or weeks, far under Cochrane's six-month ceiling; that duration is the researchers' estimate.

### 9.2 Reading papers and handling preprints

[DURABLE] When reading an empirical paper, look for the weaknesses the eLife list names: a missing control group, underpowered samples, flexible analysis, uncorrected multiple comparisons, circular analysis and causal language from correlations ([eLife, 2019](https://elifesciences.org/articles/48175)).

[FAST-MOVING, 30 Apr 2026] Use the April 2026 Prolific survey-bot study as the worked example of why preprints need labels: it was not peer-reviewed, was funded by and partly authored at the sample vendor concerned, used a proprietary detector unavailable to outside researchers, and was reported as news while an academic whose peer-reviewed paper it disputes said its claims cannot be externally verified ([Retraction Watch, 30 Apr 2026](https://retractionwatch.com/2026/04/30/are-ai-chatbots-infiltrating-online-survey-data-not-yet-says-new-study/)).

[FAST-MOVING, December 2024] When assessing claims about AI tools, note that the UK government added a supplementary guide on impact evaluation of AI interventions to the Magenta Book set in December 2024 ([GOV.UK, The Magenta Book](https://www.gov.uk/government/publications/the-magenta-book)). Its content was not read.

[INFERENCE] Paper triage for agents, background practice: read title, abstract, figures and conclusion first; then check venue and peer-review status, funding and conflicts, sample size and design, whether data and code are available, and whether the headline claim matches the results; only then read the methods in full. Keshav's three-pass method was not retrieved.

[INFERENCE] Preprint rule: cite a preprint as "[preprint, not peer-reviewed]", check whether a published version exists, never use one as the sole support for a decision-relevant claim, and lower confidence one level. Peer review is a filter and not a guarantee, so apply the eLife checklist either way. Several key sources in this knowledge base are themselves arXiv preprints and are labelled as such in section 11.

### 9.3 Technology readiness, scouting and patents

[DURABLE] Grade technology maturity on the EU Technology Readiness Level scale (Horizon 2020 General Annex G, 2014): TRL 1 basic principles observed; 2 technology concept formulated; 3 experimental proof of concept; 4 technology validated in lab; 5 technology validated in relevant environment; 6 technology demonstrated in relevant environment; 7 system prototype demonstration in operational environment; 8 system complete and qualified; 9 actual system proven in operational environment ([European Commission, H2020 Annex G](https://ec.europa.eu/research/participants/data/ref/h2020/wp/2014_2015/annexes/h2020-wp1415-annex-g-trl_en.pdf)). The current Horizon Europe wording was not checked.

[DURABLE] A patent landscape report gives an overview of patenting activity in a technology field in a country, a region or worldwide, and patent analytics has three stages: obtain the data, evaluate it for patterns, present the results ([WIPO, Patent analytics](https://www.wipo.int/web/patent-analytics)). Espacenet's families and legal-event data, with CPC classification as the search backbone, are the free working tools ([EPO, Espacenet](https://www.epo.org/en/searching-for-patents/technical/espacenet)).

[INFERENCE] [GAP] Patent-landscape cautions, not sourced in the research: applications normally publish about 18 months after filing, so the most recent period is under-counted; count patent families and not individual documents; patent volume is not commercial strength; combine CPC classes with keywords; and check legal status before treating a patent as a barrier. Verify the 18-month point before quoting it.

[INFERENCE] Technology-scouting sources for a Swedish SaaS company: scholarly indexes and preprint servers, Espacenet and PATENTSCOPE, funded-project databases (Vinnova, verified in section 3; EU CORDIS, not verified), standards bodies, open-source repositories, job ads and conference programmes. Give each candidate a TRL with a note of the evidence for it; because TRL was designed for hardware-style technologies, state what "operational environment" means for software, for example production use at paying customers. No source was retrieved on scouting process standards or hype-cycle-type maturity frameworks.
