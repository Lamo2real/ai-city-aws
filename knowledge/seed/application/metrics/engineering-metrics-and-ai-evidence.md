---
id: application.metrics.engineering-metrics-and-ai-evidence
department: application
domain: metrics
title: 'Application: Engineering metrics: five DORA measures, and AI adds throughput along with instability'
summary: 'Engineering metrics: the five DORA delivery metrics and how to use them, why not to measure coding throughput, DORA
  2025 findings (team profiles, AI use and trust, AI associations, the AI Capabilities Model, value streams, platforms), SPACE
  and DevEx, AI adoption surveys and the controlled evidence on AI speed-up.'
type: benchmark
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- measurement
sources:
- https://dora.dev/guides/dora-metrics/
- https://dora.dev/guides/dora-metrics/history/
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://www.thoughtworks.com/radar/techniques
- https://techcrunch.com/2026/05/29/coders-are-refusing-to-work-without-ai-and-that-could-come-back-to-bite-them/
- https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
- https://dora.dev/research/
- https://dora.dev/research/2025/dora-report/
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://blog.robbowley.net/2025/10/01/dora-2025-ai-assisted-dev-report-some-benefit-most-dont/
- https://blog.google/technology/developers/dora-report-2025/
- https://dora.dev/ai/capabilities-model/
- https://dora.dev/ai/
- https://queue.acm.org/detail.cfm?id=3454124
- https://queue.acm.org/detail.cfm?id=3595878
- https://survey.stackoverflow.co/2026/
- https://stackoverflow.blog/2026/09/30/getting-ready-for-2026-results-a-look-back-on-developer-survey-findings/
- https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/
- https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/
- https://metr.org/blog/2026-02-24-uplift-update/
- https://blog.robbowley.net/2026/04/04/metrs-developer-productivity-research-2026-update/
- https://www.gitclear.com/ai_assistant_code_quality_2025_research
related:
- application.ci-cd.ci-cd-and-release
seed_version: 1
cross_refs:
  '5':
  - application.ci-cd.ci-cd-and-release
---

**When to use this:** When choosing delivery metrics, judging the effect of AI on the team, or planning with AI productivity numbers.

**Source section:** 6. Engineering metrics: five DORA measures, and AI adds throughput along with instability

### The five DORA delivery metrics

