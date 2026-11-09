import { afterEach, describe, expect, it } from "vitest";
import { isStopPhrase, loopNext } from "../src/voice/convo.ts";
import { rememberBrowserVoice, usingBrowserVoice } from "../src/voice/browserSpeech.ts";
import { SpeechQueue } from "../src/voice/speech.ts";
import { speakProblem } from "../src/voice/voice.ts";

afterEach(() => sessionStorage.clear());

describe("the hands-free conversation loop", () => {
  it("arms on a spoken send and reopens the mic after each spoken reply", () => {
    let s = loopNext(false, "voice_sent");
    expect(s).toEqual({ on: true, reopen: false });
    s = loopNext(s.on, "reply_spoken");
    expect(s).toEqual({ on: true, reopen: true }); // VAIC finished talking: listen again
    s = loopNext(s.on, "reply_spoken");
    expect(s.reopen).toBe(true); // and again, turn after turn
  });
  it("ends on a tap, the stop phrase, a silent reply or a mic problem", () => {
    for (const e of ["mic_tap", "stop_phrase", "reply_silent", "problem"] as const) {
      expect(loopNext(true, e)).toEqual({ on: false, reopen: false });
    }
    expect(loopNext(false, "reply_spoken")).toEqual({ on: false, reopen: false }); // never armed: no reopen
  });
  it("hears 'stop listening' and close variants, but not sentences that mention it", () => {
    expect(isStopPhrase("stop listening")).toBe(true);
    expect(isStopPhrase("  Stop listening.  ")).toBe(true);
    expect(isStopPhrase("please stop listening!")).toBe(true);
    expect(isStopPhrase("quit listening")).toBe(true);
    expect(isStopPhrase("stop the mic")).toBe(true);
    expect(isStopPhrase("stop the microphone")).toBe(true);
    expect(isStopPhrase("don't stop listening to feedback")).toBe(false);
    expect(isStopPhrase("stop the deploy")).toBe(false);
    expect(isStopPhrase("stop")).toBe(false); // "stop" alone is a message for VAIC (it can cancel work)
  });
});

describe("a reply that cannot be spoken is reported, never swallowed", () => {
  it("the queue tells its caller about the first failure and keeps going", async () => {
    const problems: unknown[] = [];
    const played: string[] = [];
    const q = new SpeechQueue<string>(
      async (t) => {
        if (t.startsWith("Bad")) throw Object.assign(new Error("refused"), { name: "AccessDeniedException" });
        return t;
      },
      async (c) => void played.push(c),
      undefined,
      (e) => problems.push(e),
    );
    q.push("Bad one. Good one.");
    await q.end();
    expect(played).toEqual(["Good one."]);
    expect(problems).toHaveLength(1);
    expect((problems[0] as { name: string }).name).toBe("AccessDeniedException");
  });
  it("a playback failure is reported too", async () => {
    const problems: unknown[] = [];
    const q = new SpeechQueue<string>(
      async (t) => t,
      async () => {
        throw Object.assign(new Error("blocked"), { name: "AudioPlayError" });
      },
      undefined,
      (e) => problems.push(e),
    );
    q.push("Hello there.");
    await q.end();
    expect(problems).toHaveLength(1);
  });
  it("speakProblem puts the failure in plain words", () => {
    expect(speakProblem(Object.assign(new Error("x"), { name: "AudioPlayError" }))).toMatch(
      /blocked the sound.*Tap the mic/,
    );
    expect(speakProblem(Object.assign(new Error("not authorized"), { name: "AccessDeniedException" }))).toMatch(
      /VAIC's voice could not play \(AccessDeniedException: not authorized\)/,
    );
  });
});

describe("the browser-voice fallback is remembered for the page session only", () => {
  it("off by default, on after a Polly failure, gone next page load", () => {
    expect(usingBrowserVoice()).toBe(false);
    rememberBrowserVoice();
    expect(usingBrowserVoice()).toBe(true);
    sessionStorage.clear(); // what a new page load starts with
    expect(usingBrowserVoice()).toBe(false);
  });
});

describe("telling VAIC's own voice from the owner's while the mic stays open", async () => {
  const { isEcho } = await import("../src/voice/convo.ts");
  it("VAIC's words coming back from the speakers are an echo", () => {
    expect(isEcho("nothing needs you", "All quiet. Nothing needs you.")).toBe(true);
    expect(isEcho("All quiet", "All quiet. Nothing needs you.")).toBe(true);
  });
  it("the owner talking over VAIC is not", () => {
    expect(isEcho("wait, what about yesterday?", "About two dollars today, mostly research.")).toBe(false);
    expect(isEcho("stop", "All quiet. Nothing needs you.")).toBe(false);
  });
});
