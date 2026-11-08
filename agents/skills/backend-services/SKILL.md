---
name: backend-services
description: "Build backend services and APIs: clear contracts, tests first, typed code, safe data handling."
---
# Backend services

- Contract first: write the API shape (OpenAPI or typed request/response models) before the handler.
- Typed code: Python with type hints and `mypy --strict` clean, or TypeScript `strict`. Lint with `ruff` / `eslint`.
- Tests with every change: unit tests for logic, one integration test per endpoint against a local or fake dependency. No network calls to real services in unit tests.
- Validate every input at the edge; return plain error messages with a stable code; never leak stack traces.
- Idempotent writes (client request ids), timeouts on every outbound call, retries with backoff only for safe operations.
- Data: migrations in code, indexes for every query path, no N+1 queries, pagination on lists.
- Config from environment, secrets from a secret store, never from the repo.
- Look up current framework and SDK versions with the **Context7** connector before using them.
