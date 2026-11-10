# ADR 0002: Four AgentCore runtimes; departments and workers are sessions
**Status:** accepted
**Context.** Workers are unlimited by design; AgentCore allows 1,000 runtimes per account and 2,500 concurrent sessions in Stockholm.
**Decision.** One container image, four runtimes (vaic, orchestrator, manager, worker), each with its own role and model. A department's manager and each worker are sessions with structured IDs.
**Consequences.** Hiring needs no infrastructure change. IAM is per role, not per worker; per-hire isolation comes from the microVM per session, key-prefix-limited ledger writes and the session-tagged workspace role.
