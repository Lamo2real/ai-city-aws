---
id: product.accessibility.accessibility
department: product
domain: accessibility
title: 'Product: Accessibility'
summary: 'Accessibility: WCAG 2.2 AA as the practical target and its new criteria; EN 301 549 still referencing WCAG 2.1; the European
  Accessibility Act; the Swedish accessibility act (2023:254), who it covers, exemptions, sanction fees, transitional rules and supervision;
  accessibility statements; why tools alone cannot show conformance; the WebAIM Million 2026 failures; an accessibility release gate
  for agents. Orientation, not legal advice.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- web
- ios
- android
objectives:
- compliance
- launch
sources:
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://via.tt.se/pressmeddelande/4339930/pts-forsta-breda-matning-av-tillganglighet-pa-svenska-webbplatser-visar-pa-brister-i-samtliga-sektorer?lang=sv
- https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility
- https://www.digg.se/kunskap-och-stod/digital-tillganglighet
- https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
- https://svenskhandel.se/api/documents/dokument/tillganglighetslagen-fragor-svar.pdf
- https://www.ey.com/sv_se/insights/law/tillganglighetslagen-trader-i-kraft-den-28-juni-2025
- https://www.m3.se/article/2942445/pts-granskar-tillgangligheten-for-e-handelstjanster.html
- https://www.w3.org/WAI/planning/statements/
- https://www.w3.org/WAI/test-evaluate/
- https://webaim.org/projects/million/
related: []
seed_version: 1
---

**When to use this:** When a design, release or statement touches accessibility requirements, WCAG, the European Accessibility Act or the Swedish act. Keep the date labels; orientation for a human to confirm.

**Source section:** 17. Accessibility

### The practical target: WCAG 2.2 AA

