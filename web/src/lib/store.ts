// One store for the whole HUD: the city (via the ported reducer), AIC's chat, connection status and
// the owner's outbox. Every screen reads from here; the WebSocket and API write to it.
import { useSyncExternalStore } from "react";
import { applySnapshot, initialState, reduce, type CityApp, type CityState } from "../city/city-state.js";
import { FIRST_STEP, stepWords } from "./steps.ts";
import type { LiveStatus } from "./ws.ts";

export interface ChatLine {
  id: string;
  who: "owner" | "ace";
  text: string;
  /** Owner lines: queued (not sent yet), sent, or failed. AIC lines: streaming until done. */
  state: "queued" | "sent" | "failed" | "streaming" | "done";
  at: number;
  /** Owner lines: said by voice (the mic or the wake word, or dictated and not edited by keyboard). */
  voice?: boolean;
  /** AIC lines: the steps AIC took before answering, and how long until its first words (ms). */
  steps?: string[];
  tookMs?: number;
  /** AIC lines: when the owner sent, and the work AIC handed on (tickets) and whether each has settled. */
  started?: number;
  tasks?: { id: string; done: boolean }[];
}
/** AIC's turn in progress: when the owner sent, and the steps so far. */
export interface AceTurn {
  started: number;
  steps: string[];
  /** Tickets AIC opened in this turn before its reply line existed. */
  tasks?: string[];
}
/** A connect card under AIC's chat: an add-connector approval, a sign-in button, a key field or an app-password form. */
export type ConnectCardState =
  | { kind: "approve"; id: string; approvalId: string; action: string; reason: string }
  | {
      kind: "signin";
      id: string;
      target: "mail" | "connector";
      targetId: string;
      title: string;
      status: "pending" | "connected" | "failed";
    }
  | { kind: "key"; id: string; targetId: string; title: string; needs?: string; names?: string[] }
  | { kind: "imap"; id: string; targetId: string; title: string; status: "pending" | "connected" };
export type Presence = "idle" | "listening" | "thinking" | "speaking" | "waiting";

