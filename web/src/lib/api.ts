// The HTTP API with the owner's token. Errors become plain sentences with a hint, never codes.
import { idToken } from "./auth.ts";
import { config } from "./config.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fix: string | null = null,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await idToken();
  if (!token) throw new ApiError("You were signed out.", 401, "Sign in again.");
  let r: Response;
  try {
    r = await fetch(`${config().apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("No connection to AI City right now.", 0, "Check your connection; we'll keep trying.");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string; fix?: string | null };
  // Some routes answer {error: code, message: plain words}; the words are what the owner reads.
  if (!r.ok) throw new ApiError(j.message || j.error || "Something went wrong.", r.status, j.fix ?? null);
  return j as T;
}

// ---------- knowledge base (docs/KNOWLEDGE.md §5) ----------
export type Scope = "always" | "relevant" | "on_request";
export type KnowledgeKind = "text" | "document" | "image" | "audio" | "video" | "link" | "other";
export type KnowledgeStatus = "uploading" | "processing" | "ready" | "failed" | "unsupported";
export interface KnowledgeItem {
  id: string;
  /** The built-in AI City guide: always there, read-only (no scope, place, delete). */
  builtin?: boolean;
  kind: KnowledgeKind;
  title: string;
  scope: Scope;
  status: KnowledgeStatus;
  source?: string;
  content_type?: string;
  size_bytes?: number;
  error?: string | null;
  warning?: string | null;
  summary?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Where and when it holds (docs/KNOWLEDGE.md §15): found on ingest, editable by the owner. */
  jurisdictions?: string[];
  year?: number | null;
  in_force_from?: string | null;
  in_force_to?: string | null;
  topic?: string | null;
  doc_type?: string | null;
  language?: string | null;
  meta_source?: "detected" | "owner";
  folder?: string;
  /** A newer item for the same place and topic (this one stays, marked). */
  superseded_by?: string;
  /** The site's tenant key (its domain) when a link's brand and site profile was captured (§16). */
  brand?: string;
  site_profile?: SiteProfile;
}
export interface PaletteColor {
  role: string;
  hex: string;
  note?: string;
}
/** A link's design and content, read from its HTML and CSS (docs/KNOWLEDGE.md §16). All of it is site data. */
export interface SiteProfile {
  url: string;
  brand: string;
  captured_at: string;
  profile: {
    name: string;
    kind: string;
    what_it_is?: string;
    audience?: string;
    offerings?: string[];
    key_facts?: string[];
    palette?: PaletteColor[];
    typography?: { heading?: string; body?: string; notes?: string };
    tone_of_voice?: string;
    layout_patterns?: string[];
    store?: { categories?: string[]; price_range?: string };
    paper?: { title?: string; authors?: string[]; abstract?: string; findings?: string[] };
    docs?: { product?: string; concepts?: string[] };
  };
  design: {
    colors: {
      primary?: string | null;
      accent?: string | null;
      background?: string | null;
      text?: string | null;
      most_used?: string[];
    };
    fonts: { heading?: string; body?: string; families?: string[] };
    logo_url?: string;
    scheme?: string;
    radius?: string[];
  };
  pages?: Array<{ url: string; title: string }>;
  logo_data?: string;
}
export interface KnowledgePlace {
  jurisdictions?: string[];
  year?: number | null;
  topic?: string | null;
  doc_type?: string | null;
}
export type UploadTicket =
  | { method: "PUT"; url: string; headers: Record<string, string> }
  | { multipart: true; upload_id: string; part_size: number; part_urls: string[] };

export const knowledgeApi = {
  list: () => api<{ items: KnowledgeItem[]; always_tokens: number; always_budget: number }>("/knowledge"),
  startUpload: (body: {
    file_name: string;
    content_type: string;
    size_bytes: number;
    title?: string;
    scope?: Scope;
    folder?: string;
  }) => api<{ item: KnowledgeItem; upload: UploadTicket }>("/knowledge/uploads", { method: "POST", body }),
  completeUpload: (id: string, body: { upload_id: string; parts: Array<{ part_number: number; etag: string }> }) =>
    api<{ item: KnowledgeItem }>(`/knowledge/uploads/${id}/complete`, { method: "POST", body }),
  addLink: (url: string, scope?: Scope) =>
    api<{ item: KnowledgeItem }>("/knowledge/links", { method: "POST", body: { url, scope } }),
  addText: (text: string, title: string, scope?: Scope) =>
    api<{ item: KnowledgeItem }>("/knowledge/text", { method: "POST", body: { text, title, scope } }),
  update: (id: string, patch: { scope?: Scope; title?: string } & KnowledgePlace) =>
    api<{ item: KnowledgeItem }>(`/knowledge/${id}`, { method: "PUT", body: patch }),
  remove: (id: string) => api<{ ok: true }>(`/knowledge/${id}`, { method: "DELETE" }),
};
