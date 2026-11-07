#!/usr/bin/env node
// Static tag check over the Terraform HCL: every taggable resource carries the Component tag (and
// AgentRole on runtimes, inference profiles and agent memory), and every provider sets the six
// default cost-allocation tags. Taggable types come from the provider schema (taggable-resources.json).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INFRA = join(ROOT, "infra");
export const BASE_TAGS = ["Project", "App", "Environment", "Owner", "ManagedBy", "CostCenter"];
export const COMPONENTS = [
  "frontend",
  "api",
  "agents",
  "ledger",
  "bus",
  "observability",
  "security",
  "storage",
  "budgets",
  "apps",
];
export const AGENT_ROLE_TYPES = [
  "aws_bedrockagentcore_agent_runtime",
  "aws_bedrock_inference_profile",
  "aws_bedrockagentcore_memory",
];

export function tfFiles(dir = INFRA) {
  const out = [];
  for (const n of readdirSync(dir)) {
    if (n === ".terraform" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...tfFiles(p));
    else if (n.endsWith(".tf")) out.push(p);
  }
  return out;
}

/** Top-level blocks of one kind, with their bodies, found by brace matching (strings respected). */
export function blocks(text, kind) {
  const out = [];
  const re = new RegExp(`^${kind}\\s+((?:"[^"]*"\\s*)+)\\{`, "gm");
  let m;
  while ((m = re.exec(text))) {
    const labels = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    let depth = 1,
      i = re.lastIndex,
      inStr = false;
    for (; i < text.length && depth; i++) {
      const c = text[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    out.push({ labels, body: text.slice(re.lastIndex, i - 1) });
  }
  return out;
}

export function checkTags({
  files = tfFiles(),
  list = JSON.parse(readFileSync(join(ROOT, "scripts", "taggable-resources.json"), "utf8")),
} = {}) {
  const problems = [];
  const taggable = new Set(list.taggable);
  const known = new Set([...list.taggable, ...list.untaggable]);
  let checked = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const rel = relative(ROOT, f);
    const localsTags = /locals\s*\{[\s\S]*?\btags\s*=\s*\{\s*Component\s*=\s*"(\w+)"/.exec(text)?.[1] ?? null;
    if (localsTags && !COMPONENTS.includes(localsTags))
      problems.push(`${rel}: Component "${localsTags}" is not one of ${COMPONENTS.join(", ")}`);
    for (const p of blocks(text, "provider")) {
      if (p.labels[0] !== "aws") continue;
      for (const t of BASE_TAGS)
        if (!new RegExp(`\\b${t}\\b`).test(p.body) && !/tags\s*=\s*local\.base_tags/.test(p.body))
          problems.push(`${rel}: provider aws is missing default tag ${t}`);
    }
    for (const r of blocks(text, "resource")) {
      const [type, name] = r.labels;
      if (!known.has(type))
        problems.push(`${rel}: ${type}.${name} is not in scripts/taggable-resources.json; classify it`);
      if (!taggable.has(type)) continue;
      checked++;
      const tags = /^\s*tags\s*=\s*(.+)$/m.exec(r.body)?.[1] ?? "";
      const hasComponent = /Component\s*=/.test(tags) || (/local\.tags/.test(tags) && localsTags);
      if (!hasComponent) problems.push(`${rel}: ${type}.${name} has no Component tag`);
      if (AGENT_ROLE_TYPES.includes(type) && !/AgentRole\s*=/.test(tags))
        problems.push(`${rel}: ${type}.${name} has no AgentRole tag`);
    }
  }
  // The six base tags must come from somewhere for every resource: the prod root's providers.
  const envs = files
    .filter((f) => /envs\/prod\/main\.tf$/.test(f))
    .map((f) => readFileSync(f, "utf8"));
  for (const t of BASE_TAGS)
    if (!envs.every((e) => new RegExp(`\\b${t}\\s*=`).test(e)))
      problems.push(`default tag ${t} is not set in every root`);
  return { problems, checked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, checked } = checkTags();
  if (problems.length) {
    console.error(`Tag check failed (${problems.length}):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(
    `Tag check passed: ${checked} taggable resources carry Component (and AgentRole where needed); providers set ${BASE_TAGS.join(", ")}.`,
  );
}
