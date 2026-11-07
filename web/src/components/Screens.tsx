// Tickets, Costs and Settings. Plain words in the main view; technical details behind "Details".
import { ConnectorsSettings } from "./ConnectorsSettings.tsx";
import { useEffect, useState } from "react";
import { COST_NOTE, plainText, ticketWords } from "../city/city-state.js";
import { saveSettings } from "../lib/actions.ts";
import { api, ApiError } from "../lib/api.ts";
import { ago, money, spendLevel } from "../lib/format.ts";
import { store } from "../lib/store.ts";
import { Banner, Button, Loading, toast } from "./ui.tsx";
import { signOutHere } from "../lib/auth.ts";
import { SettingsApps } from "./Apps.tsx";
import { config } from "../lib/config.ts";
import { readVoiceId, saveVoiceId, VOICES } from "../voice/modes.ts";
import { getVoice, logVoiceError, speakProblem } from "../voice/voice.ts";
import {
  loadOpenAi,
  openAiStatus,
  openAiSynth,
  readOpenAiVoice,
  resetOpenAi,
  saveOpenAiVoice,
  type OpenAiStatus,
} from "../voice/openai.ts";

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
interface Job {
  id: string;
  name: string;
  status: string;
  words: string;
  parts_done: number;
  parts_total: number;
  started_at?: string;
  updated_at: string;
  result?: string;
}
/** Work: the owner's jobs, one row each (name, what is happening, parts done, when). Details are a tap away. */
export function Tickets() {
  const [which, setWhich] = useState<"live" | "done">("live");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, retry } = useApi<{ jobs: Job[] }>(`/jobs${which === "done" ? "?status=done" : ""}`);
  if (open) return <TicketDetail id={open} back={() => setOpen(null)} />;
  return (
    <section className="screen" aria-labelledby="tk-title">
      <h1 id="tk-title">Work</h1>
      <div className="segmented" role="tablist" aria-label="Which work">
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
      {data && !data.jobs.length ? (
        <p className="empty">
          {which === "live" ? "Nothing is being worked on. Ask AIC for something." : "Nothing is finished yet."}
        </p>
      ) : null}
      <ul className="jobs">
        {data?.jobs.map((j) => (
          <li key={j.id}>
            <button type="button" className="job" onClick={() => setOpen(j.id)}>
              <span className="job-name">{j.name}</span>
              <span className={`tag tag-${j.status}`}>{j.words}</span>
              {j.parts_total ? (
                <span className="job-parts">
                  <span
                    className="bar"
                    role="progressbar"
                    aria-label="Parts done"
                    aria-valuemin={0}
                    aria-valuemax={j.parts_total}
                    aria-valuenow={j.parts_done}
                  >
                    <i style={{ width: `${Math.round((100 * j.parts_done) / j.parts_total)}%` }} />
                  </span>
                  {`${j.parts_done} of ${j.parts_total} parts done`}
                </span>
              ) : (
                <span className="job-parts mute">Being planned</span>
              )}
              <span className="job-time mute">{ago(Date.parse(j.updated_at))}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One line of something long, with "more" to read it whole. */
function Long({ text, max = 110 }: { text: string; max?: number }) {
  const [whole, setWhole] = useState(false);
  const p = plainText(text, max);
  return (
    <>
      {whole ? text : p.short}
      {!p.whole && !whole ? (
        <>
          {" "}
          <button type="button" className="more" onClick={() => setWhole(true)}>
            more
          </button>
        </>
      ) : null}
    </>
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
      {!data && !error ? <Loading what="this job" /> : null}
      {data ? (
        <>
          <h1 id="td-title">{plainText(data.ticket.goal, 80).short}</h1>
          <p>
            <span className={`tag tag-${data.ticket.status}`}>{ticketWords(data.ticket.status)}</span>
          </p>
          {data.ticket.result ? (
            <p className="result">
              <Long text={data.ticket.result} max={240} />
            </p>
          ) : null}
          {data.children.length ? (
            <>
              <h2>Parts</h2>
              <ul className="parts">
                {data.children.map((c) => (
                  <li key={c.id}>
                    <span className={`tag tag-${c.status}`}>{ticketWords(c.status)}</span> <Long text={c.goal} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h2>What happened</h2>
          <ol className="history">
            {data.history.map((h, i) => (
              <li key={i}>
                <span className="mute">
                  {new Date(h.at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                </span>{" "}
                {ticketWords(h.to)}
                {h.note ? (
                  <>
                    {": "}
                    <Long text={h.note} max={80} />
                  </>
                ) : null}
              </li>
            ))}
          </ol>
          <button type="button" className="link" onClick={() => setDetails(!details)} aria-expanded={details}>
            Technical details
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
  monthly_budget_usd: number | null;
  daily_global_usd: number | null;
  daily_department_usd: number | null;
  max_workers_per_goal: number;
  max_concurrent_workers_per_department: number;
  max_concurrent_workers_global: number;
  max_live_workers_city: number;
  max_open_jobs: number;
  max_departments: number;
  max_new_sessions_per_second: number;
  profile_prefix: string;
  notify_push: boolean;
  integrations: Record<string, boolean>;
};
export function SettingsScreen({ reopenGuide }: { reopenGuide: () => void }) {
  const { data, error, retry } = useApi<{ settings: S }>("/settings");
  const [form, setForm] = useState<S | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
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
  return (
    <section className="screen" aria-labelledby="set-title">
      <h1 id="set-title">Settings</h1>
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
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
          label="At work in the whole city (hard ceiling)"
          value={form.max_live_workers_city}
          onChange={(v) => num("max_live_workers_city", v)}
          step={1}
        />
        <Field
          label="Jobs running at once (hard ceiling)"
          value={form.max_open_jobs}
          onChange={(v) => num("max_open_jobs", v)}
          step={1}
        />
        <Field
          label="Departments (hard ceiling)"
          value={form.max_departments}
          onChange={(v) => num("max_departments", v)}
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
      <p className="mute">No emails. One message to your iPhone when a whole job is finished, nothing for its parts.</p>
      <label className="switch">
        <input
          type="checkbox"
          checked={form.notify_push}
          onChange={(e) => setForm({ ...form, notify_push: e.target.checked })}
        />{" "}
        Tell my iPhone when a job is finished
      </label>
      <ApnsCard />
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
  const [openai, setOpenai] = useState<OpenAiStatus | null>(openAiStatus);
  const [id, setId] = useState(() => readVoiceId(config().pollyVoice));
  const [oaVoice, setOaVoice] = useState(readOpenAiVoice);
  const [test, setTest] = useState<{ ok: boolean; words: string } | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyProblem, setKeyProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadOpenAi().then((st) => {
      setOpenai(st);
      setOaVoice(readOpenAiVoice());
    });
  }, []);
  const onOpenAi = openai?.configured === true;
  /** One sentence through exactly the reply path of the active voice (OpenAI when its key is in, else Polly),
   *  then play on the unlocked context, with the result in plain words: "Played." or the precise failure. */
  const testVoice = async () => {
    setTest(null);
    const v = getVoice();
    v.prime?.(); // this click is the gesture that unlocks sound (Safari)
    const sentence = "Hi, I'm AIC. This is how I'll sound when I answer you.";
    try {
      if (v.synth && v.play) {
        const clip = onOpenAi ? await openAiSynth(sentence) : await v.synth(sentence);
        if (!clip) throw Object.assign(new Error("the speech service returned no audio"), { name: "EmptyAudio" });
        let began = false;
        await v.play(clip, () => (began = true));
        if (!began) throw Object.assign(new Error("no sound ever started"), { name: "AudioPlayError" });
      } else await v.speak(sentence);
      if (onOpenAi) resetOpenAi(); // it works again: replies use OpenAI
      setTest({ ok: true, words: "Played. If you heard nothing, check the device's volume." });
    } catch (e) {
      logVoiceError("the voice test failed", e);
      setTest({ ok: false, words: speakProblem(e) });
    }
  };
  const saveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setKeyProblem(null);
    api<{ saved_at: string }>("/voice/openai-key", { method: "PUT", body: { key: key.trim() } })
      .then(async () => {
        setKey("");
        setKeyOpen(false);
        resetOpenAi();
        const st = await loadOpenAi(true);
        setOpenai(st);
        setOaVoice(readOpenAiVoice());
        toast({ tone: "good", text: "OpenAI key saved. AIC now speaks with OpenAI's voice." });
      })
      .catch((err: unknown) => setKeyProblem(err instanceof ApiError ? err.message : "The key could not be saved."))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <h2>AIC's voice</h2>
      <p className="mute">
        {onOpenAi
          ? "OpenAI's voice. The choice is remembered on this device."
          : "Natural, human-sounding voices. The choice is remembered on this device."}
      </p>
      <label className="field">
        Voice
        {onOpenAi ? (
          <select
            aria-label="AIC's voice"
            value={oaVoice}
            onChange={(e) => {
              setOaVoice(e.target.value);
              saveOpenAiVoice(e.target.value);
            }}
          >
            {openai.voices.map((v) => (
              <option key={v} value={v}>
                {v[0]!.toUpperCase() + v.slice(1) + (v === openai.default ? " (OpenAI's default)" : "")}
              </option>
            ))}
          </select>
        ) : (
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
        )}
      </label>
      <Button variant="quiet" onClick={testVoice}>
        Test voice
      </Button>
      {test ? <Banner tone={test.ok ? "good" : "bad"}>{test.words}</Banner> : null}
      <h3>OpenAI key</h3>
      <p className="mute">
        {openai?.key_saved_at
          ? `Saved ${ago(Date.parse(openai.key_saved_at))}. It is kept in AWS and never shown again.`
          : "Paste an OpenAI API key to use OpenAI's voice. It goes straight to AWS and is never shown again."}
      </p>
      {!keyOpen ? (
        <Button variant="quiet" onClick={() => setKeyOpen(true)}>
          {openai?.key_saved_at ? "Replace the OpenAI key" : "Add an OpenAI key"}
        </Button>
      ) : (
        <form onSubmit={saveKey} autoComplete="off">
          {keyProblem ? <Banner tone="bad">{keyProblem}</Banner> : null}
          <label className="field">
            OpenAI key
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              required
            />
          </label>
          <div className="actions">
            <Button variant="primary" type="submit" label="Save the OpenAI key" disabled={busy}>
              Save the OpenAI key
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setKey("");
                setKeyOpen(false);
              }}
              label="Cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
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

type ApnsStatus = {
  key_saved_at: string | null;
  enabled: boolean;
  devices: { id: string; platform: string; sandbox: boolean; created_at: string }[];
};

/** The owner's Apple push key, typed only here (never in chat), and the phones that get the messages. */
function ApnsCard() {
  const { data, error, retry } = useApi<ApnsStatus>("/notifications/apns");
  const [open, setOpen] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [p8, setP8] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (error)
    return (
      <Banner
        tone="bad"
        action={{ label: "Try again", onClick: retry }}
      >{`iPhone setup did not load: ${error}`}</Banner>
    );
  if (!data) return <Loading what="iPhone setup" />;
  const state = data.enabled
    ? "On: your phone gets a message when a job is finished."
    : data.key_saved_at || saved
      ? "Key saved. One more step: turn on AIC_APNS_ENABLED in GitHub and deploy once."
      : "Not set up yet: paste the Apple key from Apple Developer → Keys → Apple Push Notifications.";
  return (
    <article className="card" aria-label="iPhone notifications">
      <h3>iPhone</h3>
      <p className="mute">{state}</p>
      {data.devices.length > 0 ? (
        <p className="small">{`${data.devices.length} phone${data.devices.length === 1 ? "" : "s"} registered.`}</p>
      ) : null}
      {!open ? (
        <Button
          variant="quiet"
          onClick={() => setOpen(true)}
          label={data.key_saved_at ? "Replace the Apple key" : "Add the Apple key"}
        >
          {data.key_saved_at ? "Replace the Apple key" : "Add the Apple key"}
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setProblem(null);
            api<{ saved_at: string }>("/notifications/apns", {
              method: "PUT",
              body: { key_id: keyId, team_id: teamId, bundle_id: bundleId, p8 },
            })
              .then((r) => {
                setSaved(r.saved_at);
                setOpen(false);
                setP8("");
                toast({ tone: "good", text: "Apple key saved. Deploy once with AIC_APNS_ENABLED on." });
              })
              .catch((err: unknown) =>
                setProblem(err instanceof ApiError ? err.message : "The key could not be saved."),
              )
              .finally(() => setBusy(false));
          }}
        >
          {problem ? <Banner tone="bad">{problem}</Banner> : null}
          <label className="field">
            Key ID
            <input value={keyId} onChange={(e) => setKeyId(e.target.value)} autoComplete="off" required />
          </label>
          <label className="field">
            Team ID
            <input value={teamId} onChange={(e) => setTeamId(e.target.value)} autoComplete="off" required />
          </label>
          <label className="field">
            Bundle ID
            <input
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              autoComplete="off"
              required
              placeholder="com.example.aicity"
            />
          </label>
          <label className="field">
            The .p8 key file
            <textarea
              value={p8}
              onChange={(e) => setP8(e.target.value)}
              rows={4}
              autoComplete="off"
              spellCheck={false}
              placeholder="-----BEGIN PRIVATE KEY----- …"
              required
            />
          </label>
          <div className="actions">
            <Button variant="primary" type="submit" label="Save the Apple key" disabled={busy}>
              Save the Apple key
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)} label="Cancel">
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
