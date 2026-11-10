// Autopilot (docs/PRODUCT.md, "While you were away"): the owner can be gone for weeks. Nothing waits on them:
// the Chief of Staff decides, standing orders handle incoming work, and what only the owner's own hands can do
// (sign in, a key, pay) never blocks and waits on a short "When you're back" list.
//   `GET /away-summary?since=<iso>` → what happened while they were gone; `GET/POST /standing-orders`,
//   `PUT/DELETE /standing-orders/{id}`; `PUT /settings {"autopilot": bool}` (default on). A 404 means the backend
//   has none of this yet: the HUD shows nothing about it.
import { api, ApiError } from "./api.ts";

/** Long enough away that VAIC's screen opens with "While you were away". */
export const AWAY_MS = 12 * 3600_000;
const SEEN = "vaic.lastSeen";

export interface WhenBack {
  id: string;
  title: string;
  why: string;
  service: string;
}
export interface AwaySummary {
  since: string;
  jobs_finished: unknown[];
  jobs_running: unknown[];
  decided: number;
  handled_by_standing_orders: unknown[];
  when_youre_back: WhenBack[];
}
export interface StandingOrder {
  id: string;
  source: string;
  /** What to do, in the owner's words (the backend's field); `what` is an older short form. */
  instructions?: string;
  what?: string;
  department: string;
  every_minutes: number;
  enabled: boolean;
}

const read = (k: string): number | null => {
  try {
    const v = Number(localStorage.getItem(k));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

/** When the owner last had AI City open on this device (null the first time). */
export const lastSeen = () => read(SEEN);
export function markSeen(now = Date.now()) {
  try {
    localStorage.setItem(SEEN, String(now));
  } catch {
    /* storage blocked: the panel just won't open by itself */
  }
}
/** Read once per page load, before it is overwritten: the start of "while you were away". */
let wentAway: number | null | undefined;
export function awayStart(): number | null {
  if (wentAway === undefined) wentAway = lastSeen();
  return wentAway;
}
/** Whether this visit opens with the panel: the owner was gone more than 12 hours. */
export const cameBack = (now = Date.now()) => {
  const at = awayStart();
  return at !== null && now - at > AWAY_MS;
};
/** Keeps "last seen" current while the page is open. */
export function trackSeen() {
  awayStart();
  markSeen();
  const tick = setInterval(() => document.visibilityState === "visible" && markSeen(), 60_000);
  const hide = () => markSeen();
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", hide);
  return () => {
    clearInterval(tick);
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", hide);
  };
}

/** null: the backend has no away summary yet (404). */
export async function loadSummary(since: number): Promise<AwaySummary | null> {
  try {
    const r = await api<Partial<AwaySummary>>(
      `/away-summary?since=${encodeURIComponent(new Date(since).toISOString())}`,
    );
    return {
      since: r.since ?? new Date(since).toISOString(),
      jobs_finished: r.jobs_finished ?? [],
      jobs_running: r.jobs_running ?? [],
      decided: typeof r.decided === "number" ? r.decided : 0,
      handled_by_standing_orders: r.handled_by_standing_orders ?? [],
      when_youre_back: (r.when_youre_back ?? []).filter((w) => w && w.id),
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** One plain line for a job or a handled item, whatever shape the server sends. */
export function label(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["words", "summary", "name", "title", "what", "goal"])
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
  }
  return "";
}

/** "every 15 minutes", "every hour", "every 2 hours", "every day". */
export function everyWords(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "now and then";
  if (min % 1440 === 0) return min === 1440 ? "every day" : `every ${min / 1440} days`;
  if (min % 60 === 0) return min === 60 ? "every hour" : `every ${min / 60} hours`;
  return min === 1 ? "every minute" : `every ${min} minutes`;
}
/** What new work from a source is called: "new Jira tickets", "new Slack messages". */
const SOURCES: Record<string, [string, string]> = {
  jira: ["Jira", "tickets"],
  slack: ["Slack", "messages"],
  github: ["GitHub", "issues"],
  linear: ["Linear", "issues"],
  zendesk: ["Zendesk", "tickets"],
  intercom: ["Intercom", "conversations"],
  mail: ["", "emails"],
  email: ["", "emails"],
  gmail: ["Gmail", "emails"],
  outlook: ["Outlook", "emails"],
};
function newWork(o: StandingOrder): string {
  const what = (o.what ?? "").trim().replace(/\.$/, "");
  if (what) return what.charAt(0).toLowerCase() + what.slice(1);
  const src = (o.source ?? "").trim();
  if (!src) return "new work";
  const [name, noun] = SOURCES[src.toLowerCase()] ?? [src.charAt(0).toUpperCase() + src.slice(1), "work"];
  return `new ${name ? `${name} ` : ""}${noun}`;
}
/** "Every 15 minutes, Customer Support handles new Jira tickets." */
export function orderWords(o: StandingOrder): string {
  const when = everyWords(o.every_minutes);
  const who = o.department?.trim() || "the team";
  return `${when.charAt(0).toUpperCase()}${when.slice(1)}, ${who} handles ${newWork(o)}.`;
}

/** The standing orders; [] when the backend has none yet (404). */
export async function listOrders(): Promise<StandingOrder[]> {
  try {
    const r = await api<{ standing_orders?: StandingOrder[]; orders?: StandingOrder[] }>("/standing-orders");
    return r.standing_orders ?? r.orders ?? [];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}
export const setOrder = (id: string, patch: Partial<StandingOrder>) =>
  api(`/standing-orders/${encodeURIComponent(id)}`, { method: "PUT", body: patch });
export const deleteOrder = (id: string) => api(`/standing-orders/${encodeURIComponent(id)}`, { method: "DELETE" });

/** "Add" a standing order: VAIC's chat opens with the words started. */
export const ADD_PROMPT = "While I'm away, ";
export function startOrderInChat() {
  try {
    localStorage.setItem("vaic.draft", ADD_PROMPT);
  } catch {
    /* no storage: the chat opens empty */
  }
  location.hash = "/vaic";
}
