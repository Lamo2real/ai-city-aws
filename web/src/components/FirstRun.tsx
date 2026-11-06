// A three-step guide on first login: meet Ace, see the City, where the money is. Skippable, and it
// can be opened again from Settings.
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui.tsx";

const STEPS = [
  {
    title: "Meet Ace",
    text: "Ace is the only one you talk to. Type or tap the mic and just ask: “yo Ace, what’s the status?”. Ace hands real work to the team and tells you when it is done.",
  },
  {
    title: "See the City",
    text: "The City shows your organization live: the Orchestrator at HQ, one building per department, and workers who walk in when hired and leave when done. Tap anyone to see what they are doing.",
  },
  {
    title: "Where the money is",
    text: "The pill at the top always shows today’s spend against your daily cap. It turns amber near the cap and red at it. Figures are estimates; the AWS bill is the truth.",
  },
];

export function FirstRun({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector<HTMLElement>("button")?.focus(), [i]);
  const step = STEPS[i]!;
  return (
    <div className="scrim" role="presentation">
      <div className="dialog panel guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" ref={ref}>
        <p className="mute">{`Step ${i + 1} of ${STEPS.length}`}</p>
        <h2 id="guide-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="row-end">
          <Button variant="quiet" onClick={onDone}>
            Skip
          </Button>
          {i < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setI(i + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={onDone}>
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
