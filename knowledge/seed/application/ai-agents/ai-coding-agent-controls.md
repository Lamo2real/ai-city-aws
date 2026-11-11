---
id: application.ai-agents.ai-coding-agent-controls
department: application
domain: ai-agents
title: 'Application: AI coding agents: the controls that published guidance agrees on'
summary: 'AI coding agents, the controls published guidance agrees on: the convergent control set, Five Eyes agentic AI guidance,
  NIST agent standards, GitHub''s agentic security principles, Anthropic''s guidance (instructions are advisory, harness rules
  deterministic), Claude Code permission modes, sandbox and cloud sessions, OpenAI Codex defaults, AGENTS.md, instruction
  files and MCP security rules.'
type: playbook
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- github
objectives:
- security
sources:
- https://www.aoshearman.com/en/insights/ao-shearman-on-data/cisa-and-asds-acsc-publish-joint-guidance-on-securing-agentic-ai-systems
- https://www.cyber.gov.au/sites/default/files/2026-05/careful_adoption_of_agentic_ai_services.pdf
- https://www.nist.gov/caisi/ai-agent-standards-initiative
- https://github.blog/ai-and-ml/github-copilot/how-githubs-agentic-security-principles-make-our-ai-agents-as-secure-as-possible/
- https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/security
- https://code.claude.com/docs/en/sandboxing
- https://developers.openai.com/codex/agent-approvals-security
- https://learn.chatgpt.com/docs/agent-approvals-security
- https://claude.com/blog/ciso-guide-to-agentic-ai
- https://agents.md/
- https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions
- https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
related:
- application.guardrails.agent-guardrails
seed_version: 1
cross_refs:
  '16':
  - application.guardrails.agent-guardrails
---

**When to use this:** When configuring coding agents, their sandbox, permissions, instruction files or MCP servers.

**Source section:** 15. AI coding agents: the controls that published guidance agrees on

### The convergent control set

**[INFERENCE]** GitHub, OpenSSF, the Five Eyes agencies, the NCSC, OWASP, Anthropic and OpenAI agree on a control set a department can adopt as policy: agents work on branches and open pull requests only; a human merges; network access is off or allow-listed; no production or pipeline secrets sit in the agent environment; each agent has its own identity and a short-lived token; every tool call is logged; and hard rules live in hooks, deny rules and branch protection, not in the instruction file. The individual sources follow in this section.

### Five Eyes guidance on agentic AI (1 May 2026)

**[FAST-MOVING, May 2026; secondary summary of public-body guidance]** CISA, the NSA and Australia's ASD ACSC, with the cyber authorities of Canada, New Zealand and the United Kingdom, published "Careful Adoption of Agentic Artificial Intelligence (AI) Services" on 1 May 2026; it was read through a law-firm summary and the official PDF was not opened ([A&O Shearman, 20 May 2026](https://www.aoshearman.com/en/insights/ao-shearman-on-data/cisa-and-asds-acsc-publish-joint-guidance-on-securing-agentic-ai-systems); [official PDF, not opened](https://www.cyber.gov.au/sites/default/files/2026-05/careful_adoption_of_agentic_ai_services.pdf)). The risk categories it names are weaknesses inherited from the underlying model (prompt injection, data poisoning), a larger attack surface from tools, memory and integrations, complexity that causes cascading failures, privilege and identity risk from over-permissioned agents, and reduced accountability and visibility ([A&O Shearman, 20 May 2026](https://www.aoshearman.com/en/insights/ao-shearman-on-data/cisa-and-asds-acsc-publish-joint-guidance-on-securing-agentic-ai-systems)).

