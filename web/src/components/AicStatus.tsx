// AIC at work, before its first words: a small copy of the owner's eye with a calm slow blink, the current
// step in silver with a soft shimmer sweeping across it, and the seconds so far. Below a finished reply, the
// steps it took fold into one line that opens on a tap.
import { useEffect, useState } from "react";
import type { AceTurn } from "../lib/store.ts";

export function AicStatus({ turn }: { turn: AceTurn }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const step = turn.steps.at(-1) ?? "Working on it";
  const secs = Math.max(0, Math.floor((now - turn.started) / 1000));
  return (
    <div className="aic-status" role="status" aria-label={`AIC: ${step}`}>
      <span className="aic-status-eye" aria-hidden="true" />
      <span className="shimmer" aria-hidden="true">
        {step}…
      </span>
      <span className="aic-status-time" aria-hidden="true">
        {secs}s
      </span>
    </div>
  );
}

/** The steps under a finished reply. While work AIC handed on is still running (`running`), the line carries the
 *  same silver shimmer as the live status row, with the current step and a clock counting from when the owner
 *  sent; when the work finishes or reports back it settles to the plain list. */
export function AicSteps({
  steps,
  tookMs,
  running = false,
  started,
}: {
  steps: string[];
  tookMs?: number;
  running?: boolean;
  started?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000); // only the clock on screen; state comes from events
    return () => clearInterval(t);
  }, [running]);
  if (steps.length < 2) return null; // "Understanding your message" alone adds nothing
  const current = steps.at(-1);
  if (running) {
    const secs = started ? Math.max(0, Math.floor((now - started) / 1000)) : null;
    return (
      <details className="aic-steps is-running">
        <summary aria-label={`Still working: ${current}. ${steps.length} steps so far.`}>
          <span className="shimmer" aria-hidden="true">
            {`${steps.length} steps · ${current}…`}
          </span>
          {secs !== null ? (
            <span className="aic-status-time" aria-hidden="true">
              {secs}s
            </span>
          ) : null}
        </summary>
        <ol>
          {steps.map((s, i) => (
            <li key={i} className={i === steps.length - 1 ? "current" : undefined}>
              {s}
            </li>
          ))}
        </ol>
      </details>
    );
  }
  const secs = tookMs === undefined ? null : Math.max(1, Math.round(tookMs / 1000));
  return (
    <details className="aic-steps">
      <summary>
        {`${steps.length} steps`}
        {secs ? ` · ${secs}s` : ""}
      </summary>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}
