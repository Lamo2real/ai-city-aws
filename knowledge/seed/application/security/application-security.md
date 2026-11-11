---
id: application.security.application-security
department: application
domain: security
title: 'Application: Application security: the 2025 OWASP lists, verified authentication rules and threat modelling'
summary: 'Application security: OWASP Top 10:2025, API Security Top 10, ASVS 5.0.0, the LLM and Agentic Top 10s, OAuth 2.0
  best current practice, scopes and sessions, NIST SP 800-63B-4 passwords, passkeys and session lifetimes, SSRF, threat modelling
  (four questions, STRIDE), NIST SSDF, security testing in the pipeline, vulnerability patch deadlines and secrets management.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- web
objectives:
- security
sources:
- https://top10.owasp.org/2025/0x00_2025-Introduction/
- https://patrowl.io/en/blog/owasp-top-10-2025-what-s-changed-and-the-2026-data
- https://api-security.owasp.org/editions/2023/en/0x11-t10/
- https://asvs.owasp.org/
- https://genai.owasp.org/llm-top-10/
- https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- https://cycode.com/blog/owasp-top-10-agentic-applications/
- https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/
- https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- https://pages.nist.gov/800-63-4/sp800-63b.html
- https://www.threatmodelingmanifesto.org/
- https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- https://www.thoughtworks.com/radar/techniques
- https://csrc.nist.gov/pubs/sp/800/218/final
- https://csrc.nist.gov/projects/ssdf
- https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent
- https://code.claude.com/docs/en/security
- https://www.cisa.gov/known-exploited-vulnerabilities
related:
- application.ai-agents.ai-coding-agent-controls
- application.ai-agents.ai-coding-agents-evidence-and-failure-modes
- application.supply-chain.software-supply-chain
seed_version: 1
cross_refs:
  '10':
  - application.supply-chain.software-supply-chain
  '14':
  - application.ai-agents.ai-coding-agents-evidence-and-failure-modes
  '15':
  - application.ai-agents.ai-coding-agent-controls
---

**When to use this:** When designing authentication, sessions or APIs, threat modelling, adding security tests, or prioritising vulnerabilities.

**Source section:** 9. Application security: the 2025 OWASP lists, verified authentication rules and threat modelling

### OWASP Top 10:2025 categories

