// Projects and chats on the server (decision 299): a draft started on one device reaches the others, a device's
// old local projects and chats are uploaded once, lines are never doubled, and sign-out keeps the cloud copy.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signOutHere } from "../src/lib/auth.ts";
import { mergeLines, missingOnServer, type ServerLine } from "../src/lib/cloudChat.ts";
import { loadConfig } from "../src/lib/config.ts";
import { projects, type ProjectLine } from "../src/lib/projects.ts";
import { store } from "../src/lib/store.ts";

// A tiny server: projects and conversation lines, like the API's.
let server: { projects: Record<string, unknown>; lines: Record<string, ServerLine[]> };
const calls: Array<{ method: string; path: string; body: unknown }> = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test" }));
  const path = url.replace("https://api.vaic.test", "");
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ method, path, body });
  const ok = (b: unknown) => new Response(JSON.stringify(b));
  let m: RegExpMatchArray | null;
  if (path === "/projects") return ok({ projects: Object.values(server.projects) });
  if ((m = path.match(/^\/projects\/(new-[\w-]+)$/))) {
    if (method === "PUT") server.projects[m[1]!] = { key: m[1], ...body };
    else delete server.projects[m[1]!];
    return ok({});
  }
  if ((m = path.match(/^\/conversations\/([\w-]+)\/lines$/))) {
    const list = (server.lines[m[1]!] ??= []);
    if (method === "GET") return ok({ lines: list });
    for (const l of body.lines)
      if (!list.some((x) => x.id === `c-${l.id}`))
        list.push({ id: `c-${l.id}`, who: l.who, text: l.text, at: new Date(l.at).toISOString() });
    return ok({ imported: body.lines.length });
  }
  return new Response(JSON.stringify({ accepted: true }), { status: 202 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = {
    idToken: async () => "header.payload.sig",
    signOut: async () => undefined,
  };
});
beforeEach(() => {
  localStorage.clear();
  server = { projects: {}, lines: {} };
  projects.state = { chats: {}, asks: {}, thinking: {}, feed: {}, drafts: [] };
  store.set({ chat: [] });
});
afterEach(() => {
  calls.length = 0;
});

const line = (id: string, who: "owner" | "vaic", text: string, at: number): ProjectLine => ({
  id,
  who,
  text,
  at,
  state: who === "owner" ? "sent" : "done",
});
const sline = (id: string, who: "owner" | "vaic", text: string, at: number): ServerLine => ({
  id,
  who,
  text,
  at: new Date(at).toISOString(),
});
const make = (s: ServerLine, who: "owner" | "vaic"): ProjectLine => line(`s-${s.id}`, who, s.text, Date.parse(s.at));

describe("merging the server's lines", () => {
  it("adds only the lines this device doesn't have, oldest first, each local line matching once", () => {
    const local = [line("p1", "owner", "yes", 1000), line("a1", "vaic", "Done,  Sir.", 2000)];
    const srv = [
      sline("1", "owner", "yes", 1100),
      sline("2", "vaic", "Done, Sir.", 2100),
      sline("3", "owner", "yes", 3000), // the same words again, from the PC
      sline("4", "vaic", "Blue it is.", 4000),
    ];
    const out = mergeLines(local, srv, make, "vaic");
    expect(out.map((l) => l.id)).toEqual(["p1", "a1", "s-3", "s-4"]);
    // Again (a reconnect): nothing doubles.
    expect(mergeLines(out, srv, make, "vaic")).toBe(out);
  });
  it("leaves out VAIC's finished line while this device is still streaming it", () => {
    const local = [
      line("p1", "owner", "go", 1000),
      { ...line("a1", "vaic", "Work", 2000), state: "streaming" as const },
    ];
    const out = mergeLines(
      local,
      [sline("1", "owner", "go", 1000), sline("2", "vaic", "Working on it.", 2500)],
      make,
      "vaic",
    );
    expect(out.map((l) => l.id)).toEqual(["p1", "a1"]);
  });
  it("finds the local lines the server lacks, skipping unsent lines and file cards", () => {
    const local = [
      line("p1", "owner", "a quiz", 1000),
      line("a1", "vaic", "Sure.", 2000),
      { ...line("p2", "owner", "draft", 3000), state: "failed" as const },
      line("f1", "vaic", "", 4000),
    ];
    expect(missingOnServer(local, [sline("1", "owner", "a quiz", 1000)], "vaic").map((l) => l.id)).toEqual(["a1"]);
  });
});

