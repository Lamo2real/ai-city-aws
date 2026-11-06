# ADR 0007: The web app is the only public entry point
**Status:** accepted · replaces the Mac design's "no public port"
**Decision.** CloudFront (HTTPS only, CSP, WAF) serves the HUD; Cognito with MFA required and no self-sign-up is the only way in; every API route checks the `owner` group again in code; the WebSocket authorizes on `$connect` with the same token.
**Consequences.** See SECURITY.md for the threat model of a public login page.
