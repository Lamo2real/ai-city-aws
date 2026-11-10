// A project's build steps, the way Claude shows its own (the owner, 2026-11-10, decision 204): every tool a builder
// uses arrives as an "activity" event with a short, secret-blanked line ("Ran npm run build", "Created an SVG image:
// cards.svg", "Searched your knowledge: brand colours", "Pushed the code to GitHub"). Each step is filed under the
// project conversation its job came from, when it arrives (finished jobs leave the city's live state), and kept on
// this device so a reload keeps the log.
import { useSyncExternalStore } from "react";
import type { CityState, CityTicket } from "../city/city-state.js";

export interface Step {
  at: number;
  agent: string;
  activity: string;
  text: string;
}
export type StepKind = "command" | "github" | "edit" | "image" | "read" | "web" | "knowledge" | "other";

const KEY = "vaic.buildsteps";
const PER_PROJECT = 200;

const read = (): Record<string, Step[]> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Step[]>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

/** The project conversation ("app-…") an agent's work belongs to, from its job and the jobs above it. */
export function conversationOf(city: CityState, agentId: string): string | null {
  const tickets = city.tickets as Record<string, CityTicket & { conversation?: string | null }>;
  const agent = city.agents[agentId] as { ticket_id?: string } | undefined;
  let t = (agent?.ticket_id ? tickets[agent.ticket_id] : undefined) ?? Object.values(tickets).find((x) => x.to === agentId);
  for (let hops = 0; t && hops < 20; hops++) {
    if (t.conversation?.startsWith("app-")) return t.conversation;
    t = t.parent_id ? tickets[t.parent_id] : undefined;
  }
  return null;
}

/** Whether any live job (not finished) belongs to this project conversation. */
export function building(city: CityState, conv: string): boolean {
  const tickets = city.tickets as Record<string, CityTicket & { conversation?: string | null }>;
  const top = (t: CityTicket & { conversation?: string | null }) => {
    let x: (typeof t) | undefined = t;
    for (let hops = 0; x && hops < 20; hops++) {
      if (x.conversation) return x.conversation;
      x = x.parent_id ? tickets[x.parent_id] : undefined;
    }
    return null;
  };
  return Object.values(tickets).some((t) => top(t) === conv);
}

export function stepKind(s: Pick<Step, "activity" | "text">): StepKind {
  const t = s.text;
  if (/^(Pushed the code to GitHub|GitHub:)/.test(t)) return "github";
  if (/^(Created|Edited) an? (SVG )?image/.test(t)) return "image";
  if (/^(Created|Edited) /.test(t)) return "edit";
  if (/^Ran /.test(t)) return "command";
  if (/^(Read |Looked for files|Searched the code)/.test(t) && !/^Read a web page/.test(t)) return "read";
  if (/^(Searched the web|Read a web page|Browsed|Used the browser)/.test(t)) return "web";
  if (/your knowledge/.test(t)) return "knowledge";
  return "other";
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)));
/** A run of steps of one kind, in a few words: "Ran 3 commands", "Edited 2 files". */
export function groupLabel(kind: StepKind, n: number): string {
  switch (kind) {
    case "command":
      return plural(n, "Ran a command", "Ran {n} commands");
    case "github":
      return plural(n, "Worked with GitHub", "Worked with GitHub ({n} steps)");
    case "edit":
      return plural(n, "Edited a file", "Edited {n} files");
    case "image":
      return plural(n, "Made an image", "Made {n} images");
    case "read":
      return plural(n, "Read a file", "Read {n} files");
    case "web":
      return plural(n, "Looked something up online", "Looked up {n} things online");
    case "knowledge":
      return plural(n, "Checked your knowledge", "Checked your knowledge {n} times");
    default:
      return plural(n, "Did one more step", "Did {n} more steps");
  }
}

/** Steps in a row of the same kind, as Claude groups them. */
export function groupSteps(list: Step[]): Array<{ kind: StepKind; steps: Step[] }> {
  const out: Array<{ kind: StepKind; steps: Step[] }> = [];
  for (const s of list) {
    const kind = stepKind(s);
    const last = out.at(-1);
    if (last && last.kind === kind) last.steps.push(s);
    else out.push({ kind, steps: [s] });
  }
  return out;
}

class Steps {
  state: Record<string, Step[]> = read();
  private listeners = new Set<() => void>();
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  /** Called after the city store has taken the event, so the agent's job is known. */
  event(e: { type: string; [k: string]: unknown }, city: CityState) {
    if (e.type !== "activity" || typeof e.detail !== "string" || !e.detail || typeof e.id !== "string") return;
    const conv = conversationOf(city, e.id);
    if (!conv) return;
    const step: Step = { at: Date.now(), agent: e.id, activity: String(e.activity ?? ""), text: e.detail.slice(0, 240) };
    const list = [...(this.state[conv] ?? []), step].slice(-PER_PROJECT);
    this.state = { ...this.state, [conv]: list };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* storage full or blocked: the log lasts for this session */
    }
    for (const l of this.listeners) l();
  }
  /** A project that moved to its published app's conversation keeps its log. */
  move(from: string, to: string) {
    if (!this.state[from] || from === to) return;
    const { [from]: moved, ...rest } = this.state;
    this.state = { ...rest, [to]: [...(rest[to] ?? []), ...moved!] };
    for (const l of this.listeners) l();
  }
}

export const buildSteps = new Steps();
export const useBuildSteps = (conv: string): Step[] | undefined =>
  useSyncExternalStore(buildSteps.subscribe, () => buildSteps.get()[conv]);
