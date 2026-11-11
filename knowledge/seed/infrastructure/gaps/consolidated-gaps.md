---
id: infrastructure.gaps.consolidated-gaps
department: infrastructure
domain: gaps
title: 'IT infrastructure: Consolidated gaps and conclusion'
summary: Everything the research did not verify or could not find, by area (AWS, IaC, platform, reliability, incidents, change and cost, Kubernetes, security, frameworks, regulation, ITSM, post-quantum, AI agents), and the conclusion.
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources: []
related:
- infrastructure.overview.about-this-knowledge-base
seed_version: 1
---

**When to use this:** Whenever the knowledge base seems silent: check whether the point is a known gap, and say so instead of guessing.

**Source section:** 20. Consolidated gaps (with the closing Conclusion)

## 20. Consolidated gaps

**[GAP]** Research method limits. All pages were read through summarising tools; search and fetch budgets ran out more than once; legal wording must be re-read at the links before it is relied on; and nothing here is professional advice.

**[GAP]** AWS architecture and networking. Not sourced: Transit Gateway versus Cloud WAN, VPC Lattice, peering and PrivateLink; Route 53 Resolver and Profiles; centralised egress; CloudFront and edge practice; S3 storage-class, lifecycle and data-protection patterns; the eu-north-1 service-gap list; Control Tower landing-zone version, Region deny, drift handling and data-residency controls; SCP quotas; whether the core Well-Architected Framework was revised after November 2024; and the European Sovereign Cloud's service list, pricing, certifications and cross-partition connectivity.

**[GAP]** Infrastructure as code. Not sourced: policy as code (OPA, Sentinel, Checkov, cfn-guard, Kyverno), GitOps tooling and OpenGitOps principles, CloudFormation drift detection and Hooks, drift tooling, module testing, Terraform Stacks, the Terraform version current in November 2026, HashiCorp's licence FAQ and IBM ownership details.

**[GAP]** Platform engineering. No Gartner figure; DORA's AI capabilities and team archetypes; DORA 2024 platform effect sizes; build-versus-buy evidence for developer portals.

**[GAP]** Reliability. Not sourced: AWS Fault Injection Service and chaos engineering, ARC zonal autoshift and Region switch, autoscaling policy and capacity planning, load-testing benchmarks, SLI selection guidance, numeric recovery targets from AWS or a standards body, and AWS Backup restore-testing features. All 2026 outage details rest on one aggregator; Microsoft's own review of the October 2025 Front Door outage was not read.

**[GAP]** Incident management and observability. Not sourced: customer-communication cadences, MTTR benchmarks, Swedish on-call and working-time rules, incident tooling, AWS observability services, observability pricing and spend benchmarks, and the status of OpenTelemetry profiles, logs SDK and semantic conventions.

**[GAP]** Change management and cost. Not sourced: DORA's effect sizes and 2025 metric benchmarks, AWS deployment mechanics, schema-change practice, commitment coverage and utilisation benchmarks, Reserved Instance trade-offs, Savings Plan return rules, Compute Optimizer, Graviton and Spot benchmarks, tag mechanics, Bedrock pricing and GPU reservations, and EKS extended-support pricing.

**[GAP]** Kubernetes and serverless. The Kubernetes baseline checklist is unsourced general practice; Lambda cold starts, pricing changes and the Regional availability and pricing of the new Lambda modes were not checked; ECS-specific practice and container security baselines were not read.

**[GAP]** Security. Held only as unverified background: the SP 800-207 tenets, AWS IAM best practices, the Security Pillar summary, SP 800-57, CIS Benchmarks levels, S3 Object Lock behaviour and the SP 800-61r3 structure. Not retrieved: the full Verizon 2026 report, the ENISA Threat Landscape 2026 and BOD 26-04's implementation guidance.

**[GAP]** Frameworks. Held only as unverified background: ISO 27001's 93 controls, clause structure, transition end date and audit cycle; SOC 2 Type 1 and Type 2 definitions; CIS Implementation Group counts. Not read: the AICPA 2027 exposure drafts. No verified cost or duration data for certification.

**[GAP]** Regulation. Held only as unverified background: NIS2 essential versus important classification, GDPR Articles 32 to 34 and 83, DORA incident-reporting deadlines and the critical-provider list, and CRA scope for SaaS. Secondary source only: the Digital Omnibus status and the Data Privacy Framework appeal. Not read: MCFFS 2026:1, PTS guidance, Annex sections 1 to 3 of Regulation 2024/2690, Säkerhetsskyddslagen, the status of the January 2026 NIS2 amendment proposal and the EU AI Act.

**[GAP]** ITSM and corporate IT. ITIL 4 practice descriptions are from memory; ITIL Version 5's release date and differences are unknown; no service desk benchmarks; no primary source for device-management, endpoint-detection or SaaS-management baselines; bulk-sender email requirements not re-verified; no offboarding or SaaS-sprawl statistics.

**[GAP]** Post-quantum. Not verified: AWS service-by-service support, Swedish national guidance, the EU roadmap's milestone text in the original, and FIPS 203 to 205 details.

**[GAP]** AI agents. The OWASP agentic Top 10 full text was not read and its risk names rest on a vendor summary; "least agency" is unverified; no ENISA or final NIST agent guidance exists in the notes; the Kiro account is disputed and second-hand; the PocketOS account is the founder's, relayed by news; the Amazon Q extension incident and the Replit incident are unverified; the reported June 2026 model-access suspension was read only in an aggregator.

## Conclusion

The research changes the picture of what "infrastructure knowledge" means for an agent department in one specific way: the hard part is no longer knowing the services, it is knowing which actions are irreversible and who owns the decision. The outage record, the breach record and the agent-incident record all describe the same failure, an actor with broad reach making a fast, wide change with nothing in the platform to stop it, and the same remedy, which is scope limits, staging and a second approver enforced outside the actor. An agent department that internalises that will find most of the domain guidance above follows from it.

For a Swedish SaaS company the regulatory layer turns those engineering habits into dated obligations. A 30-minute outage timer, a per-tenant impact count, an awareness timestamp and an export-and-exit procedure before 12 January 2027 are engineering deliverables with legal consequences, and the classification questions behind them need Legal's answer before the first incident and not during it. The most useful next research is narrow: close the gaps that agents will otherwise be tempted to fill from memory (network topology, policy as code, autoscaling, chaos testing, device baselines, AWS post-quantum support), re-verify the unverified-background items on their primary pages, and re-check the fast-moving items (the Digital Omnibus, the Data Privacy Framework appeal, the 2027 SOC 2 criteria, EKS dates and BOD 26-04 adoption) on a quarterly cycle.
