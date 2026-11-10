# Rename AIC → VAIC everywhere (plan)

The owner's request (2026-11-10): "also rewrite all code from AIC to VAIC in the codebase", with the option
"Everything, wipe data". This plan was written before anything changed. Nothing in it runs until the owner gives the
go-ahead in the rename session. Deploys happen only by pushing to `main` (`deploy.yml`); no agent runs
`terraform apply` or AWS CLI changes.

The reasoning below is `terraform plan`-style reading of `infra/` against the AWS provider's source (v6.72.0, which
attributes force replacement). No plan was run against AWS. Each step's real plan, in the `terraform plan` step's log,
is checked before its apply finishes.

## 1. What gets renamed

About 3,800 lines in 440 files.

| Old | New | Where |
|---|---|---|
| Python package `aic` (`backend/src/aic`, `aic.lambdas.*` handlers, `pyproject` name) | `vaic` | backend, infra handlers, Dockerfile `CMD`, tests |
| `AIC_*` environment variables (≈60: `AIC_ROLE`, `AIC_LEDGER_TABLE`, `AIC_QUEUE_ACE`, `AIC_GATEWAY_URL`, …) | `VAIC_*` | infra, backend, services, scripts, tests |
| Role `ace` (`roles = ["ace", …]`, `warm_ace`, `report_to_ace`, `ace_tools`, `is_ace`, `AceScreen`, `AceTurn`, `agents/ace.md`, …) | `vaic` (`warm_vaic`, `VaicScreen`, `agents/vaic.md`, …) | everywhere |
| Resource prefix `aic-prod` / `aic_prod` | `vaic-prod` / `vaic_prod` | `infra/envs/prod/main.tf` `local.name`, literals in modules, backend defaults, tests |
| Secret names `aic/prod/*` (`github`, `openai`, `apns`, `files-signing-key`, `google`, `spotify`, `connectors/*`, `oauth-*`) | `vaic/prod/*` | infra, backend |
| Runtime-made names `aic-conn-*`, `aic-files-*`, `aic-skills`, inference profiles `aic-<role>` | `vaic-…` | infra IAM patterns, backend |
| Tag `App = "aic"` | `App = "vaic"` | `base_tags` (Project `ai-city` stays) |
| `config/mail.json` provider names `aic-prod-google/microsoft` | `vaic-prod-…` | config |
| Prompts: `ask_aic` tool and any remaining AIC wording | `ask_vaic` | `agents/**` |
| HUD: `@aic/web`, `window.__aicAuth/__aicVoice/__aicSonic`, CSS classes `.aic-*`, `aicSpeaks`, `AicStatus`, `localStorage` keys `aic.*`, test hosts `api.aic.…` | `vaic` forms | `web/` |
| iPhone app: `AIC_SITE_HOST`, `AIC_BUNDLE_PREFIX`, `AIC_TEAM_ID`, `AIC_ENTITLEMENTS`, `AICSiteHost`, `UserDefaults` keys `aic.*`, URL scheme `aic-city://`, `aicCity` bridge | `VAIC_*`, `VAICSiteHost`, `vaic.*`, `vaic-city://`, `vaicCity` | `ios/` |
| Docker user `aic` | `vaic` | `services/agent-runtime/Dockerfile` |
| GitHub repository settings `AIC_DEPLOY_ROLE_ARN`, `AIC_QUEUES_ENABLED` (variables), `AIC_OWNER_EMAIL` (secret), optional `AIC_*` | `VAIC_*`, read with an `AIC_*` fallback until the owner renames them | `.github/workflows/*` |
| Docs, README, CLAUDE.md (the "identifiers keep their names" rule is replaced) | VAIC | `docs/**`, top-level `.md` |

**Kept, because they spell the product name "AI City", not AIC:** `ai-city`, `AI City`, the Xcode project and
target `AICity`, and the iPhone bundle id `<prefix>.aicity`. A new bundle id would create a new app in App Store
Connect, with a new TestFlight track and new push setup. Kept as well: `docs/screenshots/ace-*.png` file names (other
sessions are changing those files), past entries in `docs/DECISIONS.md` (history), and the Terraform state key
`ai-city-aws/prod/terraform.tfstate` (it has no AIC in it).

