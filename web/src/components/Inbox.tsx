// Needs you: what the city is waiting on the owner for, grouped by job. Each item is one plain sentence (who
// asks, what) and big answer buttons: the 2–4 choices of a question (its default first), or Yes / No for an
// approval, plus "Write my own answer". Answering removes the card at once (put back if the server refuses).
// Approvals stay bound to the exact action and still need holding the button.
import { useState } from "react";
import { answerQuestion, decideApproval } from "../lib/actions.ts";
import { ApiError } from "../lib/api.ts";
import { capKey, capLabel, capped, isPublish, publishApp, type Capability } from "../lib/apps.ts";
import { byJob, needs, needsWords, type Need } from "../lib/needs.ts";
import { store, useHud } from "../lib/store.ts";
import { plainText, type CityApproval, type CityQuestion } from "../city/city-state.js";
import { useChief } from "../lib/chief.ts";
import { AppFrame } from "./Apps.tsx";
import { ChiefCard, DecidedList, NeedsOwnerWhy } from "./ChiefOfStaff.tsx";
import { Banner, Button, Confirm, toast } from "./ui.tsx";

/** How many cards show before "Show more": the few that matter first. */
const FIRST = 5;

/** Takes an item off the screen now; the returned function puts it back. */
function take(n: Need): () => void {
  const c = store.get().city;
  if (n.kind === "question") {
    const questions = { ...c.questions };
    delete questions[n.id];
    store.set({ city: { ...c, questions } });
    return () => {
      const now = store.get().city;
      store.set({ city: { ...now, questions: { ...now.questions, [n.id]: n.q } } });
    };
  }
  const approvals = { ...c.approvals };
  delete approvals[n.id];
  store.set({ city: { ...c, approvals } });
  return () => {
    const now = store.get().city;
    store.set({ city: { ...now, approvals: { ...now.approvals, [n.id]: n.a } } });
  };
}

export function Inbox() {
  const city = useHud((s) => s.city);
  const list = needs(city);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [confirming, setConfirming] = useState<Extract<Need, { kind: "approval" }> | null>(null);

  /** Answers: the card goes now; if the server says no, it comes back with the reason. */
  const settle = async (n: Need, fn: () => Promise<unknown>, done: string) => {
    setError(null);
    const undo = take(n);
    try {
      await fn();
      toast({ text: done, tone: "good" });
    } catch (e) {
      undo();
      setError(
        e instanceof ApiError
          ? `${e.message}${e.fix ? ` ${e.fix}` : ""}`
          : "That did not go through. Nothing changed. Try again.",
      );
    }
  };

  if (!list.length)
    return (
      <section className="screen needs" aria-labelledby="inbox-title">
        <h1 id="inbox-title">Needs you</h1>
        <ChiefCard />
        <p className="empty">Nothing needs you right now. AIC will tell you when something does.</p>
        <DecidedList />
      </section>
    );

  let shown = 0;
  const groups = byJob(list)
    .map((g) => {
      const room = all ? g.items.length : Math.max(0, FIRST - shown);
      const items = g.items.slice(0, room);
      shown += items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length);
  let primaryUsed = false;
  const primary = () => (primaryUsed ? false : (primaryUsed = true));

  return (
    <section className="screen needs" aria-labelledby="inbox-title">
      <h1 id="inbox-title">Needs you</h1>
      <ChiefCard />
      <p className="lede">{`${needsWords(list.length)}. Answer and it's gone.`}</p>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {groups.map((g) => (
        <section
          key={g.job?.id ?? "other"}
          className="needgroup"
          aria-label={g.job ? `Job: ${g.job.name}` : "Other things"}
        >
          <h2>{g.job ? g.job.name : "Other things"}</h2>
          {g.items.map((n) =>
            n.kind === "question" ? (
              <QuestionCard key={n.id} n={n} q={n.q} primary={primary()} settle={settle} />
            ) : isPublish(n.a) ? (
              <PublishCard key={n.id} a={n.a} primary={primary()} run={(fn, done) => settle(n, fn, done)} />
            ) : (
              <ApprovalCard
                key={n.id}
                n={n}
                a={n.a}
                primary={primary()}
                settle={settle}
                onYes={() => setConfirming(n)}
              />
            ),
          )}
        </section>
      ))}
      {list.length > shown ? (
        <Button variant="secondary" onClick={() => setAll(true)}>
          {`Show ${list.length - shown} more`}
        </Button>
      ) : null}
      {confirming ? (
        <Confirm
          title="Approve this action?"
          what={`${whatHappens(confirming.a)}. Exactly this, once: ${confirming.a.action}`}
          cost="This may cost money or be hard to undo; that is why it needs you."
          confirmLabel="Approve"
          hold
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const c = confirming;
            setConfirming(null);
            await settle(c, () => decideApproval(c.id, true), "Approved once. It runs now.");
          }}
        />
      ) : null}
      <DecidedList />
    </section>
  );
}