export interface HudState {
  city: CityState;
  loaded: boolean;
  loadError: string | null;
  chat: ChatLine[];
  live: LiveStatus;
  presence: Presence;
  settings: Record<string, unknown> | null;
  turn: AceTurn | null;
  cards: ConnectCardState[];
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
    turn: null,
    cards: [],
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
    // Work that finished while this page was closed or offline: no longer open in the city, so settled.
    const open = new Set([...Object.keys(city.tickets ?? {}), ...Object.keys(city.parked ?? {})]);
    this.settleTasks((id) => !open.has(id));
  }

  /** Links the ticket AIC opens to its reply, and settles it when it finishes or its result comes back. */
  private taskEvent(e: { type: string; [k: string]: unknown }) {
    if (e.type === "result" && typeof e.ticket_id === "string") return this.settleTasks((id) => id === e.ticket_id);
    if (e.type !== "ticket.status") return;
    const t = e.ticket as { id: string; from: string; status: string } | undefined;
    if (!t) return;
    if (["done", "failed", "cancelled"].includes(t.status)) return this.settleTasks((id) => id === t.id);
    if (e.previous !== null || t.from !== "ace") return;
    const turn = this.state.turn;
    const chat = this.state.chat;
    const i = chat.findLastIndex((l) => l.who === "ace");
    const line = chat[i];
    if (turn && (!line || line.at < turn.started))
      return this.set({ turn: { ...turn, tasks: [...(turn.tasks ?? []), t.id] } }); // the reply has not started yet
    if (!line || line.tasks?.some((x) => x.id === t.id)) return;
    const next = [...chat];
    next[i] = { ...line, tasks: [...(line.tasks ?? []), { id: t.id, done: false }] };
    this.set({ chat: next });
  }
  private settleTasks(match: (id: string) => boolean) {
    const chat = this.state.chat;
    if (!chat.some((l) => l.tasks?.some((t) => !t.done && match(t.id)))) return;
    this.set({
      chat: chat.map((l) =>
        l.tasks?.some((t) => !t.done && match(t.id))
          ? { ...l, tasks: l.tasks.map((t) => (match(t.id) ? { ...t, done: true } : t)) }
          : l,
      ),
    });
  }
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type === "ace.reply")
      return this.aceReply(e as unknown as { conversation: string; text: string; done: boolean });
    if (e.type === "activity" && e.id === "ace") this.aceStep(String(e.activity ?? ""), e.detail as string | null);
    this.taskEvent(e);
    this.cardEvent(e);
    this.during?.push(e);
    this.set({ city: reduce(this.state.city, e) });
    for (const l of this.sceneEvents) l(e);
  }
  /** Adds a card, or updates it where it stands (so a card doesn't jump when its status changes). */
  private putCard(c: ConnectCardState) {
    const cards = this.state.cards;
    this.set({ cards: cards.some((x) => x.id === c.id) ? cards.map((x) => (x.id === c.id ? c : x)) : [...cards, c] });
  }
  dropCard(id: string) {
    this.set({ cards: this.state.cards.filter((x) => x.id !== id) });
  }
  /** Connect cards follow the city's events (CONNECTORS_SKILLS.md §3, MAIL_CALENDAR.md §6). */
  private cardEvent(e: { type: string; [k: string]: unknown }) {
    const s = (k: string) => String(e[k] ?? "");
    if (e.type === "approval.requested" && e.kind === "connector.add")
      return this.putCard({
        kind: "approve",
        id: `ap:${s("id")}`,
        approvalId: s("id"),
        action: s("action"),
        reason: s("reason"),
      });
    if (e.type === "approval.decided") return this.dropCard(`ap:${s("id")}`);
    if (e.type === "connect.signin") {
      const label = s("label");
      const title =
        s("provider") === "imap"
          ? `Add the app password for ${label}`
          : `Sign in to ${s("provider") === "google" ? "Google" : "Microsoft"} (${label})`;
      return this.putCard(
        s("provider") === "imap"
          ? { kind: "imap", id: `mail:${s("account_id")}`, targetId: s("account_id"), title, status: "pending" }
          : {
              kind: "signin",
              id: `mail:${s("account_id")}`,
              target: "mail",
              targetId: s("account_id"),
              title,
              status: "pending",
            },
      );
    }
    if (e.type === "mail.account") {
      const a = (e.account ?? {}) as { id?: string; status?: string };
      const card = this.state.cards.find((c) => c.id === `mail:${a.id}`);
      if (!card) return;
      if (a.status === "removed") return this.dropCard(card.id);
      if (a.status === "connected" && (card.kind === "signin" || card.kind === "imap"))
        return this.putCard({ ...card, status: "connected" });
      if (a.status === "error" && card.kind === "signin") return this.putCard({ ...card, status: "failed" });
      return;
    }
    if (e.type === "connector.updated") {
      const id = `conn:${s("id")}`;
      const label = s("label") || s("id");
      const status = s("status");
      if (status === "removed") return this.dropCard(id);
      if (status === "needs_login" || status === "login_expired")
        return this.putCard({
          kind: "signin",
          id,
          target: "connector",
          targetId: s("id"),
          title: `Sign in to ${label}`,
          status: "pending",
        });
      if (status === "needs_key")
        return this.putCard({
          kind: "key",
          id,
          targetId: s("id"),
          title: `Add the key for ${label}`,
          needs: s("needs") || undefined,
          names: (e.names as string[] | undefined) ?? undefined,
        });
      const card = this.state.cards.find((c) => c.id === id);
      if (status === "ready" && card?.kind === "signin") return this.putCard({ ...card, status: "connected" });
      if (status === "ready" || status === "syncing") return card?.kind === "key" ? this.dropCard(id) : undefined;
    }
  }
  /** The published apps from `GET /apps` (the snapshot and the app events keep them current too). */
  setApps(list: CityApp[]) {
    const apps: Record<string, CityApp> = {};
    for (const a of list) if (a?.app_id) apps[a.app_id] = a;
    this.set({ city: { ...this.state.city, apps } });
  }
  /** Starts AIC's turn: the status row shows from now until its first words. */
  beginTurn() {
    this.set({ turn: { started: Date.now(), steps: [FIRST_STEP] } });
  }
  private aceStep(activity: string, detail?: string | null) {
    const words = stepWords(activity, detail);
    const turn = this.state.turn;
    if (!words || !turn || turn.steps.at(-1) === words) return;
    this.set({ turn: { ...turn, steps: [...turn.steps, words] } });
  }
  private aceReply(e: { text: string; done: boolean }) {
    const chat = [...this.state.chat];
    const last = chat.at(-1);
    // The final reply arrives twice (straight from AIC, and through the event bus as a safety net).
    if (e.done && last?.who === "ace" && last.state === "done" && last.text === e.text) return;
    if (last?.who === "ace" && last.state === "streaming")
      chat[chat.length - 1] = {
        ...last,
        text: e.done ? e.text : last.text + e.text,
        state: e.done ? "done" : "streaming",
        steps: this.state.turn?.steps ?? last.steps,
      };
    else
      chat.push({
        id: `a-${Date.now()}`,
        who: "ace",
        text: e.text,
        state: e.done ? "done" : "streaming",
        at: Date.now(),
        ...(this.state.turn
          ? {
              steps: this.state.turn.steps,
              tookMs: Date.now() - this.state.turn.started,
              started: this.state.turn.started,
              ...(this.state.turn.tasks?.length
                ? { tasks: this.state.turn.tasks.map((id) => ({ id, done: false })) }
                : {}),
            }
          : {}),
      });
    // While AIC already speaks its first sentences, more pieces arriving must not flip it back to "thinking".
    const presence = e.done || this.state.presence === "speaking" ? "speaking" : "thinking";
    this.set({ chat, presence, ...(e.done ? { turn: null } : {}) });
  }
}

export const store = new Store();
export const useHud = <T>(pick: (s: HudState) => T): T =>
  useSyncExternalStore(store.subscribe, () => pick(store.get()));

/** Things waiting for the owner: questions and approvals. */
export const waitingCount = (s: HudState) =>
  Object.keys(s.city.questions).length + Object.keys(s.city.approvals).length;
