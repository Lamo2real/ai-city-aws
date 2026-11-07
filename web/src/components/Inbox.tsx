// Questions & approvals: every question shows its default with a one-tap "Use default"; approvals are
// bound to the exact action and need holding the button.
import { useState } from "react";
import { answerQuestion, decideApproval, applyDefault } from "../lib/actions.ts";
import { ApiError } from "../lib/api.ts";
import { ago } from "../lib/format.ts";
import { useHud } from "../lib/store.ts";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

export function Inbox() {
  // Select the stored objects (stable references) and derive lists while rendering.
  const questionMap = useHud((s) => s.city.questions);
  const approvalMap = useHud((s) => s.city.approvals);
  const questions = Object.values(questionMap).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const approvals = Object.values(approvalMap);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: string; reason: string } | null>(null);
  const [own, setOwn] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    try {
      await fn();
      toast({ text: done, tone: "good" });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `${e.message}${e.fix ? ` ${e.fix}` : ""}`
          : "That did not go through. Nothing changed. Try again.",
      );
    }
  };

  if (!questions.length && !approvals.length)
    return (
      <section className="screen" aria-labelledby="inbox-title">
        <h1 id="inbox-title">Needs you</h1>
        <p className="empty">Nothing is waiting for you. AIC will tell you when something is.</p>
      </section>
    );

  return (
    <section className="screen" aria-labelledby="inbox-title">
      <h1 id="inbox-title">Needs you</h1>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {approvals.length ? <h2>Approvals</h2> : null}
      {approvals.map((a) => (
        <article key={a.id} className="card">
          <p>
            <b>{a.agent}</b> wants to do exactly this, once:
          </p>
          {a.preview ? <Preview p={a.preview} /> : <p className="action">{a.action}</p>}
          <p className="mute">Why it needs you: {a.reason}</p>
          <div className="row-end">
            <Button
              variant="quiet"
              onClick={() => run(() => decideApproval(a.id, false), "Refused. The agent will carry on without it.")}
            >
              Refuse
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(a)}>
              Approve…
            </Button>
          </div>
        </article>
      ))}
      {questions.length ? <h2>Questions</h2> : null}
      {questions.map((q, i) => (
        <article key={q.id} className="card">
          <p className="mute">
            {q.path} · {ago(Date.parse(q.created_at))}
          </p>
          <p className="question">{q.text}</p>
          <div className="choices">
            <Button
              variant={i === 0 ? "primary" : "secondary"}
              onClick={() => run(() => applyDefault(q.id), `Answered with the default: ${q.default_answer}`)}
            >
              Use default: {q.default_answer}
            </Button>
            {q.options
              .filter((o) => o !== q.default_answer)
              .map((o) => (
                <Button key={o} variant="quiet" onClick={() => run(() => answerQuestion(q.id, o), `Answered: ${o}`)}>
                  {o}
                </Button>
              ))}
          </div>
          <form
            className="own"
            onSubmit={(e) => {
              e.preventDefault();
              const t = (own[q.id] ?? "").trim();
              if (t) void run(() => answerQuestion(q.id, t), "Answer sent.");
            }}
          >
            <label>
              Or answer in your own words
              <input value={own[q.id] ?? ""} onChange={(e) => setOwn({ ...own, [q.id]: e.target.value })} />
            </label>
            <Button variant="quiet" type="submit">
              Send answer
            </Button>
          </form>
        </article>
      ))}
      {confirming ? (
        <Confirm
          title="Approve this action?"
          what={`${confirming.action} — it runs once, exactly as written. ${confirming.reason}`}
          cost="This may cost money or be hard to undo; that is why it needs you."
          confirmLabel="Approve"
          hold
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const c = confirming;
            setConfirming(null);
            await run(() => decideApproval(c.id, true), "Approved once. The agent will run it now.");
          }}
        />
      ) : null}
    </section>
  );
}

type PreviewData = {
  kind: string;
  account?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  note?: string;
  action?: string;
  calendar?: string;
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  attendees?: Array<string | { email: string }>;
  comment?: string;
};
const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};
/** What leaves or changes, shown in full before the owner approves (MAIL_CALENDAR.md §5.5). Plain text only. */
function Preview({ p }: { p: PreviewData }) {
  if (p.kind === "email")
    return (
      <>
        <dl className="preview" aria-label="The email">
          <dt>From</dt>
          <dd>{p.account}</dd>
          {p.to?.length ? (
            <>
              <dt>To</dt>
              <dd>{p.to.join(", ")}</dd>
            </>
          ) : null}
          {p.cc?.length ? (
            <>
              <dt>Cc</dt>
              <dd>{p.cc.join(", ")}</dd>
            </>
          ) : null}
          {p.bcc?.length ? (
            <>
              <dt>Bcc</dt>
              <dd>{p.bcc.join(", ")}</dd>
            </>
          ) : null}
          {p.subject !== undefined ? (
            <>
              <dt>Subject</dt>
              <dd>{p.subject}</dd>
            </>
          ) : null}
          {p.action === "trash" ? (
            <>
              <dt>Action</dt>
              <dd>Move to Trash</dd>
            </>
          ) : null}
        </dl>
        {p.note ? <p className="mute">{p.note}</p> : null}
        {p.body !== undefined ? (
          <pre className="preview-body" aria-label="The email's text">
            {p.body}
          </pre>
        ) : null}
      </>
    );
  if (p.kind === "event")
    return (
      <dl className="preview" aria-label="The event">
        <dt>Action</dt>
        <dd>{p.action}</dd>
        <dt>Calendar</dt>
        <dd>{p.calendar}</dd>
        {p.title ? (
          <>
            <dt>Event</dt>
            <dd>{p.title}</dd>
          </>
        ) : null}
        {p.start ? (
          <>
            <dt>When</dt>
            <dd>{`${when(p.start)} – ${when(p.end)}`}</dd>
          </>
        ) : null}
        {p.location ? (
          <>
            <dt>Where</dt>
            <dd>{p.location}</dd>
          </>
        ) : null}
        {p.attendees?.length ? (
          <>
            <dt>Guests</dt>
            <dd>{p.attendees.map((x) => (typeof x === "string" ? x : x.email)).join(", ")}</dd>
          </>
        ) : null}
        {p.comment ? (
          <>
            <dt>Note</dt>
            <dd>{p.comment}</dd>
          </>
        ) : null}
      </dl>
    );
  return <p className="mute">{p.note ?? "Exactly the action shown is approved."}</p>;
}