**[DURABLE]** DORA now defines five software delivery metrics in two groups. Throughput covers change lead time (commit to production), deployment frequency and failed deployment recovery time. Instability covers change fail rate (deployments needing immediate intervention) and deployment rework rate (unplanned deployments caused by a production incident) ([DORA metrics guide](https://dora.dev/guides/dora-metrics/)). The history is that four metrics settled in 2015, availability was added in 2018 and broadened to reliability in 2021, mean time to restore was renamed failed deployment recovery time in 2023 and narrowed to change-caused failures, and rework rate was added in 2024 ([DORA metrics history](https://dora.dev/guides/dora-metrics/history/)).

### How to use DORA metrics and what to avoid

**[DURABLE]** DORA's guidance is to apply the metrics per application or service, to treat speed and stability as mutually reinforcing and not as a trade-off, and to share all five across development, operations and release roles. The pitfalls it names are using metrics as targets (Goodhart's law), relying on a single metric, comparing unlike systems, siloed ownership, competition between teams, and building measurement plumbing before improving anything; the suggested start is the DORA Quick Check plus a team conversation ([DORA metrics guide](https://dora.dev/guides/dora-metrics/)).

### Do not measure coding throughput

**[FAST-MOVING, Apr 2026 and Nov 2026]** Thoughtworks Radar Volume 34 (April 2026) lists DORA metrics, explicitly including rework rate, in Adopt as the alternative to counting AI-generated lines, and both Volume 34 and Volume 35 (November 2026) put coding throughput as a productivity measure (lines, pull-request counts, AI-code percentage, token counts) in Caution ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). **[FAST-MOVING, May 2026; secondary press report]** A press round-up reported that Amazon closed an internal token leaderboard after it was gamed and that Uber exhausted its 2026 AI budget in four months without a measurable productivity rise ([TechCrunch, 29 May 2026](https://techcrunch.com/2026/05/29/coders-are-refusing-to-work-without-ai-and-that-could-come-back-to-bite-them/)).

### DORA 2025: the headline and the sample

**[FAST-MOVING, Sep 2025]** DORA's 2025 report was published on 23 September 2025 from a survey fielded 13 June to 21 July 2025 with nearly 5,000 respondents and more than 100 hours of interviews, and it is the latest annual report as of November 2026. Its headline is that AI amplifies an organisation's existing strengths and weaknesses ([Google Cloud announcement, 23 Sep 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report); [DORA research](https://dora.dev/research/); [DORA 2025 report page](https://dora.dev/research/2025/dora-report/)). The report is published by Google and rests on self-reported survey data.

### DORA 2025: seven team profiles

**[FAST-MOVING, Sep 2025]** DORA's 2025 report replaces the old performance tiers with seven team profiles: foundational challenges (10%), legacy bottleneck (11%), constrained by process (17%), high impact with low cadence (7%), stable and methodical (15%), pragmatic performers (20%) and harmonious high-achievers (20%) ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)). **[CONTESTED]** One practitioner reading (1 October 2025) holds that in four of the clusters speed gains are largely cancelled by higher change-failure rates and that about 40% of respondents sit in the two clusters that gain without added instability; this is commentary and not a DORA statement ([Rob Bowley, 1 Oct 2025](https://blog.robbowley.net/2025/10/01/dora-2025-ai-assisted-dev-report-some-benefit-most-dont/)).

### DORA 2025: AI use, trust and perceived gains

**[FAST-MOVING, Sep 2025]** In DORA's 2025 survey 90% of respondents used AI at work (up 14 points), the median was two hours on the most recent workday, 65% relied on it heavily, over 80% believed it raised their productivity and 59% reported better code quality. Trust in AI output was "a lot" or "a great deal" for 24%, "somewhat" for 46% and little or none for 30% ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf); [Google blog on DORA 2025](https://blog.google/technology/developers/dora-report-2025/)).

### DORA 2025: measured associations of AI adoption

**[FAST-MOVING, Sep 2025]** DORA's 2025 report finds AI adoption positively associated with delivery throughput, product performance, code quality, individual effectiveness and team and organisational performance, and still associated with higher delivery instability, with no measurable relationship to burnout or friction. This reverses part of 2024, when each 25% rise in AI adoption was associated with roughly 1.5% lower throughput and 7.2% lower stability ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)).

### DORA AI Capabilities Model: seven amplifiers

**[FAST-MOVING, Sep 2025]** The DORA AI Capabilities Model names seven capabilities that amplify the benefit of AI: a clear and communicated AI stance, healthy data ecosystems, AI-accessible internal data, strong version control practices, working in small batches, a user-centric focus (without which AI adoption harms team performance) and a quality internal platform ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)); the companion guide was last updated 25 November 2025 ([DORA AI capabilities model](https://dora.dev/ai/capabilities-model/)). On the AI stance, what DORA measures is the clarity and awareness of the policy and not its content ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)).

**[INFERENCE]** For a department of AI agents the seven capabilities translate directly into a written AI usage policy, agents connected to internal documentation and code context, small work items, frequent commits with practised rollback, a golden-path platform, and a user-outcome check on every piece of work.

### DORA 2025: value stream management and platform quality

**[FAST-MOVING, Sep 2025]** DORA's 2025 report finds that teams which regularly review their value stream report higher team and product performance and that value stream management strongly moderates AI's effect on organisational performance; its starter test is whether the team can draw its delivery value stream on a whiteboard. AI's effect on organisational performance is negligible where platform quality is low and strong where it is high ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)). **[GAP]** DORA also lists a report on the return on investment of AI-assisted development that covers an initial productivity dip, but no figures were retrieved ([DORA AI page](https://dora.dev/ai/)).

### SPACE: measure several dimensions, including one perceptual measure

**[DURABLE]** The SPACE framework (Forsgren, Storey, Maddila, Zimmermann, Houck and Butler, ACM Queue 2021) has five dimensions: satisfaction and well-being, performance, activity, communication and collaboration, and efficiency and flow. Its rules are to measure at least three dimensions, include at least one perceptual (survey) measure and avoid taking two metrics from one dimension, and it rejects the myths that productivity equals activity, that one metric suffices and that productivity is only about individuals. It lists onboarding time for new members as a collaboration metric ([ACM Queue SPACE](https://queue.acm.org/detail.cfm?id=3454124)).

### DevEx: feedback loops, cognitive load, flow state

**[DURABLE]** The DevEx framework (Storey, Forsgren and Greiler, ACM Queue 2023) has three dimensions: feedback loops, cognitive load and flow state. It combines perceptual measures with workflow measures (build time, review turnaround, deployment lead time, meeting load), recommends surveying quarterly or semi-annually, breaking results down by team and persona, and acting on results to avoid survey fatigue ([ACM Queue DevEx](https://queue.acm.org/detail.cfm?id=3595878)).

**[INFERENCE]** A minimal metrics set consistent with SPACE and DevEx is the five DORA metrics per service, one quarterly developer-experience survey, and two workflow measures (continuous-integration feedback time and review turnaround), reviewed as trends and never used to rank teams.

### Missing context is the commonest developer barrier

**[FAST-MOVING, 2026]** Stack Overflow's 2026 Developer Survey (30,903 responses from 169 countries) reports that 63% cite incomplete information as a barrier, 79% regularly discover important context only after starting or finishing a task, and 75% spend five or more hours searching for answers (the period is not stated in the extract); job mood was 22% happy, 45% complacent and 33% not happy ([Stack Overflow 2026 survey](https://survey.stackoverflow.co/2026/)).

### AI adoption figures from 2025 and 2026 surveys

**[FAST-MOVING, 2025-2026]** The table below collects adoption and trust figures. All are self-reported survey or vendor-platform data.

| Source and date | Finding | Link |
|---|---|---|
| Stack Overflow 2025 survey (reported in a blog of 30 Sep 2026) | 79% used AI tools (62% in 2024, 44% in 2023); 47.1% daily; favourable sentiment about 60%, down from 72%; 31% used agents; 75.3% of those who would still ask a human cite distrust of AI answers | [Stack Overflow blog, 30 Sep 2026](https://stackoverflow.blog/2026/09/30/getting-ready-for-2026-results-a-look-back-on-developer-survey-findings/) |
| Stack Overflow pulse survey, April 2026 | Agent use 59%, nearly double 2025; Claude Code use 55%, up from 41% | [Stack Overflow blog, 30 Sep 2026](https://stackoverflow.blog/2026/09/30/getting-ready-for-2026-results-a-look-back-on-developer-survey-findings/) |
| Stack Overflow 2026 survey (30,903 responses) | 80% use AI at least an hour a day; about 62% favourable, 22% unfavourable; 48% trust AI only when output is easy to verify; 12% do not trust it for most work; 7% trust it for many tasks including important decisions; 93% say cited sources matter for verification; about 70% ask an AI agent first when searching; 19% are building their own tools to replace paid vendors | [Stack Overflow 2026 survey](https://survey.stackoverflow.co/2026/) |
| JetBrains Developer Ecosystem Survey 2026 (vendor; fieldwork May to July 2026; over 15,000 professional developers) | 90% used AI coding agents at work at least weekly and 68% daily | [JetBrains Research blog, Aug 2026](https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/) |
| JetBrains 2026, tools used at work | Claude Code 39% (18% in January 2026; 47% in the US); GitHub Copilot 21% (29% a year earlier); Codex 16% (3% in January); Cursor 12% (18% in January); JetBrains AI about 9%; OpenCode 7%; Google Antigravity 6%; Claude Code is the most-used tool for 31% | [JetBrains Research blog, Aug 2026](https://blog.jetbrains.com/research/2026/08/ai-coding-agent-adoption-2026/) |
| GitHub Octoverse 2026 (vendor; published 28 Oct 2026, updated 6 Nov; window 1 Oct 2025 to 30 Sep 2026) | Over 225 million developers; 34.3 billion commits; 17.9 billion pushes; 1.3 billion merged pull requests; 45.4 billion Actions jobs | [GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/) |
| GitHub Octoverse 2026, agents | Agents started more than 40% of pull requests in September 2026; 90% of agent pull requests merged within two weeks against about 86% for the comparison group | [GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/) |
| GitHub Octoverse 2026, security | Over 30 million Dependabot pull requests merged; push protection ran 5.8 billion scans | [GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/) |

**[INFERENCE]** Three reading rules apply to that table. Octoverse's 90% two-week merge rate for agent pull requests says they are being accepted and not that they are correct; CircleCI's falling main-branch success rate (section 5) is the nearer signal on quality, and neither isolates causation. JetBrains respondents skew to its user base, and the GitHub and CircleCI figures cover their own platforms. A Stack Overflow 2026 extract suggesting that trust rose from 31% to over 87% looks like a change in question wording between years and must not be presented as a trend. Octoverse's method notes say metrics cover public and private repositories unless stated, exclude bots, staff and spam-flagged accounts where identifiable, and recalculate earlier years on the same definitions ([GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/)).

### Controlled evidence on AI speed-up: one slowdown, one unreliable follow-up

**[FAST-MOVING, Feb 2026]** METR's randomised trial in early 2025 with experienced open-source developers found tasks took about 19% longer when AI was allowed (95% confidence interval from 2% to 39% longer), while participants believed they had been sped up ([METR update, 24 Feb 2026](https://metr.org/blog/2026-02-24-uplift-update/)). METR's follow-up from August 2025 (57 developers, 143 repositories, more than 800 tasks) estimated an 18% speed-up for returning developers (interval from 38% faster to 9% slower) and 4% for new ones (interval from 15% faster to 9% slower); both intervals include zero ([METR update, 24 Feb 2026](https://metr.org/blog/2026-02-24-uplift-update/)).

**[FAST-MOVING, Feb 2026]** METR itself says the follow-up data is too compromised to rely on: developers declined to work without AI, 30 to 50% withheld tasks they did not want to do unaided, pay dropped from $150 to $50 an hour, and timing breaks down when people run several agents at once. METR believes developers are probably faster in early 2026 than in early 2025, regards its estimate as a likely lower bound, calls the evidence very weak and is redesigning the study ([METR update, 24 Feb 2026](https://metr.org/blog/2026-02-24-uplift-update/)). A practitioner commentary stresses that the 18% figure is not a finding METR stands behind and that these studies cover solo open-source tasks and not team delivery ([Rob Bowley blog, 4 Apr 2026](https://blog.robbowley.net/2026/04/04/metrs-developer-productivity-research-2026-update/)).

### Code-quality signals under AI assistance

**[VENDOR]** GitClear's analysis of 211 million changed lines from 2020 to 2024 found cloned or copy-pasted lines rose from 8.3% to 12.3%, refactoring-type "moved" lines fell from 25% in 2021 to under 10% in 2024, and copy and paste exceeded moved code for the first time; the data ends in 2024 and is ageing ([GitClear 2025 research](https://www.gitclear.com/ai_assistant_code_quality_2025_research)). **[VENDOR; secondary press report, May 2026]** CodeRabbit, a vendor of AI review tools, reported that AI pull requests carried 1.7 times more issues than human ones, and a Singapore Management University paper (arXiv 2603.28592) warns of long-term maintenance cost; both were relayed by a press round-up and not read at source ([TechCrunch, 29 May 2026](https://techcrunch.com/2026/05/29/coders-are-refusing-to-work-without-ai-and-that-could-come-back-to-bite-them/)).

### Radar positions on coding-agent practice

**[FAST-MOVING, Apr 2026 and Nov 2026]** Thoughtworks Radar in 2026 has Claude Code and Cursor in Adopt (Volume 34, April 2026); agent sandboxing in Adopt; open-weight models, subagents and unattended overnight agentic builds in Trial; and codebase cognitive debt, agent skill cognitive surrender and blanket frontier model usage in Caution (Volumes 34 and 35) ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).

### What the evidence adds up to for planning

**[INFERENCE]** Across DORA, METR, Stack Overflow, JetBrains, GitHub, CircleCI and Thoughtworks the consistent picture is near-universal AI use, strong perceived gains, a positive association with organisational throughput, a persistent instability cost, and no trustworthy measurement of individual speed-up. A manager agent should plan capacity on measured delivery outcomes (the five DORA metrics, especially change fail rate and rework rate, plus main-branch success rate) and never on lines, pull requests or tokens produced.
