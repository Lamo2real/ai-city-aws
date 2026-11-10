// The iPhone app shows the web HUD's own City scene from a bundled build (ios/AICity/CityWeb). This fails when
// web/src/city/ (or the embed page) changed and the bundle was not rebuilt, so the phone and the browser
// can't drift apart. Fix: npm run build:city-embed -w @vaic/web, then commit ios/AICity/CityWeb.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs helper without types
import { fingerprint } from "../scripts/city-embed-stamp.mjs";

describe("iPhone City bundle", () => {
  it("is built from the current City scene sources", () => {
    const stamped = readFileSync(
      new URL("../ios/AICity/CityWeb/city-embed.sources.txt", import.meta.url),
      "utf8",
    ).trim();
    expect(stamped, "Run: npm run build:city-embed -w @vaic/web").toBe(fingerprint());
  });
  it("has no network access and loads only its own script", () => {
    const html = readFileSync(new URL("../ios/AICity/CityWeb/city-embed.html", import.meta.url), "utf8");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html.match(/<script[^>]*src="([^"]+)"/g)).toEqual([expect.stringContaining('src="./city-embed.js"')]);
  });
});
