// Writes the fingerprint of the sources behind the iPhone app's bundled City page, so a test can tell when
// web/src/city/ changed and the bundle (ios/AICity/CityWeb) was not rebuilt. Run by build:city-embed.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SOURCES = ["web/city-embed.html", "web/src/embed/city-embed.ts", "web/src/city/scene.js", "web/src/city/city-state.js", "web/vite.city-embed.config.ts"];
const repo = fileURLToPath(new URL("..", import.meta.url));
export function fingerprint() {
  const h = createHash("sha256");
  for (const f of SOURCES) h.update(f).update("\0").update(readFileSync(repo + f)).update("\0");
  return h.digest("hex");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(repo + "ios/AICity/CityWeb/city-embed.sources.txt", `${fingerprint()}\n`);
  console.log("city-embed sources fingerprint written");
}
