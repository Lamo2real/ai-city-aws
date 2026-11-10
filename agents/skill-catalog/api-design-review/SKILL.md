---
name: api-design-review
description: "Review an HTTP API design: resources, naming, errors, pagination, versioning, auth and backwards compatibility."
---
# API design review

- Resources are nouns, actions are methods; consistent plural names and casing.
- Every endpoint: method, path, request and response shapes with types, status codes, and an example.
- Errors: one shape everywhere with a machine-readable code and a human message; 4xx for the caller's mistakes, 5xx for ours.
- Lists paginate (cursor preferred), filter and sort predictably; large responses are bounded.
- Auth on every endpoint; least privilege; idempotency keys for creates and payments; rate limits stated.
- Changes are additive; a breaking change needs a new version and a deprecation date.
- Output: issues ranked with the fix, plus an OpenAPI snippet when it helps.
