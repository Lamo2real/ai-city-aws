// The real reply playback (AwsVoice.play) against a stubbed Web Audio: decodeAudioData + AudioBufferSourceNode on
// the context the owner's tap unlocked, "speaking" only from the moment sound starts, and every failure named.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechQueue } from "../src/voice/speech.ts";
import { getVoice, speakProblem } from "../src/voice/voice.ts";

type Src = {
  buffer: unknown;
  onended: (() => void) | null;
  started: boolean;
  connect: () => void;
  start: () => void;
  stop: () => void;
};
let ctxState = "running";
let decodeFails = false;
let sources: Src[] = [];

class FakeCtx {
  state = ctxState;
  destination = {};
  async resume() {
    this.state = ctxState;
  }
  async close() {}
  async decodeAudioData(b: ArrayBuffer) {
    if (decodeFails) throw new Error("bad mp3");
    return { duration: 1, length: b.byteLength };
  }
  createAnalyser() {
    return { fftSize: 0, connect() {}, getFloatTimeDomainData() {} };
  }
  createBufferSource() {
    const s: Src = {
      buffer: null,
      onended: null,
      started: false,
      connect() {},
      start() {
        s.started = true;
      },
      stop() {
        s.onended?.();
      },
    };
    sources.push(s);
    return s;
  }
}

beforeEach(() => {
  ctxState = "running";
  decodeFails = false;
  sources = [];
  vi.stubGlobal("AudioContext", FakeCtx);
  delete (window as unknown as { __vaicVoice?: unknown }).__vaicVoice; // the real AwsVoice, not the test fake
});
afterEach(() => vi.unstubAllGlobals());

const mp3 = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" });

describe("VAIC's reply plays through the tap-unlocked AudioContext", () => {
  it("decodes the clip, starts a buffer source, says when sound begins and resolves when it ends", async () => {
    const v = getVoice();
    v.prime?.(); // the owner's tap
    let began = 0;
    const done = v.play!(mp3(), () => began++);
    await vi.waitFor(() => expect(sources.at(-1)?.started).toBe(true));
    expect(began).toBe(1); // "speaking" from the moment sound starts, not before
    let finished = false;
    void done.then(() => (finished = true));
    await Promise.resolve();
    expect(finished).toBe(false); // still playing
    sources.at(-1)!.onended?.(); // the clip ends
    await done;
  });
  it("stopping (the owner taps the mic) ends the clip at once", async () => {
    const v = getVoice();
    const done = v.play!(mp3());
    await vi.waitFor(() => expect(sources.at(-1)?.started).toBe(true));
    v.stopSpeaking();
    await done; // resolves instead of hanging
  });
  it("when Safari keeps Web Audio paused, the reply plays through the media element unlocked in the tap", async () => {
    const played: string[] = [];
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      played.push(this.src.slice(0, 15));
      if (this.src.startsWith("blob:")) setTimeout(() => this.dispatchEvent(new Event("ended")), 10);
      return Promise.resolve();
    });
    const v = getVoice();
    ctxState = "suspended";
    v.prime?.(); // unlocks the element with a moment of silence, inside the tap
    expect(played[0]).toBe("data:audio/wav;");
    let began = false;
    await v.play!(mp3(), () => (began = true));
    expect(began).toBe(true);
    expect(played.at(-1)).toMatch(/^blob:/);
    play.mockRestore();
  });

  it("names each failure: sound kept paused, empty audio, an undecodable clip", async () => {
    const v = getVoice();
    ctxState = "suspended";
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    v.prime?.();
    await expect(v.play!(mp3())).rejects.toMatchObject({ name: "AudioSuspended" });
    play.mockRestore();
    ctxState = "running";
    v.prime?.();
    await expect(v.play!(new Blob([]))).rejects.toMatchObject({ name: "EmptyAudio" });
    decodeFails = true;
    await expect(v.play!(mp3())).rejects.toMatchObject({ name: "DecodeError" });
  });
});

describe("the queue shows 'speaking' only while sound plays", () => {
  it("onStart fires when play reports the real start, never when a clip is merely queued", async () => {
    const events: string[] = [];
    let release: () => void = () => undefined;
    const q = new SpeechQueue<string>(
      async (t) => t,
      (c, onBegin) =>
        new Promise<void>((r) => {
          events.push(`queued ${c}`);
          release = () => {
            onBegin?.();
            events.push(`playing ${c}`);
            r();
          };
        }),
      () => events.push("speaking"),
    );
    q.push("Hello there. ");
    await vi.waitFor(() => expect(events).toEqual(["queued Hello there."]));
    release();
    await q.end();
    expect(events).toEqual(["queued Hello there.", "speaking", "playing Hello there."]);
  });
});

describe("the voice line's plain words", () => {
  it("cover every playback failure and Polly's own refusals", () => {
    const err = (name: string, message = "x") => Object.assign(new Error(message), { name });
    expect(speakProblem(err("AudioSuspended"))).toMatch(/kept sound paused/);
    expect(speakProblem(err("EmptyAudio"))).toMatch(/returned no audio/);
    expect(speakProblem(err("DecodeError"))).toMatch(/could not decode/);
    expect(speakProblem(err("AccessDeniedException", "not authorized to perform polly:SynthesizeSpeech"))).toMatch(
      /AccessDeniedException: not authorized to perform polly:SynthesizeSpeech/,
    );
  });
});
