// Settings → Connectors (decision 129): what is connected and what can be added, department by department, built
// from the same answers the page already loads. The catalog is config/departments.json, served by
// GET /departments/presets: every server in it answered an MCP initialize when it was added. A department's kit is its
// skills and tools together. Logos are files in web/public/logos/ (scripts/fetch-logos.mjs), so the CSP stays 'self'.
import { useEffect, useState } from "react";
import { listPresets, matchesPreset, type Connector, type Presets, type PresetConnector } from "./connect.ts";
import logos from "./logos.json";

/** One service in the catalog, with the departments that list it. */
export interface CatalogItem extends PresetConnector {
  groups: string[];
}
export interface Kit {
  key: string;
  name: string;
  mission: string;
  skills: Array<{ name: string; description: string }>;
  connectors: PresetConnector[];
}

/** Every catalog service once, in the order the departments list them (shared tools first). */
export function catalogOf(p: Presets): CatalogItem[] {
  const out = new Map<string, CatalogItem>();
  for (const k of kitsOf(p))
    for (const c of k.connectors) {
      const have = out.get(c.id);
      if (have) {
        if (!have.groups.includes(k.name)) have.groups.push(k.name);
        have.essential ||= c.essential;
      } else out.set(c.id, { ...c, groups: [k.name] });
    }
  return [...out.values()];
}

export const kitsOf = (p: Presets): Kit[] => [
  {
    key: "shared",
    name: "Every department",
    mission: p.shared.mission,
    skills: p.shared.skills,
    connectors: p.shared.connectors,
  },
  ...p.departments.map((d) => ({
    key: d.key,
    name: d.name,
    mission: d.mission,
    skills: d.skills,
    connectors: d.connectors,
  })),
];

/** The built-in skills, once each, with the kits that bring them. */
export function builtInSkills(p: Presets): Array<{ name: string; description: string; groups: string[] }> {
  const out = new Map<string, { name: string; description: string; groups: string[] }>();
  for (const k of kitsOf(p))
    for (const s of k.skills) {
      const have = out.get(s.name);
      if (have) have.groups.push(k.name);
      else out.set(s.name, { ...s, groups: [k.name] });
    }
  return [...out.values()];
}

/** The connector a catalog service stands for, if the owner has it. */
export const connectedAs = (c: PresetConnector, list: Connector[] | null | undefined) =>
  list?.find((x) => matchesPreset(c, x.url));

/** The catalog service a connector stands for: same link, or a known service's host. */
export function catalogFor(c: Connector, cat: CatalogItem[]): CatalogItem | undefined {
  return (
    cat.find((x) => matchesPreset(x, c.url)) ??
    cat.find((x) => x.id === c.id) ??
    cat.find((x) => !x.ask && hostOf(x.url) !== "" && hostOf(x.url) === hostOf(c.url))
  );
}
const hostOf = (u?: string) => {
  try {
    return u ? new URL(u).hostname : "";
  } catch {
    return "";
  }
};

/** Where a logo lives, or null for the lettered tile. */
export function logoSrc(id: string | undefined): string | null {
  const ext = id ? (logos as Record<string, string>)[id] : undefined;
  return ext ? `/logos/${id}.${ext}` : null;
}

/** What kind of thing a connector is, in the owner's words. */
export function connectorType(c: Connector): string {
  if (c.transport === "openapi") return "Web API";
  if (c.transport === "package") return "Package";
  return "MCP";
}

/** Short status for a table row: done, working on it, or what the owner must do. */
export function rowStatus(c: Connector): { text: string; tone: "good" | "warn" | "bad" | "info"; ok: boolean } {
  switch (c.status) {
    case "ready":
      return { text: "Connected", tone: "good", ok: true };
    case "needs_login":
      return { text: "Sign in", tone: "warn", ok: false };
    case "login_expired":
      return { text: "Sign in again", tone: "warn", ok: false };
    case "needs_key":
      return { text: c.needs === "oauth_client" ? "Add its app's id" : "Add its key", tone: "warn", ok: false };
    case "pending_approval":
      return { text: "Waiting for you", tone: "warn", ok: false };
    case "error": // in full: the owner's rule
      return { text: c.error ? `Problem: ${c.error}` : "Problem", tone: "bad", ok: false };
    case "removing":
      return { text: "Removing…", tone: "info", ok: false };
    default:
      return { text: "Setting up…", tone: "info", ok: false };
  }
}

/** Statuses that change by themselves soon, so the page looks again. */
export const settling = (c: Connector) => ["provisioning", "syncing", "removing"].includes(c.status);

/** Case- and accent-blind match on any of the given texts; an empty query matches everything. */
export function matches(query: string, ...texts: Array<string | undefined>): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(texts.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

/** How far a kit is set up: its essential tools that are connected. */
export function kitProgress(
  k: Kit,
  list: Connector[] | null | undefined,
): { done: number; total: number; any: boolean } {
  const essential = k.connectors.filter((c) => c.essential);
  const ready = (c: PresetConnector) => connectedAs(c, list)?.status === "ready";
  return {
    done: essential.filter(ready).length,
    total: essential.length,
    any: k.connectors.some((c) => !!connectedAs(c, list)),
  };
}

/** Builds a SKILL.md from what the owner typed in "Write a skill". */
export function skillMarkdown(name: string, description: string, body: string): string {
  const oneLine = description.replace(/\s+/g, " ").trim();
  return `---\nname: ${name.trim()}\ndescription: ${oneLine}\n---\n\n${body.trim()}\n`;
}

/** The catalog, fetched once per page load (the chat's cards use it for sign-up links). */
let cached: Promise<CatalogItem[]> | null = null;
export function loadCatalog(): Promise<CatalogItem[]> {
  cached ??= listPresets().then(catalogOf, (e: unknown) => {
    cached = null;
    throw e;
  });
  return cached;
}
export function useCatalog(): CatalogItem[] {
  const [cat, setCat] = useState<CatalogItem[]>([]);
  useEffect(() => {
    let live = true;
    loadCatalog().then(
      (c) => live && setCat(c),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return cat;
}
/** The catalog service a connector id or label stands for (connectors added from the catalog keep its id). */
export const serviceFor = (cat: CatalogItem[], id: string, label?: string) =>
  cat.find((c) => c.id === id) ?? cat.find((c) => !!label && c.label.toLowerCase() === label.toLowerCase());
