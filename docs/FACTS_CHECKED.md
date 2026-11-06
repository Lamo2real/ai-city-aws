# Facts checked (2026-11-06)

Every AWS and Anthropic detail the code relies on, with where it was read. Checked from the
official pages listed; nothing was called in AWS. Re-check anything marked **verify at deploy**
in the console before the first `terraform apply`.

## 1. AgentCore regions — Stockholm has everything we need

Source: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-regions.html

| Feature | eu-north-1 (Stockholm) | eu-central-1 (Frankfurt) |
|---|---|---|
| Runtime (microVMs) | Yes | Yes |
| Memory | Yes | Yes |
| Gateway | Yes | Yes |
| Identity | Yes | Yes |
| Built-in tools (Browser, Code Interpreter) | Yes | Yes |
| Observability | Yes | Yes |
| Web Search Tool (Gateway connector) | **No** | No |

Release notes (https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/release-notes.html):
Runtime platform version V2 (snapshot start) reached Stockholm in November 2026.

**Result:** default region stays `eu-north-1`. The Gateway Web Search connector is not in
Stockholm, so worker web search uses the Agent SDK's own `WebSearch`/`WebFetch` tools
(they go through Bedrock / plain HTTPS), not the Gateway connector.

## 2. Model IDs and inference profiles

Sources:
- https://platform.claude.com/docs/en/models/overview (Bedrock IDs, list prices)
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-5-5.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-fable-5-1.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html
- https://repost.aws/questions/QUqHNmMim9R4m5weq1Yoj9NQ (Sonnet 5.5 is INFERENCE_PROFILE-only)

| Plain name | Bedrock model ID | Global profile | Geo profiles |
|---|---|---|---|
| `sonnet-5-5` | `anthropic.claude-sonnet-5-5` | `global.anthropic.claude-sonnet-5-5` | not confirmed for `eu.` (verify at deploy) |
| `opus-5-5` | `anthropic.claude-opus-5-5` | `global.anthropic.claude-opus-5-5` | `eu.` assumed (verify at deploy) |
| `fable-5-1` | `anthropic.claude-fable-5-1` | `global.anthropic.claude-fable-5-1` | `us.` only — **no `eu.`** |
| `haiku-5-5` | `anthropic.claude-haiku-5-5` | `global.anthropic.claude-haiku-5-5` | `eu.`, `us.` |

- `eu-north-1` is a source region for the global profiles (Fable 5.1 and Haiku 5.5 model cards).
- Sonnet 5.5 supports only the inference-profile invocation type: the bare model ID fails
  on demand; the `global.` profile works.
- Access to some newest Claude models is gated per model; the Bedrock console may show a
  request step (the re:Post thread). **Verify at deploy** that all four are enabled.

## 3. Application inference profiles from global profiles

Source: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-create.html
and https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-application-inference-profiles.html

- An application inference profile can be created by copying a **cross-Region
  (system-defined) inference profile**; usage and cost are tracked per application profile and
  its tags show up as cost allocation tags.
- The docs do not name the `global.` profiles explicitly. We create one profile per role
  (`aic-ace`, `aic-orchestrator`, `aic-manager`, `aic-worker`, `aic-utility`) copying from the
  global profile ARN. If `CreateInferenceProfile` rejects a global source at deploy time, set
  `use_application_inference_profiles = false` in `prod.tfvars`; the runtimes then call the
  global profiles directly and per-role cost comes from the ledger only. **Verify at deploy.**
- Terraform resource: `aws_bedrock_inference_profile` with `model_source { copy_from = ... }`
  (https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrock_inference_profile).

## 4. Terraform provider support for AgentCore

Sources: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_agent_runtime,
https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagentcore_memory,
https://github.com/hashicorp/terraform-provider-aws/issues/50078 (`platform_version` shipped in v6.68.0).

- `aws_bedrockagentcore_agent_runtime` (args used: `agent_runtime_name`, `role_arn`,
  `agent_runtime_artifact.container_configuration.container_uri`, `network_configuration`,
  `environment_variables`, `lifecycle_configuration`, `platform_version`, `tags`).
- `aws_bedrockagentcore_agent_runtime_endpoint`, `aws_bedrockagentcore_memory`,
  `aws_bedrockagentcore_gateway` (see §4a for the exact list taken from the provider schema).
- Minimum provider version pinned: `>= 6.68.0, < 7.0.0` (first version with `platform_version`).

### 4a. Confirmed from the downloaded provider schema
Filled in during Phase 7 from `terraform providers schema -json` (offline after `init`); see
the end of this file.

## 5. AgentCore Runtime container contract

