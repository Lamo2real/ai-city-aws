// The walkthrough card under AIC's chat (docs/PRODUCT.md "AI workflows"): the newest open workflow run in the
// conversation. Guide mode shows one page at a time with Back / Next; do mode shows what AIC will create and, once
// everything is known, "Yes, create it", which is the owner's own words sent in the chat (nothing spends from a
// click that bypasses AIC).
import { useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { ApiError } from "../lib/api.ts";
import {
  currentRun,
  useWorkflows,
  workflows,
  workflowsApi,
  type RunInput,
  type TasteQuestion,
  type WorkflowMode,
  type WorkflowRun,
} from "../lib/workflows.ts";
import { Button } from "./ui.tsx";

export const CONFIRM_WORDS = "Yes, create it";

function Inputs({ inputs }: { inputs: RunInput[] }) {
  if (!inputs.length) return null;
  return (
    <dl className="wf-inputs">
      {inputs.map((i) => (
        <div key={i.key}>
          <dt>{i.label}</dt>
          <dd className={i.value ? undefined : "mute"}>
            {i.value ?? "AIC will ask"}
            {i.value && i.assumed ? <span className="mute"> (my pick; change it below)</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Taste questions: the team went on with the default; a tap changes it. Nothing here ever blocks the work. */
function Taste({ questions, onAnswered }: { questions: TasteQuestion[]; onAnswered: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const open = questions.filter((q) => q.status === "open");
  if (!open.length) return null;
  const pick = async (q: TasteQuestion, answer: string) => {
    setBusy(q.id);
    setProblem(null);
    try {
      await workflowsApi.answerTaste(q.id, answer);
      onAnswered();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <h3 className="wf-title">Your say (the work isn't waiting)</h3>
      {open.map((q) => (
        <div key={q.id} role="group" aria-label={q.question} aria-busy={busy === q.id}>
          <p>
            <strong>{q.question}</strong> <span className="mute">Going with: {q.default}</span>
          </p>
          <div className="row-end">
            {q.options.map((o) => (
              <Button key={o} variant="secondary" disabled={busy === q.id} onClick={() => void pick(q, o)}>
                {o}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

export function WorkflowCard({ conversation = "main" }: { conversation?: string }) {
  const run = useWorkflows((s) => currentRun(s.runs, conversation));
  if (!run) return null;
  return <RunCard key={run.id} run={run} />;
}

function RunCard({ run }: { run: WorkflowRun }) {
  const [open, setOpen] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const call = async (p: Promise<{ run: WorkflowRun }>) => {
    setProblem(null);
    try {
      workflows.put((await p).run);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  };
  const setMode = (mode: WorkflowMode) => call(workflowsApi.mode(run.id, mode));
  const stop = () => call(workflowsApi.cancel(run.id));

  const guide = run.mode === "guide" && run.status !== "running";
  const total = run.steps.length;
  const at = Math.min(Math.max(run.step, 0), Math.max(total - 1, 0));
  const page = run.steps[at];
  const last = at >= total - 1;
  const byKey = new Map(run.inputs.map((i) => [i.key, i]));

  let body;
  if (run.status === "running")
    body = (
      <>
        <p role="status">
          The team is on it{run.present === false ? ", finishing it on its own" : ""}
          {run.task_id ? <span className="mute"> (task {run.task_id})</span> : null}.
        </p>
        {run.spend ? <p className="wf-spend">{run.spend.text}</p> : null}
        <Inputs inputs={run.inputs} />
        <Taste questions={run.taste ?? []} onAnswered={() => void workflows.load()} />
      </>
    );
  else if (run.next.kind === "connect")
    body = (
      <p>
        Connect {run.connector.label} first: {run.connector.where}.{" "}
        <a href="#/settings/departments">Open Departments &amp; tools</a>
      </p>
    );
  else if (run.next.kind === "mode")
    body = (
      <>
        <p>{run.summary}</p>
        <div className="row-end">
          <Button variant="secondary" onClick={() => setMode("guide")}>
            Walk me through it
          </Button>
          <Button variant="secondary" onClick={() => setMode("do")}>
            Do it for me
          </Button>
        </div>
      </>
    );
  else if (guide && page)
    body = (
      <>
        <h3 className="wf-title">{page.title}</h3>
        <p className="wf-guide">{page.guide}</p>
        <Inputs inputs={page.inputs.flatMap((k) => byKey.get(k) ?? [])} />
        <div className="row-end">
          <Button variant="secondary" disabled={at === 0} onClick={() => call(workflowsApi.step(run.id, "back"))}>
            Back
          </Button>
          <Button variant="primary" onClick={() => call(workflowsApi.step(run.id, last ? "done" : "next"))}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setMode("do")}>
          Do it for me
        </Button>
      </>
    );
  else if (run.next.kind === "confirm")
    body = (
      <>
        <p>AIC will {run.spend ? "create" : "build"} this:</p>
        <Inputs inputs={run.inputs} />
        {run.spend ? <p className="wf-spend">{run.spend.text}</p> : null}
        <Button variant="primary" onClick={() => sendMessage(CONFIRM_WORDS)}>
          {CONFIRM_WORDS}
        </Button>
        <Button variant="secondary" onClick={() => setMode("guide")}>
          Walk me through it
        </Button>
      </>
    );
  else
    body = (
      <>
        <p>{run.next.question ? `AIC is asking: ${run.next.question}` : run.summary}</p>
        <Inputs inputs={run.inputs} />
        {run.mode === "do" ? (
          <Button variant="secondary" onClick={() => setMode("guide")}>
            Walk me through it
          </Button>
        ) : null}
      </>
    );

  const heading = guide && total ? `${run.name}: step ${at + 1} of ${total}` : run.name;
  return (
    <section className="connect-card wf-card" aria-label={run.name}>
      <button type="button" className="wf-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{run.name}</span>
        {guide && total ? (
          <span className="mute">
            Step {at + 1} of {total}
          </span>
        ) : null}
        <span className="sr">{open ? "Hide" : "Show"}</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="wf-body" role="group" aria-label={heading}>
          {body}
          {problem ? (
            <p className="field-error" role="alert">
              {problem}
            </p>
          ) : null}
          {run.status !== "running" ? (
            <Button variant="quiet" onClick={stop}>
              Stop
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
