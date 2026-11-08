// The Chief of Staff: an always-on agent that decides the owner's questions and approvals so nothing piles up
// (docs/PRODUCT.md, "Chief of Staff"). This holds what the Needs you screen shows about it: whether it is on, what
// it decided (newest first), and why the items it could not do still need the owner.
//   `GET /chief-of-staff` → {enabled, decided: [...], needs_owner: [{id, title, why}]}; a 404 means the backend has
//   no Chief of Staff yet, and the HUD shows nothing about it. `PUT /settings {chief_of_staff_enabled}` switches it.
//   The bus event `steward.decided {id, kind, choice, reason}` moves an item out of the open list at once.
import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api.ts";
import { saveSettings } from "./actions.ts";
import { store } from "./store.ts";
import { deptOf, plainText } from "../city/city-state.js";

export interface Decided {
  id: string;
  kind: string;
  title: string;
  choice: string;
  reason: string;
  at: string;
  department: string;
}
export interface ChiefState {
  /** "missing": the backend has no Chief of Staff (404); nothing about it shows. */
  status: "loading" | "ready" | "missing" | "error";
  enabled: boolean;
  /** The switch was flipped and the server hasn't answered yet. */
  saving: boolean;
  decided: Decided[];
  /** Why an item it could not do needs the owner's own hands, by item id. */
  needsOwner: Record<string, string>;
}

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const newestFirst = (list: Decided[]) => [...list].sort((a, b) => b.at.localeCompare(a.at));

/** Normalises one decided record from the server or an event; tolerant of missing fields. */
export function toDecided(r: Record<string, unknown>, fallback: Partial<Decided> = {}): Decided {
  return {
    id: str(r.id),
    kind: str(r.kind) || fallback.kind || "question",
    title: str(r.title) || fallback.title || (str(r.kind) === "approval" ? "An action to approve" : "A question"),
    choice: str(r.choice ?? r.decision) || fallback.choice || "",
    reason: str(r.reason) || fallback.reason || "",
    at: str(r.at) || fallback.at || new Date().toISOString(),
    department: str(r.department) || fallback.department || "",
  };
}

/** How many it decided in the last 7 days. */
export const decidedThisWeek = (s: ChiefState, now = Date.now()) =>
  s.decided.filter((d) => {
    const t = Date.parse(d.at);
    return Number.isNaN(t) || now - t <= 7 * 24 * 3600_000;
  }).length;

/** What the open question or approval looks like, so a decision that arrives live still says what it was about. */
function describe(id: string): Partial<Decided> {
  const c = store.get().city;
  const q = c.questions[id];
  const a = c.approvals[id];
  const agent = c.agents[(q?.asked_by ?? a?.agent) as string];
  const department = a?.department ?? (agent && agent.kind !== "core" ? deptOf(agent) : "");
  if (q) return { kind: "question", title: plainText(q.text, 160).short, department };
  if (a) return { kind: "approval", title: plainText(a.title || a.action, 160).short, department };
  return {};
}

/** Takes a decided item out of the open list (the badge drops with it). */
function dropOpen(id: string) {
  const c = store.get().city;
  if (!c.questions[id] && !c.approvals[id]) return;
  const questions = { ...c.questions };
  const approvals = { ...c.approvals };
  delete questions[id];
  delete approvals[id];
  store.set({ city: { ...c, questions, approvals } });
}

/** Events that close an open item (the store removes it right after `chief.event`). */
const CLOSES = new Set(["question.answered", "approval.decided", "question.withdrawn", "approval.withdrawn"]);

class Chief {
  state: ChiefState = { status: "loading", enabled: false, saving: false, decided: [], needsOwner: {} };
  private listeners = new Set<() => void>();
  /** Items that just closed (the backend answers first, then says `steward.decided`): what they were about. */
  private recent = new Map<string, Partial<Decided>>();
  private reload: ReturnType<typeof setTimeout> | undefined;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  private set(patch: Partial<ChiefState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async load() {
    try {
      const r = await api<{
        enabled?: boolean;
        decided?: Array<Record<string, unknown>>;
        needs_owner?: Array<Record<string, unknown>>;
      }>("/chief-of-staff");
      const decided = (r.decided ?? []).map((d) => toDecided(d)).filter((d) => d.id);
      // Live decisions that arrived while loading stay (the server's copy wins for the same id).
      const ids = new Set(decided.map((d) => d.id));
      const extra = this.state.decided.filter((d) => !ids.has(d.id));
      const needsOwner: Record<string, string> = {};
      for (const n of r.needs_owner ?? []) if (n.id && n.why) needsOwner[str(n.id)] = str(n.why);
      this.set({
        status: "ready",
        enabled: r.enabled === true,
        decided: newestFirst([...decided, ...extra]),
        needsOwner,
      });
      for (const d of decided) dropOpen(d.id);
    } catch (e) {
      this.set({ status: e instanceof ApiError && e.status === 404 ? "missing" : "error" });
    }
  }

  /** The owner's switch: flips at once, flips back if the server says no. */
  async setEnabled(on: boolean) {
    const was = this.state.enabled;
    this.set({ enabled: on, saving: true });
    try {
      await saveSettings({ chief_of_staff_enabled: on });
      this.set({ saving: false });
    } catch (e) {
      this.set({ enabled: was, saving: false });
      throw e;
    }
  }

  /** WebSocket events. Call before `store.event`, so a decision can still read the item it is about. */
  event(e: { type: string; [k: string]: unknown }) {
    if (CLOSES.has(e.type)) {
      const d = describe(str(e.id));
      if (d.title) {
        this.recent.set(str(e.id), d);
        if (this.recent.size > 50) this.recent.delete(this.recent.keys().next().value!);
      }
      return;
    }
    if (e.type !== "steward.decided") return;
    const id = str(e.id);
    if (!id) return;
    const why = str(e.needs_owner_reason);
    if (!str(e.choice ?? e.decision) && why) {
      // It could not do this one: it stays open, with the reason on top.
      this.set({ needsOwner: { ...this.state.needsOwner, [id]: why } });
      return;
    }
    const known = { ...this.recent.get(id), ...describe(id) };
    const d = toDecided(e, { ...known, at: str(e.at) || new Date().toISOString() });
    // Nothing here knew the item: the server's list has its words and department.
    if (!known.title && this.state.status === "ready") {
      clearTimeout(this.reload);
      this.reload = setTimeout(() => void this.load(), 1500);
    }
    const needsOwner = { ...this.state.needsOwner };
    delete needsOwner[id];
    this.set({
      status: this.state.status === "missing" || this.state.status === "error" ? "ready" : this.state.status,
      enabled: this.state.status === "ready" ? this.state.enabled : true,
      decided: newestFirst([d, ...this.state.decided.filter((x) => x.id !== id)]),
      needsOwner,
    });
    dropOpen(id);
  }
}

export const chief = new Chief();
export const useChief = <T>(pick: (s: ChiefState) => T): T =>
  useSyncExternalStore(chief.subscribe, () => pick(chief.get()));
