// The data bridge between the HUD and the apps the city built (docs/APPS.md, "v2: data bridge").
// One `message` listener for the whole HUD. A message counts only when it comes from the window of an
// AppFrame that is mounted right now (and the sandbox makes its origin "null"). Which app is asking comes
// from that frame's own registration, never from the message. The app gets only the reply to what it
// asked: never a token, the API URL, config, another app's id or HUD state.
import type { CityApp } from "../city/city-state.js";
import { api, ApiError } from "./api.ts";
import { store } from "./store.ts";

/** A capability an app asked for (manifest) or was granted (APP record). */
export interface AppCapability {
  id: string;
  connector?: string;
  tool?: string;
}
export type BridgeError = "not_granted" | "preview" | "invalid" | "rate_limited" | "unavailable" | "login_expired";
export type BridgeReply =
  | { vaic: 1; id: string; ok: true; data?: unknown; status?: string }
  | { vaic: 1; id: string; ok: false; error: BridgeError; message: string };

export const PROPOSE_KINDS = ["calendar.respond", "calendar.create", "mail.draft"] as const;
export const LIMITS = { inFlight: 4, perMinute: 30, idLen: 40, capLen: 40, paramsBytes: 8 * 1024 } as const;

const MESSAGES: Record<BridgeError, string> = {
  not_granted: "The owner has not allowed this app to do that.",
  preview: "This is a preview: it has no data until the owner publishes it.",
  invalid: "That request is not in a shape AI City accepts.",
  rate_limited: "Too many requests; wait a moment and try again.",
  unavailable: "That data can't be reached right now.",
  login_expired: "The account behind this data needs signing in again in AI City.",
};

interface Frame {
  el: HTMLIFrameElement;
  /** null for a preview (Needs you): every request gets `preview`, nothing reaches the API. */
  appId: string | null;
  inFlight: number;
  times: number[];
}
const frames = new Set<Frame>();
let listening = false;

/** AppFrame calls this when it mounts; the returned function forgets the frame when it unmounts. */
export function registerFrame(el: HTMLIFrameElement, appId: string | null): () => void {
  const f: Frame = { el, appId, inFlight: 0, times: [] };
  frames.add(f);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("message", onMessage);
    listening = true;
  }
  return () => {
    frames.delete(f);
  };
}

const isPlain = (x: unknown): x is Record<string, unknown> => {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const p = Object.getPrototypeOf(x) as unknown;
  return p === Object.prototype || p === null;
};
const size = (x: unknown) => {
  try {
    return new Blob([JSON.stringify(x)]).size;
  } catch {
    return Infinity; // cycles and the like
  }
};

/** Does this app's grant (the HUD's copy) cover the request? Unknown caps never do. */
export function granted(
  app: Pick<CityApp, "grants"> | undefined,
  cap: string,
  params: Record<string, unknown>,
): boolean {
  const grants = (app?.grants ?? []) as AppCapability[];
  if (cap === "connector.read")
    return grants.some((g) => g.id === "connector.read" && g.connector === params.connector && g.tool === params.tool);
  if (cap === "propose")
    return grants.some((g) => g.id === "propose") && (PROPOSE_KINDS as readonly string[]).includes(String(params.kind));
  if (cap === "state.get" || cap === "state.set") return grants.some((g) => g.id === "state");
  return grants.some((g) => g.id === cap && !["connector.read", "propose", "state"].includes(g.id));
}

const ERROR_BY_STATUS: Record<number, BridgeError> = { 400: "invalid", 403: "not_granted", 429: "rate_limited" };
function bridgeError(e: unknown): BridgeError {
  if (e instanceof ApiError) {
    if ((Object.keys(MESSAGES) as string[]).includes(e.message)) return e.message as BridgeError;
    return ERROR_BY_STATUS[e.status] ?? "unavailable";
  }
  return "unavailable";
}

