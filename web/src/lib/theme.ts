// Appearance (Settings → General): System, Light or Dark, remembered per device. Dark glass over a night sky is the
// default look; Light is the same glass over a daytime sky with ink text. `data-theme` on <html> carries the result.
export type Theme = "system" | "light" | "dark";
const KEY = "vaic.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode: the default */
  }
  return "dark";
}

const media = () => window.matchMedia?.("(prefers-color-scheme: light)");
export const resolved = (t: Theme): "light" | "dark" => (t === "system" ? (media()?.matches ? "light" : "dark") : t);

let unlisten: (() => void) | null = null;
/** Applies the theme now and, for System, follows the device as it changes. */
export function applyTheme(t: Theme = readTheme()) {
  const set = () => (document.documentElement.dataset.theme = resolved(t));
  set();
  unlisten?.();
  unlisten = null;
  const m = media();
  if (t === "system" && m) {
    m.addEventListener("change", set);
    unlisten = () => m.removeEventListener("change", set);
  }
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* remembered for this visit only */
  }
  applyTheme(t);
}
