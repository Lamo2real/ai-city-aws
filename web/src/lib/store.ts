// One store for the whole HUD: the city (via the ported reducer), VAIC's chat, connection status and
// the owner's outbox. Every screen reads from here; the WebSocket and API write to it.
import { hudAction } from "./hudAction.ts";
import { needsCount } from "./needs.ts";
import { useSyncExternalStore } from "react";
import { applySnapshot, initialState, reduce, type CityApp, type CityState } from "../city/city-state.js";
import { FIRST_STEP, stepWords } from "./steps.ts";
import type { LiveStatus } from "./ws.ts";
import type { FileCardData } from "./files.ts";

export interface ChatLine {
  id: string;
  who: "owner" | "vaic";
  text: string;
  /** Owner lines: queued (not sent yet), sent, or failed. VAIC lines: streaming until done. */
  state: "queued" | "sent" | "failed" | "streaming" | "done";
  at: number;
  /** Owner lines: the server refused it (a 4xx), so sending it again would only be refused again. */
  refused?: boolean;
  /** Owner lines: said by voice (the mic or the wake word, or dictated and not edited by keyboard). */
  voice?: boolean;
  /** Owner lines: the owner pressed Stop on VAIC's answer (decision 183), and what VAIC had already done by then. */
  stopped?: boolean;
  stoppedSteps?: string[];
  /** VAIC had already handed work on to the team: Stop does not undo that (the job's own Stop does). */
  handedOn?: boolean;
  /** VAIC lines: the steps VAIC took before answering, and how long until its first words (ms). */
  steps?: string[];
  tookMs?: number;
  /** VAIC lines: when the owner sent, and the work VAIC handed on (tickets) and whether each has settled. */
  started?: number;
  tasks?: { id: string; done: boolean }[];
  /** VAIC lines: files VAIC put in the chat (show_files), each drawn with a preview and a Download button. */
  files?: FileCardData[];
  /** A heading over the files ("References for this build"). */
  filesLabel?: string;
}
/** VAIC's turn in progress: when the owner sent, and the steps so far. */
export interface VaicTurn {
  started: number;
  steps: string[];
  /** Tickets VAIC opened in this turn before its reply line existed. */
  tasks?: string[];
  /** Files VAIC showed in this turn before its reply line existed. */
  files?: FileCardData[];
}
/** A connect card under VAIC's chat: an add-connector approval, a sign-in button, a key field or an app-password form. */
export type ConnectCardState = (
  | {
      kind: "approve";
      id: string;
      approvalId: string;
      action: string;
      reason: string;
      connectorId?: string;
      /** An ad campaign over the owner's ad spend limit (decision 240). */
      spend?: boolean;
    }
  | {
      kind: "signin";
      id: string;
      target: "mail" | "connector";
      targetId: string;
      title: string;
      status: "pending" | "connected" | "failed";
      /** The sign-in would be at github.com: the card also offers "I have a token instead". */
      tokenOk?: boolean;
    }
  | { kind: "key"; id: string; targetId: string; title: string; needs?: string; names?: string[] }
  | { kind: "imap"; id: string; targetId: string; title: string; status: "pending" | "connected"; preset?: string }
  /** A service that turned live (its key card is done), or one that failed with the reason in full (decision 141). */
  | { kind: "done"; id: string; targetId: string; title: string }
  | { kind: "problem"; id: string; targetId: string; title: string; text: string }
  /** VAIC's question with tappable answers (`vaic.question`). With `changeId` it confirms a staged change (decision
   * 206): what will change and Yes / No (a skill's card and Add), settled by `vaic.change`. */
  | {
      kind: "ask";
      id: string;
      question: string;
      options: string[];
      changeId?: string;
      title?: string;
      lines?: string[];
      detail?: string;
      /** The answer the owner tapped, while VAIC saves it. */
      answered?: string;
      result?: "saved" | "discarded" | "failed";
    }
) & {
  /** The chat line it appeared after ("" before any): the card stays at that point in the conversation, and later
   * messages and replies go below it (decision 164). */
  after?: string;
};
export type Presence = "idle" | "listening" | "thinking" | "speaking" | "waiting";

