// City → Features: the owner's personal features (a gallery, on/off, "Add a feature" through AIC), and the first
// one, the Calendar: every meeting from every connected account in one place, with a big Join button.
// Read-only: nothing here accepts, declines or changes a meeting (docs/MAIL_CALENDAR.md §12).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  byDay,
  calendarApi,
  colorOf,
  dayKey,
  dayTitle,
  fromKey,
  JOIN_LABEL,
  joinSoon,
  range,
  safeJoinUrl,
  span,
  step,
  updatedText,
  viewTitle,
  whenText,
  type CalendarReply,
  type Feature,
  type Meeting,
  type View,
} from "../lib/calendar.ts";
import { live } from "../lib/ws.ts";
import { Banner, Button, Loading, toast } from "./ui.tsx";

const ADD_DRAFT = "I'd like a feature that ";

/** Which side the "City | Features" highlight was on, so the next page's switch starts there and slides over. */
let shownTab: "city" | "features" | null = null;

/** "City | Features": the two pages under the City tab. One look on both pages; the highlight slides from the
 *  page you left to the one you opened (the owner's wish, 2026-11-09: smooth, not a jump to a new style). */
export function CityTabs({ on }: { on: "city" | "features" }) {
  const [at, setAt] = useState<"city" | "features">(shownTab ?? on);
  useEffect(() => {
    shownTab = on;
    const raf = requestAnimationFrame(() => setAt(on));
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <nav className="citytabs" aria-label="City pages" data-at={at}>
      <span className="citytabs-thumb" aria-hidden="true" />
      <a href="#/city" aria-current={on === "city" ? "page" : undefined}>
        City
      </a>
      <a href="#/city/features" aria-current={on === "features" ? "page" : undefined}>
        Features
      </a>
    </nav>
  );
}

export function FeaturesScreen({ page, go }: { page: string; go: (v: string) => void }) {
  if (page === "features/calendar") return <CalendarScreen go={go} />;
  return <FeatureGallery go={go} />;
}

function CalendarIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
      <circle cx="8.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FeatureGallery({ go }: { go: (v: string) => void }) {
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    calendarApi.features().then(
      (r) => setFeatures(r.features),
      (e: Error) => setError(e.message),
    );
  }, []);
  useEffect(load, [load]);
  const toggle = async (f: Feature) => {
    const enabled = !f.enabled;
    setFeatures((fs) => fs?.map((x) => (x.id === f.id ? { ...x, enabled } : x)) ?? null);
    try {
      await calendarApi.setFeature(f.id, enabled);
      toast({ text: `${f.name} is ${enabled ? "on" : "off"}.`, tone: "good" });
    } catch (e) {
      setFeatures((fs) => fs?.map((x) => (x.id === f.id ? f : x)) ?? null);
      toast({ text: `${f.name} didn't change: ${(e as Error).message}`, tone: "bad" });
    }
  };
  const addFeature = () => {
    try {
      localStorage.setItem("aic.draft", ADD_DRAFT);
    } catch {
      /* AIC still opens */
    }
    go("ace");
  };
  return (
    <section className="screen features" aria-labelledby="ft-title">
      <CityTabs on="features" />
      <h1 id="ft-title">Features</h1>
      <p className="mute lede">Your own additions to AI City. Open one, or switch it off when you don't need it.</p>
      {error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: load }}>
          Your features didn't load. Check the connection.
        </Banner>
      ) : null}
      {!features && !error ? <Loading what="your features" /> : null}
      <ul className="feature-grid">
        {features?.map((f) => (
          <li key={f.id} className={`feature-card${f.enabled ? "" : " is-off"}`}>
            <a className="feature-open" href={`#/city/features/${f.id}`}>
              <span className="feature-icon">
                <CalendarIcon />
              </span>
              <span className="feature-name">{f.name}</span>
              <span className="feature-blurb">{f.blurb}</span>
            </a>
            <label className="switch toggle feature-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={f.enabled}
                onChange={() => void toggle(f)}
                aria-label={`${f.name} on or off`}
              />
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-knob" />
              </span>
              {f.enabled ? "On" : "Off"}
            </label>
          </li>
        ))}
        {features ? (
          <li className="feature-card feature-add">
            <button type="button" className="feature-open" onClick={addFeature}>
              <span className="feature-icon plus" aria-hidden="true">
                +
              </span>
              <span className="feature-name">Add a feature</span>
              <span className="feature-blurb">
                Tell AIC what you'd like, in your own words. "A feature that…" is enough.
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

// ---------- the Calendar ----------
const VIEWS: Array<[View, string]> = [
  ["today", "Today"],
  ["week", "Week"],
  ["month", "Month"],
  ["agenda", "Agenda"],
];
const VIEW_KEY = "aic.calendar.view";

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "today" || v === "week" || v === "month" || v === "agenda") return v;
  } catch {
    /* default */
  }
  return "today";
}