Source: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html

- **ARM64** container. Serving port **8080** (changeable via `protocolConfiguration`).
- `POST /invocations` — JSON or streamed (SSE) response.
- `GET /ping` — 200 when healthy. Body `{"status":"Healthy"}` or `{"status":"HealthyBusy"}`;
  `HealthyBusy` keeps the session alive while background (async) work runs.
- TLS ends at AgentCore; the container serves plain HTTP inside.
- Inbound auth: IAM SigV4 by default, or a JWT authorizer configured on the runtime. We use
  IAM (only our Lambdas invoke runtimes).

## 6. AgentCore quotas

Source: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-limits.html

| Quota | Default | Adjustable |
|---|---|---|
| Active sessions per account | 5,000 (us-east-1, us-west-2); **2,500 elsewhere** (Stockholm) | Yes |
| New sessions per second | 25 | Yes |
| Agent runtimes per account | 1,000 | Yes |
| Hardware per session | 2 vCPU / 8 GB | No |
| Max session duration | 8 h (`maxLifetime`) | Yes |
| Async job max | 8 h (microVMs) | No |
| Idle session timeout | 15 min (`idleRuntimeSessionTimeout`) | Yes |
| Request timeout | 15 min | No |
| Payload | 100 MB | No |

So in Stockholm: `max_concurrent_workers_global` default = 2,500 − 50 reserve = **2,450**,
`max_new_sessions_per_second` default = **20** (below 25).

## 7. Claude Agent SDK / Claude Code on Bedrock

Source: https://code.claude.com/docs/en/amazon-bedrock

- `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION`.
- `ANTHROPIC_MODEL` accepts an inference profile ID **or an application inference profile ARN**.
- `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_MODEL` / `_HAIKU_MODEL`; `ANTHROPIC_SMALL_FAST_MODEL`
  is deprecated.
- `ANTHROPIC_BEDROCK_REGION_PREFIX` (`us`, `eu`, `apac`, `jp`, `au`, `global`).
- `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` — set; we compact instead of paying for 1M windows.
- Prompt caching is on by default; `DISABLE_PROMPT_CACHING=1` turns it off (we never set it);
  `ENABLE_PROMPT_CACHING_1H=1` selects the 1-hour cache (set for orchestrator/managers whose
  turns are event-driven and can be minutes apart).
- `AWS_BEARER_TOKEN_BEDROCK` is a Bedrock API key that replaces the credential chain — the
  startup guard refuses it. `CLAUDE_CODE_USE_ANTHROPIC_AWS` is not on that page; we refuse it
  anyway as the prompt requires.
- IAM: `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`,
  `bedrock:ListInferenceProfiles`, `bedrock:GetInferenceProfile`. Marketplace actions
  (`aws-marketplace:ViewSubscriptions`, `Subscribe`) are needed once for model access, by the
  owner in the console — not by the runtimes.

## 8. Prices (USD per million tokens)

Sources: https://platform.claude.com/docs/en/models/overview (input/output list prices),
https://www.anthropic.com/claude-opus-5-5 (Opus cache read $0.20), the Haiku 5.5 model card
(long-context tier over 100k tokens). The Bedrock pricing page renders its tables in the
browser and could not be read offline, so the global-profile figures below are the owner's
figures from the build prompt, consistent with Anthropic's list prices. **Verify at deploy.**

| Model | Input | Output | Cache read | Cache write 5 min (1.25×) | Cache write 1 h (2×) |
|---|---|---|---|---|---|
| haiku-5-5 | 0.10 | 0.50 | 0.01 | 0.125 | 0.20 |
| sonnet-5-5 | 2 | 10 | 0.10 | 2.50 | 4 |
| opus-5-5 | 4 | 20 | 0.20 | 5 | 8 |
| fable-5-1 | 10 | 50 | 0.25 | 12.50 | 20 |

- Geographic (`eu.`/`us.`) profiles: +10 %.
- Haiku prompts over 100,000 tokens: ×5 (separate "Long Context" row on Bedrock).
- Cache-write multipliers 1.25× (5 min) and 2× (1 h) are Anthropic's standard rates; the
  upstream repo's `prices_per_mtok` uses the 2× figure.

## 9. Other services
- Amazon Transcribe streaming supports custom vocabularies; Amazon Polly neural voices. Both
  are AWS speech services, not language models.
- AWS Budgets actions can attach an IAM policy to roles when a threshold is crossed; actions
  reset each budget period; Budgets data lags by hours.
- Claude usage on Bedrock is billed partly through AWS Marketplace, so the budget is
  account-wide, not filtered to the Bedrock service.
