// Department knowledge entries (docs/KNOWLEDGE.md §17): the built-in knowledge bases each department's agents use,
// which the owner can read, edit, delete, reset to the shipped default, re-index and add to.
import { api } from "./api.ts";

export type EntryType = "principle" | "playbook" | "checklist" | "benchmark" | "policy" | "glossary" | "house-style";
export type EntryStatus = "processing" | "ready" | "failed" | "deleted" | "retired";

export interface EntryRow {
  id: string;
  entry_id: string;
  department: string;
  domain: string;
  title: string;
  summary: string;
  type: EntryType;
  audience: "manager" | "worker" | "both";
  platforms?: string[];
  objectives?: string[];
  confidence: string;
  volatility: "evergreen" | "annual" | "fast-moving";
  as_of: string;
  review_by: string;
  origin: "system" | "user";
  builtin?: boolean;
  status: EntryStatus;
  error?: string | null;
  user_modified?: boolean;
  deleted?: boolean;
  retired?: boolean;
  seed_removed?: boolean;
  sync?: "pending" | "done" | "failed";
  has_newer_default?: boolean;
  /** A newer version is indexing or failed to: agents still read the previous ready one (decision 235). */
  previous_in_use?: boolean;
  updated_at?: string;
  changed_by?: string;
}

export interface Entry extends EntryRow {
  content: string;
  sources?: string[];
  related?: string[];
  requires?: string[];
  /** A whole document's own references: "section 19" → the entries that hold it now (decision 222). */
  cross_refs?: Record<string, string[]>;
  document?: string;
  newer_default?: (Partial<Entry> & { seed_hash?: string }) | null;
}

export interface Taxonomy {
  label: string;
  domains: Record<string, string>;
  platforms: Record<string, string>;
  objectives: Record<string, string>;
}

export interface EntryList {
  entries: EntryRow[];
  taxonomies: Record<string, Taxonomy>;
  choices: { type: string[]; audience: string[]; confidence: string[]; volatility: string[] };
}

export interface HistoryRow {
  action: string;
  by: string;
  at: string;
  detail?: string;
}

/** The fields the owner edits (the same schema as the seed files). */
export interface EntryInput {
  department?: string;
  domain?: string;
  title?: string;
  summary?: string;
  content?: string;
  type?: string;
  audience?: string;
  confidence?: string;
  volatility?: string;
  review_by?: string;
  platforms?: string[];
  sources?: string[];
}

const path = (id: string) => `/knowledge/entries/${encodeURIComponent(id)}`;

export const entriesApi = {
  list: () => api<EntryList>("/knowledge/entries"),
  get: (id: string) => api<{ entry: Entry; history: HistoryRow[] }>(path(id)),
  create: (body: EntryInput) => api<{ entry: Entry }>("/knowledge/entries", { method: "POST", body }),
  update: (id: string, body: EntryInput) => api<{ entry: Entry }>(path(id), { method: "PUT", body }),
  remove: (id: string) => api<{ entry: Entry }>(path(id), { method: "DELETE" }),
  reset: (id: string) => api<{ entry: Entry }>(`${path(id)}/reset`, { method: "POST" }),
  reindex: (id: string) => api<{ entry: Entry }>(`${path(id)}/reindex`, { method: "POST" }),
};

/** Short state words for a row, most important first. */
export function entryFlags(e: EntryRow, today = new Date().toISOString().slice(0, 10)): string[] {
  const out: string[] = [];
  if (e.type === "house-style") out.push("House style");
  if (e.retired) out.push("Retired");
  else if (e.deleted) out.push("Deleted");
  if (e.origin === "user") out.push("Yours");
  else if (e.user_modified) out.push("Edited");
  if (e.has_newer_default) out.push("Newer default");
  if (e.sync === "failed" || e.status === "failed") out.push("Not indexed");
  else if (e.status === "processing" && !e.deleted) out.push("Indexing");
  if (e.previous_in_use && !e.deleted) out.push("Previous version in use");
  if (e.volatility === "fast-moving" && e.review_by < today && !e.deleted) out.push("Past review date");
  return out;
}

/** Entries by domain in the taxonomy's order, filtered by words (title, summary, id) and a domain. */
export function groupEntries(
  list: EntryList | null,
  department: string,
  words: string,
  domain: string,
): Array<{ domain: string; label: string; entries: EntryRow[] }> {
  if (!list) return [];
  const tax = list.taxonomies[department];
  const q = words.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = list.entries.filter(
    (e) =>
      e.department === department &&
      (!domain || e.domain === domain) &&
      q.every((w) => `${e.title} ${e.summary} ${e.entry_id}`.toLowerCase().includes(w)),
  );
  const order = Object.keys(tax?.domains ?? {});
  return order
    .map((d) => ({
      domain: d,
      label: tax?.domains[d] ?? d,
      entries: rows.filter((e) => e.domain === d).sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.entries.length);
}

/** Text → list, empty items dropped: one per line (sources), or also comma-separated (platforms). */
export const lines = (text: string, commas = false) =>
  text
    .split(commas ? /[\n,]/ : /\n/)
    .map((x) => x.trim())
    .filter(Boolean);
