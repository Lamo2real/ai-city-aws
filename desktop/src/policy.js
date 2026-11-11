// What the desktop window may do. Pure functions, so they are tested without Electron (test/policy.test.js).
//
// The app is a locked-down window onto the live HUD. It holds no secret: only the HUD's address. Signing in is the
// same Cognito email, password and authenticator code as in the browser, checked by the backend.

/** The live HUD. A packaged app always uses this; VAIC_DESKTOP_URL only works when running from source. */
export const APP_URL = "https://d2lcjbjaz1khxz.cloudfront.net/";

/** The address to load: the live HUD, or (from source only) an https or localhost override for testing. */
export function appUrl(isPackaged, override) {
  if (isPackaged || !override) return APP_URL;
  const u = parse(override);
  if (!u) return APP_URL;
  const local = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  return u.protocol === "https:" || local ? u.origin + "/" : APP_URL;
}

function parse(s) {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/** True when `url` is a page of the HUD itself (same origin as `app`). */
export function isAppPage(url, app = APP_URL) {
  const u = parse(url);
  return !!u && u.origin === new URL(app).origin;
}

/** Only http(s) and mailto links are handed to the computer's browser or mail app; never file:, smb:, custom schemes. */
export function isExternalSafe(url) {
  const u = parse(url);
  return !!u && (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:");
}

/**
 * A link or button that opens a new window (target=_blank, window.open):
 * - "about:blank" is how the HUD starts a connector or mailbox sign-in (ConnectCard.openSignIn): it opens a sign-in
 *   window inside the app, which then goes to the provider and comes back to the HUD, like a browser tab.
 * - a HUD page opens in a new app window;
 * - anything else opens in the computer's own browser.
 * Returns "window", "external" or "deny".
 */
export function newWindowAction(url, app = APP_URL) {
  if (url === "about:blank" || isAppPage(url, app)) return "window";
  return isExternalSafe(url) ? "external" : "deny";
}

/**
 * Navigation inside a window. The main window stays on the HUD: any other address goes to the browser instead
 * (a file download link included, where the browser saves it). A sign-in window may visit the provider's https pages.
 * Returns "allow", "external" or "deny".
 */
export function navigateAction(url, { signIn = false, app = APP_URL } = {}) {
  if (isAppPage(url, app)) return "allow";
  const u = parse(url);
  if (signIn && u && u.protocol === "https:") return "allow";
  return isExternalSafe(url) ? "external" : "deny";
}

/** Browser permissions the HUD needs: the microphone (voice chat), copying to the clipboard, and full screen. */
const ALLOWED = new Set(["media", "clipboard-sanitized-write", "fullscreen"]);

/** A permission is granted only to HUD pages, never to a provider's sign-in page, and only microphone audio. */
export function permissionAllowed(permission, requestingUrl, details = {}, app = APP_URL) {
  if (!ALLOWED.has(permission) || !isAppPage(requestingUrl, app)) return false;
  if (permission === "media") {
    // Requests list mediaTypes; permission checks name one mediaType. Either way: audio only.
    const types = [...(details.mediaTypes ?? []), ...(details.mediaType ? [details.mediaType] : [])];
    return types.every((t) => t === "audio");
  }
  return true;
}

/** Electron's user agent without "Electron/x" and the app's name, so sign-in pages treat it as Chrome. */
export function plainUserAgent(ua) {
  return ua
    .replace(/\sElectron\/\S+/, "")
    .replace(/\sVAIC\/\S+/, "")
    .trim();
}
