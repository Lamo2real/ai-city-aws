# AI City (Ace) — product spec (living document)

**Read this first after a context reset or a compacted session.** It is the single source of truth for what the product must do, what it does today, and where each part lives. Details live in the linked docs; this file stays short enough to read in one go.

**Rules for this file**
- Update it in the same commit as any change to a requirement, a feature, a default, or an invariant.
- Statuses: ✅ built and tested · 🟡 built, verified offline or partly · ❌ not built. Never mark ✅ without a test that proves it.
- If this file and the code disagree, the code wins: fix this file.
- New larger features: add a row under §6 and an entry in §10.

Last updated: 2026-11-06 (initial build, not deployed).

---

## 1. What the product is
The owner's personal organization of AI agents, running only in the owner's AWS account. The owner signs in to a web app and talks or types to **Ace** (written AIC, said "Ace"). Ace hands real work to an organization that hires workers on demand, does the work, checks it, and reports back.

## 2. Non-negotiables (from `CLAUDE.md` and `BUILD_PROMPT.md`)
1. **AWS only, serverless-first.** Agents on Amazon Bedrock AgentCore; everything else Lambda, API Gateway, DynamoDB, SQS, EventBridge, Step Functions, S3, CloudFront, Cognito. No EC2 for the core. Code on GitHub.
2. **Billed only through Bedrock with IAM roles.** Never an Anthropic API key, OAuth token, Bedrock API key or subscription login. The startup guard refuses to start otherwise.
3. **Anthropic models only**, IDs pinned in `config/models.json` and nowhere else (a test scans the repo). Transcribe and Polly are speech services, allowed.
4. **Single environment `prod`**, region `eu-north-1`, Terraform in `infra/`.
5. **Only the owner can get in:** Cognito with MFA, no self-sign-up, `owner` group checked on every API route.
6. **Never deploy from an agent session.** `terraform apply`, image pushes and AWS CLI changes are run by the owner or by `deploy.yml` after approval. Workflows are `workflow_dispatch` only. Commit subjects end with `[skip ci]`.
7. **Secrets** in Secrets Manager, read by name at runtime; never in code, Terraform, logs, prompts, docs or commits.
8. **Every tool call by every agent (workers too) passes the policy gate** in `packages/shared`.
9. **Spend caps checked before every turn of every kind.** Money in the city is an estimate; the AWS bill is the truth.
10. **Self-improvement stays disabled** and may never change `infra/`, IAM, spend caps or the policy file.
11. **Outside content is untrusted data**, never instructions (web pages, repo files, tool output, worker reports).
12. **Every cost-relevant resource is tagged** (`Project, App, Environment, Owner, ManagedBy, CostCenter, Component`; plus `AgentRole` on runtimes, inference profiles, memories).
13. **No connection to the owner's Mac.**
14. Smallest complete change; tests for every non-trivial module; unit tests never call Bedrock; say what was and wasn't tested.

## 3. The hierarchy (exactly this)
```
Owner (Cognito) → Ace → Orchestrator → Department Manager (one per department) → Workers (unlimited, hired per assignment)
```
| Agent | Model | Does | Tools |
|---|---|---|---|
| Ace | Sonnet 5.5 | Talks to the owner; answers simple things; hands real work to the Orchestrator; relays questions; reports results | `delegate_to_orchestrator`, `get_status`, `answer_question`, `instruct_agent` (@agent, manager copied), `add_note`, `list_notes`, `add_reminder`, `pause_city`, `resume_city` |
| Orchestrator | Fable 5.1 → Opus 5.5 once | Plans, creates departments (data), one goal per department, **final sign-off** before anything leaves the city (PR to main, protected push, spend) | `create_department`, `assign_to_department`, `get_reports`, `sign_off`, `ask_owner`, `report_to_ace` |
| Manager | Fable 5.1 → Opus 5.5 once | Plans the department's work, hires, **reviews every deliverable (PASS/FAIL)**, releases, reports | `hire_worker`, `assign`, `answer_worker`, `review`, `release_worker`, `save_specialist`, `ask_owner`, `report_to_orchestrator` |
| Worker | Opus 5.5 | One assignment, then released | granted built-ins (shell, files, git, web, Code Interpreter, Browser) + `ask_manager`, `report_to_manager` |
| Utility (not an agent) | Haiku 5.5, prompts < 100k tokens | Wake-word check for unclear transcripts, titles, compaction | — |

No Reviewer and no Executive Secretary. The owner merges PRs into `main`.

