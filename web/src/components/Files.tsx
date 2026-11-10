// Files (docs/FILES.md §11): the owner's storage for anything. Browse folders by hand (breadcrumbs back up, an
// endless scroll that loads more as you go, thumbnails loaded lazily), or search files and folders by name and by
// what's in them, everywhere or inside the open folder. Sort by date, name, size or type; a grid or a list. Drop
// files anywhere or press + Upload (they go into the open folder); open a file to preview, download, rename, move,
// tag or delete it. What the departments save shows here, marked with the department.
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  addToFiles,
  byWords,
  crumbs,
  dateWords,
  dropPreview,
  fileStatusWords,
  filesApi,
  KIND_WORD,
  loadFiles,
  loadMore,
  localPreview,
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
/** Sort choices: the API's sort and order, in plain words. */
const SORTS: Array<{ value: string; label: string; search?: boolean }> = [
  { value: "relevance:desc", label: "Best match", search: true },
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "size:desc", label: "Largest first" },
  { value: "size:asc", label: "Smallest first" },
  { value: "type:asc", label: "Type" },
];
const VIEW_KEY = "vaic.files.view";
const readView = (): "grid" | "list" => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

const tone = (f: StoredFile, local?: string) =>
  local || f.status === "failed" ? "failed" : f.status === "ready" ? "done" : f.status;