The rename must not touch words that only contain the letters: `VAIC` (no `VVAIC`), `mosaic` and similar. The
replacement matches `aic`/`AIC`/`Aic` as a word or camelCase part only, and `ace` only as the role identifier.

## 2. What happens in AWS

### Destroyed and recreated empty (the data is gone)

| Module | Resources | Data lost |
|---|---|---|
| ledger | DynamoDB `ledger`, `connections` | all history: chats, jobs, departments, projects, decisions, spend, settings, spend caps |
| storage | S3 `workspaces`; secrets `google`, `spotify` (empty containers) | workers' workspaces |
| bus | EventBridge bus, 4 SQS queues + 4 DLQs, SNS `notify` | messages in flight |
| agents | ECR `agent-runtime`, 4 AgentCore runtimes, 4 AgentCore memories, 5 IAM roles, inference profiles `aic-*` | agents' memories and image history |
| api | every Lambda (api, ws, dispatcher, scheduler, factory, notifier, apps, chief-of-staff, executives, …), their log groups, IAM roles, aliases, provisioned concurrency, queue mappings, EventBridge rules, Step Functions `approval`, `apps-dlq` | logs, pending approvals |
| auth | Cognito **domain** (the sign-in page address), identity pool `voice` + its role, S3 `speech`, Transcribe vocabulary | nothing of value |
| frontend | S3 `hud` (re-uploaded by the same deploy), WAF web ACL + its log group | WAF logs |
| apps | S3 `apps` | **every published app** |
| knowledge | S3 bucket, OpenSearch Serverless collection + its policies + index, Bedrock knowledge base + data source, Neptune Analytics graph, DynamoDB table, Lambda, Step Functions, MediaConvert role | **the whole knowledge base** |
| files | S3 bucket, DynamoDB table, Lambdas, signing key + its secret, CloudFront public key | **every file in Files** |
| connectors | AgentCore Gateway, policy engine, workload identity, S3 specs bucket, ECR `mcp-host` + runtime, Lambdas, roles | **every connector** |
| mail | workload identity, OAuth credential providers | **every mail/calendar account** |
| skills | S3 bucket | **every uploaded skill** |
| github, voice, notifications | secrets `github`, `openai`, `apns`; SNS platform applications (if APNs is on) | **the GitHub token, OpenAI key, APNs key** |
| security | IAM permission boundary; KMS **alias** | nothing |
| budgets, observability | budget, dashboard, alarms | nothing |

### Changed in place (kept)

- **The HUD's CloudFront distribution**: no argument that changes forces a new one, so **the HUD address stays
  `https://d2lcjbjaz1khxz.cloudfront.net`**. Only its origin moves to the new bucket. The iPhone app's built-in host
  keeps the same value; only the setting's name changes (`AIC_SITE_HOST` → `VAIC_SITE_HOST`). The apps and Files
  previews distributions are also kept, with their addresses.
- **API Gateway HTTP and WebSocket APIs**: `name` is updatable, so the API and WebSocket URLs stay the same.
- **The Cognito user pool and its HUD client**: `name` is updatable, so **the owner's account, password and
  authenticator stay**. Only the hosted sign-in domain changes (`aic-prod-…` → `vaic-prod-…`); the HUD reads it from
  `config.json`, which Terraform rewrites. (If the owner wants a fresh pool instead, that is one more line; it isn't
  needed for the rename.)
- **The KMS key** (its description changes; only the alias is recreated).

### Left behind (made at runtime by the code, not by Terraform)

Connector and mail secrets `aic/prod/connectors/*` and `aic/prod/oauth-*`, AgentCore credential providers
`aic-conn-*`, and the old connectors policy engine. They are cleaned up if the owner removes each connector and mail account in the
HUD before the cut-over (step B). Anything missed keeps costing about $0.40 a month per secret until the owner
deletes it in the console.

### What blocks or breaks, and the fix

