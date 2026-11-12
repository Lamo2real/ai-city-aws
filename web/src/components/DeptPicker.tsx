// The department chips (decision 266): every department as a toggle, VAIC's recommended ones marked with a few words
// why, and "All departments" / "Clear". Used on VAIC's skill and knowledge cards, the skill side panel and the
// Knowledge page. The owner can also say it in words ("all except Sales and Legal"); the chips follow.
import { useEffect, useId, useState } from "react";
import {
  allNames,
  countWords,
  deptIcon,
  forWhom,
  isAll,
  loadDeptChoices,
  toggle,
  type DeptChoice,
  type DeptPicker as Picker,
} from "../lib/deptPick.ts";
import { Button } from "./ui.tsx";

export function DeptPicker({
  p,
  onChange,
  label = "Which departments?",
  disabled,
  noneText = "Pick at least one department.",
  big = false,
}: {
  p: Picker;
  onChange: (keys: string[]) => void;
  label?: string;
  disabled?: boolean;
  /** What the picker says while nothing is ticked. */
  noneText?: string;
  /** Big friendly chips with a picture per department (the Knowledge upload, decision 280). */
  big?: boolean;
}) {
  const id = useId();
  const rec = new Map(p.recommended.map((r) => [r.key, r.why]));
  const why = p.recommended.filter((r) => r.why);
  const names = new Map(p.choices.map((c) => [c.key, c.name]));
  return (
    <div className={`dept-pick${big ? " is-big" : ""}`} role="group" aria-labelledby={`${id}-l`}>
      <div className="dept-pick-head">
        <p id={`${id}-l`} className="dept-pick-label">
          {label}
        </p>
        <div className="dept-pick-quick">
          <button
            type="button"
            className="link-btn"
            disabled={disabled || isAll(p)}
            onClick={() => onChange(p.choices.map((c) => c.key))}
          >
            All departments
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={disabled || !p.selected.length}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="dept-chips">
        {p.choices.map((c) => {
          const on = p.selected.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              className={`dept-chip${on ? " is-on" : ""}${rec.has(c.key) ? " is-rec" : ""}`}
              aria-pressed={on}
              disabled={disabled}
              title={rec.get(c.key) ? `Recommended: ${rec.get(c.key)}` : undefined}
              onClick={() => onChange(toggle(p, c.key))}
            >
              {big ? (
                <span aria-hidden="true" className="dept-icon">
                  {deptIcon(c.key)}
                </span>
              ) : null}
              <span aria-hidden="true" className="dept-tick">
                {on ? "✓" : "+"}
              </span>
              {c.name}
              {rec.has(c.key) ? <span className="dept-rec">Recommended</span> : null}
            </button>
          );
        })}
      </div>
      {why.length ? (
        <p className="dept-why mute">
          Recommended:{" "}
          {why.map((r, i) => (
            <span key={r.key}>
              {i ? "; " : ""}
              <b>{names.get(r.key)}</b> ({r.why})
            </span>
          ))}
          .
        </p>
      ) : null}
      {!p.selected.length ? (
        <p className="dept-none" role="status">
          {noneText}
        </p>
      ) : null}
    </div>
  );
}

/** "For Finance and Data & AI" (or "For every department") with Change, which opens the chips and Save (the Knowledge
 * and Skills pages). ``onSave`` gets the keys and whether every department is picked; it throws to stay open. */
export function DeptLine(p: {
  what: string;
  keys: string[] | undefined;
  onSave: (keys: string[], every: boolean) => Promise<void>;
  /** "For 3 departments" with "Show which" listing the names (the Knowledge page, decision 270). */
  count?: boolean;
}) {
  const [choices, setChoices] = useState<DeptChoice[]>([]);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [showing, setShowing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let on = true;
    void loadDeptChoices().then((c) => on && setChoices(c));
    return () => {
      on = false;
    };
  }, []);
  const save = async () => {
    if (!picking) return;
    setSaving(true);
    try {
      await p.onSave(picking, picking.length === choices.length);
      setPicking(null);
    } catch {
      // the page shows why; the chips stay open
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="kwho">
      <p className="kplace">
        <span>
          For <b>{p.count ? countWords(choices, p.keys) : forWhom(choices, p.keys)}</b>
        </span>
        {p.count && p.keys?.length !== 1 && choices.length && !picking ? (
          <Button
            variant="quiet"
            onClick={() => setShowing(!showing)}
            label={showing ? `Hide which departments use “${p.what}”` : `Show which departments use “${p.what}”`}
          >
            {showing ? "Hide" : "Show which"}
          </Button>
        ) : null}
        {choices.length && !picking ? (
          <Button
            variant="quiet"
            onClick={() => setPicking(p.keys?.length ? p.keys : choices.map((c) => c.key))}
            label={`Change which departments use “${p.what}”`}
          >
            Change
          </Button>
        ) : null}
      </p>
      {p.count && showing && !picking ? <p className="mute">{`Used by ${allNames(choices, p.keys)}.`}</p> : null}
      {picking ? (
        <div className="kwho-edit">
          <DeptPicker
            p={{ choices, recommended: [], selected: picking }}
            label={`Which departments use “${p.what}”?`}
            onChange={setPicking}
            disabled={saving}
          />
          <div className="row-end">
            <Button variant="quiet" onClick={() => setPicking(null)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void save()} disabled={saving || !picking.length}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
