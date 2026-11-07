// Knowledge: the owner drops files or pastes a link or text; each item shows its live status, how the
// agents may use it (always / when relevant / only when asked) and Delete with Undo (docs/KNOWLEDGE.md §11).
import { useEffect, useState, type DragEvent } from "react";
import type { KnowledgeItem, KnowledgeKind, Scope } from "../lib/api.ts";
import {
  addFiles,
  addPasted,
  isLink,
  loadKnowledge,
  scheduleDelete,
  setScope,
  useKnowledge,
} from "../lib/knowledge.ts";
import { Banner, Button, Confirm, Loading, toast, UNDO_MS } from "./ui.tsx";

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

  const visible = s.items.filter((x) => !s.hidden.includes(x.id));
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
        <span className="mute">Documents, images, audio and video, many at once, up to 5 GB each.</span>
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
      {s.loaded && !visible.length ? (
        <p className="empty">Nothing stored yet. Drop a file or paste a link above.</p>
      ) : null}

      <ul className="list" aria-label="Stored knowledge">
        {visible.map((item) => {
          const local = s.localError[item.id];
          return (
            <li key={item.id} className="kitem">
              <div className="kitem-head">
                <span className="kind" aria-hidden="true">
                  {KIND[item.kind]?.icon ?? KIND.other.icon}
                </span>
                <span className="grow">
                  <b className="ktitle">{item.title}</b>
                  <span className="mute"> · {KIND[item.kind]?.word ?? KIND.other.word}</span>
                </span>
                <span className={`tag tag-${statusTone(item, local)}`} role="status">
                  {statusWords(item, s.progress[item.id], local)}
                </span>
              </div>
              {item.warning ? <p className="mute">{item.warning}</p> : null}
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
            </li>
          );
        })}
      </ul>

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
