import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_URL,
  appUrl,
  isAppPage,
  navigateAction,
  newWindowAction,
  permissionAllowed,
  plainUserAgent,
} from "../src/policy.js";

const HUD = APP_URL + "#/ace";

test("a packaged app always loads the live HUD, whatever the environment says", () => {
  assert.equal(appUrl(true, "https://evil.example/"), APP_URL);
  assert.equal(appUrl(false, undefined), APP_URL);
  assert.equal(appUrl(false, "http://localhost:5173/x"), "http://localhost:5173/");
  assert.equal(appUrl(false, "http://evil.example/"), APP_URL);
  assert.equal(appUrl(false, "file:///etc/passwd"), APP_URL);
  assert.equal(appUrl(false, "not a url"), APP_URL);
});

test("only the HUD's own origin counts as the app", () => {
  assert.ok(isAppPage(HUD));
  assert.ok(isAppPage(APP_URL + "?connect=return"));
  assert.ok(!isAppPage("https://d2lcjbjaz1khxz.cloudfront.net.evil.example/"));
  assert.ok(!isAppPage("http://d2lcjbjaz1khxz.cloudfront.net/"));
  assert.ok(!isAppPage("file:///Users/x/"));
  assert.ok(!isAppPage("garbage"));
});

test("the main window stays on the HUD; other links go to the browser", () => {
  assert.equal(navigateAction(HUD), "allow");
  assert.equal(navigateAction("https://accounts.google.com/o/oauth2"), "external");
  assert.equal(navigateAction("https://vaic-prod-files.s3.amazonaws.com/a.pdf?X-Amz=1"), "external");
  assert.equal(navigateAction("mailto:a@b.c"), "external");
  assert.equal(navigateAction("file:///etc/hosts"), "deny");
  assert.equal(navigateAction("javascript:alert(1)"), "deny");
  assert.equal(navigateAction("smb://host/share"), "deny");
});

test("a sign-in window may visit the provider's https pages and come back, nothing else", () => {
  assert.equal(navigateAction("https://accounts.google.com/o/oauth2", { signIn: true }), "allow");
  assert.equal(navigateAction(APP_URL + "?connect=return", { signIn: true }), "allow");
  assert.equal(navigateAction("http://insecure.example/", { signIn: true }), "external");
  assert.equal(navigateAction("file:///etc/hosts", { signIn: true }), "deny");
});

test("new windows: sign-ins and HUD pages in the app, other links in the browser", () => {
  assert.equal(newWindowAction("about:blank"), "window");
  assert.equal(newWindowAction(HUD), "window");
  assert.equal(newWindowAction("https://github.com/settings/tokens"), "external");
  assert.equal(newWindowAction("file:///etc/hosts"), "deny");
  assert.equal(newWindowAction("vscode://open"), "deny");
});

test("the microphone and clipboard only for the HUD, never for a sign-in page", () => {
  assert.ok(permissionAllowed("media", HUD, { mediaTypes: ["audio"] }));
  assert.ok(permissionAllowed("media", HUD, {}));
  assert.ok(!permissionAllowed("media", HUD, { mediaTypes: ["audio", "video"] }));
  assert.ok(!permissionAllowed("media", HUD, { mediaType: "video" }));
  assert.ok(permissionAllowed("media", HUD, { mediaType: "audio" }));
  assert.ok(!permissionAllowed("media", "https://accounts.google.com/", { mediaTypes: ["audio"] }));
  assert.ok(permissionAllowed("clipboard-sanitized-write", HUD));
  assert.ok(!permissionAllowed("geolocation", HUD));
  assert.ok(!permissionAllowed("notifications", "https://evil.example/"));
  assert.ok(!permissionAllowed("openExternal", HUD));
});

test("the user agent reads as plain Chrome", () => {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) VAIC/1.0.3 Chrome/142.0.0.0 Electron/45.3.0 Safari/537.36";
  assert.equal(
    plainUserAgent(ua),
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  );
});
