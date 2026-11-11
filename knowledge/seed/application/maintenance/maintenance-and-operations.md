---
id: application.maintenance.maintenance-and-operations
department: application
domain: maintenance
title: 'Application: Maintenance: debt, dependencies, documentation, on-call, postmortems and planning'
summary: 'Maintenance: the technical-debt quadrant, cognitive debt in agent-built systems, Renovate''s dependency practice,
  post-quantum cryptography, documentation quality, on-call load limits and Swedish working-time rules, postmortems and Shape
  Up planning.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- reliability
- quality
sources:
- https://martinfowler.com/bliki/TechnicalDebtQuadrant.html
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://dora.dev/capabilities/streamlining-change-approval/
- https://docs.renovatebot.com/upgrade-best-practices/
- https://www.thoughtworks.com/radar/techniques
- https://dora.dev/capabilities/documentation-quality/
- https://sre.google/sre-book/being-on-call/
- https://data.riksdagen.se/dokument/sfs-1982-673.html
- https://sre.google/sre-book/postmortem-culture/
- https://sre.google/workbook/error-budget-policy/
- https://basecamp.com/shapeup/0.3-chapter-01
related: []
seed_version: 1
---

**When to use this:** When managing debt, dependency updates, documentation, on-call rotas, postmortems or planning cycles.

**Source section:** 7. Maintenance: debt, dependencies, documentation, on-call, postmortems and planning

### Technical debt: the quadrant and when not to repay

**[DURABLE]** Fowler's technical debt quadrant (2009) classifies debt as reckless or prudent and as deliberate or inadvertent. Prudent inadvertent debt is inevitable as teams learn, reckless debt should be avoided, and interest should be weighed against principal, so rarely touched code may not be worth repaying ([Technical Debt Quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)). **[GAP]** No quantified technical-debt benchmarks (share of time spent on debt, cost studies) were retrieved.

### Cognitive debt in agent-built systems

**[FAST-MOVING, Apr 2026]** Thoughtworks Radar Volume 34 (April 2026) names codebase cognitive debt as a new form of debt, in which teams lose understanding of AI-generated systems and can no longer change them safely ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). **[INFERENCE]** For an agent-run department this is the debt to track: require a human-readable ADR or summary for every agent-built subsystem and prune generated documentation.

### Legacy and process drag in DORA's profiles

**[FAST-MOVING, Sep 2025]** DORA's 2025 profiles "legacy bottleneck" (11% of respondents) and "constrained by process" (17%) describe teams where unstable systems or inefficient process drive reactive work and burnout ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)). DORA also warns that heavier process added in response to stability problems lengthens lead time and enlarges batches in a worsening cycle ([DORA streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)).

### Dependency updates: Renovate's practice set

**[VENDOR]** Renovate's upgrade guidance (Mend) is to update often so each update is small, take major versions one at a time and in good time, automerge development tools when checks pass and optionally patch releases, and set `minimumReleaseAge` to 14 days for automerged third-party updates so registries have time to catch malicious packages. It also advises pinning container images to digests and third-party GitHub Actions to full commit SHAs, running weekly lockfile maintenance, routing major updates through the dependency dashboard with changelog review by more than one person, prioritising critical CVE fixes with vulnerability alerts enabled, and pinning development tool versions so the whole team runs identical linters and formatters ([Renovate upgrade best practices](https://docs.renovatebot.com/upgrade-best-practices/)). The documentation page was read in November 2026.

**[INFERENCE]** A 14-day release-age delay conflicts with fast patching of actively exploited vulnerabilities; handle this by exempting security advisories from the delay, which Renovate's advice to prioritise CVE fixes supports. **[CONTESTED]** The cool-down length is a judgement call inside the research: Renovate documents 14 days, while one researcher's unsourced judgement was 3 to 7 days on the grounds that the 2025 to 2026 worms were removed within hours to days. The sourced 14-day figure is the default here.

### Post-quantum cryptography as a maintenance item

**[FAST-MOVING, Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) places post-quantum cryptography in Adopt and names key exchange as the most urgent migration ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).

### Documentation quality multiplies technical practices

**[DURABLE]** DORA's documentation research (2021 to 2022 data) links documentation quality to organisational performance and finds it amplifies every technical capability studied. The reported lift with above-average against below-average documentation is 1,525% against 36% for trunk-based development, 750% against 34% for continuous integration and 656% against 63% for continuous delivery. DORA measures documentation through survey statements on attributes such as clarity, findability and reliability ([DORA documentation quality](https://dora.dev/capabilities/documentation-quality/)).

**[FAST-MOVING, Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) places agent-maintained knowledge bases that are plain-text and human-curated in Trial and AI-driven documentation sprawl in Caution ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).

### On-call load limits from Google SRE

