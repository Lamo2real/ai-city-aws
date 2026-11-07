// A three-step guide on first login: meet AIC, see the City, where the money is. Skippable, and it
// can be opened again from Settings.
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui.tsx";

const STEPS = [
  {
    title: "Meet AIC",
    text: "Talk to AIC like a friend. Type, or tap the mic and speak. Ask for anything. AIC tells you when it is done.",
  },
  {
    title: "See the City",
    text: "The City shows your helpers at work. Tap anyone to see what they are doing.",
  },
  {
    title: "Watch the money",
    text: "The pill at the top shows what today cost so far. Tap it to see more.",
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
