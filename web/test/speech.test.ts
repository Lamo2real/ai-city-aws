import { describe, expect, it } from "vitest";
import { SentenceSplitter, SpeechQueue, sentencesOf, speakable } from "../src/voice/speech.ts";
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
  it("drops Markdown, emoji and URLs, and says VAIC as Vice", () => {
    expect(speakable("**VAIC** here 🎉: see [the docs](https://x.y) or https://a.b/c.")).toBe(
      "Vice here: see the docs or a link.",
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
    expect(readVoiceId("NotAVoice")).toBe("Ruth"); // the most natural voice when nothing is set
    saveVoiceId("Ruth");
    expect(readVoiceId("Matthew")).toBe("Ruth");
    localStorage.setItem("aic.voice", "Hacker");
    expect(readVoiceId("Stephen")).toBe("Stephen");
    localStorage.clear();
  });
});

describe("one reply, spoken once and in order", () => {
  const player = (gapMs = 0) => {
    const played: string[] = [];
    let playing = 0;
    let overlap = false;
    const starts: number[] = [];
    const q = new SpeechQueue<string>(
      async (t) => {
        await new Promise((r) => setTimeout(r, 5 - (t.length % 5))); // later sentences can synthesize faster
        return t;
      },
      async (c, onBegin) => {
        if (playing) overlap = true;
        playing++;
        starts.push(Date.now());
        onBegin?.();
        await new Promise((r) => setTimeout(r, 8)); // the clip plays; the next starts only on its end
        played.push(c);
        playing--;
      },
      undefined,
      undefined,
      gapMs,
    );
    return { q, played, starts, overlap: () => overlap };
  };
  const reply = "Hi there. The city is quiet. Research has two workers. Want me to start something?";

  it("streamed in tiny pieces, each sentence plays exactly once, in order, never two at a time", async () => {
    const p = player();
    for (let i = 0; i < reply.length; i += 3) {
      const so_far = reply.slice(0, i + 3);
      p.q.update(so_far);
      p.q.update(so_far); // a re-render hands over the same text again: nothing is re-queued
      if (i % 9 === 0) await new Promise((r) => setTimeout(r, 1));
    }
    await p.q.end(reply);
    expect(p.played).toEqual([
      "Hi there.",
      "The city is quiet.",
      "Research has two workers.",
      "Want me to start something?",
    ]);
    expect(p.overlap()).toBe(false);
  });

  it("a finished text that replaces the streamed one repeats nothing and never speaks a fragment", async () => {
    const p = player();
    p.q.push("Let me check. "); // written before a tool call
    p.q.push("Hi there. The city");
    await p.q.end("Hi there. The city is quiet. Nothing needs you."); // the final text, without the preamble
    expect(p.played).toEqual(["Let me check.", "Hi there.", "The city is quiet.", "Nothing needs you."]);
  });

  it("leaves a short pause between sentences", async () => {
    const p = player(60);
    await p.q.end("One. Two.");
    expect(p.played).toEqual(["One.", "Two."]);
    expect(p.starts[1]! - p.starts[0]!).toBeGreaterThanOrEqual(8 + 55); // the clip, then the breath
  });

  it("a new reply flushes the old one: nothing queued from it plays afterwards", async () => {
    const old = player();
    old.q.update("First old. Second old. Third old. ");
    await new Promise((r) => setTimeout(r, 12)); // the first is playing
    old.q.stop(); // the next reply starts (or the owner tapped the mic or Send)
    old.q.update("First old. Second old. Third old. Fourth old.");
    await old.q.end();
    expect(old.played.length).toBeLessThanOrEqual(1);
    expect(old.played.every((s) => s === "First old.")).toBe(true);
  });
});

describe("sentencesOf", () => {
  it("is stable as the text grows, so a cursor over it never shifts", () => {
    const full = "**Done.** I made 3 apps:\n1. Snake\n2. Pong\nWant more?";
    const all = sentencesOf(full, true);
    expect(all).toEqual(["Done.", "I made 3 apps:", "Snake", "Pong", "Want more?"]);
    for (let i = 0; i <= full.length; i++) {
      const part = sentencesOf(full.slice(0, i));
      expect(all.slice(0, part.length)).toEqual(part);
    }
  });
});
