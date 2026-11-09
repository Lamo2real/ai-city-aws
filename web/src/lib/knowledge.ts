// The Knowledge screen's state: the owner's stored items, upload progress, and deletes waiting out
// their Undo time. A pure reducer (tested) behind a tiny store; the WebSocket's "knowledge.updated"
// events and the API write to it.
import { useSyncExternalStore } from "react";
import {
  ApiError,
  knowledgeApi,
  type KnowledgeItem,
  type KnowledgeKind,
  type KnowledgePlace,
  type KnowledgeStatus,
  type Scope,
} from "./api.ts";
import { MAX_UPLOAD_BYTES, uploadFile, UploadError, type UploadOptions } from "./upload.ts";
import { UNDO_MS } from "../components/ui.tsx";
import { placeName, topicWord } from "./places.ts";

export interface KnowledgeState {
  items: KnowledgeItem[];
  loaded: boolean;
  loadError: string | null;
  alwaysTokens: number;
  alwaysBudget: number;
  /** Upload percent per item id, while this browser is sending the file. */
  progress: Record<string, number>;
  /** Errors seen only here (an upload that stopped), per item id. */
  localError: Record<string, string>;
  /** Items deleted by the owner and waiting out the Undo time. */
  hidden: string[];
}

export type KnowledgeAction =
  | { type: "loaded"; items: KnowledgeItem[]; always_tokens: number; always_budget: number }
  | { type: "load_failed"; error: string }
  | { type: "upsert"; item: KnowledgeItem }
  | {
      type: "knowledge.updated";
      id: string;
      status: KnowledgeStatus;
      title: string;
      scope: Scope;
      kind: KnowledgeKind;
      error?: string | null;
    }
  | { type: "progress"; id: string; percent: number }
  | { type: "upload_failed"; id: string; error: string }
  | { type: "hide"; id: string }
  | { type: "unhide"; id: string }
  | { type: "removed"; id: string };

export const initialKnowledge = (): KnowledgeState => ({
  items: [],
  loaded: false,
  loadError: null,
  alwaysTokens: 0,
  alwaysBudget: 8000,
  progress: {},
  localError: {},
  hidden: [],
});

const without = <T>(r: Record<string, T>, id: string) => {
  if (!(id in r)) return r;
  const next = { ...r };
  delete next[id];
  return next;
};

function merge(s: KnowledgeState, item: KnowledgeItem): KnowledgeState {
  const i = s.items.findIndex((x) => x.id === item.id);
  const items = i < 0 ? [item, ...s.items] : s.items.map((x, j) => (j === i ? { ...x, ...item } : x));
  const leftUpload = item.status !== "uploading";
  return {
    ...s,
    items,
    progress: leftUpload ? without(s.progress, item.id) : s.progress,
    localError: leftUpload ? without(s.localError, item.id) : s.localError,
  };
}

export function reduceKnowledge(s: KnowledgeState, a: KnowledgeAction): KnowledgeState {
  switch (a.type) {
    case "loaded": {
      const ids = new Set(a.items.map((x) => x.id));
      const keep = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => ids.has(k)));
      // Items this browser created after the list was read stay on top until the server lists them.
      const mine = s.items.filter((x) => !ids.has(x.id) && x.id in s.progress);
      return {
        ...s,
        items: [...mine, ...a.items],
        loaded: true,
        loadError: null,
        alwaysTokens: a.always_tokens,
        alwaysBudget: a.always_budget,
        progress: { ...keep(s.progress), ...Object.fromEntries(mine.map((x) => [x.id, s.progress[x.id]!])) },
        localError: keep(s.localError),
      };
    }
    case "load_failed":
      return { ...s, loadError: a.error };
    case "upsert":
      return merge(s, a.item);
    case "knowledge.updated": {
      const { type: _t, ...rest } = a;
      const item: KnowledgeItem = { ...rest, error: a.status === "failed" ? (a.error ?? null) : null };
      return merge(s, item);
    }
    case "progress":
      return { ...s, progress: { ...s.progress, [a.id]: a.percent } };
    case "upload_failed":
      return { ...s, progress: without(s.progress, a.id), localError: { ...s.localError, [a.id]: a.error } };
    case "hide":
      return s.hidden.includes(a.id) ? s : { ...s, hidden: [...s.hidden, a.id] };
    case "unhide":
      return { ...s, hidden: s.hidden.filter((x) => x !== a.id) };
    case "removed":
      return {
        ...s,
        items: s.items.filter((x) => x.id !== a.id),
        hidden: s.hidden.filter((x) => x !== a.id),
        progress: without(s.progress, a.id),
        localError: without(s.localError, a.id),
      };
  }
}

