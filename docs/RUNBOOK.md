# Runbook

All commands are run by the owner from a terminal with an AWS IAM Identity Center session (`aws sso login --profile aic`), never by an agent. Replace `aic` with your profile name. `cd infra/envs/prod` first for the Terraform ones.

## Start (first time)
Follow `docs/DEPLOY_CHECKLIST.md` top to bottom.

## Pause and resume
- From the HUD: **Settings → Pause the city…** (or say "Ace, pause everything"). Undo is offered for 12 seconds.
- From a terminal (also stops queue triggers):
```bash
AWS_PROFILE=aic ./scripts/city-off.sh "Paused for the weekend"
```
```bash
AWS_PROFILE=aic ./scripts/city-on.sh
```
**Still costs money while paused:** S3 storage, CloudWatch logs and dashboard, KMS keys ($1/month each), Secrets Manager ($0.40/secret/month), WAF ($5 + $1/rule/month), DynamoDB storage and PITR, CloudFront requests, ECR storage. Agents cost nothing while idle.

## Update
- Code or infrastructure: push to `main`, then run **Actions → deploy → Run workflow**, type `deploy prod`, read `plan.txt` from the plan job's artifact, and approve the `production` environment.
- By hand (if GitHub is unavailable): build Lambdas (`npm run build -w @aic/lambdas`), build and push the image with a new tag, then `terraform plan -var agent_image_tag=<tag> -out prod.tfplan`, read it, `terraform apply prod.tfplan`, then upload `web/dist`.

## See costs
- HUD: the pill at the top, and **Costs (estimates)**.
- The truth: AWS Billing → **Cost Explorer**, group by tag `AgentRole`, `Component` or `CostCenter` (after activating cost allocation tags; see the checklist). Bedrock model charges for Claude may appear under **AWS Marketplace**.
- CloudWatch dashboard `aic-prod`.

## Raise limits
- Spend caps and concurrency: **Settings** (raising asks for confirmation; very high caps need typing `raise`). The monthly AWS Budget: change `monthly_budget_usd` in `prod.tfvars` and deploy.
- If the budget action fired (deny-Bedrock attached): IAM → Roles → each `aic-prod-agent-*` → detach `aic-prod-deny-bedrock` — or raise the budget and wait for the next period. Then resume the city.
- AWS quotas: see `docs/SCALING.md`.

## Restore the ledger (point-in-time recovery)
1. DynamoDB → Tables → `aic-prod-ledger` → Backups → **Restore to point in time** → choose a time → new table name `aic-prod-ledger-restored` (same KMS key).
2. Pause the city (`city-off.sh`).
3. Point the stack at the restored table: in the console rename is not possible, so either copy items back (AWS Glue/Step Functions export–import) or set Terraform to import the restored table: `terraform state rm module.ledger.aws_dynamodb_table.ledger`, delete the old table (disable deletion protection first), restore again *as* `aic-prod-ledger`, then `terraform import module.ledger.aws_dynamodb_table.ledger aic-prod-ledger`.
4. Resume the city. Messages whose lease was mid-flight are re-sent by the `sweep` job (enable it in EventBridge Scheduler if it's off).

## Rotate secrets
Secrets Manager → `aic/prod/github` (or `google`, `spotify`) → **Retrieve secret value → Edit** → paste the new token → Save. Revoke the old token at the provider. Runtimes read secrets by name at runtime, so no deploy is needed.

## Turn on scheduled jobs
EventBridge → Scheduler → schedule group `aic-prod` → enable `aic-prod-sweep` (recommended), `aic-prod-nudge` (question reminders), `aic-prod-reminders`, `aic-prod-retire-idle`. Leave `aic-prod-improve` disabled.

## Something is stuck
- HUD **Records → Health** shows stuck turns and busy workers.
- SQS dead-letter queues (`aic-prod-*-dlq`) alarm by email when work failed three times. Inspect the message, fix the cause, then **Start DLQ redrive** in the SQS console.
- Logs: CloudWatch `/aws/lambda/aic-prod-dispatcher` and `/aws/bedrock-agentcore/runtimes/…`.

## Delete everything so billing ends
1. Pause the city.
2. In `prod.tfvars` set `deletion_protection = false` and deploy (removes Cognito and DynamoDB deletion protection).
3. Empty the S3 buckets `aic-prod-hud`, `aic-prod-workspaces` (versioned: delete all versions) and the ECR repository.
4. `terraform destroy` in `infra/envs/prod`, read the plan, confirm.
5. Secrets have a 7-day recovery window. KMS keys are scheduled for deletion with a 30-day wait (Terraform does this on destroy); a key pending deletion is not billed.
6. Optionally destroy `infra/bootstrap` (empty the state bucket's versions first).
7. Billing → check the next day's Cost Explorer for anything left; Budgets stop costing when deleted.
