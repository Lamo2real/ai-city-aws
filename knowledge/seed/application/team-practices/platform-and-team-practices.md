---
id: application.team-practices.platform-and-team-practices
department: application
domain: team-practices
title: 'Application: Team practices: the platform is the golden path and standards live in tools'
summary: 'Team practices: what an internal platform is, its capability areas and measures, DORA 2025 platform findings, golden
  paths and shared skills for agents, coding standards enforced by tools, and onboarding humans and agents.'
type: principle
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- ship
- quality
sources:
- https://tag-app-delivery.cncf.io/whitepapers/platforms/
- https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- https://www.thoughtworks.com/radar/techniques
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://google.github.io/eng-practices/review/reviewer/standard.html
- https://martinfowler.com/articles/on-pair-programming.html
- https://queue.acm.org/detail.cfm?id=3454124
related: []
seed_version: 1
---

**When to use this:** When setting up golden paths, coding standards or onboarding for people and agents.

**Source section:** 8. Team practices: the platform is the golden path and standards live in tools

### What an internal platform is

**[DURABLE]** The CNCF Platforms white paper defines a platform as an integrated set of capabilities presented according to its users' needs. Its attributes are being run as a product, consistent interfaces, golden paths (templates plus documentation for build, scan, test, deploy and observe), self-service, lower cognitive load, being optional and composable, and being secure by default ([CNCF Platforms white paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)). The page shows version 1.0 without a date; the researchers believe it is from 2023, unverified.

### Platform capability areas and how to measure a platform

**[DURABLE]** The CNCF white paper lists thirteen capability areas, including portals, provisioning APIs and command-line tools, golden-path templates, build and test automation, delivery and verification, development environments, observability, infrastructure, data services, messaging, identity and secrets, security, and artifact storage. It measures a platform by active users and retention, satisfaction surveys, time from request to fulfilment, time to build and deploy a new service, time for a new user to submit a first code change, and the DORA metrics of its users ([CNCF Platforms white paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)).

### Platform quality findings from DORA 2025

**[FAST-MOVING, Sep 2025]** DORA's 2025 report finds 90% of organisations have at least one internal platform and 76% a dedicated platform team; quality platforms go with higher organisational and product performance, productivity and well-being; reliability and security are rated well while user-experience features such as acting on feedback and task automation lag; and heavy AI users on high-quality platforms reported more friction, which DORA suggests is the guardrails working ([DORA 2025 report PDF](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf)).

### Golden paths for agents: reference applications and shared skills

**[FAST-MOVING, Apr 2026 and Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) puts anchoring coding agents to a maintained reference application, in place of static templates, in Trial, along with agent plugin marketplaces for sharing skills across an organisation, and puts an "enterprise harness" of shared skills, tools and policies in Assess; Volume 34 (April 2026) has Port as an internal developer portal in Trial ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques); [Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). **[INFERENCE]** For a department of AI worker agents the golden path is the harness itself: service templates, a reference application, a short curated instruction file, sandboxed execution, and pipeline checks that enforce standards. The same artefacts serve human onboarding.

### Coding standards: the style guide decides and tools enforce

**[DURABLE]** Google's review standard makes the style guide the final authority on style; anything the guide does not cover is preference, where the reviewer follows existing code or defers to the author. Design choices are judged on engineering principle, and data beats opinion ([Google review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)). **[FAST-MOVING, Apr 2026 and Nov 2026]** The 2026 Radar volumes advise keeping shared agent instruction files curated and minimal and converting rules into automated checks ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). **[INFERENCE]** Standards that can be automated (formatting, linting, types, dependency pins, accessibility checks) should never be review comments; human review is reserved for design and risk.

### Onboarding humans and agents

**[DURABLE]** Three sourced practices speed onboarding. Pairing passes project knowledge through the partner, and strong-style pairing suits knowledge transfer ([On Pair Programming, 15 Jan 2020](https://martinfowler.com/articles/on-pair-programming.html)). Code review is a teaching channel for language, framework and design knowledge, with non-essential teaching comments labelled as optional ([Google review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)). Reproducible environments such as Dev Containers, in Trial in Radar Volume 34 (April 2026), remove set-up variance ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

**[INFERENCE]** Track time to first merged change for each new human or agent worker as the single onboarding metric, since both SPACE and the CNCF white paper point at it ([ACM Queue SPACE](https://queue.acm.org/detail.cfm?id=3454124); [CNCF Platforms white paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)). **[GAP]** No quantitative research on onboarding-time benchmarks or onboarding-programme effectiveness was retrieved, and Team Topologies and the CNCF platform maturity model were not fetched.
