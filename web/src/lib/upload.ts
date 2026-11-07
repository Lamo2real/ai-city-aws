// Uploads one file to the knowledge bucket with presigned URLs (docs/KNOWLEDGE.md §5): one PUT up to
// 100 MB, otherwise multipart (parts PUT in parallel, each retried, then "complete" with the ETags).
// Progress is reported in whole percent of the file's bytes.
import { knowledgeApi, type KnowledgeItem, type Scope } from "./api.ts";

/** PUTs a body to a presigned URL and resolves with the response's ETag. */
export type PutFn = (
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
) => Promise<string>;

export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3;

export class UploadError extends Error {
  constructor(
    message: string,
    /** The item, when the server had already created it (its status stays "uploading"). */
    readonly item: KnowledgeItem | null,
  ) {
    super(message);
  }
}

export const xhrPut: PutFn = (url, body, headers, onProgress) =>
  new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== "content-length") x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () =>
      x.status >= 200 && x.status < 300
        ? resolve(x.getResponseHeader("ETag") ?? "")
        : reject(new Error(`storage answered ${x.status}`));
    x.onerror = () => reject(new Error("network"));
    x.onabort = () => reject(new Error("aborted"));
    x.send(body);
  });

export interface UploadOptions {
  scope?: Scope;
  title?: string;
  /** Called as soon as the server has created the item, before any bytes are sent. */
  onCreated?: (item: KnowledgeItem) => void;
  onProgress?: (percent: number) => void;
  put?: PutFn;
  start?: typeof knowledgeApi.startUpload;
  complete?: typeof knowledgeApi.completeUpload;
  /** Parts in flight at once (multipart). */
  concurrency?: number;
  /** Extra tries per part (and for a single PUT). */
  retries?: number;
  retryDelayMs?: number;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadFile(file: File, o: UploadOptions = {}): Promise<KnowledgeItem> {
  const put = o.put ?? xhrPut;
  const retries = o.retries ?? 3;
  const delay = o.retryDelayMs ?? 1000;
  const { item, upload } = await (o.start ?? knowledgeApi.startUpload)({
    file_name: file.name,
    content_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    ...(o.title ? { title: o.title } : {}),
    ...(o.scope ? { scope: o.scope } : {}),
  });
  o.onCreated?.(item);

  const total = Math.max(1, file.size);
  let lastPct = -1;
  const report = (loaded: number) => {
    const pct = Math.min(100, Math.floor((loaded / total) * 100));
    if (pct !== lastPct) o.onProgress?.((lastPct = pct));
  };
  const withRetry = async (url: string, body: Blob, headers: Record<string, string>, on: (n: number) => void) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await put(url, body, headers, on);
      } catch (e) {
        on(0);
        if (attempt >= retries) throw e;
        await wait(delay * 2 ** attempt);
      }
    }
  };

  try {
    if ("method" in upload) {
      await withRetry(upload.url, file, upload.headers, report);
      report(total);
      return item;
    }
    const loaded = upload.part_urls.map(() => 0);
    const etags: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < upload.part_urls.length) {
        const i = next++;
        const body = file.slice(i * upload.part_size, Math.min(file.size, (i + 1) * upload.part_size));
        etags[i] = await withRetry(upload.part_urls[i]!, body, {}, (n) => {
          loaded[i] = n;
          report(loaded.reduce((a, b) => a + b, 0));
        });
        loaded[i] = body.size;
        report(loaded.reduce((a, b) => a + b, 0));
      }
    };
    const n = Math.max(1, Math.min(o.concurrency ?? 4, upload.part_urls.length));
    await Promise.all(Array.from({ length: n }, worker));
    const done = await (o.complete ?? knowledgeApi.completeUpload)(item.id, {
      upload_id: upload.upload_id,
      parts: etags.map((etag, i) => ({ part_number: i + 1, etag })),
    });
    return done.item;
  } catch {
    throw new UploadError(`The upload of “${file.name}” did not finish. Check your connection and add it again.`, item);
  }
}
