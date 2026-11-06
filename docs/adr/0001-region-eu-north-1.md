# ADR 0001: Region eu-north-1 (Stockholm)
**Status:** accepted · **Date:** 2026-11-06
**Context.** The owner asked for Stockholm if AgentCore and the models are available there, else the nearest EU region (Frankfurt first).
**Decision.** `eu-north-1`. The AgentCore regions table lists Runtime, Memory, Gateway, Identity, built-in tools and Observability in Stockholm; all four Claude models are reachable from it through global inference profiles. Region is one variable.
**Consequences.** The Gateway Web Search connector is not in Stockholm, so workers use the SDK's WebSearch/WebFetch. WAF for CloudFront lives in us-east-1 regardless.
