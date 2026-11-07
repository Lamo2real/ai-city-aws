# Runbook

All commands are run by the owner from a terminal with an AWS IAM Identity Center session (`aws sso login --profile aic`), never by an agent. Replace `aic` with your profile name. `cd infra/envs/prod` first for the Terraform ones.

## Start (first time)
Follow `docs/DEPLOY_CHECKLIST.md` top to bottom.

## Pause and resume
- From the HUD: **Settings → Pause the city…** (or say "AIC, pause everything"). Undo is offered for 12 seconds.
- From a terminal (also stops queue triggers):
```bash
AWS_PROFILE=aic ./scripts/city-off.sh "Paused for the weekend"
```
```bash
AWS_PROFILE=aic ./scripts/city-on.sh
```
**Still costs money while paused:** S3 storage, CloudWatch logs and dashboard, KMS keys ($1/month each), Secrets Manager ($0.40/secret/month), WAF ($5 + $1/rule/month), DynamoDB storage and PITR, CloudFront requests, ECR storage. Agents cost nothing while idle.

## Update
- Code or infrastructure: push to `main`. `deploy.yml` plans and applies on its own (no approval); the plan is in the log of its `terraform plan` step. To re-run without a new commit: **Actions → deploy → Run workflow**. To push without deploying, put `[skip ci]` in the commit message.
- By hand (if GitHub is unavailable): build the Lambda package (`python3 backend/scripts/build_lambdas.py`), build and push the image with a new tag, then `terraform plan -var agent_image_tag=<tag> -out prod.tfplan`, read it, `terraform apply prod.tfplan`, then upload `web/dist`.

## See costs
- HUD: the pill at the top, and **Costs (estimates)**.
- The truth: AWS Billing → **Cost Explorer**, group by tag `AgentRole`, `Component` or `CostCenter` (after activating cost allocation tags; see the checklist). Bedrock model charges for Claude may appear under **AWS Marketplace**.
- CloudWatch dashboard `aic-prod`.

## Raise limits
- Spend caps (optional, none by default) and concurrency: **Settings**; an empty cap field means no limit. The AWS Budgets alert amount: change `monthly_budget_usd` in `prod.tfvars` and deploy; it only sends emails.
- AWS quotas: see `docs/SCALING.md`.

