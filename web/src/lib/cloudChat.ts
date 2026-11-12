// Chats live on the server (decision 299): every line the owner sends and every reply VAIC finishes is kept there
// (`GET /conversations/<id>/lines`), so a chat looks the same on every device. This device's copy is only a cache:
// on open and on return, the server's lines that this device doesn't have yet are added, matched by who and text,
// so a reconnect never shows a line twice.
import { api } from "./api.ts";

export interface ServerLine {
  id: string;
  who: "owner" | "vaic";
  text: string;
  at: string;
}

export async function loadLines(conversation: string): Promise<ServerLine[] | null> {
  try {
    const r = await api<{ lines?: ServerLine[] }>(`/conversations/${encodeURIComponent(conversation)}/lines`);
    return (r.lines ?? []).filter(
      (l) => l && typeof l.text === "string" && (l.who === "owner" || l.who === "vaic") && typeof l.id === "string",
    );
  } catch {
    return null; // offline or not deployed yet: the cache stands
  }
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

interface LineLike {
  id: string;
  who: string;
  text: string;
  at: number;
  state: string;
}

/**
 * This device's lines plus the server's lines it doesn't have, oldest first. A server line matches a local line
 * with the same speaker and words (each local line matches once). VAIC's server lines from after a reply this
 * device is still streaming are left out: that reply finishes here.
 */
export function mergeLines<L extends LineLike>(
  local: L[],
  server: ServerLine[],
  make: (s: ServerLine, who: "owner" | "vaic") => L,
  vaicWho: L["who"],
): L[] {
  const pool = new Map<string, number>();
  const key = (who: string, text: string) => `${who === vaicWho ? "vaic" : who}\u0000${norm(text)}`;
  for (const l of local) if (l.text) pool.set(key(l.who, l.text), (pool.get(key(l.who, l.text)) ?? 0) + 1);
  const streaming = local.find((l) => l.state === "streaming")?.at ?? Infinity;
  const added: L[] = [];
  for (const s of server) {
    const k = key(s.who, s.text);
    const n = pool.get(k) ?? 0;
    if (n > 0) {
      pool.set(k, n - 1);
      continue;
    }
    const line = make(s, s.who);
    if (s.who === "vaic" && line.at >= streaming - 2000) continue;
    added.push(line);
  }
  if (!added.length) return local;
  return [...local, ...added].sort((a, b) => a.at - b.at);
}

/** The local lines the server doesn't have (the one-time upload of a device's older chats). */
export function missingOnServer<L extends LineLike>(local: L[], server: ServerLine[], vaicWho: L["who"]): L[] {
  const pool = new Map<string, number>();
  for (const s of server)
    pool.set(`${s.who}\u0000${norm(s.text)}`, (pool.get(`${s.who}\u0000${norm(s.text)}`) ?? 0) + 1);
  return local.filter((l) => {
    if (!l.text.trim() || (l.state !== "done" && l.state !== "sent")) return false;
    const k = `${l.who === vaicWho ? "vaic" : l.who}\u0000${norm(l.text)}`;
    const n = pool.get(k) ?? 0;
    if (n > 0) {
      pool.set(k, n - 1);
      return false;
    }
    return true;
  });
}
