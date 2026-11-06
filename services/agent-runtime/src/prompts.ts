// Prompts live in agents/**/*.md. This reads them and fills the {{placeholders}}. Values placed into
// a prompt are data from the ledger; braces in them are neutralised so they cannot add placeholders.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** agents/ next to the bundle in the image, or at the repo root in development and tests. */
export const AGENTS_DIR =
  process.env.AIC_AGENTS_DIR ??
  [join(here, "agents"), join(here, "..", "agents"), join(here, "..", "..", "..", "agents")].find((p) =>
    existsSync(p),
  ) ??
  join(here, "agents");

export interface Prompt {
  name: string;
  tools: string[];
  body: string;
}

export function parsePrompt(text: string): Prompt {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return { name: "", tools: [], body: text.trim() };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0)
      meta[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^"|"$/g, "");
  }
  return {
    name: meta.name ?? "",
    tools: (meta.tools ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    body: m[2]!.trim(),
  };
}

export function render(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] ?? "").replace(/\{\{|\}\}/g, ""));
}

export function loadPrompt(file: string, vars: Record<string, string> = {}): Prompt {
  const p = parsePrompt(readFileSync(join(AGENTS_DIR, file), "utf8"));
  return { ...p, body: render(p.body, vars) };
}

export function departmentTemplate(department: string): string {
  const key = department.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const file = existsSync(join(AGENTS_DIR, "departments", `${key}.md`))
    ? `departments/${key}.md`
    : "departments/default.md";
  return readFileSync(join(AGENTS_DIR, file), "utf8").trim();
}