/** Why the Chief of Staff left an item to the owner: from the live list, or the record itself. */
function useWhy(id: string, record: unknown) {
  const live = useChief((s) => s.needsOwner[id]);
  return live ?? (record as { needs_owner_reason?: string }).needs_owner_reason;
}

type Settle = (n: Need, fn: () => Promise<unknown>, done: string) => Promise<void>;

function QuestionCard({ n, q, primary, settle }: { n: Need; q: CityQuestion; primary: boolean; settle: Settle }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [whole, setWhole] = useState(false);
  const ask = plainText(q.text, 160);
  const why = useWhy(q.id, q);
  // The default first, then the other choices; at most four big buttons.
  const choices = [...new Set([q.default_answer, ...q.options].filter((o) => o && o.trim()))].slice(0, 4);
  return (
    <article className="card need" aria-label={`Question from ${n.who}`}>
      <NeedsOwnerWhy why={why} />
      <p className="who">{`${n.who} asks`}</p>
      <p className="ask">
        {whole ? q.text : ask.short}{" "}
        {!ask.whole && !whole ? (
          <button type="button" className="more" onClick={() => setWhole(true)}>
            more
          </button>
        ) : null}
      </p>
      <div className="answers">
        {choices.map((o, i) => (
          <Button
            key={o}
            variant={i === 0 && primary ? "primary" : "secondary"}
            className="big"
            onClick={() => settle(n, () => answerQuestion(q.id, o), `Answered: ${o}`)}
          >
            {o}
          </Button>
        ))}
        <Button variant="quiet" className="big" onClick={() => setWriting(true)}>
          Write my own answer
        </Button>
      </div>
      {writing ? (
        <form
          className="own"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (t) void settle(n, () => answerQuestion(q.id, t), "Answer sent.");
          }}
        >
          <input
            aria-label="Your answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer…"
            autoFocus
          />
          <Button variant="primary" type="submit">
            Send
          </Button>
        </form>
      ) : null}
    </article>
  );
}

/** What will happen if the owner says yes, in one plain sentence. */
function whatHappens(a: CityApproval): string {
  const p = a.preview as PreviewData | undefined;
  if (p?.kind === "email")
    return p.action === "trash"
      ? "Move an email to the Trash"
      : `Send an email${p.to?.length ? ` to ${p.to.join(", ")}` : ""}${p.subject ? `: “${capped(p.subject, 60)}”` : ""}`;
  if (p?.kind === "event")
    return `${p.action ?? "Change an event"}${p.title ? `: “${capped(p.title, 60)}”` : ""}${p.start ? ` on ${when(p.start)}` : ""}`;
  if (a.kind === "connector.add") return `Connect a new service: ${capped(a.action, 60)}`;
  const tool = (a as { tool?: string }).tool;
  if (!tool || tool === "Bash") return "Run a command on its work computer";
  return `Use ${tool.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ")}`;
}

