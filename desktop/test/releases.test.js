import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RELEASES_PAGE,
  isNewer,
  newestDesktop,
  parseVersion,
  shouldCheck,
  updateToOffer,
} from "../src/releases.js";

const rel = (n, extra = {}) => ({
  tag_name: `desktop-v1.0.${n}`,
  html_url: `https://github.com/Lamo2real/ai-city-aws/releases/tag/desktop-v1.0.${n}`,
  draft: false,
  prerelease: false,
  assets: ["mac-arm64.dmg", "mac-x64.dmg", "win-x64.exe"].map((s) => ({
    name: `VAIC-1.0.${n}-${s}`,
    browser_download_url: `https://github.com/Lamo2real/ai-city-aws/releases/download/desktop-v1.0.${n}/VAIC-1.0.${n}-${s}`,
  })),
  ...extra,
});

test("only a packaged Mac app checks; Windows updates itself and a run from source never checks", () => {
  assert.equal(shouldCheck("darwin", true), true);
  assert.equal(shouldCheck("darwin", false), false);
  assert.equal(shouldCheck("win32", true), false);
  assert.equal(shouldCheck("linux", true), false);
});

test("versions compare as numbers, not text", () => {
  assert.deepEqual(parseVersion("desktop-v1.0.12"), [1, 0, 12]);
  assert.deepEqual(parseVersion("1.0.6"), [1, 0, 6]);
  assert.equal(parseVersion("v1.0.6"), null);
  assert.equal(parseVersion("ios-v1.0.9"), null);
  assert.equal(parseVersion(undefined), null);
  assert.ok(isNewer("desktop-v1.0.10", "1.0.9"));
  assert.ok(isNewer("1.1.0", "1.0.99"));
  assert.ok(isNewer("2.0.0", "1.9.9"));
  assert.ok(!isNewer("1.0.6", "1.0.6"));
  assert.ok(!isNewer("1.0.5", "1.0.6"));
  assert.ok(!isNewer("garbage", "1.0.6"));
  assert.ok(!isNewer("1.0.7", "garbage"));
});

test("the newest desktop release wins, skipping drafts, pre-releases and other tags", () => {
  const list = [
    rel(9),
    rel(12, { draft: true }),
    rel(11, { prerelease: true }),
    { tag_name: "ios-v5.0.0", assets: [] },
    rel(10),
    null,
  ];
  assert.equal(newestDesktop(list, "arm64").version, "1.0.10");
  assert.equal(newestDesktop([], "arm64"), null);
  assert.equal(newestDesktop({ message: "rate limited" }, "arm64"), null);
});

test("the .dmg matches the Mac's chip, and falls back to the release page", () => {
  assert.match(newestDesktop([rel(7)], "arm64").dmg, /VAIC-1\.0\.7-mac-arm64\.dmg$/);
  assert.match(newestDesktop([rel(7)], "x64").dmg, /VAIC-1\.0\.7-mac-x64\.dmg$/);
  const noAssets = newestDesktop([rel(7, { assets: [] })], "arm64");
  assert.equal(noAssets.dmg, noAssets.page);
  assert.match(noAssets.page, /releases\/tag\/desktop-v1\.0\.7$/);
});

test("only github.com https links are ever opened", () => {
  const bad = rel(7, {
    html_url: "https://evil.example/x",
    assets: [{ name: "VAIC-1.0.7-mac-arm64.dmg", browser_download_url: "http://github.com/x.dmg" }],
  });
  const n = newestDesktop([bad], "arm64");
  assert.equal(n.page, RELEASES_PAGE);
  assert.equal(n.dmg, RELEASES_PAGE);
});

test("offers a newer release once a session; never the same or an older one", () => {
  assert.equal(updateToOffer([rel(7)], { running: "1.0.6", arch: "arm64" }).version, "1.0.7");
  assert.equal(updateToOffer([rel(6)], { running: "1.0.6", arch: "arm64" }), null);
  assert.equal(updateToOffer([rel(5)], { running: "1.0.6", arch: "arm64" }), null);
  assert.equal(updateToOffer([rel(7)], { running: "1.0.6", arch: "arm64", offered: "1.0.7" }), null);
  assert.equal(updateToOffer([rel(8)], { running: "1.0.6", arch: "arm64", offered: "1.0.7" }).version, "1.0.8");
});
