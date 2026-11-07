// Tickets, Costs and Settings. Plain words in the main view; technical details behind "Details".
import { ConnectorsSettings } from "./ConnectorsSettings.tsx";
import { useEffect, useState } from "react";
import { COST_NOTE, ticketWords } from "../city/city-state.js";
import { saveSettings, setPaused } from "../lib/actions.ts";
import { api, ApiError } from "../lib/api.ts";
import { ago, money, spendLevel } from "../lib/format.ts";
import { store } from "../lib/store.ts";
import { Banner, Button, Confirm, Loading, toast } from "./ui.tsx";
import { signOutHere } from "../lib/auth.ts";
import { SettingsApps } from "./Apps.tsx";
import { config } from "../lib/config.ts";
import { readVoiceId, saveVoiceId, VOICES } from "../voice/modes.ts";
import { getVoice, logVoiceError, micProblem } from "../voice/voice.ts";

function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let gone = false;
    setError(null);
    api<T>(path).then(
      (d) => !gone && setData(d),
      (e: Error) => !gone && setError(e.message),
    );
    return () => {
      gone = true;
    };
  }, [path, n]);
  return { data, error, retry: () => setN((x) => x + 1) };
}

// ---------- Tickets ----------
interface Ticket {
  id: string;
  goal: string;
  from: string;
  to: string;
  status: string;
  department: string | null;
  updated_at: string;
  result?: string;
}
export function Tickets() {
  const [which, setWhich] = useState<"live" | "done">("live");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, retry } = useApi<{ tickets: Ticket[] }>(`/tickets${which === "done" ? "?status=done" : ""}`);
  if (open) return <TicketDetail id={open} back={() => setOpen(null)} />;
  return (
    <section className="screen" aria-labelledby="tk-title">
      <h1 id="tk-title">Work</h1>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={which === "live"} onClick={() => setWhich("live")}>
          Working now
        </button>
        <button role="tab" aria-selected={which === "done"} onClick={() => setWhich("done")}>
          Finished
        </button>
      </div>
      {error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: retry }}>
          Your work list did not load. Check the connection.
        </Banner>
      ) : null}
      {!data && !error ? <Loading what="your work" /> : null}
      {data && !data.tickets.length ? (
        <p className="empty">
          {which === "live" ? "Nothing is being worked on. Ask AIC for something." : "Nothing is finished yet."}
        </p>
      ) : null}
      <ul className="list">
        {data?.tickets.map((t) => (
          <li key={t.id}>
            <button type="button" className="listrow" onClick={() => setOpen(t.id)}>
              <span className={`tag tag-${t.status}`}>{ticketWords(t.status)}</span>
              <span className="grow">{t.goal}</span>
              <span className="mute">{`${t.to} · ${ago(Date.parse(t.updated_at))}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketDetail({ id, back }: { id: string; back: () => void }) {
  const { data, error } = useApi<{
    ticket: Ticket;
    history: Array<{ from: string | null; to: string; note: string; at: string }>;
    children: Ticket[];
  }>(`/tickets/${id}`);
  const [details, setDetails] = useState(false);
  return (
    <section className="screen" aria-labelledby="td-title">
      <Button variant="quiet" onClick={back}>
        ← All work
      </Button>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {!data && !error ? <Loading what="this piece of work" /> : null}
      {data ? (
        <>
          <h1 id="td-title">{data.ticket.goal}</h1>
          <p>
            <span className={`tag tag-${data.ticket.status}`}>{ticketWords(data.ticket.status)}</span>{" "}
            {`${data.ticket.from} → ${data.ticket.to}`}
          </p>
          {data.ticket.result ? <p className="result">{data.ticket.result}</p> : null}
          <h2>What happened</h2>
          <ol className="history">
            {data.history.map((h, i) => (
              <li
                key={i}
              >{`${new Date(h.at).toLocaleString("sv-SE")} — ${ticketWords(h.to)}${h.note ? ` (${h.note})` : ""}`}</li>
            ))}
          </ol>
          {data.children.length ? (
            <>
              <h2>Parts</h2>
              <ul className="list">
                {data.children.map((c) => (
                  <li key={c.id}>{`${ticketWords(c.status)}: ${c.goal} — ${c.to}`}</li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" className="link" onClick={() => setDetails(!details)} aria-expanded={details}>
            Details
          </button>
          {details ? <pre className="details">{JSON.stringify(data.ticket, null, 2)}</pre> : null}
        </>
      ) : null}
    </section>
  );
}

// ---------- Costs ----------
interface Spend {
  usd: number;
  turns: number;
  tokens: number;
  cache_savings_usd: number;
}
interface Costs {
  today: Spend;
  month: Spend;
  by_department: Record<string, Spend>;
  by_role: Record<string, Spend>;
  by_model: Record<string, Spend>;
  caps: { daily_global_usd: number | null; monthly_budget_usd: number | null; daily_department_usd: number | null };
  cost_explorer_url: string;
}
export function CostsScreen() {
  const { data, error, retry } = useApi<Costs>("/costs");
  return (
    <section className="screen" aria-labelledby="cost-title">
      <h1 id="cost-title">Costs (estimates)</h1>
      <p className="mute">{COST_NOTE}</p>
      {error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: retry }}>
          Costs did not load. Check the connection.
        </Banner>
      ) : null}
      {!data && !error ? <Loading what="costs" /> : null}
      {data ? (
        <>
          <div className="meters">
            <Meter label="Today" spent={data.today.usd} cap={data.caps.daily_global_usd} />
            <Meter label="This month" spent={data.month.usd} cap={data.caps.monthly_budget_usd} />
          </div>
          {config().budgetAlertUsd ? (
            <p>{`Alert at ${money(config().budgetAlertUsd)} a month: AWS emails you. It never stops anything.`}</p>
          ) : null}
          <p>{`Prompt caching saved about ${money(data.month.cache_savings_usd)} this month.`}</p>
          <Table title="This month by department" rows={data.by_department} />
          <Table title="This month by role" rows={data.by_role} />
          <Table title="This month by model" rows={data.by_model} />
          <p>
            <a href={data.cost_explorer_url} target="_blank" rel="noreferrer noopener">
              Open AWS Cost Explorer (the real bill)
            </a>
          </p>
        </>
      ) : null}
    </section>
  );
}
function Meter({ label, spent, cap }: { label: string; spent: number; cap: number | null }) {
  if (cap === null)
    return (
      <div className="meter meter-ok">
        <div className="meter-head">
          <b>{label}</b>
          <span>{`${money(spent)} (estimate, no limit set)`}</span>
        </div>
      </div>
    );
  const level = spendLevel(spent, cap);
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 100;
  return (
    <div className={`meter meter-${level}`}>
      <div className="meter-head">
        <b>{label}</b>
        <span>{`${money(spent)} of your ${money(cap)} limit (estimate)`}</span>
      </div>
      <div
        className="bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={spent}
        aria-label={`${label}: ${money(spent)} of ${money(cap)}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      {level !== "ok" ? (
        <p className="meter-word">{level === "red" ? "Limit reached: no new work starts." : "Close to your limit."}</p>
      ) : null}
    </div>
  );
}
function Table({ title, rows }: { title: string; rows: Record<string, Spend> }) {
  const list = Object.entries(rows).sort((a, b) => b[1].usd - a[1].usd);
  return (
    <>
      <h2>{title}</h2>
      {list.length ? (
        <table className="costs">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Estimate</th>
              <th scope="col">Turns</th>
            </tr>
          </thead>
          <tbody>
            {list.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{money(v.usd)}</td>
                <td>{v.turns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mute">Nothing spent yet.</p>
      )}
    </>
  );
}

// ---------- Settings ----------
type S = Record<string, unknown> & {
  paused: boolean;
  monthly_budget_usd: number | null;
  daily_global_usd: number | null;
  daily_department_usd: number | null;
  max_workers_per_goal: number;
  max_concurrent_workers_per_department: number;
  max_concurrent_workers_global: number;
  max_new_sessions_per_second: number;
  profile_prefix: string;
  notify_email: boolean;
  integrations: Record<string, boolean>;
};
export function SettingsScreen({ reopenGuide }: { reopenGuide: () => void }) {
  const { data, error, retry } = useApi<{ settings: S }>("/settings");
  const [form, setForm] = useState<S | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "pause" }>(null);
  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);
  if (error)
    return (
      <section className="screen">
        <h1>Settings</h1>
        <Banner tone="bad" action={{ label: "Try again", onClick: retry }}>{`Settings did not load: ${error}`}</Banner>
      </section>
    );
  if (!data || !form)
    return (
      <section className="screen">
        <h1>Settings</h1>
        <Loading what="settings" />
      </section>
    );
  const before = data.settings;
  const num = (k: keyof S, v: string) => setForm({ ...form, [k]: v === "" ? Number.NaN : Number(v) });
  // Spend caps are optional: an empty field means no limit (null), which is the default.
  const cap = (k: "daily_global_usd" | "daily_department_usd" | "monthly_budget_usd", v: string) =>
    setForm({ ...form, [k]: v === "" ? null : Number(v) });
  const invalid = [form.daily_global_usd, form.monthly_budget_usd, form.daily_department_usd].some(
    (v) => v !== null && (!Number.isFinite(v) || v < 0),
  );

  const save = async () => {
    setProblem(null);
    const prev = { ...before };
    try {
      const r = await saveSettings({ ...form });
      setForm(r.settings as S);
      data.settings = r.settings as S;
      toast({
        text: "Settings saved.",
        tone: "good",
        undo: async () => {
          const back = await saveSettings({ ...prev });
          setForm(back.settings as S);
          data.settings = back.settings as S;
        },
      });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Not saved. Nothing changed. Try again.");
    }
  };
  const togglePause = async () => {
    const next = !form.paused;
    await setPaused(next);
    setForm({ ...form, paused: next });
    toast({
      text: next ? "The city is paused." : "The city is running again.",
      undo: async () => {
        await setPaused(!next);
        setForm((f) => (f ? { ...f, paused: !next } : f));
      },
    });
  };

  return (
    <section className="screen" aria-labelledby="set-title">
      <h1 id="set-title">Settings</h1>
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
      <h2>The city</h2>
      <p>{form.paused ? "Paused: nothing new starts." : "Running."}</p>
      <Button variant="secondary" onClick={() => (form.paused ? togglePause() : setConfirm({ kind: "pause" }))}>
        {form.paused ? "Resume the city" : "Pause the city…"}
      </Button>
      <h2>Spend caps (optional)</h2>
      <p className="mute">
        No limit by default. Leave a field empty for no limit, or enter dollars to stop new work there.
      </p>
      <div className="fields">
        <Field
          label="Daily cap, all departments ($)"
          value={form.daily_global_usd ?? Number.NaN}
          onChange={(v) => cap("daily_global_usd", v)}
          placeholder="No limit"
        />
        <Field
          label="Daily cap per department ($)"
          value={form.daily_department_usd ?? Number.NaN}
          onChange={(v) => cap("daily_department_usd", v)}
          placeholder="No limit"
        />
        <Field
          label="Monthly cap ($)"
          value={form.monthly_budget_usd ?? Number.NaN}
          onChange={(v) => cap("monthly_budget_usd", v)}
          placeholder="No limit"
        />
      </div>
      {invalid ? (
        <p className="field-error" role="alert">
          Caps must be zero or more dollars, or empty for no limit.
        </p>
      ) : null}
      <h2>How many workers at once</h2>
      <div className="fields">
        <Field
          label="Per goal (one manager's team)"
          value={form.max_workers_per_goal}
          onChange={(v) => num("max_workers_per_goal", v)}
          step={1}
        />
        <Field
          label="Per department"
          value={form.max_concurrent_workers_per_department}
          onChange={(v) => num("max_concurrent_workers_per_department", v)}
          step={1}
        />
        <Field
          label="In total"
          value={form.max_concurrent_workers_global}
          onChange={(v) => num("max_concurrent_workers_global", v)}
          step={1}
        />
        <Field
          label="New workers per second (max 25)"
          value={form.max_new_sessions_per_second}
          onChange={(v) => num("max_new_sessions_per_second", v)}
          step={1}
        />
      </div>
      <h2>Where Claude runs</h2>
      <label className="field">
        Model location
        <select value={form.profile_prefix} onChange={(e) => setForm({ ...form, profile_prefix: e.target.value })}>
          <option value="global">Worldwide (cheapest; prompts may leave the EU)</option>
          <option value="eu">Europe only (about 10% more; Fable roles use Opus instead)</option>
        </select>
      </label>
      <h2>Notifications</h2>
      <label className="switch">
        <input
          type="checkbox"
          checked={form.notify_email}
          onChange={(e) => setForm({ ...form, notify_email: e.target.checked })}
        />{" "}
        Email me when a task is done, a question waits, or spend nears a cap you set
      </label>
      <h2>Integrations</h2>
      <p className="mute">Built but off. Each needs its sign-in set up in AWS first (see the deploy checklist).</p>
      {Object.entries(form.integrations).map(([k, v]) => (
        <label key={k} className="switch">
          <input
            type="checkbox"
            checked={v}
            onChange={(e) => setForm({ ...form, integrations: { ...form.integrations, [k]: e.target.checked } })}
          />{" "}
          {k.replace(/_/g, " ")}
        </label>
      ))}
      <ConnectorsSettings
        mailAccess={(form as unknown as { mail_access?: Record<string, string> }).mail_access ?? {}}
        onMailAccess={(mail_access) => setForm({ ...form, mail_access } as S)}
      />
      <SettingsApps />
      <VoiceSettings />
      <h2>Help</h2>
      <Button variant="quiet" onClick={reopenGuide}>
        Show the first-run guide again
      </Button>
      <Button
        variant="quiet"
        onClick={async () => {
          await signOutHere();
          location.reload();
        }}
      >
        Sign out
      </Button>
      <div className="savebar">
        <Button variant="primary" disabled={invalid} onClick={() => save()}>
          Save changes
        </Button>
      </div>
      {confirm?.kind === "pause" ? (
        <Confirm
          title="Pause the city?"
          what="No new work starts. Work already running finishes within 15 minutes. Questions and results still reach you."
          cost="Pausing costs nothing. Storage, logs and the login page still cost a few cents a day."
          confirmLabel="Pause"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            await togglePause();
          }}
        />
      ) : null}
      <p className="mute signout">
        <button type="button" className="link" onClick={() => store.set({ chat: [] })}>
          Forget this device's conversation
        </button>
      </p>
    </section>
  );
}
/** AIC's voice, chosen per device (no Save needed): Polly's generative voices, the most natural ones. */
function VoiceSettings() {
  const [id, setId] = useState(() => readVoiceId(config().pollyVoice));
  return (
    <>
      <h2>AIC's voice</h2>
      <p className="mute">Natural, human-sounding voices. The choice is remembered on this device.</p>
      <label className="field">
        Voice
        <select
          aria-label="AIC's voice"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            saveVoiceId(e.target.value);
          }}
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="quiet"
        onClick={() =>
          getVoice()
            .speak("Hi, I'm AIC. This is how I'll sound when I answer you.")
            .catch((e: unknown) => {
              logVoiceError("the voice sample could not play", e);
              toast({ text: micProblem(e), tone: "bad" });
            })
        }
      >
        Hear this voice
      </Button>
    </>
  );
}
function Field({
  label,
  value,
  onChange,
  step = 0.5,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  step?: number;
  placeholder?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