function ApprovalCard({
  n,
  a,
  primary,
  settle,
  onYes,
}: {
  n: Need;
  a: CityApproval;
  primary: boolean;
  settle: Settle;
  onYes: () => void;
}) {
  const why = useWhy(a.id, a);
  return (
    <article className="card need" aria-label={`Approval for ${n.who}`}>
      <NeedsOwnerWhy why={why} />
      <p className="who">{`${n.who} wants your OK`}</p>
      <p className="ask">{`${whatHappens(a)}.`}</p>
      <details className="exact">
        <summary>Exactly what it will do</summary>
        {a.preview ? <Preview p={a.preview as PreviewData} /> : <p className="action">{a.action}</p>}
        {a.reason ? <p className="mute">{`Why it needs you: ${plainText(a.reason, 200).short}`}</p> : null}
      </details>
      <div className="answers">
        <Button variant={primary ? "primary" : "secondary"} className="big" onClick={onYes}>
          Yes…
        </Button>
        <Button
          variant="secondary"
          className="big"
          onClick={() => settle(n, () => decideApproval(a.id, false), "Refused. It will carry on without it.")}
        >
          No
        </Button>
      </div>
    </article>
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

/**
 * A new app: its preview (no data: every request gets `preview`), a switch per thing it wants to read
 * (on by default; only known capabilities are offered), a pin box, then Approve / Refuse.
 */
function PublishCard({
  a,
  primary,
  run,
}: {
  a: CityApproval;
  primary: boolean;
  run: (fn: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const title = capped(a.title, 40) || "An app";
  const caps = (a.capabilities ?? []) as Capability[];
  const known = caps.filter((c) => capLabel(c));
  const unknown = caps.length - known.length;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(known.map((c) => [capKey(c), true])));
  const [pin, setPin] = useState(a.pin === true);
  const update = Boolean(a.replaces);
  return (
    <article className="card publish" aria-label={update ? `Update of ${title}` : `New app: ${title}`}>
      <p className="mute">
        {update
          ? `A new version${a.version ? ` (version ${a.version})` : ""} of one of your apps. Try it here; approve it and it replaces the current one, which is kept so you can go back.`
          : "The city built this. Try it here; approve it and it appears under Projects."}
      </p>
      <h3 className="apptitle">{title}</h3>
      {a.description ? <p>{capped(a.description, 200)}</p> : null}
      <AppFrame src={a.preview_url} title={`Preview of ${title}`} className="preview" />
      {known.length ? (
        <fieldset className="grants-pick">
          <legend>It asks to (the preview shows none of your data)</legend>
          {known.map((c) => (
            <label key={capKey(c)} className="switch">
              <input
                type="checkbox"
                checked={on[capKey(c)] ?? false}
                onChange={(e) => setOn({ ...on, [capKey(c)]: e.target.checked })}
              />{" "}
              {capLabel(c)}
            </label>
          ))}
          <p className="mute">
            Read only: it can never send, change or delete anything. You can stop any of these later.
          </p>
        </fieldset>
      ) : (
        <p className="mute">It reads none of your data.</p>
      )}
      {unknown ? (
        <p className="mute">{`${unknown} other request${unknown > 1 ? "s" : ""} AI City doesn't know stay off.`}</p>
      ) : null}
      {update ? null : (
        <label className="switch">
          <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> Put its icon in the top bar
        </label>
      )}
      <div className="row-end">
        <Button
          variant="quiet"
          onClick={() => run(() => decideApproval(a.id, false), `Refused. ${title} won't be published.`)}
        >
          Refuse
        </Button>
        <Button
          variant={primary ? "primary" : "secondary"}
          onClick={() =>
            run(
              () => publishApp(a.id, caps.length ? known.filter((c) => on[capKey(c)]) : null, pin),
              `Approved. ${title} is under Projects now.`,
            )
          }
        >
          Approve
        </Button>
      </div>
    </article>
  );
}
