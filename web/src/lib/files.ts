// Files (docs/FILES.md): the owner's storage for photos, videos, PDFs and anything else, which the departments
// read and write. The screen's state is a pure reducer (tested) behind a tiny store; the WebSocket's
// "files.updated" events and the API write to it. Uploads go straight to S3 with presigned URLs (one PUT up to
// 100 MB, else multipart), like Knowledge's.
import { useSyncExternalStore } from "react";
import { api, ApiError, type UploadTicket } from "./api.ts";
import { folderOf, sendBytes, type PutFn } from "./upload.ts";

export type FileKind = "image" | "video" | "audio" | "document" | "text" | "other";
export type FileStatus = "uploading" | "processing" | "ready" | "failed";

export interface StoredFile {
  id: string;
  name: string;
  kind: FileKind;
  content_type: string;
  size_bytes: number;
  folder: string;
  tags: string[];
  note?: string;
  description?: string;
  status: FileStatus;
  error?: string | null;
  warning?: string | null;
  added_by?: string;
  department?: string;
  taken_at?: string;
  created_at: string;
  object_key?: string;
  /** Short-lived addresses (15 minutes): to show it, to save it, and its thumbnail. */
  url?: string;
  download_url?: string;
  thumb_url?: string;
  score?: number;
}

/** What a chat line keeps of a file VAIC showed (addresses are fetched fresh when drawn). */
export interface FileCardData {
  id: string;
  name: string;
  kind: FileKind;
  content_type?: string;
  size_bytes?: number;
  description?: string;
  department?: string;
  taken_at?: string;
  created_at?: string;
}

export const MAX_FILE_BYTES = 50 * 1024 ** 3;
const LINK_MS = 14 * 60_000;

export const filesApi = {
  list: (q: Record<string, string> = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
    return api<{ files: StoredFile[]; folders: string[]; departments: string[]; total: number }>(
      `/files${qs ? `?${qs}` : ""}`,
    );
  },
  get: (id: string) => api<StoredFile>(`/files/${id}`),
  startUpload: (body: {
    file_name: string;
    content_type: string;
    size_bytes: number;
    folder?: string;
    taken_at?: number;
  }) => api<{ file: StoredFile; upload: UploadTicket }>("/files/uploads", { method: "POST", body }),
  completeUpload: (id: string, body: { upload_id: string; parts: Array<{ part_number: number; etag: string }> }) =>
    api<{ file: StoredFile }>(`/files/uploads/${id}/complete`, { method: "POST", body }),
  update: (id: string, body: { name?: string; folder?: string; tags?: string[]; note?: string; taken_at?: string }) =>
    api<{ file: StoredFile }>(`/files/${id}`, { method: "PUT", body }),
  remove: (id: string) => api<{ ok: true }>(`/files/${id}`, { method: "DELETE" }),
  retry: (id: string) => api<{ file: StoredFile }>(`/files/${id}/retry`, { method: "POST" }),
};

// ---------- the screen's state ----------
export interface FilesState {
  files: StoredFile[];
  folders: string[];
  departments: string[];
  loaded: boolean;
  loadError: string | null;
  /** Upload percent per file id, while this browser is sending it. */
  progress: Record<string, number>;
  /** An upload that stopped here, with the reason, per file id. */
  localError: Record<string, string>;
}

export type FilesAction =
  | { type: "loaded"; files: StoredFile[]; folders: string[]; departments: string[] }
  | { type: "load_failed"; error: string }
  | { type: "upsert"; file: StoredFile }
  | {
      type: "files.updated";
      id: string;
      status: FileStatus | "deleted";
      name?: string;
      kind?: FileKind;
      folder?: string;
      department?: string;
      error?: string | null;
    }
  | { type: "progress"; id: string; percent: number }
  | { type: "upload_failed"; id: string; error: string }
  | { type: "removed"; id: string };

export const initialFiles = (): FilesState => ({
  files: [],
  folders: [],
  departments: [],
  loaded: false,
  loadError: null,
  progress: {},
  localError: {},
});