## 4. How it runs (one paragraph)
Owner message → `POST /messages` → SQS (`ace` queue) → **dispatcher** Lambda (pause flag → spend caps → worker ceilings → session rate → lease) → `InvokeAgentRuntime` → runtime **host** reads the ledger, builds the prompt, runs one **gated turn** (caps, throttle back-off, fallback once, cost row) → tools write the ledger, put events on the bus, queue the next agent → turn ends. Events fan out to the WebSocket (City view, Ace's streamed reply), the ledger (ticket trace) and SNS email. Turns are stateless: context comes from the ledger each turn (plus Ace's conversation log). Details: `docs/ARCHITECTURE.md`.

## 5. Key defaults (change in Settings / `config/caps.json` / `prod.tfvars`)
| Setting | Default |
|---|---|
| Monthly budget (AWS Budgets, whole account) | $150 |
| Daily cap, all departments / per department | $10 / $5 |
| Workers at once: per department / global | 100 / 2,450 (Stockholm quota 2,500 − 50) |
| New sessions per second | 20 (AgentCore limit 25) |
| Turn timeout / worker async soft limit | 15 min / 7.5 h (hard 8 h) |
| Review rounds before asking the owner | 3 |
| Inference profile prefix | `global` (`eu` → Fable roles use Opus) |
| Prompt cache TTL | 1 h orchestrator/managers, 5 min Ace/workers |
| Log retention | 30 days |
| Scheduled jobs | all created **DISABLED** |

## 6. Features and status
| Area | Feature | Status | Where |
|---|---|---|---|
| Core | Model map, fallback, `eu.` degradation, app-profile ARNs | ✅ | `packages/shared/src/models.ts`, `config/models.json` |
| Core | Startup guard (Bedrock on; refuses API key, OAuth token, Bedrock API key, `CLAUDE_CODE_USE_ANTHROPIC_AWS`; scrub on) | ✅ | `guard.ts` |
| Core | Policy gate (upstream rules + cloud-mutation denies; `exec` cases; workers on by default) | ✅ | `config/policy.json`, `policy.ts` |
| Core | Approvals bound to the exact action (hash), owner-only `APPROVED#` items, consumed once, Step Functions wait | ✅ / 🟡 SFN | `policy.ts`, `ledger.ts`, `approvals.ts` |
| Core | Single-table ledger (tickets + history, agents, departments, specialists, questions, turns, spend counters, slots, settings, traces, notes) | ✅ | `ledger.ts`, `table.ts` |
| Core | Spend caps before every turn kind; Ace asks to raise | ✅ | `caps.ts`, `turn.ts`, `dispatch.ts` |
| Core | Throttling = jittered back-off, never a pause | ✅ | `turn.ts` |
| Core | Cost math (5 min / 1 h cache writes, geo +10 %, Haiku long-context ×5) | ✅ | `cost.ts` |
| Hierarchy | Full chain incl. FAIL → fix → PASS → sign-off | ✅ | `tests/hierarchy.e2e.test.ts` |
| Hierarchy | Agent Factory (spec validation, unlimited hires, saved specialists) | ✅ | `hierarchy/factory.ts` |
| Hierarchy | Dispatcher ceilings, session rate, idempotent leases, crash sweep | ✅ | `hierarchy/dispatch.ts` |
| Hierarchy | `@agent` instructions with manager copied (no extra turn) | ✅ | `hierarchy/actions.ts` |
| Hierarchy | Ace conversation memory (typed + spoken, last 12 lines) | ✅ | `ledger.ts`, `host.ts` |
| Runtime | AgentCore container (8080, `/ping` Healthy/HealthyBusy, `/invocations` sync/async) | ✅ code / 🟡 image never built | `services/agent-runtime` |
| Runtime | Claude Agent SDK engine on Bedrock | 🟡 typechecked only | `engine.ts` |
| API | HTTP API, 22 routes, owner group re-checked | ✅ | `services/lambdas/src/api.ts` |
| API | WebSocket: `$connect` authorizer, connections with TTL, broadcast | ✅ | `ws.ts` |
| API | Notifications (results, cap alerts, pause, 15-min question nudge) | ✅ / nudge job off | `notifier.ts` |
| API | Budget alert at 100 % pauses the city | ✅ | `budget.ts` |
| Voice | Push-to-talk, wake mode (plain match, Haiku for unclear), Transcribe + Polly via identity pool | 🟡 fake voice only | `web/src/voice/`, `utility.ts` |
| HUD | Ace screen (eyes: idle/listening/thinking/speaking/waiting; streaming; drafts + outbox survive reloads) | ✅ | `web/src/components/AceScreen.tsx` |
| HUD | City view ported from the Mac HUD (Ace in plaza, Orchestrator at HQ door, manager at each department door, workers walk in/out, FREE LOTs, growing town, count badges, houses for specialists, top bar, right panel, bottom bar) | ✅ | `web/src/city/`, `CityView.tsx` |
| HUD | Needs you (default answer in one tap; hold-to-approve), Tickets, Costs, Settings, first-run guide, spend pill (amber 80 %, red 100 %) | ✅ | `web/src/components/` |
| HUD | Idiot-proof rules (one primary button, confirms with cost, Undo, plain errors, 44 px targets) | ✅ | `docs/UX_REVIEW.md` |
| Infra | Terraform: bootstrap, 10 modules, prod root; KMS; deletion protection | 🟡 offline checks only | `infra/` |
| Infra | One role per runtime, permission boundary on every role, worker limits | ✅ (static check) | `infra/modules/agents/policies/`, `scripts/check-iam.mjs` |
| Infra | Cost-allocation tags on every taggable resource | ✅ (static check) | `scripts/check-tags.mjs` |
| Infra | AWS Budgets 50/80/100 + forecast, deny-Bedrock budget action | 🟡 | `infra/modules/budgets` |
| Ops | `city-off.sh` / `city-on.sh`, `build-images.sh` (no push) | 🟡 not run | `scripts/` |
| CI/CD | `ci.yml`, `deploy.yml` (OIDC, approval on `production`), dispatch-only | 🟡 never run | `.github/workflows/` |
| Gap | Worker S3 workspace sync (IAM ready) | ❌ | — |
| Gap | Runtime use of AgentCore Memory | ❌ | — |
| Gap | Self-improvement runner (switch + fence exist) | ❌ | `services/lambdas/src/improve.ts` |
| Gap | Gateway targets for GitHub / Google / Spotify (gateway off, secrets empty) | ❌ | `infra/modules/agents`, `storage` |
| Gap | Reminders emailed | ❌ | `scheduler.ts` |
| Gap | Trace propagation dispatcher → runtime; passkeys; custom domain; Departments panel on phones | ❌ | — |

