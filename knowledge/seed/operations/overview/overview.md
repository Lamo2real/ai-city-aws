---
id: operations.overview.overview
department: operations
domain: overview
title: 'Operations: Overview: three layers, one constraint, agents prepare and humans decide'
summary: 'Overview of the Operations department: the three-layer rule (law, evidence, house style), what the department is
  for, one manager agent directing workers, where the house style stops, the roadmap levels that matter for a small Swedish
  SaaS company, headcount triggers tracked every January, and measuring processes rather than usage.'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- scale
- compliance
sources:
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.tocinstitute.org/five-focusing-steps.html
- https://www.goodreads.com/author_blog_posts/24931865-more-better-new
- https://podcastrex.com/shows/build-with-leila-hormozi/scale-your-business-like-a-pro-in-2026-ep-350/transcript
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetsmiljolag-19771160_sfs-1977-1160/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2021890-om-skydd-for-personer-som-rapporterar_sfs-2021-890/
- https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20231/
- https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20232/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-197413-om-vissa-anstallningsframjande_sfs-1974-13/
- https://www.do.se/for-arbetsgivare-och-utbildningsanordnare/lonetransparens-och-jamstallda-loner/vad-ar-lonetransparensdirektivet
- https://regeringen.se/pressmeddelanden/2026/03/regeringen-vill-omforhandla-lonetransparensdirektivet/
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
related:
- operations.hiring.hiring
- operations.onboarding.onboarding
- operations.performance.performance-management
- operations.compensation.compensation-and-benefits
- operations.offboarding.offboarding
- operations.compliance.swedish-employment-framework
- operations.compliance.swedish-work-environment-law
- operations.compliance.employee-data-and-monitoring
- operations.compliance.ai-in-people-decisions
- operations.contractors.contractors-remote-and-international-teams
- operations.calendar.handbook-and-people-operations-calendar
- operations.processes.process-management
- operations.rhythm.operating-rhythm-and-decision-rights
- operations.projects.project-and-programme-management
- operations.service-levels.service-levels-and-capacity
- operations.vendors.vendor-and-procurement-management
- operations.risk.risk-continuity-and-quality
- operations.organisation.organisation-design-and-scaling
- operations.business-systems.business-systems-and-revenue-operations
- operations.ai-operations.operating-a-company-with-ai-agents
- operations.house-style.scaling-roadmap-constraint-and-management
- operations.house-style.training-delegation-hiring-culture-and-performance
seed_version: 1
cross_refs:
  '2':
  - operations.house-style.scaling-roadmap-constraint-and-management
  - operations.house-style.training-delegation-hiring-culture-and-performance
  '4':
  - operations.processes.process-management
  '5':
  - operations.rhythm.operating-rhythm-and-decision-rights
  '6':
  - operations.projects.project-and-programme-management
  '7':
  - operations.service-levels.service-levels-and-capacity
  '8':
  - operations.vendors.vendor-and-procurement-management
  '9':
  - operations.risk.risk-continuity-and-quality
  '10':
  - operations.organisation.organisation-design-and-scaling
  '11':
  - operations.business-systems.business-systems-and-revenue-operations
  '12':
  - operations.ai-operations.operating-a-company-with-ai-agents
  '13':
  - operations.hiring.hiring
  '14':
  - operations.onboarding.onboarding
  '15':
  - operations.performance.performance-management
  '16':
  - operations.compensation.compensation-and-benefits
  '17':
  - operations.offboarding.offboarding
  '18':
  - operations.compliance.swedish-employment-framework
  '19':
  - operations.compliance.swedish-work-environment-law
  '20':
  - operations.compliance.employee-data-and-monitoring
  '21':
  - operations.compliance.ai-in-people-decisions
  '22':
  - operations.contractors.contractors-remote-and-international-teams
  '23':
  - operations.calendar.handbook-and-people-operations-calendar
---

**When to use this:** When starting any Operations work: the three-layer rule, what the department is for, its manager-and-workers shape, where the house style stops, which roadmap levels matter, and the Swedish headcount thresholds tracked every January.

**Source section:** 1. Overview: three layers, one constraint, agents prepare and humans decide

### The three-layer rule that governs every agent decision

**[INFERENCE]** The Operations department runs on three layers in strict order. Layer one is law: Swedish employment, work-environment, discrimination and data-protection rules, and EU rules such as GDPR and the AI Act (sections 13 to 23). Layer two is independent evidence and recognised standards on processes, planning, projects, service levels, vendors, risk, organisation, AI operations and people practices (sections 4 to 16). Layer three is the house style, the Hormozis' operating models, which fills every space the first two layers leave open (section 2). A worker agent picks the house-style move by default, checks whether evidence changes it for this situation, and checks whether a legal gate blocks it. Section 3 lists the known collisions and says which rule wins in each.

### What the department is for

**[INFERENCE]** The department has two jobs that share one method. The business-operations job is to design processes, run the planning and execution rhythm, manage projects, vendors, risk and continuity, and keep systems of record clean. The people-operations job, which sits here because the company has no separate HR department, is to run hiring, onboarding, performance, pay and offboarding lawfully. The shared method is: name the one constraint, write the process down as a checklist with one owner, measure a baseline, improve the constraint step only, and record decisions with one named decider.

### The department's shape: one manager agent directing worker agents

