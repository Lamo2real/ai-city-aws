# Deploy checklist (for the owner)

One step at a time. Nothing here was done by the build; every step is yours. Times are rough.

## A. The AWS account (once, ~30 min)
1. **Create a dedicated AWS account** for AI City (aws.amazon.com → Create an AWS Account), or in AWS Organizations: Organizations → Add an AWS account → Create. Confirm it's the account you want before going on.
2. **Payment method**: Billing and Cost Management → Payment preferences → add a card.
3. **Root MFA**: sign in as root → top-right account menu → Security credentials → Multi-factor authentication → Assign MFA device (passkey or authenticator app). Then stop using root.
4. **Admin login without access keys**: IAM Identity Center → Enable → Users → Add user (you) → Permission sets → Create `AdministratorAccess` → AWS accounts → assign you with that permission set. On your machine:
```bash
aws configure sso --profile aic
```
```bash
aws sso login --profile aic
```
   Never create IAM access keys.
5. **Cost Explorer**: Billing → Cost Explorer → Enable Cost Explorer (data appears within 24 h).
6. **Billing alerts for IAM users** (optional): Billing → Account → IAM user and role access to billing → Activate.

## B. Bedrock model access (~15 min, approval can take longer)
7. Switch the console to **Europe (Stockholm) eu-north-1**.
8. Amazon Bedrock → Model catalog → for each of **Claude Sonnet 5.5, Claude Opus 5.5, Claude Fable 5.1, Claude Haiku 5.5**: open it → Request access / Enable (submit Anthropic's **use-case form** the first time; it may also subscribe through AWS Marketplace).
9. Check each model card lists **global cross-region inference** from eu-north-1. Note any model that says "not available for this account" — AWS gates some newest models; open a support case if needed.
10. Optional quick check from your terminal (one tiny paid call per model, a fraction of a cent):
```bash
aws bedrock list-inference-profiles --region eu-north-1 --profile aic --query "inferenceProfileSummaries[?contains(inferenceProfileId,'global.anthropic')].inferenceProfileId"
```

## C. Quotas (~10 min to request)
11. Service Quotas → Amazon Bedrock → search each model ("Claude Opus 5.5", "Claude Fable 5.1", …) → check **tokens per minute** and **requests per minute** for **global cross-region** inference. Request more if they look small (see `docs/SCALING.md`).
12. Service Quotas → Amazon Bedrock AgentCore → check "Active session workloads per account" (2,500 in Stockholm) and "New Runtime session creation rate" (25/s). Defaults are fine to start.

## D. GitHub (~15 min)
13. Create a **private** repository, e.g. `you/ai-city-aws`. Push this repo's `main` to it:
```bash
git remote add origin git@github.com:you/ai-city-aws.git
```
```bash
git push -u origin main
```
14. Branch protection on `main` for private repos needs **GitHub Pro** (or Team). If you want it: Settings → Branches → Add rule → require a pull request.
15. Settings → Environments → New environment **`production`** → Required reviewers: **you**. Deployment branches: `main` only.

## E. Bootstrap: state bucket and deploy role (~10 min)
16. Build nothing yet. Apply the bootstrap once from your machine:
```bash
cd infra/bootstrap && terraform init && terraform apply -var owner_email=you@example.com -var github_repo=you/ai-city-aws
```
   Read the plan in plain words: one KMS key, one S3 bucket (versioned, private), the GitHub OIDC provider and one deploy role. Type `yes`.
17. Note the outputs `state_bucket`, `state_kms_key_arn`, `deploy_role_arn`.

## F. Fill in the prod settings (~5 min)
18. `cp infra/envs/prod/prod.tfvars.example infra/envs/prod/prod.tfvars` and set `owner_email`. Keep `monthly_budget_usd = 10000` (the AWS Budgets alert amount; emails only).
19. `cp infra/envs/prod/backend.hcl.example infra/envs/prod/backend.hcl` and paste the bootstrap outputs.
20. In GitHub → Settings → Secrets and variables → Actions → **Variables** (not secrets; none of these are secret): `AIC_REGION=eu-north-1`, `AIC_DEPLOY_ROLE_ARN`, `AIC_STATE_BUCKET`, `AIC_STATE_KMS_KEY_ARN`, `AIC_OWNER_EMAIL`, `AIC_MONTHLY_BUDGET_USD=10000`. (`AIC_ECR_REPOSITORY_URL`, `AIC_HUD_BUCKET`, `AIC_CLOUDFRONT_DISTRIBUTION_ID` come after step 23.)

## G. First deploy (~45 min)
The runtimes need an image that exists, so the first deploy is done in two steps from your machine.
21. Build the Lambdas and create just the image repository:
```bash
npm ci && npm run build -w @aic/lambdas
```
```bash
cd infra/envs/prod && terraform init -backend-config=backend.hcl && terraform apply -var-file=prod.tfvars -target=module.agents.aws_ecr_repository.runtime
```
22. Build and push the first image (needs Docker with buildx):
```bash
ECR=$(terraform output -raw ecr_repository_url); aws ecr get-login-password --region eu-north-1 --profile aic | docker login --username AWS --password-stdin ${ECR%%/*}; docker buildx build --platform linux/arm64 -f ../../../services/agent-runtime/Dockerfile -t $ECR:first --push ../../..
```
23. **First full plan, reviewed in plain words**:
```bash
terraform plan -var-file=prod.tfvars -var agent_image_tag=first -out prod.tfplan
```
   What you should see: roughly 200 resources to add (a static count of the HCL gives about 205), **0 to change, 0 to destroy**: KMS key, Cognito user pool with your user, DynamoDB tables, an EventBridge bus, 8 SQS queues, 10 Lambda functions, 2 API Gateway APIs, 4 AgentCore runtimes, 4 memories, 5 inference profiles, an ECR repository, a CloudFront distribution with WAF, a budget (email alerts only), a dashboard and alarms, 5 schedules (all **DISABLED**). If anything says "destroy", stop.
24. Apply exactly that plan:
```bash
terraform apply prod.tfplan
```
   If `aws_bedrock_inference_profile` fails because a global profile can't be copied, set `use_application_inference_profiles = false` in `prod.tfvars` and plan/apply again (cost per role then comes from the ledger only).
25. Upload the HUD:
```bash
cd ../../../web && npm run build && aws s3 sync dist s3://$(terraform -chdir=../infra/envs/prod output -raw hud_bucket) --exclude config.json --profile aic
```
26. Add the GitHub variables `AIC_ECR_REPOSITORY_URL`, `AIC_HUD_BUCKET`, `AIC_CLOUDFRONT_DISTRIBUTION_ID` from `terraform output`. From now on deploy with **Actions → deploy → Run workflow** and approve the `production` environment.

## H. After the first apply (~20 min)
27. **Confirm the alert emails**: you get two "AWS Notification - Subscription Confirmation" emails (city notifications and, separately, the budget emails go straight to you). Click **Confirm subscription**.
28. **First sign-in and MFA**: open `hud_url` (terraform output). Sign in with your email and the **temporary password** Cognito emailed you → choose a new password → scan the QR code with your authenticator app → enter the code. You land on Ace.
29. **Secrets** (only when you need them): Secrets Manager → `aic/prod/github` → Retrieve secret value → **Set secret value** → paste a fine-grained GitHub token scoped to the repos workers may touch (contents read/write, pull requests read/write). Google and Spotify stay empty while their integrations are off.
30. **Activate cost allocation tags** (takes up to 24 h to appear): Billing → Cost allocation tags → User-defined → select `Project`, `App`, `Environment`, `Owner`, `ManagedBy`, `CostCenter`, `Component`, `AgentRole` → **Activate**.
31. Turn on the crash sweep: EventBridge → Scheduler → group `aic-prod` → `aic-prod-sweep` → Enable. (Others are optional; leave `aic-prod-improve` disabled.)

## I. First live smoke test, under a $1 cap (~10 min)
32. In the HUD: **Settings → Daily cap, all departments = 1**, **per department = 1** → Save. (Caps are off by default; this one is just for the smoke test.)
33. Say or type: **"yo Ace, what's 9 + 9?"** → Ace answers "Eighteen." (one Sonnet turn, about a cent).
34. One turn per model:
   - Haiku: turn on **Hands-free** and say something unclear that mentions Ace (e.g. "I told Ace about it") → the wake check asks Haiku.
   - Fable + Opus: ask "Ace, create a Research department and have it find today's date in Stockholm from one official source." → watch the City: a building goes up, the manager hires one worker, the worker reports, the manager reviews, the Orchestrator signs off, Ace tells you.
35. Check **Costs (estimates)** shows a few cents by role and model, and the CloudWatch dashboard `aic-prod` shows turns.
36. Empty the cap fields again and Save for no limit (or keep any cap you want).

If something fails, `docs/RUNBOOK.md` → "Something is stuck".