## 7. Invariants that tests enforce (don't break these)
- No file except `config/models.json` contains a model ID (`packages/shared/test/models.test.ts`).
- Guard refuses each forbidden variable and Bedrock-off (`guard.test.ts`).
- Caps block all 7 turn kinds; a refusal triggers exactly one fallback (`turn.test.ts`).
- Policy decisions for ~70 commands incl. `exec` and AWS mutation (`policy.test.ts`).
- Every API route rejects a token without the `owner` group (`services/lambdas/test/api.test.ts`).
- 500 hires respect ceilings and the session rate; nothing dropped (`tests/hierarchy.e2e.test.ts`).
- Workflows are `workflow_dispatch` only; commit subjects end with `[skip ci]` (`tests/workflows.test.ts`).
- Tags and worker IAM limits (`tests/infra.test.ts`).
- HUD journeys, ≤ 1 primary button per screen, axe clean (`web/e2e/`).

## 8. How to verify everything locally
```bash
npm ci && npm run lint && npm run typecheck && npm test
```
```bash
npm run build -w @aic/web && npm run e2e -w web
```
```bash
node scripts/check-tags.mjs && node scripts/check-iam.mjs
```
Terraform (offline only): `fmt -check -recursive`, `init -backend=false`, `validate` in `infra/bootstrap` and `infra/envs/prod`, `tflint --recursive`, `checkov -d infra`.

## 9. Where to look
| Need | Doc |
|---|---|
| Why a choice was made | `docs/DECISIONS.md`, `docs/adr/` |
| AWS/Anthropic facts and IDs (with URLs) | `docs/FACTS_CHECKED.md` |
| Architecture, data model | `docs/ARCHITECTURE.md` |
| Security, threat model, IAM | `docs/SECURITY.md` |
| Limits and quotas | `docs/SCALING.md` |
| Operating it | `docs/RUNBOOK.md` |
| First deploy | `docs/DEPLOY_CHECKLIST.md` |
| Costs | `docs/COST_ESTIMATE.md` |
| What the Mac version had | `docs/CAPABILITY_GAPS.md` |
| History of the build | `docs/PROGRESS.md`, `docs/MORNING_REPORT.md` |

## 10. Feature log (newest first)
| Date | Feature | Notes |
|---|---|---|
| 2026-11-06 | Initial build, phases 1–9 | Not deployed. 240 tests, Playwright 14/14, Terraform checks clean. See `docs/MORNING_REPORT.md`. |
