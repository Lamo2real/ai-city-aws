// Knowledge: the owner drops files or pastes a link or text; each item shows its live status, how the
// agents may use it (always / when relevant / only when asked) and Delete with Undo (docs/KNOWLEDGE.md §11).
// Items are grouped by where and when they hold ("Sweden · 2026 · Tax"), filterable, and the owner can correct
// what was found automatically (§15).
import { useEffect, useState, type DragEvent } from "react";
import type { KnowledgeItem, KnowledgeKind, Scope } from "../lib/api.ts";
import {
  addFiles,
  addPasted,
  filterChoices,
  groupKnowledge,
  isLink,
  loadKnowledge,
  matchesFilters,
  NO_FILTERS,
  placeLabel,
  scheduleDelete,
  setPlace,
  setScope,
  useKnowledge,
  type KnowledgeFilters,
} from "../lib/knowledge.ts";
import { DOC_TYPES, placeCode, placeName, TOPICS, topicWord } from "../lib/places.ts";
import { Banner, Button, Confirm, Loading, toast, UNDO_MS } from "./ui.tsx";
import { Select } from "./Select.tsx";

export const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "always", label: "Always include" },
  { value: "relevant", label: "When relevant" },
  { value: "on_request", label: "Only when I ask" },
];
const KIND: Record<KnowledgeKind, { icon: string; word: string }> = {
  text: { icon: "📝", word: "Text" },
  document: { icon: "📄", word: "Document" },
  image: { icon: "🖼️", word: "Image" },
  audio: { icon: "🎵", word: "Audio" },
  video: { icon: "🎬", word: "Video" },
  link: { icon: "🔗", word: "Link" },
  other: { icon: "📦", word: "File" },
};

/** The status in plain words, with progress while this browser uploads. */
export function statusWords(item: KnowledgeItem, percent?: number, localError?: string): string {
  if (localError) return `Failed: ${localError}`;
  switch (item.status) {
    case "uploading":
      return percent === undefined ? "Uploading" : `Uploading ${percent} %`;
    case "processing":
      if (item.kind === "audio" || item.kind === "video") return "Transcribing";
      if (item.kind === "image") return "Reading the image";
      if (item.kind === "link") return "Reading the page";
      return "Getting it ready";
    case "ready":
      return "Ready";
    case "failed":
      return `Failed: ${item.error || "something went wrong while reading it. Delete it and add it again."}`;
    case "unsupported":
      return "Can't be searched yet";
  }
}
const statusTone = (item: KnowledgeItem, localError?: string) =>
  localError || item.status === "failed" ? "failed" : item.status === "ready" ? "done" : item.status;

