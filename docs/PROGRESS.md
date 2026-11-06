# Progress log

## Phase 1: Facts and decisions — done
- Set up `ai-city-aws` (git, branch `main`), copied `CLAUDE.md` unchanged and the City view screenshot to `docs/reference/city-view-mac.png` (converted from the attached WebP to PNG with `sips`).
- Cloned upstream read-only to `../ai-city-upstream` (depth 1). Read its CLAUDE.md, policy.json/policy.ts and tests, scheduler.ts, improve.ts, sdk.ts, agent prompts and the HUD City view (city.js, city-state.js).
- Facts check from official docs: `docs/FACTS_CHECKED.md`. Stockholm has every AgentCore piece we use (not the Gateway Web Search connector). Model IDs and global profiles confirmed for all four models; Fable has no `eu.` profile.
- Decisions: `docs/DECISIONS.md` (10 owner decisions + build decisions).
- Tools on this machine: node 26.13, npm 11.20, terraform 1.15.8, git, python 3.14. Missing: docker, tflint, checkov, trivy, pnpm.
- `AIC_GITHUB_REPO` is not set, so commits stay local.

## Phase 2: Scaffold — done
- npm workspaces: `packages/shared`, `services/agent-runtime`, `services/lambdas`, `web`. Node pinned in `engines` (>=24 <27) and `.nvmrc` (24).
- TypeScript 6.0 strict (`noUncheckedIndexedAccess`), ESLint 10 flat config with typescript-eslint, Prettier, Vitest 5 with a node project and a jsdom project for `web/`.
- TypeScript 7 is the latest on npm but typescript-eslint supports only `<6.1`, so TS is pinned `~6.0.3` (DECISIONS).
- Installed local check tools: tflint 0.65.0 (official Homebrew tap), checkov 3.4.3 (pip, in a scratch venv).
- Gate: `npm install`, `npm run lint` pass, `npm run typecheck` pass, `npm test` 2 files / 2 tests pass.

## Phase 3: Shared core — done
- `packages/shared`: `models.ts` (role → model → profile, Fable→Opus fallback, `eu.` degradation, application profile ARNs), `guard.ts` (startup guard), `policy.ts` (ported `decide()` + exact-action approvals + worker setting), `table.ts` (one storage interface, `MemoryTable` and `DynamoTable`), `ledger.ts` (single-table ledger: tickets with history, departments, agents, specialists, questions, approvals, turns, spend counters, worker slots, session rate limit, settings, events, notes, idempotency), `cost.ts` (5-minute vs 1-hour cache writes, geo surcharge, Haiku long-context tier), `caps.ts`, `turn.ts` (the one gate: pause, caps, throttle back-off, fallback once, cost row), `events.ts` (zod schemas + `MemoryBus`), `bus.ts` (EventBridge).
- `config/models.json` (the only place model IDs live), `config/policy.json` (upstream rules + cloud-mutation denies), `config/caps.json`, `config/departments.json` (empty).
- Gate: `npx vitest run` — 5 files, 130 tests pass. Proven: guard refuses each forbidden variable and Bedrock-off; every role maps to the right model/profile incl. fallback; caps block all 7 turn kinds; throttling backs off with jitter and never pauses; a refusal triggers exactly one fallback. Plus a repo-wide test that no file but `config/models.json` contains a model ID.
- lint and typecheck pass.

## Phase 4: Agent runtime and hierarchy — done
- `packages/shared/src/hierarchy/`: `queue.ts` (work messages, `MemoryQueue`), `factory.ts` (Agent Factory + Registry: spec validation, unlimited hires, saved specialists, release), `dispatch.ts` (pause, caps, per-department/global ceilings, new-session rate, leases, crash sweep). `aws.ts`: SQS queue, Lambda factory client, production wiring.
- `services/agent-runtime`: `tools.ts` (all role tools from 2.4, gated and audited), `engine.ts` (Claude Agent SDK on Bedrock; built-ins gated by `canUseTool`; per-model usage split into 5 m / 1 h cache writes), `host.ts` (one turn: ledger → prompt → gated turn → tidy up), `server.ts` (`/ping` Healthy/HealthyBusy, `/invocations` sync or async, startup guard first), `Dockerfile` (arm64, 8080, non-root).
- `agents/`: ace, orchestrator, manager, worker, five department templates, three utility prompts.
- `services/lambdas`: `dispatcher.ts`, `factory.ts`, `ledger-writer.ts`, `scheduler.ts` (sweep, retire_idle, reminders, improve), `improve.ts` (disabled loop + path fence).
- Gate (`npx vitest run`): 9 files, 164 tests pass, including `tests/hierarchy.e2e.test.ts`:
  - whole chain owner → Ace → Orchestrator → new department → 3 hires → reports → one FAIL → fix → PASS → sign-off → Ace's report; checks tickets + history, events, cost rows for every agent, workers released, slots returned, session ID shapes;
  - crash mid-turn (manager) resumes from the ledger without duplicate hires; stale-lease sweep re-sends a dead worker turn;
  - `@agent` instruction reaches the right worker with its manager copied;
  - 500 hires: peak 150 global / ≤100 per department / ≤20 new sessions per second, rest deferred, all 500 started exactly once.
- `docker build`: **not run — Docker is not installed** on this machine. Instead the runtime was bundled with esbuild (2.5 MB) and started with `ANTHROPIC_API_KEY` set: the startup guard refused to start, as intended.
