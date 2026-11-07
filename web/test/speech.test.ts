import { describe, expect, it } from "vitest";
import { SentenceSplitter, SpeechQueue, speakable } from "../src/voice/speech.ts";
import { readVoiceId, saveVoiceId } from "../src/voice/modes.ts";

const feed = (pieces: string[]) => {
  const s = new SentenceSplitter();
  const out = pieces.flatMap((p) => s.push(p));
  return [...out, ...s.flush()];
};

describe("splitting a streamed reply into sentences", () => {
  it("emits each sentence as soon as it is complete, across stream pieces", () => {
    const s = new SentenceSplitter();
    expect(s.push("All quiet in the ci")).toEqual([]);
    expect(s.push("ty. Nothing needs")).toEqual(["All quiet in the city. "]);
    expect(s.push(" you!\n")).toEqual(["Nothing needs you!"]);
    expect(s.push("Want more?")).toEqual([]);
    expect(s.flush()).toEqual(["Want more?"]);
  });
  it("does not cut at list numbers or decimals, and treats line ends as breaks", () => {
    expect(feed(["1. Research has 3.5 workers\n2. Engineering is idle"])).toEqual([
      "1. Research has 3.5 workers",
      "2. Engineering is idle",
    ]);
  });
  it("skips code blocks and table rules", () => {
    expect(feed(["Run this:\n```\nnpm test. done\n```\n| A | B |\n|---|---|\n| 1 | 2 |\nThat's it."])).toEqual([
      "Run this:",
      "| A | B |",
      "| 1 | 2 |",
      "That's it.",
    ]);
  });
});

describe("what gets said", () => {
  it("drops Markdown, emoji and URLs, and says AIC as letters", () => {
    expect(speakable("**AIC** here 🎉: see [the docs](https://x.y) or https://a.b/c.")).toBe(
      "A.I.C. here: see the docs or a link.",
    );
    expect(speakable("## Today")).toBe("Today");
    expect(speakable("- `npm test` passed ✅")).toBe("npm test passed");
    expect(speakable("| Research | 3 |")).toBe("Research, 3");
    expect(speakable("🎉🎉")).toBe("");
  });
});

describe("the speech queue", () => {
  it("starts speaking with the first sentence and plays clips in order, one synthesis at a time", async () => {
    const log: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const q = new SpeechQueue<string>(
      async (t) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, t.length % 3)); // uneven synthesis times
        inFlight--;
        log.push(`synth ${t}`);
        return t;
      },
      async (c) => {
        log.push(`play ${c}`);
      },
    );
    q.push("First one. Sec");
    await new Promise((r) => setTimeout(r, 10));
    expect(log).toContain("play First one."); // before the reply is complete
    q.push("ond one. Third");
    await q.end();
    expect(log.filter((l) => l.startsWith("play"))).toEqual(["play First one.", "play Second one.", "play Third"]);
    expect(maxInFlight).toBe(1);
  });
  it("stops: nothing more is played", async () => {
    const played: string[] = [];
    const q = new SpeechQueue<string>(
      async (t) => t,
      async (c) => void played.push(c),
    );
    q.stop();
    q.push("Never said. ");
    await q.end();
    expect(played).toEqual([]);
  });
  it("a failed synthesis skips that sentence and carries on", async () => {
    const played: string[] = [];
    const q = new SpeechQueue<string>(
      async (t) => {
        if (t.startsWith("Bad")) throw new Error("throttled");
        return t;
      },
      async (c) => void played.push(c),
    );
    q.push("Good one. Bad one. Good two.");
    await q.end();
    expect(played).toEqual(["Good one.", "Good two."]);
  });
});

describe("the voice picker", () => {
  it("defaults to the deploy's voice, remembers the owner's choice, and ignores unknown ids", () => {
    localStorage.clear();
    expect(readVoiceId("Matthew")).toBe("Matthew");
    expect(readVoiceId("NotAVoice")).toBe("Matthew");
    saveVoiceId("Ruth");
    expect(readVoiceId("Matthew")).toBe("Ruth");
    localStorage.setItem("aic.voice", "Hacker");
    expect(readVoiceId("Stephen")).toBe("Stephen");
    localStorage.clear();
  });
});
