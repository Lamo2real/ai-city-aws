---
name: security-baseline
description: "Apply a security baseline to any code or infrastructure change: secrets, dependencies, least privilege."
---
# Security baseline

- No secrets in code, commits, logs, reports or screenshots. Scan with `gitleaks` before pushing when available.
- Dependencies: pinned, from official registries; run `npm audit`, `pip-audit` or `osv-scanner` and fix high and critical findings.
- Least privilege for every role, token and API key; short-lived credentials over long-lived ones.
- Validate and encode all input and output (OWASP Top 10); parameterised queries only.
- HTTPS everywhere; security headers (CSP, HSTS) on web apps.
- Log security-relevant events without personal data.
- Report what was checked, what was found and what is left.
