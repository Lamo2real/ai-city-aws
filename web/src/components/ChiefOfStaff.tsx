// What the Chief of Staff decided, under Work → "Decided for you": newest first, each row expandable. And the one
// line an open item carries when it left that item to the owner.
import { useEffect, useState } from "react";
import { chief, useChief, type Decided } from "../lib/chief.ts";
import { ago } from "../lib/format.ts";
import { Button } from "./ui.tsx";

const FIRST = 5;

export function DecidedList({ inWork = false }: { inWork?: boolean }) {
  const s = useChief((x) => x);
  const [all, setAll] = useState(false);
  // The app loads it when the connection comes up; opening the list tries again after a failure.
  useEffect(() => {
    if (chief.get().status === "error") void chief.load();
  }, []);
  if (s.status !== "ready" || !s.decided.length)
    return inWork ? (
      <p className="empty">
        Nothing decided yet. When your team asks something, the Chief of Staff decides it and it shows here.
      </p>
    ) : null;
  const shown = all ? s.decided : s.decided.slice(0, FIRST);
  return (
    <section id="decided" className="decided" aria-label="Decided for you">
      {inWork ? null : <h2>Decided for you</h2>}
      <p className="mute">What the Chief of Staff decided for you, newest first. Tap one to read it all.</p>
      {shown.map((d) => (
        <DecidedRow key={d.id} d={d} />
      ))}
      {s.decided.length > shown.length ? (
        <Button variant="secondary" onClick={() => setAll(true)}>
          {`Show ${s.decided.length - shown.length} more`}
        </Button>
      ) : null}
    </section>
  );
}

function DecidedRow({ d }: { d: Decided }) {
  const t = Date.parse(d.at);
  const when = Number.isNaN(t) ? "" : ago(t);
  const meta = [when, d.department].filter(Boolean).join(" · ");
  return (
    <details className="card decided-item" aria-label={`Decided: ${d.title}`}>
      <summary>
        <span className="decided-title">{d.title}</span>
        <span className="decided-choice">
          {d.kind === "approval" ? "It said: " : "It chose: "}
          <strong>{d.choice || "—"}</strong>
        </span>
        {d.reason ? <span className="decided-reason">{d.reason}</span> : null}
        {meta ? <span className="decided-meta">{meta}</span> : null}
      </summary>
      <div className="decided-more">
        <p>{d.title}</p>
        {d.reason ? <p>{`Why: ${d.reason}`}</p> : null}
        <p className="mute">
          {`${Number.isNaN(t) ? "" : `${new Date(t).toLocaleString()}. `}If this isn't what you want, tell VAIC what to do instead.`}
        </p>
      </div>
    </details>
  );
}

/** On an open card: why the Chief of Staff left this one to the owner. */
export function NeedsOwnerWhy({ why }: { why: string | undefined }) {
  if (!why) return null;
  return <p className="cos-why">{`Chief of Staff: ${why}`}</p>;
}
