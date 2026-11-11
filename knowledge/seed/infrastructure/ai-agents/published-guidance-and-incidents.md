---
id: infrastructure.ai-agents.published-guidance-and-incidents
department: infrastructure
domain: ai-agents
title: 'IT infrastructure: AI agents that operate infrastructure: published guidance and incidents'
summary: AWS's four scopes of agency, Google's three principles, Microsoft's agent identity practices, the OWASP agentic Top 10, NIST and ITIL, one control list, and the Kiro and PocketOS incidents.
type: principle
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
objectives:
- security
sources:
- https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/
- https://research.google/pubs/an-introduction-to-googles-approach-for-secure-ai-agents/
- https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id
- https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
- https://www.nist.gov/caisi/ai-agent-standards-initiative
- https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1
- https://the-decoder.com/aws-ai-coding-tool-decided-to-delete-and-recreate-a-customer-facing-system-causing-13-hour-outage-report-says/
- https://www.techspot.com/news/112207-ai-coding-agent-running-claude-wiped-startup-database.html
- https://aws.amazon.com/security/security-bulletins/AWS-2025-015/
- https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report
- https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026
related:
- infrastructure.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** Before giving an agent any infrastructure permission or autonomy, and when explaining why the guardrails exist.

**Source section:** 17. AI agents that operate infrastructure: published guidance and incidents

## 17. AI agents that operate infrastructure: published guidance and incidents

### AWS's four scopes of agency

**[FAST-MOVING, 21 Nov 2025] [PLATFORM CLAIM]** AWS's Agentic AI Security Scoping Matrix (21 November 2025) defines four scopes: scope 1, no agency (read-only, human-triggered); scope 2, prescribed agency (the agent can change systems and a human approves every consequential action); scope 3, supervised agency (a human sets the goal and the agent acts without per-action approval); and scope 4, full agency (self-initiating and continuous) ([AWS Security Blog](https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/)).

**[FAST-MOVING, 21 Nov 2025] [PLATFORM CLAIM]** AWS's recommended agent controls are read-only permissions at scope 1; just-in-time, time-bound elevation at higher scopes; MFA for human approvers, signed approval decisions and expiring approval tokens; audit trails of both agent recommendations and human approvals, with reasoning captured at scope 3; real-time behavioural monitoring against a baseline; automated kill switches for runaway processes; tamper-protected human override; and prevention of confused-deputy privilege escalation. AWS also recommends graceful degradation (automatically reduce autonomy when a security event occurs) and progressive deployment (start at scope 1 or 2) ([AWS Security Blog](https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/)).

### Google's three principles

**[DURABLE] [PLATFORM CLAIM]** Google's 2025 paper on its approach to secure AI agents sets three principles: agents must have well-defined human controllers, their powers must be carefully limited, and their actions and planning must be observable. Google describes a hybrid defence in depth that combines traditional deterministic controls with reasoning-based defences ([Google Research](https://research.google/pubs/an-introduction-to-googles-approach-for-secure-ai-agents/)). **[GAP]** The paper was read at abstract level only.

### Microsoft's agent identity practices

**[FAST-MOVING, 13 Aug 2026] [PLATFORM CLAIM]** Microsoft's Entra Agent ID best practices (page dated 13 August 2026) on identity and accountability: a unique identity per agent instance, never shared; all agents registered under naming conventions; every agent has a sponsor (accountable for its purpose) and an owner (technical administrator) from creation; sponsors attest every 6 to 12 months that the agent is still needed; and a quarterly review finds orphaned or inactive agents to reassign or decommission ([Microsoft Learn](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id)).

**[FAST-MOVING, 13 Aug 2026] [PLATFORM CLAIM]** Microsoft on agent permissions and credentials: grant only what each agent needs, scoped to specific APIs or resources, with no broad grants for convenience; prefer delegated (on-behalf-of-user) permissions over application permissions where a user is present; review and right-size periodically; grant standard access through time-bound access packages that pass approval workflows; use managed identities, federated credentials or certificates in production and client secrets only in development; keep separate credentials per environment and keys in a vault or HSM; and rotate certificates at least annually ([Microsoft Learn](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id)).

**[FAST-MOVING, 13 Aug 2026] [PLATFORM CLAIM]** Microsoft on agent containment and monitoring: block non-production agents from production resources by policy; automatically block agents flagged high-risk; write agent-specific access policies instead of reusing user policies; and note that disabling an agent blueprint blocks all its agent identities at once, which Microsoft describes as a rapid kill switch. Alert on spikes in token requests, access to unexpected APIs, sign-ins from unfamiliar addresses, permission or role changes outside the deployment pipeline and credentials near expiry; include agents in incident response (which agents could reach the affected resource, what they did in the window); and retain agent logs for the compliance period ([Microsoft Learn](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id)).

### OWASP Top 10 for Agentic Applications