**[INFERENCE]** The manager agent and its worker agents follow the orchestrator-workers pattern that Anthropic's engineering guidance describes, in which a central model decomposes work, delegates it and synthesises results ([Anthropic, Building effective agents, 19 Dec 2024](https://www.anthropic.com/engineering/building-effective-agents)). In decision-rights terms the manager agent is the natural driver or recommender, and a named human is the approver or decider for anything irreversible, external, above a spending limit or about a person. That mapping is the researchers' synthesis and not something a source states about agent departments.

### What the house style and the standards have in common

**[INFERENCE]** The Hormozi constraint method is the Theory of Constraints in plain language: naming one constraint is the identify step, "more" is exploit, "better" is exploit and subordinate, and "new" is elevate and comes last ([TOC Institute, Five Focusing Steps](https://www.tocinstitute.org/five-focusing-steps.html); [second-hand summary of "More, Better, New", 15 Jul 2024](https://www.goodreads.com/author_blog_posts/24931865-more-better-new)). The house style and the process standards in section 4 therefore do not conflict, and an agent can use either vocabulary for the same loop.

### Where the house style stops

**[INFERENCE]** The house style governs strategy, focus, management diagnosis, training method, delegation and the tone of feedback. It does not govern anything where Swedish or EU law prescribes a process: ending an employment, probation decisions, redundancy, monitoring, candidate data, pay equity and the use of AI in decisions about people. In those areas the house style contributes only its transferable parts, which are early, direct, behaviour-specific feedback, written expectations and not delaying the start of a proper process.

### Which roadmap levels matter for a small Swedish SaaS company

**[INFERENCE]** For a Sweden-based SaaS company of under 50 people, the relevant levels of Leila Hormozi's ten-level model are 4 to 6. Read together they give an ordered operations agenda: one customer type and one core offer with tracked metrics (level 4), delivery standards and retention (level 5), then formal onboarding, clean data, financial visibility and role clarity (level 6). Her model places formal HR systems, budgets and a director layer at 50 to 99 people (level 7), which coincides with Swedish thresholds at 50 employees for a safety committee and an internal whistleblowing channel ([Podcast Rex transcript of "Scale Your Business Like a Pro in 2026", 9 Apr 2026](https://podcastrex.com/shows/build-with-leila-hormozi/scale-your-business-like-a-pro-in-2026-ep-350/transcript); [Arbetsmiljölagen 6 kap. 8 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetsmiljolag-19771160_sfs-1977-1160/); [Visselblåsarlagen 5 kap. 2 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2021890-om-skydd-for-personer-som-rapporterar_sfs-2021-890/)).

### Headcount triggers a Swedish employer tracks every January

**[DURABLE]** The table lists the headcount thresholds found in the research. Legal status: each row was checked on the primary source linked in that row unless the row says otherwise; this is orientation, not legal advice.

| Employees | What starts at this size | Verification | Source |
|---|---|---|---|
| Any size | Written risk assessments and written action plans for measures not taken at once; routine against victimisation known to all staff; guidelines and routines against harassment, sexual harassment and reprisals; annual pay survey (documentation duty starts at 10) | Checked on primary source | [AFS 2023:1](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20231/); [AFS 2023:2](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20232/); [Diskrimineringslagen](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/) |
| 5 | Safety representative (skyddsombud) appointed where at least five employees are regularly employed | Checked on primary source | [Arbetsmiljölagen 6 kap. 2 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetsmiljolag-19771160_sfs-1977-1160/) |
| 5 affected | Written redundancy notice (varsel) to Arbetsförmedlingen when a cutback affects at least five employees | Checked on primary source | [Lag 1974:13](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-197413-om-vissa-anstallningsframjande_sfs-1974-13/) |
| 10 | Written work-environment policy, routines, task allocation and annual follow-up; written goals for the organisational and social work environment; written documentation of the pay survey | Checked on primary source | [AFS 2023:1](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20231/); [AFS 2023:2](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20232/); [Diskrimineringslagen 3 kap. 14 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/) |
| 25 | Written documentation of all active measures against discrimination, counted at the start of the calendar year | Checked on primary source | [Diskrimineringslagen 3 kap. 13 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/) |
| 50 | Safety committee (skyddskommitté); internal whistleblowing channel with written procedures | Checked on primary source | [Arbetsmiljölagen 6 kap. 8 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetsmiljolag-19771160_sfs-1977-1160/); [Visselblåsarlagen 5 kap. 2 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2021890-om-skydd-for-personer-som-rapporterar_sfs-2021-890/) |
| 100 | Pay-gap reporting under the EU Pay Transparency Directive would start here (first report for 100 to 149 employees by 7 June 2031 under the directive's own dates); no Swedish law is in force and the timetable is unsettled | Directive dates as summarised by DO; Swedish status checked on primary sources, 26 Mar and 21 Jul 2026 | [DO, updated 21 Jul 2026](https://www.do.se/for-arbetsgivare-och-utbildningsanordnare/lonetransparens-och-jamstallda-loner/vad-ar-lonetransparensdirektivet); [Regeringen, 26 Mar 2026](https://regeringen.se/pressmeddelanden/2026/03/regeringen-vill-omforhandla-lonetransparensdirektivet/) |

### Measure processes, not usage

**[INFERENCE]** An AI-run Operations department reports process-level outcomes (cycle time, first-pass yield, cost per unit of work, error escapes) and not usage counts. The reason is the gap in the 2026 survey data between individual productivity, enterprise scaling and profit impact described in section 12 ([McKinsey, The state of AI in 2026, 25 Aug 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).
