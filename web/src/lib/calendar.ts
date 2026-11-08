// City → Features → Calendar: the owner's one calendar (docs/MAIL_CALENDAR.md §12). Types, the API and the
// date arithmetic the views share, in the owner's own time zone (the browser's). Read-only: nothing here
// accepts, declines or changes a meeting.
import { api } from "./api.ts";

export interface Person {
  name: string;
  email: string;
  response?: string;
}
export interface Source {
  account_id: string;
  label: string;
  address: string;
  provider: string;
  event_id: string;
  url: string;
  color: string;
}
export interface Meeting {
  id: string;
  title: string;
  /** UTC `YYYY-MM-DDTHH:MMZ`, or `YYYY-MM-DD` for a whole day (the end day is then exclusive). */
  start: string;
  end: string;
  all_day: boolean;
  time_zone: string;
  organizer: Person;
  attendees: Person[];
  location: string;
  description: string;
  my_response: string;
  recurring: boolean;
  join: { url: string; kind: "teams" | "zoom" | "meet" | "webex" } | null;
  sources: Source[];
  color: string;
}
export interface CalendarAccount {
  id: string;
  label: string;
  provider: string;
  address: string;
  status: string;
  color: string;
}
export interface CalendarState {
  last_import_at?: string;
  accounts?: number;
  events?: number;
  errors?: Array<{ account_id: string; label: string; message: string }>;
  time_zone?: string;
}
export interface CalendarReply {
  enabled: boolean;
  events: Meeting[];
  state: CalendarState;
  accounts: CalendarAccount[];
}
export interface Feature {
  id: string;
  name: string;
  blurb: string;
  enabled: boolean;
}

export const JOIN_LABEL: Record<NonNullable<Meeting["join"]>["kind"], string> = {
  teams: "Microsoft Teams",
  zoom: "Zoom",
  meet: "Google Meet",
  webex: "Webex",
};

/** The mail accounts' colour keys (config/mail.json), readable as dots and edges on light and dark glass. */
export const ACCOUNT_COLORS: Record<string, string> = {
  "ink-blue": "#4f7bd9",
  moss: "#5b9a5b",
  brick: "#c0583f",
  plum: "#9466b5",
  ochre: "#d19a2e",
  teal: "#2f9e9e",
  rose: "#d0688c",
  slate: "#7c8794",
};
export const colorOf = (key: string | undefined) => ACCOUNT_COLORS[key ?? ""] ?? ACCOUNT_COLORS.slate!;

export const ownerZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const calendarApi = {
  features: () => api<{ features: Feature[] }>("/features"),
  setFeature: (id: string, enabled: boolean) =>
    api<{ feature: Feature }>(`/features/${id}`, { method: "PUT", body: { enabled } }),
  events: (from: string, to: string) =>
    api<CalendarReply>(`/calendar/events?from=${from}&to=${to}&tz=${encodeURIComponent(ownerZone())}`),
  refresh: () => api<{ started: boolean }>("/calendar/refresh", { method: "POST" }),
};

// ---------- days, in local time ----------
const pad = (n: number) => String(n).padStart(2, "0");
/** A local day as `YYYY-MM-DD`. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week a day is in. */
export const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export type View = "today" | "week" | "month" | "agenda";
/** The days a view shows: `[first, end)` as local day keys. Month shows whole weeks (6 rows at most). */
export function range(view: View, at: Date): { from: string; to: string; days: string[] } {
  let first: Date;
  let n: number;
  if (view === "today") [first, n] = [at, 1];
  else if (view === "week") [first, n] = [weekStart(at), 7];
  else if (view === "agenda") [first, n] = [at, 30];
  else {
    first = weekStart(monthStart(at));
    const last = new Date(at.getFullYear(), at.getMonth() + 1, 0);
    n = Math.round((weekStart(last).getTime() - first.getTime()) / 86_400_000) + 7;
  }
  const days = Array.from({ length: n }, (_, i) => dayKey(addDays(first, i)));
  return { from: days[0]!, to: dayKey(addDays(first, n)), days };
}
export function step(view: View, at: Date, dir: 1 | -1): Date {
  if (view === "today") return addDays(at, dir);
  if (view === "week") return addDays(at, 7 * dir);
  if (view === "agenda") return addDays(at, 30 * dir);
  return new Date(at.getFullYear(), at.getMonth() + dir, 1);
}

const toDate = (s: string) => (s.length <= 10 ? fromKey(s) : new Date(s));
/** When a meeting starts and ends, as Dates (a whole day: local midnight to local midnight). */
export function span(m: Meeting): [Date, Date] {
  const s = toDate(m.start);
  let e = toDate(m.end);
  if (m.all_day && e.getTime() <= s.getTime()) e = addDays(s, 1); // a one-day invitation without an end day
  return [s, e];
}
/** The local days a meeting touches (a meeting ending at midnight doesn't touch the next day). */
export function daysOf(m: Meeting): string[] {
  const [s, e] = span(m);
  const out: string[] = [];
  for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d < e || out.length === 0; d = addDays(d, 1)) {
    out.push(dayKey(d));
    if (out.length > 62) break;
  }
  return out;
}
/** Meetings grouped by local day, each day sorted (whole-day ones first). */
export function byDay(meetings: Meeting[]): Map<string, Meeting[]> {
  const out = new Map<string, Meeting[]>();
  for (const m of meetings) for (const k of daysOf(m)) out.set(k, [...(out.get(k) ?? []), m]);
  for (const list of out.values())
    list.sort((a, b) => Number(b.all_day) - Number(a.all_day) || span(a)[0].getTime() - span(b)[0].getTime());
  return out;
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
/** "09:00 – 09:30", "All day", or "All day, 12–13 Nov". */
export function whenText(m: Meeting): string {
  const [s, e] = span(m);
  if (m.all_day) {
    const last = addDays(e, -1);
    if (dayKey(last) === dayKey(s)) return "All day";
    return `All day, ${s.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${last.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  }
  return `${time(s)} – ${time(e)}`;
}
export const dayTitle = (k: string, today: string) => {
  const d = fromKey(k);
  const name = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  if (k === today) return `Today · ${name}`;
  if (k === dayKey(addDays(fromKey(today), 1))) return `Tomorrow · ${name}`;
  return name;
};
/** The heading over a view: "Monday 9 November", "9 – 15 November 2026", "November 2026". */
export function viewTitle(view: View, at: Date): string {
  if (view === "today") return at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  if (view === "month") return at.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const r = range(view, at);
  const a = fromKey(r.days[0]!);
  const b = fromKey(r.days[r.days.length - 1]!);
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${f(a)} – ${f(b)} ${b.getFullYear()}`;
}

/** Whether a meeting is on now, or starts within the next 10 minutes: its Join button is lit. */
export function joinSoon(m: Meeting, now = new Date()): boolean {
  if (!m.join || m.all_day) return false;
  const [s, e] = span(m);
  return s.getTime() - 10 * 60_000 <= now.getTime() && now.getTime() < e.getTime();
}

/** Only https links on the four services open; anything else is not a Join button. */
export function safeJoinUrl(m: Meeting): string | null {
  const u = m.join?.url;
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" ? p.href : null;
  } catch {
    return null;
  }
}

/** "3 minutes ago", for "Updated …". */
export function updatedText(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "Not checked yet";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "Updated just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Updated ${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Updated ${h} hour${h === 1 ? "" : "s"} ago`;
  return `Updated ${new Date(iso).toLocaleDateString()}`;
}
