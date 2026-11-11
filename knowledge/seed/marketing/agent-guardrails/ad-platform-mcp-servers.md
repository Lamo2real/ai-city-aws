---
id: marketing.agent-guardrails.ad-platform-mcp-servers
department: marketing
domain: agent-guardrails
title: Ad-platform MCP servers differ sharply in what an agent may do
summary: Google's Ads MCP server is read-only, while Meta's and TikTok's servers can create, edit and delete campaigns with no documented approval step, so spend and publish limits must be enforced in the tool layer.
type: policy
audience: manager
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
- meta
- tiktok
objectives: []
sources:
- https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server
- https://www.reddit.com/r/mcp/comments/1wlix2u/google_ads_has_no_readonly_permission_so_my_mcp/
- https://ppc.land/meta-opens-ads-mcp-to-any-app-cutting-integration-code-to-zero/
- https://www.contentgrip.com/ad-platform-mcp-rollout/
- https://ads.tiktok.com/resources/help/article/about-tiktok-for-business-mcp-server?lang=en
- https://digiday.com/marketing/tiktok-launches-mcp-server-to-let-ai-agents-run-campaigns/
related:
- marketing.agent-guardrails.guardrail-design
- marketing.agent-guardrails.prompt-injection
seed_version: 1
---

**When to use this:** When connecting an agent to an ad platform's MCP server or API.

## Ad-platform MCP servers differ sharply in what an agent may do

**[FAST-MOVING; Google developer docs updated 30 Oct 2026]** Google's official Ads MCP server is **"strictly read-only"**: it "cannot modify bids, pause campaigns, or create new assets". It exposes three tools (`list_accessible_customers`, `search` for query-language reports, and `get_resource_metadata`), authenticates by OAuth 2.0 or a service account, and Google's docs warn that deploying it to Cloud Run with unauthenticated access and no OAuth client exposes the service account's credentials ([Google Ads API docs](https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server)). A community note adds that the Google Ads API has a single OAuth scope covering read and write, so the read-only limit is enforced by the server, not by the credential ([Reddit r/mcp](https://www.reddit.com/r/mcp/comments/1wlix2u/google_ads_has_no_readonly_permission_so_my_mcp/)). **[FAST-MOVING, 16 Jul 2026; secondary]** Meta opened its ads MCP server to any developer with a Meta app. **Write tools create, edit and delete campaigns, ad sets and ads**, custom audiences, catalogues, A/B tests and conversion lift studies; read tools cover spend, impressions, CTR and ROAS with breakdowns plus signal-health diagnostics. Agencies acting for other businesses need app review and advanced access. The report mentions no confirmation step or safeguard for write actions ([PPC Land, 18 Jul 2026](https://ppc.land/meta-opens-ads-mcp-to-any-app-cutting-integration-code-to-zero/)). **[CONTESTED]** A trade article of 27 August 2026 describes Meta's server as a test with undefined write scope; prefer the July report but confirm on Meta's developer site ([ContentGrip](https://www.contentgrip.com/ad-platform-mcp-rollout/)). **[FAST-MOVING; TikTok help page, announced May 2026]** The TikTok for Business MCP Server exposes campaign management, performance reporting, audience configuration and creative operations, and TikTok says agents can run workflows from campaign creation to real-time bidding adjustments "without human intervention at every step" ([TikTok Ads Help Center](https://ads.tiktok.com/resources/help/article/about-tiktok-for-business-mcp-server?lang=en); [Digiday](https://digiday.com/marketing/tiktok-launches-mcp-server-to-let-ai-agents-run-campaigns/)). Amazon Ads put its own server into closed beta in November 2025 ([PPC Land](https://ppc.land/meta-opens-ads-mcp-to-any-app-cutting-integration-code-to-zero/)).
