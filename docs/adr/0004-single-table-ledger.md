# ADR 0004: One DynamoDB table for the ledger, one storage interface
**Status:** accepted
**Decision.** Single-table design with two GSIs. The ledger logic is written once against a small `Table` interface with an in-memory backend (tests) and a DynamoDB backend (prod). Spend counters use atomic `ADD`; slots and the session rate use conditional `ADD` with a ceiling.
**Consequences.** Tests exercise the same logic that runs in prod. Cap checks read counters and can overshoot by at most the turns already in flight (bounded by the turn timeout).
