---
id: application.quality.quality-and-testing
department: application
domain: quality
title: 'Application: Quality and testing: fast trusted tests, and mutation testing now that agents write tests'
summary: 'Quality and testing: test automation principles, the pyramid and the trophy, consumer-driven contract tests, mutation
  testing (Adopt, November 2026), static analysis and agent feedback sensors, TypeScript, the four feature-flag types and
  toggle debt, error budgets and OpenTelemetry observability in code.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- quality
sources:
- https://dora.dev/capabilities/test-automation/
- https://martinfowler.com/articles/practical-test-pyramid.html
- https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- https://www.thoughtworks.com/radar/techniques
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/
- https://github.blog/news-insights/octoverse/
- https://martinfowler.com/articles/feature-toggles.html
- https://sre.google/workbook/error-budget-policy/
- https://opentelemetry.io/docs/specs/status/
- https://opentelemetry.io/status/index.md
- https://opentelemetry.io/status/
- https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design
- https://12factor.net/
related: []
seed_version: 1
---

**When to use this:** When deciding what tests to write, how fast they must be, how to use feature flags, or how to instrument code.

**Source section:** 4. Quality and testing: fast trusted tests, and mutation testing now that agents write tests

### Test automation principles

**[DURABLE]** DORA's test automation guidance makes developers the primary authors and maintainers of acceptance tests, demands feedback in under ten minutes locally and in continuous integration, and holds that ten fast reliable tests beat hundreds that nobody trusts. Flaky tests must not be tolerated; a defect found by a higher-level or exploratory test should produce a new unit test; exploratory and usability testing stay manual; and a brownfield system should begin with a skeleton pipeline of one unit test, one acceptance test and an automated deploy. When a defect reaches production, tests in the pipeline are added or updated ([DORA test automation](https://dora.dev/capabilities/test-automation/)).

### The test pyramid

**[DURABLE]** The test pyramid (Ham Vocke, 26 February 2018) prescribes many fast unit tests, fewer integration tests and very few end-to-end tests on critical journeys. Tests should check observable behaviour and not internals, be pushed as far down the pyramid as possible, and be deleted at higher levels when lower-level tests already cover the same thing; the inverted "ice-cream cone" shape is the anti-pattern ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)).

### Consumer-driven contract tests

**[DURABLE]** In consumer-driven contract testing the consumer of an interface publishes its expectations, the provider runs them in its own pipeline, and a break prompts a conversation before release; Pact is the example tool given (Vocke, 26 February 2018) ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)).

### The testing trophy

**[DURABLE]** The testing trophy (Kent C. Dodds, 3 June 2021) has four layers, static, unit, integration and end-to-end, with most weight on integration tests because they give the most confidence per unit of effort. Its base layer is static checking with type checkers and linters, added because static checking is not a given in JavaScript, and the author limits the model to front-end JavaScript applications and monoliths, not microservices or serverless systems ([Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)).

**[INFERENCE]** Choose the test shape by architecture: a trophy-like emphasis on integration and component tests for a front end or a modular monolith, and a pyramid plus contract tests where there are separately deployed services. Both sources agree on few end-to-end tests and on speed and trust mattering more than ratios, so the two models differ in emphasis and do not contradict each other.

### Mutation testing moved to Adopt in November 2026

**[FAST-MOVING, Nov 2026]** Thoughtworks Radar Volume 35 (November 2026) places mutation testing in Adopt, up from Trial in Volume 34 (April 2026), where it was described as a way to expose AI-generated tests that always pass ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques); [Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)). Volume 35 also lists "tests as data over tests as code", meaning cases held as structured data and run by a project harness, in Assess ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). **[INFERENCE]** When agents write tests, add a mutation-score gate on changed code to the definition of done, because coverage alone no longer separates real tests from decorative ones. **[GAP]** No sourced coverage or mutation-score threshold was retrieved, so the gate value must be set from the team's own baseline.

### Static analysis, type checking and agent feedback sensors

