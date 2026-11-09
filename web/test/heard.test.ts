import { describe, expect, it } from "vitest";
import { confidence, isOwnerSpeech, newWords, standsOut } from "../src/voice/heard.ts";

const reply = "Sir, I only caught OK there. Was that a yes to something I said, or did you want me to do something?";

describe("VAIC's own voice is never sent as the owner's words", () => {
  const spans = [{ start: 1000, end: 6000 }];
  it("drops the echoes from the owner's screenshot: 'OK. OK.', 'Oh. something.' while VAIC spoke", () => {
    expect(isOwnerSpeech("OK. OK.", reply, 2000, spans)).toBe(false);
    expect(isOwnerSpeech("Oh. something.", reply, 5000, spans)).toBe(false);
    expect(isOwnerSpeech("something", reply, 6400, spans)).toBe(false); // the tail, just after VAIC stopped
  });
  it("keeps the owner talking over VAIC with new words, and anything said after VAIC finished", () => {
    expect(isOwnerSpeech("No, check the calendar instead", reply, 3000, spans)).toBe(true);
    expect(isOwnerSpeech("yes", reply, 8000, spans)).toBe(true); // an answer after the question
    expect(newWords("check my email", reply)).toBe(3);
  });
  it("without timings, only an VAIC that is still speaking counts", () => {
    expect(isOwnerSpeech("OK", reply, null, [{ start: 1000, end: Infinity }])).toBe(false);
    expect(isOwnerSpeech("OK", reply, null, spans)).toBe(true);
  });
});

describe("the room's noise is not the owner", () => {
  it("averages Transcribe's word confidence", () => {
    expect(
      confidence([
        { Type: "pronunciation", Confidence: 0.4 },
        { Type: "punctuation" },
        { Type: "pronunciation", Confidence: 0.6 },
      ]),
    ).toBeCloseTo(0.5);
    expect(confidence([])).toBeNull();
  });
  it("speech close to the mic stands out from steady music; the music alone does not", () => {
    const now = 10_000;
    const music = Array.from({ length: 60 }, (_, i) => ({ t: now - 9000 + i * 150, v: 0.05 + (i % 3) * 0.005 }));
    expect(standsOut(music, now)).toBe(false);
    expect(standsOut([...music, { t: now - 500, v: 0.2 }], now)).toBe(true);
    expect(standsOut(music.slice(0, 5), now)).toBe(true); // too early to judge: keep it
  });
});