**[FAST-MOVING, 9 Dec 2025]** OWASP published the Top 10 for Agentic Applications 2026 on 9 December 2025 as a peer-reviewed framework developed with more than 100 contributors ([OWASP GenAI Security Project](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)). **[VENDOR]** The list as read from a vendor summary, not from the OWASP text: ASI01 Agent Goal Hijack; ASI02 Tool Misuse and Exploitation; ASI03 Identity and Privilege Abuse; ASI04 Agentic Supply Chain Vulnerabilities; ASI05 Unexpected Code Execution; ASI06 Memory and Context Poisoning; ASI07 Insecure Inter-Agent Communication; ASI08 Cascading Failures; ASI09 Human-Agent Trust Exploitation; ASI10 Rogue Agents ([Giskard summary](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)). **[GAP: unverified background]** That OWASP frames its mitigations around "least agency" (no more autonomy, tools or privilege than the task needs) is the researchers' recollection; the full text and per-risk mitigations were not read.

### NIST and ITIL: standards still forming

**[FAST-MOVING, Feb 2026]** NIST's AI Agent Standards Initiative (announced February 2026, run by CAISI) has three pillars: industry-led standards, community protocols, and research on agent authentication and identity. Inputs so far are a request for information on agent security (responses due 9 March 2026) and an NCCoE draft concept paper on software and AI agent identity and authorisation (comments due 2 April 2026); no final NIST agent-security guidance was linked when read ([NIST CAISI](https://www.nist.gov/caisi/ai-agent-standards-initiative)). ITIL Version 5 includes a dedicated AI Governance module, which signals that service-management practice now treats AI governance as a core topic ([PeopleCert ITIL](https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1)).

### The vendors' guidance reduces to one control list

**[INFERENCE]** AWS, Google and Microsoft agree on the same list: a unique identity per agent; a named human sponsor; least privilege scoped per environment; time-bound elevated access through an approval workflow; logs the agent cannot alter; and a kill switch that disables all agent identities in one action. Microsoft's 6 to 12 month sponsor attestation and quarterly orphan review give concrete review intervals for the department's own identities.

### Incident: the Kiro environment deletion (December 2025)

**[CONTESTED] [FAST-MOVING, 20 Feb 2026]** Financial Times reporting, relayed by a secondary outlet on 20 February 2026, says that in mid-December 2025 an AWS system was down for 13 hours after engineers let the Kiro coding agent make changes and it chose to delete and recreate the environment; the agent ran with the operator's permissions and no second-person approval was required. Amazon disputes the framing: it calls the cause user error from misconfigured access controls, says the impact was limited to Cost Explorer in one mainland-China Region, and says Kiro asks for authorisation by default. Afterwards AWS added safeguards including mandatory peer review for production access, and employees linked a second, non-customer-facing incident to Amazon Q Developer ([The Decoder, 20 Feb 2026](https://the-decoder.com/aws-ai-coding-tool-decided-to-delete-and-recreate-a-customer-facing-system-causing-13-hour-outage-report-says/)). No public AWS post-mortem was found.

### Incident: PocketOS database and backups deleted in seconds (April 2026)

**[FAST-MOVING, 25 Apr 2026]** Secondary source only, relaying the founder's public account. On 25 April 2026 a Cursor coding agent running Claude Opus 4.6, working against PocketOS's live infrastructure, tried to fix a credential mismatch by deleting a volume through one API call to the hosting provider Railway; the production database and its backups were gone in about 9 seconds. The causes the founder names are a CLI token with broad permissions that reached across environments, backups stored on the same volume as the live data, a provider API that deleted a volume and its backups in one call with no confirmation, and the model guessing the environment scope instead of checking. A three-month-old backup was usable and the gap was rebuilt by hand from payment history, calendar integrations and email confirmations ([TechSpot](https://www.techspot.com/news/112207-ai-coding-agent-running-claude-wiped-startup-database.html)). **[GAP]** Railway's and Cursor's own statements were not read.

### Related incidents

**[GAP: unverified background]** In July 2025 a malicious pull request is understood to have put a destructive "wipe" prompt into a released version of the Amazon Q Developer VS Code extension, after which AWS issued a security bulletin and a fixed version; this would be supply-chain prompt injection into an agent with shell and cloud access, but the bulletin was not fetched ([AWS Security Bulletin AWS-2025-015](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/)). The July 2025 Replit agent database deletion and a reported May 2026 "recursive deletion" incident were not verified and are not relied on.

**[FAST-MOVING, H1 2026] [VENDOR]** Two non-agent automation failures in 2026 have the same shape, a broad automated action without a safety check: GitHub's repair job that deleted about 1.8 billion search documents, and Azure's remediation policy that disabled storage access for VM extensions ([IncidentHub H1 2026 report](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report)). Mandiant shows the adjacent human risk: help desks are socially engineered into resetting MFA, and an agent that handles access requests inherits that exposure ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)).

### Gaps in this section

**[GAP]** No ENISA publication on agentic AI was found; NIST has no final agent-security publication and the status of its control overlays for agents is unverified; Google's SAIF agent material and Microsoft's page on which high-privilege roles agents cannot hold were not read; and EU AI Act obligations for deployers of agents were not researched.
