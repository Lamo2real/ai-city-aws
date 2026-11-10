// Connectors, mail and calendar accounts, and skills: the API calls, the checks the HUD makes before
// anything leaves the browser, and the guard that keeps keys out of the chat.
// Contracts: docs/CONNECTORS_SKILLS.md (§1.7, §2.3, §2.4, §3) and docs/MAIL_CALENDAR.md (§4, §7).
import { api } from "./api.ts";

export const ROLES = ["vaic", "orchestrator", "manager", "worker"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  vaic: "VAIC",
  orchestrator: "Orchestrator",
  manager: "Managers",
  worker: "Workers",
};

// ---------- connectors ----------
export interface Connector {
  id: string;
  label?: string;
  url?: string;
  transport?: "remote" | "package" | "openapi";
  auth?: "none" | "api_key" | "oauth" | "env";
  status: string;
  needs?: string;
  error?: string | null;
  roles?: Partial<Record<Role, "read" | "all">>;
  approval?: "destructive" | "writes" | "none";
  tools?: Array<{ name: string; read_only?: boolean; destructive?: boolean }>;
  package?: { name: string; version: string; secrets?: Array<{ name: string; description?: string }> };
  oauth?: { authorization_server?: string };
}
/** True when the connector's sign-in would be at github.com, so a GitHub token can stand in for it. */
export function githubSignIn(c: Connector): boolean {
  const server = c.oauth?.authorization_server ?? "";
  try {
    return new URL(server.includes("://") ? server : `https://${server}`).hostname === "github.com";
  } catch {
    return false;
  }
}
export const listConnectors = () => api<{ connectors: Connector[] }>("/connectors");
// ---------- pre-configured departments (decision 113) ----------
export interface PresetConnector {
  id: string;
  label: string;
  /** May hold a `{name}` the owner fills in (a Shopify store's name), described by `ask`. */
  url: string;
  what: string;
  essential: boolean;
  /** Where to create an account, when the service needs one. */
  signup?: string;
  /** Other names the owner may use for it ("jira" for Jira & Confluence). */
  aka?: string[];
  /** "own_app": its sign-in has no self-registration, so it takes the owner's app or an access token. */
  setup?: "own_app";
  ask?: { name: string; label: string; pattern: string };
}
export interface DepartmentPreset {
  key: string;
  name: string;
  mission: string;
  teams: Array<{ name: string; does: string }>;
  skills: Array<{ name: string; description: string }>;
  connectors: PresetConnector[];
}
export interface Presets {
  shared: Omit<DepartmentPreset, "key" | "teams">;
  departments: DepartmentPreset[];
}
export const listPresets = () => api<Presets>("/departments/presets");
/** A switch's server link with the owner's answer filled in (`{store}` → their store's name). */
export const fillUrl = (c: PresetConnector, answer: string) =>
  c.ask ? c.url.replace(`{${c.ask.name}}`, answer.trim().toLowerCase()) : c.url;
/** Whether a connector stands for this switch: the same link, or (with a `{name}` in it) the same pattern. */
export function matchesPreset(c: PresetConnector, url?: string): boolean {
  if (!url) return false;
  if (!c.ask) return sameServer(c.url, url);
  const [head, tail] = c.url.split(`{${c.ask.name}}`) as [string, string];
  const u = url.trim().toLowerCase();
  return u.startsWith(head.toLowerCase()) && u.replace(/\/+$/, "").endsWith(tail.toLowerCase().replace(/\/+$/, ""));
}
/** The connector a department's switch stands for: the same server link (a trailing slash doesn't matter). */
export const sameServer = (a?: string, b?: string) =>
  !!a && !!b && a.trim().replace(/\/+$/, "").toLowerCase() === b.trim().replace(/\/+$/, "").toLowerCase();

export const addConnectorByUrl = (url: string, label?: string) =>
  api<{ connector: Connector }>("/connectors", { method: "POST", body: { url, ...(label ? { label } : {}) } });