**[DURABLE]** Google's SRE book (2016) sets on-call limits of at most 50% of time on operational work and at most 25% on call, no more than two incidents per 12-hour shift, and a median of zero pages a day as sustainable with more than one as unsustainable. It asks for a minimum rotation of eight engineers at one site or six per site across two sites, response in about 5 minutes for user-facing critical services and about 30 minutes for less sensitive ones, and compensation for out-of-hours work with time off or pay ([SRE Book: Being On-Call](https://sre.google/sre-book/being-on-call/)). **[INFERENCE]** A small team cannot meet the eight-person rotation; the usable parts are the load limits and the compensation principle, with the rotation pooled across teams.

### On-call in Sweden: working-time rules that shape rotations

**[DURABLE; checked on primary source]** The Swedish Working Hours Act, Arbetstidslag (1982:673), caps ordinary working time at 40 hours a week (5 §) and total working time at an average of 48 hours per seven-day period over a reference period of at most four months (10 b §). Jourtid, meaning time at the workplace at the employer's disposal, is capped at 48 hours per four weeks or 50 hours per calendar month, and time actually worked is not jourtid (6 §). General overtime is capped at 48 hours per four weeks or 50 per month and 200 hours per calendar year (8 §), with extra overtime of a further 150 hours per year (8 a §), both staying inside the four-week and monthly caps ([SFS 1982:673](https://data.riksdagen.se/dokument/sfs-1982-673.html)).

**[DURABLE; checked on primary source]** Arbetstidslag (1982:673) requires at least 11 consecutive hours of daily rest in every 24-hour period, including midnight to 05:00 unless the nature of the work requires otherwise, with temporary deviation only for unforeseeable circumstances and with equivalent compensatory rest (13 §). Weekly rest is at least 36 consecutive hours in every seven-day period, and standby time (beredskap), when the employee may be away from the workplace but must be available, does not count as weekly rest (14 §). Night is 22:00 to 06:00 and night workers are limited to eight hours per 24 on average over four months (13 a §) ([SFS 1982:673](https://data.riksdagen.se/dokument/sfs-1982-673.html)).

**[DURABLE; checked on primary source]** Under Arbetstidslag (1982:673) a collective agreement concluded or approved by a central employee organisation may replace the act entirely or deviate from most of these sections within the floor of the EU Working Time Directive (3 §), and Arbetsmiljöverket supervises and can impose sanction fees for breaches made without collective-agreement support (20, 26 and 27 §§) ([SFS 1982:673](https://data.riksdagen.se/dokument/sfs-1982-673.html)).

**[INFERENCE; legal orientation only]** Absent a collective agreement, three design consequences follow for developer on-call in Sweden. A week of unbroken standby leaves no qualifying weekly rest, so rotations need a 36-hour standby-free block every seven days. A night call-out interrupts the 11-hour daily rest, which is tolerable only as a temporary, unforeseen deviation with compensatory rest, so routine night pages argue for follow-the-sun cover or a late start the next day. Hours actually worked on a call-out count toward the overtime caps and the 48-hour average. **[GAP]** Most Swedish technology employers under collective agreements follow the agreement's own on-call rules, which were not researched (for example the Almega IT agreement), and the act's exemption for managerial or self-regulated positions (2 §) was not checked. AI agents carrying first-line response do not remove these limits for the humans who are paged.

### Incident postmortems

**[DURABLE]** Google's SRE book asks teams to define postmortem triggers in advance: user-visible downtime or degradation past a threshold, any data loss, on-call intervention such as a rollback, resolution time past a threshold, or a monitoring failure. A postmortem contains impact, mitigation actions, root causes and follow-ups, is blameless (assume good intent and fix systems, not people), and is reviewed, stored where others can find it and shared widely without data identifying end users ([SRE Book: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)). The quantified trigger from the SRE workbook is any single incident using more than 20% of the four-week error budget, which needs a postmortem with at least one P0 action ([SRE Workbook error budget policy](https://sre.google/workbook/error-budget-policy/)).

### Planning and estimation: Shape Up as one documented option

**[VENDOR]** Basecamp's Shape Up uses six-week cycles followed by a two-week cool-down, sets an "appetite" (how much time an idea is worth) instead of estimating, has senior people shape work before it is bet on, chooses work at a betting table during cool-down, applies a circuit breaker so that work not shipped in one cycle stops by default, and shows progress from unknown to known on hill charts ([Shape Up, chapter 1](https://basecamp.com/shapeup/0.3-chapter-01)). It is a single-company account from 2019.

**[FAST-MOVING, Sep 2025]** DORA's 2025 report finds that working in small batches improves product performance and reduces friction under AI adoption and that regular value-stream review raises team performance ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)).

**[GAP]** No empirical study comparing Scrum, Kanban and Shape Up, and no study of estimation accuracy (story points, forecasting from throughput, #NoEstimates, Jørgensen's expert-estimation research), was opened in any research pass; the Scrum Guide and Kanban Guide were not fetched. **[INFERENCE]** The only planning practice with cross-study support in the sources is small batch size with short feedback loops. Scrum, Kanban and Shape Up can each deliver that, so present them as options chosen by fit (interrupt-driven work suits flow-based Kanban; fixed-appetite project work suits Shape Up), judge by lead time and rework rate instead of framework fidelity, and say plainly that the choice is practitioner judgement.
