// A four-step guide on first login: meet AIC, see the City, where the money is, connect the tools. Skippable, and it
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
    title: "Costs stay out of the way",
    text: "Chat and the City never show prices. The Costs tab has all of it when you want a look.",
  },
  {
    title: "Connect your tools",
    text: "Settings → Departments & tools has a setup guide: add your brand to Knowledge, then switch on each department's essential tools (Stripe, Canva, GitHub …) and sign in once. No account yet? Each tool has a Create an account link.",
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
