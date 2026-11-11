import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Stamps each build with an id (a hash of index.html, which names every hashed bundle) into index.html and
 * /version.json, so an open page can tell a newer HUD is live (web/src/lib/version.ts). The same source gives
 * the same id, so a deploy that changes nothing in the HUD shows no notice. */
function versionStamp(): Plugin {
  let outDir = "dist";
  return {
    name: "vaic-version-stamp",
    apply: "build",
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, "index.html");
      const html = readFileSync(file, "utf8");
      const version = createHash("sha256").update(html).digest("hex").slice(0, 16);
      writeFileSync(file, html.replace("</head>", `  <meta name="hud-version" content="${version}" />\n  </head>`));
      writeFileSync(path.join(outDir, "version.json"), JSON.stringify({ version }) + "\n");
    },
  };
}

export default defineConfig({
  plugins: [react(), versionStamp()],
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
