// Apps the city builds (docs/APPS.md): routes, the one way an app is framed, and the owner's actions.
// Apps are agent-written code: they only ever run in a sandboxed iframe on the isolated apps origin.
import type { CityApp, CityApproval } from "../city/city-state.js";
import { api } from "./api.ts";
import { store } from "./store.ts";

/** `#/apps/<slug>` → { view: "apps", slug }; a view not in `views` → the first one (AIC). */
export function route<V extends string>(hash: string, views: readonly V[]): { view: V; slug: string | null } {
  const [head = "", ...rest] = hash.replace(/^#\/?/, "").split("/");
  const view = (views as readonly string[]).includes(head) ? (head as V) : views[0]!;
  if (view !== "apps" || !rest.length || !rest.join("")) return { view, slug: null };
  let slug = rest.join("/");
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep it as typed */
  }
  return { view, slug: slug.slice(0, 60) };
}

/**
 * The exact attributes every app frame gets: scripts only, opaque origin (no allow-same-origin), no
 * popups, forms, modals or top navigation, no referrer and no device features.
 */
export const FRAME = { sandbox: "allow-scripts", referrerPolicy: "no-referrer", allow: "" } as const;

/** Only URLs on the apps origin are framed; anything else (or no apps origin configured) is not shown. */
export function onAppsOrigin(url: string | null | undefined, appsUrl: string | null | undefined): boolean {
  if (!url || !appsUrl) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.origin === new URL(appsUrl).origin;
  } catch {
    return false;
  }
}

/** Agent text, as plain text, capped. */
export const capped = (text: unknown, max: number): string => {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export const appList = (apps: Record<string, CityApp> | undefined): CityApp[] =>
  Object.values(apps ?? {}).sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
export const isPublish = (a: CityApproval) => a.kind === "app.publish";
/** The department building an app or a publish approval belongs to. */
export const appsDepartment = (x: { department?: string | null }) => x.department || "Apps";

export async function loadApps() {
  const r = await api<{ apps: CityApp[] }>("/apps");
  store.setApps(r.apps ?? []);
}
export async function removeApp(appId: string) {
  await api(`/apps/${encodeURIComponent(appId)}`, { method: "DELETE" });
  // The app.removed event does the same; doing it now means the screen doesn't wait for it.
  store.event({ type: "app.removed", app_id: appId });
}