function CalendarScreen({ go }: { go: (v: string) => void }) {
  const [view, setViewState] = useState<View>(readView);
  const [at, setAt] = useState(() => new Date());
  const [data, setData] = useState<CalendarReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Meeting | null>(null);
  const [now, setNow] = useState(() => new Date());
  const r = useMemo(() => range(view, at), [view, at]);
  const today = dayKey(now);

  const load = useCallback(() => {
    calendarApi.events(r.from, r.to).then(
      (d) => {
        setData(d);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [r.from, r.to]);
  useEffect(load, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    // A finished import (scheduled or "Refresh now") reloads what's on screen.
    const off = live.onEvent((e) => {
      if ((e as { type?: string }).type === "calendar.changed") load();
    });
    return () => {
      clearInterval(t);
      off();
    };
  }, [load]);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* fine */
    }
  };
  const refresh = async () => {
    try {
      await calendarApi.refresh();
      toast({ text: "Checking your accounts for new meetings…", tone: "good" });
      setTimeout(load, 8_000); // the import usually finishes within seconds; calendar.changed reloads too
    } catch (e) {
      toast({ text: (e as Error).message, tone: "bad" });
    }
  };
  const turnOn = async () => {
    await calendarApi.setFeature("calendar", true);
    load();
  };

  const days = useMemo(() => byDay(data?.events ?? []), [data]);
  const connected = (data?.accounts ?? []).filter((a) => a.status === "connected");
  const problems = data?.state.errors ?? [];

  return (
    <section className="screen calendar" aria-labelledby="cal-title">
      <CityTabs on="features" />
      <div className="cal-head">
        <h1 id="cal-title">Calendar</h1>
        {data?.enabled ? (
          <div className="cal-refresh">
            <span className="mute">{updatedText(data.state.last_import_at, now.getTime())}</span>
            <Button variant="quiet" onClick={refresh}>
              Refresh now
            </Button>
          </div>
        ) : null}
      </div>
      {error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: load }}>
          Your calendar didn't load. Check the connection.
        </Banner>
      ) : null}
      {!data && !error ? <Loading what="your calendar" /> : null}
      {data && !data.enabled ? (
        <div className="emptystate">
          <p className="empty">The Calendar is off, so no meetings are being collected.</p>
          <Button variant="primary" onClick={turnOn}>
            Turn the Calendar on
          </Button>
        </div>
      ) : null}
      {data?.enabled && !connected.length ? (
        <div className="emptystate">
          <p className="empty">
            Connect an email account (Outlook, Gmail or any other) and its meetings show up here, all in one place.
          </p>
          <Button variant="primary" onClick={() => go("settings/connectors")}>
            Connect an account
          </Button>
        </div>
      ) : null}
      {data?.enabled
        ? problems.map((p) => (
            <Banner
              key={p.account_id}
              tone="warn"
              action={{ label: "Open accounts", onClick: () => go("settings/connectors") }}
            >
              {`${p.label || "An account"} couldn't be read just now: ${p.message} The meetings from before stay.`}
            </Banner>
          ))
        : null}
      {data?.enabled && connected.length ? (
        <>
          <div className="cal-accounts" aria-label="Accounts in this calendar">
            {connected.map((a) => (
              <span key={a.id} className="acct">
                <i style={{ background: colorOf(a.color) }} aria-hidden="true" />
                {a.label}
              </span>
            ))}
          </div>
          <div className="segmented cal-views" role="tablist" aria-label="Calendar view">
            {VIEWS.map(([v, label]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="cal-nav">
            <button type="button" className="cal-arrow" aria-label="Earlier" onClick={() => setAt(step(view, at, -1))}>
              <Chevron dir={-1} />
            </button>
            <button type="button" className="cal-arrow" aria-label="Later" onClick={() => setAt(step(view, at, 1))}>
              <Chevron dir={1} />
            </button>
            <h2 className="cal-when">{viewTitle(view, at)}</h2>
            {dayKey(at) !== today ? (
              <Button variant="quiet" onClick={() => setAt(new Date())}>
                Back to today
              </Button>
            ) : null}
          </div>
          {view === "month" ? (
            <MonthGrid
              days={r.days}
              month={at.getMonth()}
              today={today}
              byDay={days}
              onMeeting={setOpen}
              onDay={(k) => {
                setAt(fromKey(k));
                setView("today");
              }}
            />
          ) : view === "week" ? (
            <WeekColumns days={r.days} today={today} byDay={days} onMeeting={setOpen} now={now} />
          ) : (
            <DayList
              days={view === "today" ? r.days : r.days.filter((k) => days.has(k))}
              today={today}
              byDay={days}
              onMeeting={setOpen}
              now={now}
              empty={view === "today" ? "Nothing on this day." : "Nothing in the next 30 days."}
            />
          )}
        </>
      ) : null}
      {open ? <MeetingSheet m={open} onClose={() => setOpen(null)} now={now} /> : null}
    </section>
  );
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d={dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dots({ m }: { m: Meeting }) {
  return (
    <span className="dots" aria-hidden="true">
      {m.sources.map((s) => (
        <i key={s.account_id + s.event_id} style={{ background: colorOf(s.color) }} />
      ))}
    </span>
  );
}

function MeetingRow({ m, onOpen, now }: { m: Meeting; onOpen: (m: Meeting) => void; now: Date }) {
  const soon = joinSoon(m, now);
  const declined = m.my_response === "declined";
  return (
    <li>
      <button
        type="button"
        className={`meeting${soon ? " is-soon" : ""}${declined ? " is-declined" : ""}`}
        style={{ ["--acct" as string]: colorOf(m.color) }}
        onClick={() => onOpen(m)}
      >
        <span className="m-time">{whenText(m)}</span>
        <span className="m-title">{m.title}</span>
        <span className="m-meta">
          <Dots m={m} />
          {m.join ? <span className="tag tag-join">{JOIN_LABEL[m.join.kind]}</span> : null}
          {m.location && !m.join ? <span className="m-where">{m.location}</span> : null}
          {declined ? <span className="m-where">You declined</span> : null}
        </span>
      </button>
    </li>
  );
}

function DayList(p: {
  days: string[];
  today: string;
  byDay: Map<string, Meeting[]>;
  onMeeting: (m: Meeting) => void;
  now: Date;
  empty: string;
}) {
  if (!p.days.some((k) => p.byDay.has(k))) return <p className="empty">{p.empty}</p>;
  return (
    <div className="daylist">
      {p.days.map((k) => (
        <section key={k} aria-label={dayTitle(k, p.today)}>
          <h3 className={k === p.today ? "is-today" : undefined}>{dayTitle(k, p.today)}</h3>
          <ul className="meetings">
            {(p.byDay.get(k) ?? []).map((m) => (
              <MeetingRow key={m.id} m={m} onOpen={p.onMeeting} now={p.now} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function WeekColumns(p: {
  days: string[];
  today: string;
  byDay: Map<string, Meeting[]>;
  onMeeting: (m: Meeting) => void;
  now: Date;
}) {
  return (
    <div className="week">
      {p.days.map((k) => {
        const d = fromKey(k);
        const list = p.byDay.get(k) ?? [];
        return (
          <section key={k} className={`week-day${k === p.today ? " is-today" : ""}`} aria-label={dayTitle(k, p.today)}>
            <h3>
              <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span> <b>{d.getDate()}</b>
            </h3>
            {list.length ? (
              <ul className="meetings">
                {list.map((m) => (
                  <MeetingRow key={m.id} m={m} onOpen={p.onMeeting} now={p.now} />
                ))}
              </ul>
            ) : (
              <p className="mute week-free">Free</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MonthGrid(p: {
  days: string[];
  month: number;
  today: string;
  byDay: Map<string, Meeting[]>;
  onMeeting: (m: Meeting) => void;
  onDay: (k: string) => void;
}) {
  const names = p.days.slice(0, 7).map((k) => fromKey(k).toLocaleDateString(undefined, { weekday: "short" }));
  return (
    <div className="month" role="grid" aria-label="Month">
      <div className="month-row month-names" role="row">
        {names.map((n) => (
          <span key={n} role="columnheader">
            {n}
          </span>
        ))}
      </div>
      {Array.from({ length: p.days.length / 7 }, (_, w) => (
        <div className="month-row" role="row" key={w}>
          {p.days.slice(w * 7, w * 7 + 7).map((k) => {
            const d = fromKey(k);
            const list = p.byDay.get(k) ?? [];
            const out = d.getMonth() !== p.month;
            return (
              <div
                key={k}
                role="gridcell"
                className={`month-day${out ? " is-out" : ""}${k === p.today ? " is-today" : ""}`}
              >
                <button
                  type="button"
                  className="month-date"
                  onClick={() => p.onDay(k)}
                  aria-label={`${dayTitle(k, p.today)}: ${list.length ? `${list.length} meeting${list.length === 1 ? "" : "s"}` : "free"}`}
                >
                  {d.getDate()}
                </button>
                {list.slice(0, 3).map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="chip"
                    style={{ ["--acct" as string]: colorOf(m.color) }}
                    onClick={() => p.onMeeting(m)}
                  >
                    {m.all_day
                      ? ""
                      : `${span(m)[0].toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} `}
                    {m.title}
                  </button>
                ))}
                {list.length > 3 ? (
                  <button type="button" className="chip more" onClick={() => p.onDay(k)}>
                    {`+${list.length - 3} more`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const PROVIDER: Record<string, string> = {
  google: "Google",
  microsoft: "Outlook",
  imap: "Calendar",
  invite: "Invitation email",
};

/** One meeting: when, where, who, which accounts, and a big Join button. Text from the invitation is shown as
 * plain text (it is written by others). */
function MeetingSheet({ m, onClose, now }: { m: Meeting; onClose: () => void; now: Date }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(".btn-primary, button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const [s] = span(m);
  const url = safeJoinUrl(m);
  const people = m.attendees.filter((a) => a.email || a.name);
  const shown = more ? people : people.slice(0, 8);
  const own = m.time_zone && !m.all_day ? m.time_zone : "";
  return (
    <div className="scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog panel meeting-sheet" role="dialog" aria-modal="true" aria-labelledby="mt-title" ref={ref}>
        <h2 id="mt-title">{m.title}</h2>
        <p className="mt-when">
          <b>{s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</b> · {whenText(m)}
          {m.recurring ? <span className="mute"> · repeats</span> : null}
        </p>
        {own && own !== Intl.DateTimeFormat().resolvedOptions().timeZone ? (
          <p className="mute small">Shown in your time. The organizer set it in {own}.</p>
        ) : null}
        {url ? (
          <a
            className={`btn btn-primary join${joinSoon(m, now) ? " is-soon" : ""}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {`Join on ${JOIN_LABEL[m.join!.kind]}`}
          </a>
        ) : null}
        <dl className="mt-facts">
          {m.location ? (
            <>
              <dt>Where</dt>
              <dd>{m.location}</dd>
            </>
          ) : null}
          {m.organizer.email || m.organizer.name ? (
            <>
              <dt>Organizer</dt>
              <dd>{m.organizer.name || m.organizer.email}</dd>
            </>
          ) : null}
          {people.length ? (
            <>
              <dt>{`People (${people.length})`}</dt>
              <dd>
                {shown.map((a) => a.name || a.email).join(", ")}
                {people.length > shown.length ? (
                  <button type="button" className="linkish" onClick={() => setMore(true)}>
                    {` and ${people.length - shown.length} more`}
                  </button>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt>From</dt>
          <dd className="mt-sources">
            {m.sources.map((src) => (
              <span key={src.account_id + src.event_id} className="acct">
                <i style={{ background: colorOf(src.color) }} aria-hidden="true" />
                {src.label}
                {src.url ? (
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    {`Open in ${PROVIDER[src.provider] ?? "the calendar"}`}
                  </a>
                ) : null}
              </span>
            ))}
          </dd>
          {m.my_response ? (
            <>
              <dt>Your answer</dt>
              <dd>
                {{ accepted: "Yes", declined: "No", tentative: "Maybe", needs_action: "Not answered yet" }[
                  m.my_response
                ] ?? m.my_response}
              </dd>
            </>
          ) : null}
        </dl>
        {m.description ? <p className="mt-notes">{m.description}</p> : null}
        <p className="mute small">
          AI City only shows your meetings. To answer or change one, ask AIC, and it checks with you first.
        </p>
        <div className="row-end">
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
