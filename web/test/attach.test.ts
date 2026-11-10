// The + menu's brains: slash commands, folder picks and the attachment line (lib/attach.ts).
import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "../src/lib/api.ts";
import type { Skill } from "../src/lib/connect.ts";
import {
  allCommands,
  attachedLine,
  BUILT_IN,
  expandSlash,
  folderFiles,
  matchCommands,
  MAX_FOLDER_FILES,
  sendable,
} from "../src/lib/attach.ts";

const skill = (name: string, enabled = true): Skill => ({
  name,
  description: `The ${name} skill`,
  roles: ["vaic"],
  enabled,
  version: "v1",
  files: [],
  size_bytes: 0,
  updated_at: "2026-11-08T00:00:00Z",
});
const commands = allCommands([skill("pdf-report"), skill("old-one", false)]);

describe("slash commands", () => {
  it("lists built-ins and enabled skills, filtered by what is typed after the slash", () => {
    expect(commands.map((c) => c.name)).toEqual([...BUILT_IN.map((c) => c.name), "pdf-report"]);
    expect(matchCommands("/", commands).map((c) => c.name)).toEqual(commands.map((c) => c.name));
    expect(matchCommands("/st", commands).map((c) => c.name)).toEqual(["status", "stop"]);
    expect(matchCommands("/PDF", commands).map((c) => c.name)).toEqual(["pdf-report"]);
    expect(matchCommands("hello /status", commands)).toEqual([]);
    expect(matchCommands("/status now", commands)).toEqual([]); // words after it: no longer a hint
  });

  it("becomes the plain sentence VAIC understands", () => {
    expect(expandSlash("/status", commands)).toEqual({ kind: "send", text: "What's the status of the city?" });
    expect(expandSlash("/home", commands)).toEqual({ kind: "send", text: "Send everyone home." });
    expect(expandSlash("/status please, in one line", commands)).toEqual({
      kind: "send",
      text: "What's the status of the city? please, in one line",
    });
    expect(expandSlash("/connect HeyGen", commands)).toEqual({ kind: "send", text: "Add HeyGen as a connector." });
    expect(expandSlash("/leads 2 for Swedish fintechs hiring engineers", commands)).toEqual({
      kind: "send",
      text: "Find me sales leads: 2 for Swedish fintechs hiring engineers",
    });
    expect(expandSlash("/pdf-report one for Q3", commands)).toEqual({
      kind: "send",
      text: "Use the “pdf-report” skill: one for Q3",
    });
  });

  it("asks for the missing words, clears locally, and leaves unknown slashes alone", () => {
    expect(expandSlash("/connect", commands)).toMatchObject({ kind: "needs", command: { name: "connect" } });
    expect(expandSlash("/leads", commands)).toMatchObject({ kind: "needs", command: { name: "leads" } });
    expect(expandSlash("/pdf-report", commands)).toMatchObject({ kind: "needs", command: { name: "pdf-report" } });
    expect(expandSlash("/clear", commands)).toEqual({ kind: "clear" });
    expect(expandSlash("/old-one go", commands)).toBeNull(); // a disabled skill is not a command
    expect(expandSlash("/whatever", commands)).toBeNull();
    expect(expandSlash("a/b", commands)).toBeNull();
  });
});

const file = (path: string) =>
  Object.assign(new File(["x"], path.split("/").pop()!), { webkitRelativePath: path }) as File;
const item = (
  id: string,
  status: KnowledgeItem["status"],
  kind: KnowledgeItem["kind"] = "document",
): KnowledgeItem => ({
  id,
  kind,
  title: `${id}.pdf`,
  scope: "relevant",
  status,
});

describe("attachments", () => {
  it("a folder pick drops hidden files and folders and stops at the limit", () => {
    const r = folderFiles([file("docs/a.md"), file("docs/.DS_Store"), file("docs/.git/config"), file("docs/b.md")]);
    expect(r.files.map((f) => f.name)).toEqual(["a.md", "b.md"]);
    expect(r).toMatchObject({ hidden: 2, skipped: 0 });
    const many = folderFiles(Array.from({ length: MAX_FOLDER_FILES + 5 }, (_, i) => file(`d/${i}.txt`)));
    expect(many.files).toHaveLength(MAX_FOLDER_FILES);
    expect(many.skipped).toBe(5);
  });

  it("a message may go once every file is uploaded, and names what rides along", () => {
    expect(sendable([item("k-1", "uploading")])).toBe(false);
    expect(sendable([item("k-1", "processing"), item("k-2", "ready")])).toBe(true);
    expect(attachedLine([item("k-1", "ready"), item("k-2", "processing", "audio"), item("k-3", "failed")])).toBe(
      "Attached (now in my knowledge base): “k-1.pdf” (document, ready); “k-2.pdf” (audio, still being prepared); " +
        "“k-3.pdf” (document, failed to process).",
    );
  });
});