describe("projects on the server", () => {
  it("a project started on one device is saved to the server and another device lists it", async () => {
    await projects.start("a quiz about world capitals");
    const key = projects.get().drafts[0]!.key;
    expect(calls.some((c) => c.method === "PUT" && c.path === `/projects/${key}`)).toBe(true);
    // The PC: nothing local, then a sync.
    localStorage.setItem("vaic.projects.uploaded", "1");
    projects.state = { chats: {}, asks: {}, thinking: {}, feed: {}, drafts: [] };
    await projects.sync();
    expect(projects.get().drafts.map((d) => d.title)).toEqual(["Quiz about world capitals"]);
  });
  it("project.saved, project.removed and owner.line events update a device live, once", () => {
    projects.event({ type: "project.saved", project: { key: "new-abc12345", idea: "a quiz", title: "Quiz", at: 5 } });
    projects.event({ type: "project.saved", project: { key: "new-abc12345", idea: "a quiz", title: "Quiz", at: 5 } });
    expect(projects.get().drafts).toHaveLength(1);
    const e = { type: "owner.line", conversation: "app-new-abc12345", text: "make it blue", client_id: "pabc12345" };
    projects.event(e);
    projects.event(e);
    expect(projects.get().chats["app-new-abc12345"]?.map((l) => l.text)).toEqual(["make it blue"]);
    projects.event({ type: "project.removed", key: "new-abc12345" });
    expect(projects.get().drafts).toEqual([]);
  });
  it("the device's old projects and chats upload once", async () => {
    projects.state = {
      ...projects.state,
      drafts: [{ key: "new-mac00001", idea: "a quiz about world capitals", title: "Quiz About World Capitals", at: 7 }],
      chats: {
        "app-new-mac00001": [line("p1", "owner", "a quiz about world capitals", 7), line("a1", "vaic", "On it.", 8)],
      },
    };
    server.lines["app-new-mac00001"] = [sline("x", "owner", "a quiz about world capitals", 7)];
    await projects.sync();
    await projects.sync();
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect((posts[0]!.body as { lines: { id: string }[] }).lines.map((l) => l.id)).toEqual(["a1"]);
    expect(Object.keys(server.projects)).toEqual(["new-mac00001"]);
    expect(server.lines["app-new-mac00001"]!.map((l) => l.text)).toEqual(["a quiz about world capitals", "On it."]);
    expect(localStorage.getItem("vaic.projects.uploaded")).toBe("1");
  });
  it("sign-out clears this device's cache and never deletes the cloud copy", async () => {
    await projects.start("a quiz about world capitals");
    expect(localStorage.getItem("vaic.projects.new")).toContain("world capitals");
    calls.length = 0;
    await signOutHere();
    expect(localStorage.getItem("vaic.projects.new")).toBeNull();
    expect(localStorage.getItem("vaic.projects.chats")).toBeNull();
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([]);
    expect(Object.keys(server.projects)).toHaveLength(1);
  });
});

describe("VAIC's main chat on the server", () => {
  it("shows lines from the owner's other devices on load and live, never twice", async () => {
    store.set({ chat: [{ id: "o1", who: "owner", text: "hi", state: "sent", at: 1000 }] });
    server.lines["main"] = [sline("1", "owner", "hi", 1000), sline("2", "vaic", "Hello, Sir.", 2000)];
    await store.loadChat();
    await store.loadChat();
    expect(store.get().chat.map((l) => l.text)).toEqual(["hi", "Hello, Sir."]);
    const e = { type: "owner.line", conversation: "main", text: "what's new?", client_id: "pc-12345678" };
    store.event(e);
    store.event(e);
    store.event({ ...e, conversation: "app-new-abc12345", client_id: "pc-99999999" });
    expect(store.get().chat.map((l) => l.text)).toEqual(["hi", "Hello, Sir.", "what's new?"]);
  });
});
