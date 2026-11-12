// VAIC's browser in the chat (decision 265), like Claude's "Used the browser (18 actions) 1m 21s ›": a row with the
// latest screenshots as thumbnails, the step list when opened, and while it works a large live view of the page
// with the pointer where it clicked. Screenshots are short-lived links to the files bucket (browser/, gone in a day).
import { useEffect, useRef, useState } from "react";
import type { BrowserRun as Run, BrowserStep } from "../lib/store.ts";

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export function took(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/** The › that turns down when its section is open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`bchev${open ? " is-open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9s1.2-6.4 3.8-9z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

/** One screenshot with the pointer drawn where VAIC clicked (positions are in the 1280×800 page). */
function Shot(p: { step: BrowserStep; run: Run; className?: string; pointer?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken || !p.step.shot)
    return <div className={`bshot bshot-gone ${p.className ?? ""}`}>The screenshot has expired.</div>;
  return (
    <div className={`bshot ${p.className ?? ""}`}>
      <img src={p.step.shot} alt={p.step.label} loading="lazy" onError={() => setBroken(true)} />
      {p.pointer && p.step.pointer ? (
        <span
          className="bpointer"
          aria-hidden="true"
          style={{
            left: `${(p.step.pointer.x / p.run.width) * 100}%`,
            top: `${(p.step.pointer.y / p.run.height) * 100}%`,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M4 2l15 10-7 1.5L9 21z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

/** The larger view the owner opens: one step at a time, with ← → to move through them. */
function Viewer(p: { run: Run; at: number; onClose: () => void }) {
  const [i, setI] = useState(p.at);
  const ref = useRef<HTMLDivElement>(null);
  const step = p.run.steps[Math.min(i, p.run.steps.length - 1)];
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        p.onClose();
      }
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "ArrowRight") setI((x) => Math.min(p.run.steps.length - 1, x + 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [p]);
  if (!step) return null;
  return (
    <div className="scrim" role="presentation" onClick={p.onClose}>
      <div
        className="dialog panel bviewer"
        role="dialog"
        aria-modal="true"
        aria-label="VAIC's browser"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bbar">
          <span className="bhost">{host(step.url) || "Browser"}</span>
          <span className="mute">{`Step ${i + 1} of ${p.run.steps.length}: ${step.label}`}</span>
          <button type="button" className="linkish" onClick={p.onClose}>
            Close
          </button>
        </div>
        <Shot step={step} run={p.run} pointer />
        <div className="row-end">
          <button type="button" className="choice" disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Back
          </button>
          {step.url ? (
            <a className="choice" href={step.url} target="_blank" rel="noopener noreferrer">
              Open the page
            </a>
          ) : null}
          <button type="button" className="choice" disabled={i >= p.run.steps.length - 1} onClick={() => setI(i + 1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export function BrowserRunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run.done]);
  if (!run.steps.length && run.done) return null;
  const last = run.steps.at(-1);
  const seconds = run.done ? run.seconds : Math.max(run.seconds, (now - run.started) / 1000);
  const n = Math.max(run.actions, run.steps.length);
  const words = `${run.done ? "Used" : "Using"} the browser (${n} ${n === 1 ? "action" : "actions"})`;
  return (
    <div className={`brun${run.done ? "" : " is-live"}`} data-testid="browser-run">
      <div className="brow">
        <button type="button" className="brow-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          <GlobeIcon />
          <span className={run.done ? undefined : "shimmer"}>{words}</span>
          <span className="vaic-status-time">{took(seconds)}</span>
          <Chevron open={open} />
        </button>
        <span className="bthumbs">
          {run.steps.slice(-3).map((s) => (
            <button
              key={s.n}
              type="button"
              className="bthumb"
              aria-label={`Open step ${s.n} larger: ${s.label}`}
              onClick={() => setViewing(run.steps.indexOf(s))}
            >
              <Shot step={s} run={run} />
            </button>
          ))}
        </span>
      </div>
      {open ? (
        <ol className="bsteps">
          {run.steps.map((s, i) => (
            <li key={s.n}>
              <button type="button" className="bstep" onClick={() => setViewing(i)}>
                <Shot step={s} run={run} className="bstep-shot" />
                <span>
                  {s.label}
                  {host(s.url) ? <span className="mute">{` · ${host(s.url)}`}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {!run.done && last ? (
        <div className="blive" aria-live="polite">
          <div className="bbar">
            <span className="bhost">{host(last.url) || "Browser"}</span>
            <span className="mute bstep-now">{last.label}</span>
            <button
              type="button"
              className="bexpand"
              aria-label="Open the browser larger"
              onClick={() => setViewing(run.steps.length - 1)}
            >
              <ExpandIcon />
            </button>
          </div>
          <Shot step={last} run={run} pointer />
        </div>
      ) : null}
      {viewing !== null ? <Viewer run={run} at={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}
