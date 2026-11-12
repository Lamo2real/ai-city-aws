// Projects (docs/PRODUCT.md "Projects"): every app is a project with its own chat with VAIC, a timeline of what
// is happening, and its versions. A project's chat is the conversation `app-<app_id>`; a project started from
// "New project" is `app-new-<short id>` until its app is published. Replies come as `vaic.reply` events with
// that conversation, multiple-choice questions also as `vaic.question` events. The timeline comes from
// `GET /apps/<id>/activity` when the server has it, and otherwise from the city events this page sees.
import type { FileCardData } from "./files.ts";
import { useSyncExternalStore } from "react";
import type { CityApp } from "../city/city-state.js";
import { api, ApiError } from "./api.ts";
import { appList, capped } from "./apps.ts";
import { loadLines, mergeLines, missingOnServer, type ServerLine } from "./cloudChat.ts";
import { looksLikeKey } from "./connect.ts";

export interface ProjectLine {
  id: string;
  who: "owner" | "vaic";
  text: string;
  state: "sending" | "sent" | "failed" | "streaming" | "done";
  at: number;
  /** Files VAIC put in this chat (decision 155: the references a build uses), with a heading. */
  files?: FileCardData[];
  filesLabel?: string;
}
export interface ProjectAsk {
  question: string;
  options: string[];
}
export interface TimelineItem {
  at: string;
  who: string;
  text: string;
}
/** A project started here whose app is not published yet. */
export interface NewProject {
  key: string; // "new-<id>": the route slug; the conversation is `app-<key>`
  idea: string;
  title: string;
  at: number;
  /** Not on the server yet (saving failed): saved again on the next sync. */
  local?: boolean;
}
export interface Project {
  /** Route slug: the app's slug, or "new-<id>". */
  slug: string;
  conversation: string;
  title: string;
  app: CityApp | null;
  idea?: string;
  at: number;
}

interface State {
  chats: Record<string, ProjectLine[]>;
  asks: Record<string, ProjectAsk>;
  thinking: Record<string, boolean>;
  /** Timeline lines made from city events, by conversation. */
  feed: Record<string, TimelineItem[]>;
  drafts: NewProject[];
}

const CHATS = "vaic.projects.chats";
const DRAFTS = "vaic.projects.new";
/** Set once this device's projects and chats from before decision 299 are on the server. */
const UPLOADED = "vaic.projects.uploaded";

const read = <T>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: works for this session */
  }
};

export const conversationOf = (app: Pick<CityApp, "app_id">) => `app-${app.app_id}`;
const newId = () => Math.random().toString(36).slice(2, 10);

/** A short title from the owner's idea: its first words, capitalised. VAIC names the app when it publishes. */
export function titleFromIdea(idea: string): string {
  const t = capped(idea, 200)
    .replace(/^(please\s+)?(can you\s+)?((build|make|create)( me)?\s+)?(an?|the)\s+/i, "")
    .replace(/[.!?].*$/, "");
  const list = t.split(" ").slice(0, 5);
  while (list.length > 1 && /^(a|an|the|and|or|of|for|with|that|to|in|on|my)$/i.test(list.at(-1)!)) list.pop();
  const words = list.join(" ");
  const out = words.charAt(0).toUpperCase() + words.slice(1);
  return capped(out || "New project", 40);
}

