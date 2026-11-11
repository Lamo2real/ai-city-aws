---
id: application.delivery.delivery-lifecycle
department: application
domain: delivery
title: 'Application: Delivery lifecycle: small batches reach trunk daily and review answers within a day'
summary: 'Delivery lifecycle: ADRs and design documents, trunk-based development thresholds, stacked pull requests, the code-review
  standard, speed and size, peer review over change boards, risk-tiered review of agent work, pair programming and the definition
  of done.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- github
objectives:
- ship
- quality
sources:
- https://adr.github.io/
- https://www.thoughtworks.com/radar/techniques
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://dora.dev/capabilities/trunk-based-development/
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://google.github.io/eng-practices/review/developer/small-cls.html
- https://google.github.io/eng-practices/review/reviewer/standard.html
- https://google.github.io/eng-practices/review/reviewer/speed.html
- https://research.google/pubs/modern-code-review-a-case-study-at-google/
- https://dora.dev/capabilities/streamlining-change-approval/
- https://www.thoughtworks.com/en-us/radar
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://martinfowler.com/articles/on-pair-programming.html
- https://ebse.webspace.durham.ac.uk/ebse-bibliography/the-effectiveness-of-pair-programming-a-meta-analysis/
- https://dora.dev/capabilities/test-automation/
related: []
seed_version: 1
---

**When to use this:** When planning how work moves from design to trunk: branch lifetimes, pull-request size, review speed and standard, and when a change is done.

**Source section:** 1. Delivery lifecycle: small batches reach trunk daily and review answers within a day

### Design records: what an ADR is and when to write one

**[DURABLE]** An Architectural Decision Record captures a single architecturally significant decision together with its rationale, trade-offs and consequences, and a project's collection of ADRs forms its decision log. Michael Nygard's 2011 post popularised the practice, and template families (MADR, Nygard, Y-statements) are catalogued on the community site ([adr.github.io](https://adr.github.io/)). Write an ADR when a decision is hard to reverse or shapes many later changes; skip it for routine implementation choices. **[GAP]** The research found no quantitative evidence on the effectiveness of RFCs or design documents, and the template section lists were not retrieved, so the ADR material here is definitional.

### Design documents are now inputs to coding agents and must be pruned

**[FAST-MOVING, Nov 2026]** Thoughtworks Technology Radar Volume 35 (November 2026) lists semantic review of AI-edited prose in its Assess ring, meaning an LLM checks specifications, ADRs and plans for unintended changes of meaning, which signals that design documents now feed coding agents as well as people ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). The same volume places AI-driven documentation sprawl and agent instruction bloat in its Caution ring: large volumes of unmaintained, contradictory generated documents degrade human and agent work alike, and the remedy is to prune and to convert rules into automated checks ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). Volume 34 (April 2026) placed curated shared instructions for software teams and context engineering in Adopt ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

### Trunk-based development: the thresholds to hold