export interface HudState {
  city: CityState;
  loaded: boolean;
  /** Counts real snapshot loads (page open, reconnect): the City scene rebuilds only on these, never per event. */
  snapshotAt: number;
  loadError: string | null;
  chat: ChatLine[];
  live: LiveStatus;
  presence: Presence;
  settings: Record<string, unknown> | null;
  turn: VaicTurn | null;
  cards: ConnectCardState[];
}

type Listener = () => void;
const CHAT_KEY = "vaic.chat";
const RESUME_KEY = "vaic.resume";
const RESUME_MS = 30 * 60_000;
const CARDS_KEY = "vaic.cards";
/** Connect cards survive a reload, a new tab or a sign-in that came back (the owner: "why does the pop up in the
 * chat disappear after a while?", 2026-11-10). Approvals are left out: they may have been answered elsewhere, and
 * Needs you keeps them. Cards hold no keys or passwords, only titles and ids. */
const readCards = (): ConnectCardState[] => {
  try {
    return (JSON.parse(localStorage.getItem(CARDS_KEY) ?? "[]") as ConnectCardState[]).filter(
      (c) => c && typeof c.id === "string" && c.kind !== "approve" && c.kind !== "ask",
    );
  } catch {
    return [];
  }
};
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
    snapshotAt: 0,
    loadError: null,
    chat: readChat(),
    live: "connecting",
    presence: "idle",
    settings: null,
    turn: null,
    cards: readCards(),
  };
  private listeners = new Set<Listener>();
  /** Messages whose answer the owner stopped (`owner-<line id>`): anything still in flight for them is dropped. */
  private stoppedIds = new Set<string>();
  /** Messages VAIC has already answered in full: one owner message gets one reply, so a second turn's words for the
   * same message never show as another answer (decision 192). */
  private answeredIds = new Set<string>();
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
    if (patch.cards) {
      try {
        localStorage.setItem(CARDS_KEY, JSON.stringify(patch.cards.filter((c) => c.kind !== "approve")));
      } catch {
        /* storage blocked: the cards last for this session */
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
    this.set({ city, loaded: true, loadError: null, snapshotAt: this.state.snapshotAt + 1 });
    // Work that finished while this page was closed or offline: no longer open in the city, so settled.
    const open = new Set([...Object.keys(city.tickets ?? {}), ...Object.keys(city.parked ?? {})]);
    this.settleTasks((id) => !open.has(id));
  }

  /** Links the ticket VAIC opens to its reply, and settles it when it finishes or its result comes back. */
  private taskEvent(e: { type: string; [k: string]: unknown }) {
    if (e.type === "result" && typeof e.ticket_id === "string") return this.settleTasks((id) => id === e.ticket_id);
    if (e.type !== "ticket.status") return;
    const t = e.ticket as { id: string; from: string; status: string } | undefined;
    if (!t) return;
    if (["done", "failed", "cancelled"].includes(t.status)) return this.settleTasks((id) => id === t.id);
    if (e.previous !== null || t.from !== "vaic") return;
    const turn = this.state.turn;
    const chat = this.state.chat;
    const i = chat.findLastIndex((l) => l.who === "vaic");
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
    // A project's chat (`app-…`, lib/projects.ts) is not VAIC's main chat.
    if ((e.type === "vaic.reply" || e.type === "vaic.question") && String(e.conversation ?? "").startsWith("app-"))
      return;
    if (e.type === "hud.action") return hudAction(e);
    if (e.type === "vaic.question") return this.askEvent(e);
    if (e.type === "vaic.change") return this.changeEvent(e);
    if (e.type === "vaic.stopped") {
      if (String(e.conversation ?? "main") !== "main") return;
      const id = String(e.message_id ?? "").replace(/^owner-/, "");
      return this.stopTurn(id, (e.tools as { activity: string; detail?: string | null }[] | undefined) ?? []);
    }
    if ((e.type === "vaic.reply" || e.type === "vaic.files") && this.stoppedIds.has(String(e.message_id ?? ""))) return; // the owner stopped this answer: a late piece of it never shows
    if (e.type === "vaic.files") {
      if (String(e.conversation ?? "main") !== "main") return;
      return this.vaicFiles((e.files as FileCardData[] | undefined) ?? [], String(e.label ?? ""));
    }
    if (e.type === "vaic.reply") {
      const mid = String(e.message_id ?? "");
      if (mid && this.answeredIds.has(mid)) return; // already answered: the repeat of the final reply, or a second turn
      if (mid && e.done) this.answeredIds.add(mid);
      return this.vaicReply(e as unknown as { conversation: string; text: string; done: boolean });
    }
    if (e.type === "activity" && e.id === "vaic") this.vaicStep(String(e.activity ?? ""), e.detail as string | null);
    this.taskEvent(e);
    this.cardEvent(e);
    this.during?.push(e);
    this.set({ city: reduce(this.state.city, e) });
    for (const l of this.sceneEvents) l(e);
  }
  /** Adds a card, or updates it where it stands (so a card doesn't jump when its status changes). */
  /** Services already announced in the chat this session, so "… is connected, Sir." comes once. */
  private announced = new Set<string>();
  /** Connectors approved on a card in this session, so a failure while setting one up is shown, never silent. */
  private approved = new Set<string>();
  /** VAIC's short line when a service the owner was connecting turns live (written here, not by the model). */
  private announce(key: string, name: string) {
    if (this.announced.has(key)) return;
    this.announced.add(key);
    const line: ChatLine = {
      id: `a-conn-${key}-${Date.now()}`,
      who: "vaic",
      text: `${name} is connected, Sir.`,
      state: "done",
      at: Date.now(),
    };
    this.set({ chat: [...this.state.chat, line] });
  }
  /** The connectors and mail accounts that a card or a waiting request still follows (refreshed on return). */
  following(): { connectors: string[]; mail: string[] } {
    const connectors = new Set(Object.keys(this.resumes()));
    const mail = new Set<string>();
    for (const c of this.state.cards) {
      if (c.kind === "signin" && c.status !== "connected") (c.target === "mail" ? mail : connectors).add(c.targetId);
      if (c.kind === "imap" && c.status !== "connected") mail.add(c.targetId);
      if (c.kind === "key" || c.kind === "problem") connectors.add(c.targetId);
      if (c.kind === "approve" && c.connectorId) connectors.add(c.connectorId);
    }
    return { connectors: [...connectors], mail: [...mail] };
  }
  /** What to do once a service the owner just connected is ready: VAIC carries on with their request (decision 130). */
  onResume: ((text: string) => void) | null = null;
  /** The owner's request that led to each service being offered, by connector id, kept for this tab's session. */
  private resumes(): Record<string, string> {
    try {
      return JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  }
  private setResumes(r: Record<string, string>) {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify(r));
    } catch {
      /* storage blocked: the owner just asks again */
    }
  }
  /** Where each service's cards sit in the conversation: a key or sign-in card that follows an approval card takes
   * its place, so the conversation doesn't jump. */
  private anchors = new Map<string, string>();
  private putCard(c: ConnectCardState) {
    const cards = this.state.cards;
    const have = cards.find((x) => x.id === c.id);
    const key = "targetId" in c ? c.targetId : "connectorId" in c ? c.connectorId : undefined;
    const after = have?.after ?? (key && this.anchors.get(key)) ?? this.state.chat.at(-1)?.id ?? "";
    if (key && !this.anchors.has(key)) this.anchors.set(key, after);
    if (key && (c.kind === "done" || ("status" in c && c.status === "connected"))) this.anchors.delete(key); // finished
    const placed = { ...c, after };
    this.set({ cards: have ? cards.map((x) => (x.id === c.id ? placed : x)) : [...cards, placed] });
  }
  /** VAIC asks with tappable answers (decision 206): a newer question replaces any that is still open. */
  private askEvent(e: { [k: string]: unknown }) {
    if (String(e.conversation ?? "main") !== "main") return;
    const options = Array.isArray(e.options) ? e.options.map(String) : [];
    if (options.length < 2) return;
    const changeId = String(e.id ?? "");
    const lines = Array.isArray(e.lines) ? e.lines.map(String) : [];
    this.set({ cards: this.state.cards.filter((c) => c.kind !== "ask" || c.result !== undefined) });
    this.putCard({
      kind: "ask",
      id: `ask:${changeId || Date.now()}`,
      question: String(e.question ?? ""),
      options,
      ...(changeId ? { changeId } : {}),
      ...(e.title ? { title: String(e.title) } : {}),
      ...(lines.length ? { lines } : {}),
      ...(e.detail ? { detail: String(e.detail) } : {}),
    });
  }
  /** A staged change was saved or discarded: its card says so and its buttons go. */
  private changeEvent(e: { [k: string]: unknown }) {
    if (String(e.conversation ?? "main") !== "main") return;
    const c = this.state.cards.find((x) => x.kind === "ask" && x.changeId === String(e.id ?? ""));
    if (c?.kind !== "ask") return;
    const result = e.saved ? "saved" : c.answered && !/^(no|not now)$/i.test(c.answered) ? "failed" : "discarded";
    this.putCard({ ...c, result });
  }
  /** The owner tapped an answer (`option`) or wrote their own (`option` undefined): a plain question is done, a
   * change waits for `vaic.change`. */
  answerAsk(option?: string) {
    const open = this.state.cards.filter((c) => c.kind === "ask" && c.result === undefined && !c.answered);
    if (!open.length) return;
    this.set({
      cards: this.state.cards.flatMap((c) =>
        !open.includes(c) || c.kind !== "ask" ? [c] : c.changeId ? [option ? { ...c, answered: option } : c] : [],
      ),
    });
  }
  dropCard(id: string) {
    // A connector card the owner answered: what happens next (a sign-in, a key, or a failure) comes back to the chat.
    const c = this.state.cards.find((x) => x.id === id);
    if (c?.kind === "approve" && c.connectorId) this.approved.add(c.connectorId);
    else if (c && "targetId" in c) this.anchors.delete(c.targetId); // asked again later, it comes in at that point
    this.set({ cards: this.state.cards.filter((x) => x.id !== id) });
  }
  /** Connect cards follow the city's events (CONNECTORS_SKILLS.md §3, MAIL_CALENDAR.md §6). */
  private cardEvent(e: { type: string; [k: string]: unknown }) {
    const s = (k: string) => String(e[k] ?? "");
    if (e.type === "approval.requested" && e.kind === "connector.add") {
      // The owner's own words that led here (their latest message, if it is recent): sent again once it's connected.
      const asked = this.state.chat.findLast((l) => l.who === "owner");
      if (s("connector_id") && asked && Date.now() - asked.at < RESUME_MS)
        this.setResumes({ ...this.resumes(), [s("connector_id")]: asked.text });
      return this.putCard({
        kind: "approve",
        id: `ap:${s("id")}`,
        approvalId: s("id"),
        action: s("action"),
        reason: s("reason"),
        connectorId: s("connector_id") || undefined,
      });
    }
    if (e.type === "approval.requested" && e.kind === "ad.spend")
      // Over the owner's ad spend limit: only the owner's yes starts it (decision 240).
      return this.putCard({
        kind: "approve",
        id: `ap:${s("id")}`,
        approvalId: s("id"),
        action: s("reason"),
        reason: "",
        spend: true,
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
          ? {
              kind: "imap",
              id: `mail:${s("account_id")}`,
              targetId: s("account_id"),
              title,
              status: "pending",
              ...(s("preset") ? { preset: s("preset") } : {}),
            }
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
      if (a.status === "connected" && (card.kind === "signin" || card.kind === "imap")) {
        if (card.status !== "connected")
          this.announce(
            card.id,
            String(
              (e.account as { label?: string }).label ??
                card.title.replace(/^(Sign in to|Add the app password for) /, ""),
            ),
          );
        return this.putCard({ ...card, status: "connected" });
      }
      if (a.status === "error" && card.kind === "signin") return this.putCard({ ...card, status: "failed" });
      return;
    }
    if (e.type === "connector.updated") {
      const id = `conn:${s("id")}`;
      const label = s("label") || s("id");
      const status = s("status");
      const waiting = this.resumes();
      const followed = this.following().connectors.includes(s("id"));
      if (status === "ready" && followed) this.announce(id, label);
      if ((status === "ready" || status === "removed") && s("id") in waiting) {
        const { [s("id")]: text, ...rest } = waiting;
        this.setResumes(rest);
        if (status === "ready" && text) this.onResume?.(`${label} is connected now. Please carry on with: ${text}`);
      }
      if (status === "removed") return this.dropCard(id);
      if (status === "needs_login" || status === "login_expired")
        return this.putCard({
          kind: "signin",
          id,
          target: "connector",
          targetId: s("id"),
          title: `Sign in to ${label}`,
          status: "pending",
          tokenOk: s("oauth_host") === "github.com",
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
      if (status === "ready" && (card?.kind === "key" || card?.kind === "problem"))
        return this.putCard({ kind: "done", id, targetId: s("id"), title: label });
      // Every error in full, on the card that was following it (the owner's rule).
      if (status === "error" && (card || followed || this.approved.has(s("id"))))
        return this.putCard({
          kind: "problem",
          id,
          targetId: s("id"),
          title: label,
          text: s("error") || "It didn't connect.",
        });
      if (status === "syncing" && card?.kind === "key") return this.dropCard(id);
    }
  }
  /** The published apps from `GET /apps` (the snapshot and the app events keep them current too). */
  setApps(list: CityApp[]) {
    const apps: Record<string, CityApp> = {};
    for (const a of list) if (a?.app_id) apps[a.app_id] = a;
    this.set({ city: { ...this.state.city, apps } });
  }
  /** Starts VAIC's turn: the status row shows from now until its first words. */
  /** The owner's message VAIC is still working on (thinking or writing), if any: what Stop would drop. */
  busyLine(): ChatLine | undefined {
    if (!this.state.turn) return undefined;
    const chat = this.state.chat;
    const i = chat.findLastIndex((l) => l.who === "owner");
    const line = chat[i];
    if (!line || line.stopped || line.refused) return undefined;
    return chat.slice(i + 1).some((l) => l.who === "vaic" && l.state === "done") ? undefined : line;
  }
  /** Stop (decision 183): the owner's line stays, marked stopped; VAIC's half-written answer goes; the turn ends.
   * Also run when VAIC confirms it dropped the turn (`vaic.stopped`, on every open HUD), with the tools it had
   * already called. */
  stopTurn(lineId: string, tools: { activity: string; detail?: string | null }[] = []) {
    this.stoppedIds.add(`owner-${lineId}`);
    const chat = this.state.chat;
    const i = chat.findIndex((l) => l.id === lineId && l.who === "owner");
    if (i < 0) return;
    const steps = [...new Set(tools.map((t) => stepWords(t.activity, t.detail)).filter((w): w is string => !!w))];
    const handedOn = tools.some((t) => t.activity === "delegating" || /delegate_to_orchestrator/.test(t.detail ?? ""));
    const line = chat[i]!;
    // Only VAIC's half-written answer to this message goes, never a reply to a message sent after it.
    const end = chat.findIndex((l, j) => j > i && l.who === "owner");
    const next = chat
      .filter((l, j) => !(j > i && (end < 0 || j < end) && l.who === "vaic" && l.state === "streaming"))
      .map((l) =>
        l === line
          ? {
              ...l,
              stopped: true,
              ...(steps.length ? { stoppedSteps: steps } : {}),
              ...(handedOn || l.handedOn ? { handedOn: true } : {}),
            }
          : l,
      );
    const presence = this.state.presence;
    const wasCurrent = this.busyLine()?.id === lineId; // a late confirmation must not end a newer turn
    this.set({
      chat: next,
      ...(wasCurrent ? { turn: null, presence: presence === "listening" ? "listening" : "idle" } : {}),
    });
  }
  /** "Edit": a stopped message leaves the chat; its words go back in the box. */
  removeLine(id: string) {
    this.set({ chat: this.state.chat.filter((l) => l.id !== id) });
  }
  beginTurn() {
    this.set({ turn: { started: Date.now(), steps: [FIRST_STEP] } });
  }
  private vaicStep(activity: string, detail?: string | null) {
    const words = stepWords(activity, detail);
    const turn = this.state.turn;
    if (!words || !turn || turn.steps.at(-1) === words) return;
    this.set({ turn: { ...turn, steps: [...turn.steps, words] } });
  }
  /** Files VAIC shows (show_files): on its reply to this turn, or held for that reply until its first words. */
  private vaicFiles(cards: FileCardData[], label = "") {
    if (!cards.length) return;
    if (label) {
      // A labelled set (the references a build uses) is its own line, never merged into a reply's cards.
      return this.set({
        chat: [
          ...this.state.chat,
          {
            id: `a-files-${Date.now()}`,
            who: "vaic",
            text: "",
            state: "done",
            at: Date.now(),
            files: cards,
            filesLabel: label,
          },
        ],
      });
    }
    const merge = (have: FileCardData[] = []) => [...have, ...cards.filter((c) => !have.some((h) => h.id === c.id))];
    const turn = this.state.turn;
    const chat = this.state.chat;
    const i = chat.findLastIndex((l) => l.who === "vaic");
    const line = chat[i];
    if (turn && (!line || line.at < turn.started)) return this.set({ turn: { ...turn, files: merge(turn.files) } });
    if (line && turn) {
      const next = [...chat];
      next[i] = { ...line, files: merge(line.files) };
      return this.set({ chat: next });
    }
    // No turn in this tab (another device asked): the files arrive as VAIC's own line.
    this.set({
      chat: [
        ...chat,
        { id: `a-files-${Date.now()}`, who: "vaic", text: "", state: "done", at: Date.now(), files: cards },
      ],
    });
  }
  private vaicReply(e: { text: string; done: boolean }) {
    const chat = [...this.state.chat];
    const last = chat.at(-1);
    // The final reply arrives twice (straight from VAIC, and through the event bus as a safety net).
    if (e.done && last?.who === "vaic" && last.state === "done" && last.text === e.text) return;
    if (last?.who === "vaic" && last.state === "streaming")
      chat[chat.length - 1] = {
        ...last,
        text: e.done ? e.text : last.text + e.text,
        state: e.done ? "done" : "streaming",
        steps: this.state.turn?.steps ?? last.steps,
      };
    else
      chat.push({
        id: `a-${Date.now()}`,
        who: "vaic",
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
              ...(this.state.turn.files?.length ? { files: this.state.turn.files } : {}),
            }
          : {}),
      });
    // "speaking" comes only from audio really playing (the voice sets it when a clip starts). A finished reply
    // ends "thinking"; while VAIC already speaks its first sentences, more pieces must not flip it back.
    const presence =
      this.state.presence === "speaking"
        ? "speaking"
        : e.done
          ? this.state.presence === "listening"
            ? "listening"
            : "idle"
          : "thinking";
    this.set({ chat, presence, ...(e.done ? { turn: null } : {}) });
  }
}

export const store = new Store();
export const useHud = <T>(pick: (s: HudState) => T): T =>
  useSyncExternalStore(store.subscribe, () => pick(store.get()));

/** Things waiting for the owner that can still be answered (lib/needs.ts): the badge, the City's box, Needs you. */
export const waitingCount = (s: HudState) => needsCount(s.city);

/** Where connect cards go in the conversation: each one just before the first message the owner sent after the
 * point it appeared (so VAIC's reply in that turn stays above it and everything later goes below), or at the end.
 * `before[i]` are the cards shown just before chat line i. */
export function placeCards(
  chat: { id: string; who: string }[],
  cards: ConnectCardState[],
): { before: Map<number, ConnectCardState[]>; end: ConnectCardState[] } {
  const before = new Map<number, ConnectCardState[]>();
  const end: ConnectCardState[] = [];
  for (const c of cards) {
    const from = c.after === "" ? -1 : c.after === undefined ? chat.length : chat.findIndex((l) => l.id === c.after);
    const at = from < 0 && c.after !== "" ? -1 : chat.findIndex((l, i) => i > from && l.who === "owner");
    if (at < 0) end.push(c);
    else before.set(at, [...(before.get(at) ?? []), c]);
  }
  return { before, end };
}
