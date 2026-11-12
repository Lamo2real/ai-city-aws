// Where the chat's image thumbnails come from (decision 256): the file on this device while it uploads and for
// the rest of the page's life, and after a reload a short-lived signed address of the knowledge item's original
// (GET /knowledge/{id}/download), read again before it runs out.
import { useEffect, useState } from "react";
import { knowledgeApi } from "./api.ts";

const local = new Map<string, string>();
const remote = new Map<string, { url: Promise<string>; until: number }>();

/** Keeps a preview of an image this device is attaching, so it shows at once, before the upload ends. */
export function keepLocal(id: string, file: File) {
  if (!file.type.startsWith("image/") || local.has(id) || typeof URL.createObjectURL !== "function") return;
  local.set(id, URL.createObjectURL(file));
}
/** The image was taken off the message before it was sent. */
export function forgetLocal(id: string) {
  const u = local.get(id);
  if (!u) return;
  local.delete(id);
  URL.revokeObjectURL(u);
}
export const localImage = (id: string) => local.get(id);

/** An address to draw the image at: the local file if this page has it, else a fresh signed address. */
export function imageUrl(id: string, now = Date.now()): Promise<string> {
  const mine = local.get(id);
  if (mine) return Promise.resolve(mine);
  const had = remote.get(id);
  if (had && had.until > now) return had.url;
  const url = knowledgeApi.download(id).then((t) => {
    // Read again a minute before it expires.
    remote.set(id, { url: Promise.resolve(t.url), until: Date.now() + Math.max(0, t.expires_in - 60) * 1000 });
    return t.url;
  });
  remote.set(id, { url, until: now + 30_000 });
  url.catch(() => remote.delete(id));
  return url;
}

/** The image's address for an <img>: undefined while it is being found, null when it cannot be shown. */
export function useImageUrl(id: string): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(() => local.get(id));
  useEffect(() => {
    let live = true;
    imageUrl(id).then(
      (u) => live && setUrl(u),
      () => live && setUrl(null),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}
