# AI City (AIC) — product spec (living document)

**Read this first after a context reset or a compacted session.** It is the single source of truth for what the product must do, what it does today, and where each part lives. Details live in the linked docs; this file stays short enough to read in one go.

**Rules for this file**
- Update it in the same commit as any change to a requirement, a feature, a default, or an invariant.
- Statuses: ✅ built and tested · 🟡 built, verified offline or partly · ❌ not built. Never mark ✅ without a test that proves it.
- If this file and the code disagree, the code wins: fix this file.
- New larger features: add a row under §6 and an entry in §10.

Last updated: 2026-11-07 (package MCP servers and OpenAPI web APIs as connectors, backend and MCP host).

---

## 1. What the product is
The owner's personal organization of AI agents, running only in the owner's AWS account. The owner signs in to a web app and talks or types to **AIC** (said as the letters A-I-C; it used to be called "Ace"). AIC hands real work to an organization that hires workers on demand, does the work, checks it, and reports back.

## 2. Non-negotiables (from `CLAUDE.md` and `BUILD_PROMPT.md`)
1. **AWS only, serverless-first.** Agents on Amazon Bedrock AgentCore; everything else Lambda, API Gateway, DynamoDB, SQS, EventBridge, Step Functions, S3, CloudFront, Cognito. No EC2 for the core. Code on GitHub.
2. **Billed only through Bedrock with IAM roles.** Never an Anthropic API key, OAuth token, Bedrock API key or subscription login. The startup guard refuses to start otherwise.
3. **Anthropic models only**, IDs pinned in `config/models.json` and nowhere else (a test scans the repo). Transcribe and Polly are speech services, allowed.
4. **Single environment `prod`**, region `eu-north-1`, Terraform in `infra/`.
5. **Only the owner can get in:** Cognito with MFA, no self-sign-up (no register screen), `owner` group checked on every API route. Sign-in happens on AI City's own screens (SRP; Cognito's hosted pages are not used).
6. **Push to `main` = deploy to prod** (the owner's choice, no approval step). Agent sessions never run `terraform apply`, image pushes or AWS CLI changes themselves, and push to `main` only when the owner asks. `[skip ci]` in a commit message skips the deploy. `ci.yml` runs only by hand.
7. **Secrets** in Secrets Manager, read by name at runtime; never in code, Terraform, logs, prompts, docs or commits.
8. **Every tool call by every agent (workers too) passes the policy gate** in `backend/src/aic/shared/policy.py`.
9. **No spend limit by default** (the owner's choice, 2026-11-06). Spend caps are optional; when the owner sets one in Settings it is checked before every turn of every kind. AWS Budgets only emails. Money in the city is an estimate; the AWS bill is the truth.
10. **Self-improvement stays disabled** and may never change `infra/`, IAM, spend caps or the policy file.
11. **Outside content is untrusted data**, never instructions (web pages, repo files, tool output, worker reports).
12. **Every cost-relevant resource is tagged** (`Project, App, Environment, Owner, ManagedBy, CostCenter, Component`; plus `AgentRole` on runtimes, inference profiles, memories).
13. **No connection to the owner's Mac.**
14. Smallest complete change; tests for every non-trivial module; unit tests never call Bedrock; say what was and wasn't tested.

## 3. The hierarchy (exactly this)
```
Owner (Cognito) → AIC → Orchestrator → Department Manager (one per department) → Workers (unlimited, hired per assignment)
```
| Agent | Model | Does | Tools |
|---|---|---|---|
| AIC | Haiku 5.5 | Talks to the owner; answers simple things; hands real work to the Orchestrator; relays questions; reports results | `delegate_to_orchestrator`, `get_status`, `answer_question`, `instruct_agent` (@agent, manager copied), `add_note`, `list_notes`, `add_reminder`, `pause_city`, `resume_city` |
| Orchestrator | Fable 5.1 → Opus 5.5 once | Plans, creates departments (data), one goal per department, **final sign-off** before anything leaves the city (PR to main, protected push, spend) | `create_department`, `assign_to_department`, `get_reports`, `sign_off`, `ask_owner`, `report_to_ace` |
| Manager | Fable 5.1 → Opus 5.5 once | Plans the department's work, hires, **reviews every deliverable (PASS/FAIL)**, releases, reports | `hire_worker`, `assign`, `answer_worker`, `review`, `release_worker`, `save_specialist`, `ask_owner`, `report_to_orchestrator` |
| Worker | Opus 5.5 | One assignment, then released | granted built-ins (shell, files, git, web, Code Interpreter, Browser) + `ask_manager`, `report_to_manager` |
| Utility (not an agent) | Haiku 5.5, prompts < 100k tokens | Wake-word check for unclear transcripts, titles, compaction | — |

No Reviewer and no Executive Secretary. The owner merges PRs into `main`.

## 4. How it runs (one paragraph)
Owner message → `POST /messages` → SQS (`ace` queue) → **dispatcher** Lambda (pause flag → spend caps, if the owner set any → worker ceilings → session rate → lease) → `InvokeAgentRuntime` → runtime **host** reads the ledger, builds the prompt, runs one **gated turn** (caps, throttle back-off, fallback once, cost row) → tools write the ledger, put events on the bus, queue the next agent → turn ends. Events fan out to the WebSocket (City view, AIC's streamed reply), the ledger (ticket trace) and SNS email. Turns are stateless: context comes from the ledger each turn (plus AIC's conversation log). Details: `docs/ARCHITECTURE.md`.

## 5. Key defaults (change in Settings / `config/caps.json` / `prod.tfvars`)
| Setting | Default |
|---|---|
| Spend caps: daily all departments / per department / monthly | **none (no limit)**; optional in Settings |
| AWS Budgets alert amount (whole account) | **$10,000 / month**, emails only at 50/80/100 % ($5k / $8k / $10k) + forecast; nothing is blocked |
| Workers at once: per department / global | 100 / 2,450 (Stockholm quota 2,500 − 50) |
| New sessions per second | 20 (AgentCore limit 25) |
| Turn timeout / worker async soft limit | 15 min / 7.5 h (hard 8 h) |
| Review rounds before asking the owner | 3 |
| Inference profile prefix | `global` (`eu` → Fable roles use Opus) |
| Prompt cache TTL | 1 h orchestrator/managers, 5 min AIC/workers |
| Log retention | 30 days |
| Scheduled jobs | all created **DISABLED** |

## 6. Features and status
| Area | Feature | Status | Where |
|---|---|---|---|
| Core | Model map, fallback, `eu.` degradation, app-profile ARNs | ✅ | `backend/src/aic/shared/models.py`, `config/models.json` |
| Core | Startup guard (Bedrock on; refuses API key, OAuth token, Bedrock API key, `CLAUDE_CODE_USE_ANTHROPIC_AWS`; scrub on) | ✅ | `guard.py` |
| Core | Policy gate (upstream rules + cloud-mutation denies; `exec` cases; workers on by default) | ✅ | `config/policy.json`, `policy.py` |
| Core | Approvals bound to the exact action (hash), owner-only `APPROVED#` items, consumed once, Step Functions wait | ✅ / 🟡 SFN | `policy.py`, `ledger.py`, `lambdas/approvals.py` |
| Core | Single-table ledger (tickets + history, agents, departments, specialists, questions, turns, spend counters, slots, settings, traces, notes) | ✅ | `ledger.py`, `table.py` |
| Core | Optional spend caps (off by default = no limit); when set, checked before every turn kind | ✅ | `caps.py`, `turn.py`, `hierarchy/dispatch.py` |
| Core | Throttling = jittered back-off, never a pause | ✅ | `turn.py` |
| Core | Cost math (5 min / 1 h cache writes, geo +10 %, Haiku long-context ×5) | ✅ | `cost.py` |
| Hierarchy | Full chain incl. FAIL → fix → PASS → sign-off | ✅ | `backend/tests/test_hierarchy_e2e.py` |
| Hierarchy | Agent Factory (spec validation, unlimited hires, saved specialists) | ✅ | `hierarchy/factory.py` |
| Hierarchy | Dispatcher ceilings, session rate, idempotent leases, crash sweep | ✅ | `hierarchy/dispatch.py` |
| Hierarchy | `@agent` instructions with manager copied (no extra turn) | ✅ | `hierarchy/actions.py` |
| Hierarchy | AIC conversation memory (typed + spoken, last 12 lines) | ✅ | `ledger.py`, `runtime/host.py` |
| Runtime | AgentCore container (8080, `/ping` Healthy/HealthyBusy, `/invocations` sync/async) | ✅ code / 🟡 image never built | `backend/src/aic/runtime/server.py`, `services/agent-runtime/Dockerfile` |
| Runtime | Claude Agent SDK (Python) engine on Bedrock | 🟡 type-checked only, never run against Bedrock | `runtime/engine.py` |
| API | HTTP API, 22 routes, owner group re-checked | ✅ | `backend/src/aic/lambdas/api.py` |
| API | WebSocket: `$connect` authorizer, connections with TTL, broadcast | ✅ | `lambdas/ws.py` (Cognito token checked with PyJWT) |
| API | Notifications (results, cap alerts, pause, 15-min question nudge) | ✅ / nudge job off | `lambdas/notifier.py` |
| Voice | Push-to-talk, wake mode (plain match, Haiku for unclear), Transcribe + Polly via identity pool (no server-side token check; a refused token is retried once with a freshly refreshed one); a failing mic or speech service shows its real cause (blocked permission, no mic, mic busy, AWS error name) and logs `[AIC voice] …` with the original error to the browser console; a broken or closed stream stops listening instead of hanging | 🟡 fake voice only (error messages unit- and Playwright-tested; real Transcribe not run in a browser) | `web/src/voice/`, `utility.py`, `tests/fixtures/wake-cases.json` |
| HUD | Own sign-in screens: temporary password → own password (live rules) → authenticator app (QR + key) → code; later password + code; forgot password; “send me a new first-login email” (public API route, owner's email only, 1 per 10 min) | ✅ (fake auth in Playwright) / 🟡 real Cognito not yet tried | `web/src/components/SignIn.tsx`, `web/src/lib/auth.ts`, `backend/src/aic/lambdas/api.py` |
| HUD | AIC screen in a bright daytime theme (parchment, ink outlines, wood and lamplight from the City): the eye (the owner's own drawing, `web/public/ace-eye.png`, plain ink with no colour change or motion in any state) with a voice line under it on the left (just the horizontal line, no frame around it), the chat on the right (stacked on a phone). The strip shows who talks by shape, words and colour: blue bars following the owner's mic level ("You’re talking"), a brown flowing wave following AIC's Polly reply ("AIC is talking"), travelling dots ("AIC is thinking"), a flat line when idle; still pictures with prefers-reduced-motion. The chat puts the owner on the right in a filled bubble and AIC on the left as plain full-width text, with AIC's Markdown rendered (headings, lists, tables, code, links to http(s) only; built as React elements, never raw HTML); while AIC works, a status row in Claude's style shows on its side: a small copy of the eye blinking slowly, the current step in silver with a soft shimmer (from AIC's `activity` events; the direct engine now sends the tool name as the detail, so get_status reads "Checking the ledger", delegate_to_orchestrator "Handing this to the Orchestrator") and the seconds so far; the steps (when there were two or more) fold under the finished reply and open on a tap; then the reply revealed at a steady typing pace that catches up with what has arrived, with a caret, half-arrived Markdown held back so nothing flickers, and a snap to the final text when done (with prefers-reduced-motion: no blink, no shimmer, text appears directly); drafts + outbox survive reloads | ✅ | `web/src/components/AceScreen.tsx`, `VoiceVisualizer.tsx`, `StreamedText.tsx`, `AicStatus.tsx`, `web/src/lib/steps.ts`, `web/src/lib/markdown.tsx` |
| HUD | City view ported from the Mac HUD (AIC in plaza, Orchestrator at HQ door, manager at each department door, workers walk in/out, FREE LOTs, growing town, count badges, houses for specialists, top bar, right panel, bottom bar) | ✅ | `web/src/city/`, `CityView.tsx` |
| HUD | Needs you (default answer in one tap; hold-to-approve), Tickets, Costs, Settings, first-run guide, spend pill (amber 80 %, red 100 %) | ✅ | `web/src/components/` |
| HUD | Idiot-proof rules (one primary button, confirms with cost, Undo, plain errors, 44 px targets) | ✅ | `docs/UX_REVIEW.md` |
| Infra | Terraform: 10 modules, prod root (state bucket created by `deploy.yml`); KMS; deletion protection | 🟡 offline checks only | `infra/` |
| Infra | One role per runtime, permission boundary on every role, worker limits | ✅ (static check) | `infra/modules/agents/policies/`, `scripts/check-iam.mjs` |
| Infra | Cost-allocation tags on every taggable resource | ✅ (static check) | `scripts/check-tags.mjs` |
| Infra | AWS Budgets 50/80/100 + forecast, email alerts only (no deny action, no pause) | 🟡 | `infra/modules/budgets` |
| Ops | `city-off.sh` / `city-on.sh`, `build-images.sh` (no push) | 🟡 not run | `scripts/` |
| CI/CD | `ci.yml`, `deploy.yml`: needs only the variable `AIC_DEPLOY_ROLE_ARN` + the secret `AIC_OWNER_EMAIL`; creates the state bucket if missing; runs on every push to `main` (no approval; docs-only pushes skipped); one plan builds + pushes the image (tag = hash of the runtime sources) and deploys from nothing | 🟡 never run | `.github/workflows/`, `scripts/ensure-state-bucket.sh`, `scripts/push-image.sh` |
| Gap | Worker S3 workspace sync (IAM ready) | ❌ | — |
| Gap | Runtime use of AgentCore Memory | ❌ | — |
| Gap | Self-improvement runner (switch + fence exist) | ❌ | `backend/src/aic/lambdas/improve.py` |
| Connectors | Any MCP server, added by asking AIC (`add_connector`; registry lookup or URL; owner approval card; "Sign in to …" through AgentCore Identity OAuth, or a secure key field to Secrets Manager). Any server works: remote servers, npm/PyPI package servers, and web APIs without an MCP server given by their OpenAPI 3 link, that the city installs on demand in an isolated MCP host runtime at the exact version the owner approved. Nothing is pre-installed. Works on the next turn without a redeploy. One Gateway, a bridge Lambda, a per-role Cedar ceiling, per-worker grants, every call gated and audited, output treated as untrusted data. GitHub, Tavily and Slack are the first | 🟡 remote MCP servers: backend built and tested offline with fakes (tool, approval hook, connectors and bridge Lambdas, Gateway client, gate levels, `/connectors*` API, `app_call` for apps); not deployed. 🟡 OpenAPI web APIs (§1.11): backend built on branch `connectors-openapi` and tested offline with fake specs and a fake HTTP sender (spec link detection, Swagger 2 and remote `$ref` refusal, one tool per operation with method annotations, API key/bearer/basic/OAuth authorization-code/client-credentials mapping, spec stored in S3, pinned HTTPS calls with no off-host redirects, 30 s, 5 MB, JSON or text, the key cut out of answers); choosing operations by tag isn't built (over 200, the first 200 GETs are offered), and Settings → Add by link is still MCP only. 🟡 package servers (§1.10): `add_connector` (npm/PyPI specs and registry `packages[]`, exact version, oci refused, env prompts), the bridge and connectors Lambda paths to the MCP host, the env key route and the host image `services/mcp-host/` built on branch `connectors-packages` and tested offline (a fake AgentCore client feeding the real host code, which runs a fake stdio MCP server); no real npm/PyPI install, image build or AgentCore call was tried, and the HUD's env fields and the host's Terraform are other sessions' work. 🟡 infra built on branch `connectors-infra` (Gateway with Cedar ENFORCE, workload identity, bridge and connectors Lambdas, MCP host runtime, specs bucket, IAM; validated offline, not deployed). HUD is another session's work. AgentCore API shapes are checked against botocore 1.43's models, but no call has been made to AWS | `docs/CONNECTORS_SKILLS.md`, `infra/modules/connectors`, `runtime/gateway.py`, `shared/gateway.py`, `runtime/connector_tool.py`, `lambdas/connectors.py`, `lambdas/connector_bridge.py`, `lambdas/connectors_api.py`, `shared/connector_calls.py`, `shared/connector_packages.py`, `services/mcp-host/`, `connectors/openapi*.py` |
| Mail & calendar | Several mailboxes and calendars (Google, Microsoft 365, IMAP/CalDAV), added on demand like any connector (`add_connector`; sign-in per account or an app password in a secure form); mail and calendar tools behind the gate; sending, trashing, invitations and deletes need the owner (standing rules for named safe cases); mail treated as untrusted content; read API for apps (a combined calendar is an app, with no Calendar page) | 🟡 backend built and tested with fakes (no real Google, Microsoft or IMAP account tried); HUD not built; 🟡 infra built on branch `connectors-infra` (workload identity, Google/Microsoft providers behind `mail_providers`, secret containers, IAM; workers get none; not deployed) | `docs/MAIL_CALENDAR.md`, decisions 74–76, `infra/modules/mail` |
| Skills | Owner-added `SKILL.md` folders (HUD upload, per-role access) in S3, fetched at turn start. SDK agents load them as a city plugin, AIC through `use_skill`. Agents can't edit skills | 🟡 backend built and tested offline (upload checks, versioned S3 storage, `/skills*` API, plugin folder, `Skill` checked in `can_use_tool`, `use_skill`); the CLI's plugin loading was checked against the bundled CLI (opt-in `tests/test_cli_skills.py`). 🟡 infra built on branch `connectors-infra` (bucket `aic-prod-skills`, runtime read / api write IAM; not deployed); the HUD Skills screen is another session's work | `docs/CONNECTORS_SKILLS.md`, `infra/modules/skills`, `runtime/skills.py`, `lambdas/skills_api.py`, `shared/skills.py`, HUD Skills screen |
| Gap | Reminders emailed | ❌ | `lambdas/scheduler.py` |
| Gap | Trace propagation dispatcher → runtime; passkeys; custom domain; Departments panel on phones | ❌ | — |

## 7. Invariants that tests enforce (don't break these)
- No file except `config/models.json` contains a model ID (`backend/tests/test_models.py`).
- Guard refuses each forbidden variable and Bedrock-off (`test_guard.py`).
- No spend limit by default: a turn runs whatever was spent. A cap the owner sets blocks all 7 turn kinds. A refusal triggers exactly one fallback (`test_turn.py`).
- Policy decisions for ~70 commands incl. `exec` and AWS mutation (`test_policy.py`).
- Every API route rejects a token without the `owner` group (`backend/tests/test_api.py`), `/connectors*` and `/skills*` included.
- A package connector is pinned to the exact version on its card; the host refuses ranges, tags, paths, oci and AWS variables, starts the package with only PATH, HOME and its own variables, and restarts it once (`backend/tests/test_connector_packages.py`).
- OpenAPI connectors call only the spec's https host: no redirect off it, the host re-checked against private addresses at every call, and the credential never in a result or a log (`backend/tests/test_openapi.py`).
- `add_connector` is offered only on the owner's own message; nothing is provisioned without the owner's approval; keys never reach logs, the ledger or answers; a connector tool not given to the turn is refused (`backend/tests/test_connectors.py`, `test_gateway.py`).
- `app_call` refuses ungranted, revoked, write, destructive and unknown tools; a skill is never pre-approved and only `aic-skills:<name>` of this turn passes `can_use_tool` (`backend/tests/test_gateway.py`).
- 500 hires respect ceilings and the session rate; nothing dropped (`backend/tests/test_hierarchy_e2e.py`).
- `deploy.yml` runs only on pushes to `main` or by hand (never on pull requests); `ci.yml` only by hand (`tests/workflows.test.ts`).
- Tags and worker IAM limits (`tests/infra.test.ts`).
- HUD journeys, ≤ 1 primary button per screen, axe clean (`web/e2e/`).

## 8. How to verify everything locally
```bash
cd backend && uv sync --all-extras && uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest -q
```
```bash
python3 backend/scripts/build_lambdas.py
```
```bash
npm ci && npm run lint && npm run typecheck && npm test
```
```bash
npm run build -w @aic/web && npm run e2e -w web
```
```bash
node scripts/check-tags.mjs && node scripts/check-iam.mjs
```
Terraform (offline only): `fmt -check -recursive`, `init -backend=false`, `validate` in `infra/envs/prod`, `tflint --recursive`, `checkov -d infra`.

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
| 2026-11-07 | Mail & calendar backend | `aic/mail/`: Gmail + Google Calendar, Microsoft Graph, IMAP/SMTP and CalDAV providers (stdlib only), fan-out across accounts with per-account errors, 12 tools that gate themselves (send, trash, respond, delete and invites ask, with a full preview; standing rules for named recipients and organizers), `/mail/*` routes (sign-in bound to the owner's session, app password straight into Secrets Manager), the apps read API and proposal file/execute. 32 new tests with fakes; nothing tried against a real account. |
| 2026-11-07 | Connectors and skills backend | Built on branch `connectors-backend`: `add_connector` (owner-message turns only, registry or URL with SSRF and key-in-link checks, approval bound to id, URL and roles), the approval hook, the connectors Lambda (probe, OAuth discovery with DCR, API key, sync to a Lambda target, Cedar rewrite incl. the apps' read-only permit, remove), the bridge Lambda, the SigV4 Gateway client on both engines, approval levels in the gate, the policy deny rule, `WorkerSpec.connectors`, `app_call`, skills (API, plugin folder, `use_skill`) and prompts. Offline tests only; not deployed. Contract fixes: real role names in Cedar, `app_call` aligned with the apps v2 bridge, qualified skill names. |
| 2026-11-07 | Package MCP servers built | Branch `connectors-packages`: `aic.shared.connector_packages` (spec and registry resolution to an exact version with publisher and source, oci refused, secret variables as secure-field prompts stored as `{"env": …}`, `InvokeAgentRuntime` with session `mcp-<id>-<version hash>`, `StopRuntimeSession` on remove) with one dispatch per place in `add_connector`, the connectors, bridge and api Lambdas; the generic MCP host `services/mcp-host/` (arm64, Node 22 + npm, Python 3.13 + uv, non-root, port 8080; exact-version install, scrubbed environment, JSON-RPC relay, one restart). Offline tests only; not deployed. Contract §1.10 filled in (record fields, env key route, host answers). |
| 2026-11-07 | OpenAPI connectors backend | Built on branch `connectors-openapi` (§1.11): `add_connector` tells a spec link from an MCP server and writes the card from the spec, the approval is bound to the spec's hash, provision stores the normalized spec in S3 and sets up the key field or an Identity OAuth provider, sync builds the Lambda target from the stored spec, and the bridge makes the pinned HTTPS calls. Offline tests only; not deployed. Adds `httpx` and `pyyaml` to the Lambda package. Contract clarified first. |
| 2026-11-07 | Connectors, mail and skills infra | Built on branch `connectors-infra`, not deployed: `infra/modules/connectors` (Gateway `aic-prod-connectors`, AWS_IAM + Cedar ENFORCE with no Terraform policies, workload identity `aic-prod-connectors`, Lambdas `aic-prod-connector-bridge` / `aic-prod-connectors`, MCP host runtime `aic_prod_mcp_host` logging only, bucket `aic-prod-connectors`), `infra/modules/mail` (workload identity `aic-prod-mail`, Google/Microsoft providers off until `mail_providers` enables them, secrets `aic/prod/oauth-*`), `infra/modules/skills` (bucket `aic-prod-skills`), the new HTTP routes, and `check-iam`/`check-tags` rules. Contract fixes from the AWS docs (Cedar principal without session name, Policy and Identity IAM) in `docs/CONNECTORS_SKILLS.md`. The unused Gateway stub and `enable_gateway` are gone. |
| 2026-11-07 | Web APIs as connectors | The owner's choice: a service with no MCP server connects through its OpenAPI 3 document. Each operation becomes a tool, with sign-in or a key from the spec's security schemes, run by the same bridge (decision 78, §1.11). Not built yet. |
| 2026-11-07 | Any MCP server, on demand | The owner's requirement: connectors aren't a list; any MCP server can be added on demand by asking AIC. Remote servers go through the bridge, and npm/PyPI (stdio) servers are installed at the approved exact version in the isolated `aic-prod-mcp-host` runtime (decision 77, `CONNECTORS_SKILLS.md` §1.10). Not built yet. |
| 2026-11-07 | Mail & calendar folded into connectors | The owner shelved the separate mail and calendar feature. Mail and calendar accounts are connectors added on demand (several per provider, each with its own label and sign-in), and a combined calendar is an app AIC builds when asked. `docs/MAIL_CALENDAR.md` (from branch `mail-calendar`) is now part of the connectors contract; the Calendar screen is dropped (decision 76). Not built yet. |
| 2026-11-07 | Connectors and skills designed | The owner's requirement: any MCP server can be added by asking AIC, which asks the owner to sign in when the server needs it (OAuth through AgentCore Identity, or a secure key field). The first ones are GitHub, web search via Tavily (AgentCore's Web Search Tool isn't in Stockholm) and Slack. Skills are uploaded in the HUD and stored in S3. Contract in `docs/CONNECTORS_SKILLS.md`, decisions 67–69. Not built yet. |
| 2026-11-07 | Voice sign-in fix, plain eye | After tapping the mic the live site showed "The speech service turned AI City down (NotAuthorizedException)": the voice identity pool refused the HUD's ID token while the HTTP API accepted the same token (same app client), which points at the pool's server-side token check (on since the start; sign-in moved to SRP with refresh-token rotation and revocation). The check is now off (ID tokens live 15 minutes; the credentials allow only Transcribe streaming and Polly), the HUD retries once with a freshly refreshed token, and the banner shows AWS's own message. The owner's choice: the eye no longer changes colour or moves with the state; the voice line under it shows the state. |
| 2026-11-07 | AIC screen redesign, real mic errors | The owner's request: eye and voice strip on the left, chat on the right, a bright theme in the City's palette (WCAG AA, axe-checked). The voice module measures loudness with Web Audio analysers on the mic and on Polly's audio (played straight, without the meter, when Safari keeps Web Audio suspended, so replies are never muted). The mic is now requested first, inside the tap, before loading the speech SDK. The old catch-all "The microphone could not start…" hid the cause; each failure now has its own message and a console log. The live site's headers were checked: `Permissions-Policy: microphone=(self)` and the CSP (Transcribe WebSocket on :8443, Cognito Identity, Polly) allow voice, and the Transcribe endpoint answers in eu-north-1. |
| 2026-11-07 | Every SDK tool call is gated | Fix: the Claude Agent SDK path listed the city tools in `allowed_tools`, which auto-approves them and skips `can_use_tool` (the SDK warned `CanUseToolShadowedWarning`), so the policy gate didn't see Orchestrator, manager and worker city-tool calls. Nothing is pre-approved now; every call goes through `can_use_tool` and the gate. |
| 2026-11-07 | AIC talks to Bedrock directly | For answers within seconds, AIC (city tools only) no longer starts a Claude Code process per turn: `aic.runtime.direct` calls Bedrock ConverseStream itself, streams text as it is written, and runs tool calls through the same policy gate and audit (same `mcp__city__*` names). Logs `aic.timing` (first word, whole reply). Other roles keep the Claude Agent SDK. The final reply is also sent through the event bus as a safety net; the HUD ignores the repeat. (Replaces the short-lived warm-process approach.) |
| 2026-11-07 | AIC's reply streams live | AIC's reply appears word by word: the engine passes token deltas (`include_partial_messages`), the runtime batches them about every 80 ms and posts them straight to the open HUD connections (API Gateway WebSocket), skipping the EventBridge → Lambda hop per piece. Falls back to the event bus if that fails. |
| 2026-11-07 | AIC on Haiku 5.5 | The owner's choice, for fast replies: AIC routes, answers status straight from the ledger (`get_status`, no manager round trip) and hands real work to the Orchestrator (Fable), which opens a ticket per department. Its prompt now says so explicitly. |
| 2026-11-07 | AIC on Opus 5.5 for now | The lab account can't subscribe to Claude Sonnet 5.5 in AWS Marketplace (denied even for the admin role), so AIC runs on Opus 5.5 (the owner's choice) until it can. Fable 5.1 needs the account's Bedrock data retention mode set to `provider_data_share` (shares prompts and outputs with Anthropic): the owner chose to turn it on. |
| 2026-11-07 | Named AIC, not Ace | The owner's choice: the front agent is called AIC everywhere (screens, its prompt, docs) and is said as the letters A-I-C; Polly reads it as “A.I.C.”. The wake word is AIC / “A I C”; “Ace” no longer wakes it. Internal ids (`ace` role, queues, runtimes) are unchanged so nothing in AWS is replaced. Also: the HUD's CSP now allows Cognito's sign-in API (`cognito-idp`), which our own sign-in screens need. |
| 2026-11-06 | Own sign-in, clear first-login email, AIC's eye | The HUD signs in on its own screens (Amplify Auth, SRP; no Cognito hosted pages): first login walks through temporary password → own password → authenticator app. Cognito's invitation email is rewritten (link, user name, temporary password valid 7 days, steps) and so is the reset-code email; a public `POST /auth/first-login-email` re-sends the invitation (owner only, once per 10 min, same answer for any email). AIC is shown with one eye, the owner's own drawing. |
| 2026-11-06 | Deploy stages | `deploy.yml` runs **web** and **backend** (ruff, mypy, pytest, Lambda package) in parallel, then **plan → apply → frontend**; the plan job prints the OIDC claims GitHub presents (never the token), so a trust-policy mismatch is visible in the log. |
| 2026-11-06 | Backend in Python | The owner's choice: the whole application (shared core, 10 Lambdas, the AgentCore runtime) is Python 3.13 in `backend/` (`uv`, ruff, mypy, pytest; Claude Agent SDK for Python, whose wheel bundles the CLI). The HUD stays React, the infrastructure Terraform. Same behaviour, same JSON on the wire and in DynamoDB; 219 pytest tests replace the vitest backend tests. Lambdas ship as one zip (`backend/scripts/build_lambdas.py`, `python3.13`, arm64). |
| 2026-11-06 | Push to main deploys | Owner's choice: `deploy.yml` runs on every push to `main` (docs-only pushes skipped) and applies without an approval step. The image tag is a hash of the runtime's sources, so web-only pushes don't rebuild it. Commits no longer need `[skip ci]`; adding it skips a deploy. |
| 2026-11-06 | Owner email and state bucket | The owner email is the GitHub secret `AIC_OWNER_EMAIL` (masked in public logs); Cognito creates only that user and allows no sign-up. State goes to `lamo-labs-state-bucket` under `ai-city-aws/prod/terraform.tfstate` (used as is if it exists, in its own region). The full plan is shown in the masked log, not uploaded as a file. |
| 2026-11-06 | Deploy needs only the role ARN | `deploy.yml` needs two variables (role ARN, owner email), creates the Terraform state bucket on its first run, and one approved plan builds and pushes the image (`terraform_data.image`) before the runtimes. `infra/bootstrap` removed; the owner provides the OIDC role (`docs/deploy-role-trust-policy.json`). Public repo `Lamo2real/ai-city-aws`. |
| 2026-11-06 | AWS Budgets at $10,000 | Owner's choice. The monthly alert amount is $10,000 (was $150): emails at $5k / $8k / $10k and on a forecast above it. Still alerts only. |
| 2026-11-06 | No spend limit | Owner's choice. Spend caps are off by default (`null` = no limit) and optional in Settings (empty field = no limit). AWS Budgets only emails; the deny-Bedrock budget action and the budget Lambda that paused the city are removed. 241 tests, Playwright 15/15, Checkov 275/0. |
| 2026-11-06 | Initial build, phases 1–9 | Not deployed. 240 tests, Playwright 14/14, Terraform checks clean. See `docs/MORNING_REPORT.md`. |
