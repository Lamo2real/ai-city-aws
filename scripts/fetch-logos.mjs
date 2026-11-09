#!/usr/bin/env node
// Builds the logos for Settings → Connectors (decision 129): one file per catalog service in web/public/logos/,
// served from the HUD's own origin so the CSP stays `img-src 'self'`. Run by hand when config/departments.json
// gains a service; the files are committed, nothing is fetched at build or run time.
//
//   node scripts/fetch-logos.mjs <path to an installed simple-icons package>
//
// 1. A simple-icons (CC0) SVG in the brand's colour when the service has one.
// 2. Otherwise the site's own favicon, fetched once and kept only if it is a real PNG under 64 KB.
// 3. Otherwise nothing: the HUD draws a lettered tile.
// Writes web/src/lib/logos.json: {id: "svg" | "png"}.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const siDir = process.argv[2];
if (!siDir) throw new Error("Usage: node scripts/fetch-logos.mjs <simple-icons package folder>");
const icons = JSON.parse(readFileSync(join(siDir, "data", "simple-icons.json"), "utf8"));
const list = Array.isArray(icons) ? icons : icons.icons;
const slugOf = (i) =>
  i.slug ??
  i.title
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/\./g, "dot")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
const bySlug = new Map(list.map((i) => [slugOf(i), i]));
const svgPath = (slug) => readFileSync(join(siDir, "icons", `${slug}.svg`), "utf8");

const cat = JSON.parse(readFileSync(join(root, "config", "departments.json"), "utf8")).connectors;
// Services shown outside the catalog: mail and calendar accounts, GitHub (Settings → GitHub).
const extra = { gmail: "google.com", google: "google.com", microsoft: "outlook.com", imap: "", "github-token": "" };
// When the id and label don't name the simple-icons slug, or the site isn't the server's domain.
const SLUG = {
  "cloudflare-docs": "cloudflare",
  "shopify-dev": "shopify",
  "shopify-store": "shopify",
  "google-analytics": "googleanalytics",
  bigquery: "googlebigquery",
  "meta-ads": "meta",
  "google-ads": "googleads",
  "help-scout": "helpscout",
  "hugging-face": "huggingface",
  "product-hunt": "producthunt",
  gmail: "gmail",
  google: "google",
  "github-token": "github",
  drawio: "diagramsdotnet",
};
const SITE = {
  "aws-knowledge": "aws.amazon.com",
  "microsoft-learn": "learn.microsoft.com",
  "product-hunt": "producthunt.com",
  context7: "context7.com",
  openalex: "openalex.org",
  github: "github.com",
  "meta-ads": "facebook.com",
  "google-ads": "ads.google.com",
  freshdesk: "freshworks.com",
};
const host = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};
const site = (id, c) =>
  SITE[id] ?? (c ? (host(c.signup ?? "") || host(c.url)).split(".").slice(-2).join(".") : extra[id]);

const out = join(root, "web", "public", "logos");
mkdirSync(out, { recursive: true });
const manifest = {};
const ids = [...Object.keys(cat), ...Object.keys(extra)];
for (const id of ids) {
  const c = cat[id];
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = [SLUG[id], norm(id), c && norm(c.label)].find((s) => s && bySlug.has(s));
  if (slug) {
    const hex = bySlug.get(slug).hex;
    // Very dark brand colours vanish on the dark theme; the tile behind the logo is light in both themes.
    const svg = svgPath(slug).replace("<svg ", `<svg fill="#${hex}" `);
    writeFileSync(join(out, `${id}.svg`), svg);
    manifest[id] = "svg";
    continue;
  }
  const domain = site(id, c);
  if (!domain) continue;
  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    const buf = Buffer.from(await r.arrayBuffer());
    const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // A 16 px globe is the service's "no icon" answer: keep only real, larger icons.
    const width = png ? buf.readUInt32BE(16) : 0;
    if (r.ok && png && width >= 32 && buf.length < 64 * 1024) {
      writeFileSync(join(out, `${id}.png`), buf);
      manifest[id] = "png";
    } else console.warn(`no logo for ${id} (${domain})`);
  } catch (e) {
    console.warn(`no logo for ${id}: ${e}`);
  }
}
writeFileSync(
  join(root, "web", "src", "lib", "logos.json"),
  JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + "\n",
);
console.log(`${Object.keys(manifest).length} of ${ids.length} logos`);
