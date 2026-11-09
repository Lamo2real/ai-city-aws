// AIC changes what lives on the owner's device (decision 143): the theme, or which page is open. The event comes
// from AIC's `hud_action` tool, which only runs on the owner's own message.
import { saveTheme } from "./theme.ts";

export function hudAction(e: { [k: string]: unknown }) {
  if (e.action === "theme" && (e.value === "light" || e.value === "dark" || e.value === "system")) {
    saveTheme(e.value);
  } else if (e.action === "open" && typeof e.page === "string" && /^#\/[\w/?=&.-]{0,120}$/.test(e.page)) {
    if (window.location.hash !== e.page) window.location.hash = e.page;
  }
}
