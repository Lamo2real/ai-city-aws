---
id: operations.service-levels.service-levels-and-capacity
department: operations
domain: service-levels
title: 'Operations: Service levels and capacity'
summary: 'Service levels and capacity: SLI, SLO and SLA, queueing (why full utilisation produces long waits) and capacity
  planning.'
type: principle
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- reliability
sources:
- https://sre.google/sre-book/service-level-objectives/
- https://en.wikipedia.org/wiki/Kingman%27s_formula
- https://www.tocinstitute.org/five-focusing-steps.html
- https://rosetta.to/u/alexhormozi/less-is-more-the-magic-of-a-simple-business
related: []
seed_version: 1
---

**When to use this:** When setting service levels or planning capacity: SLI, SLO and SLA, why full utilisation produces long waits, and capacity planning.

**Source section:** 7. Service levels and capacity

### SLI, SLO and SLA

**[DURABLE]** A service level indicator (SLI) is a defined quantitative measure of service such as latency, error rate, throughput or availability. A service level objective (SLO) is a target value or range for an indicator. A service level agreement (SLA) is a contract with consequences for missing objectives. The test is whether an explicit consequence exists: without one it is an objective, not an agreement ([Google SRE Book, Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)).

**[DURABLE]** Guidance on setting targets from the same source: start from what users care about and work back to indicators, measuring on the client side where server metrics miss user-visible problems; do not set targets from current performance alone; avoid absolutes such as "always available"; use as few objectives as possible; start loose and tighten; keep an internal objective tighter than the advertised one; and avoid over-delivering so that users do not come to depend on performance beyond the objective ([Google SRE Book, Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)).

**[DURABLE]** An error budget is the permitted rate of missing an objective, tracked daily or weekly and used to decide between reliability work and new releases ([Google SRE Book, Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)).

**[INFERENCE]** Internal service-level template for an operations desk: request type; indicator (for example time to first response, time to resolution, first-pass yield); objective expressed as a percentile, such as 90% of access requests resolved within one business day; measurement source; owner; and what happens when the budget is burned, for example pausing new project intake.

### Queueing: why full utilisation produces long waits

**[DURABLE]** Kingman's approximation, due to John Kingman (1961), estimates mean waiting time in a single-server queue with general arrival and service distributions. Its inputs are utilisation, mean service time and the coefficients of variation of inter-arrival and service times, and it is described as generally very accurate, especially close to saturation. The source is Wikipedia; the equation itself did not render in the fetched text and is not reproduced here ([Wikipedia, Kingman's formula](https://en.wikipedia.org/wiki/Kingman%27s_formula)).

**[INFERENCE]** Kingman's inputs imply two levers for shortening waits at a fixed staffing level: lower planned utilisation at the bottleneck, and lower variability in arrivals or handling time, through standard work, intake templates, batching similar requests and limits on work in progress. The sharp rise in waiting as utilisation nears 100% is the textbook reading of the formula; it was not read on the page and stays an inference.

**[DURABLE]** The Theory of Constraints adds that non-constraint resources should not produce faster than the constraint can absorb, and that a buffer should protect the constraint from starvation ([TOC Institute, Five Focusing Steps](https://www.tocinstitute.org/five-focusing-steps.html)).

### Capacity planning

**[INFERENCE]** Planning rule of thumb, not a sourced benchmark: plan knowledge-work teams and agent queues at roughly 70 to 85% of capacity on the constraint step and keep the remainder as buffer for unplanned work; plan at 100% only for non-constraint, easily interruptible work. The house style's unaudited observation that staff typically sit at 70 to 80% utilisation points the same way ([Rosetta transcript of "Less is More", 22 May 2025](https://rosetta.to/u/alexhormozi/less-is-more-the-magic-of-a-simple-business)).

**[INFERENCE]** Capacity plan outline: demand forecast by work type (volume per week from 13 weeks of history); effort per unit (median and 85th percentile); available hours per role, or agent concurrency, after meetings and leave; utilisation at the constraint; the gap and the options (cut demand, exploit, subordinate, elevate); reviewed monthly.

**[GAP]** Not sourced: Kingman's formula as an equation, Erlang C staffing, Little's law, evidence on work-in-progress limits, the ITIL 4 service-level management practice, and any benchmark for target utilisation in knowledge work.