**[FAST-MOVING, 2025 edition]** The OWASP Top 10:2025 is the current edition and lists A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, and A10 Mishandling of Exceptional Conditions ([OWASP Top 10:2025 Introduction](https://top10.owasp.org/2025/0x00_2025-Introduction/)). A secondary source dates the announcement to November 2025 and finalisation to January 2026; the OWASP page itself gave no date ([Patrowl, 29 June 2026](https://patrowl.io/en/blog/owasp-top-10-2025-what-s-changed-and-the-2026-data)).

### OWASP Top 10:2025: what changed from 2021 and the data behind it

**[FAST-MOVING, 2025 edition]** Compared with 2021, the 2025 list folds server-side request forgery into A01, raises Security Misconfiguration from fifth to second, widens the old vulnerable-components category into A03 covering dependencies, build systems and distribution infrastructure, drops Injection from third to fifth, adds A10 for improper error handling, logic errors and fail-open behaviour, and renames A09 to stress alerting. The data comes from contributors covering more than 2.8 million applications, with 589 CWEs in the dataset and 248 mapped to the ten categories; A03 and A09 were promoted by community survey and not by test data ([OWASP Top 10:2025 Introduction](https://top10.owasp.org/2025/0x00_2025-Introduction/)). **[INFERENCE]** A10 is a natural review focus for agent-written code, because agents often add broad exception handlers to make tests pass.

### OWASP API Security Top 10 (2023 edition)

**[FAST-MOVING, 2023 edition]** The OWASP API Security Top 10 site lists only the 2023 and 2019 editions, so 2023 is current. Its ten risks are API1 Broken Object Level Authorization (check permission on every access that takes an object ID), API2 Broken Authentication, API3 Broken Object Property Level Authorization (field-level read and write checks), API4 Unrestricted Resource Consumption (limits on compute, bandwidth and paid downstream calls), API5 Broken Function Level Authorization (admin against user functions), API6 Unrestricted Access to Sensitive Business Flows (automated abuse of a legitimate flow), API7 Server Side Request Forgery, API8 Security Misconfiguration, API9 Improper Inventory Management (undocumented, deprecated or debug endpoints and hosts) and API10 Unsafe Consumption of APIs (trusting third-party API data) ([OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/)).

### OWASP ASVS 5.0.0 as a verification and procurement baseline

**[FAST-MOVING, May 2025]** OWASP's Application Security Verification Standard is at stable version 5.0.0, released 30 May 2025. OWASP positions it as a metric of trust in a web application, as guidance for developers of security controls, as a procurement requirement that can be written into contracts, and as a test basis; requirements are cited in the form `v<version>-<chapter>.<section>.<requirement>`, for example `v5.0.0-1.2.5`, and machine-readable CSV and JSON lists are on the project's GitHub ([OWASP ASVS](https://asvs.owasp.org/)). **[INFERENCE]** Citing ASVS requirement IDs in penetration-test scopes and customer answers gives a version-stable way to say what was verified. **[GAP]** The ASVS 5.0 level definitions, chapter count and requirement count are not on the landing page; the researchers' recollection of about 350 requirements in 17 chapters at three levels is unverified.

### OWASP Top 10 for LLM Applications (2025 edition)

**[FAST-MOVING, 2025 edition]** The OWASP Top 10 for LLM Applications shows 2025 as its current list: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation and LLM10 Unbounded Consumption ([OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/)).

### OWASP Top 10 for Agentic Applications for 2026

**[FAST-MOVING, Dec 2025]** OWASP published its Top 10 for Agentic Applications for 2026 on 9 December 2025 after peer review by more than 100 experts, aimed at agents that plan, act and decide across workflows ([OWASP GenAI resource page](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)). **[VENDOR]** The ten risk names were read from a vendor summary and not from the OWASP PDF: ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory and Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation and ASI10 Rogue Agents ([Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)).

**[VENDOR]** The mitigation themes in that vendor summary of the OWASP agentic list are to separate instructions from retrieved content, require human confirmation for sensitive actions, give each agent its own identity with short-lived task-scoped credentials, use signed components and an AI bill of materials, run least-privilege sandboxes with default-deny egress, keep memory scoped or ephemeral, use mutual authentication between agents, add circuit breakers and separate development from production, show raw actions at approval time, and give every agent an owner, an expiry and a tested kill switch. "Least agency" means granting only the autonomy, tools and permissions the task needs ([Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)).

### OAuth: 2.1 is still a draft, so cite the 2.0 best current practice

**[FAST-MOVING, Oct 2026]** OAuth 2.1 is not yet an RFC. The latest text is draft-ietf-oauth-v2-1-17 dated 31 October 2026, an active Internet-Draft with a working-group milestone of submission to the IESG in December 2026. Its confirmed rules are that PKCE is required, the implicit grant and the resource-owner password grant are removed, redirect URIs are compared by strict string match (the loopback port may vary), and sender-constrained tokens (DPoP or mutual TLS) are recommended ([IETF datatracker](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)). **[INFERENCE]** Because OAuth 2.1 is still a draft, design documents should say "OAuth 2.0 per the RFC 9700 best current practice with the OAuth 2.1 profile" and not "OAuth 2.1 compliant".

### Scope and session design rules

**[DURABLE]** The Model Context Protocol security guidance (specification revision 2025-06-18) gives scope rules usable for any API: start with a minimal low-risk scope set, elevate incrementally, never publish wildcard or omnibus scopes, log elevation events with correlation IDs, and authorise on the server instead of trusting claimed scopes. Its session rules are never to use session IDs as authentication, to generate non-deterministic IDs with a secure random generator, and to bind session IDs to the user ID on the server; it points implementers to RFC 9700 and OAuth 2.1 with HTTPS for all OAuth URLs except loopback ([MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)).

### Passwords under NIST SP 800-63B-4

**[FAST-MOVING, Aug 2025]** NIST SP 800-63B-4 (page generated 26 August 2025, superseding the previous SP 800-63B) requires at least 15 characters when a password is the only factor and at least 8 when it is used only as part of multi-factor authentication, with at least 64 characters allowed and spaces and Unicode accepted. It rules out composition rules, periodic forced changes (change only on evidence of compromise), security questions and hints; it requires checking new passwords against a blocklist of breached, common and context-specific values, allowing paste and password managers, salted hashing, and a cap of 100 consecutive failed attempts per authenticator ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)). NIST binds US federal systems only and is a reference standard for a Swedish company.

### Passkeys and assurance levels under NIST SP 800-63B-4

**[FAST-MOVING, Aug 2025]** NIST SP 800-63B-4 (page generated 26 August 2025) allows syncable authenticators, its term for synced passkeys, at AAL1 and AAL2 and prohibits them at AAL3, which requires non-exportable keys. AAL2 needs two distinct factors or one multi-factor authenticator and the verifier must offer at least one phishing-resistant option; AAL3 requires phishing resistance and public-key proof of possession. Passwords, one-time passcodes, look-up secrets and out-of-band methods are not phishing-resistant ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

### Session lifetimes under NIST SP 800-63B-4

**[FAST-MOVING, Aug 2025]** NIST SP 800-63B-4 (page generated 26 August 2025) recommends an overall session timeout of at most 30 days at AAL1 and at most 24 hours overall with 1 hour of inactivity at AAL2, and requires at most 12 hours overall at AAL3 with 15 minutes of inactivity recommended ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

**[INFERENCE]** A defensible authentication baseline for a B2B SaaS drawn from SP 800-63B-4 is passkeys offered to every user, mandatory multi-factor authentication for admin and staff accounts, a 15-character minimum wherever password-only login remains, a breached-password blocklist, no rotation policy, and a 24-hour maximum session with a 1-hour idle timeout for sensitive areas.

### Server-side request forgery and URL handling

**[DURABLE]** The MCP security guidance (revision 2025-06-18) gives a server-side request forgery checklist that applies to any service fetching URLs: require HTTPS; block private ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16 including cloud metadata, fc00::/7 and fe80::/10); do not hand-roll IP parsing; validate every redirect hop; route through an egress proxy; and pin DNS between check and use. For URL handling it allows only http and https, rejects javascript:, data: and file: schemes, and forbids opening URLs through a shell ([MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)).

### Threat modelling: the four questions

**[DURABLE]** The Threat Modeling Manifesto frames threat modelling around four questions: what are we working on, what can go wrong, what are we going to do about it, and did we do a good enough job. Its values include finding and fixing design issues over checkbox compliance, people and collaboration over tools, and continuous refinement over a single delivery; its principles are to model early and often, fit the team's development practice, iterate over manageable parts of the system and judge by value to stakeholders ([Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/)).

### Threat modelling: anti-patterns

**[DURABLE]** The Threat Modeling Manifesto names four anti-patterns: the hero threat modeller (threat modelling is not a specialist-only skill), admiring the problem without producing fixes, over-focusing on one aspect, and assuming a single perfect diagram exists. Its positive patterns are a systematic approach, varied cross-functional viewpoints and field-tested techniques ([Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/)).

### Threat modelling: the four steps and STRIDE

**[DURABLE]** OWASP's Threat Modeling Cheat Sheet maps the four questions to four steps: model the system, usually with data-flow diagrams showing trust boundaries, data stores, processes and external entities; identify and rank threats by likelihood and impact; choose a response per threat and turn mitigations into security requirements; and review and validate with stakeholders. STRIDE pairs each threat with the property it violates: spoofing (authentication), tampering (integrity), repudiation (accountability), information disclosure (confidentiality), denial of service (availability) and elevation of privilege (authorisation) ([OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)).

### Threat modelling: responses and validation

**[DURABLE]** OWASP's cheat sheet gives four responses to a threat: mitigate, eliminate (remove the feature), transfer (document the residual risk and its owner) and accept. Its validation checklist is that the diagram matches the system, every threat has an agreed response, mitigations are testable, and the model is documented with restricted access; the model must be maintained as the system changes ([OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)). Thoughtworks Radar Volume 35 (November 2026) lists threat modelling in Adopt as a default ([Radar techniques, Vol 35](https://www.thoughtworks.com/radar/techniques)).

**[INFERENCE]** A lightweight routine for a product team is a 60-minute session per new feature or architecture change, one data-flow diagram, STRIDE applied at each trust-boundary crossing, each threat logged as a ticket with one of the four responses, and the model stored next to the design document. The steps are OWASP's; the time-box is the researchers'.

### NIST SSDF as the secure-development skeleton

**[DURABLE]** NIST SP 800-218, the Secure Software Development Framework version 1.1, was published in February 2022 and superseded a 2020 white paper ([NIST CSRC SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)). It groups practices into Prepare the Organization (PO), Protect the Software (PS), Produce Well-Secured Software (PW) and Respond to Vulnerabilities (RV); named examples on the project page are PO.5 secure development environments, PO.1.2 documenting security requirements for in-house software, PS.3.2 collecting and sharing provenance data for components, and PW.1.2 tracking security requirements, risks and design decisions. The project page, updated 6 October 2026, still presents version 1.1 as final ([NIST SSDF project page](https://csrc.nist.gov/projects/ssdf)). SP 800-218A is the finalised community profile for generative AI and dual-use foundation models and matters only if the company trains or fine-tunes models ([NIST SSDF project page](https://csrc.nist.gov/projects/ssdf)). **[GAP]** The researchers recall a draft version 1.2 from late 2025, but the project page does not mention it; its status is unverified.

### Security testing in the pipeline

**[PLATFORM CLAIM]** GitHub's cloud coding agent runs three checks on its own output before handing over, CodeQL static analysis, secret scanning and dependency analysis against known-vulnerable packages, and tries to fix what it finds ([GitHub Docs: Copilot coding agent](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)). Claude Code ships a `/security-review` command and a security-guidance plugin that reviews the agent's own changes ([Claude Code security docs](https://code.claude.com/docs/en/security)). Both pages were read in November 2026.

**[INFERENCE]** A pull-request gate set for an agent-heavy team, assembled from the sources in this document, is static analysis (with cross-site scripting and log-injection rules blocking, see section 14), secret scanning with push protection, software composition analysis plus a lockfile check, an infrastructure-as-code scan, a licence scan, unit and integration tests, and then human review. Dynamic testing and API fuzzing belong on a deployed preview or staging environment, nightly or before release. No single source prescribes this exact set.

### Vulnerability prioritisation and patch deadlines

**[DURABLE]** CISA's Known Exploited Vulnerabilities catalogue lists a CVE only when there is reliable evidence of active exploitation and a clear remediation action. US federal civilian agencies must remediate within set timeframes under Binding Operational Directive 22-01, and CISA recommends that every organisation write a requirement to address catalogue entries immediately into its vulnerability-management plan and use the catalogue as an input to prioritisation frameworks such as SSVC ([CISA KEV catalogue](https://www.cisa.gov/known-exploited-vulnerabilities)). **[FAST-MOVING, June 2026; secondary source]** A secondary source notes that the Trivy flaw CVE-2026-33634 was added to the catalogue only after exploitation, which illustrates why exploitation evidence matters more than CVSS alone ([Patrowl, 29 June 2026](https://patrowl.io/en/blog/owasp-top-10-2025-what-s-changed-and-the-2026-data)).

**[INFERENCE]** A workable internal patch policy anchored on those sources is to fix catalogue-listed or actively exploited vulnerabilities immediately, meaning within days, and other critical vulnerabilities within about 30 days. The 30-day figure is a convention and was not read at source, and no source read in the research sets deadlines for high or medium severities; confirm every tier against customer contracts and any ISO 27001 or SOC 2 commitments. **[GAP]** The exact deadlines in Binding Operational Directive 22-01 could not be opened (unverified recollection: two weeks for newly added entries), and PCI DSS patch requirements were not read.

### Secrets management

**[GAP]** No AWS source on secrets management (Secrets Manager rotation, OIDC federation from the pipeline to AWS in place of long-lived keys) was read. The direction is supported indirectly by npm's move to OIDC trusted publishing (section 10) and by the guidance that an agent's environment should hold no credential worth stealing (section 15).
