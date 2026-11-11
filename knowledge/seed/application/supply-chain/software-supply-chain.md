---
id: application.supply-chain.software-supply-chain
department: application
domain: supply-chain
title: 'Application: Software supply chain: the registry and the pipeline are now the attack surface'
summary: 'Software supply chain: OWASP A03, the Shai-Hulud, GlassWorm and s1ngularity attacks and the 2026 incident chronology,
  root causes, the minimum supply-chain control set, SLSA build levels, SBOMs under the Cyber Resilience Act, agent-specific
  supply-chain risks and open-source licence compliance.'
type: playbook
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- github
objectives:
- security
sources:
- https://top10.owasp.org/2025/0x00_2025-Introduction/
- https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/
- https://xygeni.io/?p=79254
- https://www.stepsecurity.io/blog/state-of-open-source-supply-chain-attacks
- https://patrowl.io/en/blog/owasp-top-10-2025-what-s-changed-and-the-2026-data
- https://slsa.dev/spec/v1.2/
- https://slsa.dev/spec/v1.2/build-track-basics
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847
- https://cycode.com/blog/owasp-top-10-agentic-applications/
- https://code.claude.com/docs/en/security
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853
- https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent
related:
- application.compliance.eu-regulation
- application.maintenance.maintenance-and-operations
seed_version: 1
cross_refs:
  '7':
  - application.maintenance.maintenance-and-operations
  '11':
  - application.compliance.eu-regulation
---

**When to use this:** When adding or updating a dependency, GitHub Action or MCP server, hardening a build, producing an SBOM or checking a licence.

**Source section:** 10. Software supply chain: the registry and the pipeline are now the attack surface

### Supply chain is OWASP category A03

**[FAST-MOVING, 2025 edition]** OWASP made Software Supply Chain Failures category A03 in its 2025 Top 10, spanning dependencies, build systems and distribution infrastructure ([OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/)).

### Shai-Hulud (September 2025) and npm's response

