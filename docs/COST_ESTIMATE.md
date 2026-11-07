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
| Knowledge base, OpenSearch Serverless: 1 OCU minimum (0.5 indexing + 0.5 search, no standby) × $0.255/h × 730 h | ≈ $186 |
| Knowledge base, Neptune Analytics: 16 m-NCU, no replica, $0.581/h × 730 h | ≈ $424 |
| Knowledge base, api Lambda SnapStart: snapshot cache (1 GB function, ~$0.0000015/GB-s) plus restores | ≈ $4 |
| Knowledge base, the rest: S3 bucket, Bedrock Knowledge Base (no charge of its own), item table, Step Functions, MediaConvert (on demand), 1 more DLQ alarm | ~$0.10 |
| **Total at idle** | **≈ $632 / month** (≈ $18 without the knowledge base; ≈ $614 of it is the knowledge base's fixed cost, owner-approved, decision 66) |

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
| Low | 8 (2 a week) | 100 | $28 + $1 | **≈ $661** | far below |
| Normal | 30 (1 a day) | 300 | $105 + $3 | **≈ $740** | far below |
| Heavy | 150 (5 a day) | 600 | $525 + $6 | **≈ $1,163** | below (no first email until $5,000) |

Totals include the knowledge base's ≈ $614 fixed cost (§1); its use-based cost is in §4.

There is no spend cap by default (the owner's choice) and the AWS Budgets alert is $10,000 a month, so the first email comes at $5,000. Heavy use of Fable (coordinators) and Opus (workers) is what drives the bill; Fable is 2.5× Opus per token, so a cheaper option is `eu.` or switching coordinators to Opus 5.5 in `config/models.json` (owner's call).

## 4. Knowledge base, by use (eu-north-1 list prices, 2026-11-07)
| Item | Price | Light personal use (2 GB documents, 10 h video, 3,000 searches a month) |
|---|---|---|
| Transcribe batch | $0.024 / audio minute | 600 min ≈ $14.40 |
| MediaConvert audio-only (basic tier) | ~$0.0075 / output minute | ~$4.50 |
| Haiku 5.5 (summaries, entities, images, scanned PDFs) | $0.10 / $0.50 per M tokens | ~$1–3 |
| Titan Text Embeddings V2 | $0.021 per M tokens | < $1 |
| OpenSearch Serverless storage | $0.024 / GB-month | < $1 (more OCUs only under heavy load or tens of GB of vectors, $186 / month each) |
| Neptune Analytics | fixed (§1) | $0 extra at personal scale |
| S3 storage (raw + normalized, versioned 30 days) | ~$0.023 / GB-month | ~$0.10 |
| Step Functions Standard (wait loops: ~1 transition per 20–30 s of a job) | $0.025 / 1,000 transitions | < $0.50 |
| **Knowledge total (use)** | | **≈ $20–25 / month on top of the ≈ $614 fixed** |

## What moves the number most
1. Worker job length (output tokens at $20/M and uncached input).
2. Review rounds (each FAIL is another worker job and another manager turn).
3. Cache hit rate (watch "CacheReadTokens" on the dashboard).
4. Global vs `eu.` profiles (+10 %).
