// Tickets (decisions 131 and 135): the support desk's board in Work (`#/tickets/customers`). Each customer issue
// Customer Support picks up from Slack, the support inbox or chat, who it went to, when it was fixed and when the
// customer was told; and each piece of work one department hands to another (kind "handoff"), back to the team
// that asked. Tickets come from `GET /support-tickets` and stay current through `support.ticket` events.
// A 404 means the backend is not deployed yet: the empty state, quietly.
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "../lib/api.ts";
import { ago } from "../lib/format.ts";
import { live } from "../lib/ws.ts";
import { Banner, Button, Loading } from "./ui.tsx";

export type SupportStatus = "new" | "with_team" | "fixed" | "replying" | "closed" | "stuck";
export interface SupportTicket {
  id: string;
  number: number;
  title: string;
  details: string;
  customer: string;
  channel: "slack" | "email" | "chat" | "phone" | "other" | "handoff";
  where: string;
  thread: string;
  department: string;
  status: SupportStatus;
  words: string;
  tracker: string;
  tracker_key: string;
  resolution: string;
  history: Array<{ at: string; who: string; text: string }>;
  team_job: string;
  reply_job: string;
  created_at: string;
  updated_at: string;
  /** Missing on old tickets: a customer ticket. */
  kind?: "customer" | "handoff";
  from_department?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  ref?: string;
  parent?: string;
  chain?: string[];
  jira?: boolean;
}
export const isHandoff = (t: Pick<SupportTicket, "kind">) => t.kind === "handoff";

interface State {
  tickets: Record<string, SupportTicket>;
  loaded: boolean;
  /** Loading failed for a reason other than a 404. */
  error: boolean;
}
type Listener = () => void;
class SupportStore {
  state: State = { tickets: {}, loaded: false, error: false };
  private listeners = new Set<Listener>();
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
  /** Adds or replaces a ticket, unless what we hold is newer (events and API answers can cross). */
  put(t: SupportTicket | undefined | null) {
    if (!t?.id) return;
    const had = this.state.tickets[t.id];
    if (had && had.updated_at && t.updated_at && had.updated_at > t.updated_at) return;
    this.set({ tickets: { ...this.state.tickets, [t.id]: t } });
  }
  async load() {
    try {
      const r = await api<{ tickets: SupportTicket[] }>("/support-tickets");
      const tickets: Record<string, SupportTicket> = {};
      for (const t of r.tickets ?? []) if (t?.id) tickets[t.id] = t;
      this.set({ tickets, loaded: true, error: false });
    } catch (e) {
      // Not deployed yet (404): nothing to show. Other problems: keep what we have; events still arrive.
      if (e instanceof ApiError && e.status === 404) this.set({ tickets: {}, loaded: true, error: false });
      else this.set({ loaded: true, error: true });
    }
  }
  /** WebSocket events; only "support.ticket" is ours. */
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type !== "support.ticket") return;
    this.put(e.ticket as SupportTicket | undefined);
  }
}
export const support = new SupportStore();

/** Open ones (not closed) first, newest first within each. */
export function sortTickets(list: SupportTicket[]): SupportTicket[] {
  return [...list].sort(
    (a, b) =>
      Number(a.status === "closed") - Number(b.status === "closed") ||
      (b.created_at || "").localeCompare(a.created_at || ""),
  );
}

/** "Acme, on Slack #support" / "bo@example.com, by email" / "Marketing → Sales". */
export function fromWords(
  t: Pick<SupportTicket, "customer" | "channel" | "where" | "kind" | "chain" | "from_department" | "department">,
): string {
  if (isHandoff(t))
    return (t.chain && t.chain.length > 1 ? t.chain : [t.from_department || "A team", t.department]).join(" → ");
  const who = t.customer || "A customer";
  if (t.channel === "slack") return `${who}, on Slack${t.where ? ` ${t.where}` : ""}`;
  if (t.channel === "email") return `${who}, by email`;
  if (t.channel === "chat") return `${who}, in chat`;
  if (t.channel === "phone") return `${who}, by phone`;
  return t.where ? `${who}, from ${t.where}` : who;
}

function replyWords(t: SupportTicket): string {
  if (t.channel === "slack") return `On Slack${t.where ? ` ${t.where}` : ""}, in the customer's thread.`;
  if (t.channel === "email") return `By email to ${t.customer}${t.where ? `, from ${t.where}` : ""}.`;
  if (t.channel === "chat") return `In the chat${t.where ? ` (${t.where})` : ""}.`;
  if (t.channel === "phone") return `By phone to ${t.customer}.`;
  return t.where ? `To ${t.where}.` : `To ${t.customer}.`;
}

const ORDER: SupportStatus[] = ["new", "with_team", "fixed", "replying", "closed"];
/** How many of the five steps are reached (1 = received). Stuck: as far as the jobs show. */
function reached(t: SupportTicket): number {
  if (t.status === "stuck") return t.reply_job ? 4 : t.team_job ? 2 : 1;
  return ORDER.indexOf(t.status) + 1;
}
const tone = (s: SupportStatus) =>
  s === "closed" || s === "fixed" ? "done" : s === "stuck" ? "failed" : s === "new" ? "new" : "in_progress";

