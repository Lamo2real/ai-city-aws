import { describe, expect, it } from "vitest";
import { aroundBarge, confidence, isOwnerSpeech, newWords, standsOut, stripEcho } from "../src/voice/heard.ts";

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
    expect(standsOut(music, now - 3000, now)).toBe(false);
    expect(standsOut([...music, { t: now - 500, v: 0.2 }], now - 1000, now)).toBe(true);
    expect(standsOut(music.slice(0, 5), now - 3000, now)).toBe(true); // too early to judge: keep it
  });
  it("judges the phrase's own moment, not the quiet before a late final (the owner couldn't speak to it)", () => {
    // The owner said "yes" at 2.0–2.4 s in a quiet room; Transcribe's final came four seconds later.
    const room = Array.from({ length: 80 }, (_, i) => ({ t: i * 85, v: 0.003 }));
    const levels = room.map((l) => (l.t >= 2000 && l.t <= 2400 ? { ...l, v: 0.06 } : l));
    expect(standsOut(levels, 2000, 2400)).toBe(true);
    expect(standsOut(levels, 3600, 6400)).toBe(false); // the old "last three seconds" view saw only the room
  });
});

describe("talking over VAIC (barge-in) is heard", () => {
  const talking = [{ start: 1000, end: Infinity }];
  const said = "Your meeting with Anna is at three tomorrow afternoon in the main office, Sir.";
  it("one word to cut VAIC off is enough ('stop', 'wait', 'no'), when VAIC didn't say it", () => {
    expect(isOwnerSpeech("Stop.", said, 2000, talking)).toBe(true);
    expect(isOwnerSpeech("wait", said, 2000, talking)).toBe(true);
    expect(isOwnerSpeech("No", said, null, talking)).toBe(true);
    expect(isOwnerSpeech("tomorrow", said, 2000, talking)).toBe(false); // VAIC's own word coming back
  });
  it("after VAIC was cut off, the interrupting phrase counts even with one word of the owner's own", () => {
    const cutAt = 4000;
    const quiet = [{ start: 1000, end: cutAt }];
    expect(isOwnerSpeech("is the meeting Monday", said, 3200, quiet)).toBe(false); // without the barge-in: too little
    expect(isOwnerSpeech("is the meeting Monday", said, 3200, quiet, { bargedAt: cutAt })).toBe(true);
    // Long before the barge-in it is still judged as echo.
    expect(isOwnerSpeech("the main office", said, 1200, quiet, { bargedAt: cutAt })).toBe(false);
  });
  it("a live partial must be mostly the owner's own words before it stops VAIC", () => {
    expect(isOwnerSpeech("meeting with Anna is at tree tomato", said, null, talking, { partial: true })).toBe(false);
    expect(isOwnerSpeech("can you move it to Friday", said, null, talking, { partial: true })).toBe(true);
  });
  it("knows which phrase belongs to the barge-in", () => {
    expect(aroundBarge(3000, 4000, 0)).toBe(true);
    expect(aroundBarge(5000, 4000, 0)).toBe(true);
    expect(aroundBarge(9000, 4000, 0)).toBe(false);
    expect(aroundBarge(null, 4000, 6000)).toBe(true);
    expect(aroundBarge(null, 4000, 20_000)).toBe(false);
    expect(aroundBarge(3000, null, 0)).toBe(false);
  });
  it("cuts VAIC's last words that Transcribe joined to the front of the owner's", () => {
    expect(stripEcho("in the main office wait, make it Friday", said)).toBe("wait, make it Friday");
    expect(stripEcho("the meeting, make it Friday", said)).toBe("the meeting, make it Friday"); // too short to tell
    expect(stripEcho("Move the meeting to Friday", said)).toBe("Move the meeting to Friday");
  });
});
