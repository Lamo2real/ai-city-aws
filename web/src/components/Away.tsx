// Autopilot on the screen: "While you were away" at the top of VAIC's screen, and Settings → While I'm away
// (the Autopilot switch, standing orders, and the open items left from before). Calm by design: no badges, no
// counts that nag; what only the owner's hands can do comes with one button that does it.
import { useEffect, useState } from "react";
import { saveSettings } from "../lib/actions.ts";
import { api, ApiError } from "../lib/api.ts";
import {
  deleteOrder,
  label,
  listOrders,
  loadSummary,
  orderWords,
  setOrder,
  startOrderInChat,
  type AwaySummary,
  type StandingOrder,
  type WhenBack,
} from "../lib/away.ts";
import { needsCount } from "../lib/needs.ts";
import { useHud } from "../lib/store.ts";
import { openSignIn } from "./ConnectCard.tsx";
import { Banner, Button, Confirm, Loading, toast } from "./ui.tsx";

const FEW = 4;
const fmtSince = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** A short list of plain lines: the first few, then "and N more". */
function Few({ items }: { items: string[] }) {
  if (!items.length) return null;
  const rest = items.length - FEW;
  return (
    <ul className="away-list">
      {items.slice(0, FEW).map((t, i) => (
        <li key={`${i}-${t}`}>{t}</li>
      ))}
      {rest > 0 ? <li className="mute">{`and ${rest} more`}</li> : null}
    </ul>
  );
}

/**
 * "While you were away". `since` is when the owner left; `onClose` hides it. Shows nothing if the backend has no
 * summary yet (404).
 */