// ---------- the store ----------
type Listener = () => void;
class KnowledgeStore {
  state = initialKnowledge();
  private listeners = new Set<Listener>();
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  dispatch(a: KnowledgeAction) {
    this.state = reduceKnowledge(this.state, a);
    for (const l of this.listeners) l();
  }
  /** WebSocket events; only "knowledge.updated" is ours. */
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type !== "knowledge.updated" || typeof e.id !== "string") return;
    const before = this.state.items.find((x) => x.id === e.id);
    this.dispatch(e as unknown as KnowledgeAction);
    // The always-include budget is counted by the server: read it again when it may have changed. A finished item
    // has its place, year and topic now (§15), and may replace an older one: read the list again too.
    const finished = e.status === "ready" && before?.status !== "ready";
    if (this.state.loaded && (finished || e.scope === "always" || before?.scope === "always")) refreshSoon();
  }
}
export const knowledge = new KnowledgeStore();
export const useKnowledge = <T>(pick: (s: KnowledgeState) => T): T =>
  useSyncExternalStore(knowledge.subscribe, () => pick(knowledge.get()));

const words = (e: unknown) =>
  e instanceof ApiError ? `${e.message}${e.fix ? ` ${e.fix}` : ""}` : "That did not go through. Nothing changed.";

// ---------- actions ----------
export async function loadKnowledge() {
  try {
    const r = await knowledgeApi.list();
    knowledge.dispatch({ type: "loaded", ...r });
  } catch (e) {
    knowledge.dispatch({ type: "load_failed", error: words(e) });
  }
}
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void loadKnowledge(), 1000);
}

/** Uploads every file; resolves with plain sentences for the ones that could not start or finish. */
export async function addFiles(
  files: File[],
  o: Pick<UploadOptions, "put" | "retryDelayMs" | "onCreated"> = {},
): Promise<string[]> {
  const problems: string[] = [];
  await Promise.all(
    files.map(async (f) => {
      if (f.size > MAX_UPLOAD_BYTES) {
        problems.push(`“${f.name}” is larger than 5 GB, the most the knowledge base takes.`);
        return;
      }
      let id = "";
      try {
        const done = await uploadFile(f, {
          ...o,
          onCreated: (item) => {
            id = item.id;
            knowledge.dispatch({ type: "upsert", item });
            knowledge.dispatch({ type: "progress", id, percent: 0 });
            o.onCreated?.(item);
          },
          onProgress: (percent) => knowledge.dispatch({ type: "progress", id, percent }),
        });
        // The file is in the bucket, so the pipeline has started. A live event may already be further.
        const now = knowledge.get().items.find((x) => x.id === done.id);
        const status =
          now && now.status !== "uploading" ? now.status : done.status === "uploading" ? "processing" : done.status;
        knowledge.dispatch({ type: "upsert", item: { ...(now ?? done), status } });
      } catch (e) {
        if (e instanceof UploadError && e.item)
          knowledge.dispatch({ type: "upload_failed", id: e.item.id, error: e.message });
        else problems.push(`“${f.name}” could not be added: ${words(e)}`);
      }
    }),
  );
  return problems;
}

export const isLink = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());
/** The first line of pasted text, as its title. */
export const titleFrom = (text: string) => {
  const line = text.trim().split("\n")[0]!.trim();
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
};

/** A link or a piece of text from the paste field. */
export async function addPasted(value: string) {
  const v = value.trim();
  if (!v) return;
  if (v.length > 200_000)
    throw new ApiError(
      "That text is longer than 200,000 characters.",
      400,
      "Split it into parts or save it as a file and drop the file.",
    );
  const { item } = isLink(v) ? await knowledgeApi.addLink(v) : await knowledgeApi.addText(v, titleFrom(v));
  knowledge.dispatch({ type: "upsert", item });
}

export async function setScope(id: string, scope: Scope) {
  const before = knowledge.get().items.find((x) => x.id === id);
  if (!before || before.scope === scope) return;
  knowledge.dispatch({ type: "upsert", item: { ...before, scope } });
  try {
    const { item } = await knowledgeApi.update(id, { scope });
    knowledge.dispatch({ type: "upsert", item });
    if (scope === "always" || before.scope === "always") refreshSoon();
  } catch (e) {
    knowledge.dispatch({ type: "upsert", item: before });
    throw new Error(`The choice was not saved: ${words(e)}`, { cause: e });
  }
}

/**
 * Hides the item at once and calls DELETE only after the Undo time. Returns the Undo function.
 * Kept outside the screen so leaving the screen does not cancel (or lose) the delete.
 */