const without = <T>(r: Record<string, T>, id: string) => {
  if (!(id in r)) return r;
  const next = { ...r };
  delete next[id];
  return next;
};

const addFolder = (folders: string[], f?: string) => (f && !folders.includes(f) ? [...folders, f].sort() : folders);

export function reduceFiles(s: FilesState, a: FilesAction): FilesState {
  switch (a.type) {
    case "loaded":
      return { ...s, files: a.files, folders: a.folders, departments: a.departments, loaded: true, loadError: null };
    case "load_failed":
      return { ...s, loadError: a.error };
    case "upsert": {
      const i = s.files.findIndex((x) => x.id === a.file.id);
      const files = i < 0 ? [a.file, ...s.files] : s.files.map((x, j) => (j === i ? { ...x, ...a.file } : x));
      const left = a.file.status !== "uploading";
      return {
        ...s,
        files,
        folders: addFolder(s.folders, a.file.folder),
        progress: left ? without(s.progress, a.file.id) : s.progress,
      };
    }
    case "files.updated": {
      const status = a.status;
      if (status === "deleted") return reduceFiles(s, { type: "removed", id: a.id });
      const i = s.files.findIndex((x) => x.id === a.id);
      if (i < 0) return s; // a file this page hasn't listed yet: the next load brings it with its addresses
      const files = s.files.map((x, j) =>
        j === i
          ? {
              ...x,
              status,
              ...(a.name ? { name: a.name } : {}),
              ...(a.folder !== undefined ? { folder: a.folder } : {}),
              error: a.error ?? null,
            }
          : x,
      );
      return {
        ...s,
        files,
        folders: addFolder(s.folders, a.folder),
        progress: status !== "uploading" ? without(s.progress, a.id) : s.progress,
      };
    }
    case "progress":
      return { ...s, progress: { ...s.progress, [a.id]: a.percent } };
    case "upload_failed":
      return { ...s, localError: { ...s.localError, [a.id]: a.error }, progress: without(s.progress, a.id) };
    case "removed":
      return {
        ...s,
        files: s.files.filter((x) => x.id !== a.id),
        progress: without(s.progress, a.id),
        localError: without(s.localError, a.id),
      };
  }
}

class FilesStore {
  state = initialFiles();
  private listeners = new Set<() => void>();
  /** Files whose description just finished: the screen reloads them to get their thumbnail and addresses. */
  private refresh = new Set<string>();
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  get = () => this.state;
  dispatch = (a: FilesAction) => {
    this.state = reduceFiles(this.state, a);
    for (const l of this.listeners) l();
  };
  /** WebSocket events. */
  event(e: { type: string; [k: string]: unknown }) {
    if (e.type !== "files.updated") return;
    this.dispatch(e as unknown as FilesAction);
    const id = String(e.id ?? "");
    if ((e.status === "ready" || e.status === "failed") && this.state.files.some((f) => f.id === id)) {
      this.refresh.add(id);
      void this.refreshOne(id);
    }
  }
  private async refreshOne(id: string) {
    try {
      const f = await filesApi.get(id);
      this.dispatch({ type: "upsert", file: f });
    } catch {
      /* the next load brings it */
    } finally {
      this.refresh.delete(id);
    }
  }
}

export const files = new FilesStore();
export const useFiles = <T>(pick: (s: FilesState) => T): T =>
  useSyncExternalStore(files.subscribe, () => pick(files.get()));

export async function loadFiles(q: Record<string, string> = {}) {
  try {
    const r = await filesApi.list(q);
    files.dispatch({ type: "loaded", files: r.files, folders: r.folders, departments: r.departments });
  } catch (e) {
    files.dispatch({ type: "load_failed", error: (e as Error).message });
  }
}

