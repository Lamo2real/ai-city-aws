// Settings → Company (decisions 135–137, 136/138): what the business is, told once; every department reads it, and
// while it runs, the support, marketing and sales rounds go on their own. Decision 138: nothing starts unless the
// owner says so, so it is off by default and Save always sends the switch as it stands. `GET/PUT/DELETE /company`. A 404 means the backend
// is not deployed yet: an empty form, quietly.
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Banner, Button, Loading, toast } from "./ui.tsx";

export interface CompanyBrief {
  text: string;
  running: boolean;
  support_source: string;
  set_at: string;
  /** When it was last switched on (decision 138), or null while off. */
  running_since?: string | null;
}
export interface CompanyOrder {
  id: string;
  source: string;
  instructions: string;
  department: string;
  every_minutes: number;
  enabled: boolean;
  last_run_at?: string | null;
}
interface Company {
  brief: CompanyBrief | null;
  orders: CompanyOrder[];
}

/** "every 15 minutes", "every hour", "every day", "every 2 days". */
export function everyWords(min: number): string {
  if (min % 1440 === 0) return min === 1440 ? "every day" : `every ${min / 1440} days`;
  if (min % 60 === 0) return min === 60 ? "every hour" : `every ${min / 60} hours`;
  return min === 1 ? "every minute" : `every ${min} minutes`;
}

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

export function CompanySettings() {
  const [data, setData] = useState<Company | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [running, setRunning] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const take = (c: Company) => {
    setData({ brief: c.brief ?? null, orders: c.orders ?? [] });
    setText(c.brief?.text ?? "");
    setSource(c.brief?.support_source ?? "");
    setRunning(c.brief?.running === true);
  };
  const load = () => {
    setFailed(false);
    api<Company>("/company").then(take, (e: unknown) => {
      // Not deployed yet (404): an empty form.
      if (e instanceof ApiError && e.status === 404) take({ brief: null, orders: [] });
      else setFailed(true);
    });
  };
  useEffect(load, []);

  const save = async () => {
    setProblem(null);
    try {
      take(await api<Company>("/company", { method: "PUT", body: { text, running, support_source: source } }));
      toast({ text: "Saved. Every department now knows your company.", tone: "good" });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Not saved. Nothing changed. Try again.");
    }
  };
  const remove = async () => {
    setProblem(null);
    try {
      take(await api<Company>("/company", { method: "DELETE" }));
      toast({ text: "The brief is removed.", tone: "good" });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Not removed. Try again.");
    }
  };

  if (failed)
    return (
      <Banner tone="bad" action={{ label: "Try again", onClick: load }}>
        Your company didn't load. Check the connection.
      </Banner>
    );
  if (!data) return <Loading what="your company" />;
  return (
    <>
      <h2>Your company</h2>
      <p className="mute">
        Tell AI City what your business is once. Every department then knows it, and the support, marketing and sales
        rounds run while you're away.
      </p>
      <p className="co-state">
        {data.brief?.running
          ? data.brief.running_since
            ? `Running on its own since ${when(data.brief.running_since)}.`
            : "Running on its own."
          : "Off: nothing runs on its own. Switch it on to let AI City run the business while you're away."}
      </p>
      {problem ? <Banner tone="bad">{problem}</Banner> : null}
      <label className="field">
        What your business is
        <textarea
          rows={4}
          value={text}
          placeholder="We're an online fashion store like Zalando: shoes and clothes, delivered across Europe."
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label className="field">
        Where customers write to you
        <input
          type="text"
          value={source}
          placeholder="Slack #support or support@yourshop.com"
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      <label className="switch toggle">
        <input type="checkbox" role="switch" checked={running} onChange={(e) => setRunning(e.target.checked)} />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-knob" />
        </span>
        Run the business while I'm away
      </label>
      <div className="co-actions">
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        {data.brief ? (
          <Button variant="quiet" onClick={remove}>
            Remove the brief
          </Button>
        ) : null}
      </div>

      <h2>What runs on its own</h2>
      {data.orders.length ? (
        <ul className="orders">
          {data.orders.map((o) => (
            <li key={o.id} className={`card order${o.enabled ? "" : " off"}`}>
              <p className="order-words">
                <strong>{o.department}</strong> watches {o.source}, {everyWords(o.every_minutes)}
              </p>
              <span className={`tag${o.enabled ? " tag-done" : ""}`}>{o.enabled ? "On" : "Off"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing runs on its own yet. Save your company and the rounds start.</p>
      )}
    </>
  );
}
