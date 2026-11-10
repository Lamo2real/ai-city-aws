// The voice conversation's turn-taking with a fake microphone and a fake speaker (the owner, 2026-11-09: "I can't
// even speak to it… it should only answer what I'm saying, and also listen to what I'm saying when I'm
// interrupting it"). The real useVoice hook runs; only the Voice, the send and OpenAI's key check are fakes.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Heard, Voice } from "../src/voice/voice.ts";

const sent: string[] = [];
vi.mock("../src/lib/actions.ts", () => ({
  sendMessage: vi.fn(async (text: string, opts?: { voice?: boolean }) => {
    sent.push(text);
    const { store } = await import("../src/lib/store.ts");
    store.set({
      chat: [
        ...store.get().chat,
        { id: `o${sent.length}`, who: "owner", text, state: "sent", at: Date.now(), voice: opts?.voice },
      ],
    });
  }),
}));
vi.mock("../src/voice/openai.ts", () => ({
  loadOpenAi: async () => null,
  onVoiceNote: () => () => undefined,
  withOpenAi: <T,>(f: T) => f,
}));

// The fake microphone and speaker.
const mic: {
  onText: ((t: string, h?: Heard) => void) | null;
  onPartial: ((t: string) => void) | null;
  level: number;
} = { onText: null, onPartial: null, level: 0 };
const played: string[] = [];
let playing: { text: string; end: () => void } | null = null;
let stops = 0;
const fake: Voice = {
  async listen(onText, onPartial) {
    mic.onText = onText;
    mic.onPartial = onPartial ?? null;
    return () => {
      mic.onText = null;
      mic.onPartial = null;
    };
  },
  async speak() {},
  async synth(text) {
    return new Blob([text]);
  },
  // A clip plays until the test ends it, or until stopSpeaking() cuts it.
  async play(clip, onBegin) {
    const text = await clip.text();
    played.push(text);
    onBegin?.();
    await new Promise<void>((end) => (playing = { text, end }));
  },
  stopSpeaking() {
    stops++;
    const p = playing;
    playing = null;
    p?.end();
  },
  levels: () => ({ input: mic.level, output: 0 }),
  micLevel: () => mic.level,
};

let store: typeof import("../src/lib/store.ts").store;
let useVoice: typeof import("../src/voice/useVoice.ts").useVoice;
beforeAll(async () => {
  window.__vaicVoice = fake;
  ({ store } = await import("../src/lib/store.ts"));
  ({ useVoice } = await import("../src/voice/useVoice.ts"));
});
beforeEach(() => {
  sent.length = 0;
  played.length = 0;
  playing = null;
  stops = 0;
  mic.level = 0;
  store.set({ chat: [], presence: "idle" });
});
afterEach(cleanup);

const reply = (text: string, done = true) =>
  act(() => store.event({ type: "vaic.reply", conversation: "main", text, done }));
const hear = (text: string, startedAt?: number) => act(() => mic.onText?.(text, { startedAt }));
/** Finishes the sentence playing now (the speaker reached its end). */
const finishClip = () =>
  act(async () => {
    playing?.end();
    playing = null;
    await new Promise((r) => setTimeout(r, 250)); // the pause between sentences
  });

async function conversation() {
  const h = renderHook(() => useVoice());
  act(() => h.result.current.toggleConversation());
  await waitFor(() => expect(mic.onText).not.toBeNull());
  return {
    off: () => act(() => h.result.current.toggleConversation()),
  };
}

describe("the voice conversation hears the owner and answers what was said", () => {
  it("an answer that repeats VAIC's own words, after VAIC finished, is sent (it used to be dropped as echo)", async () => {
    const c = await conversation();
    await hear("Check my mail");
    await waitFor(() => expect(sent).toEqual(["Check my mail"]), { timeout: 3000 });
    await reply("Shall I send the email to John?");
    await waitFor(() => expect(played).toEqual(["Shall I send the email to John?"]));
    await finishClip();
    await waitFor(() => expect(store.get().presence).toBe("listening"));
    await new Promise((r) => setTimeout(r, 700)); // the owner answers once VAIC's echo has died away
    await hear("Yes, send the email to John", Date.now());
    await waitFor(() => expect(sent).toEqual(["Check my mail", "Yes, send the email to John"]), { timeout: 3000 });
    c.off();
  });

  it("VAIC's own voice coming back while it talks is never sent", async () => {
    const c = await conversation();
    await hear("What's on today?");
    await waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    stops = 0;
    await reply("Nothing needs you today, Sir. The city is quiet.");
    await waitFor(() => expect(playing).not.toBeNull());
    await hear("nothing needs you today", Date.now() - 200);
    await new Promise((r) => setTimeout(r, 1400));
    expect(sent).toHaveLength(1);
    expect(stops).toBe(0); // it kept talking
    c.off();
  });
});

describe("talking over VAIC", () => {
  it("'wait' stops VAIC at once, and what the owner says next is sent", async () => {
    const c = await conversation();
    await hear("How was the day?");
    await waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    await reply("The research team finished two reports. Marketing is still working on the launch plan.");
    await waitFor(() => expect(playing).not.toBeNull());
    act(() => mic.onPartial?.("wait"));
    expect(playing).toBeNull(); // silent at once
    expect(store.get().presence).toBe("listening");
    await hear("wait, which reports?", Date.now() - 300);
    await waitFor(() => expect(sent).toEqual(["How was the day?", "wait, which reports?"]), { timeout: 3000 });
    // The rest of the old answer is not read out after the owner cut in.
    expect(played).toEqual(["The research team finished two reports."]);
    c.off();
  });

  it("the owner's voice on the open microphone stops VAIC, and a short interruption is still heard", async () => {
    const c = await conversation();
    await hear("When is my meeting with Anna?");
    await waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    await reply("Your meeting with Anna is at three tomorrow afternoon in the main office, Sir.");
    await waitFor(() => expect(playing).not.toBeNull());
    const from = Date.now();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350)); // the room, while VAIC talks (calibration)
      mic.level = 0.6; // the owner talks over it
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(playing).toBeNull();
    // One word of the owner's own ("Monday"); the rest are VAIC's words. Without the barge-in it would be dropped.
    await hear("is the meeting Monday", from + 400);
    await waitFor(() => expect(sent.at(-1)).toBe("is the meeting Monday"), { timeout: 3000 });
    mic.level = 0;
    c.off();
  });

  it("the rest of a reply the owner cut into is not spoken; the answer to the new question is", async () => {
    const c = await conversation();
    await hear("Tell me about the launch");
    await waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    await reply("The launch is planned for March. ", false);
    await waitFor(() => expect(played).toEqual(["The launch is planned for March."]));
    act(() => mic.onPartial?.("stop"));
    await hear("stop, what does it cost?", Date.now() - 200);
    await waitFor(() => expect(sent).toHaveLength(2), { timeout: 3000 });
    // The old answer keeps streaming after the owner's new message, then finishes.
    await reply("Marketing owns it.", false);
    await reply("The launch is planned for March. Marketing owns it.");
    await new Promise((r) => setTimeout(r, 300));
    expect(played).toEqual(["The launch is planned for March."]);
    // The answer to what the owner just asked is spoken.
    await reply("About four thousand dollars.");
    await waitFor(() => expect(played.at(-1)).toBe("About four thousand dollars."));
    c.off();
  });
});
