# Decisions

One line each: the decision, and why. "Owner" means the owner chose it in conversation before
the build; "Build" means it was chosen during the overnight build.

## Owner's decisions (recorded as given)
1. **Dedicated new AWS account** for AI City. The owner confirms the account before the first deploy.
2. **Budget $150/month, daily global cap $10.** Starting values only: heavy use of Fable and Opus will need higher caps.
3. **No connection to the owner's Mac.** Nothing in this product reaches it.
4. **Workers run isolated in AgentCore microVMs with the policy gate on** (setting `policy_applies_to_workers`, default true).
5. **Global inference profiles.** Cheapest, and the only way to reach Fable from Europe. Prompts may be processed outside the EU. The prefix is one config value (`profilePrefix` in `config/models.json`, `profile_prefix` in Terraform); switching to `eu.` makes Fable roles fall back to Opus 5.5.
6. **Cognito web login over CloudFront** with MFA; the web app is the only public entry point.
7. **Private GitHub repo** for the code.
8. **Start with empty memory.** Nothing imported from the Mac.
9. **Single `prod` environment.**
10. **Anthropic models only**, as pinned in `config/models.json`: Ace Sonnet 5.5, Orchestrator and Managers Fable 5.1 (Opus 5.5 fallback), Workers Opus 5.5, utility Haiku 5.5.

