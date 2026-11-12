// The answers on VAIC's question cards and the skill panel (decision 266): the department chips, and the buttons.
// With departments, Add says them in words ("Add for Finance and Data & AI"), so the city reads exactly what is on
// the card, and typing or saying it works the same.
import { sendMessage } from "../lib/actions.ts";
import { useState } from "react";
import { addWords, namesOf } from "../lib/deptPick.ts";
import { store, type ConnectCardState } from "../lib/store.ts";
import { DeptPicker } from "./DeptPicker.tsx";

type AskProps = Extract<ConnectCardState, { kind: "ask" }>;

/** The department chips on a card or the skill panel; a tap changes the card's pick (nothing is sent yet). On the
 * skill panel (`compact`) it is one line, "For Application and Data & AI · Change", so the skill itself keeps the
 * room; Change opens the same chips. */
export function AskDepartments({ d, compact }: { d: AskProps; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!d.departments) return null;
  const picker = (
    <DeptPicker
      p={d.departments}
      label={d.knowledge ? "For these departments" : "Which departments get this skill?"}
      onChange={(keys) => d.changeId && store.pickDepartments(d.changeId, keys)}
    />
  );
  if (!compact) return picker;
  return (
    <div className="dept-compact">
      <p className="dept-line">
        <span>
          For <b>{namesOf(d.departments)}</b>
        </span>
        <button type="button" className="dept-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Done" : "Change"}
        </button>
      </p>
      {open ? picker : null}
    </div>
  );
}

/** The answers. With departments, the first (Add) says them in words ("Add for Finance and Data & AI"), so the
 * city reads exactly what is on the card; it waits until at least one is picked. */
export function AskChoices({ d, big }: { d: AskProps; big?: boolean }) {
  return (
    <div className="choices">
      {d.options.map((o, i) => {
        const add = i === 0 && !!d.departments;
        return (
          <button
            key={o}
            type="button"
            className={`choice choice-big${i === 0 && d.changeId ? " choice-yes" : ""}${big ? " choice-wide" : ""}`}
            disabled={add && !d.departments?.selected.length}
            onClick={() => void sendMessage(add && d.departments ? addWords(o, d.departments) : o, { answer: o })}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
