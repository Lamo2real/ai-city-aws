---
id: application.compliance.customer-trust
department: application
domain: compliance
title: 'Application: Customer trust requirements: buyers want verifiable SDLC evidence'
summary: 'Customer trust: the SDLC evidence buyers expect, the SOC 2 revision, SSDF as the evidence structure, the legally
  defined evidence pack for in-scope products, audit and jurisdiction questions, agent activity as auditable evidence, the
  evidence pack an agent-run department should produce, and segregation of duties when agents write code.'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
- security
sources:
- https://code.claude.com/docs/en/security
- https://www.schellman.com/blog/soc-2-is-getting-an-update-what-the-revised-trust-services-criteria-mean-for-your-organization
- https://csrc.nist.gov/projects/ssdf
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847
- https://www.legal500.com/intelligence/sweden/privacy/cybersäkerhetslagen-senaste-nytt-efter-sommaren
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854
- https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent
- https://claude.com/blog/ciso-guide-to-agentic-ai
- https://dora.dev/capabilities/streamlining-change-approval/
related:
- application.security.application-security
seed_version: 1
cross_refs:
  '9':
  - application.security.application-security
---

**When to use this:** When answering a security questionnaire, preparing audit evidence, or deciding who approves agent-written code.

**Source section:** 13. Customer trust requirements: buyers want verifiable SDLC evidence

### The expected baseline artefacts

**[PLATFORM CLAIM]** Anthropic points enterprise buyers of Claude Code to a trust centre holding its SOC 2 Type 2 report and ISO 27001 certificate, which shows these two artefacts are the expected baseline even for developer tooling ([Claude Code security docs](https://code.claude.com/docs/en/security)). **[INFERENCE]** The typical customer asks (an annual third-party penetration test, a SOC 2 Type II report covering 6 to 12 months, an ISO/IEC 27001:2022 certificate, and retest evidence) are industry convention and were not sourced in this research.

### SOC 2 is being revised

**[FAST-MOVING, Nov 2026; secondary source only]** An audit firm reports that the AICPA has an exposure draft of revised Trust Services Criteria out for comment, with final release expected in 2027 and the new criteria applying to reports issued after 31 December 2027; until then the current criteria apply ([Schellman, 6 Nov 2026](https://www.schellman.com/blog/soc-2-is-getting-an-update-what-the-revised-trust-services-criteria-mean-for-your-organization)). In the draft the common criteria are consolidated from 33 to 21, the former CC8 change-management area becomes three criteria (CC7.1 infrastructure, CC7.2 acquired software, CC7.3 internally developed software development and change management), incident response is consolidated, and logical access (formerly CC6, now CC5) stays largely the same, still covering authentication, authorisation, asset management, encryption, network security, vulnerabilities and malware ([Schellman, 6 Nov 2026](https://www.schellman.com/blog/soc-2-is-getting-an-update-what-the-revised-trust-services-criteria-mean-for-your-organization)).

**[FAST-MOVING, Nov 2026; secondary source only]** The SOC 2 exposure draft adds AI-specific points of focus: training-data manipulation, adversarial inputs, prompt manipulation, data poisoning, model misuse, and reliability and bias ([Schellman, 6 Nov 2026](https://www.schellman.com/blog/soc-2-is-getting-an-update-what-the-revised-trust-services-criteria-mean-for-your-organization)). **[INFERENCE]** A team starting SOC 2 readiness in late 2026 should document its software lifecycle and its AI-agent controls so that the evidence survives the renumbering; reports issued before 2028 still use the current criteria. **[GAP]** The AICPA criteria text itself was not opened, so criterion numbers rest on one auditor's reading of a draft.

### SSDF as the structure for secure-development evidence

**[INFERENCE]** A practical evidence pack for customer security questionnaires can be organised by the four SSDF groups (sourced in section 9): PO holds policy, roles, training and the secured toolchain; PS holds repository access control, signed or provenance-attested releases and the release archive; PW holds threat models, design review records, code review, scan results, test evidence and secure defaults; RV holds vulnerability intake, triage records, patch timelines and root-cause fixes. The group names come from NIST ([NIST SSDF project page, updated 6 Oct 2026](https://csrc.nist.gov/projects/ssdf)); the mapping of artefacts is the researchers'.

### The legally defined evidence pack for in-scope products

**[FAST-MOVING, applies from 11 Dec 2027; checked on primary source]** For products in scope of the Cyber Resilience Act, the regulation defines the evidence pack: technical documentation, a risk assessment, an SBOM, a coordinated vulnerability disclosure policy and a declared support period, retained for 10 years, and Annex I Part II(3) requires effective and regular tests and reviews of product security, which is the legal hook for periodic penetration testing ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). **[GAP]** No primary source on penetration-test frequency was read; neither SOC 2 nor ISO 27001 is recalled to set a fixed frequency and annual testing is a market convention, both unverified, and PCI DSS, OWASP WSTG, PTES and NIST SP 800-115 were not opened.

### Regulators and procurement ask about audits and jurisdiction

**[FAST-MOVING, 2026]** Swedish NIS2 implementing regulations add supervisory security audits and scans from 1 October 2026 plus documented management training (secondary source only: [Legal 500 Sweden](https://www.legal500.com/intelligence/sweden/privacy/cybersäkerhetslagen-senaste-nytt-efter-sommaren)), and the Data Act obliges SaaS providers to publish the jurisdiction of their infrastructure and their safeguards against third-country access, which procurement teams now ask about (checked on primary source: [EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

### Agent activity is auditable evidence, and vendor claims need checking

**[PLATFORM CLAIM]** Claude Code cloud sessions log all operations and usage can be exported through OpenTelemetry, and GitHub's coding agent signs its commits, co-attributes the human who started the session and links session logs ([Claude Code security docs](https://code.claude.com/docs/en/security); [GitHub Docs](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)). **[VENDOR]** Anthropic's guide for security leaders (17 July 2026) tells buyers to ask whether agent actions are distinguishable from user actions and reach the SIEM, and notes that one product's activity was not yet in formal audit logs, a reminder to verify vendor claims ([Anthropic CISO guide, 17 July 2026](https://claude.com/blog/ciso-guide-to-agentic-ai)).

### The evidence pack an agent-run department should produce on demand

**[INFERENCE]** An agent-run engineering department should be able to produce ten artefacts on demand: a lifecycle policy mapped to SSDF; a branch-protection or ruleset export proving human review on the default branch; pipeline logs for static analysis, composition analysis, secret scanning and tests per release; an SBOM per release; a vulnerability register with timestamps against the patch policy; the latest external penetration-test summary with remediation status; a change log linking each production deploy to an approved pull request and an approving human; agent session logs and permission configuration; incident-response and vulnerability-disclosure policies; and a sub-processor list that includes AI model providers.

### Segregation of duties when agents write the code

**[INFERENCE]** Auditors testing change-management controls ask who approved a change. If an AI agent both authors and approves, segregation of duties fails, so every production change keeps a named human approver. This fits DORA's position that peer review recorded in the development platform is the segregation-of-duties control ([DORA streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)). **[GAP]** No source was found on how auditors treat AI-authored code in SOC 2 or ISO audits beyond the draft AI points of focus, and ISO/IEC 27001:2022 Annex A control numbers (8.25 to 8.32 and 8.8 per unverified recollection) were not verified because the standard is paywalled.
