// Bundles each Lambda entry point to dist/<name>/index.mjs (Node 24, arm64, ESM). Terraform zips
// each folder. The API bundle also carries agents/utility for the Haiku utility prompts.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ENTRIES = {
  api: "src/api.ts",
  dispatcher: "src/dispatcher.ts",
  factory: "src/factory.ts",
  "ledger-writer": "src/ledger-writer.ts",
  scheduler: "src/scheduler.ts",
  ws: "src/ws.ts",
  notifier: "src/notifier.ts",
  approvals: "src/approvals.ts",
};

rmSync(join(here, "dist"), { recursive: true, force: true });
for (const [name, entry] of Object.entries(ENTRIES)) {
  const out = join(here, "dist", name);
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: [join(here, entry)],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    outfile: join(out, "index.mjs"),
    banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
    logLevel: "warning",
  });
  if (name === "api")
    cpSync(join(here, "..", "..", "agents", "utility"), join(out, "agents", "utility"), { recursive: true });
}
console.log(`built ${Object.keys(ENTRIES).length} Lambda bundles`);