**[PLATFORM CLAIM]** GitHub was notified on 14 September 2025 of a self-replicating worm, Shai-Hulud, spreading through compromised npm maintainer accounts via malicious post-install scripts, and removed more than 500 compromised packages ([GitHub blog, 22 Sep 2025](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/)). **[VENDOR]** A security vendor counts about 700 malicious package versions; the figures differ because one counts packages and the other versions ([Xygeni](https://xygeni.io/?p=79254)).

**[PLATFORM CLAIM]** npm's announced response (22 September 2025) limits publishing to local publish with mandatory two-factor authentication, granular tokens with a seven-day lifetime, or trusted publishing; it deprecates classic tokens, plans to replace time-based one-time-password two-factor with FIDO-based two-factor, and removes the two-factor bypass for local publish. Trusted publishing through OIDC had become generally available in July 2025 ([GitHub blog, 22 Sep 2025](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/)). **[GAP]** The December 2025 npm changelog confirming classic-token revocation and token lifetime caps could not be opened, so exact current token limits are unverified.

### Shai-Hulud 2.0, GlassWorm and s1ngularity (late 2025)

**[VENDOR]** A vendor write-up describes three late-2025 attacks. Shai-Hulud 2.0 (November 2025) used a preinstall hook, installed the Bun runtime to dodge Node-focused monitoring, entered through a `pull_request_target` workflow, planted self-hosted runners, carried a destructive wiper and crossed into Maven Central through an automated mirror. GlassWorm (October 2025) hid executable code in invisible Unicode characters inside malicious VS Code and OpenVSX extensions, where human review cannot see it. The s1ngularity/Nx package invoked locally installed AI command-line tools (Claude, Gemini, Q) with permission-bypass flags and prompted them to hunt for wallets and credentials, turning developers' AI agents into the attack tool ([Xygeni](https://xygeni.io/?p=79254)).

### 2026 incident chronology

**[VENDOR]** StepSecurity's review of 22 August 2026, a vendor chronology and not a set of primary advisories, lists these 2026 incidents: on 19 to 24 March the "Team PCP" campaign poisoned Trivy Action (76 of 77 tags), Checkmarx KICS Action, telnyx and LiteLLM with a pipeline credential stealer; in March malicious axios releases 1.14.1 and 0.30.4 pulled a fake dependency that dropped a remote-access trojan, and the CanisterWorm npm worm appeared; in April and May "Mini Shai-Hulud" variants hit SAP-related, TanStack and AntV packages and intercom-client was hijacked; in June and July the "Miasma" worm planted workflows that exfiltrate secrets and reportedly targeted AI coding agents; and in August "ChainDrop" appeared on npm ([StepSecurity, 22 Aug 2026](https://www.stepsecurity.io/blog/state-of-open-source-supply-chain-attacks)). The page contains an internal inconsistency (72 against 73 affected Microsoft repositories), and the primary advisories were not opened.

### Scale indicators

**[VENDOR; relayed by a secondary source]** Sonatype is reported to have counted more than 454,600 new malicious open-source packages in 2025, up 75% year on year, with over 99% on npm, and further npm and PyPI waves in April and May 2026 are reported to have prompted an NHS England alert; a June 2026 Red Hat incident is also mentioned. These figures were relayed by a secondary source and not checked independently ([Patrowl, 29 June 2026](https://patrowl.io/en/blog/owasp-top-10-2025-what-s-changed-and-the-2026-data)).

### Recurring root causes and the lessons vendors draw

**[VENDOR]** StepSecurity (22 August 2026) names four recurring weaknesses: secrets present in pipelines and on developer machines, unpinned "latest" versions, open outbound network access from runners, and mutable GitHub Actions tags that a compromised maintainer can repoint. It argues that malicious code has usually already executed on a laptop or runner before production dependency scanning sees it ([StepSecurity, 22 Aug 2026](https://www.stepsecurity.io/blog/state-of-open-source-supply-chain-attacks)). Xygeni's lessons are to install strictly from lockfiles, minimise token scope, treat `pull_request_target` as high risk, audit self-hosted runners, scan source for unprintable Unicode, and filter egress on build and developer networks ([Xygeni](https://xygeni.io/?p=79254)).

### Minimum supply-chain control set

**[INFERENCE]** A minimum control set for a small SaaS team on GitHub and AWS follows from the incident lessons. Install from lockfiles only in the pipeline (`npm ci`, `pip --require-hashes` or `uv sync --locked`). Pin GitHub Actions to full commit SHAs and container images to digests. Disable or allowlist install scripts. Apply a cool-down before adopting freshly published versions (Renovate documents 14 days; see section 7), with security advisories exempt. Use OIDC federation from the pipeline to AWS and to registries, with no long-lived publish tokens. Generate a CycloneDX or SPDX SBOM per release and store it with the artifact. Sign container images and attach build provenance. Never use `pull_request_target` with a checkout of untrusted code. Put an egress allowlist on runners. Lockfile installs, OIDC, the `pull_request_target` rule and egress filtering are directly supported by the cited incident lessons; SHA pinning is supported by Renovate's guidance; the SBOM format choice is the researchers' judgement.

### SLSA build levels

**[FAST-MOVING, v1.2]** SLSA version 1.2 is the approved specification and has a Build track and a reintroduced Source track, with provenance and Verification Summary Attestations as the recommended attestation formats ([SLSA v1.2](https://slsa.dev/spec/v1.2/)). Build L0 gives no guarantees. Build L1 means provenance exists: a consistent build process whose platform automatically generates provenance (who built it, how, and the top-level inputs) and distributes it to consumers, which prevents mistakes but is trivial to forge. Build L2 means a hosted build platform generates and signs the provenance and consumers validate its authenticity, which protects against tampering after the build. Build L3 means a hardened platform where runs cannot influence each other and the signing secret is unreachable from user-defined build steps, which protects against tampering during the build, including by insiders or with stolen credentials ([SLSA v1.2 build track](https://slsa.dev/spec/v1.2/build-track-basics)).

**[INFERENCE]** SLSA Build L2 is reachable with a hosted pipeline that signs provenance (for example GitHub-hosted runners with artifact attestations), and L3 needs an isolated, hardened builder; whether any specific pipeline offering meets L3 was not verified. **[GAP]** The Source track level definitions, Sigstore and cosign, npm provenance, PyPI attestations, OpenSSF Scorecard and CISA's SBOM minimum elements were not read.

### SBOM and component due diligence under the Cyber Resilience Act

**[FAST-MOVING, applies in full from 11 Dec 2027; checked on primary source]** For products in scope, the Cyber Resilience Act's Annex I Part II(1) requires manufacturers to document components, including a software bill of materials in a commonly used machine-readable format covering at least top-level dependencies, and Article 13(5) and (6) require due diligence when integrating third-party components including open source, plus a duty to report vulnerabilities found in a component to its maintainer and to remediate them ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). Scope is covered in section 11.

### Agent-specific supply chain

**[VENDOR]** The vendor summary of OWASP's agentic risk ASI04 asks for signed components, verified provenance, an AI bill of materials and a software-composition policy applied before an agent loads a new component ([Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/)). **[PLATFORM CLAIM]** Anthropic states that it reviews directory connectors against listing criteria but does not security-audit or manage any MCP server, so a listed connector is not a vetted one ([Claude Code security docs](https://code.claude.com/docs/en/security)).

### Open-source licence compliance

**[DURABLE; checked on primary source]** The new Product Liability Directive does not apply to free and open-source software developed or supplied outside a commercial activity (Article 2(2)), so a company that ships such software commercially is the liable manufacturer ([Directive (EU) 2024/2853](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)). The Cyber Resilience Act creates a lighter open-source software steward role (Article 24: a documented cybersecurity policy, cooperation with authorities and limited reporting), while commercial integrators carry full manufacturer duties ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). **[PLATFORM CLAIM]** GitHub warns that its coding agent can produce output matching public code and asks for human review before merge ([GitHub Docs](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)).

**[INFERENCE; no primary licence source was read]** A licence policy for agents is to allowlist permissive licences (MIT, BSD, Apache-2.0, ISC), require human or legal approval for copyleft (GPL, AGPL, LGPL), source-available (SSPL, BUSL, Elastic) and unlicensed code, run a licence scanner in the pipeline, and enable the assistant vendor's public-code-match filter where one exists. AGPL matters specifically for SaaS because network use triggers source-offer duties. **[GAP]** No source was read on measured licence contamination in AI output or on the copyright status of AI-generated code in the EU or Sweden.
