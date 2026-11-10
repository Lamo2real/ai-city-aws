---
name: spec-review
description: "Review a product spec or PRD before building: gaps, unclear requirements, edge cases, risks and questions, ranked."
---
# Spec review

- Read the spec end to end first; restate the problem and the user in one sentence each. If you can't, that's the first finding.
- Check: is there a measurable goal; who is it for; what is out of scope; what happens on errors, empty states, slow networks, permissions, many items, none.
- Every requirement should be testable. Rewrite vague ones ("fast", "simple") into something checkable.
- Look for hidden work: migrations, notifications, billing, support docs, analytics, accessibility, other teams.
- Risks: legal or privacy questions, dependencies, things that are hard to undo.
- Output: findings ranked Blocker / Should fix / Nice to have, each with the line it refers to and a suggested fix, then open questions for the owner.