| Blocker | Why | Fix (in step A) |
|---|---|---|
| S3 buckets that aren't empty: workspaces, knowledge, files, apps, hud, speech, skills, connectors | `force_destroy = false` (or unset) and versioning on: `BucketNotEmpty` | set `force_destroy = true` on every bucket and apply **before** the rename (Terraform destroys with the value in state) |
| DynamoDB tables (ledger, connections, knowledge, files), the Neptune graph | `deletion_protection = true` (`var.deletion_protection`) | set the default to `false` and apply before the rename; set it back to `true` in step D |
| Cognito user pool deletion protection | the pool isn't destroyed | nothing |
| ECR repositories `agent-runtime`, `mcp-host` hold images | no `force_delete`: `RepositoryNotEmptyException` | `force_delete = true` in step A |
| WAF web ACL replaced while CloudFront uses it | Terraform deletes the old ACL first: `WAFAssociatedItemException` | `lifecycle { create_before_destroy = true }` on the ACL (step A, so it is in state) |
| CloudFront public key replaced while the key group uses it | `PublicKeyInUse` | `create_before_destroy` on the public key (step A) |
| New, empty ECR repositories | the images are pushed only when their tag changes | the rename changes both tags (sources change); also add the repository URL to both `terraform_data` triggers in step C so a new repository always gets its image |
| AgentCore Gateway with targets | targets were added at runtime | none needed: the AWS provider deletes a gateway's targets before the gateway |
| Connectors' policy engine | holds the Cedar policies the connectors Lambda wrote; AWS may refuse to delete it | step C forgets it (`removed`, no destroy) and makes a new one under a new address; the old one (`aic_prod_connectors`) is left behind for the owner to delete in the console |
| Secrets Manager | old secrets go into a 7-day recovery window; the new names don't clash | nothing; it only matters for a rollback (section 5) |
| Terraform state key and backend | `ai-city-aws/prod/terraform.tfstate` in `lamo-labs-state-bucket` has no AIC in it | unchanged |
| **The GitHub OIDC deploy role** | made by the owner outside Terraform, AdministratorAccess, trust bound to the repository's immutable ids, not to any `aic` name | **no lockout**: nothing in the rename touches it. Only the GitHub variable that holds its ARN is renamed, read as `vars.VAIC_DEPLOY_ROLE_ARN \|\| vars.AIC_DEPLOY_ROLE_ARN` so the pipeline works before and after the owner renames it |
| Mail sign-in redirect URIs | the OAuth credential providers are new, so the callback URLs change | only if Google or Microsoft mail is turned on: register the new URLs (printed in the deploy summary) |
| iPhone app | stored keys `aic.*` are renamed, so the phone forgets its settings and sign-in once; push endpoints are new | install the new build, sign in once, allow notifications again |
| The knowledge index (`opensearch_index`) | the opensearch provider's address is the collection's endpoint, which is unknown while the collection is replaced, so the old index can't be read or deleted, and the new collection would get no index | step C gives the index a new address (`opensearch_index.knowledge`) with a forget-only `removed` block for the old one, and plans that one deploy with `-refresh=false`; step D takes `-refresh=false` out again |
| Apply time | a full rebuild (OpenSearch collection, Neptune graph, knowledge base, runtimes, two images) is the longest deploy yet; `apply` has a 90-minute limit | if it times out, Terraform has saved what it made; one more push to `main` finishes the rest |

## 3. The order

**A. Prepare (no rename, no data lost).** One commit: `force_destroy = true` on every bucket, `force_delete = true` on
both ECR repositories, `deletion_protection` default `false`, `create_before_destroy` on the WAF ACL and the Files
public key, and `deploy.yml` reading `VAIC_*` settings with an `AIC_*` fallback. Push, watch
the deploy. Its plan must show only in-place updates (no destroys). Prod stays up.

**B. The owner, before the cut-over (about 5 minutes, optional but cleaner):** in the HUD remove each connector and
each mail/calendar account, so their secrets and credential providers are deleted rather than left behind. Download
any file, app or knowledge item worth keeping.

**C. The rename.** Waits for VAIC's main session to land its Orchestrator fix. One commit, rebased on the latest
`main`: everything in section 1, CLAUDE.md and `docs/PRODUCT.md` updated, all checks green (ruff, mypy, pytest,
web tests, `npm run build`, `node scripts/check-iam.mjs`, `scripts/check-tags.mjs`, `terraform fmt`/`validate`, the
iOS tests). Push, watch the deploy: plan → apply (replaces everything in section 2) → HUD upload.

