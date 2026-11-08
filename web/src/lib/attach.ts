// The + menu's brains (docs/PRODUCT.md, "The + menu"): slash commands that become plain sentences for AIC,
// and files attached to a message, which go into the knowledge base so AIC can read them. Pure functions
// (tested); the menu itself is in components/PlusMenu.tsx.
import type { KnowledgeItem } from "./api.ts";
import { listConnectors, listSkills, type Connector, type Skill } from "./connect.ts";

export interface SlashCommand {
  /** Typed after the slash: `/status`. */
  name: string;
  /** What it does, in the menu. */
  hint: string;
  /** What AIC is sent; `$1` is the words typed after the command. Null: handled by the HUD itself (/clear). */
  says: string | null;
  /** Named when the command needs words after it ("service" for /connect). */
  arg?: string;
  /** A skill the owner added (listed under Plugins too). */
  skill?: boolean;
}

export const BUILT_IN: SlashCommand[] = [
  { name: "status", hint: "How the city is doing", says: "What's the status of the city?" },
  { name: "stop", hint: "Stop the current job", says: "Stop the current job." },
  { name: "home", hint: "Send every worker home", says: "Send everyone home." },
  { name: "knowledge", hint: "What's in my knowledge base", says: "What's in my knowledge base?" },
  { name: "connect", hint: "Add a connector", arg: "service", says: "Add $1 as a connector." },
  { name: "clear", hint: "Clear this conversation on this device", says: null },
];

/** Every enabled skill as a command: `/pdf-report make one for Q3` → "Use the “pdf-report” skill: …". */
export const skillCommands = (skills: Skill[]): SlashCommand[] =>
  skills
    .filter((s) => s.enabled)
    .map((s) => ({
      name: s.name,
      hint: s.description || "A skill you added",
      arg: "what to do",
      says: `Use the “${s.name}” skill: $1`,
      skill: true,
    }));

export const allCommands = (skills: Skill[]): SlashCommand[] => [...BUILT_IN, ...skillCommands(skills)];

/** The commands the box is naming so far: `/` lists all, `/st` lists /status and /stop; anything else none. */
export function matchCommands(text: string, commands: SlashCommand[]): SlashCommand[] {
  const m = /^\/([a-z0-9-]*)$/i.exec(text);
  if (!m) return [];
  const typed = m[1]!.toLowerCase();
  return commands.filter((c) => c.name.startsWith(typed));
}

export type Slash =
  { kind: "send"; text: string } | { kind: "clear" } | { kind: "needs"; command: SlashCommand } | null;

/** What a message starting with a slash means. Null: not a command the HUD knows; it is sent as typed. */
export function expandSlash(text: string, commands: SlashCommand[]): Slash {
  const m = /^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return null;
  const command = commands.find((c) => c.name === m[1]!.toLowerCase());
  if (!command) return null;
  if (command.says === null) return { kind: "clear" };
  const rest = (m[2] ?? "").trim();
  if (command.arg && !rest) return { kind: "needs", command };
  const said = command.says.includes("$1") ? command.says.replace("$1", rest) : command.says;
  return { kind: "send", text: command.arg || !rest ? said : `${said} ${rest}` };
}

// ---------- attachments ----------
export const MAX_FOLDER_FILES = 100;

/** The files a folder picker gave, without hidden files and folders, at most MAX_FOLDER_FILES. */
export function folderFiles(list: File[]): { files: File[]; hidden: number; skipped: number } {
  const shown = list.filter((f) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return !path.split("/").some((part) => part.startsWith("."));
  });
  return {
    files: shown.slice(0, MAX_FOLDER_FILES),
    hidden: list.length - shown.length,
    skipped: Math.max(0, shown.length - MAX_FOLDER_FILES),
  };
}

/** A message may go once every attachment has left the browser (processing can finish while AIC reads). */
export const sendable = (items: KnowledgeItem[]) => items.every((i) => i.status !== "uploading");

/** The line under a message that names what was attached, so AIC knows where to look. */
export function attachedLine(items: KnowledgeItem[]): string {
  const one = (i: KnowledgeItem) => {
    const state =
      i.status === "ready"
        ? "ready"
        : i.status === "failed"
          ? "failed to process"
          : i.status === "unsupported"
            ? "stored, but cannot be searched"
            : "still being prepared";
    return `“${i.title}” (${i.kind}, ${state})`;
  };
  return `Attached (now in my knowledge base): ${items.map(one).join("; ")}.`;
}

// ---------- the lists the menu shows ----------
export interface Lists {
  skills: Skill[];
  connectors: Connector[];
}
let lists: Promise<Lists> | null = null;
/** Skills and connectors, read once per page (`fresh` reads again). Missing pieces come back empty. */
export function loadLists(fresh = false): Promise<Lists> {
  if (fresh) lists = null;
  lists ??= Promise.all([
    listSkills().then(
      (r) => r.skills,
      () => [] as Skill[],
    ),
    listConnectors().then(
      (r) => r.connectors,
      () => [] as Connector[],
    ),
  ]).then(([skills, connectors]) => ({ skills, connectors }));
  return lists;
}