## Restore the ledger (point-in-time recovery)
1. DynamoDB → Tables → `aic-prod-ledger` → Backups → **Restore to point in time** → choose a time → new table name `aic-prod-ledger-restored` (same KMS key).
2. Pause the city (`city-off.sh`).
3. Point the stack at the restored table: in the console rename is not possible, so either copy items back (AWS Glue/Step Functions export–import) or set Terraform to import the restored table: `terraform state rm module.ledger.aws_dynamodb_table.ledger`, delete the old table (disable deletion protection first), restore again *as* `aic-prod-ledger`, then `terraform import module.ledger.aws_dynamodb_table.ledger aic-prod-ledger`.
4. Resume the city. Messages whose lease was mid-flight are re-sent by the `sweep` job (enable it in EventBridge Scheduler if it's off).

## Rotate secrets
Secrets Manager → `aic/prod/github` (or `google`, `spotify`, `oauth-google`, `oauth-microsoft`; connector keys are replaced through **Settings → Connectors → Add key**) → **Retrieve secret value → Edit** → paste the new token → Save. Revoke the old token at the provider. Runtimes read secrets by name at runtime, so no deploy is needed.

## Connectors and skills
- Nothing to set up: the owner asks AIC ("add the Higgsfield MCP"), approves the card, and signs in or pastes a key in the secure field. Connectors appear under **Settings → Connectors**; skills under **Skills**.
- Where things are: Gateway `aic-prod-connectors` (targets = one per connector), policy engine `aic_prod_connectors` (Cedar policies `aic_*`, written by the connectors Lambda; never edit them by hand), Identity providers `aic-conn-<id>`, secrets `aic/prod/connectors/<id>`, package servers in runtime `aic_prod_mcp_host`, OpenAPI specs in `aic-prod-connectors/specs/`, skills in `aic-prod-skills/skills/`.
- Logs: `/aws/lambda/aic-prod-connector-bridge`, `/aws/lambda/aic-prod-connectors`, `/aws/bedrock-agentcore/runtimes/aic_prod_mcp_host-*`.
- A connector stuck in `error`: **Settings → Connectors → Refresh tools**; if it stays, remove it and ask AIC again.

## Mail and calendar: the owner's one-time setup
1. **Google:** a Google Cloud project, then enable the Gmail API and Calendar API. Create an OAuth client of the "Web application" type (the redirect URI comes in step 4). On the consent screen, set the publishing status to **"In production"**. In "Testing", Google's refresh tokens expire after 7 days, so AIC would ask for sign-in every week. The app stays unverified, which shows a warning screen at sign-in and allows up to 100 users: fine for one owner. A Google Workspace account may need its admin to allow the app.
2. **Microsoft:** an Entra app registration (any organizational directory + personal Microsoft accounts) (the redirect URI comes in step 4), a client secret, and the delegated permissions `openid`, `email`, `offline_access`, `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`. A work tenant that blocks user consent needs its admin's consent once.
3. Paste each client secret into Secrets Manager `aic/prod/oauth-google` / `aic/prod/oauth-microsoft` as `{"client_secret": "…"}` (both containers exist from the first deploy). Then set the GitHub variable `AIC_MAIL_PROVIDERS` with the client ids, for example `{"google":{"enabled":true,"client_id":"…apps.googleusercontent.com"},"microsoft":{"enabled":true,"client_id":"…","tenant_id":"common"}}`, and run the deploy (push, or **Actions → deploy → Run workflow**).
4. The redirect URI is only known once the provider exists: after that deploy, copy each `callback_url` from the deploy log (step "mail sign-in redirect URIs", or `terraform output mail_callback_urls`) into the Google OAuth client's "Authorized redirect URIs" and the Entra app's Web redirect URIs. Sign-in works from then on.
5. IMAP accounts need nothing up front: AIC asks for the app password in the HUD's secure form.

## Turn on scheduled jobs
EventBridge → Scheduler → schedule group `aic-prod` → enable `aic-prod-sweep` (recommended), `aic-prod-nudge` (question reminders), `aic-prod-reminders`, `aic-prod-retire-idle`. Leave `aic-prod-improve` disabled.

## Something is stuck
- HUD **Records → Health** shows stuck turns and busy workers.
- SQS dead-letter queues (`aic-prod-*-dlq`) alarm by email when work failed three times. Inspect the message, fix the cause, then **Start DLQ redrive** in the SQS console.
- Logs: CloudWatch `/aws/lambda/aic-prod-dispatcher` and `/aws/bedrock-agentcore/runtimes/…`.

## Delete everything so billing ends
1. Pause the city.
2. In `prod.tfvars` set `deletion_protection = false` and deploy (removes Cognito and DynamoDB deletion protection).
3. Empty the S3 buckets `aic-prod-hud`, `aic-prod-workspaces`, `aic-prod-connectors`, `aic-prod-skills` (versioned: delete all versions) and the ECR repositories `aic-prod-agent-runtime` and `aic-prod-mcp-host`. Remove each connector in **Settings → Connectors** first: their Gateway targets, Identity providers and secrets were created by the city, not Terraform, so `terraform destroy` can't delete the gateway while targets remain.
4. `terraform destroy` in `infra/envs/prod`, read the plan, confirm.
5. Secrets have a 7-day recovery window. KMS keys are scheduled for deletion with a 30-day wait (Terraform does this on destroy); a key pending deletion is not billed.
6. Optionally delete the state file `ai-city-aws/prod/terraform.tfstate` (all versions) from `lamo-labs-state-bucket`.
7. Billing → check the next day's Cost Explorer for anything left; Budgets stop costing when deleted.