export function FilesScreen() {
  const s = useFiles((x) => x);
  const [folder, setFolder] = useState("");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [here, setHere] = useState(false);
  const [kind, setKind] = useState<"" | FileKind>("");
  const [dept, setDept] = useState("");
  const [sort, setSort] = useState("");
  const [view, setView] = useState<"grid" | "list">(readView);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const searching = Boolean(searched);
  const sortValue = sort || (searching ? "relevance:desc" : "date:desc");
  const [sortBy, order] = sortValue.split(":") as [string, string];
  const params: Record<string, string> = {
    q: searched,
    folder,
    scope: searching ? (here && folder ? "here" : "all") : "here",
    kind,
    department: dept,
    sort: sortBy,
    order,
  };
  const key = JSON.stringify(params);
  useEffect(() => {
    void loadFiles(JSON.parse(key) as Record<string, string>);
  }, [key]);

  // Endless scroll: the next page loads as the end of the list comes into view.
  useEffect(() => {
    const el = end.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void loadMore(), {
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [s.next, s.loaded]);

  const setView_ = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* this device keeps the default */
    }
  };
  const openFolder = (path: string) => {
    setFolder(path);
    setSearched("");
    setQuery("");
    setSort("");
  };
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
    setSort("");
  };
  const filtered = Boolean(searched || kind || dept);
  const opened = s.files.find((f) => f.id === open) ?? null;
  const path = crumbs(folder);

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
          <span className="sr-only">Search files and folders</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setSearched("");
            }}
            placeholder="Search names and what's in them, e.g. sunrise with a Porsche"
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {folder ? (
        <div className="segmented files-scope" role="group" aria-label="Where to search">
          <button type="button" aria-pressed={!here} onClick={() => setHere(false)}>
            Everywhere
          </button>
          <button type="button" aria-pressed={here} onClick={() => setHere(true)}>
            {`Only in “${folder.split("/").at(-1)}”`}
          </button>
        </div>
      ) : null}

      <nav className="crumbs" aria-label="Where you are">
        <ol>
          {path.map((c, i) => (
            <li key={c.path || "top"}>
              {i === path.length - 1 && !searching ? (
                <span aria-current="page">{c.name}</span>
              ) : (
                <button type="button" className="linkish" onClick={() => openFolder(c.path)}>
                  {c.name}
                </button>
              )}
            </li>
          ))}
          {searching ? <li aria-current="page">{`Results for “${searched}”`}</li> : null}
        </ol>
      </nav>

      <div className="files-filters">
        <div className="segmented" role="group" aria-label="Kind of file">
          {KINDS.map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
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
        <label className="field">
          Sort
          <Select value={sortValue} onChange={(e) => setSort(e.target.value)}>
            {SORTS.filter((o) => !o.search || searching).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <div className="segmented files-view" role="group" aria-label="Show as">
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView_("grid")}>
            Grid
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView_("list")}>
            List
          </button>
        </div>
        {filtered ? (
          <Button
            variant="quiet"
            onClick={() => {
              setQuery("");
              setSearched("");
              setKind("");
              setDept("");
              setSort("");
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
        <Banner tone="bad" action={{ label: "Try again", onClick: () => void loadFiles(params) }}>
          {`Your files did not load: ${s.loadError}`}
        </Banner>
      ) : null}
      {!s.loaded && !s.loadError ? <Loading what="your files" /> : null}

      {(searching ? s.foundFolders.map((p) => ({ name: p, path: p, files: -1 })) : s.subfolders).length ? (
        <ul className="files-folders" aria-label={searching ? "Folders that match" : "Folders"}>
          {(searching ? s.foundFolders.map((p) => ({ name: p, path: p, files: -1 })) : s.subfolders).map((f) => (
            <li key={f.path}>
              <button type="button" className="folder-tile" onClick={() => openFolder(f.path)}>
                <span className="folder-icon" aria-hidden="true">
                  📁
                </span>
                <span className="file-name">{f.name}</span>
                {f.files >= 0 ? (
                  <span className="mute file-meta">{f.files === 1 ? "1 file" : `${f.files} files`}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {s.loaded && !s.files.length && !s.subfolders.length && !filtered && !folder ? (
        <p className="empty">Nothing here yet. Drop a photo, a video or a PDF above.</p>
      ) : null}
      {s.loaded && !s.files.length && (filtered || folder) && !s.foundFolders.length && !s.subfolders.length ? (
        <p className="empty">
          {searched ? `Nothing matches “${searched}”.` : "No files here."}{" "}
          {searched ? "Try other words, or search everywhere." : "Drop some in, or go back up."}
        </p>
      ) : null}
      {s.loaded && s.files.length ? (
        <p className="mute files-count" aria-live="polite">
          {searching
            ? `${s.count === 1 ? "1 file matches" : `${s.count} files match`} “${searched}”`
            : `${s.count === 1 ? "1 file" : `${s.count} files`}${folder ? ` in “${folder}”` : ""}`}
        </p>
      ) : null}

      {view === "grid" ? (
        <ul className="files-grid" aria-label="Your files">
          {s.files.map((f) => {
            const local = s.localError[f.id];
            return (
              <li key={f.id}>
                <button type="button" className="file-tile" onClick={() => setOpen(f.id)} aria-label={`Open ${f.name}`}>
                  <span className="file-thumb" aria-hidden="true">
                    <FileThumb f={f} />
                  </span>
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta mute">
                    {[
                      searching || f.folder !== folder ? `in ${f.folder || "Files"}` : "",
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
      ) : (
        <ul className="files-list" aria-label="Your files">
          {s.files.map((f) => {
            const local = s.localError[f.id];
            return (
              <li key={f.id}>
                <button type="button" className="file-row" onClick={() => setOpen(f.id)} aria-label={`Open ${f.name}`}>
                  <span className="file-row-thumb" aria-hidden="true">
                    <FileThumb f={f} />
                  </span>
                  <span className="file-row-main">
                    <span className="file-name">{f.name}</span>
                    <span className="file-meta mute">
                      {searching || f.folder !== folder ? `in ${f.folder || "Files"} · ` : ""}
                      {byWords(f)}
                    </span>
                  </span>
                  <span className="file-row-col mute">{KIND_WORD[f.kind] ?? "File"}</span>
                  <span className="file-row-col mute">{sizeWords(f.size_bytes)}</span>
                  <span className="file-row-col mute">{dateWords(f.taken_at || f.created_at)}</span>
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
      )}
      <div ref={end} className="files-end" aria-hidden="true" />
      {s.next !== null ? (
        <div className="files-more">
          <Button variant="quiet" onClick={() => loadMore()}>
            {s.loadingMore ? "Loading more…" : `Show more (${s.count - s.files.length} left)`}
          </Button>
        </div>
      ) : null}

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
  // Focus once, when the sheet opens: the props are a new object on every render, so focusing in the effect
  // below took the cursor out of the note field on every keystroke's re-render.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !confirming && onClose.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [confirming]);

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

/** A tile's picture. A photo shows frosted glass (over a very blurred copy while this browser uploads it) with a
 *  light sweeping across, until its thumbnail has loaded; then it comes into focus (the owner, 2026-11-10). */
function FileThumb({ f }: { f: StoredFile }) {
  const [shown, setShown] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const ghost = localPreview(f.id);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setShown(true);
  }, [f.thumb_url]);
  if (f.kind !== "image" && !f.thumb_url) return <span>{ICON[f.kind] ?? ICON.other}</span>;
  if (f.kind !== "image")
    return <img src={f.thumb_url} alt="" loading="lazy" decoding="async" />;
  return (
    <span className={`thumb-glass${shown ? " shown" : ""}`} data-state={shown ? "shown" : "loading"}>
      {ghost ? <img className="thumb-ghost" src={ghost} alt="" /> : null}
      <span className="thumb-frost" />
      {f.thumb_url ? (
        <img
          ref={img}
          className="thumb-real"
          src={f.thumb_url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => {
            setShown(true);
            setTimeout(() => dropPreview(f.id), 900); // after the photo has come into focus
          }}
        />
      ) : null}
    </span>
  );
}
