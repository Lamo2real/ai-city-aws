// The built-in department knowledge bases (docs/KNOWLEDGE.md §17), shown under "Built in" on the Knowledge tab:
// one card per department (Marketing first), which opens into its entries by domain, and last the "Shared" card:
// the cross-department documents every department's agents use (decision 238). The owner reads, edits,
// deletes, resets to the shipped default, re-indexes and adds entries; a deploy never undoes those choices.
import { useEffect, useState } from "react";
import {
  entriesApi,
  entryFlags,
  groupEntries,
  lines,
  type Entry,
  type EntryInput,
  type EntryList,
  type EntryRow,
  type HistoryRow,
} from "../lib/entries.ts";
import { startDownload } from "../lib/api.ts";
import { Banner, Button, Confirm, Loading, toast } from "./ui.tsx";
import { Select } from "./Select.tsx";

const FLAG_TONE: Record<string, string> = {
  Deleted: "failed",
  Retired: "failed",
  "Not indexed": "failed",
  Indexing: "processing",
  "Previous version in use": "builtin",
  "Past review date": "old",
  "Newer default": "builtin",
  "House style": "dept",
};

/** The scope of the cross-department documents: not a department, so its card comes after the departments'. */
const SHARED = "shared";

function sharedLast<T>(rows: [string, T][]): [string, T][] {
  return [...rows.filter(([d]) => d !== SHARED), ...rows.filter(([d]) => d === SHARED)];
}

