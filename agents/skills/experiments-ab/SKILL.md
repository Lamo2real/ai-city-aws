---
name: experiments-ab
description: "Design and read A/B tests properly: a hypothesis, one change, enough traffic, and an honest result."
---
# Experiments (A/B tests)

1. Hypothesis: "Changing X for audience Y will move metric Z by at least N%, because …".
2. One change per test; a primary metric chosen before the start; guardrail metrics (refunds, complaints).
3. Sample size and duration computed before starting (full weeks, at least one business cycle).
4. Run in **PostHog** or the owner's tool with feature flags; no peeking-based stops.
5. Read: effect size with a confidence interval, practical significance, segments only as hypotheses for the next test.