export const editConnector = (id: string, patch: Partial<Pick<Connector, "roles" | "approval" | "label">>) =>
  api<{ connector: Connector }>(`/connectors/${id}`, { method: "PUT", body: patch });
export const removeConnector = (id: string) => api(`/connectors/${id}`, { method: "DELETE" });
export const refreshConnector = (id: string) => api(`/connectors/${id}/refresh`, { method: "POST" });
export const sendConnectorKey = (id: string, body: Record<string, unknown>) =>
  api<{ ok: boolean }>(`/connectors/${id}/key`, { method: "PUT", body });

/** What a connector's status means for the owner, in plain words. */
export function connectorStatus(c: Connector): { text: string; tone: "good" | "warn" | "bad" | "info" } {
  switch (c.status) {
    case "ready":
      return { text: `On · ${c.tools?.length ?? 0} tools`, tone: "good" };
    case "needs_login":
      return { text: "Needs you to sign in", tone: "warn" };
    case "login_expired":
      return { text: "Sign in again", tone: "warn" };
    case "needs_key":
      return {
        text: c.needs === "oauth_client" ? "Needs its app's client id and secret" : "Needs its key",
        tone: "warn",
      };
    case "pending_approval":
      return { text: "Waiting for your approval", tone: "info" };
    case "error":
      return { text: c.error ?? "Something went wrong", tone: "bad" };
    default:
      return { text: "Setting up…", tone: "info" };
  }
}

// ---------- mail and calendar accounts ----------
export interface MailAccount {
  id: string;
  provider: "google" | "microsoft" | "imap";
  label: string;
  address: string;
  status: "signing_in" | "connected" | "needs_sign_in" | "error" | "removed";
  error?: string | null;
  color?: string;
  mail?: boolean;
  calendar?: boolean;
  calendars?: Array<{ id: string; name: string; hidden?: boolean }>;
  /** An app-password account standing in for Google/Microsoft sign-in: whose servers to fill in. */
  preset?: string;
}
export const PROVIDER_LABEL: Record<MailAccount["provider"], string> = {
  google: "Google",
  microsoft: "Microsoft",
  imap: "Mail server (IMAP)",
};
export const listMailAccounts = () => api<{ accounts: MailAccount[] }>("/mail/accounts");
export const addMailAccount = (provider: MailAccount["provider"], label: string) =>
  api<{ account: MailAccount }>("/mail/accounts", { method: "POST", body: { provider, label } });
export const editMailAccount = (id: string, patch: Record<string, unknown>) =>
  api<{ account: MailAccount }>(`/mail/accounts/${id}`, { method: "PUT", body: patch });
export const removeMailAccount = (id: string) =>
  api<{ ok: boolean; note?: string }>(`/mail/accounts/${id}`, { method: "DELETE" });
export interface ImapForm {
  address: string;
  username?: string;
  password: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  smtp_starttls: boolean;
  caldav_url?: string;
}
export const sendImapForm = (id: string, f: ImapForm) =>
  api<{ account: MailAccount }>(`/mail/accounts/${id}/imap`, { method: "POST", body: f });
export interface MailRule {
  id: string;
  kind: "send_to" | "accept_from";
  account_id: string;
  match: { addresses: string[]; domains: string[] };
}
export const listRules = () => api<{ rules: MailRule[] }>("/mail/rules");
export const addRule = (r: Omit<MailRule, "id">) => api<{ rule: MailRule }>("/mail/rules", { method: "POST", body: r });
export const removeRule = (id: string) => api(`/mail/rules/${id}`, { method: "DELETE" });

/** One line on getting the app password, per preset (shown above the form). */
export const APP_PASSWORD_HOWTO: Record<string, string> = {
  "Gmail (app password)":
    "Create an app password at myaccount.google.com/apppasswords (2-step verification must be on), then paste it here with your Gmail address.",
};
/** Presets for the app-password form (the owner can change every field). No Outlook.com: Microsoft turned off app
 * passwords for Outlook mail, so Outlook signs in with Microsoft (decision 163). */