function Steps({ t }: { t: SupportTicket }) {
  const team = `With ${t.department || "the team"}`;
  const names = isHandoff(t)
    ? ["Filed", team, "Done", `Back with ${t.from_department || "the team that asked"}`, "Closed"]
    : ["Received", team, "Fixed", "Telling the customer", "Customer told"];
  const n = reached(t);
  return (
    <span className="sd-steps">
      <ol aria-label="Steps">
        {names.map((s, i) => (
          <li key={s} className={i < n ? "sd-on" : undefined} aria-current={i === n - 1 ? "step" : undefined}>
            {s}
          </li>
        ))}
      </ol>
      {t.status === "stuck" ? <span className="sd-stuck">Stuck</span> : null}
    </span>
  );
}

function Priority({ t }: { t: SupportTicket }) {
  return t.priority === "high" || t.priority === "urgent" ? (
    <span className={`tag sd-${t.priority}`}>{t.priority === "urgent" ? "Urgent" : "High priority"}</span>
  ) : null;
}

function trackerWords(t: SupportTicket): string | null {
  if (!t.tracker || t.tracker === "AI City tickets") return null;
  if (!t.tracker_key) return `${t.tracker} issue being created`;
  return `Also in ${t.tracker} as ${t.tracker_key}`;
}

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

function SupportDetail({ t, back }: { t: SupportTicket; back: () => void }) {
  return (
    <section className="sd-detail" aria-labelledby="sd-title">
      <Button variant="quiet" onClick={back}>
        ← All tickets
      </Button>
      <h2 id="sd-title">{t.title}</h2>
      <p>
        <span className={`tag tag-${tone(t.status)}`}>{t.words}</span> <Priority t={t} />{" "}
        <span className="mute">{isHandoff(t) ? fromWords(t) : `${fromWords(t)} · ${t.department}`}</span>
      </p>
      <Steps t={t} />
      <h3>{isHandoff(t) ? `What ${t.from_department || "the team"} asked for` : "What the customer said"}</h3>
      <p className="sd-words">{t.details}</p>
      {t.resolution ? (
        <>
          <h3>What was done</h3>
          <p className="result">{t.resolution}</p>
        </>
      ) : null}
      {isHandoff(t) ? null : (
        <>
          <h3>Where the reply goes</h3>
          <p>{replyWords(t)}</p>
        </>
      )}
      {t.chain && t.chain.length > 1 ? <p className="mute">Passed through: {t.chain.join(" → ")}</p> : null}
      {t.ref ? <p className="mute">About: {t.ref}</p> : null}
      {trackerWords(t) ? <p className="mute">{trackerWords(t)}</p> : null}
      <h3>What happened</h3>
      <ol className="history">
        {t.history.map((h, i) => (
          <li key={i}>
            <span className="mute">{when(h.at)}</span> {h.who}: {h.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

type Filter = "all" | "customer" | "handoff";
const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["customer", "From customers"],
  ["handoff", "Between teams"],
];

/** The "Tickets" tab in Work. */
export function SupportBoard() {
  const s = useSyncExternalStore(support.subscribe, support.get);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    void support.load();
    const off = live.onEvent((e) => support.event(e));
    return () => {
      off();
    };
  }, []);
  const all = sortTickets(Object.values(s.tickets));
  const list = filter === "all" ? all : all.filter((t) => (filter === "handoff") === isHandoff(t));
  const current = open ? s.tickets[open] : null;
  if (current) return <SupportDetail t={current} back={() => setOpen(null)} />;
  return (
    <>
      {s.error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: () => void support.load() }}>
          Tickets did not load. Check the connection.
        </Banner>
      ) : null}
      {all.length ? (
        <div className="segmented sd-filter" role="group" aria-label="Which tickets">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {!s.loaded && !all.length ? <Loading what="tickets" /> : null}
      {s.loaded && !s.error && !all.length ? (
        <p className="empty">
          No tickets yet. Customer messages from Slack or your support inbox, and work one department hands to another,
          show here with every step. Ask VAIC: “We're an online shop like Zalando; run it.”
        </p>
      ) : null}
      {all.length && !list.length ? <p className="empty">None of these yet.</p> : null}
      <ul className="jobs">
        {list.map((t) => (
          <li key={t.id}>
            <button type="button" className="job sd-row" onClick={() => setOpen(t.id)}>
              <span className="job-name">{t.title}</span>
              <span className={`tag tag-${tone(t.status)}`}>{t.words}</span>
              <span className="job-parts mute">
                {isHandoff(t) ? fromWords(t) : `${fromWords(t)} · ${t.department}`} <Priority t={t} />
              </span>
              <span className="job-time mute">{ago(Date.parse(t.updated_at))}</span>
              <Steps t={t} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
