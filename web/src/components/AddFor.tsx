// Adding to Knowledge as a numbered flow (decisions 270 and 280): ① the files sit as tiles inside the drop zone
// (remove one with ✕, keep adding with "+ Add more"); ② right under it, which departments can use them, as big
// chips with a picture each, the recommended ones highlighted with one-tap "Use recommended" and nothing ticked
// (none means every department, said in plain words); ③ one big button that says exactly what will happen ("Add 3
// files for Marketing and Media"). Pasted links and text use ② and ③ under the paste box.
import { useEffect, useState } from "react";
import {
  addLabel,
  describeFiles,
  fileIcon,
  isAll,
  loadDeptChoices,
  namesOf,
  recommendFor,
  shortName,
  type DeptPicker as Picker,
} from "../lib/deptPick.ts";
import { sizeWords } from "../lib/files.ts";
import { isLink, titleFrom } from "../lib/knowledge.ts";
import { DeptPicker } from "./DeptPicker.tsx";
import { Button } from "./ui.tsx";

export type Adding = { files: File[] } | { text: string };

/** ① The files waiting in the drop zone, each a tile with ✕, then "+ Add more" (its own file chooser). */
export function FileTray(p: { files: File[]; onRemove: (i: number) => void; onMore: (files: File[]) => void }) {
  return (
    <ul className="ktray" aria-label="Files to add">
      {p.files.map((f, i) => (
        <li key={`${f.name}-${f.size}-${i}`} className="ktile">
          <span className="ktile-icon" aria-hidden="true">
            {fileIcon(f)}
          </span>
          <span className="ktile-name" title={f.name}>
            {shortName(f.name)}
          </span>
          <span className="ktile-size">{sizeWords(f.size)}</span>
          <button type="button" className="ktile-x" aria-label={`Remove ${f.name}`} onClick={() => p.onRemove(i)}>
            ✕
          </button>
        </li>
      ))}
      <li>
        <label className="ktile ktile-more">
          <span className="ktile-icon" aria-hidden="true">
            +
          </span>
          <span className="ktile-name">Add more</span>
          <input
            className="sr-only"
            type="file"
            multiple
            onChange={(e) => {
              const more = [...(e.target.files ?? [])];
              e.target.value = "";
              p.onMore(more);
            }}
          />
        </label>
      </li>
    </ul>
  );
}

/** ② Who can use it and ③ Add. */
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

  const files = "files" in p.adding ? p.adding.files.length : 0;
  const picked = picker.selected;
  const every = !picked.length || (picker.choices.length > 0 && isAll(picker));
  const rec = picker.recommended.map((r) => r.key);
  const sameAsRec = rec.length === picked.length && rec.every((k) => picked.includes(k));
  const them = files > 1 ? "them" : "it";
  const what = "text" in p.adding ? { link: isLink(p.adding.text) } : { files };
  return (
    <section className="kitem kadd" aria-label="Who can use it">
      {"text" in p.adding ? (
        <p className="kadd-what">
          Adding{" "}
          <b>{isLink(p.adding.text) ? `the link ${p.adding.text.trim()}` : `the text “${titleFrom(p.adding.text)}”`}</b>
        </p>
      ) : null}
      <p className="kstep">
        <span className="kstep-n" aria-hidden="true">
          2
        </span>
        {`Pick who can use ${them}`}
      </p>
      {picker.choices.length ? (
        <DeptPicker
          big
          p={picker}
          label={`Which departments can use ${them}?`}
          noneText={`None picked: every department can use ${them}.`}
          onChange={(selected) => setPicker((x) => ({ ...x, selected }))}
        />
      ) : null}
      {rec.length && !sameAsRec ? (
        <div>
          <Button
            variant="secondary"
            className="kadd-rec"
            onClick={() =>
              setPicker((x) => ({ ...x, selected: x.choices.filter((c) => rec.includes(c.key)).map((c) => c.key) }))
            }
          >
            Use recommended
          </Button>
        </div>
      ) : null}
      {!every ? (
        <p className="mute" role="status">
          {`Only ${namesOf(picker)} can use ${them}. VAIC and the planner always can.`}
        </p>
      ) : null}
      <p className="kstep">
        <span className="kstep-n" aria-hidden="true">
          3
        </span>
        Add
      </p>
      <div className="row-end kadd-go">
        <Button variant="quiet" onClick={p.onCancel}>
          {files ? "Remove all" : "Cancel"}
        </Button>
        <Button variant="primary" className="kadd-btn" onClick={() => p.onAdd(every ? "all" : picked)}>
          {addLabel(what, picker)}
        </Button>
      </div>
    </section>
  );
}
