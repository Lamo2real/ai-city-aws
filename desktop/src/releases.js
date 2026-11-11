// The Mac app's "a new version is out" notice (docs/DESKTOP.md). The Mac app is not signed by Apple, so it cannot
// install updates itself; instead it checks GitHub Releases on start and once a day, and offers the right .dmg in the
// computer's browser. Windows updates itself (electron-updater in main.js) and never uses this. Pure functions, tested
// in test/releases.test.js.

export const RELEASES_API = "https://api.github.com/repos/Lamo2real/ai-city-aws/releases?per_page=30";
export const RELEASES_PAGE = "https://github.com/Lamo2real/ai-city-aws/releases/latest";
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
const TAG = /^desktop-v(\d+)\.(\d+)\.(\d+)$/;

/** Only a packaged Mac app checks: Windows updates itself, and a run from source has no real version. */
export function shouldCheck(platform, isPackaged) {
  return platform === "darwin" && isPackaged === true;
}

/** "1.0.7" or "desktop-v1.0.7" → [1, 0, 7]; anything else → null. */
export function parseVersion(v) {
  const m = TAG.exec(String(v ?? "").startsWith("desktop-v") ? String(v) : `desktop-v${v}`);
  return m ? m.slice(1).map(Number) : null;
}

/** True when `latest` is a higher version than `running` (both "x.y.z", tags allowed). */
export function isNewer(latest, running) {
  const a = parseVersion(latest);
  const b = parseVersion(running);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** Only links on github.com over https are opened from a release (never whatever a response might carry). */
function isGitHubLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "github.com";
  } catch {
    return false;
  }
}

/**
 * From the GitHub releases list: the newest published desktop release, as
 * { version, page, dmg } with dmg the .dmg for this Mac's chip ("arm64" or "x64"), or the release page when absent.
 * Returns null when there is none.
 */
export function newestDesktop(releases, arch) {
  if (!Array.isArray(releases)) return null;
  let best = null;
  for (const r of releases) {
    if (!r || r.draft || r.prerelease || !parseVersion(r.tag_name)) continue;
    if (best && !isNewer(r.tag_name, best.tag_name)) continue;
    best = r;
  }
  if (!best) return null;
  const version = parseVersion(best.tag_name).join(".");
  const page = isGitHubLink(best.html_url) ? best.html_url : RELEASES_PAGE;
  const suffix = `-mac-${arch === "arm64" ? "arm64" : "x64"}.dmg`;
  const asset = (best.assets ?? []).find((a) => typeof a?.name === "string" && a.name.endsWith(suffix));
  const dmg = asset && isGitHubLink(asset.browser_download_url) ? asset.browser_download_url : page;
  return { version, page, dmg };
}

/** What to offer, or null: a newer desktop release than the running app, not already offered this session. */
export function updateToOffer(releases, { running, arch, offered = null }) {
  const n = newestDesktop(releases, arch);
  if (!n || !isNewer(n.version, running) || n.version === offered) return null;
  return n;
}
