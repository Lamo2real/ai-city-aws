// Which departments a skill or a knowledge document is for (decision 266). VAIC sends every department, the ones it
// recommends (with a few words why) and the picked ones; the owner taps chips, "All departments" or "Clear", then
// Add. Add is sent as the owner's own words ("Add for Finance and Data & AI"), so typing or saying it works the same.
// Pure functions (tested); the chips are components/DeptPicker.tsx.
import { api } from "./api.ts";

export interface DeptChoice {
  key: string;
  name: string;
}
export interface DeptPicker {
  choices: DeptChoice[];
  recommended: { key: string; why: string }[];
  selected: string[];
}

/** The picker of a `vaic.question`, or undefined when it has none (or it can't be read). */
export function readPicker(v: unknown): DeptPicker | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.choices)) return undefined;
  const choices = o.choices
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ key: String(c.key ?? ""), name: String(c.name ?? c.key ?? "") }))
    .filter((c) => c.key);
  if (!choices.length) return undefined;
  const known = new Set(choices.map((c) => c.key));
  const recommended = (Array.isArray(o.recommended) ? o.recommended : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ key: String(r.key ?? ""), why: String(r.why ?? "") }))
    .filter((r) => known.has(r.key));
  const selected = (Array.isArray(o.selected) ? o.selected.map(String) : []).filter((k) => known.has(k));
  return { choices, recommended, selected };
}

/** The selection in the departments' own order. */
export const ordered = (choices: DeptChoice[], keys: Iterable<string>): string[] => {
  const s = new Set(keys);
  return choices.filter((c) => s.has(c.key)).map((c) => c.key);
};

export const toggle = (p: DeptPicker, key: string): string[] =>
  ordered(p.choices, p.selected.includes(key) ? p.selected.filter((k) => k !== key) : [...p.selected, key]);

export const isAll = (p: DeptPicker) => p.choices.every((c) => p.selected.includes(c.key));

/** "Finance", "Finance and Data & AI", "Application, Finance and Sales", "every department". */
export function namesOf(p: DeptPicker, keys = p.selected): string {
  if (keys.length && p.choices.every((c) => keys.includes(c.key))) return "every department";
  const names = p.choices.filter((c) => keys.includes(c.key)).map((c) => c.name);
  if (!names.length) return "no department";
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What the Add button says for the owner: the backend reads the departments from these words. */
export const addWords = (option: string, p: DeptPicker): string =>
  isAll(p) ? `${option} for all departments` : `${option} for ${namesOf(p)}`;

let choicesOnce: Promise<DeptChoice[]> | null = null;
/** Every department the chips list (GET /departments/choices), read once per page; empty when it can't be read. */
export function loadDeptChoices(fresh = false): Promise<DeptChoice[]> {
  if (fresh) choicesOnce = null;
  choicesOnce ??= api<{ departments: DeptChoice[] }>("/departments/choices").then(
    (r) => r.departments,
    () => {
      choicesOnce = null;
      return [];
    },
  );
  return choicesOnce;
}

/** "Every department" for an item or skill with no departments, else their names. */
export function forWhom(choices: DeptChoice[], keys: string[] | undefined): string {
  if (!keys?.length) return "every department";
  return namesOf({ choices, recommended: [], selected: keys }, keys);
}
