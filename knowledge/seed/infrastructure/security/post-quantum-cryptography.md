---
id: infrastructure.security.post-quantum-cryptography
department: infrastructure
domain: security
title: 'IT infrastructure: Post-quantum cryptography planning'
summary: The 2030 and 2035 post-quantum dates, the EU roadmap, and what to do in 2026 and 2027.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- security
- compliance
sources:
- https://csrc.nist.gov/pubs/ir/8547/final
- https://nvlpubs.nist.gov/nistpubs/ir/2026/NIST.IR.8547.pdf
- https://csrc.nist.gov/projects/post-quantum-cryptography
- https://digital-strategy.ec.europa.eu/en/library/coordinated-implementation-roadmap-transition-post-quantum-cryptography
- https://postquantum.com/quantum-policies/eu-pqc-roadmap/
- https://data.riksdagen.se/dokument/sfs-2025-1506.text
seed_version: 1
---

**When to use this:** When planning cryptography, key exchange or a post-quantum migration.

**Source section:** 16. Post-quantum cryptography planning

## 16. Post-quantum cryptography planning

### The dates: 2030 for key exchange, 2035 for everything

**[FAST-MOVING, 27 Oct 2026]** NIST IR 8547, Transition to Post-Quantum Cryptography Standards, was published as final on 27 October 2026. For digital signatures, ECDSA and RSA (112-bit strength and above) and EdDSA are deprecated after 2030 and disallowed after 2035. For key establishment, finite-field and elliptic-curve Diffie-Hellman and MQV are deprecated after 2030 and disallowed after 2035, and the text applies the same plan to all quantum-vulnerable key establishment including RSA ([NIST CSRC](https://csrc.nist.gov/pubs/ir/8547/final); [NIST IR 8547](https://nvlpubs.nist.gov/nistpubs/ir/2026/NIST.IR.8547.pdf)).

**[FAST-MOVING, 27 Oct 2026]** NIST IR 8547 supports US Executive Order 14412 (22 June 2026) and OMB Memorandum M-26-15 (24 June 2026). Under those, US federal high-value assets and high-impact systems adopt post-quantum key establishment by 31 December 2030 and post-quantum signatures by 31 December 2031, the overall federal target stays 2035, and agencies must support TLS 1.3 by 2 January 2030. The order and memorandum were read only as cited inside the NIST report ([NIST IR 8547](https://nvlpubs.nist.gov/nistpubs/ir/2026/NIST.IR.8547.pdf)).

**[FAST-MOVING, 27 Oct 2026]** On hybrids, NIST IR 8547 says a hybrid key exchange that combines an approved scheme with another is acceptable and can be FIPS 140-validated if at least one input is approved, and dual signatures must all verify; NIST expects hybrids to be temporary and will give hybrid TLS guidance in the next revision of SP 800-52. On symmetric cryptography, NIST does not plan to move away from AES, SHA-2 or SHA-3, and primitives with at least 128-bit classical security are considered adequate; some 112-bit items such as SHA-224 are disallowed in 2030 and SHA-1 is disallowed in validated modules after 2030. HQC is selected as an additional key-encapsulation mechanism and a FALCON-based signature standard is in development ([NIST IR 8547](https://nvlpubs.nist.gov/nistpubs/ir/2026/NIST.IR.8547.pdf)).

**[GAP: unverified background]** The NIST post-quantum standards are understood to be FIPS 203 (ML-KEM, key establishment), FIPS 204 (ML-DSA, signatures) and FIPS 205 (SLH-DSA, hash-based signatures), published 13 August 2024; not re-read ([NIST PQC project](https://csrc.nist.gov/projects/post-quantum-cryptography)).

### The EU roadmap

**[FAST-MOVING, 23 Jun 2025]** Checked on a Commission page: the EU Coordinated Implementation Roadmap for the transition to post-quantum cryptography was published on 23 June 2025 by the Member States with Commission support, as the first deliverable of the NIS Cooperation Group's work stream ([European Commission](https://digital-strategy.ec.europa.eu/en/library/coordinated-implementation-roadmap-transition-post-quantum-cryptography)). Secondary source only for the milestones: by the end of 2026 all Member States start transitioning (national plans, awareness, cryptographic inventories); high-risk use cases move to post-quantum cryptography no later than the end of 2030; and the transition is completed for as many systems as feasible by 2035. High-risk includes data whose compromise ten or more years later would still cause significant harm ([PostQuantum.com summary](https://postquantum.com/quantum-policies/eu-pqc-roadmap/)).

**[FAST-MOVING, 2026]** Checked on primary source. Cybersäkerhetslagen makes cryptography and, where needed, encryption a mandatory risk-management area, which is the Swedish legal hook for a cryptographic inventory ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)).

### What to do in 2026 and 2027

**[INFERENCE]** 2026 is the inventory-and-plan year, and nobody needs to remove RSA or elliptic-curve cryptography now. The practical deadline for a SaaS company is the end of 2030 for key exchange (TLS, VPN, SSH), because the EU high-risk date, the NIST deprecation date and the US federal high-value deadline all fall there; signatures (certificates, code signing, tokens) follow between the end of 2031 and 2035.

**[INFERENCE]** Actions for a SaaS company on AWS in 2026 and 2027: build a cryptographic inventory (TLS endpoints and libraries, certificates, KMS keys and algorithms, SSH, VPN, code signing, JWT signing, database and backup encryption, third-party SaaS); classify data by how long it must stay confidential, with anything that must stay secret past about 2035 exposed to harvest-now-decrypt-later and given priority; confirm every endpoint supports TLS 1.3 (a precondition for hybrid ML-KEM key exchange) and that no SHA-1 or 224-bit hashes remain; enable hybrid ML-KEM TLS where AWS services and client libraries support it, which is consistent with NIST's position on hybrids; make crypto-agility a design rule (no hard-coded algorithms, a central TLS policy); ask key vendors for their roadmap; and plan signature migration later. Customers in finance and the public sector are likely to start asking for a post-quantum plan in security questionnaires because of the 2030 date.

### Gaps in this section

**[GAP]** Not verified: current AWS service-by-service post-quantum support, Sweden's national plan or NCSC-SE guidance, the EU roadmap's milestone text in the original document, and a line-by-line comparison of the final IR 8547 with the 2024 draft. The RSA key-establishment row of the NIST table did not extract cleanly; its dates come from the report's prose.
