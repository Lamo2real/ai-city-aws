// The Chief of Staff on Needs you: a calm card at the top (on/off, how many it decided this week, a link to its
// decisions) and the "Decided for you" list, newest first, each row expandable. Shows nothing while the backend has
// no Chief of Staff (GET /chief-of-staff answers 404).
import { useEffect, useState, type MouseEvent } from "react";
import { ApiError } from "../lib/api.ts";
import { chief, decidedThisWeek, useChief, type Decided } from "../lib/chief.ts";
import { ago } from "../lib/format.ts";
import { Button, toast } from "./ui.tsx";

const FIRST = 5;

export function ChiefCard() {
  const s = useChief((x) => x);
  // The app loads it when the connection comes up; opening Needs you tries again after a failure.
  useEffect(() => {
    if (chief.get().status === "error") void chief.load();
  }, []);
  if (s.status !== "ready") return null;
  const week = decidedThisWeek(s);
  const flip = async (on: boolean) => {
    try {
      await chief.setEnabled(on);
      toast({
        text: on ? "Chief of Staff is on. It decides for you now." : "Chief of Staff is off. Everything waits for you.",
        tone: "good",
      });
    } catch (e) {
      toast({
        text: e instanceof ApiError ? e.message : "That did not go through. Nothing changed. Try again.",
        tone: "bad",
      });
    }
  };
  return (
    <section className={`card cos ${s.enabled ? "on" : "off"}`} aria-labelledby="cos-title">
      <div className="cos-head">
        <h2 id="cos-title">{s.enabled ? "Chief of Staff is handling these" : "Chief of Staff is off"}</h2>
        <label className="switch toggle">
          <input
            type="checkbox"
            role="switch"
            checked={s.enabled}
            disabled={s.saving}
            onChange={(e) => void flip(e.target.checked)}
            aria-label="Chief of Staff on or off"
          />
          <span className="toggle-track" aria-hidden="true">
            <span className="toggle-knob" />
          </span>
          {s.enabled ? "On" : "Off"}
        </label>
      </div>
      <p>
        {s.enabled
          ? "It answers your team's questions and approvals for you, so nothing waits while you're away. What only you can do stays here."
          : "Everything waits here for you. Turn it on and it decides for you while you're away."}
      </p>
      <p className="cos-count">
        {week === 0 ? "Nothing decided in the last 7 days." : `Decided ${week === 1 ? "1 thing" : `${week} things`} in the last 7 days.`}{" "}
        {s.decided.length ? <a href="#decided" onClick={(e) => jump(e)}>See what it decided</a> : null}
      </p>
    </section>
  );
}

/** Scrolls to the decided list without changing the hash route. */
function jump(e: MouseEvent) {
  e.preventDefault();
  const el = document.getElementById("decided");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  el?.querySelector<HTMLElement>("h2")?.focus();
}

export function DecidedList() {
  const s = useChief((x) => x);
  const [all, setAll] = useState(false);
  if (s.status !== "ready" || !s.decided.length) return null;
  const shown = all ? s.decided : s.decided.slice(0, FIRST);
  return (
    <section id="decided" className="decided" aria-labelledby="decided-title">
      <h2 id="decided-title" tabIndex={-1}>
        Decided for you
      </h2>
      <p className="mute">Newest first. Tap one to read it all.</p>
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
          {`${Number.isNaN(t) ? "" : `${new Date(t).toLocaleString()}. `}If this isn't what you want, tell AIC what to do instead.`}
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
