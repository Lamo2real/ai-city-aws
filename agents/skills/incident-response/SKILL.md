---
name: incident-response
description: "Handle production incidents: triage, mitigate first, communicate, then fix and write a blameless review."
---
# Incident response

1. Triage with **Sentry**, **Datadog**, **Grafana** or **PagerDuty**: what is broken, for whom, since when, how bad (SEV1 all users down … SEV3 minor).
2. Mitigate first: roll back the last deploy, turn off a feature flag, scale up. Fix the root cause after users are fine.
3. Communicate: a short status note for the owner every 30 minutes while SEV1/SEV2 lasts (what, impact, next step).
4. Fix with a tested change through the normal pull request path.
5. Write a blameless review: timeline, root cause, what went well, actions with owners, in Confluence or Notion.
