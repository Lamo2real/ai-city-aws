---
id: product.localisation.localisation-and-content-design
department: product
domain: localisation
title: 'Product: Localisation and content design'
summary: 'Localisation and content design: internationalisation basics; Swedish date, time, week and number conventions and the formats
  that remain unverified; language continuity across legal and product content; cross-market measurement; content design rules for interface
  text; legally mandated wording; content failures as accessibility failures; a content checklist for agents; what was not sourced.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- launch
sources:
- https://www.w3.org/International/quicktips/
- https://webaim.org/projects/million/
- https://en.wikipedia.org/wiki/Date_and_time_notation_in_Sweden
- https://www.1177.se/Sormland/riktlinjer-och-material/sprakliga-riktlinjer/stavning-skrivregler-stil/skriv-tal-med-bokstaver/
- https://regeringen.se/contentassets/5b473488ef174cff9d6dc405f9da6f1b/myndigheternas-skrivregler
- https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf
- https://www.taylorwessing.com/de/insights-and-events/insights/2026/02/withdrawal-button-as-compliance-risk-for-eu-and-non-eu-businesses
- https://www.nngroup.com/articles/nps-ux/
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://design-system.service.gov.uk/patterns/question-pages/
- https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts
- https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations
- https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/
related: []
seed_version: 1
---

**When to use this:** When writing interface text, localising for Sweden or another market, or handling legally mandated wording.

**Source section:** 20. Localisation and content design

### Internationalisation basics

**[DURABLE; W3C guidance]** W3C's internationalisation quick tips are: use UTF-8 for content, databases and forms, and declare it; declare the language of each page and mark language changes inside it, which supports accessibility, styling and search; avoid text baked into images and check images for cultural bias; label numeric date fields, because day, month and year order varies; do not validate phone numbers on assumed lengths; plan for text to change length in translation; do not build sentences by concatenating strings, and use format strings with numbered placeholders because word order differs between languages; and do not assume that names and addresses follow local rules or over-split address fields ([W3C Internationalization Quick Tips](https://www.w3.org/International/quicktips/)).

**[INFERENCE]** Setting `lang="sv"` or `lang="en"` per page and on inline language switches fixes a WCAG Level A requirement and an internationalisation requirement in one step; missing document language was found on 13.5% of home pages in the February 2026 WebAIM scan ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)).

### Sweden: date, time and week conventions

