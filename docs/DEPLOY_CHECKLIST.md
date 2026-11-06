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

## D. GitHub (~10 min)
13. The repository is **`Lamo2real/ai-city-aws`** (public). Workflows only run when you start them by hand, so a push never deploys anything.
14. Settings → Environments → New environment **`production`** → Required reviewers: **you** → Deployment branches: `main` only. Every apply waits for your approval here.
15. Optional: Settings → Branches → protect `main` (require a pull request).

## E. The deploy role (from you or your account admin, ~10 min)
16. In the AI City account: IAM → Identity providers → Add provider → OpenID Connect → URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com` (skip if it already exists).
17. IAM → Roles → Create role → Custom trust policy → paste `docs/deploy-role-trust-policy.json` with `<ACCOUNT_ID>` filled in. It lets only `deploy.yml` on `main` (and the `production` environment) assume the role.
18. Permissions: `AdministratorAccess`. Terraform creates IAM roles, KMS keys, Cognito, CloudFront, WAF, AgentCore and more, so it needs broad rights. Nothing else can assume this role.
19. Copy the role ARN.

## F. One variable and one secret (~2 min)
20. GitHub → Settings → Secrets and variables → Actions:
   - **Variable** `AIC_DEPLOY_ROLE_ARN` = the role ARN from step 19.
   - **Secret** `AIC_OWNER_EMAIL` = the only account that can sign in (Cognito creates just this user; nobody can sign up) and where alerts go. A secret, so it is masked in this public repository's logs.
   - Optional variables: `AIC_REGION` (default `eu-north-1`), `AIC_MONTHLY_BUDGET_USD` (alert amount, default `10000`), `AIC_STATE_BUCKET` (default `lamo-labs-state-bucket`; the state lives under `ai-city-aws/prod/terraform.tfstate`).

## G. First deploy (~45 min, one run)
21. Actions → **deploy** → Run workflow → type `deploy prod`.
22. The **plan** job runs the tests, builds the Lambdas, uses the Terraform state bucket `lamo-labs-state-bucket` (if it doesn't exist yet it creates it: private, versioned, encrypted, TLS-only; an existing bucket is used as it is, in its own region), and makes the plan.
23. **Read the plan.** The run summary shows the counts; the full text is in the log of the `terraform plan` step. First time: roughly 200 resources to add, **0 to change, 0 to destroy**: KMS key, Cognito user pool with your user, DynamoDB tables, an EventBridge bus, 8 SQS queues, 10 Lambda functions, 2 API Gateway APIs, 4 AgentCore runtimes, 4 memories, 5 inference profiles, an ECR repository plus the image build, a CloudFront distribution with WAF, a budget (email alerts only), a dashboard and alarms, 5 schedules (all **DISABLED**). If anything says "destroy", reject it.
24. **Approve** the `production` environment. The **apply** job applies exactly that plan; while doing so it builds the ARM64 agent image and pushes it to ECR before the runtimes are created (about 10–20 minutes for the first image).
   If `aws_bedrock_inference_profile` fails because a global profile can't be copied, tell Claude: it switches `use_application_inference_profiles` off (cost per role then comes from the ledger only) and you run the workflow again.
25. The **frontend** job uploads the HUD and refreshes CloudFront. The run summary ends with the HUD's URL.
26. Every later deploy is the same: Run workflow → read the plan → approve.

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
