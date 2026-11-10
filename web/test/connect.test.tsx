import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSkill, connectorStatus, filesFromPicker, looksLikeKey, readFrontmatter } from "../src/lib/connect.ts";
import { CONNECT_KEY, connectReturn } from "../src/lib/connectReturn.ts";
import { store } from "../src/lib/store.ts";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(async () => ({ ok: true })),
  ApiError: class extends Error {},
}));
import { api } from "../src/lib/api.ts";

const enc = (s: string) => new TextEncoder().encode(s);
const SKILL = "---\nname: pdf-report\ndescription: Makes a PDF report\nallowed-tools: Bash\n---\nDo the thing.";

afterEach(() => {
  sessionStorage.clear();
  vi.mocked(api).mockClear();
  store.set({ cards: [] });
});

describe("keys never go through the chat", () => {
  it.each([
    "here is my key sk-proj-AbCdEf1234567890abcdef",
    "xoxb-1234567890-abcdefghij",
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "github_pat_11ABCDEFG0123456789_abcdefghijklmnop",
    "tvly-AbCdEf123456",
    "AKIAABCDEFGHIJKLMNOP",
    "token: Zx9Qp2Lm7Wv4Ks8Hd3Jf6Ng1Bt5Rc0Ya",
  ])("refuses %s", (t) => expect(looksLikeKey(t)).toBe(true));
  it.each([
    "add higgsfield as an MCP",
    "connect my work Outlook and my Gmail",
    "https://mcp.example.com/mcp/v1/servers/higgsfield-production-endpoint",
    "what's the status of ticket t-123?",
  ])("lets %s through", (t) => expect(looksLikeKey(t)).toBe(false));
});

describe("skills are checked like the API checks them", () => {
  it("reads the frontmatter and lists what will be dropped", () => {
    const fm = readFrontmatter(SKILL);
    expect(fm).toMatchObject({ name: "pdf-report", description: "Makes a PDF report", dropped: ["allowed-tools"] });
    expect(fm.body.trim()).toBe("Do the thing.");
  });
  it("accepts a good folder and refuses bad ones in plain words", () => {
    expect(
      checkSkill([
        { path: "SKILL.md", bytes: enc(SKILL) },
        { path: "ref/notes.md", bytes: enc("x") },
      ]),
    ).toEqual([]);
    expect(checkSkill([{ path: "notes.md", bytes: enc("x") }])[0]).toMatch(/needs a SKILL.md/);
    const bad = checkSkill([
      { path: "SKILL.md", bytes: enc(SKILL) },
      { path: "hooks/pre.sh", bytes: enc("x") },
      { path: "../escape.md", bytes: enc("x") },
    ]);
    expect(bad.join(" ")).toMatch(/hook/);
    expect(bad.join(" ")).toMatch(/isn't a usable file path/);
    expect(checkSkill([{ path: "SKILL.md", bytes: enc("---\nname: Bad Name\ndescription: d\n---\n") }])[0]).toMatch(
      /lowercase/,
    );
    expect(checkSkill([{ path: "SKILL.md", bytes: enc("# no frontmatter") }], "x")).toContain(
      "SKILL.md needs a description in its frontmatter.",
    );
  });
  it("strips the picked folder's own name from the paths", async () => {
    const f = (name: string, rel: string) => Object.assign(new File(["x"], name), { webkitRelativePath: rel });
    const files = await filesFromPicker([f("SKILL.md", "pdf-report/SKILL.md"), f("a.md", "pdf-report/ref/a.md")]);
    expect(files.map((x) => x.path)).toEqual(["SKILL.md", "ref/a.md"]);
  });
});

describe("connector status in plain words", () => {
  it("says what the owner has to do", () => {
    expect(connectorStatus({ id: "h", status: "needs_login" }).text).toBe("Needs you to sign in");
    expect(connectorStatus({ id: "h", status: "ready", tools: [{ name: "a" }, { name: "b" }] }).text).toBe(
      "On · 2 tools",
    );
    expect(connectorStatus({ id: "h", status: "needs_key", needs: "oauth_client" }).text).toMatch(/client id/);
  });
});

describe("the shared sign-in return", () => {
  const loc = (search: string) => ({ search, pathname: "/", hash: "#/vaic" });
  it("does nothing on a normal visit", async () => {
    expect(await connectReturn(loc(""), () => undefined)).toBeNull();
  });
  it("finishes the sign-in that this tab started, then cleans the address bar", async () => {
    sessionStorage.setItem(
      CONNECT_KEY,
      JSON.stringify({ kind: "connector", id: "gh", state: "s1", completePath: "/connectors/gh/login/complete" }),
    );
    const replace = vi.fn();
    const r = await connectReturn(loc("?connect=return&session_uri=urn%3As"), replace);
    expect(r?.ok).toBe(true);
    expect(api).toHaveBeenCalledWith("/connectors/gh/login/complete", {
      method: "POST",
      body: { state: "s1", session_uri: "urn:s" },
    });
    expect(replace).toHaveBeenCalledWith("/#/vaic");
    expect(sessionStorage.getItem(CONNECT_KEY)).toBeNull();
  });
  it("refuses a return that this tab didn't start or whose state differs", async () => {
    expect((await connectReturn(loc("?connect=return"), () => undefined))?.ok).toBe(false);
    sessionStorage.setItem(
      CONNECT_KEY,
      JSON.stringify({ kind: "mail", id: "ma-1", state: "s1", completePath: "/mail/accounts/ma-1/complete" }),
    );
    expect((await connectReturn(loc("?connect=return&state=forged"), () => undefined))?.ok).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });
});

describe("connect cards follow the city's events", () => {
  it("an add-connector approval, then a sign-in button that turns into connected", () => {
    store.event({
      type: "approval.requested",
      id: "ap-1",
      kind: "connector.add",
      action: "Add Higgsfield?",
      reason: "r",
    });
    expect(store.get().cards.map((c) => c.kind)).toEqual(["approve"]);
    store.event({ type: "approval.decided", id: "ap-1", approved: true });
    store.event({
      type: "connector.updated",
      id: "higgsfield",
      label: "Higgsfield",
      status: "needs_login",
      auth: "oauth",
    });
    expect(store.get().cards).toMatchObject([{ kind: "signin", target: "connector", title: "Sign in to Higgsfield" }]);
    store.event({ type: "connector.updated", id: "higgsfield", label: "Higgsfield", status: "ready", auth: "oauth" });
    expect(store.get().cards).toMatchObject([{ kind: "signin", status: "connected" }]);
  });
  it("mail accounts get a sign-in card, IMAP an app-password card", () => {
    store.event({ type: "connect.signin", account_id: "ma-1", provider: "microsoft", label: "Work" });
    store.event({ type: "connect.signin", account_id: "ma-2", provider: "imap", label: "Fastmail" });
    expect(store.get().cards.map((c) => [c.kind, "title" in c ? c.title : ""])).toEqual([
      ["signin", "Sign in to Microsoft (Work)"],
      ["imap", "Add the app password for Fastmail"],
    ]);
    store.event({ type: "mail.account", account: { id: "ma-1", status: "connected" } });
    expect(store.get().cards[0]).toMatchObject({ status: "connected" });
  });
});
