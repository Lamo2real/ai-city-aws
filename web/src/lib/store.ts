// One store for the whole HUD: the city (via the ported reducer), Ace's chat, connection status and
// the owner's outbox. Every screen reads from here; the WebSocket and API write to it.
import { useSyncExternalStore } from "react";
import { applySnapshot, initialState, reduce, type CityState } from "../city/city-state.js";
import type { LiveStatus } from "./ws.ts";

export interface ChatLine {
  id: string;
  who: "owner" | "ace";
  text: string;
  /** Owner lines: queued (not sent yet), sent, or failed. Ace lines: streaming until done. */
  state: "queued" | "sent" | "failed" | "streaming" | "done";
  at: number;
}
export type Presence = "idle" | "listening" | "thinking" | "speaking" | "waiting";

export interface HudState {
  city: CityState;
  loaded: boolean;
  loadError: string | null;
  chat: ChatLine[];
  live: LiveStatus;
  presence: Presence;
  settings: Record<string, unknown> | null;
}

type Listener = () => void;
const CHAT_KEY = "aic.chat";
const readChat = (): ChatLine[] => {
  try {
    return (JSON.parse(localStorage.getItem(CHAT_KEY) ?? "[]") as ChatLine[]).slice(-60);
  } catch {
    return [];
  }
};

class Store {
  state: HudState = {
    city: initialState(),
    loaded: false,
    loadError: null,
    chat: readChat(),
    live: "connecting",
    presence: "idle",
    settings: null,
  };
  private listeners = new Set<Listener>();
  /** Raw events for the City scene, which keeps its own animated copy. */
  readonly sceneEvents = new Set<(e: unknown) => void>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  set(patch: Partial<HudState>) {
    this.state = { ...this.state, ...patch };
    if (patch.chat) {
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(patch.chat.slice(-60)));
      } catch {
        /* storage full or blocked: the chat still works for this session */
      }
    }
    for (const l of this.listeners) l();
  }
  /** Events that arrive while a snapshot is loading are replayed on top of it, so none are lost. */
  private during: unknown[] | null = null;
  beginSnapshot() {
    this.during = [];
  }
  snapshot(snap: unknown) {
    let city = applySnapshot(this.state.city, snap);
    for (const e of this.during ?? []) city = reduce(city, e);
    this.during = null;
    this.set({ city, loaded: true, loadError: null });
  }
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type === "ace.reply")
      return this.aceReply(e as unknown as { conversation: string; text: string; done: boolean });
    this.during?.push(e);
    this.set({ city: reduce(this.state.city, e) });
    for (const l of this.sceneEvents) l(e);
  }
  private aceReply(e: { text: string; done: boolean }) {
    const chat = [...this.state.chat];
    const last = chat.at(-1);
    if (last?.who === "ace" && last.state === "streaming")
      chat[chat.length - 1] = {
        ...last,
        text: e.done ? e.text : last.text + e.text,
        state: e.done ? "done" : "streaming",
      };
    else
      chat.push({
        id: `a-${Date.now()}`,
        who: "ace",
        text: e.text,
        state: e.done ? "done" : "streaming",
        at: Date.now(),
      });
    this.set({ chat, presence: e.done ? "speaking" : "thinking" });
  }
}

export const store = new Store();
export const useHud = <T>(pick: (s: HudState) => T): T =>
  useSyncExternalStore(store.subscribe, () => pick(store.get()));

/** Things waiting for the owner: questions and approvals. */
export const waitingCount = (s: HudState) =>
  Object.keys(s.city.questions).length + Object.keys(s.city.approvals).length;
