// The department knowledge entries list (docs/KNOWLEDGE.md §17): state words and grouping by domain.
import { describe, expect, it } from "vitest";
import { entryFlags, groupEntries, lines, type EntryList, type EntryRow } from "../src/lib/entries.ts";

const row = (over: Partial<EntryRow>): EntryRow =>
  ({
    id: "kn-marketing.seo.local-seo",
    entry_id: "marketing.seo.local-seo",
    department: "marketing",
    domain: "seo",
    title: "Local SEO essentials",
    summary: "Primary category, proximity.",
    type: "checklist",
    audience: "worker",
    confidence: "established",
    volatility: "evergreen",
    as_of: "2026-11-11",
    review_by: "2028-11-11",
    origin: "system",
    status: "ready",
    sync: "done",
    ...over,
  }) as EntryRow;

const list = (entries: EntryRow[]): EntryList => ({
  entries,
  taxonomies: {
    marketing: {
      label: "Marketing",
      domains: { strategy: "Strategy", seo: "SEO", compliance: "Compliance" },
      platforms: {},
      objectives: {},
    },
  },
  choices: { type: [], audience: [], confidence: [], volatility: [] },
});

describe("department knowledge entries", () => {
  it("says what state an entry is in, most important first", () => {
    expect(entryFlags(row({}))).toEqual([]);
    expect(entryFlags(row({ user_modified: true, has_newer_default: true }))).toEqual(["Edited", "Newer default"]);
    expect(entryFlags(row({ deleted: true, user_modified: true }))).toEqual(["Deleted", "Edited"]);
    expect(entryFlags(row({ origin: "user" }))).toEqual(["Yours"]);
    expect(entryFlags(row({ sync: "failed" }))).toEqual(["Not indexed"]);
    expect(entryFlags(row({ status: "processing" }))).toEqual(["Indexing"]);
    expect(entryFlags(row({ volatility: "fast-moving", review_by: "2026-01-01" }), "2026-11-11")).toEqual([
      "Past review date",
    ]);
  });

  it("groups by domain in the taxonomy's order and filters by words and domain", () => {
    const l = list([
      row({ entry_id: "a", domain: "seo", title: "B SEO" }),
      row({ entry_id: "b", domain: "strategy", title: "Positioning" }),
      row({ entry_id: "c", domain: "seo", title: "A SEO" }),
      row({ entry_id: "d", domain: "strategy", department: "sales", title: "Other department" }),
    ]);
    const g = groupEntries(l, "marketing", "", "");
    expect(g.map((x) => [x.label, x.entries.map((e) => e.title)])).toEqual([
      ["Strategy", ["Positioning"]],
      ["SEO", ["A SEO", "B SEO"]],
    ]);
    expect(groupEntries(l, "marketing", "position", "").map((x) => x.domain)).toEqual(["strategy"]);
    expect(groupEntries(l, "marketing", "", "seo").map((x) => x.domain)).toEqual(["seo"]);
  });

  it("splits sources by line and platforms by line or comma", () => {
    expect(lines("https://a.example/x,y\n\nhttps://b.example")).toEqual(["https://a.example/x,y", "https://b.example"]);
    expect(lines("meta, google-ads\ninstagram", true)).toEqual(["meta", "google-ads", "instagram"]);
  });
});