export function DepartmentKnowledge() {
  const [list, setList] = useState<EntryList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const reload = async () => {
    try {
      setList(await entriesApi.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  if (error && !list)
    return <Banner tone="warn">{`The department knowledge bases could not be loaded: ${error}`}</Banner>;
  if (!list) return null;
  return (
    <>
      {sharedLast(Object.entries(list.taxonomies)).map(([dept, tax]) => {
        const shared = dept === SHARED;
        const all = list.entries.filter((e) => e.department === dept);
        const live = all.filter((e) => !e.deleted && !e.retired);
        return (
          <section key={dept} className="kitem kdept" aria-label={`${tax.label} knowledge base`}>
            <div className="kitem-head">
              <span className="kind" aria-hidden="true">
                📚
              </span>
              <span className="grow">
                <b className="ktitle">{`${tax.label} knowledge`}</b>
                <span className="mute">{` · ${live.length} entries`}</span>
              </span>
              <span className="tag tag-builtin">Built in</span>
              <span className="tag tag-dept">{shared ? "Shared" : tax.label}</span>
              <Button
                variant="quiet"
                onClick={() => setOpen(open === dept ? null : dept)}
                label={open === dept ? `Hide the ${tax.label} entries` : `Show the ${tax.label} entries`}
              >
                {open === dept ? "Hide" : "Show entries"}
              </Button>
            </div>
            <p className="mute">
              {shared
                ? "Who owns what and how work passes between departments. Every department's agents use it. Your edits and deletions stay when AI City updates."
                : `Researched strategy and platform practice. Only the ${tax.label} department's agents use it. Your edits and deletions stay when AI City updates.`}
            </p>
            {open === dept ? <DepartmentEntries list={list} department={dept} reload={reload} /> : null}
          </section>
        );
      })}
    </>
  );
}

function DepartmentEntries(p: { list: EntryList; department: string; reload: () => Promise<void> }) {
  const tax = p.list.taxonomies[p.department] ?? { label: p.department, domains: {}, platforms: {}, objectives: {} };
  const [words, setWords] = useState("");
  const [domain, setDomain] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const groups = groupEntries(p.list, p.department, words, domain);
  return (
    <div className="kdept-body">
      <div className="kfilters" role="group" aria-label="Find an entry">
        <label className="field">
          Search
          <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Performance Max, consent…" />
        </label>
        <label className="field">
          Domain
          <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">All</option>
            {Object.entries(tax.domains).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="secondary" onClick={() => setCreating(!creating)}>
          {creating ? "Cancel" : "Add an entry"}
        </Button>
      </div>
      {creating ? (
        <EntryEditor
          list={p.list}
          department={p.department}
          onDone={async (e) => {
            setCreating(false);
            await p.reload();
            if (e) setSelected(e.entry_id);
          }}
        />
      ) : null}
      {!groups.length ? <p className="empty">No entry matches.</p> : null}
      {groups.map((g) => (
        <div key={g.domain} className="kdomain">
          <h3 className="kgroup-title">
            {g.label} <span className="mute">({g.entries.length})</span>
          </h3>
          <ul className="list" aria-label={`${g.label} entries`}>
            {g.entries.map((e) => (
              <li key={e.entry_id} className={`kentry${e.deleted || e.retired ? " kitem-old" : ""}`}>
                <button
                  type="button"
                  className="kentry-row"
                  aria-expanded={selected === e.entry_id}
                  onClick={() => setSelected(selected === e.entry_id ? null : e.entry_id)}
                >
                  <span className="grow">
                    <b>{e.title}</b>
                    <span className="mute">{` · ${e.type}`}</span>
                  </span>
                  {entryFlags(e).map((f) => (
                    <span key={f} className={`tag tag-${FLAG_TONE[f] ?? "done"}`}>
                      {f}
                    </span>
                  ))}
                </button>
                {selected === e.entry_id ? (
                  <EntryView row={e} list={p.list} reload={p.reload} onClose={() => setSelected(null)} />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EntryView(p: { row: EntryRow; list: EntryList; reload: () => Promise<void>; onClose: () => void }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newer, setNewer] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = async () => {
    try {
      const r = await entriesApi.get(p.row.entry_id);
      setEntry(r.entry);
      setHistory(r.history);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, [p.row.entry_id, p.row.updated_at]);

  const act = async (what: string, run: () => Promise<{ entry: Entry }>) => {
    setError(null);
    try {
      const r = await run();
      setEntry(r.entry);
      toast({
        text: r.entry.error ? `${what}, but: ${r.entry.error}` : `${what}.`,
        tone: r.entry.error ? "info" : "good",
      });
      await p.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const download = async () => {
    setError(null);
    try {
      startDownload(await entriesApi.download(p.row.entry_id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (error && !entry) return <Banner tone="bad">{error}</Banner>;
  if (!entry) return <Loading what="the entry" />;
  const system = entry.origin === "system";
  const facts = [
    `As of ${entry.as_of}`,
    `review by ${entry.review_by}`,
    entry.volatility,
    `confidence: ${entry.confidence}`,
    `for ${entry.audience === "both" ? "managers and workers" : `${entry.audience}s`}`,
    ...(entry.platforms?.length ? [entry.platforms.join(", ")] : []),
  ];
  return (
    <div className="kentry-view">
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {entry.error ? <Banner tone="warn">{entry.error}</Banner> : null}
      <p>{entry.summary}</p>
      <p className="mute">{facts.join(" · ")}</p>
      {editing ? (
        <EntryEditor
          list={p.list}
          department={entry.department}
          entry={entry}
          onDone={async (e) => {
            setEditing(false);
            if (e) setEntry(e);
            await p.reload();
          }}
        />
      ) : (
        <pre className="kentry-text">{entry.content}</pre>
      )}
      {entry.sources?.length ? (
        <details>
          <summary>{`Sources (${entry.sources.length})`}</summary>
          <ul>
            {entry.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noreferrer noopener">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {entry.cross_refs && Object.keys(entry.cross_refs).length ? (
        <details>
          <summary>Cross-references</summary>
          <ul>
            {Object.entries(entry.cross_refs).map(([k, ids]) => (
              <li key={k}>{`Section ${k}: ${ids.map((i) => i.split(".").slice(1).join(" › ")).join(", ")}`}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {newer && entry.newer_default ? (
        <div className="kentry-newer" aria-label="The newer default">
          <p>
            <b>The newer default:</b> {entry.newer_default.title}
          </p>
          <pre className="kentry-text">{entry.newer_default.content}</pre>
        </div>
      ) : null}
      <div className="kitem-actions">
        {!entry.deleted && !entry.retired && !editing ? (
          <Button variant="quiet" onClick={() => setEditing(true)} label={`Edit “${entry.title}”`}>
            Edit
          </Button>
        ) : null}
        {system && (entry.user_modified || entry.deleted || entry.retired) ? (
          <Button variant="quiet" onClick={() => act("Back to the default", () => entriesApi.reset(entry.entry_id))}>
            Reset to default
          </Button>
        ) : null}
        {entry.newer_default ? (
          <Button variant="quiet" onClick={() => setNewer(!newer)}>
            {newer ? "Hide the newer default" : "View newer default"}
          </Button>
        ) : null}
        {entry.sync === "failed" || entry.status === "failed" ? (
          <Button variant="quiet" onClick={() => act("Indexed again", () => entriesApi.reindex(entry.entry_id))}>
            Re-index
          </Button>
        ) : null}
        {!entry.deleted && !entry.retired ? (
          <Button variant="quiet" onClick={() => void download()} label={`Download “${entry.title}”`}>
            Download
          </Button>
        ) : null}
        {!entry.deleted && !entry.retired ? (
          <Button variant="quiet" onClick={() => setConfirming(true)} label={`Delete “${entry.title}”`}>
            Delete
          </Button>
        ) : null}
        <Button variant="quiet" onClick={p.onClose}>
          Close
        </Button>
      </div>
      {history.length ? (
        <details>
          <summary>History</summary>
          <ul className="mute">
            {history.slice(0, 20).map((h) => (
              <li
                key={`${h.at}-${h.action}`}
              >{`${h.at.slice(0, 16).replace("T", " ")} · ${h.action} · ${h.by}${h.detail ? ` · ${h.detail}` : ""}`}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {confirming ? (
        <Confirm
          title={`Delete “${entry.title}”?`}
          what={
            system
              ? "The agents stop using it. It stays deleted when AI City updates; Reset to default brings it back."
              : "The agents stop using it. The record is kept so you can see what it said."
          }
          cost="Nothing. Deleting is free."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            await act("Deleted", () => entriesApi.remove(entry.entry_id));
          }}
        />
      ) : null}
    </div>
  );
}

function EntryEditor(p: {
  list: EntryList;
  department: string;
  entry?: Entry;
  onDone: (e: Entry | null) => Promise<void>;
}) {
  const tax = p.list.taxonomies[p.department] ?? { label: p.department, domains: {}, platforms: {}, objectives: {} };
  const e = p.entry;
  const [f, setF] = useState<EntryInput>({
    domain: e?.domain ?? Object.keys(tax.domains)[0],
    title: e?.title ?? "",
    summary: e?.summary ?? "",
    content: e?.content ?? "",
    type: e?.type ?? "playbook",
    audience: e?.audience ?? "both",
    confidence: e?.confidence ?? "established",
    volatility: e?.volatility ?? "evergreen",
    review_by: e?.review_by,
  });
  const [platforms, setPlatforms] = useState((e?.platforms ?? []).join(", "));
  const [sources, setSources] = useState((e?.sources ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof EntryInput) => (v: string) => setF({ ...f, [k]: v });
  const save = async () => {
    setError(null);
    const body: EntryInput = {
      ...f,
      review_by: f.review_by || undefined,
      platforms: lines(platforms, true),
      sources: lines(sources),
    };
    try {
      const r = e
        ? await entriesApi.update(e.entry_id, { ...body, domain: undefined })
        : await entriesApi.create({ ...body, department: p.department });
      toast({
        text: r.entry.error ? `Saved, but: ${r.entry.error}` : "Saved. The agents use it from now on.",
        tone: "good",
      });
      await p.onDone(r.entry);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const choice = (k: "type" | "audience" | "confidence" | "volatility", label: string) => (
    <label className="field">
      {label}
      <Select value={String(f[k] ?? "")} onChange={(x) => set(k)(x.target.value)}>
        {p.list.choices[k].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </label>
  );
  return (
    <form
      className="kedit"
      aria-label={e ? `Edit “${e.title}”` : "A new entry"}
      onSubmit={(x) => {
        x.preventDefault();
        void save();
      }}
    >
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {e ? null : (
        <label className="field">
          Domain
          <Select value={f.domain} onChange={(x) => set("domain")(x.target.value)}>
            {Object.entries(tax.domains).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="field">
        Title
        <input value={f.title} onChange={(x) => set("title")(x.target.value)} required maxLength={200} />
      </label>
      <label className="field">
        Summary (one or two sentences)
        <textarea
          value={f.summary}
          onChange={(x) => set("summary")(x.target.value)}
          required
          rows={2}
          maxLength={500}
        />
      </label>
      <label className="field">
        The entry (Markdown; ## headings split it for search)
        <textarea value={f.content} onChange={(x) => set("content")(x.target.value)} required rows={12} />
      </label>
      {choice("type", "Type")}
      {choice("audience", "For")}
      {choice("confidence", "Confidence")}
      {choice("volatility", "How fast it ages")}
      <label className="field">
        Review by
        <input type="date" value={f.review_by ?? ""} onChange={(x) => set("review_by")(x.target.value)} />
      </label>
      <label className="field">
        {`Platforms (${Object.keys(tax.platforms).join(", ")})`}
        <input value={platforms} onChange={(x) => setPlatforms(x.target.value)} />
      </label>
      <label className="field">
        Sources (one link per line)
        <textarea value={sources} onChange={(x) => setSources(x.target.value)} rows={3} />
      </label>
      <div className="kitem-actions">
        <Button type="submit" variant="secondary">
          Save
        </Button>
        <Button variant="quiet" onClick={() => p.onDone(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
