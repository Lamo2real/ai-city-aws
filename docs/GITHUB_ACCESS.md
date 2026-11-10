# GitHub access for the agents (decision 110)

The owner's words: "I really don't care about safety and security; I just want full access to my GitHub account:
create any new repository, any new organization, whatever; VAIC needs terminal access to run git push, git commit,
git add in a shell; it all runs inside AgentCore; and I need internet access to browse other stuff as well."

So the city uses **one GitHub token, the owner's**, for everything: workers' `git push` and `gh`, VAIC's own
terminal, and the GitHub connector. It is pasted once on the **GitHub card in Settings → Connectors** (the one place for it, decision 194) and lives in Secrets Manager
(`vaic/prod/github`). Nothing in this file is a guardrail on the owner's GitHub; the only refusals left are the
city's own survival (its AWS account, deploys, credential files, the sandbox root; decision 100).

## 1. Make the token (once, about three minutes)

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
   (classic)**. A **classic** token, not a fine-grained one: a fine-grained token is bound to one account or one
   organization and cannot cover org-wide actions (creating repositories in any of your organizations, managing
   their members, hooks and keys). The owner asked for full access, so:
2. Note: "AI City". Expiration: **No expiration**.
3. Tick **every scope**: `repo`, `workflow`, `admin:org`, `admin:public_key`, `admin:repo_hook`, `admin:org_hook`,
   `gist`, `notifications`, `user`, `delete_repo`, `write:packages` (and `read:packages`, `delete:packages`),
   `write:discussion`, `project`, `codespace`, `audit_log`, `copilot` and `admin:enterprise` if GitHub shows them.
4. Generate, copy it once (it starts with `ghp_`), and paste it into **Settings → Connectors → GitHub → Add a GitHub token** in
   AI City. The section then says **Connected as <your login>**. A wrong or revoked token says so in plain words and
   is not stored.

The token goes straight to AWS Secrets Manager, is never shown again, never logged, and blanked out of anything an
agent returns. To change it: **Replace the GitHub token**. To take it away: **Remove the GitHub token…** (the
agents lose GitHub at their next turn; revoke the token on GitHub too if you want it dead).

**Organizations.** GitHub's API cannot create an organization for a personal account (only enterprise owners can
create organizations through the API). Create an organization by hand once (GitHub → your avatar → Your
organizations → New organization); everything inside it (repositories, teams, members, settings, hooks) then works
through the token with `admin:org`.

## 2. What the agents can do with it

- **Workers** (every sandbox): `git clone/push/pull`, `gh repo create`, `gh pr create`, `gh pr merge`, `gh api …`,
  anything `gh` and git offer, as the owner. Set up at the start of each runtime session by
  `backend/src/vaic/runtime/github_auth.py`:
  - `GH_TOKEN` and `GITHUB_TOKEN` in the environment (the GitHub CLI reads them; Claude Code's environment scrub
    for workers' shells leaves exactly these two alone, by design);
  - a git **credential helper for `https://github.com`** that answers `x-access-token` / the token from the
    environment at call time (`credential.https://github.com.helper` in `GIT_CONFIG_GLOBAL=/tmp/vaic-git/config`,
    a file that holds the helper command, never the token; nothing with the token in it is written to disk);
  - the commit identity `AI City <id+login@users.noreply.github.com>`, the token owner's own noreply address,
    so commits count as theirs; `init.defaultBranch=main`;
  - `gh auth status` is run and its result logged (`github.auth ok=true`).
  A token pasted after the runtime started takes effect within about five minutes (the next turn re-reads it).
- **VAIC** has `run_command(command, cwd?, timeout_s?)`: a shell inside its own AgentCore runtime microVM, in
  `/workspace` (created at start; it lives as long as the runtime, about 8 hours with the warm-keeper, decision 86).
  Quick git and shell jobs the owner asks for are VAIC's own now: clone a repository, add/commit/push, `gh repo
  create`, `gh pr create`, inspect files, run a script, fetch a page with `curl`. A real build or a multi-step
  deliverable still goes to the team (decision 87). The command passes the policy gate exactly like a worker's Bash
  (the same deny rules: the city's own AWS account, deploys, credential files, the sandbox root), output is capped at
  about 20 KB with a plain note when cut, the default timeout is 120 s (max 600), and the HUD shows the step as
  "Running: git push …". When the workspace is empty, VAIC clones again.
- **The internet** is reachable from every runtime (`network_mode = "PUBLIC"` in `infra/modules/agents/main.tf`):
  `curl`, `gh`, `pip`, WebFetch and the Browser all work; nothing else had to change.
- **The GitHub CLI** (`gh`) is installed in the runtime image (`services/agent-runtime/Dockerfile`) from GitHub's own
  release `.deb` for arm64, pinned by version and sha256; `curl` and `git` next to it.

## 3. The GitHub connector (MCP)

GitHub's hosted MCP server is `https://api.githubcopilot.com/mcp/` (registry entry
`io.github.github/github-mcp-server`). `https://github.com/github/github-mcp-server.git` is the source repository,
not a server: pasting it in **Add by link** or giving it to VAIC now answers "That is a code repository page, not a
server. GitHub's MCP server is https://api.githubcopilot.com/mcp/".

- Ask VAIC **"add GitHub as an MCP"**: it resolves to GitHub's own server (the registry entry when it is there, the
  known address otherwise) and puts the approval card up.
- With the city's token saved (section 1), the connector uses it as its `Authorization: Bearer` key and is **On**
  without any sign-in. Without it, the usual probe runs: OAuth through github.com (client id and secret, callback
  URL) as `docs/CONNECTORS_SETUP.md` §4 describes, and the sign-in card also offers **"I have a token instead"**,
  which stores a pasted token as the bearer key through the existing key path.
- Remove the broken "github (work)" card from the earlier attempt in Settings → Connectors before adding it again.

## 4. Where things are

| Piece | Where |
|---|---|
| Secret and IAM (api store/read, every runtime role read) | `infra/modules/github/main.tf`, wired in `infra/envs/prod/main.tf` (a `moved` block carries the old empty container over from the storage module) |
| Routes `GET /github`, `PUT /github/token`, `DELETE /github/token` | `backend/src/vaic/lambdas/api.py`, `backend/src/vaic/shared/github.py` |
| Settings → Connectors → GitHub (row and Browse card) | `web/src/components/GitHubSettings.tsx`, `ConnectorsHub.tsx` |
| git and gh sign-in at session start | `backend/src/vaic/runtime/github_auth.py`, called from `runtime/host.py` and at start in `runtime/server.py` |
| VAIC's `run_command` | `backend/src/vaic/runtime/tools.py` (`_run_command_tool`), prompt in `agents/vaic.md` |
| Connector hints and token path | `backend/src/vaic/shared/connectors.py`, `runtime/connector_tool.py`, `lambdas/connectors_api.py` |
| Tests | `backend/tests/test_github.py`, `web/test/github.test.tsx`, `web/e2e/github.spec.ts`, `tests/infra.test.ts` |

## 5. What only a real token can confirm

Everything above is tested with fakes, real git and real subprocesses, never against GitHub or AgentCore. After the
deploy and the paste: a worker's real `git push`, VAIC's `run_command` against a real repository (ask VAIC: "clone
Lamo2real/ai-city-aws and show me the last three commits"), `gh auth status` inside the runtime (CloudWatch
`/aws/bedrock-agentcore/runtimes/vaic_prod_vaic-*`, event `github.auth`), and the connector's real sign-in or token
path. Logs: `github.token_saved`, `github.auth`, `github.auth_user_failed`.