## Build decisions
11. **Region `eu-north-1`.** Facts check confirmed Runtime, Memory, Gateway, Identity, built-in tools and Observability there.
12. **Transcribe and Polly are AWS speech services, not language models**, so they do not conflict with "Anthropic models only".
13. **Voice through a Cognito identity pool** scoped to `transcribe:StartStreamTranscriptionWebSocket` and `polly:SynthesizeSpeech` only (ADR 0006). Simpler and lower latency than a Lambda proxy.
14. **Workers' web search uses the SDK's WebSearch/WebFetch**, because the AgentCore Gateway Web Search connector is not in Stockholm.
15. **Application inference profiles per role, with a switch.** Created from global profiles; if AWS refuses a global source at deploy, `use_application_inference_profiles = false` falls back to calling global profiles and the ledger carries per-role cost.
16. **Fable fallback is one retry on Opus 5.5 per turn**, recorded in the ledger (`fallback: true`). Refusal or no verdict never loops.
17. **Cache TTL:** 1-hour prompt cache for orchestrator and managers (their turns are event-driven and minutes apart), 5-minute for Ace and workers (continuous turns). Cost math supports both.
18. **`CLAUDE_CODE_DISABLE_1M_CONTEXT=1`** everywhere; long sessions compact at 60 % of a 200k window with a Haiku summary.
19. **Runtimes invoked with IAM (SigV4) from Lambda only**, not JWT: only the dispatcher talks to AgentCore, so no inbound JWT config is needed on runtimes.
20. **Ledger is one DynamoDB table** (`aic-prod-ledger`) with `pk`/`sk` plus two GSIs (`gsi1` by status, `gsi2` by department); spend counters are separate items updated atomically with `ADD` and a condition.
21. **Daily caps are per UTC day**, as in upstream; the HUD shows Stockholm time beside it.
22. **Per-department daily cap default $5**, global $10, monthly $150. A department cap above the global cap is pointless and is rejected by Settings.
23. **Concurrency defaults:** 100 workers per department, 2,450 global (2,500 Stockholm quota − 50), 20 new sessions per second (quota 25).
24. **Turn timeout 15 minutes** for synchronous turns (AgentCore request timeout); long worker jobs run async up to 8 h, with a 7.5 h soft limit so the worker reports before AgentCore kills it.
25. **SQS visibility timeout 16 minutes** (turn timeout + 1 minute), DLQ after 3 receives.
26. **Departments are data.** `config/departments.json` is an empty seed; the Orchestrator creates them.
27. **Docker is not installed on the build machine**, so the image was not built tonight; the Dockerfile is written and checked by a unit test that parses it (arm64, port 8080, non-root user).
28. **tflint and checkov installed locally** with Homebrew/pip to run the offline checks (they are local tools, not cloud calls). If installation failed it is listed in the morning report.
29. **HUD state in a plain reducer** ported from upstream `city-state.js`, so the City view is unit-tested in Node.
30. **The City view canvas renderer is ported from upstream `city.js`** (pixel art drawn in code, no image assets), changed for the new cast: Ace in the plaza where Jarvis stood, Orchestrator at the HQ door, Secretary and Reviewer removed.
31. **Ledger writes from workers** go only through the `report_to_manager` / `ask_manager` tools, which put events on the bus; the ledger Lambda writes them. Workers have no DynamoDB permission at all (stricter than "only their own hire record").
32. **Step Functions approvals** use `waitForTaskToken`; the token is stored on the approval item and returned when the owner approves in the HUD.
33. **EventBridge Scheduler jobs are created with `state = "DISABLED"`** (retire idle agents, weekly self-improvement, reminders sweep).
34. **Self-improvement loop: built, disabled, and fenced** — its changed-file check refuses any path under `infra/`, IAM, `config/caps.json`, `config/policy.json` and `.github/`.
35. **Pause flag** lives in the ledger (`CONFIG#city`), read by the dispatcher before every turn; `scripts/city-off.sh` sets it and disables the SQS event source mappings.
36. **No Reviewer and no Secretary agents.** Managers review; the Orchestrator signs off; Ace summarizes.
37. **Bedrock throttling** is retried with full-jitter exponential backoff (base 1 s, cap 30 s, 5 tries), never a pause. "Spend cap reached" is the only pause from spend.
38. **TypeScript pinned ~6.0.3**, because typescript-eslint 8.72 supports TypeScript below 6.1 only.
39. **A fourth queue for Ace** (`aic-prod-ace`), next to the orchestrator, manager and worker queues, so owner messages and results pass the same pause/cap checks as every other turn.
40. **Managers get an `answer_worker` tool** beside the listed ones; without it a worker's `ask_manager` question had no way back.
41. **`gh pr merge` is denied for every agent** (upstream: ask), because the owner merges PRs into `main`.
42. **Cloud mutation from agents is denied, not asked** (upstream asked for `aws ... delete-*` and `terraform destroy`/`apply ... prod`). An owner approval can never unlock a deny rule.
43. **Instructions copy the manager on the record, without waking it**, so an `@agent` instruction costs one turn, not two.
44. **The stale-lease sweep** (scheduled job `sweep`) re-sends messages whose turn crashed; it gives back the dead worker's concurrency slot.
45. **Ace's role can write the ledger and send to the queues.** The prompt lists "read ledger status" for Ace, but Ace's own tools (delegate a task, answer a question, notes, pause) write tickets and messages. Its role still has no Factory, no S3, no secrets.
46. **Worker ledger writes are limited by key prefix** (`dynamodb:LeadingKeys`): tickets, its own agent/turn/tool records, work leases, spend counters, slots, approval *requests*. Workers cannot write settings (pause, caps), departments, specialists, questions or owner approvals. Owner approvals are separate `APPROVED#<hash>` items only the API writes; a worker can only consume (delete) one. Residual: a worker can update another worker's `AGENT#wkr-*` record (documented in SECURITY.md).
47. **Workers reach S3 only by assuming `aic-prod-worker-workspace` with a `hire_id` session tag**; that role is limited to `hires/${aws:PrincipalTag/hire_id}/*`.
48. **The Factory's function name is fixed** (`aic-prod-factory`), so the agents module gets its ARN without depending on the api module (avoids a cycle).
49. **The HUD's `config.json` is written by Terraform** into the site bucket with public values only (endpoints, client and pool IDs).
50. **Log retention 30 days** (variable), not checkov's suggested 1 year, to keep cost low; the ledger is the durable record.
51. **The site bucket uses SSE-S3**, not the KMS key, so CloudFront OAC can read it without a cross-service key policy; it holds only public app files.
52. **WAF also gets AWS's KnownBadInputs rule set** besides the common rules, IP reputation and a 1,000-requests-per-5-minutes rate limit.