**[DURABLE; reference summary citing the Swedish language authority's writing rules]** In Sweden numeric dates are written year-month-day, for example 2001-08-31, and long dates use a lowercase month, as in "31 augusti 2001". Weeks start on Monday and week numbers are in everyday use ("vecka 32"); week 1 contains the year's first Thursday. Time uses the 24-hour clock; the traditional separator is a full stop (23.59), and colons also appear because of digital displays ([Wikipedia, Date and time notation in Sweden](https://en.wikipedia.org/wiki/Date_and_time_notation_in_Sweden)). **[INFERENCE]** Swedish interfaces default to year-month-day dates, 24-hour time and a Monday week start, and support week numbers in date pickers. The colon as the usual software separator is the researchers' inference; CLDR locale data was not checked.

### Sweden: numbers in running text

**[DURABLE; Swedish healthcare language guidelines, updated 10 May 2022]** Swedish healthcare writing guidelines say to use digits for decimals or when the figure matters, otherwise to write numbers as words in running text, and to keep one style within a sentence ([1177, Skriv tal med bokstäver, updated 10 May 2022](https://www.1177.se/Sormland/riktlinjer-och-material/sprakliga-riktlinjer/stavning-skrivregler-stil/skriv-tal-med-bokstaver/)).

### Sweden: formats that remain unverified

**[GAP]** The Swedish decimal comma, the space as thousands separator, currency placement after the amount, the sorting of å, ä and ö at the end of the alphabet, and phone and personal identity number formats were not confirmed on any fetched page; they are unverified background. The official source is the language authority's writing rules, confirmed by title only ([Regeringen, Myndigheternas skrivregler, title only, not read](https://regeringen.se/contentassets/5b473488ef174cff9d6dc405f9da6f1b/myndigheternas-skrivregler)). Agents use locale libraries with CLDR data rather than hand-coding these formats, and confirm against CLDR before treating them as fact. Swedish plain-language requirements (the Language Act and "klarspråk") and Swedish-language UX writing norms were not researched.

### Language continuity across legal and product content

**[DURABLE; checked on primary source for the EDPB point, secondary source only for the label point]** The EDPB lists "language discontinuity", meaning privacy information that is not in the language of the rest of the service, as a deceptive pattern ([EDPB Guidelines 03/2022 v2.0, adopted 14 Feb 2023 (PDF)](https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf)). Law-firm commentary says the withdrawal-function label must be an equally clear phrase in the local language ([Taylor Wessing, Feb 2026](https://www.taylorwessing.com/de/insights-and-events/insights/2026/02/withdrawal-button-as-compliance-risk-for-eu-and-non-eu-businesses)). **[INFERENCE]** If a Swedish interface is offered, the privacy notice, consent interface, withdrawal function and accessibility information should all exist in Swedish too.

### Cross-market measurement

**[DURABLE]** Net Promoter Score varies widely by country, so cross-market score comparisons mislead ([NN/g, Net Promoter Score, 21 Jun 2024](https://www.nngroup.com/articles/nps-ux/)). For AI features, Apple advises asking people for personal or cultural details rather than inferring them, and testing across diverse people to catch stereotypes ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Content design rules for interface text

**[DURABLE]** The sourced rules for interface text converge on plain, specific language in the user's vocabulary. Use words and concepts familiar to users rather than internal jargon; write error messages in plain language that state the problem precisely and suggest a solution; and make help content task-focused, searchable and in context, with concrete steps ([NN/g, 10 Usability Heuristics, 24 Apr 1994, last reviewed 30 Jan 2024](https://www.nngroup.com/articles/ten-usability-heuristics/)). In forms, the label or legend doubles as the page heading; hints are one sentence without full stops or links; use "(optional)" rather than asterisks and "Continue" rather than "Next"; do not reuse the same heading on several pages; and explain why a question is asked ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)).

**[FAST-MOVING, 2026; platform guidance]** Apple's microcopy guidance for AI features: use specific status messages such as "Summarizing key themes from your notes" instead of "Processing…", and when a request is refused or blocked, say what could not be done and offer example requests that would work ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Legally mandated wording

**[FAST-MOVING, 2026; secondary source only]** Unambiguous action labels are now mandated in places: law-firm commentary gives "withdraw from contract here" and "confirm withdrawal" for the withdrawal function ([Greenberg Traurig, May 2026](https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts)), and says a generic label such as "assistant" does not make the artificial nature of an AI system apparent ([Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)). **[DURABLE; checked on primary source]** For privacy content the EDPB calls for consistent terms across product and policy, plain-language definitions of jargon, examples of processing and short contextual notices, and names ambiguous wording and conflicting information as deceptive patterns ([EDPB Guidelines 03/2022 v2.0, adopted 14 Feb 2023 (PDF)](https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf)).

### Content failures are accessibility failures

**[FAST-MOVING, Feb 2026; automated scan]** Several of the most common accessibility failures are content-authoring failures: missing alternative text on 53.1% of home pages, empty links on 46.3% and empty buttons on 30.6% in the WebAIM Million 2026 ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)).

### A content checklist for agents

**[INFERENCE]** The department's content checklist: every button and link has a text name that describes the action; every image has alt text or is marked decorative; every error says what happened and what to do; every waiting state says what is being done; one term per concept across the interface, help and legal pages; and legally required labels use the mandated plain wording in each language. Avoid emotional or guilt-based wording on decline options; where personal data choices are involved this falls under the EDPB's "emotional steering" family ([EDPB Guidelines 03/2022 v2.0, adopted 14 Feb 2023 (PDF)](https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf)), and whether it also breaches unfair-practice rules elsewhere was not verified. The checklist is the researchers' synthesis.

### What was not sourced on content design

**[GAP]** GOV.UK's writing guidance has moved to a new guidance site with subpages on clear language, titles and summaries; the landing page carries no numeric rules ([GOV.UK publishing guidance, Writing guidelines](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/)), so reading-age, sentence-length and title-length numbers must not be quoted from this document. Evidence on reading behaviour, microcopy test results, tone-of-voice systems, style-guide governance, translation workflow, pseudo-localisation, machine-translation quality, right-to-left support, inclusive design frameworks, and the review of AI-generated interface copy were not researched.
