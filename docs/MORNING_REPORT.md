# Morning report

Good morning. The whole product exists as code in this repository, tested locally with fakes, documented, and ready for a first deploy that you start. **Nothing was deployed, no workflow ran, no model was called, no secret was written.** Evidence is at the end.

## What was built
- **The organization:** AIC → Orchestrator → one Manager per department → Workers hired on demand, as real code: role tools, an Agent Factory, a dispatcher with pause / spend caps / concurrency ceilings / session rate, a ledger where every unit of work is a ticket with history, a crash sweep, a policy gate on every tool call (workers included), approvals bound to the exact action, and the Fable → Opus fallback that runs exactly once.
- **The runtime:** one ARM64 container for four AgentCore runtimes (Claude Agent SDK on Bedrock, startup guard first), prompts in `agents/`.
- **The backend:** HTTP API (22 routes, owner group checked on each), WebSocket API, 11 Lambdas, SQS per role level with DLQs, EventBridge bus, Step Functions approvals, SNS notifications, scheduled jobs (all disabled).
- **The HUD:** AIC with eyes, streamed replies, push-to-talk and wake-word mode (Transcribe + Polly), the **City view ported from your Mac HUD** (same pixel art and layout; AIC in the plaza, Orchestrator at the HQ door, no Secretary or Reviewer), Needs you, Tickets, Costs, Settings, a first-run guide, phone layout. Screenshots in `docs/screenshots/`.
- **Infrastructure:** Terraform for all of it in `eu-north-1`, single `prod`, every resource tagged, KMS everywhere it matters, Cognito with MFA, CloudFront + WAF, AWS Budgets with a deny-Bedrock action, one least-privilege role per runtime with a permission boundary.
- **CI/CD definitions:** `ci.yml` and `deploy.yml`, both `workflow_dispatch` only; deploy uses OIDC and waits for your approval on the `production` environment.

## What was tested, with the real numbers (final run, from a clean clone)
| Check | Result |
|---|---|
| `npm ci && npm run lint && npm run typecheck && npm test` | **pass** — 12 test files, **240 tests** (clean-clone run before the last fix: 239; the 240th is the conversation test added afterwards, run in the working tree) |
| Web build (`vite build`) | pass |
| Playwright against a mocked API, WebSocket and Cognito | **14 / 14 pass** (desktop + phone) |
| axe accessibility (6 screens) | 0 serious / critical violations |
| `terraform fmt -check -recursive` | pass |
| `terraform init -backend=false` + `validate` (bootstrap, envs/prod) | **pass / pass**, no warnings |
| `tflint --recursive` (terraform ruleset, recommended) | **0 issues** |
| `checkov -d infra --framework terraform` | **303 passed, 0 failed, 49 skipped** (each skip justified inline) |
| `scripts/check-tags.mjs` | pass — 57 taggable resources carry `Component` (+ `AgentRole` on runtimes, profiles, memories); both roots set the six default tags |
| `scripts/check-iam.mjs` | pass — workers: no IAM actions, no wildcard secrets, no resource-creating actions, Bedrock only on the worker profile; every role has a boundary |
| Lambda bundles (esbuild) / runtime bundle | 9 bundles built / runtime bundled; started with `ANTHROPIC_API_KEY` set → refused to start, as designed |
| End-to-end chain with a fake model runner | pass — owner → AIC → Orchestrator → new department → 3 hires → reports → one FAIL → fix → PASS → sign-off → AIC; plus crash resume, stale-lease sweep, `@agent` instruction, 500 concurrent hires against ceilings |

## What is NOT tested, because it needs AWS (or Docker)
- **Anything against real AWS**: no `terraform plan` was run (forbidden tonight), so the plan has never been computed against an account. Expect a few first-apply fixes (most likely: resource names/limits, the application-inference-profile copy from a global profile, AgentCore runtime environment-variable size on platform V2).
- **The Claude Agent SDK engine against Bedrock** (`services/agent-runtime/src/engine.ts`): typechecked only. Real tool calling, prompt caching, usage numbers and refusal detection are unverified until the first live turn.
- **`docker build`**: Docker is not installed here. The Dockerfile is checked by a unit test (arm64, port 8080, non-root, Bedrock on) and the bundle it builds was built with esbuild.
- **Voice** with real Transcribe/Polly (tested with a fake voice), the Cognito sign-in redirect round trip (tested up to the redirect), AgentCore Memory, Code Interpreter and Browser, the budget action firing, Step Functions running, CloudWatch dashboard metrics.
- **Prices**: the Bedrock pricing page renders in the browser; figures are Anthropic's list prices and yours from the prompt. Cost math is tested; the bill is the truth.

