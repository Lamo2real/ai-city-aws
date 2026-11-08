---
name: ci-cd-github
description: "Set up CI/CD with GitHub Actions: tests on every pull request, safe deploys with OIDC, pinned actions."
---
# CI/CD with GitHub Actions

- One workflow for checks on every pull request (lint, typecheck, tests, build) and one for deploys from the default branch.
- Cloud credentials through OIDC (`aws-actions/configure-aws-credentials` with a role), never long-lived keys in secrets.
- Pin third-party actions to a full commit SHA; `permissions:` at the least the job needs.
- Cache dependencies; fail fast; keep the main check under ten minutes.
- Branch protection on the default branch: required checks, no force-push. Use `gh` to set it when the goal asks.
- Deploys: plan/preview on pull requests, apply on merge, a manual approval for production when the owner wants one.
