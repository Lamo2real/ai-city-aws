---
name: code-review-checklist
description: "Review a code change for correctness, security, tests and clarity, and report findings ranked by severity with fixes."
---
# Code review

- Read the description and linked issue first; know what the change should do.
- Correctness: does it do that, on every path? Edge cases: empty, null, large, concurrent, retries, time zones.
- Security: input validation, injection, auth on every new route, secrets never logged or committed, least privilege.
- Tests: the change is covered, including the failure path; tests would fail without the fix.
- Clarity: names, small functions, no dead code, comments for why rather than what.
- Performance only where it matters (loops over network calls, N+1 queries, unbounded memory).
- Output: findings ranked Blocker, Should fix, Nit, each with file and line and a suggested fix. Approve only with no blockers.