/** Exported for tests; the HUD only uses it through the window listener. */
export async function onMessage(ev: MessageEvent): Promise<void> {
  // 1. Only the window of a mounted AppFrame, and only from its opaque (sandboxed) origin.
  if (ev.origin !== "null" || !ev.source) return;
  let frame: Frame | undefined;
  for (const f of frames) if (f.el.contentWindow && f.el.contentWindow === ev.source) frame = f;
  if (!frame) return;
  const target = frame.el.contentWindow!;
  const reply = (r: BridgeReply) => target.postMessage(r, "*"); // "*": the frame's origin is opaque; the target is that exact window
  const fail = (id: string, error: BridgeError) => reply({ vaic: 1, id, ok: false, error, message: MESSAGES[error] });

  // 2. The shape. Without a usable id there is nobody to answer: drop it.
  const m = ev.data as unknown;
  if (!isPlain(m) || m.vaic !== 1 || typeof m.id !== "string" || !m.id || m.id.length > LIMITS.idLen) return;
  const id = m.id;
  if (typeof m.cap !== "string" || !m.cap || m.cap.length > LIMITS.capLen) return fail(id, "invalid");
  const params = m.params ?? {};
  if (!isPlain(params) || size(params) > LIMITS.paramsBytes) return fail(id, "invalid");

  // 3. A preview has no data.
  if (frame.appId === null) return fail(id, "preview");

  // 4. The owner's grants, read now (a revoke counts from the next request).
  const appId = frame.appId;
  const app = store.get().city.apps?.[appId];
  if (!granted(app, m.cap, params)) return fail(id, "not_granted");

  // 5. Throttle per frame: 4 at once, 30 a minute.
  const now = Date.now();
  frame.times = frame.times.filter((t) => now - t < 60_000);
  if (frame.inFlight >= LIMITS.inFlight || frame.times.length >= LIMITS.perMinute) return fail(id, "rate_limited");
  frame.inFlight++;
  frame.times.push(now);

  // 6. The API, with the owner's token (it never leaves the HUD).
  try {
    if (m.cap === "propose") {
      await api(`/apps/${encodeURIComponent(appId)}/proposals`, {
        method: "POST",
        body: { kind: params.kind, params: isPlain(params.params) ? params.params : {} },
      });
      if (frames.has(frame)) reply({ vaic: 1, id, ok: true, status: "waiting_for_you" });
    } else {
      const r = await api<Record<string, unknown>>(`/apps/${encodeURIComponent(appId)}/bridge`, {
        method: "POST",
        body: { cap: m.cap, params },
      });
      if (frames.has(frame)) reply({ vaic: 1, id, ok: true, data: r && "data" in r ? r.data : r });
    }
  } catch (e) {
    if (frames.has(frame)) fail(id, bridgeError(e));
  } finally {
    frame.inFlight--;
  }
}

/** The only city events an app ever sees, and the grants that let it see each one. */
const APP_EVENTS: Record<string, readonly string[]> = {
  "calendar.changed": ["calendar.read", "calendar.calendars"],
};

/**
 * Called for every live event: tells each mounted published app about it, only if it is an app event and
 * that app's grants (read now) cover it. The app gets the event's name, nothing from its body. Previews
 * get nothing.
 */
export function forwardEvent(e: { type?: unknown; [k: string]: unknown }) {
  const needs = typeof e?.type === "string" && Object.hasOwn(APP_EVENTS, e.type) ? APP_EVENTS[e.type] : undefined;
  if (!needs) return;
  const apps = store.get().city.apps ?? {};
  for (const f of frames) {
    if (f.appId === null || !f.el.contentWindow) continue;
    const grants = (apps[f.appId]?.grants ?? []) as AppCapability[];
    if (grants.some((g) => needs.includes(g.id))) f.el.contentWindow.postMessage({ vaic: 1, event: e.type }, "*");
  }
}

/** Tests only: forget every frame and stop listening. */
export function resetBridge() {
  frames.clear();
  if (listening) window.removeEventListener("message", onMessage);
  listening = false;
}