## Blocked
- **docker build** — Docker not installed on the build machine. Run `scripts/build-images.sh` (or let `deploy.yml` build it).
- **Push to your GitHub repo** — `AIC_GITHUB_REPO` was not set, so all 10 commits are local on `main`. Create the private repo and push (checklist step 13).

## Known gaps (built partly, or not at all)
1. **Workers' S3 workspace sync** — the IAM (session-tagged role limited to `hires/<hire id>/`) is in place; the runtime code that assumes it and syncs files is not written. Workers keep files in their microVM and push work to Git branches.
2. **AgentCore Memory** resources and IAM exist but the runtime doesn't read or write them yet. Agents get their context from the ledger each turn (plus AIC's conversation log), which is why compaction never triggers today (turns don't resume long SDK sessions).
3. **Self-improvement**: the switch (off) and the fence (refuses infra/, IAM, caps, policy, CI, existing tests) are built and tested; the loop's runner itself is not.
4. **Integrations** (GitHub, Google, Spotify via AgentCore Gateway + Identity): secret containers and a disabled gateway only; no gateway targets.
5. **Reminders** are stored and marked due by a (disabled) job, but not emailed yet. Question nudges after 15 minutes work once you enable the `nudge` schedule.
6. **Tracing** is on in Lambdas, Step Functions and AgentCore; trace context is not propagated from the dispatcher into the runtime.
7. Phone layout hides the Departments/Records panel (buildings stay tappable). Passkeys and a custom domain are not configured.

## Decisions I made alone (all in `docs/DECISIONS.md`)
Highlights: Stockholm confirmed (#11); TypeScript pinned to 6.0 for typescript-eslint (#38); a fourth queue for AIC (#39); managers got an `answer_worker` tool (#40); `gh pr merge` and cloud mutation are **denied** for every agent, not asked (#41, #42); AIC's role can write the ledger because its tools need to (#45); worker ledger writes limited by key prefix and owner approvals made delete-only (#46); workers reach S3 only via a session-tagged role (#47); log retention 30 days (#50); image pushed before `terraform apply` in `deploy.yml` (#53); the deploy role is AdministratorAccess fenced by trust and boundary (#54); `[skip ci]` at the end of each commit's subject line, then the Co-Authored-By trailer (#55).

## Evidence: no deploy, no workflow, no model call, no secret
- **Commands not run tonight:** no `terraform plan/apply/import/destroy`, no `aws` CLI, no `docker push/login`, no `gh workflow`, `gh run` or `gh api`, no `agentcore`/`cdk`/`sam`. The only `gh` call was `gh --version`. Terraform was used only for `init -backend=false`, `validate`, `fmt` and `providers schema -json`.
- **No model endpoint called:** every test uses a scripted fake engine or a fake runner; the real engine is never imported in tests.
- **Workflows:** both files have only `on: workflow_dispatch` (enforced by `tests/workflows.test.ts`).
- **Commits:** all 10 subjects end with `[skip ci]`:
```
phase 9: documents, … final check and morning report [skip ci]
phase 9 (docs, part 1): architecture, ADRs, …        [skip ci]
phase 8: CI/CD workflow definitions (…not run)       [skip ci]
phase 7: Terraform infrastructure with tag and IAM checks [skip ci]
phase 6: HUD with ported City view, …                [skip ci]
phase 5: HTTP API, WebSocket, authorizers, …         [skip ci]
phase 4: agent runtime, hierarchy tools, …           [skip ci]
phase 3: shared core (…)                             [skip ci]
phase 2: monorepo scaffold                           [skip ci]
phase 1: facts and decisions                         [skip ci]
```
- **Credential grep** over every tracked file for AWS keys (`AKIA…`, `ASIA…`, `aws_secret_access_key=`), Anthropic keys (`sk-ant-`), GitHub tokens (`ghp_`, `github_pat_`), Slack tokens and private-key headers: **no matches**. No `.env`, `.tfvars`, `.tfstate`, credentials or `.pem` files are tracked. `~/.aws` and `~/.ssh` were never read.

## The exact next step
Open `docs/DEPLOY_CHECKLIST.md` and do **section A, step 1**: create (or pick) the dedicated AWS account and confirm it is the one you want. Then follow the checklist in order; the first live test is "yo AIC, what's 9 + 9?" under a $1 cap.

---

## Requirements table (fresh-eyes review against BUILD_PROMPT.md)

Status: ✅ done and tested · 🟡 built, verified only offline / partly · ❌ not done.

| Requirement | Where | Proved by | Status |
|---|---|---|---|
| 0.1 Never ask; decisions recorded | `docs/DECISIONS.md` (55) | — | ✅ |
| 0.2 No deploy / Bedrock / push / workflow / secret | whole session | Evidence above | ✅ |
| 0.4 Progress log, commit per phase | `docs/PROGRESS.md`, 10 commits | `git log` | ✅ |
| 0.5 New repo, upstream read-only, CLAUDE.md + screenshot copied | repo root, `docs/reference/city-view-mac.png` | first commit | ✅ |
| 0.6 Facts checked with URLs | `docs/FACTS_CHECKED.md` | — | ✅ (prices: verify at deploy) |
| 1.1 Hierarchy exactly AIC → Orchestrator → Manager (1/dept) → Workers; no Reviewer/Secretary | `services/agent-runtime/src/tools.ts`, `agents/` | `tests/hierarchy.e2e.test.ts` | ✅ |
| Workers unlimited; only ceilings/quotas/caps limit concurrency | `packages/shared/src/hierarchy/factory.ts`, `dispatch.ts` | 500-hire test | ✅ |
| Saved specialists reusable | `save_specialist`, Factory `specialist_id` | `hierarchy-lambdas.test.ts` | ✅ |
| Orchestrator sign-off before anything leaves the city | `sign_off`, `report_to_ace` guard, policy denies merge/push main | e2e test | ✅ |
| 1.2 Models pinned in `config/models.json` only | `config/models.json`, `models.ts` | repo-wide test in `models.test.ts` | ✅ |
| Global profiles; prefix one setting; `eu.` → Opus for Fable roles | `models.ts`, Settings, `profile_prefix` var | `models.test.ts` | ✅ |
| Fable fallback once, marked in ledger, no loop | `turn.ts` | `turn.test.ts` | ✅ |
| Application inference profile per role, tagged | `infra/modules/agents` | validate + tag check | 🟡 (AWS may refuse; switch documented) |
| Prompt caching on, cache read/write recorded per turn | SDK default + 1 h for coordinators; `TurnRecord` | `turn.test.ts` | 🟡 (live caching unverified) |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`; compaction | `guard.ts`, Dockerfile, runtime env; `utility.ts` | guard test | 🟡 (compaction built, not triggered: stateless turns) |
| 2.1 S3 + CloudFront OAC, HTTPS, headers, CSP; WAF; Cognito MFA, no sign-up, PKCE, short tokens, rotation, owner group | `infra/modules/frontend`, `auth` | validate, checkov | 🟡 (offline) |
| 2.2 HTTP API JWT + owner group on every route; WebSocket authorizer; connections with TTL | `services/lambdas/src/api.ts`, `ws.ts`, `infra/modules/api` | `api.test.ts` (22 routes × 5 bad tokens) | ✅ |
| 2.3 One image, four runtimes, session IDs, event-driven, async workers ≤ 8 h, startup guard | `services/agent-runtime`, `infra/modules/agents` | `runtime.test.ts`, `guard.test.ts`, e2e | 🟡 (no docker build) |
| 2.4 Role tools exactly as listed, each gated and written to the ledger | `tools.ts`, `engine.ts` | e2e, `policy.test.ts` | ✅ (+ `answer_worker`) |
| 2.5 Ledger single table, PITR, KMS; crash resume | `ledger.ts`, `infra/modules/ledger` | `ledger.test.ts`, crash tests | ✅ |
| Agent Factory + Registry; retire idle on a schedule | `factory.ts`, `scheduler.ts` | tests | ✅ |
| Dispatcher + SQS per role, DLQs, partial batch failure, idempotency, visibility = turn + 1 min, ceilings, pause | `dispatch.ts`, `dispatcher.ts`, `infra/modules/bus` | tests | ✅ |
| Bus with fan-out to WS, ledger, notifications | `infra/modules/api` rules, `ws.ts`, `ledger-writer.ts`, `notifier.ts` | tests | ✅ |
| Notifications: completed, questions > 15 min, spend | `notifier.ts` | `api.test.ts` | 🟡 (nudge schedule off by default) |
| Step Functions approvals with task tokens | `approvals.ts`, `aws_sfn_state_machine.approval` | tests + validate | 🟡 |
| Scheduler jobs created disabled | `aws_scheduler_schedule` `state = "DISABLED"` | validate | ✅ |
| AgentCore Memory; S3 workspaces; start empty | `infra/modules/agents`, `storage` | validate | 🟡 (runtime doesn't use Memory/S3 yet) |
| Secrets: empty containers, read by name | `infra/modules/storage` | checkov | ✅ |
| Gateway for external tools, built but disabled | `aws_bedrockagentcore_gateway` (count 0) | validate | 🟡 (no targets) |
| Observability: logs with retention, JSON, no prompt content, tracing, dashboard | `log.ts`, EMF `metric()`, `infra/modules/observability` | `log` field filter; validate | 🟡 |
| 2.6 Policy gate ported + cloud-mutation rules, `exec` cases, workers on by default | `config/policy.json`, `policy.ts` | 80 policy tests | ✅ |
| IAM least privilege per runtime, boundary on every role | `infra/modules/agents/policies/*`, `security` | `check-iam.mjs`, `infra.test.ts` | ✅ |
| Outside content untrusted | prompts, `quote()` wrapping, policy | prompt tests | ✅ |
| Self-improvement built, disabled, can't touch infra/IAM/caps/policy | `improve.ts` | `hierarchy-lambdas.test.ts` | 🟡 (fence only, no runner) |
| No path to the Mac | — | nothing connects to it | ✅ |
| 2.7 Voice: push-to-talk, wake mode (plain match, Haiku for unclear), Transcribe (vocabulary) + Polly via identity pool | `web/src/voice/*`, `utility.ts`, `infra/modules/auth` | `api.test.ts`, `hud.test.tsx`, Playwright | 🟡 (fake voice only) |
| 2.8 HUD screens: login, AIC + eyes, City view (Mac look, ported), questions/approvals, tickets, costs, settings; responsive, accessible | `web/src` | Playwright 14, axe, screenshots | ✅ |
| City view details: HQ, AIC in plaza, Orchestrator at entrance, buildings per dept with manager at door, workers walk in/out, FREE LOT, growing town, count badge, houses for specialists, top bar, right panel, bottom bar, click a character → ticket/model/activity/cost/instruct | `web/src/city/*`, `CityView.tsx` | Playwright, `hud.test.tsx`, `city-workers.png` | ✅ |
| 2.9 Idiot-proof rules | all screens | `docs/UX_REVIEW.md`, Playwright | ✅ (known gaps listed there) |
| 3 Tags on every resource; AgentRole; ledger cost rows by role/dept/ticket/model/tokens/USD; activate-tags step | providers, modules, `ledger.ts`, checklist step 30 | `check-tags.mjs`, `turn.test.ts` | ✅ |
| 4 Terraform layout, pinned providers, region variable, KMS, deletion protection, offline checks pass | `infra/` | fmt/validate/tflint/checkov | ✅ |
| 5.1 Caps before every turn of every kind; AIC asks to raise; throttling is back-off | `caps.ts`, `turn.ts`, `dispatch.ts` | `turn.test.ts` (7 kinds) | ✅ |
| 5.2 Budget on whole account, 50/80/100 + forecast, deny-Bedrock action | `infra/modules/budgets` | validate, checkov | 🟡 |
| 5.3 `city-off.sh` / `city-on.sh`; what still costs while paused; teardown | `scripts/`, `docs/RUNBOOK.md` | `bash -n` | 🟡 (not run) |
| 6 Ceilings as config with the stated defaults; SCALING doc | `config/caps.json`, Settings, `docs/SCALING.md` | 500-hire test | ✅ |
| 7 Repository layout | as specified | — | ✅ |
| 8 Phase gates 1–9 | `docs/PROGRESS.md` | numbers above | ✅ (docker build blocked) |
| 9 Documents | `docs/*` | — | ✅ |
| 10 Definition of done 1–6 | this report | evidence above | ✅ (with the gaps above, stated honestly) |
