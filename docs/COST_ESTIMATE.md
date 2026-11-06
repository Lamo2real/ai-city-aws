# Cost estimate (estimate — the AWS bill is the truth)

Prices: Bedrock global profiles from `docs/FACTS_CHECKED.md` (USD per million tokens: Haiku 0.10/0.50, Sonnet 2/10, Opus 4/20, Fable 10/50; cache reads 0.01/0.10/0.20/0.25; cache writes 1.25× input for 5 minutes, 2× for 1 hour). AWS service prices are public list prices for eu-north-1 as of November 2026, rounded. Everything here is an estimate.

## 1. Infrastructure at idle (nothing running)

| Item | Monthly |
|---|---|
| KMS: 1 data key + 1 state key | $2.00 |
| Secrets Manager: 3 empty containers | $1.20 |
| AWS WAF: web ACL + 4 rules (requests negligible) | $9.00 |
| CloudWatch: dashboard $3, 4 alarms $0.40, logs (small) ~$1 | $4.40 |
| DynamoDB on demand: storage + PITR, near-empty | $0.50 |
| S3 (HUD, workspaces, state) + ECR image storage (~1 GB) | $0.40 |
| CloudFront, API Gateway, Lambda, SQS, EventBridge, SNS, Step Functions | ~$0.50 (free tiers cover most) |
| Cognito Essentials (1 user; first 10,000 MAU free) | $0.00 |
| AgentCore runtimes and memory with no sessions | $0.00 |
| **Total at idle** | **≈ $18 / month** |

## 2. One typical task, end to end
Computed with `estimateUsd()` from `packages/shared/src/cost.ts` (the same function the ledger uses). "Without caching" sends every cached token as plain input.
"Add a feature with tests" — AIC 2 turns, Orchestrator 3, one department's manager 6 (incl. reviews), 3 workers each doing an agentic job.

| Role | Turns | Tokens per turn (input / cache read / cache write / output) | With caching | Without caching |
|---|---|---|---|---|
| AIC (Sonnet 5.5) | 2 | 2k / 6k / 0.5k / 0.3k | $0.02 | $0.04 |
| Orchestrator (Fable 5.1) | 3 | 3k / 10k / 1k / 1k | $0.31 | $0.57 |
| Manager (Fable 5.1, 1-hour cache) | 6 | 4k / 15k / 2k / 1.5k | $0.95 | $1.71 |
| Workers (Opus 5.5) | 3 jobs | 40k / 260k / 40k / 15k per job | $2.14 | $4.98 |
| Utility (Haiku 5.5) | 1–3 | small | <$0.01 | <$0.01 |
| AgentCore compute (CPU idles during model waits) | | ~1 vCPU-min + 2 GB × 20 min per worker job | ~$0.05 | ~$0.05 |
| **Per task** | | | **≈ $3.50** | **≈ $7.35** |

Prompt caching roughly halves the cost because agent turns resend long, stable system prompts and growing transcripts; cache reads cost 2.5–5 % of input.

## 3. Monthly, by usage level (infrastructure + AI)

| Usage | Tasks / month | AIC chats (status, small talk) | AI estimate | Total estimate | vs. the $10,000 alert |
|---|---|---|---|---|---|
| Low | 8 (2 a week) | 100 | $28 + $1 | **≈ $47** | far below |
| Normal | 30 (1 a day) | 300 | $105 + $3 | **≈ $126** | far below |
| Heavy | 150 (5 a day) | 600 | $525 + $6 | **≈ $549** | below (no first email until $5,000) |

There is no spend cap by default (the owner's choice) and the AWS Budgets alert is $10,000 a month, so the first email comes at $5,000. Heavy use of Fable (coordinators) and Opus (workers) is what drives the bill; Fable is 2.5× Opus per token, so a cheaper option is `eu.` or switching coordinators to Opus 5.5 in `config/models.json` (owner's call).

## What moves the number most
1. Worker job length (output tokens at $20/M and uncached input).
2. Review rounds (each FAIL is another worker job and another manager turn).
3. Cache hit rate (watch "CacheReadTokens" on the dashboard).
4. Global vs `eu.` profiles (+10 %).
