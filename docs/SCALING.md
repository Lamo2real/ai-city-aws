# Scaling

Workers are unlimited by design. What actually limits how many run **at once**:

| Limit | Real? | Default here | Where it's set | What happens at the limit |
|---|---|---|---|---|
| AgentCore concurrent sessions | **Real (AWS quota)** — 2,500 in Stockholm (5,000 in us-east-1/us-west-2), adjustable | `max_concurrent_workers_global` = 2,450 (2,500 − 50 kept for Ace, Orchestrator, managers) | Settings / `config/caps.json` | Work waits in the worker queue and starts when a slot frees |
| New AgentCore sessions per second | **Real** — 25/s, adjustable | `max_new_sessions_per_second` = 20 | Settings (API refuses > 25) | Deferred 1 s |
| Workers per department | City ceiling (config) | 100 | Settings | Waits in the queue |
| AgentCore runtimes per account | Real — 1,000 | 4 used | — | Never reached: departments and workers are sessions |
| Session hardware | Real — 2 vCPU / 8 GB per session, not adjustable | — | — | Big jobs must be split by the manager |
| Async job length | Real — 8 h (microVMs), not adjustable | 7.5 h soft limit | `async_job_soft_limit_minutes` | The worker reports before it is stopped; longer work must be split |
| Bedrock tokens per minute / requests per minute, per model and profile | **Real** — per account, per region, per model; global profiles have their own quotas | — | Service Quotas | Throttling → jittered back-off (5 tries), never a pause |
| Lambda concurrency | Real — 1,000 per region by default | dispatcher reserved 200; SQS max concurrency per queue (ace 5, orchestrator 10, manager 20, worker 50) | Terraform | Messages wait in SQS |
| DynamoDB on-demand | Effectively unlimited for this load (hot keys: spend counters, `SLOTS`) | — | — | Counter items are small; at thousands of turns per second they would need sharding |
| API Gateway | 10,000 rps account default | stage throttling 20 rps / burst 50 | Terraform | 429 to the HUD, which retries |
| SQS | Effectively unlimited | DelaySeconds max 900 | — | — |
| Spend caps | Optional city brake | none (no limit, the owner's choice) | Settings | Only if set: no new turns; Ace asks to raise |

## How "hundreds of workers" stay readable
The City view gives each department a building whose terrace grows a row of desks for every four workers, with a count badge on the roof; released workers go home, and only the latest 24 stand in the neighbourhood (the rest are listed in Workforce). Rendering is a single canvas with the static town baked once per layout.

## Service Quotas to request before heavy use
1. **Bedrock** in the chosen region, for each model you'll use heavily (Opus 5.5 for workers, Fable 5.1 for coordinators): "tokens per minute" and "requests per minute" for the **global cross-region** profile. The defaults for new accounts can be low; ask for what a busy day needs (rough guide: 50 concurrent Opus workers ≈ several million tokens per minute with caching).
2. **AgentCore Runtime**: "Active session workloads per account" if you set `max_concurrent_workers_global` above 2,450; "New session creation rate" above 25/s.
3. **Lambda** concurrent executions if you raise the dispatcher's reserved concurrency or the worker queue's maximum concurrency much.
Then raise the city ceilings in Settings to match.