export function scheduleDelete(id: string, onError: (message: string) => void, ms = UNDO_MS) {
  knowledge.dispatch({ type: "hide", id });
  const t = setTimeout(() => {
    knowledgeApi.remove(id).then(
      () => knowledge.dispatch({ type: "removed", id }),
      (e: unknown) => {
        knowledge.dispatch({ type: "unhide", id });
        onError(`It was not deleted: ${words(e)}`);
      },
    );
  }, ms);
  return () => {
    clearTimeout(t);
    knowledge.dispatch({ type: "unhide", id });
  };
}

/** Saves where and when an item holds (docs/KNOWLEDGE.md §15); the server re-ingests it with the new filters. */
export async function setPlace(id: string, patch: KnowledgePlace) {
  const before = knowledge.get().items.find((x) => x.id === id);
  if (!before) return;
  try {
    const { item } = await knowledgeApi.update(id, patch);
    knowledge.dispatch({ type: "upsert", item });
    refreshSoon(); // which items a newer year replaces is worked out by the server
  } catch (e) {
    throw new Error(`Not saved: ${words(e)}`, { cause: e });
  }
}

// ---------- grouping by place, year and topic (§15) ----------
export interface KnowledgeFilters {
  place: string;
  year: string;
  topic: string;
}
export const NO_FILTERS: KnowledgeFilters = { place: "", year: "", topic: "" };
export interface KnowledgeGroup {
  key: string;
  label: string;
  items: KnowledgeItem[];
}

const placed = (i: KnowledgeItem) => Boolean(i.jurisdictions?.length || i.topic || i.year);
export const placeLabel = (i: KnowledgeItem) => (i.jurisdictions ?? []).map(placeName).join(", ");

/** "Sweden · 2026 · Tax"; parts that are unknown are left out. */
export function groupLabel(i: KnowledgeItem): string {
  const parts = [placeLabel(i), i.year ? String(i.year) : "", i.topic ? topicWord(i.topic) : ""].filter(Boolean);
  return parts.join(" · ");
}

export function matchesFilters(i: KnowledgeItem, f: KnowledgeFilters): boolean {
  if (f.place && !(i.jurisdictions ?? []).includes(f.place)) return false;
  if (f.year && String(i.year ?? "") !== f.year) return false;
  if (f.topic && (i.topic ?? "") !== f.topic) return false;
  return true;
}

/** What the filter menus offer: only values some item has, places by name, years newest first. */
export function filterChoices(items: KnowledgeItem[]) {
  const places = [...new Set(items.flatMap((i) => i.jurisdictions ?? []))].sort((a, b) =>
    placeName(a).localeCompare(placeName(b)),
  );
  const years = [...new Set(items.map((i) => i.year).filter((y): y is number => typeof y === "number"))].sort(
    (a, b) => b - a,
  );
  const topics = [...new Set(items.map((i) => i.topic).filter((t): t is string => Boolean(t)))].sort();
  return { places, years, topics };
}

/**
 * Items by place, then topic, then year (newest first, so a newer year sits right above the one it replaces).
 * Items still being read come first; items tied to no place come last.
 */
export function groupKnowledge(items: KnowledgeItem[]): KnowledgeGroup[] {
  const reading: KnowledgeItem[] = [];
  const loose: KnowledgeItem[] = [];
  const builtIn = items.filter((i) => i.builtin);
  items = items.filter((i) => !i.builtin);
  const groups = new Map<string, KnowledgeGroup & { sort: [string, string, number] }>();
  for (const i of items) {
    if (!placed(i)) {
      (i.status === "uploading" || i.status === "processing" ? reading : loose).push(i);
      continue;
    }
    const key = `${[...(i.jurisdictions ?? [])].sort().join(",")}|${i.year ?? ""}|${i.topic ?? ""}`;
    const g = groups.get(key) ?? {
      key,
      label: groupLabel(i),
      items: [],
      sort: [placeLabel(i) || "~", i.topic ?? "~", -(i.year ?? 0)] as [string, string, number],
    };
    g.items.push(i);
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => a.sort[0].localeCompare(b.sort[0]) || a.sort[1].localeCompare(b.sort[1]) || a.sort[2] - b.sort[2],
  );
  const out: KnowledgeGroup[] = [];
  if (builtIn.length) out.push({ key: "builtin", label: "Built in", items: builtIn }); // always first
  if (reading.length) out.push({ key: "reading", label: "Being read now", items: reading });
  out.push(...sorted.map(({ key, label, items: xs }) => ({ key, label, items: xs })));
  if (loose.length) out.push({ key: "loose", label: "Not tied to a country", items: loose });
  return out;
}
