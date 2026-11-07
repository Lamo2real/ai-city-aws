# AI City (AIC) on AWS

AI City is the owner's personal organization of AI agents, running only in the owner's own AWS account. The owner signs in to a web app (Cognito with MFA) and talks or types to **AIC**. AIC answers simple things itself and hands real work to the **Orchestrator**, which sends one goal per department to that department's **Manager**; managers hire **Worker** consultants on demand, review every deliverable (PASS or FAIL), and report back. The Orchestrator signs off before anything leaves the city, and AIC tells the owner. A live **City view** draws the real organization as a pixel-art town, ported from the owner's Mac HUD.

The backend is **Python**, the HUD is **React**, the infrastructure is **Terraform**. Agents run on **Amazon Bedrock AgentCore** with Anthropic Claude models billed only through **Amazon Bedrock** (AIC: Haiku 5.5; Orchestrator and Managers: Fable 5.1, falling back once to Opus 5.5; Workers: Opus 5.5; utility calls: Haiku 5.5). Everything else is serverless: Lambda, API Gateway (HTTP + WebSocket), DynamoDB, SQS, EventBridge, Step Functions, S3, CloudFront + WAF, Cognito, Transcribe and Polly for voice. Infrastructure is Terraform, one environment: `prod`.

**Status:** built and tested locally with fakes; **not deployed**. Read `docs/MORNING_REPORT.md` first, then `docs/DEPLOY_CHECKLIST.md`.

## Layout
| Path | What |
|---|---|
| `agents/` | Prompts: `ace.md`, `orchestrator.md`, `manager.md`, `worker.md`, `departments/`, `utility/` |
| `config/` | `models.json` (the only place model IDs live), `policy.json`, `caps.json`, `departments.json` (empty) |
| `backend/` | **Python 3.13** application (`uv` project, package `aic`): `aic/shared` (model map, startup guard, policy gate, ledger, cost math, caps, turn gate, events, dispatcher, Agent Factory), `aic/lambdas` (api, dispatcher, factory, ledger writer, WebSocket, notifier, approvals, scheduler), `aic/runtime` (the AgentCore container: Claude Agent SDK for Python, role tools), `tests/` (pytest) |
| `services/agent-runtime/` | The runtime image's Dockerfile (Python, ARM64) |
| `web/` | The HUD (React): AIC, City view, Needs you, Tickets, Costs, Settings |
| `infra/` | Terraform: `modules/`, `envs/prod/` (no bootstrap: `deploy.yml` creates the state bucket) |
| `scripts/` | `city-on.sh`, `city-off.sh`, `build-images.sh` (no push), `check-tags.mjs`, `check-iam.mjs` |
| `tests/` | Infra and workflow checks (vitest), `fixtures/` shared by the Python and web tests |
| `docs/` | Architecture, ADRs, security, scaling, runbook, costs, decisions, facts checked, progress |

## Local checks (no AWS, no models)
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

Unit tests use fake model runners and never call Bedrock. **Every push to `main` deploys prod** (`.github/workflows/deploy.yml`); `ci.yml` runs only by hand.