export function KnowledgeScreen() {
  const s = useKnowledge((x) => x);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<KnowledgeItem | null>(null);
  const [filters, setFilters] = useState<KnowledgeFilters>(NO_FILTERS);
  const [grouped, setGrouped] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    void loadKnowledge();
  }, []);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    const problems = await addFiles(files);
    if (problems.length) setError(problems.join(" "));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void add([...e.dataTransfer.files]);
  };
  const submitPaste = async () => {
    const v = pasted.trim();
    if (!v) return;
    setError(null);
    try {
      await addPasted(v);
      setPasted("");
      toast({ text: isLink(v) ? "Link added. It is being read now." : "Text added.", tone: "good" });
    } catch (e) {
      setError((e as Error).message + ((e as { fix?: string | null }).fix ? ` ${(e as { fix: string }).fix}` : ""));
    }
  };
  const choose = async (item: KnowledgeItem, scope: Scope) => {
    setError(null);
    try {
      await setScope(item.id, scope);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = (item: KnowledgeItem) => {
    setConfirming(null);
    const undo = scheduleDelete(item.id, setError);
    toast({ text: `Deleted “${item.title}”.`, undo, tone: "info" });
  };

  const all = s.items.filter((x) => !s.hidden.includes(x.id));
  const visible = all.filter((x) => matchesFilters(x, filters));
  const choices = filterChoices(all);
  const hasPlaces = choices.places.length + choices.years.length + choices.topics.length > 0;
  const filtered = filters.place || filters.year || filters.topic;
  const groups = grouped ? groupKnowledge(visible) : [{ key: "all", label: "", items: visible }];
  const yearOf = (id: string) => s.items.find((x) => x.id === id)?.year;
  const over = s.alwaysTokens > s.alwaysBudget;

  return (
    <section className="screen knowledge" aria-labelledby="kn-title">
      <h1 id="kn-title">Knowledge</h1>
      <p className="lede">What your agents should know. Add a file or a link; you choose how each one is used.</p>

      <label
        className={`drop${dragging ? " drop-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="drop-big">Drop files here, or choose files</span>
        <span className="mute">
          Documents, images, audio and video, many at once, up to 5 GB each. Laws and rules are sorted by country, year
          and topic for you.
        </span>
        <input
          className="sr-only"
          type="file"
          multiple
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void add(files);
          }}
        />
      </label>
      <label className="folder-pick">
        <span className="linkish">Or add a whole folder</span>
        <input
          className="sr-only"
          type="file"
          multiple
          // The folder's name ("Tax/Sweden 2026") helps find the country and year.
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void add(files);
          }}
        />
      </label>

      <form
        className="paste"
        onSubmit={(e) => {
          e.preventDefault();
          void submitPaste();
        }}
      >
        <label className="field">
          Paste a link or text
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={2} />
        </label>
        <Button variant="primary" type="submit" disabled={!pasted.trim()}>
          Add
        </Button>
      </form>

      {error ? <Banner tone="bad">{error}</Banner> : null}

      <p className="budget" aria-live="polite">
        <b>Always include:</b>{" "}
        {`${Math.min(100, Math.round((100 * s.alwaysTokens) / Math.max(1, s.alwaysBudget)))}% of its space is used`}
        {over ? (
          <span className="mute">
            {" "}
            — over the limit, so the newest “Always include” items are left out of prompts. They can still be found.
          </span>
        ) : null}
      </p>

      {s.loadError ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: () => void loadKnowledge() }}>
          {`Your knowledge did not load: ${s.loadError}`}
        </Banner>
      ) : null}
      {!s.loaded && !s.loadError ? <Loading what="your knowledge" /> : null}
      {s.loaded && !all.length ? <p className="empty">Nothing stored yet. Drop a file or paste a link above.</p> : null}

      {hasPlaces ? (
        <div className="kfilters" role="group" aria-label="Show">
          <label className="field">
            Country or region
            <Select value={filters.place} onChange={(e) => setFilters({ ...filters, place: e.target.value })}>
              <option value="">All</option>
              {choices.places.map((p) => (
                <option key={p} value={p}>
                  {placeName(p)}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            Year
            <Select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
              <option value="">All</option>
              {choices.years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            Topic
            <Select value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
              <option value="">All</option>
              {choices.topics.map((t) => (
                <option key={t} value={t}>
                  {topicWord(t)}
                </option>
              ))}
            </Select>
          </label>
          <label className="check">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
            Group by country, year and topic
          </label>
          {filtered ? (
            <Button variant="quiet" onClick={() => setFilters(NO_FILTERS)}>
              Show everything
            </Button>
          ) : null}
        </div>
      ) : null}
      {s.loaded && all.length && !visible.length ? (
        <p className="empty">Nothing matches what you picked. Choose “Show everything” to see it all.</p>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} className="kgroup" aria-label={g.label || "Stored knowledge"}>
          {g.label ? (
            <h2 className="kgroup-title">
              {g.label} <span className="mute">({g.items.length})</span>
            </h2>
          ) : null}
          <ul className="list" aria-label={g.label || "Stored knowledge"}>
            {g.items.map((item) => {
              const local = s.localError[item.id];
              const where = placeLabel(item);
              const facts = [
                where,
                item.year ? String(item.year) : "",
                item.topic ? topicWord(item.topic) : "",
                item.doc_type ? topicWord(item.doc_type) : "",
              ].filter(Boolean);
              return (
                <li key={item.id} className={`kitem${item.superseded_by ? " kitem-old" : ""}`}>
                  <div className="kitem-head">
                    <span className="kind" aria-hidden="true">
                      {KIND[item.kind]?.icon ?? KIND.other.icon}
                    </span>
                    <span className="grow">
                      <b className="ktitle">{item.title}</b>
                      <span className="mute"> · {KIND[item.kind]?.word ?? KIND.other.word}</span>
                    </span>
                    {item.superseded_by ? (
                      <span className="tag tag-old">{`Older: ${yearOf(item.superseded_by) ?? "a newer year"} replaces it`}</span>
                    ) : null}
                    {item.builtin ? <span className="tag tag-builtin">Built in</span> : null}
                    <span className={`tag tag-${statusTone(item, local)}`} role="status">
                      {statusWords(item, s.progress[item.id], local)}
                    </span>
                  </div>
                  {item.warning ? <p className="mute">{item.warning}</p> : null}
                  {item.builtin && item.summary ? <p className="mute">{item.summary}</p> : null}
                  {!item.builtin && (item.status === "ready" || item.meta_source) ? (
                    <p className="kplace">
                      <span>
                        {facts.length ? facts.join(" · ") : "Not tied to a country"}
                        {item.meta_source === "detected" && facts.length ? (
                          <span className="mute"> · found automatically</span>
                        ) : null}
                      </span>
                      <Button
                        variant="quiet"
                        onClick={() => setEditing(editing === item.id ? null : item.id)}
                        label={`Change country, year or topic of “${item.title}”`}
                      >
                        {facts.length ? "Change" : "Set country and year"}
                      </Button>
                    </p>
                  ) : null}
                  {editing === item.id ? (
                    <PlaceEditor item={item} onDone={() => setEditing(null)} onError={setError} />
                  ) : null}
                  {item.builtin ? null : (
                    <div className="kitem-actions">
                      <fieldset className="scope">
                        <legend className="sr-only">{`How the agents use “${item.title}”`}</legend>
                        {SCOPES.map((o) => (
                          <label key={o.value} className={item.scope === o.value ? "on" : undefined}>
                            <input
                              type="radio"
                              name={`scope-${item.id}`}
                              value={o.value}
                              checked={item.scope === o.value}
                              onChange={() => void choose(item, o.value)}
                            />
                            {o.label}
                          </label>
                        ))}
                      </fieldset>
                      <Button variant="quiet" onClick={() => setConfirming(item)} label={`Delete “${item.title}”`}>
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {confirming ? (
        <Confirm
          title={`Delete “${confirming.title}”?`}
          what={`The agents stop using it and the stored file and its text are removed. You can undo for ${Math.round(UNDO_MS / 1000)} seconds.`}
          cost="Nothing. Deleting is free."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => remove(confirming)}
        />
      ) : null}
    </section>
  );
}

/** Where and when an item holds, in plain fields. Places can be typed as names ("Sweden, EU") or codes. */
function PlaceEditor(p: { item: KnowledgeItem; onDone: () => void; onError: (m: string | null) => void }) {
  const { item } = p;
  const [places, setPlaces] = useState((item.jurisdictions ?? []).map(placeName).join(", "));
  const [year, setYear] = useState(item.year ? String(item.year) : "");
  const [topic, setTopic] = useState(item.topic ?? "");
  const [docType, setDocType] = useState(item.doc_type ?? "");
  const save = async () => {
    p.onError(null);
    try {
      await setPlace(item.id, {
        jurisdictions: places
          .split(/[,;]/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map(placeCode),
        year: year.trim() ? Number(year) : null,
        topic: topic || null,
        doc_type: docType || null,
      });
      toast({
        text: `Saved. The agents use “${item.title}” for ${places.trim() || "no country in particular"} now.`,
        tone: "good",
      });
      p.onDone();
    } catch (e) {
      p.onError((e as Error).message);
    }
  };
  return (
    <form
      className="kedit"
      aria-label={`Where and when “${item.title}” holds`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="field">
        Countries or regions
        <input value={places} onChange={(e) => setPlaces(e.target.value)} placeholder="e.g. Sweden, EU" />
      </label>
      <label className="field">
        Year
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="e.g. 2026"
        />
      </label>
      <label className="field">
        Topic
        <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Not set</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {topicWord(t)}
            </option>
          ))}
        </Select>
      </label>
      <label className="field">
        Type
        <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="">Not set</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {topicWord(t)}
            </option>
          ))}
        </Select>
      </label>
      <div className="kedit-actions">
        <Button type="submit">Save</Button>
        <Button variant="quiet" onClick={p.onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