export const IMAP_PRESETS: Record<string, Partial<ImapForm>> = {
  iCloud: {
    imap_host: "imap.mail.me.com",
    imap_port: 993,
    smtp_host: "smtp.mail.me.com",
    smtp_port: 587,
    smtp_starttls: true,
    caldav_url: "https://caldav.icloud.com/",
  },
  Fastmail: {
    imap_host: "imap.fastmail.com",
    imap_port: 993,
    smtp_host: "smtp.fastmail.com",
    smtp_port: 465,
    smtp_starttls: false,
    caldav_url: "https://caldav.fastmail.com/dav/calendars/",
  },
  Yahoo: {
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: 465,
    smtp_starttls: false,
  },
  "Gmail (app password)": {
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_starttls: false,
  },
};

// ---------- keys never go through chat ----------
const KEY_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bxox[abpors]-[A-Za-z0-9-]{10,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\btvly-[A-Za-z0-9_-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bya29\.[0-9A-Za-z_-]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const entropy = (s: string) => {
  const n = new Map<string, number>();
  for (const ch of s) n.set(ch, (n.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of n.values()) h -= (c / s.length) * Math.log2(c / s.length);
  return h;
};
/** True when a chat message looks like it carries a key, token or password (it is then not sent). */
export function looksLikeKey(text: string): boolean {
  if (KEY_PATTERNS.some((r) => r.test(text))) return true;
  return text
    .split(/\s+/)
    .some((w) => w.length >= 32 && !/^https?:\/\//.test(w) && /[A-Za-z]/.test(w) && /\d/.test(w) && entropy(w) > 4.0);
}

// ---------- skills ----------
export interface Skill {
  name: string;
  description: string;
  roles: Role[];
  enabled: boolean;
  version: string;
  files: Array<{ path: string; size: number }>;
  size_bytes: number;
  updated_at: string;
  /** "catalog" when it was added from Discover (decision 188); uploads and older skills say "upload" or nothing. */
  source?: "upload" | "catalog";
}
export const SKILL_LIMITS = { files: 100, bytes: 4 * 1024 * 1024, description: 1024, path: 200 };
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FORBIDDEN = /^(\.claude-plugin|hooks|\.mcp\.json|settings[^/]*\.json)$/i;

export interface SkillFile {
  path: string;
  bytes: Uint8Array;
}
/** The frontmatter fields of a SKILL.md and which ones the city will drop. */
export function readFrontmatter(md: string): { name?: string; description?: string; dropped: string[]; body: string } {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(md);
  if (!m) return { dropped: [], body: md };
  const out: { name?: string; description?: string; dropped: string[]; body: string } = {
    dropped: [],
    body: md.slice(m[0].length),
  };
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    const key = kv?.[1];
    if (!kv || !key) continue;
    const v = (kv[2] ?? "").trim().replace(/^["']|["']$/g, "");
    if (key === "name") out.name = v;
    else if (key === "description") out.description = v;
    else out.dropped.push(key);
  }
  return out;
}

/** The same checks as the API (CONNECTORS_SKILLS.md §2.3): a list of plain problems, empty when fine. */
export function checkSkill(files: SkillFile[], name?: string): string[] {
  const problems: string[] = [];
  const md = files.find((f) => f.path === "SKILL.md");
  if (!md) problems.push("A skill needs a SKILL.md file at its top level.");
  if (files.length > SKILL_LIMITS.files) problems.push(`A skill can have at most ${SKILL_LIMITS.files} files.`);
  const total = files.reduce((n, f) => n + f.bytes.length, 0);
  if (total > SKILL_LIMITS.bytes) problems.push("A skill can be at most 4 MB in total.");
  for (const f of files) {
    const parts = f.path.split("/");
    if (
      !f.path ||
      f.path.length > SKILL_LIMITS.path ||
      f.path.startsWith("/") ||
      f.path.includes("\\") ||
      parts.includes("..")
    )
      problems.push(`${f.path.slice(0, 80)} isn't a usable file path.`);
    else if (parts.some((p) => FORBIDDEN.test(p)))
      problems.push(
        `${f.path.slice(0, 80)} can't be part of a skill (plugin, hook, MCP and settings files are refused).`,
      );
  }
  if (md) {
    const fm = readFrontmatter(new TextDecoder().decode(md.bytes));
    const n = fm.name ?? name;
    if (!n || !NAME_RE.test(n))
      problems.push("The skill's name must be lowercase letters, digits and dashes (like pdf-report).");
    if (fm.name && name && fm.name !== name) problems.push("The name you typed doesn't match the name in SKILL.md.");
    if (!fm.description) problems.push("SKILL.md needs a description in its frontmatter.");
    else if (fm.description.length > SKILL_LIMITS.description)
      problems.push("The description is longer than 1,024 characters.");
  }
  return problems;
}

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const listSkills = () => api<{ skills: Skill[] }>("/skills");
export const getSkill = (name: string) => api<Skill & { skill_md: string }>(`/skills/${name}`);
export const uploadSkill = (files: SkillFile[], roles: Role[], name?: string) =>
  api<{ skill: Skill; removed_frontmatter: string[] }>("/skills", {
    method: "POST",
    body: {
      ...(name ? { name } : {}),
      roles,
      files: files.map((f) => ({ path: f.path, content_base64: b64(f.bytes) })),
    },
  });
export const editSkill = (name: string, patch: { roles?: Role[]; enabled?: boolean }) =>
  api<{ skill: Skill }>(`/skills/${name}`, { method: "PUT", body: patch });
export const removeSkill = (name: string) => api(`/skills/${name}`, { method: "DELETE" });

// ---------- Skills → Discover (decision 188) ----------
/** A skill the owner can add in one tap: the AI City catalog, or a department's built-in skill. */
export interface CatalogSkill {
  name: string;
  title: string;
  description: string;
  /** Who it is for (catalog) or who already uses it (built-in): the City's department names. */
  departments: string[];
  source: string;
  builtin: boolean;
  featured: boolean;
  files: number;
  added: boolean;
}
export const listSkillCatalog = () => api<{ skills: CatalogSkill[]; departments: string[] }>("/skills/catalog");
export const getCatalogSkill = (name: string) => api<CatalogSkill & { skill_md: string }>(`/skills/catalog/${name}`);
/** Adds it exactly as an upload would (same checks and storage); every role may use it unless roles say otherwise. */
export const addCatalogSkill = (name: string, roles?: Role[]) =>
  api<{ skill: Skill; removed_frontmatter: string[] }>(`/skills/catalog/${name}`, {
    method: "POST",
    body: roles ? { roles } : {},
  });
const EVERY = "Every department";
/** Discover's search and department filter: every word must match; "Every department" skills match any department. */
export function filterCatalog(list: CatalogSkill[], q: string, department: string | null): CatalogSkill[] {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const words = fold(q).split(/\s+/).filter(Boolean);
  return list.filter((s) => {
    if (department && !s.departments.includes(department) && !s.departments.includes(EVERY)) return false;
    const hay = fold([s.name, s.title, s.description, s.source, ...s.departments].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/** Files picked from a folder (webkitdirectory) or one SKILL.md, with the top folder name removed. */
export async function filesFromPicker(list: FileList | File[]): Promise<SkillFile[]> {
  const arr = Array.from(list);
  const strip = arr.length > 1 || (arr[0] as File & { webkitRelativePath?: string })?.webkitRelativePath?.includes("/");
  return Promise.all(
    arr.map(async (f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const path = strip ? rel.split("/").slice(1).join("/") || f.name : f.name;
      return { path, bytes: new Uint8Array(await f.arrayBuffer()) };
    }),
  );
}
