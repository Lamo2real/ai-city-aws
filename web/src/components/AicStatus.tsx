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

export function AicSteps({ steps, tookMs }: { steps: string[]; tookMs?: number }) {
  if (steps.length < 2) return null; // "Understanding your message" alone adds nothing
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
