# ADR 0010: Two layers of spend control
**Status:** superseded in part (2026-11-06, decision 56): the owner chose no spend limit. City caps are optional and off by default; AWS Budgets only emails (no deny-Bedrock action, no automatic pause).
**Decision.** (1) Real-time city caps checked before every turn of every kind from DynamoDB counters: at a cap no new turn starts and Ace asks whether to raise it. (2) AWS Budgets on the whole account with a 100 % action that attaches a deny-Bedrock policy to the four agent roles; a 100 % alert also pauses the city.
**Consequences.** Budgets lag by hours and reset each period, so the city caps are the brake and Budgets the backstop. Throttling is retried with jitter, never treated as a pause.
