// Which departments can use what the owner is adding to Knowledge (decision 270), asked before anything is stored.
// Nothing is ticked: the departments it seems to be for are marked "Recommended" (one tap: "Use recommended").
// Adding with none ticked stores it for every department, and the picker says so plainly; ticking some limits it to
// exactly those from the start. Several files dropped together share one choice.
import { useEffect, useState } from "react";
import {
  describeFiles,
  isAll,
  loadDeptChoices,
  namesOf,
  recommendFor,
  type DeptPicker as Picker,
} from "../lib/deptPick.ts";
import { isLink, titleFrom } from "../lib/knowledge.ts";
import { DeptPicker } from "./DeptPicker.tsx";
import { Button } from "./ui.tsx";

export type Adding = { files: File[] } | { text: string };

function whatWords(a: Adding): string {
  if ("text" in a) return isLink(a.text) ? `the link ${a.text.trim()}` : `the text “${titleFrom(a.text)}”`;
  const n = a.files.length;
  if (n === 1) return `“${a.files[0]!.name}”`;
  const shown = a.files.slice(0, 3).map((f) => `“${f.name}”`);
  return `${n} files: ${shown.join(", ")}${n > 3 ? ` and ${n - 3} more` : ""}`;
}

export function AddFor(p: { adding: Adding; onAdd: (departments: string[] | "all") => void; onCancel: () => void }) {
  const [picker, setPicker] = useState<Picker>({ choices: [], recommended: [], selected: [] });
  useEffect(() => {
    let on = true;
    void loadDeptChoices().then((choices) => on && setPicker((x) => ({ ...x, choices })));
    const text = "text" in p.adding ? Promise.resolve(p.adding.text) : describeFiles(p.adding.files);
    void text.then(recommendFor).then((recommended) => on && setPicker((x) => ({ ...x, recommended })));
    return () => {
      on = false;
    };
  }, [p.adding]);

  const picked = picker.selected;
  const every = !picked.length || (picker.choices.length > 0 && isAll(picker));
  const rec = picker.recommended.map((r) => r.key);
  const sameAsRec = rec.length === picked.length && rec.every((k) => picked.includes(k));
  return (
    <section className="kitem kadd" aria-label="Who can use it">
      <p className="kadd-what">
        Adding <b>{whatWords(p.adding)}</b>
      </p>
      {picker.choices.length ? (
        <DeptPicker
          p={picker}
          label="Which departments can use it?"
          noneText="No departments chosen: every department can use it."
          onChange={(selected) => setPicker((x) => ({ ...x, selected }))}
        />
      ) : null}
      {rec.length && !sameAsRec ? (
        <div>
          <Button
            variant="quiet"
            onClick={() =>
              setPicker((x) => ({ ...x, selected: x.choices.filter((c) => rec.includes(c.key)).map((c) => c.key) }))
            }
          >
            Use recommended
          </Button>
        </div>
      ) : null}
      {!every ? (
        <p className="mute" role="status">{`Only ${namesOf(picker)} can use it. VAIC and the Orchestrator always can.`}</p>
      ) : null}
      <div className="row-end">
        <Button variant="quiet" onClick={p.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => p.onAdd(every ? "all" : picked)}>
          {every ? "Add for every department" : `Add for ${namesOf(picker)}`}
        </Button>
      </div>
    </section>
  );
}
