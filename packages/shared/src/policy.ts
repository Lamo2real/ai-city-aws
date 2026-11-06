// The policy gate, ported from upstream city/src/policy.ts. Called before every tool call of every
// agent. Workers are held by it too (policy_applies_to_workers, default true).
import { createHash } from "node:crypto";
import { POLICY_CONFIG } from "./config.ts";
import type { Role } from "./models.ts";

export type Decision = "allow" | "ask" | "deny";
export interface Rule {
  tool: string;
  match: string;
  decision: Decision;
  reason: string;
}
export interface Policy {
  policy_applies_to_workers: boolean;
  caps: { ad_daily_budget_cents: number };
  rules: Rule[];
}

export const loadPolicy = (): Policy => POLICY_CONFIG as Policy;
const BUDGET_KEYS = ["daily_budget", "lifetime_budget"] as const;

// Same text the upstream Python hook matched: JSON with sorted keys.
export function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(", ")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}: ${sortedJson(record[k])}`);
    return `{${entries.join(", ")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const compiled = new WeakMap<Rule, [RegExp, RegExp]>();
const regexes = (r: Rule): [RegExp, RegExp] => {
  let c = compiled.get(r);
  if (!c) compiled.set(r, (c = [new RegExp(r.tool), new RegExp(r.match)]));
  return c;
};

export function decide(
  toolName: string,
  toolInput: Record<string, unknown>,
  policy: Policy = loadPolicy(),
): [Decision, string] {
  const blob = sortedJson(toolInput);
  let found: [Decision, string] = ["allow", ""];
  for (const r of policy.rules) {
    const [tool, match] = regexes(r);
    if (tool.test(toolName) && match.test(blob)) {
      if (r.decision === "deny") return ["deny", r.reason];
      found = ["ask", r.reason];
    }
  }
  if (toolName.startsWith("mcp__meta-ads__")) {
    const cap = policy.caps.ad_daily_budget_cents;
    for (const k of BUDGET_KEYS) {
      const v = toolInput[k];
      if (v !== undefined && v !== null && Number(v) > cap)
        return ["ask", `${k} ${String(v)} is over the ${cap}-cent cap.`];
    }
  }
  return found;
}

/** Hash that binds an owner approval to one exact call. */
export const actionHash = (toolName: string, toolInput: Record<string, unknown>): string =>
  createHash("sha256")
    .update(`${toolName}\n${sortedJson(toolInput)}`)
    .digest("hex");

export interface GateContext {
  role: Role;
  agentId: string;
  /** Returns true once when an owner approval for this exact action exists, and consumes it. */
  consumeApproval?: (hash: string) => Promise<boolean>;
  policy?: Policy;
}
export interface GateResult {
  decision: "allow" | "deny";
  reason: string;
  /** Set when the call needs the owner: the caller files an approval bound to this hash. */
  needsApproval?: { hash: string; reason: string };
}

/** The gate as the runtime uses it: "ask" becomes deny-until-approved, bound to the exact action. */
export async function gate(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: GateContext,
): Promise<GateResult> {
  const policy = ctx.policy ?? loadPolicy();
  if (ctx.role === "worker" && !policy.policy_applies_to_workers)
    return { decision: "allow", reason: "policy off for workers" };
  const [d, reason] = decide(toolName, toolInput, policy);
  if (d === "allow") return { decision: "allow", reason: "" };
  if (d === "deny") return { decision: "deny", reason };
  const hash = actionHash(toolName, toolInput);
  if (ctx.consumeApproval && (await ctx.consumeApproval(hash)))
    return { decision: "allow", reason: `approved by the owner: ${reason}` };
  return {
    decision: "deny",
    reason: `Needs the owner's approval: ${reason} Ask for it with ask_owner; the exact action will be approved or refused.`,
    needsApproval: { hash, reason },
  };
}
