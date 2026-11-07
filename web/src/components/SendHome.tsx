// "Send everyone home": one tap, one confirm, and every worker drops what it is doing and walks home. It calls
// the API straight (no model in the loop), so it is instant; the City walks them out as the events arrive.
import { useState } from "react";
import type { CityState } from "../city/city-state.js";
import { sendEveryoneHome } from "../lib/actions.ts";
import { sendHomeQuestion, sentHomeLine, workersAtWork } from "../lib/workers.ts";
import { Button, Confirm, toast } from "./ui.tsx";

export function SendHomeButton({ city, className = "" }: { city: CityState; className?: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = workersAtWork(city);
  const nobody = n === 0;
  return (
    <span className={`send-home ${className}`.trim()} title={nobody ? "Nobody is at work" : undefined}>
      <Button
        variant="danger"
        onClick={() => setAsking(true)}
        disabled={nobody || busy}
        label={nobody ? "Send everyone home (nobody is at work)" : "Send everyone home"}
      >
        Send everyone home
      </Button>
      {asking ? (
        <Confirm
          title="Send everyone home?"
          what={sendHomeQuestion(n)}
          cost="Their unfinished parts wait for a new worker. The city keeps running."
          confirmLabel="Send everyone home"
          danger
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            setBusy(true);
            try {
              toast({ text: sentHomeLine(await sendEveryoneHome()), tone: "good" });
            } catch (e) {
              toast({ text: e instanceof Error ? e.message : "That did not work. Try again.", tone: "bad" });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </span>
  );
}