**[DURABLE]** DORA orders the pipeline with unit tests and static analysis first, then acceptance and non-functional tests such as performance and vulnerability scans, then manual exploration ([DORA test automation](https://dora.dev/capabilities/test-automation/)). **[FAST-MOVING, Apr 2026 and Nov 2026]** Thoughtworks Radar Volume 34 (April 2026) places feedback sensors for coding agents in Trial, meaning compilers, linters and tests are wired into the agent loop so failures trigger self-correction, and Volume 35 (November 2026) places threat modelling and agent sandboxing in Adopt as defaults ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)). **[GAP]** No primary evidence was retrieved on the defect-reduction effect of static typing or of specific static-analysis tools.

### TypeScript's position

**[VENDOR]** GitHub's Octoverse 2026 (published 28 October 2026, covering 1 October 2025 to 30 September 2026) ranks TypeScript first by contributors, Python second and JavaScript third ([GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/)); the 2025 edition's headline was that TypeScript had become the most used language on GitHub ([GitHub Octoverse index](https://github.blog/news-insights/octoverse/)).

### Feature flags: four types with different lifetimes

**[DURABLE]** Pete Hodgson (2016, revised 9 October 2017) distinguishes four toggle types: release toggles (days to a couple of weeks, static), experiment toggles (hours to weeks, decided per user), ops toggles (mostly short-lived, with some permanent kill switches, and changeable without a deploy), and permission toggles (which can last years and are decided per request). Decision logic should sit behind one decision object, tests should cover the expected production configuration, the planned release configuration and the fallback instead of every combination, and the convention is that a flag switched off means the old behaviour ([Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)).

### Feature flags: controlling toggle debt

**[DURABLE]** Hodgson's controls for toggle debt (revised 9 October 2017) are to create the removal task when the flag is created, give flags expiry dates, use "time bombs" that fail the build after expiry, and cap the number of live flags ([Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)). **[GAP]** OpenFeature and vendor flag platforms were not researched, and no 2024 to 2026 primary source on feature-flag practice was retrieved.

### Error budgets from the application side

**[DURABLE]** Google's example error budget policy releases normally while the service is within its service-level objective. If the budget for the preceding four weeks is spent, all changes halt except P0 fixes and security fixes until the service is back within objective. A single incident that consumes more than 20% of the four-week budget requires a postmortem with at least one P0 action, and a class of outage consuming more than 20% over a quarter requires a P0 item in the next quarter's plan. Feature work may continue when the cause was external (a company-wide network problem, another team's service, or out-of-scope load), and disputes escalate to the CTO ([SRE Workbook error budget policy](https://sre.google/workbook/error-budget-policy/)). **[INFERENCE]** A team that is not Google can reuse the policy's shape with its own numbers: a written objective per user journey, a four-week window, a pre-agreed rule for what stops when the budget is gone, and the 20% postmortem trigger.

### Observability in code: OpenTelemetry status

**[FAST-MOVING, Nov 2026]** OpenTelemetry's specification status page shows the tracing API, SDK and protocol as stable with long-term support, the metrics API and protocol as stable with mixed SDK status, baggage as stable and the logs bridge API as stable ([OTel spec status](https://opentelemetry.io/docs/specs/status/)). The language SDK table shows traces and metrics stable in Java, JavaScript, Python, Go and .NET; logs stable in Java and .NET, at release candidate in Go, and still in development in JavaScript and Python; and profiles in development for Java only ([OTel status](https://opentelemetry.io/status/index.md)). Blog titles on the site in 2026 record that OpenTelemetry graduated in the CNCF, that declarative configuration became stable and that Profiles entered public alpha; only the titles were read ([OTel status page](https://opentelemetry.io/status/)).

**[INFERENCE]** OpenTelemetry traces and metrics are safe to standardise on across the common stacks. For JavaScript and Python logs, keep a structured logging library with trace-ID correlation until the logs SDK is marked stable. **[GAP]** Semantic-convention stability for databases, messaging and generative AI was cut off in the pages fetched.

### Observability in code: correlation, log streams and agent-readable telemetry

**[DURABLE]** Applications should propagate a correlation ID header on every request and response ([Azure API design, updated 8 May 2025](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)) and write logs as an event stream, leaving routing and storage to the environment ([12factor.net](https://12factor.net/)). **[FAST-MOVING, Apr 2026 and Nov 2026]** Thoughtworks Radar Volume 34 (April 2026) lists SigNoz (OpenTelemetry-native observability) and Langfuse (LLM observability) among Trial platforms, and Volume 35 (November 2026) lists production-aware coding agents, which can read production telemetry, in Assess ([Radar Vol 34 PDF](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).