**[FAST-MOVING, May 2026; secondary summary of public-body guidance]** The Five Eyes guidance of 1 May 2026 recommends starting with low-risk, non-sensitive tasks and widening autonomy only as controls mature, least-privilege access by design, a distinct identity per agent with continuous authentication, testing and red-teaming through the lifecycle, continuous logging of agent behaviour and tool use, human oversight of high-impact or irreversible actions, and planning for unexpected behaviour while favouring reversibility and containment over efficiency ([A&O Shearman, 20 May 2026](https://www.aoshearman.com/en/insights/ao-shearman-on-data/cisa-and-asds-acsc-publish-joint-guidance-on-securing-agentic-ai-systems)).

### NIST's agent standards work

**[FAST-MOVING, Nov 2026]** NIST launched an AI Agent Standards Initiative on 17 February 2026 (page updated 9 November 2026) with a request for information on agent security, a draft concept paper on software and agent identity and authorisation, and sector listening sessions ([NIST CAISI](https://www.nist.gov/caisi/ai-agent-standards-initiative)). No finished NIST control set for coding agents was confirmed.

### GitHub's agentic security principles

**[VENDOR]** GitHub's agentic security principles (25 November 2025) target three threats: data exfiltration, unclear attribution, and prompt injection through issues or repository files. Its six rules are to show all context and strip hidden Unicode or HTML before the agent sees it, firewall the agent's network access, withhold pipeline secrets and other repositories by default and revoke the agent token at session end, allow no irreversible change without a human (the agent can only open pull requests and never push to the default branch), give the agent a separate identity for clear attribution, and accept instructions only from users with write access. A person reviews and merges agent pull requests, and the pipeline on those pull requests does not run until a person starts it ([GitHub Blog, 25 Nov 2025](https://github.blog/ai-and-ml/github-copilot/how-githubs-agentic-security-principles-make-our-ai-agents-as-secure-as-possible/)).

**[PLATFORM CLAIM]** GitHub's documentation for the Copilot cloud agent says it pushes only to its own `copilot/` branch or the pull-request branch, that Actions workflows on its pull requests wait for approval by a user with write access, that it has no access to organisation or repository Actions secrets (only a dedicated `copilot` environment), that a firewall against exfiltration is on by default, and that its commits are signed and co-attributed with session logs ([GitHub Docs](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)). The page was read in November 2026.

### Anthropic: instructions are advisory, harness rules are deterministic

**[VENDOR]** Anthropic's Claude Code best-practices page (read 11 November 2026) draws the central distinction: instructions the model reads (prompt, CLAUDE.md, skills) are non-deterministic and usually but not always followed, while rules the harness enforces (hooks, deny rules, managed settings, branch protection) apply every time. Anything that must always or never happen therefore belongs in a hook, deny rule or managed setting. Deny rules hold in every permission mode, including auto and bypass modes, and side-effecting workflows such as a release can be made invocable only by a human (`disable-model-invocation: true`) ([Claude Code best practices](https://code.claude.com/docs/en/best-practices)).

### Anthropic: verification and review practice

**[VENDOR]** Anthropic's best-practices page (read 11 November 2026) advises giving the agent a pass or fail check (a test, a build exit code, a linter, a screenshot comparison) and asking for evidence, meaning the command and its output, enforced with a Stop hook that returns exit code 2 until the check passes. Review should be done by a fresh subagent that did not see the conversation, and reviewers should be told to skip style, because fixing every finding adds needless abstraction ([Claude Code best practices](https://code.claude.com/docs/en/best-practices)).

### Claude Code permission modes and the working-directory boundary

**[PLATFORM CLAIM; FAST-MOVING, Nov 2026]** Per Claude Code's security documentation as read on 11 November 2026, interactive sessions now start in auto mode, where a separate classifier model reviews risky actions and explicit ask and deny rules still apply; manual mode starts read-only and asks before edits and commands; and organisations can disable auto mode. The working-directory boundary is only a prompt, so an approved shell command can still write anywhere the user can, which makes OS-level sandboxing the stronger control ([Claude Code security](https://code.claude.com/docs/en/security)). **[INFERENCE]** Auto-approval modes that rely on a classifier model are themselves non-deterministic, so they do not replace deny rules and branch protection for actions that must never happen.

### Claude Code sandbox: what it covers and its limits

**[PLATFORM CLAIM; FAST-MOVING, Nov 2026]** Claude Code's sandbox is off by default; when enabled it uses Seatbelt on macOS or bubblewrap on Linux and WSL2, restricts writes to the working directory, and routes network traffic through a proxy with an initially empty domain allowlist that refuses link-local addresses such as 169.254.169.254. Its limits are that it covers shell commands only and not file tools, WebFetch, MCP servers or hooks; that reads are broad by default, so `~/.ssh` and `~/.aws/credentials` stay readable unless `denyRead` is set; that `failIfUnavailable: true` and `allowUnsandboxedCommands: false` are needed to prevent silent fallback; and that broad `excludedCommands` such as `docker *` defeat it. Agent configuration paths (`.claude/settings*`, hooks, `.mcp.json`, `.git/hooks`, shell rc files) are write-protected inside the sandbox so the agent cannot grant itself permissions ([Claude Code sandboxing](https://code.claude.com/docs/en/sandboxing); [Claude Code security](https://code.claude.com/docs/en/security)).

**[INFERENCE]** Enabling the Claude Code sandbox is not enough by default: add `denyRead` for home-directory credential stores, an explicit domain allowlist and the fail-closed flags, and run the whole agent in a container or virtual machine for stronger isolation, because MCP servers and file tools sit outside that sandbox.

### Claude Code cloud sessions and team practice

**[PLATFORM CLAIM; FAST-MOVING, Nov 2026]** Claude Code cloud sessions run one isolated virtual machine per session with network limited by default and configurable to off or an allow-list; GitHub credentials never enter the machine because a proxy attaches them; the Git proxy rejects branch deletions and non-branch pushes; repository branch protection still decides what can be updated, and a rule that the connected access can bypass does not stop the agent; and all operations are logged. The team practices listed are managed settings for organisation policy, approved permission configurations in version control, usage monitoring through OpenTelemetry, hooks to audit or block settings changes, and dev containers or virtual machines for extra isolation. A non-interactive `-p` run shows no workspace-trust prompt and skips project MCP approval, so pipeline use needs its own controls ([Claude Code security](https://code.claude.com/docs/en/security)).

### OpenAI Codex defaults

**[PLATFORM CLAIM; FAST-MOVING, Nov 2026]** OpenAI's Codex documentation as read on 11 November 2026 sets network access off by default; in version-controlled folders it uses a workspace-write sandbox with on-request approvals (edits and commands inside the workspace run automatically, anything outside it or needing network asks), and in folders without version control it is read-only. Inside a writable workspace `.git`, `.agents`, `.codex` and `.aws` are kept read-only recursively, `danger-full-access` removes both sandbox and approvals and is discouraged, enabling network or web search exposes the agent to prompt injection because web results are untrusted, and enterprise administrators can enforce settings through managed configuration ([Codex agent approvals and security](https://developers.openai.com/codex/agent-approvals-security)). An earlier read of the same documentation adds that approval is needed for MCP and app tools annotated as destructive, that cloud runs go offline in the agent phase after set-up, and that an auto-review agent can handle approvals and fails closed ([Codex approvals and security, earlier URL](https://learn.chatgpt.com/docs/agent-approvals-security)).

### Anthropic's guide for security leaders

**[VENDOR]** Anthropic's guide of 17 July 2026 poses four assessment questions: what untrusted content can reach the agent, what it can do and as whom, what the blast radius is, and what is observable. Its controls are least agency, keeping credentials worth stealing out of the agent's environment and injecting them through a proxy, per-action (verb-level) tool permissions such as draft but not send and read but not delete, human review for destructive or one-way actions, egress allowlisting (described as the strongest control against injection-driven exfiltration), an organisation-wide kill switch, not relying on prompt scaffolds as controls, and governing agents like staff with identity, least privilege, monitoring and fast insider-risk response ([Anthropic CISO guide, 17 July 2026](https://claude.com/blog/ciso-guide-to-agentic-ai)).

### AGENTS.md as the shared instruction-file convention

**[FAST-MOVING, Nov 2026]** AGENTS.md is an open Markdown convention described as a README for agents, stewarded by the Agentic AI Foundation under the Linux Foundation and used by more than 60,000 open-source projects. Typical content is a project overview, build and test commands, code style, testing, security considerations and commit or pull-request rules; nested files are allowed, the nearest file wins, and explicit user prompts override it. It is supported by Codex, Cursor, the Copilot coding agent, Gemini CLI, Jules, Devin, Windsurf, Zed, VS Code and others ([agents.md](https://agents.md/)).

### What belongs in an instruction file

**[VENDOR]** Anthropic's best-practices page (read 11 November 2026) says CLAUDE.md should hold only what cannot be found by reading the repository: exact test, typecheck and lint commands, misleading code areas, decisions not recorded in the repository, and anything corrected twice. The memory guide recommends staying under 200 lines, path-scoped rules go in `.claude/rules/`, and team procedures go in skills, which load on demand ([Claude Code best practices](https://code.claude.com/docs/en/best-practices)).

**[DURABLE]** OpenSSF's Security-Focused Guide for AI Code Assistant Instructions (1 August 2025) keeps the developer accountable and puts AI-written code through the same review, testing and static analysis as human code. Its suggested instruction content is parameterised queries and input validation, no secrets in code, standard authentication libraries, no personal data in logs, safe defaults, negative tests for security-critical functions, confirming that a suggested package actually exists, pinned versions, and container images pinned by digest and run as non-root ([OpenSSF guide, 1 Aug 2025](https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions)).

**[DURABLE]** The OpenSSF guide (1 August 2025) carries four caveats: keep instructions short and specific, since pasting the whole sample set makes assistants add irrelevant defensive code; persona prompts such as asking the assistant to act as a security expert are not recommended because some experiments found them worse; asking the assistant to critique and then revise its output reduced weakness density in one study; and the recommendations are preliminary ([OpenSSF guide, 1 Aug 2025](https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions)).

**[INFERENCE]** The department's instruction file (AGENTS.md or CLAUDE.md) should hold the exact build, test and lint commands, the definition of done (tests and scans green), the forbidden-actions list from section 16, the dependency and licence policy, the secrets rule (never read `.env`, never print or commit secrets), the data rule (no production or personal data in prompts), how to ask for approval, and pointers to deeper documents instead of long prose. Keep it short, exclude generic security boilerplate, and treat it as guidance for behaviour, because injected content can override instruction text. Instruction files and MCP configurations are themselves attack surface, since a malicious pull request can change them, so they sit under CODEOWNERS with mandatory human review.

### MCP security rules

**[FAST-MOVING, spec revision 2025-06-18]** The Model Context Protocol security best practices (revision 2025-06-18, which cross-links the 2025-11-25 revision) forbid token passthrough, so servers must not accept tokens not issued for them. Proxy servers must implement per-client consent, exact redirect-URI matching and a single-use short-lived OAuth `state` value to stop confused-deputy attacks. Servers must verify every request, must not use sessions for authentication and must use non-guessable session IDs. For local servers, clients must show the exact full command and get explicit consent before a one-click install and should sandbox servers with minimal filesystem and network rights, preferring stdio transport or authenticated local HTTP. Clients must validate authorisation URLs (http and https only), must not open them through a shell, and should block private IP ranges during OAuth discovery ([MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)).

**[PLATFORM CLAIM]** A project's `.mcp.json` does not show every server a Claude Code session can load, because user-scope servers, connectors and plugins add more; organisations can restrict servers through managed MCP configuration ([Claude Code security docs](https://code.claude.com/docs/en/security)). **[GAP]** The 2025-11-25 specification revision, any 2026 revision, and write-ups of real MCP incidents such as tool poisoning were not read.
