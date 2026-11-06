# ADR 0005: Global inference profiles, one application profile per role
**Status:** accepted (verify at deploy)
**Decision.** Call models through `global.` profiles (cheapest, and the only way to reach Fable from Europe), wrapped in one tagged application inference profile per role (`aic-ace`, `aic-orchestrator`, `aic-manager`, `aic-worker`, `aic-utility`) so the bill splits by role. The prefix is one setting; `eu.` makes Fable roles use Opus 5.5.
**Consequences.** Prompts may be processed outside the EU (owner's choice). If AWS refuses an application profile copied from a global profile, `use_application_inference_profiles = false` falls back to the global profiles and the ledger carries per-role cost.