**[DURABLE; checked on primary source]** WCAG 2.2 became a W3C Recommendation on 5 October 2023. It added nine success criteria and removed 4.1.1 Parsing as obsolete ([W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)). **[INFERENCE]** The department builds to WCAG 2.2 AA even though the legally referenced European standard still builds on WCAG 2.1: WCAG 2.2 is backward compatible apart from the removed 4.1.1, and the Swedish regulator has signalled that stricter requirements are coming ([PTS press release, 21 Apr 2026](https://via.tt.se/pressmeddelande/4339930/pts-forsta-breda-matning-av-tillganglighet-pa-svenska-webbplatser-visar-pa-brister-i-samtliga-sektorer?lang=sv)).

### The new WCAG 2.2 criteria

**[DURABLE; checked on primary source]** The table lists the nine success criteria added in WCAG 2.2 with their levels; every row is from the W3C summary page.

| Criterion | Level | Requirement in brief | Source |
|---|---|---|---|
| 3.2.6 Consistent Help | A | Help mechanisms appear in the same relative order across pages | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 3.3.7 Redundant Entry | A | Do not ask again for information already given in the same process; auto-fill it or offer it for selection | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 2.4.11 Focus Not Obscured (Minimum) | AA | A focused component is not entirely hidden, for example by sticky headers or cookie banners | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 2.5.7 Dragging Movements | AA | Every drag action has a single-pointer alternative | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 2.5.8 Target Size (Minimum) | AA | Targets at least 24 by 24 CSS pixels, with exceptions such as spacing and inline links | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 3.3.8 Accessible Authentication (Minimum) | AA | No memorising or transcribing test at login unless an alternative or assistance such as paste and password managers is available | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Stricter version of 2.4.11; not required for AA | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 2.4.13 Focus Appearance | AAA | Focus indicator with a 2 CSS pixel perimeter and 3:1 contrast; not required for AA | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Stricter version of 3.3.8; not required for AA | [W3C WAI, What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) |

### EN 301 549: the European standard still references WCAG 2.1

**[FAST-MOVING, Nov 2026; checked on the standards body's page, which may be stale]** ETSI lists EN 301 549 V3.2.1 (2021) as the current version; it has supported the Web Accessibility Directive since August 2021 and is referenced by Commission Implementing Decision (EU) 2021/1339. A revision, V4.1.1, is described as being prepared under Commission mandate 587 to support the European Accessibility Act, with a stated aim of publication in 2025; the page does not say it has been published or cited in the Official Journal ([ETSI, EN 301 549 page](https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility)). DIGG's guidance for the Swedish public sector cites V3.2.1, which builds on WCAG 2.1, and recommends WCAG 2.1 AA ([DIGG, Digital tillgänglighet](https://www.digg.se/kunskap-och-stod/digital-tillganglighet)). **[GAP]** Publication and Official Journal citation of V4.1.1 were not confirmed; the ETSI page appears not to have been updated since its 2025 target passed.

### The European Accessibility Act

**[DURABLE; checked on the Commission's page]** The European Accessibility Act, Directive (EU) 2019/882, covers among other things computers and operating systems, smartphones, ATMs and ticketing machines, telephony, access to audiovisual media, passenger transport services, banking services, e-books and e-commerce; member states had to transpose it by June 2022 ([European Commission, European Accessibility Act page](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en)).

### Sweden: the accessibility act (2023:254) and who it covers

**[DURABLE; checked on primary source, Riksdagen's consolidated text]** The Swedish act on the accessibility of certain products and services, lag (2023:254), entered into force on 28 June 2025. Under 2 §, e-commerce services are services provided at a distance, through websites and mobile services, electronically and at a consumer's individual request, in order to conclude a consumer contract; a consumer is a natural person acting mainly outside business activity. A new version of 2 § enters into force on 20 November 2026 (SFS 2026:1026), updating a reference to the consumer credit act ([Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

**[DURABLE; checked on primary source]** Under 2 § and 10 § of the Swedish accessibility act, services provided by a microenterprise, meaning a company with fewer than ten employees and an annual turnover or balance sheet total of at most EUR 2 million, need not meet the requirements ([Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)). **[FAST-MOVING, 2025; secondary source only]** According to answers from the regulator relayed by a trade body, headcount and financials may have to be aggregated across group companies ([Svensk Handel Q&A with PTS answers, 2025](https://svenskhandel.se/api/documents/dokument/tillganglighetslagen-fragor-svar.pdf)).

**[INFERENCE]** Scope test for a Swedish SaaS company: the act's e-commerce definition is tied to concluding a consumer contract, so purely B2B SaaS appears to be outside the e-commerce service category, while any self-service sign-up or checkout open to consumers is inside it. This is the researchers' reading of 2 §; regulator guidance on mixed B2B and B2C sales was not found, so confirm with Legal. This is orientation and not legal advice.

### Sweden: exemptions and service-provider duties

**[DURABLE; checked on primary source]** Under 7 § and 8 § of the Swedish accessibility act, a requirement does not apply if it would fundamentally alter the service or impose a disproportionate burden; the operator must document and keep the assessment, notify the authority when it relies on the exemption, and supply the assessment on request. Under 24 § to 26 §, a service provider must keep the service compliant continuously, prepare information showing how the service meets the requirements and which requirements are exempted, make sure that information accompanies the service, and on non-compliance fix it and notify the supervisory authorities in the member states concerned at once ([Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### Sweden: enforcement and sanction fees

**[DURABLE; checked on primary source]** Under 32 § to 40 § of the Swedish accessibility act, the authority first asks for correction within a set time and may then issue orders, which can carry a conditional fine (vite). Sanction fees run from SEK 10,000 to SEK 10,000,000 depending on seriousness, with none in minor cases, and cannot be decided more than five years after the breach ended ([Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### Sweden: transitional rules

**[DURABLE; checked on primary source]** The Swedish accessibility act does not apply to pre-recorded media, document file formats and archived content published before entry into force and not changed since. Service contracts signed before entry into force may run to expiry, at the latest 27 June 2030 ([Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### Sweden: how supervision works

**[FAST-MOVING, 2025-2026; secondary sources]** According to a professional-services firm's summary of 22 May 2025, PTS supervises compliance with the Swedish accessibility act, reviews documentation, runs tests and handles user complaints, and coordinates with Mediemyndigheten, Konsumentverket, Transportstyrelsen and MTM for their areas ([EY Sverige, 22 May 2025](https://www.ey.com/sv_se/insights/law/tillganglighetslagen-trader-i-kraft-den-28-juni-2025)). Trade press of 16 October 2025 reports that PTS's first supervision round covers larger e-commerce operators established in Sweden, reviews websites and not apps, focuses on the home page, a product page and the search function, checks that information about how the service works is available, and runs in stages through 2026 ([M3, PTS granskar tillgängligheten för e-handelstjänster, 16 Oct 2025](https://www.m3.se/article/2942445/pts-granskar-tillgangligheten-for-e-handelstjanster.html)). According to answers relayed by a trade body, PTS does not rely on automated checks in supervision, prefers expert review combining tools and skill, and recommends EN 301 549 as the starting point ([Svensk Handel Q&A with PTS answers, 2025](https://svenskhandel.se/api/documents/dokument/tillganglighetslagen-fragor-svar.pdf)). Which authority is formally designated in the ordinance was confirmed only through secondary sources.

**[FAST-MOVING, 21 Apr 2026; authority press release]** PTS measured 576 Swedish websites in nine sectors in April and October 2025 (report PTS-ER-2026:7) and found shortcomings in every sector, more often among private operators; eight of nine sectors improved between the two measurements, most in pharmacies and banking. PTS states that the measurement is not supervision, covers only automatically detectable technical issues, and so understates real barriers. It noted that municipalities had few failures against the current standard but many against stricter requirements expected in 2026. PTS and DIGG merge on 1 January 2027, and PTS is considering combining large-scale measurement with in-depth supervision ([PTS press release, 21 Apr 2026](https://via.tt.se/pressmeddelande/4339930/pts-forsta-breda-matning-av-tillganglighet-pa-svenska-webbplatser-visar-pa-brister-i-samtliga-sektorer?lang=sv)).

**[DURABLE; authority guidance]** DIGG supervises the separate Swedish public-sector accessibility act (DOS-lagen), which covers public bodies and some publicly funded private actors and requires a published, regularly updated accessibility statement ([DIGG, Digital tillgänglighet](https://www.digg.se/kunskap-och-stod/digital-tillganglighet)). **[GAP]** PTS's own guidance pages on the act, any published supervision decisions or fines, and enforcement in other member states were not retrieved.

### Accessibility statements

**[DURABLE; W3C guidance]** W3C says an accessibility statement should at least contain a commitment to accessibility, the standard applied (for example WCAG 2.2), and contact details for reporting problems; advisable extras are known limitations, measures taken, technical prerequisites, environments tested and applicable laws. W3C offers a free statement generator ([W3C WAI, Developing an Accessibility Statement](https://www.w3.org/WAI/planning/statements/)). **[INFERENCE]** The Swedish act requires information on how the service meets the requirements to accompany the service (25 §; [Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)); publishing a W3C-style statement that also lists exempted requirements is a reasonable way to meet it, though the act does not use the public-sector term for an accessibility statement.

### Testing: tools alone cannot show conformance

**[DURABLE; W3C guidance]** W3C states that no tool alone can determine whether a site meets accessibility standards and that knowledgeable human evaluation is required; evaluation should start early and continue throughout. Its resources include Easy Checks (alt text, page titles, headings, contrast, keyboard focus, zoom, captions, form labels), the WCAG-EM conformance evaluation methodology and report tool, and guidance on involving users with disabilities ([W3C WAI, Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)). **[GAP]** The share of WCAG issues that automated tools can detect was not fetched; do not quote a percentage from this document.

### Common failures: the WebAIM Million 2026

**[FAST-MOVING, scan Feb 2026, report updated 30 Mar 2026; automated scan]** WebAIM's automated scan of the top one million home pages found detectable WCAG 2 failures on 95.9% of them, up from 94.8% in 2025, with an average of 56.1 errors per page, up 10.1% from 51. Home pages averaged 1,437 elements, up 14.3% in a year. WebAIM states that an absence of detected errors does not mean a page is accessible or conformant, so true conformance is below 4.1% ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)). The table gives the six most common failure types.

| Failure type | Share of home pages, 2026 | Share in 2025 | Source |
|---|---|---|---|
| Low-contrast text | 83.9% | 79.1% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| Missing image alternative text | 53.1% | 55.5% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| Missing form input labels | 51% | 48.2% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| Empty links | 46.3% | 45.4% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| Empty buttons | 30.6% | 29.6% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| Missing document language | 13.5% | 15.8% | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |

**[FAST-MOVING, Feb 2026; automated scan]** In the WebAIM Million 2026, 82.7% of home pages used ARIA; pages with ARIA averaged 59.1 errors against 42 without, and 22% of pages with an ARIA menu introduced barriers through missing markup or interactions ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)). **[INFERENCE]** Agents should prefer native HTML elements and treat custom ARIA widgets as high-risk.

### An accessibility release gate for agents

**[INFERENCE]** The department's accessibility release gate has seven steps: an automated scan with zero errors in the six WebAIM categories; a keyboard-only pass of each key flow, checking that focus is visible and unobscured; a screen-reader pass of sign-up, checkout and search; a check of 24-pixel targets and drag alternatives; a check that login works with paste and password managers; a zoom and reflow check; and a periodic expert audit using WCAG-EM together with sessions with disabled users. Steps two to seven exist because automated tools cannot establish conformance ([W3C WAI, Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)). The gate is the researchers' synthesis.

**[INFERENCE]** The six WebAIM failure types are all preventable in a design system through contrast tokens, required alt and label properties, lint rules for empty links and buttons, and a `lang` attribute in the page template, so they belong in component-level checks ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)). **[GAP]** Mobile app accessibility, PDF and document accessibility, and assistive-technology test matrices were not researched.