// ---------- uploads ----------
export interface FileUploadOptions {
  folder?: string;
  onCreated?: (f: StoredFile) => void;
  onProgress?: (percent: number) => void;
  put?: PutFn;
  start?: typeof filesApi.startUpload;
  complete?: typeof filesApi.completeUpload;
  retryDelayMs?: number;
}

export class FileUploadError extends Error {
  constructor(
    message: string,
    readonly file: StoredFile | null,
  ) {
    super(message);
  }
}

/** One file to Files: the record first (so it shows at once), then the bytes straight to S3. */
export async function uploadToFiles(file: File, o: FileUploadOptions = {}): Promise<StoredFile> {
  const folder = o.folder ?? folderOf(file);
  const { file: rec, upload } = await (o.start ?? filesApi.startUpload)({
    file_name: file.name,
    content_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    ...(folder ? { folder } : {}),
    // When the device last changed it: for a photo straight from a phone, about when it was taken.
    ...(file.lastModified ? { taken_at: file.lastModified } : {}),
  });
  o.onCreated?.(rec);
  try {
    const parts = await sendBytes(file, upload, {
      onProgress: o.onProgress,
      put: o.put,
      retryDelayMs: o.retryDelayMs,
    });
    if (!parts) return rec;
    return (await (o.complete ?? filesApi.completeUpload)(rec.id, parts)).file;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new FileUploadError(
      `The upload of “${file.name}” stopped (${why}). Check your connection and try again.`,
      rec,
    );
  }
}

/** Uploads many files at once (two at a time); returns the problems in plain words. */
export async function addToFiles(list: File[], folder = ""): Promise<string[]> {
  const problems: string[] = [];
  const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
  for (const f of tooBig) problems.push(`“${f.name}” is larger than 50 GB.`);
  const empty = list.filter((f) => f.size === 0);
  for (const f of empty) problems.push(`“${f.name}” is empty.`);
  const queue = list.filter((f) => f.size > 0 && f.size <= MAX_FILE_BYTES);
  const one = async (f: File) => {
    let id = "";
    try {
      await uploadToFiles(f, {
        folder: folder || undefined,
        onCreated: (rec) => {
          id = rec.id;
          files.dispatch({ type: "upsert", file: rec });
        },
        onProgress: (percent) => id && files.dispatch({ type: "progress", id, percent }),
      });
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message}${e.fix ? ` ${e.fix}` : ""}` : (e as Error).message;
      if (id) files.dispatch({ type: "upload_failed", id, error: msg });
      problems.push(msg);
    }
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (next < queue.length) await one(queue[next++]!);
    }),
  );
  return problems;
}

// ---------- words ----------
export const KIND_WORD: Record<FileKind, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  text: "Text",
  other: "File",
};

export function sizeWords(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function dateWords(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The status in plain words, with progress while this browser uploads. */
export function fileStatusWords(f: StoredFile, percent?: number, localError?: string): string {
  if (localError) return `Failed: ${localError}`;
  switch (f.status) {
    case "uploading":
      return percent === undefined ? "Uploading" : `Uploading ${percent} %`;
    case "processing":
      return f.kind === "video" || f.kind === "audio"
        ? "Watching and listening"
        : f.kind === "image"
          ? "Looking at it"
          : "Reading it";
    case "ready":
      return "Ready";
    case "failed":
      return `Failed: ${f.error || "it couldn't be described. Use Try again."}`;
  }
}

/** Who put it there: "You" or the department. */
export const byWords = (f: { added_by?: string; department?: string }) =>
  f.added_by === "owner" || !f.added_by ? "You" : f.department || "A department";

/** A fresh copy of a file with live addresses (they last 15 minutes; refetched after 14). */
const fresh = new Map<string, { at: number; file: Promise<StoredFile> }>();
export function withLinks(id: string, now = Date.now()): Promise<StoredFile> {
  const hit = fresh.get(id);
  if (hit && now - hit.at < LINK_MS) return hit.file;
  const file = filesApi.get(id);
  fresh.set(id, { at: now, file });
  file.catch(() => fresh.delete(id));
  return file;
}
