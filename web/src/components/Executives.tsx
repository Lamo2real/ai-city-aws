// Settings → Executives (decision 140): the CEO, COO, CFO and CTO, an advisory layer on top of the city. They only
// speak when asked (the owner through AIC, or the Orchestrator on a big decision) and never start or assign work.
// Here: each one on or off, their latest advice with what it was based on, and the optional reviews (off by default).
//   `GET /executives` → {executives, recommendations, reviews}; `PUT /executives {enabled?, reviews?}` → the same.
//   A 404 means the backend is not deployed yet: a quiet note, nothing to switch.
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Banner, Loading, toast } from "./ui.tsx";

export interface Executive {
  id: string;
  title: string;
  name: string;
  about: string;
  enabled: boolean;
  model?: string;
}
export interface Recommendation {
  id: string;
  executive: string;
  title: string;
  question: string;
  recommendation: string;
  reasons?: string[];
  risks?: string[];
  facts?: string[];
  assumptions?: string[];
  confidence?: string;
  sources?: string[];
  to?: string;
  review?: string;
  at: string;
}
export interface Review {
  id: string;
  executive: string;
  title: string;
  enabled: boolean;
  every_days: number;
  last_run_at?: string | null;
}
export interface ExecutivesState {
  executives: Executive[];
  recommendations: Recommendation[];
  reviews: Review[];
}

/** Plain names for the records an executive read before advising. */
export const SOURCE_WORDS: Record<string, string> = {
  city_status: "city status",
  jobs: "jobs",
  costs: "costs",
  handoffs: "handoffs",
  deals: "deals",
  department_reports: "department reports",
  company_brief: "company brief",
  knowledge: "knowledge base",
};
export const sourceWords = (s: string[] = []) => s.map((x) => SOURCE_WORDS[x] ?? x.replace(/_/g, " ")).join(", ");

/** "every day", "every week", "every 2 weeks", "every 30 days". */
export function everyDays(n: number): string {
  if (n === 1) return "every day";
  if (n === 7) return "every week";
  if (n === 14) return "every 2 weeks";
  return `every ${n} days`;
}

/** Who asked, in plain words. */
export function askedBy(r: Recommendation): string {
  if (r.review) return "Scheduled review";
  return r.to === "orchestrator" ? "Asked by the Orchestrator" : "Asked by you";
}

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

function Switch(p: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <label className="switch toggle">
      <input
        type="checkbox"
        role="switch"
        checked={p.on}
        onChange={(e) => p.onChange(e.target.checked)}
        aria-label={p.label}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      {p.on ? "On" : "Off"}
    </label>
  );
}

export function Executives() {
  const [data, setData] = useState<ExecutivesState | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    api<ExecutivesState>("/executives").then(setData, (e: unknown) => {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setFailed(true);
    });
  };
  useEffect(load, []);

  const save = async (body: Record<string, unknown>, done: string) => {
    setProblem(null);
    try {
      setData(await api<ExecutivesState>("/executives", { method: "PUT", body }));
      toast({ text: done, tone: "good" });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Not saved. Nothing changed. Try again.");
    }
  };

  if (missing)
    return <p className="mute">The executives arrive with the next update of your city. Nothing to set up yet.</p>;
  if (failed)
    return (
      <Banner tone="bad" action={{ label: "Try again", onClick: load }}>
        The executives didn't load. Check the connection.
      </Banner>
    );
  if (!data) return <Loading what="your executives" />;

  return (
    <>
      <h2>Executives</h2>
      <p className="mute">
        Four advisers on top of your city. They give advice only when you ask AIC (“ask the CFO if this pays off”) or
        when the Orchestrator weighs a big decision. They never start, assign or run work: your rules and your city's
        chain of command stay exactly as they are.
      </p>
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
      <ul className="execs">
        {data.executives.map((x) => (
          <li key={x.id} className={`card exec${x.enabled ? "" : " off"}`} data-exec={x.id}>
            <div className="cos-head">
              <h3>
                {x.title} <span className="mute">{x.name}</span>
              </h3>
              <Switch
                on={x.enabled}
                label={`${x.title} on or off`}
                onChange={(on) =>
                  void save({ enabled: { [x.id]: on } }, on ? `The ${x.title} is on.` : `The ${x.title} is off.`)
                }
              />
            </div>
            <p>{x.about}</p>
          </li>
        ))}
      </ul>

      <h2>Latest advice</h2>
      {data.recommendations.length === 0 ? (
        <p className="empty">No advice yet. Ask AIC, for example “what does the CTO think about this?”.</p>
      ) : (
        <ul className="exec-advice">
          {data.recommendations.map((r) => (
            <li key={r.id} className="card advice">
              <p className="advice-head">
                <strong>{r.title}</strong> <span className="mute">{`${askedBy(r)} · ${when(r.at)}`}</span>
              </p>
              {r.question ? <p className="advice-q mute">{`“${r.question}”`}</p> : null}
              <p className="advice-rec">{r.recommendation}</p>
              {r.reasons?.length ? (
                <ul className="advice-why">
                  {r.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}
              {r.risks?.length ? <p className="advice-risk">{`Risk: ${r.risks.join("; ")}`}</p> : null}
              {r.facts?.length || r.assumptions?.length ? (
                <details>
                  <summary>Facts and assumptions</summary>
                  <ul>
                    {(r.facts ?? []).map((x) => (
                      <li key={`f-${x}`}>{x}</li>
                    ))}
                    {(r.assumptions ?? []).map((x) => (
                      <li key={`a-${x}`}>{`Assumed: ${x}`}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className="advice-src mute">
                {`Based on: ${sourceWords(r.sources) || "the question only"}${r.confidence ? ` · ${r.confidence} confidence` : ""}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2>Reviews</h2>
      <p className="mute">
        Optional, and off until you turn them on. A review is a short report in AIC's chat; it never starts work.
      </p>
      <ul className="orders">
        {data.reviews.map((r) => {
          const who = data.executives.find((x) => x.id === r.executive)?.title ?? r.executive.toUpperCase();
          return (
            <li key={r.id} className={`card order${r.enabled ? "" : " off"}`} data-review={r.id}>
              <p className="order-words">{`${who} ${r.title.toLowerCase()}, ${everyDays(r.every_days)}`}</p>
              {r.last_run_at ? <p className="mute">{`Last: ${when(r.last_run_at)}`}</p> : null}
              <div className="order-actions">
                <Switch
                  on={r.enabled}
                  label={`${who} ${r.title} on or off`}
                  onChange={(on) =>
                    void save(
                      { reviews: { [r.id]: { enabled: on } } },
                      on ? `${who} ${r.title.toLowerCase()} is on, ${everyDays(r.every_days)}.` : "Review off.",
                    )
                  }
                />
                <label className="field inline">
                  How often
                  <select
                    value={r.every_days}
                    onChange={(e) =>
                      void save({ reviews: { [r.id]: { every_days: Number(e.target.value) } } }, "Saved.")
                    }
                  >
                    {[1, 7, 14, 30].map((n) => (
                      <option key={n} value={n}>
                        {everyDays(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