**D. Settle.** After the owner has signed in and the city answers: a commit setting `deletion_protection` back to
`true`, `force_destroy` back to `false` on buckets holding the owner's data, and the plan back to refreshing. Push, watch.

**E. Later, when the owner has renamed the GitHub settings:** remove the `AIC_*` fallbacks from the workflows.

## 4. What the owner does by hand

1. Before C (optional): step B above.
2. After C:
   - Open the same HUD address, `https://d2lcjbjaz1khxz.cloudfront.net`. Reload once (the old page may be cached).
   - Sign in with the same email, password and authenticator (the user pool is kept). If the pool is replaced
     instead, sign up again from the invite email.
   - Settings → GitHub: paste the GitHub token again.
   - Settings → Voice: paste the OpenAI key again (GPT-Live).
   - Settings → Notifications: paste the Apple APNs key again, if it was set.
   - Settings → Connectors: add every connector again (keys and sign-ins).
   - Settings → Mail & calendar: connect each account again. If Google or Microsoft mail is on, register the new
     redirect URIs from the deploy summary in Google Cloud / Microsoft Entra first.
   - Upload skills, files and knowledge again; the city has no departments, projects or history.
   - iPhone: install the new TestFlight build (the host is the same, but the app's settings keys are new), sign in,
     allow notifications.
3. In GitHub → Settings → Secrets and variables → Actions: create `VAIC_DEPLOY_ROLE_ARN` and `VAIC_QUEUES_ENABLED`
   (variables, same values) and `VAIC_OWNER_EMAIL` (secret, same value), then delete the `AIC_*` ones. Any time; the
   workflows read either until step E.

## 5. Downtime and rollback

**Downtime:** A and D have none. During C, prod is down from the moment the apply starts destroying (a few minutes
into the deploy) until the HUD upload finishes: expected 45 to 90 minutes (normal deploys take 15 to 25 minutes; the
OpenSearch collection, Neptune graph and both image builds add the rest). Then the city is up but empty until the
owner pastes the keys back (about 15 minutes by hand, plus reconnecting accounts).

**Rollback:**
- Step A: revert the commit and push. Nothing was lost.
- Step C: the data cannot come back: DynamoDB point-in-time recovery and S3 versions go with the tables and buckets.
  Rollback therefore means **fixing forward**: if the apply fails part-way, Terraform has saved what it made; fix the
  cause and push again. Reverting the rename is a second full rebuild under the old names, and it would fail on the
  `aic/prod/*` secret names for 7 days (they are scheduled for deletion), unless the owner restores those secrets
  in the Secrets Manager console first. Restoring them also brings back the old GitHub token, OpenAI key and APNs key.
- The safety net is the owner's own download in step B. Nothing else is kept.

## 6. What happened (2026-11-10)

- **A** (`cd6eaad`): deployed with only in-place changes (29), no data lost.
- **C** (`3a1ef7a`): the plan was 376 to add, 20 to change, 374 to destroy. The apply stopped part-way on two errors:
  the Files policy on the MediaConvert role ran before the renamed role existed, and the knowledge data source was
  updated in place under the new knowledge base instead of being replaced. Prod was down from about 16:22 to 17:08 UTC.
- **Fix** (`f81231b`): the policy takes the role's name from its ARN; the data source is replaced with its knowledge
  base; the plan refreshes again. Deployed: 130 added, 6 changed, 10 destroyed, the HUD uploaded.
- As planned, the HUD address (`https://d2lcjbjaz1khxz.cloudfront.net`), the API and WebSocket URLs, the Cognito user
  pool (`eu-north-1_HoPnV88xr`) and its HUD client were kept; the sign-in domain is now `vaic-prod-c7a02784`.
- **D**: deletion protection back on, buckets and image repositories no longer emptied on destroy, the forget-only
  `removed` blocks taken out. **E** (the `AIC_*` fallbacks in `deploy.yml`) waits for the owner's GitHub settings.
- Left behind in AWS for the owner to delete when convenient: the old connectors policy engine `aic_prod_connectors`,
  and any `aic/prod/connectors/*` and `aic/prod/oauth-*` secrets and `aic-conn-*` credential providers.
