# ADR 0008: One policy gate for every agent, approvals bound to the exact action
**Status:** accepted
**Decision.** The upstream `decide()` and its rules, ported, plus deny rules for cloud mutation. It runs before every custom tool (wrapper) and every built-in tool (`canUseTool`), for workers too (setting, default on). "Ask" becomes deny-until-approved: an approval request bound to a hash of the exact tool + input, decided by the owner, consumed once. Owner approvals are separate items that workers can delete (consume) but never write.
**Consequences.** An approval can never unlock a deny rule, and an approved action can't be swapped for another.
