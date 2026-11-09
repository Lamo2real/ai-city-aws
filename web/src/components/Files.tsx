// Files (docs/FILES.md §11): the owner's storage for anything. Drop files anywhere on the screen or press
// + Upload; search by what's in a file ("sunrise with a Porsche"); narrow by kind, folder or department; open a
// file to preview, download, rename, move, tag or delete it. What the departments save shows here, marked.
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  addToFiles,
  byWords,
  dateWords,
  fileStatusWords,
  filesApi,
  KIND_WORD,
  loadFiles,
  sizeWords,
  useFiles,
  files as filesStore,
  type FileKind,
  type StoredFile,
} from "../lib/files.ts";
import { Banner, Button, Confirm, errorText, Loading, toast } from "./ui.tsx";
import { Select } from "./Select.tsx";

const KINDS: Array<{ value: "" | FileKind; label: string }> = [
  { value: "", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Documents" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Other" },
];
const ICON: Record<FileKind, string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  document: "📄",
  text: "📝",
  other: "📦",
};

const tone = (f: StoredFile, local?: string) =>
  local || f.status === "failed" ? "failed" : f.status === "ready" ? "done" : f.status;

export function FilesScreen() {
  const s = useFiles((x) => x);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [kind, setKind] = useState<"" | FileKind>("");
  const [folder, setFolder] = useState("");
  const [dept, setDept] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const filters = { q: searched, kind, folder, department: dept };
  useEffect(() => {
    void loadFiles({ q: searched, kind, folder, department: dept });
  }, [searched, kind, folder, dept]);

  const add = async (list: File[]) => {
    if (!list.length) return;
    setError(null);
    const problems = await addToFiles(list, folder);
    if (problems.length) setError(problems.join(" "));
    else
      toast({
        text: list.length === 1 ? `“${list[0]!.name}” is uploaded.` : `${list.length} files are uploaded.`,
        tone: "good",
      });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void add([...e.dataTransfer.files]);
  };
  const search = (e: FormEvent) => {
    e.preventDefault();
    setSearched(query.trim());
  };
  const filtered = Boolean(searched || kind || folder || dept);
  const shown = s.files;
  const opened = shown.find((f) => f.id === open) ?? null;

  return (
    <section
      className={`screen files${dragging ? " files-dragging" : ""}`}
      aria-labelledby="files-title"
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="files-head">
        <div>
          <h1 id="files-title">Files</h1>
          <p className="lede">
            Everything you keep: photos, videos, PDFs, documents, any file. Your departments use them and save their
            work here too.
          </p>
        </div>
        <Button variant="primary" onClick={() => picker.current?.click()}>
          + Upload
        </Button>
        <input
          ref={picker}
          className="sr-only"
          type="file"
          multiple
          aria-label="Choose files to upload"
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = "";
            void add(list);
          }}
        />
      </div>

      <form className="files-search" role="search" onSubmit={search}>
        <label className="field grow">
          <span className="sr-only">Search your files</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setSearched("");
            }}
            placeholder="Search by what's in it, e.g. sunrise with a Porsche"
          />
        </label>
        <Button type="submit">Search</Button>
      </form>

      <div className="files-filters">
        <div className="segmented" role="group" aria-label="Kind of file">
          {KINDS.map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
        {s.folders.length ? (
          <label className="field">
            Folder
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">All folders</option>
              {s.folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {s.departments.length ? (
          <label className="field">
            Made by
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">Anyone</option>
              {s.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {filtered ? (
          <Button
            variant="quiet"
            onClick={() => {
              setQuery("");
              setSearched("");
              setKind("");
              setFolder("");
              setDept("");
            }}
          >
            Show everything
          </Button>
        ) : null}
      </div>

      <label className={`drop files-drop${dragging ? " drop-over" : ""}`}>
        <span className="drop-big">{dragging ? "Drop to upload" : "Drop files anywhere here, or choose files"}</span>
        <span className="mute">
          {folder ? `They go into “${folder}”. ` : ""}Any type, many at once, up to 50 GB each. Large videos upload
          straight from your device.
        </span>
        <input
          className="sr-only"
          type="file"
          multiple
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = "";
            void add(list);
          }}
        />
      </label>

      {error ? <Banner tone="bad">{error}</Banner> : null}
      {s.loadError ? (
        <Banner tone="bad" action={{ label: "Try again", onClick: () => void loadFiles(filters) }}>
          {`Your files did not load: ${s.loadError}`}
        </Banner>
      ) : null}
      {!s.loaded && !s.loadError ? <Loading what="your files" /> : null}
      {s.loaded && !shown.length && !filtered ? (
        <p className="empty">Nothing here yet. Drop a photo, a video or a PDF above.</p>
      ) : null}
      {s.loaded && !shown.length && filtered ? (
        <p className="empty">
          {searched ? `Nothing matches “${searched}”.` : "Nothing matches what you picked."} Try other words, or choose
          “Show everything”.
        </p>
      ) : null}
      {searched && shown.length ? <p className="mute files-count">{`Best matches for “${searched}”`}</p> : null}

      <ul className="files-grid" aria-label="Your files">
        {shown.map((f) => {
          const local = s.localError[f.id];
          return (
            <li key={f.id}>
              <button type="button" className="file-tile" onClick={() => setOpen(f.id)} aria-label={`Open ${f.name}`}>
                <span className="file-thumb" aria-hidden="true">
                  {f.thumb_url ? (
                    <img src={f.thumb_url} alt="" loading="lazy" />
                  ) : (
                    <span>{ICON[f.kind] ?? ICON.other}</span>
                  )}
                </span>
                <span className="file-name">{f.name}</span>
                <span className="file-meta mute">
                  {[
                    KIND_WORD[f.kind] ?? "File",
                    sizeWords(f.size_bytes),
                    dateWords(f.taken_at || f.created_at),
                    byWords(f),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {f.status !== "ready" || local ? (
                  <span className={`tag tag-${tone(f, local)}`} role="status">
                    {fileStatusWords(f, s.progress[f.id], local)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {opened ? (
        <FileViewer file={opened} folders={s.folders} onClose={() => setOpen(null)} onError={setError} />
      ) : null}
    </section>
  );
}

/** One file: a big preview, what it is, Download, and the changes (rename, folder, tags, note, delete). */
export function FileViewer(p: {
  file: StoredFile;
  folders: string[];
  onClose: () => void;
  onError: (m: string | null) => void;
}) {
  const f = p.file;
  const [name, setName] = useState(f.name);
  const [folder, setFolder] = useState(f.folder);
  const [tags, setTags] = useState(f.tags.join(", "));
  const [note, setNote] = useState(f.note ?? "");
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !confirming && p.onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [p, confirming]);

  const changed =
    name.trim() !== f.name || folder.trim() !== f.folder || tags !== f.tags.join(", ") || note !== (f.note ?? "");
  const save = async () => {
    setProblem(null);
    try {
      const r = await filesApi.update(f.id, {
        ...(name.trim() !== f.name ? { name: name.trim() } : {}),
        ...(folder.trim() !== f.folder ? { folder: folder.trim() } : {}),
        ...(tags !== f.tags.join(", ")
          ? {
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : {}),
        ...(note !== (f.note ?? "") ? { note } : {}),
      });
      filesStore.dispatch({ type: "upsert", file: r.file });
      toast({ text: "Saved.", tone: "good" });
    } catch (e) {
      setProblem(errorText(e, "That didn't save. Try again."));
    }
  };
  const remove = async () => {
    setConfirming(false);
    try {
      await filesApi.remove(f.id);
      filesStore.dispatch({ type: "removed", id: f.id });
      toast({ text: `Deleted “${f.name}”. It can be recovered for 30 days.`, tone: "info" });
      p.onClose();
    } catch (e) {
      p.onError(errorText(e, "That file wasn't deleted. Try again."));
    }
  };
  const retry = async () => {
    setProblem(null);
    try {
      const r = await filesApi.retry(f.id);
      filesStore.dispatch({ type: "upsert", file: r.file });
    } catch (e) {
      setProblem(errorText(e, "It didn't start again. Try once more."));
    }
  };

  return (
    <div className="scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className="dialog panel file-viewer" role="dialog" aria-modal="true" aria-labelledby="fv-title" ref={ref}>
        <div className="fv-head">
          <h2 id="fv-title">{f.name}</h2>
          <Button variant="quiet" onClick={p.onClose} label="Close">
            ✕
          </Button>
        </div>
        <FilePreview file={f} />
        <p className="mute">
          {[
            KIND_WORD[f.kind],
            sizeWords(f.size_bytes),
            f.taken_at ? `Taken ${dateWords(f.taken_at)}` : "",
            `Added ${dateWords(f.created_at)} by ${byWords(f)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {f.description ? <p className="fv-desc">{f.description}</p> : null}
        {f.status !== "ready" ? <p className="mute">{fileStatusWords(f)}</p> : null}
        {f.warning ? <p className="mute">{f.warning}</p> : null}
        <div className="row-end fv-actions">
          {f.status === "failed" ? <Button onClick={retry}>Try again</Button> : null}
          {f.download_url ? (
            <a className="btn btn-primary" href={f.download_url} download={f.name}>
              Download
            </a>
          ) : null}
        </div>
        <form
          className="fv-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Folder
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              list="fv-folders"
              placeholder="e.g. Thumbnails/2026 (empty: top level)"
            />
            <datalist id="fv-folders">
              {p.folders.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Tags
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. launch, hero" />
          </label>
          <label className="field">
            Your note (helps finding it)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
          {problem ? <Banner tone="bad">{problem}</Banner> : null}
          <div className="row-end">
            <Button variant="quiet" onClick={() => setConfirming(true)}>
              Delete
            </Button>
            <Button type="submit" disabled={!changed || !name.trim()}>
              Save changes
            </Button>
          </div>
        </form>
        {confirming ? (
          <Confirm
            title={`Delete “${f.name}”?`}
            what="It disappears from Files for you and every department. It can be recovered for 30 days if you ask."
            cost="Nothing. Deleting is free."
            confirmLabel="Delete"
            danger
            onCancel={() => setConfirming(false)}
            onConfirm={remove}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The preview a file deserves: the image, a player, a PDF's first page, or a card with its kind. */
export function FilePreview(p: { file: StoredFile; compact?: boolean }) {
  const f = p.file;
  const ct = (f.content_type || "").toLowerCase();
  if (!f.url) return <div className="fpreview fpreview-none">{ICON[f.kind] ?? ICON.other}</div>;
  if (f.kind === "image" && (f.thumb_url || /^image\/(png|jpe?g|gif|webp|avif|svg)/.test(ct)))
    return (
      <div className="fpreview">
        <img src={p.compact && f.thumb_url ? f.thumb_url : f.url} alt={f.description || f.name} />
      </div>
    );
  if (f.kind === "video")
    return (
      <div className="fpreview">
        <video src={f.url} controls preload="metadata" poster={f.thumb_url} aria-label={f.name} />
      </div>
    );
  if (f.kind === "audio")
    return (
      <div className="fpreview fpreview-audio">
        <audio src={f.url} controls preload="metadata" aria-label={f.name} />
      </div>
    );
  if (ct === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
    return (
      <div className="fpreview fpreview-pdf">
        <iframe src={`${f.url}#page=1&view=FitH&toolbar=0`} title={`First page of ${f.name}`} />
      </div>
    );
  return (
    <div className="fpreview fpreview-none">
      <span aria-hidden="true">{ICON[f.kind] ?? ICON.other}</span>
      <span className="mute">{KIND_WORD[f.kind] ?? "File"}: no preview, download it to open.</span>
    </div>
  );
}
