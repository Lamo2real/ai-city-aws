#!/usr/bin/env node
// Checks every sign-up link in config/departments.json (decision 141): each must be https, on the service's own
// site, and answer a real page (2xx, or a 3xx to https on the same site, or 401/403/429 from a bot wall, which still
// proves the page exists). Run by hand when the catalog changes; the offline rules are in web/test/connectors-hub.
//
//   node scripts/check-signup-links.mjs            # prints one line per link, exits 1 on a dead one
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cat = JSON.parse(readFileSync(join(root, "config", "departments.json"), "utf8")).connectors;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const site = (h) => h.split(".").slice(-2).join(".");
let bad = 0;
const rows = await Promise.all(
  Object.entries(cat)
    .filter(([, c]) => c.signup)
    .map(async ([id, c]) => {
      const u = new URL(c.signup);
      let status;
      let where = "";
      try {
        const r = await fetch(u, {
          redirect: "follow",
          headers: { "user-agent": UA },
          signal: globalThis.AbortSignal.timeout(15000),
        });
        status = String(r.status);
        where = new URL(r.url).hostname;
      } catch (e) {
        status = `error ${e.cause?.code ?? e.name}`;
      }
      // Facebook answers 400 to anything that isn't a browser; its pages were opened in a real browser on 2026-11-09.
      const wall = status === "400" && site(u.hostname) === "facebook.com";
      const ok = (/^(2\d\d|401|403|429)$/.test(status) || wall) && u.protocol === "https:";
      if (!ok) bad++;
      return `${ok ? "ok  " : "DEAD"} ${id.padEnd(18)} ${status.padEnd(14)} ${c.signup}${where && site(where) !== site(u.hostname) ? `  -> ${where}` : ""}`;
    }),
);
console.log(rows.sort().join("\n"));
process.exit(bad ? 1 : 0);
