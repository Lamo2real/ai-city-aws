// "A new version of VAIC is ready" (decision in docs/DECISIONS.md). Each build stamps its id into index.html
// (<meta name="hud-version">) and into /version.json, served with no-cache. The page compares the two now and
// then; when they differ a newer HUD is live and the owner gets one Reload button. It never reloads by itself.

export const CHECK_EVERY_MS = 5 * 60_000; // every few minutes while open
export const MIN_GAP_MS = 60_000; // focus and visibility checks no more than once a minute

/** The id of the HUD this page loaded, or null in development (no stamp, no checks). */
export function loadedVersion(doc: Document = document): string | null {
  const v = doc.querySelector('meta[name="hud-version"]')?.getAttribute("content")?.trim();
  return v ? v : null;
}

/** The id of the HUD that is live now, or null when it can't be read (offline, dev server, odd answer). */
export async function liveVersion(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const body = (await r.json()) as { version?: unknown };
    return typeof body.version === "string" && body.version ? body.version : null;
  } catch {
    return null;
  }
}

export function isNewer(loaded: string | null, live: string | null): boolean {
  return !!loaded && !!live && loaded !== live;
}

/** Checks now, on focus or when the page shows again, and every few minutes; calls onNew once. Returns a stop. */
export function watchVersion(
  onNew: () => void,
  opts: { loaded?: string | null; fetchFn?: typeof fetch; now?: () => number } = {},
): () => void {
  const loaded = opts.loaded === undefined ? loadedVersion() : opts.loaded;
  if (!loaded) return () => undefined;
  const now = opts.now ?? Date.now;
  let last = -Infinity;
  let done = false;
  let busy = false;
  const check = async (force = false) => {
    if (done || busy || (!force && now() - last < MIN_GAP_MS)) return;
    busy = true;
    last = now();
    try {
      if (isNewer(loaded, await liveVersion(opts.fetchFn))) {
        if (done) return;
        done = true;
        onNew();
      }
    } finally {
      busy = false;
    }
  };
  const onShow = () => {
    if (document.visibilityState === "visible") void check();
  };
  const onFocus = () => void check();
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") void check(true);
  }, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", onShow);
  window.addEventListener("focus", onFocus);
  void check(true);
  return () => {
    done = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onShow);
    window.removeEventListener("focus", onFocus);
  };
}
