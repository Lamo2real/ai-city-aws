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

/** The departments a document being added seems to be for (decision 270), from its names and the start of its
 * text: marked "Recommended", never ticked. Empty when it can't be worked out. */
export function recommendFor(text: string): Promise<{ key: string; why: string }[]> {
  if (!text.trim()) return Promise.resolve([]);
  return api<{ recommended: { key: string; why: string }[] }>("/departments/recommend", {
    method: "POST",
    body: { text: text.slice(0, 20_000) },
  }).then(
    (r) => r.recommended,
    () => [],
  );
}

const TEXTY = /\.(md|markdown|txt|csv|json|ya?ml|html?)$/i;
/** File names (as words) and the first few thousand characters of small text files: read in a moment. */
export async function describeFiles(files: File[]): Promise<string> {
  const names = files.map((f) => f.name.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " "));
  const heads = await Promise.all(
    files
      .filter((f) => (f.type.startsWith("text/") || TEXTY.test(f.name)) && f.size <= 5_000_000)
      .slice(0, 10)
      .map((f) =>
        f
          .slice(0, 4000)
          .text()
          .catch(() => ""),
      ),
  );
  return [...names, ...heads].join("\n");
}

/** The badge for who can use a document (decision 270): one department by name, more as "3 departments" with the
 * number in digits; none listed is every department, counted ("13 departments"). */
export function countWords(choices: DeptChoice[], keys: string[] | undefined): string {
  const n = keys?.length ? keys.length : choices.length;
  if (keys?.length === 1) return choices.find((c) => c.key === keys[0])?.name ?? keys[0]!;
  return n ? `${n} departments` : "every department";
}

/** Every department name a document is for, in the departments' order ("Finance, Legal and Sales"). */
export function allNames(choices: DeptChoice[], keys: string[] | undefined): string {
  const names = keys?.length
    ? choices.filter((c) => keys.includes(c.key)).map((c) => c.name)
    : choices.map((c) => c.name);
  if (!names.length) return keys?.length ? keys.join(", ") : "every department";
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What the big Add button says (decision 280): exactly what will happen, "Add 3 files for Marketing and Media" or
 * "Add 1 file for every department"; nothing picked (or all) is every department. */
export function addLabel(what: { files: number } | { link: boolean }, p: DeptPicker): string {
  const thing =
    "files" in what ? (what.files === 1 ? "1 file" : `${what.files} files`) : what.link ? "the link" : "the text";
  const who = !p.selected.length || isAll(p) ? "every department" : namesOf(p);
  return `Add ${thing} for ${who}`;
}

/** A friendly picture per department for the big chips (decision 280); an owner-built one gets a building. */
export const DEPT_ICON: Record<string, string> = {
  application: "💻",
  infrastructure: "🖥️",
  data: "📊",
  marketing: "📣",
  sales: "🤝",
  support: "🎧",
  finance: "💰",
  legal: "⚖️",
  product: "🧩",
  operations: "⚙️",
  research: "🔬",
  media: "🎬",
};
export const deptIcon = (key: string) => DEPT_ICON[key] ?? "🏢";

/** A long file name shortened in the middle, keeping its end and extension: "phed-make-real…10-31.md". */
export function shortName(name: string, max = 28): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  const keep = max - ext.length - 1;
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  const base = name.slice(0, name.length - ext.length);
  return `${base.slice(0, head)}…${base.slice(base.length - tail)}${ext}`;
}

/** A big picture for a file by its name or type. */
export function fileIcon(f: { name: string; type?: string }): string {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  const t = f.type ?? "";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(ext)) return "🖼️";
  if (t.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "flac"].includes(ext)) return "🎵";
  if (t.startsWith("video/") || ["mp4", "mov", "webm", "mkv"].includes(ext)) return "🎬";
  if (["csv", "xls", "xlsx", "numbers"].includes(ext)) return "📊";
  if (["ppt", "pptx", "key"].includes(ext)) return "📽️";
  if (["md", "txt", "markdown", "rtf"].includes(ext)) return "📝";
  if (["zip", "gz", "tar", "7z"].includes(ext)) return "📦";
  return "📄";
}