class Projects {
  state: State = {
    chats: read<Record<string, ProjectLine[]>>(CHATS, {}),
    asks: {},
    thinking: {},
    feed: {},
    drafts: read<NewProject[]>(DRAFTS, []),
  };
  private listeners = new Set<() => void>();
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    if (patch.chats) {
      // Keep the 20 most recent conversations, 60 lines each.
      const recent = Object.entries(patch.chats)
        .sort((a, b) => (b[1].at(-1)?.at ?? 0) - (a[1].at(-1)?.at ?? 0))
        .slice(0, 20)
        .map(([k, v]) => [k, v.slice(-60)]);
      write(CHATS, Object.fromEntries(recent));
    }
    if (patch.drafts) write(DRAFTS, patch.drafts);
    for (const l of this.listeners) l();
  }
  private lines(conv: string) {
    return this.state.chats[conv] ?? [];
  }
  private putLines(conv: string, lines: ProjectLine[]) {
    this.set({ chats: { ...this.state.chats, [conv]: lines } });
  }
  private patchLine(conv: string, id: string, patch: Partial<ProjectLine>) {
    this.putLines(
      conv,
      this.lines(conv).map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }
  private addFeed(conv: string, who: string, text: string) {
    const list = this.state.feed[conv] ?? [];
    if (list.at(-1)?.text === text) return;
    this.set({
      feed: { ...this.state.feed, [conv]: [...list, { at: new Date().toISOString(), who, text }].slice(-40) },
    });
  }

  /** Sends the owner's words to VAIC in this project's conversation. */
  async send(conv: string, text: string) {
    const clean = text.trim();
    if (!clean) return;
    if (looksLikeKey(clean))
      throw new Error("That looks like a key or password, so it wasn't sent. If it was a real key, revoke it.");
    const line: ProjectLine = {
      id: `p${Date.now().toString(36)}${newId()}`,
      who: "owner",
      text: clean,
      state: "sending",
      at: Date.now(),
    };
    const { [conv]: _answered, ...asks } = this.state.asks;
    this.set({ asks, thinking: { ...this.state.thinking, [conv]: true } });
    this.putLines(conv, [...this.lines(conv), line]);
    await this.deliver(conv, line);
  }
  async retry(conv: string, id: string) {
    const line = this.lines(conv).find((l) => l.id === id);
    if (!line) return;
    this.patchLine(conv, id, { state: "sending" });
    this.set({ thinking: { ...this.state.thinking, [conv]: true } });
    await this.deliver(conv, line);
  }
  private async deliver(conv: string, line: ProjectLine) {
    try {
      await api("/messages", { method: "POST", body: { text: line.text, conversation: conv, client_id: line.id } });
      this.patchLine(conv, line.id, { state: "sent" });
    } catch (e) {
      this.patchLine(conv, line.id, { state: "failed" });
      this.set({ thinking: { ...this.state.thinking, [conv]: false } });
      if (e instanceof ApiError && e.status > 0 && e.status < 500) throw e;
    }
  }

  /** Starts a new project from one sentence: its own conversation, whose first message is the idea. */
  async start(idea: string): Promise<NewProject> {
    const p: NewProject = {
      key: `new-${newId()}`,
      idea: capped(idea, 2000),
      title: titleFromIdea(idea),
      at: Date.now(),
    };
    this.set({ drafts: [p, ...this.state.drafts].slice(0, 30) });
    void this.save(p);
    this.addFeed(`app-${p.key}`, "You", "You started this project");
    await this.send(`app-${p.key}`, idea);
    return p;
  }
  /**
   * An app built from a new project's chat (`app-new-…`) continues as `app-<app_id>`: the lines, the timeline
   * and any open question move over, and the project leaves the list of drafts.
   */
  adopt(appId: string, from: string) {
    const to = `app-${appId}`;
    if (!from.startsWith("app-new-") || from === to) return;
    const key = from.slice(4);
    const moved = this.state.chats[from];
    if (!moved && !this.state.drafts.some((d) => d.key === key)) return;
    const { [from]: _c, ...chats } = this.state.chats;
    const { [from]: _f, ...feed } = this.state.feed;
    const { [from]: ask, ...asks } = this.state.asks;
    const { [from]: busy, ...thinking } = this.state.thinking;
    this.set({
      chats: { ...chats, [to]: [...(moved ?? []), ...(chats[to] ?? [])] },
      feed: { ...feed, [to]: [...(this.state.feed[from] ?? []), ...(feed[to] ?? [])] },
      asks: ask ? { ...asks, [to]: ask } : asks,
      thinking: busy ? { ...thinking, [to]: busy } : thinking,
      drafts: this.state.drafts.filter((d) => d.key !== key),
    });
    void api(`/projects/${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => undefined);
  }
  forget(key: string) {
    const { [`app-${key}`]: _gone, ...chats } = this.state.chats;
    this.set({ drafts: this.state.drafts.filter((d) => d.key !== key), chats });
    void api(`/projects/${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => undefined);
  }

  // ---------- the server's copy (decision 299) ----------
  private async save(p: NewProject): Promise<boolean> {
    try {
      await api(`/projects/${encodeURIComponent(p.key)}`, {
        method: "PUT",
        body: { idea: p.idea, title: p.title, at: p.at },
      });
      if (p.local) this.set({ drafts: this.state.drafts.map((d) => (d.key === p.key ? { ...d, local: false } : d)) });
      return true;
    } catch {
      this.set({ drafts: this.state.drafts.map((d) => (d.key === p.key ? { ...d, local: true } : d)) });
      return false;
    }
  }
  private syncing: Promise<void> | null = null;
  /** On open, on return to the page and after a reconnect: the projects list from the server, once uploading what
   *  this device kept before projects lived there. */
  sync(): Promise<void> {
    this.syncing ??= this.doSync().finally(() => (this.syncing = null));
    return this.syncing;
  }
  private async doSync() {
    let uploaded = false;
    try {
      uploaded = localStorage.getItem(UPLOADED) === "1";
    } catch {
      /* no storage: nothing kept here to upload */
    }
    if (!uploaded && !(await this.upload())) return;
    for (const d of this.state.drafts.filter((x) => x.local)) await this.save(d);
    let list: NewProject[];
    try {
      list = (await api<{ projects?: NewProject[] }>("/projects")).projects ?? [];
    } catch {
      return; // offline: the cache stands
    }
    const server = list
      .filter((p) => p && typeof p.key === "string" && p.key.startsWith("new-"))
      .map((p) => ({ key: p.key, idea: capped(p.idea, 2000), title: capped(p.title, 40), at: Number(p.at) || 0 }));
    const have = new Set(server.map((p) => p.key));
    const pending = this.state.drafts.filter((d) => d.local && !have.has(d.key));
    this.set({ drafts: [...pending, ...server].sort((a, b) => b.at - a.at).slice(0, 30) });
  }
  /** The one-time upload: this device's drafts, and the chat lines the server doesn't have. False = try again. */
  private async upload(): Promise<boolean> {
    try {
      for (const d of this.state.drafts)
        await api(`/projects/${encodeURIComponent(d.key)}`, {
          method: "PUT",
          body: { idea: d.idea, title: d.title, at: d.at },
        });
      for (const [conv, lines] of Object.entries(this.state.chats)) {
        const server = await loadLines(conv);
        if (!server) return false;
        const missing = missingOnServer(lines, server, "vaic");
        if (missing.length)
          await api(`/conversations/${encodeURIComponent(conv)}/lines`, {
            method: "POST",
            body: { lines: missing.map((l) => ({ id: l.id, who: l.who, text: l.text, at: l.at })) },
          });
      }
      localStorage.setItem(UPLOADED, "1");
      return true;
    } catch {
      return false;
    }
  }
  /** A project's chat from the server, added to what this device has. */
  async loadChat(conv: string) {
    const server = await loadLines(conv);
    if (!server?.length) return;
    const make = (s: ServerLine, who: "owner" | "vaic"): ProjectLine => ({
      id: `s-${s.id.replace(/[^\w-]/g, "")}`,
      who,
      text: s.text,
      state: who === "vaic" ? "done" : "sent",
      at: Date.parse(s.at) || 0,
    });
    const next = mergeLines(this.lines(conv), server, make, "vaic");
    if (next !== this.lines(conv)) this.putLines(conv, next);
  }

  /** City events: replies and questions for project conversations, and timeline lines about apps. */
  event(e: { type: string; [k: string]: unknown }) {
    const conv = typeof e.conversation === "string" ? e.conversation : "";
    if (e.type === "project.saved") {
      const p = (e.project ?? {}) as Partial<NewProject>;
      if (typeof p.key !== "string" || !p.key.startsWith("new-")) return;
      const rec = {
        key: p.key,
        idea: capped(p.idea, 2000),
        title: capped(p.title, 40),
        at: Number(p.at) || Date.now(),
      };
      const rest = this.state.drafts.filter((d) => d.key !== rec.key);
      return this.set({ drafts: [rec, ...rest].sort((a, b) => b.at - a.at).slice(0, 30) });
    }
    if (e.type === "project.removed" && typeof e.key === "string") {
      if (!this.state.drafts.some((d) => d.key === e.key)) return;
      return this.set({ drafts: this.state.drafts.filter((d) => d.key !== e.key) });
    }
    if (e.type === "owner.line" && conv.startsWith("app-")) {
      // The owner wrote from another device: the line shows here too (this device already has its own).
      const id = String(e.client_id ?? "");
      if (!id || this.lines(conv).some((l) => l.id === id)) return;
      const line: ProjectLine = {
        id,
        who: "owner",
        text: String(e.text ?? "").slice(0, 8000),
        state: "sent",
        at: Date.now(),
      };
      this.set({ thinking: { ...this.state.thinking, [conv]: true } });
      return this.putLines(conv, [...this.lines(conv), line]);
    }
    if (e.type === "vaic.reply" && conv.startsWith("app-")) return this.reply(conv, String(e.text ?? ""), !!e.done);
    if (e.type === "vaic.files" && conv.startsWith("app-")) {
      const files = (Array.isArray(e.files) ? e.files : []) as FileCardData[];
      if (!files.length) return;
      const lines = [...this.lines(conv)];
      lines.push({
        id: `f${Date.now().toString(36)}${newId()}`,
        who: "vaic",
        text: "",
        state: "done",
        at: Date.now(),
        files,
        filesLabel: typeof e.label === "string" ? e.label : "",
      });
      return this.putLines(conv, lines);
    }
    if (e.type === "vaic.question" && conv.startsWith("app-")) {
      const options = (Array.isArray(e.options) ? e.options : [])
        .map((o) => capped(o, 80))
        .filter(Boolean)
        .slice(0, 6);
      if (!options.length) return;
      this.set({ asks: { ...this.state.asks, [conv]: { question: capped(e.question, 300), options } } });
      return;
    }
    if (e.type === "app.published" && typeof e.app_id === "string" && conv) this.adopt(e.app_id, conv);
    const words = eventWords(e);
    if (words) this.addFeed(words.conv, words.who, words.text);
  }
  private reply(conv: string, text: string, done: boolean) {
    const lines = [...this.lines(conv)];
    const last = lines.at(-1);
    // The final reply arrives twice (straight from VAIC, and through the event bus).
    if (done && last?.who === "vaic" && last.state === "done" && last.text === text) return;
    if (last?.who === "vaic" && last.state === "streaming")
      lines[lines.length - 1] = { ...last, text: done ? text : last.text + text, state: done ? "done" : "streaming" };
    else
      lines.push({
        id: `a${Date.now().toString(36)}${newId()}`,
        who: "vaic",
        text,
        state: done ? "done" : "streaming",
        at: Date.now(),
      });
    this.putLines(conv, lines);
    if (done) this.set({ thinking: { ...this.state.thinking, [conv]: false } });
  }
}

/** One city event in plain words for a project's timeline, or null when it isn't about an app. */
export function eventWords(e: {
  type: string;
  [k: string]: unknown;
}): { conv: string; who: string; text: string } | null {
  const app = (e.app ?? null) as Partial<CityApp> | null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (e.type === "app.published" && s(e.app_id))
    return { conv: `app-${s(e.app_id)}`, who: "VAIC", text: "The app is live" };
  if (e.type === "app.updated" && app?.app_id && app.version)
    return { conv: `app-${app.app_id}`, who: "VAIC", text: `Version ${app.version} is live` };
  if (e.type === "approval.requested" && e.kind === "app.publish" && s(e.replaces))
    return {
      conv: `app-${s(e.replaces)}`,
      who: "Builder",
      text: "A new version is ready for you to try in Open items (Settings → While I'm away)",
    };
  if (e.type === "app.draft" && s(e.replaces)) {
    const st = s(e.status);
    const text =
      st === "rejected"
        ? "The new version didn't pass the checks; the builders try again"
        : st === "ready"
          ? "The builders finished a new version"
          : "The builders are working on a new version";
    return { conv: `app-${s(e.replaces)}`, who: "Builder", text };
  }
  if (e.type === "ticket.status") {
    const t = (e.ticket ?? {}) as { app_id?: string; status?: string };
    if (!t.app_id) return null;
    const words: Record<string, string> = {
      open: "The builders got the work",
      running: "The builders are working on it",
      done: "The builders finished their part",
      failed: "Part of the work did not finish",
    };
    return words[t.status ?? ""] ? { conv: `app-${t.app_id}`, who: "Builder", text: words[t.status ?? ""]! } : null;
  }
  return null;
}

export const projects = new Projects();
export const useProjects = <T>(pick: (s: State) => T): T =>
  useSyncExternalStore(projects.subscribe, () => pick(projects.get()));

/** Every project, newest first: drafts started here (not yet published), then the published apps. */
export function projectList(apps: Record<string, CityApp> | undefined, drafts: NewProject[]): Project[] {
  const published = appList(apps);
  const live = new Set(published.map((a) => (a as CityApp & { conversation?: string }).conversation).filter(Boolean));
  return [
    ...drafts
      .filter((d) => !live.has(`app-${d.key}`))
      .map((d) => ({ slug: d.key, conversation: `app-${d.key}`, title: d.title, app: null, idea: d.idea, at: d.at })),
    ...published.map((a) => ({
      slug: a.slug,
      conversation: conversationOf(a),
      title: capped(a.title, 40),
      app: a,
      at: Date.parse(a.published_at ?? "") || 0,
    })),
  ];
}

/** The server's timeline for an app; null when the server doesn't have one (yet). */
export async function loadActivity(appId: string): Promise<TimelineItem[] | null> {
  try {
    const r = await api<{ items?: TimelineItem[] }>(`/apps/${encodeURIComponent(appId)}/activity`);
    return (r.items ?? [])
      .filter((i) => i && typeof i.text === "string")
      .map((i) => ({ at: String(i.at ?? ""), who: capped(i.who || "VAIC", 24), text: capped(i.text, 240) }));
  } catch {
    return null;
  }
}

// ---------- the preview's sizes ----------
export type Device = "fill" | "phone" | "tablet" | "laptop" | "custom";
export const DEVICES: Record<Exclude<Device, "fill" | "custom">, { label: string; w: number; h: number }> = {
  phone: { label: "Phone", w: 390, h: 844 },
  tablet: { label: "Tablet", w: 820, h: 1180 },
  laptop: { label: "Laptop", w: 1440, h: 900 },
};
export const ZOOMS = [0.5, 0.75, 1] as const;
export const clampSize = (n: number) => Math.max(240, Math.min(3840, Math.round(Number.isFinite(n) ? n : 0)));
/** The scale that fits a w×h page into the stage, never above 1. */
export const fitScale = (w: number, h: number, stageW: number, stageH: number) =>
  stageW > 0 && stageH > 0 ? Math.min(1, stageW / w, stageH / h) : 1;
