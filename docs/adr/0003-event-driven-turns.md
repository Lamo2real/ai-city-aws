# ADR 0003: Event-driven turns through SQS, no long-polling
**Status:** accepted
**Context.** Coordinators would otherwise pay for session time while waiting for workers.
**Decision.** A turn issues work (queue messages) and ends. The dispatcher Lambda starts the next turn when a message arrives, after checking the pause flag, caps, ceilings and the session rate. Messages carry an idempotency key; a lease in the ledger makes each run once; a scheduled sweep re-sends work whose lease expired.
**Consequences.** Work above a ceiling or a cap waits in the queue (re-sent with a delay), never dropped. Crash recovery is "re-run the turn": the prompt includes the ledger's current state so the agent carries on.