**[DURABLE]** DORA's trunk-based development guidance sets four thresholds: at most three active branches per application repository, a merge to trunk at least once a day, branches that normally live for hours and not days, and no code freezes or integration phases. The branch-count figure derives from DORA's 2016 to 2017 data, so treat it as a durable principle with a historical number ([DORA trunk-based development](https://dora.dev/capabilities/trunk-based-development/)). Use trunk-based development as the default for any product team that deploys continuously; the practice only works when tests run before changes land, because that is what keeps trunk green.

**[DURABLE]** DORA names three pitfalls that break trunk-based development: reviews needing several approvers that take hours or days push developers toward larger batches, asynchronous review combined with task-switching lengthens merge delay, and a trunk without pre-merge tests does not stay releasable ([DORA trunk-based development](https://dora.dev/capabilities/trunk-based-development/)). To measure the practice, count active branches, count and time code freezes, track the percentage of branches merged daily, and track average review approval time while investigating outliers ([DORA trunk-based development](https://dora.dev/capabilities/trunk-based-development/)).

**[FAST-MOVING, Sep 2025]** DORA's 2025 report (published 23 September 2025) names working in small batches and strong version control practices, meaning frequent commits and proficiency with rollback, among the seven capabilities that amplify the benefit of AI assistance ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)). Small batches therefore matter more, not less, when agents write the code.

### Stacked pull requests: fine when each one ships alone

**[CONTESTED]** Thoughtworks Radar Volume 35 (November 2026) puts stacked pull requests in Caution because chains of dependent pull requests can hide poor up-front decomposition ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)), while Google's engineering practices recommend stacking small changes as one way to split work ([Google small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)). **[INFERENCE]** The researchers' resolution is that stacking is acceptable when every pull request in the stack is independently shippable and is a warning sign when the stack exists only because the work was not decomposed first.

### Code review: the approval standard

**[DURABLE]** Google's reviewer standard is to approve once a change clearly improves overall code health even if it is imperfect, and never to approve a change that worsens code health except in an emergency. Optional polish is prefixed with "Nit:", technical facts and data outrank personal preference, the style guide is the authority on style, and a stalled disagreement is escalated instead of left to block the change ([Google review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)). Apply this standard to human and agent reviewers alike.

### Code review: speed

**[DURABLE]** Google's guidance on review speed is that one business day is the maximum time to respond to a review request, that a reviewer should not interrupt focused work but should pick the review up at the next natural pause, and that approving with comments is acceptable when remaining remarks are minor or optional ([Google review speed](https://google.github.io/eng-practices/review/reviewer/speed.html)).

### Code review: change size

**[DURABLE]** Google's guidance on change size is that a change should be one self-contained unit, that about 100 lines is usually reasonable and about 1,000 lines usually too large (the reviewer decides), that a change spread across many files is harder still, that refactoring belongs in a separate change from behaviour changes, that tests belong in the same change as the logic they cover, and that a reviewer may reject a change for size alone ([Google small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)). **[DURABLE]** Google's 2018 case study of modern code review analysed about 9 million reviewed changes, 12 interviews and a 44-person survey; the abstract page does not give size or latency medians, so no such figure is quoted here ([Google Research](https://research.google/pubs/modern-code-review-a-case-study-at-google/)).

### Change approval: peer review beats external approval boards

**[DURABLE]** DORA found no evidence that formal external approval, such as a change advisory board or senior sign-off, lowers change fail rate; such approval slows delivery and produces bigger, riskier releases. DORA's recommended replacement is peer review recorded in the development platform as the segregation-of-duties control, automated detection of bad changes, extra scrutiny only for high-risk changes, and a change advisory board repositioned as a coordination body. The finding rests on DORA's 2019 report ([DORA streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)). DORA also advises measuring the percentage of changes promoted without manual approval and the time changes wait for external approvers, and making the normal path fast enough that emergencies use it too ([DORA streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)).

### Review in an agent-heavy team: tier oversight by risk and avoid approval theatre

**[FAST-MOVING, Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) places risk-tiered human oversight in Trial, meaning review depth is matched to change risk and low-risk changes are merged automatically. It places human-in-the-loop theatre (approval steps nobody can realistically evaluate) and the "meat proxy" habit (forwarding unverified LLM output to colleagues) in Caution, and its theme text says review capacity and delivery pipelines are becoming the bottleneck as developers run several agent sessions in parallel ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques); [Radar overview](https://www.thoughtworks.com/en-us/radar)). **[INFERENCE]** For a manager agent directing worker agents this implies routing by risk tier: merge low-risk changes automatically when strong automated checks pass, reserve human review for high-risk ones, and never count a rubber-stamp approval as a control.

### Code review as the last manual gate before production

**[VENDOR]** Amazon describes code review as the last manual approval before production and uses a deployment-safety checklist during review that asks about test coverage, monitoring impact and whether the change can be rolled back; the article's publication date was not captured and it describes Amazon's internal practice ([AWS Builders' Library](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).

### Pair programming: a sensible default, not a proven law

**[DURABLE]** Böckeler and Siessegger (15 January 2020) advise treating pairing as a sensible default and not as dogma, capping it at roughly six hours a day, choosing among driver/navigator, ping-pong (for test-driven development) and strong-style (for knowledge transfer), and setting the work-in-progress limit to the number of pairs. The benefits they claim are knowledge spread, continuous review, focus and faster onboarding; the costs are fatigue, scheduling and power dynamics. The authors explicitly warn against claiming pairing is scientifically proven and recommend local experiments ([On Pair Programming](https://martinfowler.com/articles/on-pair-programming.html)). DORA states that pairing or synchronous review is preferable to asynchronous review for keeping batches small ([DORA trunk-based development](https://dora.dev/capabilities/trunk-based-development/)), and the Radar Volume 34 theme (April 2026) says pair programming, mutation testing and DORA metrics matter more with coding agents ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

**[GAP]** No controlled evidence on pair or mob programming effect sizes was opened. A 2009 meta-analysis by Hannay, Dybå, Arisholm and Sjøberg was located but not read ([EBSE bibliography entry](https://ebse.webspace.durham.ac.uk/ebse-bibliography/the-effectiveness-of-pair-programming-a-meta-analysis/)); the researchers' unverified recollection is a small quality gain, shorter duration and higher effort with strong heterogeneity, and those figures must not be published without opening the paper. Nothing was retrieved on mob or ensemble programming.

### Definition of done

**[DURABLE]** DORA's rule is that nobody should declare work development-complete unless automated acceptance tests pass, and that developers should get automated test feedback in under ten minutes both locally and in continuous integration ([DORA test automation](https://dora.dev/capabilities/test-automation/)). Google adds that any change which adds or alters logic ships with new or updated tests in the same change ([Google small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)). **[GAP]** No authoritative definition-of-done standard beyond DORA's acceptance-test rule was retrieved; the Scrum Guide was not opened.

**[INFERENCE]** A workable default checklist for a single change combines the sourced elements above: a linked requirement or ADR where the decision is architecturally significant, a single-purpose diff near the 100-line guide, tests included, continuous integration green in under ten minutes, a review response within one business day, a feature flag if the work is incomplete, a merge to trunk the same day, and a stated rollback path. Each element is individually sourced in this section; the combination is the researchers' synthesis.
