// The live working copy of an app while the builders work (the owner, 2026-11-12, decision 278). After a builder's
// file edits the city copies the changed files to a private address on the apps origin and sends `app.preview`
// {hire_id, preview_url, seq, paths, hints: [{path, selector}]}. It is filed under the project conversation of the
// builder's job (like the build steps), and kept on this device so a reload shows the last copy. The frame shows it
// in the same sandbox as every app; `marks` tell the copy's own helper (vaic-live.js) where to point.
import { useSyncExternalStore } from "react";
import type { CityState } from "../city/city-state.js";
import { onAppsOrigin } from "./apps.ts";
import { conversationOf } from "./buildSteps.ts";

export interface Editor {
  agent: string;
  /** The builder's role, as the City shows it ("Frontend dev"). */
  label: string;
  /** The file last changed, relative to the app folder. */
  path: string;
  selector: string | null;
  color: string;
  at: number;
}
export interface LiveCopy {
  url: string;
  seq: number;
  at: number;
  /** What changed in the last update, for the flash. */
  changed: string[];
  editors: Record<string, Editor>;
}

const KEY = "vaic.livepreview";
const COLORS = ["#7dd3fc", "#f9a8d4", "#fcd34d", "#86efac", "#c4b5fd", "#fdba74"];
const SELECTOR = /^[#.]?[A-Za-z][\w-]{0,60}$/;

export function colorOf(agent: string): string {
  let h = 0;
  for (const c of agent) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

/** A builder's role in plain words: "frontend-dev" → "Frontend dev". */
export function labelOf(role: string | undefined, agent: string): string {
  const r = String(role || "")
    .replace(/[-_]+/g, " ")
    .trim();
  return r ? (r[0]!.toUpperCase() + r.slice(1)).slice(0, 30) : agent.startsWith("wkr-") ? "Builder" : agent;
}

/** The frame's address for this copy: a new `live` number reloads it, `marks` place the pointers inside. */
export function frameSrc(copy: LiveCopy): string {
  const marks = Object.values(copy.editors)
    .filter((e) => e.selector)
    .slice(-6)
    .map((e) => ({ label: e.label, selector: e.selector, color: e.color }));
  const u = new URL(copy.url);
  u.searchParams.set("live", String(copy.seq));
  if (marks.length) u.searchParams.set("marks", JSON.stringify(marks));
  return u.toString();
}

const read = (): Record<string, LiveCopy> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, LiveCopy>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

class Live {
  state: Record<string, LiveCopy> = read();
  private listeners = new Set<() => void>();
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  private set(next: Record<string, LiveCopy>) {
    this.state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked: the copy lasts for this session */
    }
    for (const l of this.listeners) l();
  }
  /** Called after the city store has taken the event, so the builder's job is known. */
  event(e: { type: string; [k: string]: unknown }, city: CityState, appsUrl: string | null) {
    if (e.type === "app.published" || e.type === "app.updated") {
      // The version is done: the studio shows it, and the working copy is put away.
      const id = e.type === "app.published" ? e.app_id : (e.app as { app_id?: unknown } | undefined)?.app_id;
      const convs = [`app-${String(id)}`, typeof e.conversation === "string" ? e.conversation : ""];
      if (convs.some((c) => this.state[c])) {
        const rest = { ...this.state };
        for (const c of convs) delete rest[c];
        this.set(rest);
      }
      return;
    }
    if (e.type !== "app.preview" || typeof e.hire_id !== "string" || typeof e.preview_url !== "string") return;
    if (!onAppsOrigin(e.preview_url, appsUrl) || !/\/drafts\/prv-[0-9a-f]{32}\/index\.html$/.test(e.preview_url))
      return;
    const conv = conversationOf(city, e.hire_id);
    if (!conv) return;
    const seq = Number(e.seq) || 0;
    const was = this.state[conv];
    if (was && was.url === e.preview_url && seq <= was.seq) return; // a repeat, or out of order
    const paths = (Array.isArray(e.paths) ? e.paths : []).map(String).slice(0, 40);
    const hints = (Array.isArray(e.hints) ? e.hints : []) as Array<{ path?: unknown; selector?: unknown }>;
    const agent = city.agents[e.hire_id];
    // The file this builder last touched: the hinted one (its own edit), else the last path in the update.
    const hint = hints.filter((h) => typeof h.path === "string" && paths.includes(h.path)).at(-1);
    const path = hint ? String(hint.path) : (paths.find((p) => p.endsWith(".html")) ?? paths.at(-1) ?? "index.html");
    const selector = hint && typeof hint.selector === "string" && SELECTOR.test(hint.selector) ? hint.selector : null;
    const editors = was?.url === e.preview_url ? { ...was.editors } : {};
    editors[e.hire_id] = {
      agent: e.hire_id,
      label: labelOf(agent?.role, e.hire_id),
      path,
      selector,
      color: colorOf(e.hire_id),
      at: Date.now(),
    };
    this.set({ ...this.state, [conv]: { url: e.preview_url, seq, at: Date.now(), changed: paths, editors } });
  }
  /** A project that moved to its published app's conversation (the copy is put away by then anyway). */
  move(from: string, to: string) {
    if (!this.state[from] || from === to) return;
    const { [from]: moved, ...rest } = this.state;
    this.set({ ...rest, [to]: moved! });
  }
}

export const livePreview = new Live();
export const useLiveCopy = (conv: string): LiveCopy | undefined =>
  useSyncExternalStore(livePreview.subscribe, () => livePreview.get()[conv]);
