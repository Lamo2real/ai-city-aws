// Apps the city builds (docs/APPS.md): routes, the one way an app is framed, and the owner's actions.
// Apps are agent-written code: they only ever run in a sandboxed iframe on the isolated apps origin.
import type { CityApp, CityApproval } from "../city/city-state.js";
import { api } from "./api.ts";
import { store } from "./store.ts";

/** `#/apps/<slug>` → { view: "apps", slug }, `#/settings/<page>` → { view: "settings", slug: page }; a view not
 *  in `views` → the first one (VAIC). */
export function route<V extends string>(
  hash: string,
  views: readonly V[],
  fallback: V = views[0]!,
): { view: V; slug: string | null } {
  const [head = "", ...rest] = hash.replace(/^#\/?/, "").split("/");
  const view = (views as readonly string[]).includes(head) ? (head as V) : fallback;
  if ((view !== "apps" && view !== "settings" && view !== "city" && view !== "tickets") || !rest.length || !rest.join("")) return { view, slug: null };
  let slug = rest.join("/");
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep it as typed */
  }
  return { view, slug: slug.slice(0, view === "city" ? 200 : 60) }; // a building visit carries a department and a project
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
/** The department building an app or a publish approval belongs to: Application builds and publishes every app
 * (decision 220), so an app of the old "Apps" department stands there too. */
export const appsDepartment = (x: { department?: string | null }) =>
  !x.department || /^apps?$/i.test(x.department) ? "Application" : x.department;

export async function loadApps() {
  const r = await api<{ apps: CityApp[] }>("/apps");
  store.setApps(r.apps ?? []);
}
export async function removeApp(appId: string) {
  await api(`/apps/${encodeURIComponent(appId)}`, { method: "DELETE" });
  // The app.removed event does the same; doing it now means the screen doesn't wait for it.
  store.event({ type: "app.removed", app_id: appId });
}

// ---------- v2: grants and pins (docs/APPS.md "v2: data bridge") ----------
export type Capability = NonNullable<CityApp["grants"]>[number] & { label?: string };
/** One key per capability, so the same connector with two tools is two switches. */
export const capKey = (c: Capability) => (c.id === "connector.read" ? `connector.read:${c.connector}/${c.tool}` : c.id);
const KNOWN: Record<string, string> = {
  "calendar.read": "Read your calendars (all accounts)",
  "calendar.calendars": "See the list of your calendars",
  "mail.search": "Search your mail (subjects and senders, not bodies)",
  "mail.accounts": "See which mail accounts you have",
  propose: "Ask you to approve actions such as answering invitations",
  state: "Remember its own data, such as high scores and settings (up to 64 KB)",
};
/** Plain words for a capability; null for one the HUD doesn't know (never offered as a switch). */
export function capLabel(c: Capability): string | null {
  if (c.id === "connector.read")
    return c.connector && c.tool ? `Read from ${capped(c.label ?? c.connector, 40)}: ${capped(c.tool, 60)}` : null;
  return KNOWN[c.id] ?? null;
}

export const MAX_PINS = 6;
export const pinnedApps = (apps: Record<string, CityApp> | undefined) =>
  appList(apps)
    .filter((a) => a.pinned)
    .slice(0, MAX_PINS);

/** Change an app's pin or shrink its grants (`PUT /apps/<id>`). Grants can only shrink here. */
export async function updateApp(appId: string, patch: { pinned?: boolean; grants?: Capability[] }) {
  if (patch.pinned) {
    const pins = Object.values(store.get().city.apps).filter((a) => a.pinned && a.app_id !== appId);
    if (pins.length >= MAX_PINS)
      throw new Error(`Only ${MAX_PINS} apps fit in the top bar. Unpin one first (Settings → Apps).`);
  }
  const r = await api<{ app?: CityApp }>(`/apps/${encodeURIComponent(appId)}`, { method: "PUT", body: patch });
  const now = store.get().city.apps[appId];
  // The app.updated event does the same; doing it now means the switch moves at once.
  if (now) store.event({ type: "app.updated", app: { ...now, ...patch, ...(r?.app ?? {}) } });
}

/** Go back to the app's previous version (`POST /apps/<id>/rollback`); the version left is deleted. */
export async function rollbackApp(appId: string) {
  const r = await api<{ app?: CityApp }>(`/apps/${encodeURIComponent(appId)}/rollback`, { method: "POST" });
  if (r?.app) store.event({ type: "app.updated", app: r.app });
}

/**
 * Approve a publish with the grants the owner left on (null: the app asked for nothing, so none are
 * sent), then pin it if they ticked the box.
 */
export async function publishApp(approvalId: string, grants: Capability[] | null, pin: boolean) {
  const r = await api<{ app?: CityApp }>(`/approvals/${encodeURIComponent(approvalId)}`, {
    method: "POST",
    body: {
      approved: true,
      ...(grants ? { grants: grants.map(({ id, connector, tool }) => ({ id, connector, tool })) } : {}),
    },
  });
  if (!r?.app?.app_id) return;
  // The app.published event follows; showing it now means Apps has it at once.
  store.setApps([...Object.values(store.get().city.apps).filter((a) => a.app_id !== r.app!.app_id), r.app]);
  if (pin && !r.app.pinned) await updateApp(r.app.app_id, { pinned: true });
}
