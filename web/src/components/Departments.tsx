// Departments on demand (decision 134): build a new department next to the twelve preset ones, or demolish one.
// The same two controls appear in the City (the side list and a tower's panel) and in Settings → Departments &
// tools; asking VAIC ("make a Customer Success department") does exactly the same.
import { useState, type FormEvent } from "react";
import { standingDepartments, type CityState } from "../city/city-state.js";
import { api, ApiError } from "../lib/api.ts";
import { useHud } from "../lib/store.ts";
import { Button, toast } from "./ui.tsx";

type Built = { department: { name: string; worker_model?: string }; outcome: "created" | "rebuilt" };
type Demolished = { name: string; workers: number; parts: number };

export const buildDepartment = (body: { name: string; mission?: string }) =>
  api<Built>("/departments", { method: "POST", body });
export const demolishDepartment = (name: string) =>
  api<Demolished>(`/departments/${encodeURIComponent(departmentKey(name))}`, {
    method: "DELETE",
    body: { confirm: true },
  });
/** The ledger's key for a department name (backend `department_key`). */
export const departmentKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";

/** The one model map (decision 300), read-only: no per-department model choice. */
export const MODEL_MAP_LINE = "Its workers run on Sonnet 5.5 and its reviewer on Opus 5.5 (Fable 5.1 on extreme jobs).";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Name and what it does; its models follow the one map (decision 300), shown as a plain line. */
export function BuildDepartment({ onDone, compact = false }: { onDone?: (name: string) => void; compact?: boolean }) {
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError("Give it a name, like “Customer Success”.");
    setBusy(true);
    setError(null);
    try {
      const r = await buildDepartment({
        name: name.trim(),
        ...(mission.trim() ? { mission: mission.trim() } : {}),
      });
      toast({
        text: `${r.department.name} is going up in the City. ${MODEL_MAP_LINE}`,
        tone: "good",
      });
      setName("");
      setMission("");
      onDone?.(r.department.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't build it right now. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="instruct builddept" onSubmit={submit} aria-label="Build a department">
      <label className="field">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer Success"
          maxLength={40}
          autoComplete="off"
        />
      </label>
      <label className="field">
        {compact ? "What it does (optional)" : "What it does (optional; VAIC fills it in if you leave it empty)"}
        <input
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Keeps customers happy and renewing"
          maxLength={400}
        />
      </label>
      <p className="mute">{MODEL_MAP_LINE} It stands empty until work arrives.</p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="primary" type="submit" disabled={busy}>
        {busy ? "Building…" : "Build it"}
      </Button>
    </form>
  );
}

/** "Demolish" with one inline question that says exactly what happens, then Yes / Keep it. */
export function DemolishDepartment({ name, city, onDone }: { name: string; city: CityState; onDone?: () => void }) {
  const [ask, setAsk] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const workers = Object.values(city.agents).filter(
    (a) => a.department === name && a.kind === "worker" && a.state !== "retired" && a.worker_state !== "released",
  ).length;
  const parts = Object.values(city.tickets).filter((t) => t.department === name).length;
  const go = async () => {
    try {
      const r = await demolishDepartment(name);
      toast({
        text:
          r.workers || r.parts
            ? `${r.name} was demolished. ${plural(r.workers, "worker")} went home, ${plural(r.parts, "unfinished part")} went to the department that took over, or were dropped.`
            : `${r.name} was demolished. Nobody was working there.`,
        tone: "good",
      });
      setAsk(false);
      onDone?.();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Couldn't demolish it right now. Try again.");
    }
  };
  return (
    <div className="sendhome demolish">
      {ask ? (
        <>
          <p>
            {`Demolish ${name}? `}
            {workers || parts
              ? `${plural(workers, "worker")} go home and ${plural(parts, "unfinished part")} go to the department that takes over, or are dropped. `
              : "Nobody is working there. "}
            Its history stays, and you can build it again later.
          </p>
          <div className="actions">
            <Button variant="danger" onClick={go}>
              Yes, demolish
            </Button>
            <Button variant="quiet" onClick={() => setAsk(false)}>
              Keep it
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setAsk(true)}>
          Demolish this department
        </Button>
      )}
      {note ? <p className="field-error">{note}</p> : null}
    </div>
  );
}

/** Settings → Departments & tools: the standing departments, each with Demolish, and Build a department. */
export function YourDepartments() {
  const city = useHud((s) => s.city);
  const names = standingDepartments(city);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="presets yourdepts" aria-labelledby="yourdepts-title">
      <h2 id="yourdepts-title">Build or demolish a department</h2>
      <p className="mute">
        Next to the twelve ready-made departments you can build your own, or ask VAIC: “make a Customer Success
        department”. Demolishing one sends its workers home and hands its unfinished work to the department that takes over.
      </p>
      <BuildDepartment />
      {names.length ? (
        <ul className="recent">
          {names.map((n) => (
            <li key={n}>
              <button
                type="button"
                className="link"
                onClick={() => setOpen(open === n ? null : n)}
                aria-expanded={open === n}
              >
                {n}
              </button>
              {open === n ? <DemolishDepartment name={n} city={city} onDone={() => setOpen(null)} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
