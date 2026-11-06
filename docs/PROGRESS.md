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
