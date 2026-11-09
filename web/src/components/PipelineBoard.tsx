// Sales pipeline (decisions 133 and 137): the leads Marketing nurtures and the deals Sales keeps when the owner has no CRM, in Work (`#/tickets/deals`).
// Deals come from `GET /deals` (oldest contact first) when the tab opens; there is no live event. A 404 means the
// backend is not deployed yet: the empty state, quietly.
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Banner, Button, Loading } from "./ui.tsx";

export type DealStage =
  "lead" | "nurturing" | "qualified" | "contacted" | "meeting" | "proposal" | "negotiation" | "won" | "lost";
export interface Deal {
  id: string;
  name: string;
  company: string;
  contact: string;
  email: string;
  stage: DealStage;
  /** Whose it is: Marketing (lead, nurturing) or Sales. Older deals may lack it. */
  team?: "Marketing" | "Sales";
  words: string;
  value: number | null;
  currency: string;
  next_step: string;
  last_contact_at: string;
  history: Array<{ at: string; who: string; text: string }>;
  created_at: string;
  updated_at: string;
}

const OPEN: DealStage[] = ["lead", "nurturing", "qualified", "contacted", "meeting", "proposal", "negotiation"];
const teamOf = (d: Deal) => d.team ?? (d.stage === "lead" || d.stage === "nurturing" ? "Marketing" : "Sales");
const isOpen = (d: Deal) => OPEN.includes(d.stage);
const DAY = 86_400_000;

/** Whole days since the last contact (or since the deal was added). */
export const daysSince = (d: Deal, now = Date.now()) =>
  Math.max(0, Math.floor((now - Date.parse(d.last_contact_at || d.created_at)) / DAY));

export function valueWords(d: Pick<Deal, "value" | "currency">): string | null {
  if (d.value == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: d.currency || "USD",
      maximumFractionDigits: 0,
    }).format(d.value);
  } catch {
    return `${d.value.toLocaleString("en-US")} ${d.currency}`;
  }
}

/** Open deals by stage (lead first), keeping the server's oldest-contact-first order inside each stage. */
export function openDeals(deals: Deal[]): Deal[] {
  return deals
    .map((d, i) => [d, i] as const)
    .filter(([d]) => isOpen(d))
    .sort(([a, i], [b, j]) => OPEN.indexOf(a.stage) - OPEN.indexOf(b.stage) || i - j)
    .map(([d]) => d);
}

const tone = (s: DealStage) => (s === "won" ? "done" : s === "lost" ? "failed" : "in_progress");
const lastWords = (n: number) => (n === 0 ? "Last contact today" : `Last contact ${n} day${n === 1 ? "" : "s"} ago`);
const who = (d: Deal) => (d.contact ? `${d.name} (${d.contact})` : d.name);

function Row({ d, stale, open }: { d: Deal; stale: number; open: () => void }) {
  const n = daysSince(d);
  const late = isOpen(d) && n >= stale;
  const v = valueWords(d);
  return (
    <li>
      <button type="button" className="job pl-row" onClick={open}>
        <span className="job-name">
          {who(d)} <span className="mute pl-team">· {teamOf(d)}</span>
        </span>
        <span className={`tag tag-${tone(d.stage)}`}>{d.words}</span>
        <span className="job-parts">
          {v ? <strong>{v}</strong> : null}
          {d.next_step ? <span className="mute">Next: {d.next_step}</span> : null}
        </span>
        <span className={`job-time ${late ? "pl-late" : "mute"}`}>
          {lastWords(n)}
          {late ? ". Needs a follow-up" : ""}
        </span>
      </button>
    </li>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

function DealDetail({ d, back }: { d: Deal; back: () => void }) {
  const v = valueWords(d);
  return (
    <section className="pl-detail" aria-labelledby="pl-title">
      <Button variant="quiet" onClick={back}>
        ← All deals
      </Button>
      <h2 id="pl-title">{who(d)}</h2>
      <p>
        <span className={`tag tag-${tone(d.stage)}`}>{d.words}</span>
        {v ? <> {v}</> : null}{" "}
        <span className="mute">· {teamOf(d) === "Marketing" ? "Marketing's lead" : "Sales' deal"}</span>
      </p>
      {d.company || d.email ? <p className="mute">{[d.company, d.email].filter(Boolean).join(" · ")}</p> : null}
      {d.next_step ? <p>Next: {d.next_step}</p> : null}
      <p className="mute">{lastWords(daysSince(d))}</p>
      <h3>What happened</h3>
      <ol className="history">
        {d.history.map((h, i) => (
          <li key={i}>
            <span className="mute">{when(h.at)}</span> {h.who}: {h.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The "Sales pipeline" tab in Work. */
export function PipelineBoard() {
  const [data, setData] = useState<{ stale_days: number; deals: Deal[] } | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [team, setTeam] = useState<"all" | "Marketing" | "Sales">("all");
  const load = useCallback(async () => {
    setError(false);
    try {
      const r = await api<{ stale_days?: number; deals?: Deal[] }>("/deals");
      setData({ stale_days: r.stale_days ?? 7, deals: r.deals ?? [] });
    } catch (e) {
      // Not deployed yet (404): nothing to show.
      if (e instanceof ApiError && e.status === 404) setData({ stale_days: 7, deals: [] });
      else setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const current = open ? data?.deals.find((d) => d.id === open) : null;
  if (current) return <DealDetail d={current} back={() => setOpen(null)} />;
  const shown = data ? data.deals.filter((d) => team === "all" || teamOf(d) === team) : [];
  const live = openDeals(shown);
  const closed = shown.filter((d) => !isOpen(d));
  const stale = data?.stale_days ?? 7;
  return (
    <>
      {error ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: load }}>
          Your deals did not load. Check the connection.
        </Banner>
      ) : null}
      {!data && !error ? <Loading what="your deals" /> : null}
      {data && !data.deals.length ? (
        <p className="empty">
          No deals yet. If you use HubSpot, Pipedrive or another CRM, Sales works there. Otherwise tell VAIC about a deal
          (“Add a deal: Acme, 5,000, talked to Bo”) and ask it to “follow up on my sales pipeline every day”.
        </p>
      ) : null}
      {data?.deals.length ? (
        <div className="segmented" role="group" aria-label="Whose deals">
          {(
            [
              ["all", "All"],
              ["Marketing", "Marketing leads"],
              ["Sales", "Sales deals"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={team === k} onClick={() => setTeam(k)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {data?.deals.length && !shown.length ? <p className="empty">None of these yet.</p> : null}
      {live.length ? (
        <ul className="jobs">
          {live.map((d) => (
            <Row key={d.id} d={d} stale={stale} open={() => setOpen(d.id)} />
          ))}
        </ul>
      ) : null}
      {closed.length ? (
        <>
          <h2 className="pl-closed">Closed</h2>
          <ul className="jobs">
            {closed.map((d) => (
              <Row key={d.id} d={d} stale={stale} open={() => setOpen(d.id)} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