export function AwayPanel({ since, onClose, onMissing }: { since: number; onClose: () => void; onMissing?: () => void }) {
  const [s, setS] = useState<AwaySummary | null | "loading" | "failed">("loading");
  useEffect(() => {
    let live = true;
    loadSummary(since)
      .then((r) => {
        if (!live) return;
        setS(r);
        if (r === null) onMissing?.();
      })
      .catch(() => live && setS("failed"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);
  if (s === null) return null;
  const finished = s !== "loading" && s !== "failed" ? s.jobs_finished.map(label).filter(Boolean) : [];
  const running = s !== "loading" && s !== "failed" ? s.jobs_running.map(label).filter(Boolean) : [];
  const handled = s !== "loading" && s !== "failed" ? s.handled_by_standing_orders.map(label).filter(Boolean) : [];
  return (
    <section className="card away" aria-labelledby="away-title">
      <div className="away-head">
        <h2 id="away-title">While you were away</h2>
        <button type="button" className="icon-btn away-close" onClick={onClose} aria-label="Close While you were away">
          ×
        </button>
      </div>
      {s === "loading" ? <Loading what="what happened" /> : null}
      {s === "failed" ? <p className="mute">This didn't load. Your work carried on; try again from the clock.</p> : null}
      {s !== "loading" && s !== "failed" ? (
        <>
          <p className="mute">{`Since ${fmtSince(s.since)}.`}</p>
          {!finished.length && !running.length && !s.decided && !handled.length && !s.when_youre_back.length ? (
            <p>All quiet. Nothing new happened.</p>
          ) : null}
          {s.when_youre_back.length ? (
            <div className="away-part away-back">
              <h3>When you're back</h3>
              <p className="mute">Only you can do these. Nothing waited for them.</p>
              <ul className="away-list">
                {s.when_youre_back.map((w) => (
                  <BackItem key={w.id} w={w} />
                ))}
              </ul>
            </div>
          ) : null}
          {finished.length ? (
            <div className="away-part">
              <h3>Finished</h3>
              <Few items={finished} />
            </div>
          ) : null}
          {running.length ? (
            <div className="away-part">
              <h3>Still working on</h3>
              <Few items={running} />
            </div>
          ) : null}
          {s.decided ? (
            <p className="away-part">
              {`The Chief of Staff made ${s.decided === 1 ? "1 decision" : `${s.decided} decisions`} for you. `}
              <a href="#/tickets/decided">See what it decided</a>
            </p>
          ) : null}
          {handled.length ? (
            <div className="away-part">
              <h3>Your standing orders handled</h3>
              <Few items={handled} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** What the one button does for a "When you're back" item. */
export function backAction(w: WhenBack): { label: string; href?: string; signin?: { kind: "mail" | "connector"; id: string } } {
  const svc = (w.service ?? "").trim();
  const name = svc ? svc.charAt(0).toUpperCase() + svc.slice(1).replace(/[-_]/g, " ") : "";
  if (/^github$/i.test(svc)) return { label: "Add your GitHub token", href: "#/settings/github" };
  if (/\b(key|token|password)\b/i.test(w.why))
    return { label: name ? `Add the key for ${name}` : "Add the key", href: "#/settings/connectors" };
  if (/\b(pay|payment|card|billing|invoice)\b/i.test(w.why)) return { label: "Open it", href: "#/settings/open-items" };
  if (svc.startsWith("mail:")) return { label: "Sign in", signin: { kind: "mail", id: svc.slice(5) } };
  if (svc) return { label: `Sign in to ${name}`, signin: { kind: "connector", id: svc } };
  return { label: "Open it", href: "#/settings/open-items" };
}

function BackItem({ w }: { w: WhenBack }) {
  const [problem, setProblem] = useState<string | null>(null);
  const a = backAction(w);
  const go = async () => {
    if (!a.signin) return;
    const base = a.signin.kind === "mail" ? `/mail/accounts/${a.signin.id}` : `/connectors/${a.signin.id}/login`;
    setProblem(
      await openSignIn({
        kind: a.signin.kind,
        id: a.signin.id,
        signinPath: a.signin.kind === "mail" ? `${base}/signin` : base,
        completePath: `${base}/complete`,
      }),
    );
  };
  return (
    <li className="away-backitem">
      <span className="away-backtext">
        <b>{w.title}</b>
        {w.why ? <span className="mute">{w.why}</span> : null}
        {problem ? (
          <span className="field-error" role="alert">
            {problem}
          </span>
        ) : null}
      </span>
      {a.href ? (
        <a className="btn btn-secondary" href={a.href}>
          {a.label}
        </a>
      ) : (
        <Button variant="secondary" onClick={go}>
          {a.label}
        </Button>
      )}
    </li>
  );
}

/** Settings → While I'm away: the Autopilot switch, the standing orders, and the open items from before. */
export function AwaySettings() {
  const [autopilot, setAutopilot] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<StandingOrder[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<StandingOrder | null>(null);
  const open = useHud((s) => needsCount(s.city));
  const loadOrders = () => {
    setProblem(null);
    listOrders()
      .then(setOrders)
      .catch(() => setProblem("Your standing orders didn't load. Check the connection."));
  };
  useEffect(() => {
    api<{ settings: Record<string, unknown> }>("/settings")
      .then((r) => setAutopilot(r.settings.autopilot !== false))
      .catch(() => setAutopilot(true));
    loadOrders();
  }, []);

  const flip = async (on: boolean) => {
    const was = autopilot;
    setAutopilot(on);
    try {
      await saveSettings({ autopilot: on });
      toast({
        text: on ? "Autopilot is on. Nothing waits for you." : "Autopilot is off. Questions wait for you again.",
        tone: "good",
      });
    } catch (e) {
      setAutopilot(was);
      toast({ text: e instanceof ApiError ? e.message : "Not saved. Nothing changed. Try again.", tone: "bad" });
    }
  };
  const toggle = async (o: StandingOrder, on: boolean) => {
    setOrders((l) => l?.map((x) => (x.id === o.id ? { ...x, enabled: on } : x)) ?? l);
    try {
      await setOrder(o.id, { enabled: on });
    } catch (e) {
      setOrders((l) => l?.map((x) => (x.id === o.id ? { ...x, enabled: !on } : x)) ?? l);
      toast({ text: e instanceof ApiError ? e.message : "Not saved. Nothing changed. Try again.", tone: "bad" });
    }
  };

  return (
    <>
      <section className="card away-autopilot" aria-labelledby="ap-title">
        <div className="cos-head">
          <h2 id="ap-title">Autopilot</h2>
          {autopilot === null ? null : (
            <label className="switch toggle">
              <input
                type="checkbox"
                role="switch"
                checked={autopilot}
                onChange={(e) => void flip(e.target.checked)}
                aria-label="Autopilot on or off"
              />
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-knob" />
              </span>
              {autopilot ? "On" : "Off"}
            </label>
          )}
        </div>
        <p>
          {autopilot === false
            ? "Off: your team's questions and approvals wait for you."
            : "Your city keeps working while you're away. The Chief of Staff answers your team's questions and approvals; what only you can do waits on a short list for when you're back, and nothing stops for it."}
        </p>
      </section>

      <h2>Standing orders</h2>
      <p className="mute">Work the city picks up on its own, on a schedule.</p>
      {problem ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: loadOrders }}>
          {problem}
        </Banner>
      ) : null}
      {!orders && !problem ? <Loading what="your standing orders" /> : null}
      {orders && !orders.length ? (
        <p className="empty">No standing orders yet. Add one, like “check new Jira tickets every 15 minutes”.</p>
      ) : null}
      {orders?.length ? (
        <ul className="orders">
          {orders.map((o) => (
            <li key={o.id} className={`card order${o.enabled ? "" : " off"}`}>
              <p className="order-words">{orderWords(o)}</p>
              {o.instructions ? <p className="order-more mute">{`“${o.instructions}”`}</p> : null}
              <div className="order-actions">
                <label className="switch toggle">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={o.enabled}
                    onChange={(e) => void toggle(o, e.target.checked)}
                    aria-label={`${orderWords(o)} On or off`}
                  />
                  <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-knob" />
                  </span>
                  {o.enabled ? "On" : "Off"}
                </label>
                <Button variant="quiet" onClick={() => setRemoving(o)} label={`Delete: ${orderWords(o)}`}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="primary" onClick={startOrderInChat}>
        Add a standing order
      </Button>
      <p className="mute">VAIC's chat opens with “While I'm away, …”: say what to handle and how often.</p>

      {open ? (
        <>
          <ul className="settings-menu">
            <li>
              <a href="#/settings/open-items">
                <span className="settings-menu-title">Open items</span>
                <span className="mute">
                  {open === 1 ? "1 thing from before Autopilot is still open" : `${open} things from before Autopilot are still open`}
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </a>
            </li>
          </ul>
        </>
      ) : null}

      {removing ? (
        <Confirm
          title="Delete this standing order?"
          what={orderWords(removing)}
          cost="You can add it again any time by asking VAIC."
          confirmLabel="Delete"
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const o = removing;
            setRemoving(null);
            setOrders((l) => l?.filter((x) => x.id !== o.id) ?? l);
            try {
              await deleteOrder(o.id);
              toast({ text: "Deleted. That work is no longer picked up on its own.", tone: "good" });
            } catch (e) {
              setOrders((l) => (l ? [...l, o] : l));
              toast({ text: e instanceof ApiError ? e.message : "Not deleted. Try again.", tone: "bad" });
            }
          }}
        />
      ) : null}
    </>
  );
}
