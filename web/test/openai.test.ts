import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/auth.ts", () => ({ idToken: async () => "tok" }));
vi.mock("../src/lib/config.ts", () => ({ config: () => ({ apiUrl: "https://api.test" }) }));

type Reply = { status: number; json?: unknown; body?: string };
let replies: Record<string, Reply> = {};
const calls: Array<{ url: string; body: unknown }> = [];
beforeEach(() => {
  vi.resetModules();
  calls.length = 0;
  localStorage.clear();
  replies = {};
  vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
    const path = url.replace("https://api.test", "");
    calls.push({ url: path, body: init?.body ? JSON.parse(init.body) : null });
    const r = replies[path] ?? { status: 404, json: {} };
    return r.body !== undefined
      ? new Response(r.body, { status: r.status, headers: { "content-type": "audio/mpeg" } })
      : new Response(JSON.stringify(r.json), { status: r.status });
  });
});
const status = (configured: boolean) => ({
  status: 200,
  json: { configured, voices: ["alloy", "nova"], default: "alloy", key_saved_at: null },
});
const polly = async (t: string) => `polly:${t}`;

describe("VAIC's voice: OpenAI when its key is in, Polly behind it", () => {
  it("without a key, Polly speaks and /speech is never called", async () => {
    const o = await import("../src/voice/openai.ts");
    replies["/voice/openai"] = status(false);
    await o.loadOpenAi();
    expect(await o.withOpenAi(polly)("Hi.")).toBe("polly:Hi.");
    expect(calls.map((c) => c.url)).toEqual(["/voice/openai"]);
  });

  it("with a key, each sentence goes to /speech with the chosen voice", async () => {
    const o = await import("../src/voice/openai.ts");
    replies["/voice/openai"] = status(true);
    replies["/speech"] = { status: 200, body: "mp3" };
    await o.loadOpenAi();
    expect(o.readOpenAiVoice()).toBe("alloy");
    o.saveOpenAiVoice("nova");
    const clip = (await o.withOpenAi(polly)("Hi.")) as Blob;
    expect(await clip.text()).toBe("mp3");
    expect(calls.at(-1)).toEqual({ url: "/speech", body: { text: "Hi.", voice: "nova" } });
  });

  it("a failure switches to Polly for the rest of the visit, said once; a reset tries OpenAI again", async () => {
    const o = await import("../src/voice/openai.ts");
    replies["/voice/openai"] = status(true);
    replies["/speech"] = { status: 503, json: { error: "rate_limited", message: "OpenAI is busy" } };
    await o.loadOpenAi();
    const notes: string[] = [];
    o.onVoiceNote((n) => notes.push(n));
    const say = o.withOpenAi(polly);
    expect(await say("One.")).toBe("polly:One.");
    expect(await say("Two.")).toBe("polly:Two.");
    expect(notes).toEqual(["OpenAI's voice failed (OpenAI is busy). Using the Polly voice for now."]);
    expect(calls.filter((c) => c.url === "/speech")).toHaveLength(1);
    o.resetOpenAi();
    expect(o.usingOpenAi()).toBe(true);
  });

  it("the server's plain words name the error", async () => {
    const o = await import("../src/voice/openai.ts");
    replies["/speech"] = { status: 503, json: { error: "bad_key", message: "OpenAI rejected the key" } };
    await expect(o.openAiSynth("Hi.")).rejects.toMatchObject({
      name: "OpenAiVoice",
      code: "bad_key",
      message: "OpenAI rejected the key",
    });
  });
});
