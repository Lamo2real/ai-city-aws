# Progress log

## Phase 1: Facts and decisions — done
- Set up `ai-city-aws` (git, branch `main`), copied `CLAUDE.md` unchanged and the City view screenshot to `docs/reference/city-view-mac.png` (converted from the attached WebP to PNG with `sips`).
- Cloned upstream read-only to `../ai-city-upstream` (depth 1). Read its CLAUDE.md, policy.json/policy.ts and tests, scheduler.ts, improve.ts, sdk.ts, agent prompts and the HUD City view (city.js, city-state.js).
- Facts check from official docs: `docs/FACTS_CHECKED.md`. Stockholm has every AgentCore piece we use (not the Gateway Web Search connector). Model IDs and global profiles confirmed for all four models; Fable has no `eu.` profile.
- Decisions: `docs/DECISIONS.md` (10 owner decisions + build decisions).
- Tools on this machine: node 26.13, npm 11.20, terraform 1.15.8, git, python 3.14. Missing: docker, tflint, checkov, trivy, pnpm.
- `AIC_GITHUB_REPO` is not set, so commits stay local.
