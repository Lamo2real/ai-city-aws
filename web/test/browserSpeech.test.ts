import { afterEach, describe, expect, it } from "vitest";
import {
  browserListen,
  browserSpeechAvailable,
  canFallBack,
  rememberBrowserSpeech,
  usingBrowserSpeech,
} from "../src/voice/browserSpeech.ts";

const err = (name: string, extra: Record<string, unknown> = {}) => Object.assign(new Error("x"), { name, ...extra });

// A fake browser recognizer: the test drives it through `last`.
type Handler = ((e: unknown) => void) | null;
class FakeRec {
  static last: FakeRec | null = null;
  static starts = 0;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: (() => void) | null = null;
  stopped = false;
  start() {
    FakeRec.last = this;
    FakeRec.starts++;
  }
  stop() {
    this.stopped = true;
  }
  abort() {}
  say(parts: Array<[string, boolean]>) {
    const results = parts.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }));
    this.onresult?.({ resultIndex: 0, results });
  }
}
const win = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };

afterEach(() => {
  delete win.webkitSpeechRecognition;
  delete win.SpeechRecognition;
  FakeRec.last = null;
  FakeRec.starts = 0;
  sessionStorage.clear();
});

describe("when Transcribe fails, switch to the browser's speech recognition?", () => {
  it("yes when the service refused or could not be reached", () => {
    for (const name of [
      "NotAuthorizedException",
      "AccessDeniedException",
      "BadRequestException",
      "CredentialsProviderError",
    ])
      expect(canFallBack(err(name)), name).toBe(true);
    expect(canFallBack({ $metadata: { websocketSynthetic500Error: true } })).toBe(true);
    expect(canFallBack(err("SomethingNew", { $metadata: { httpStatusCode: 403 } }))).toBe(true);
    expect(canFallBack(new TypeError("Load failed"))).toBe(true);
  });
  it("no for microphone problems, which the browser's recognition would hit too", () => {
    for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "NoMicSupport", "SignedOut"])
      expect(canFallBack(err(name)), name).toBe(false);
    expect(canFallBack(new Error("boom"))).toBe(false);
  });
  it("the switch lasts for this page session only", () => {
    expect(usingBrowserSpeech()).toBe(false);
    rememberBrowserSpeech();
    expect(usingBrowserSpeech()).toBe(true);
    sessionStorage.clear(); // a new page load
    expect(usingBrowserSpeech()).toBe(false);
  });
});

describe("listening with the browser's recognition", () => {
  it("is available in Safari and Chrome (webkit prefix) and elsewhere (standard name)", () => {
    expect(browserSpeechAvailable()).toBe(false);
    win.webkitSpeechRecognition = FakeRec;
    expect(browserSpeechAvailable()).toBe(true);
  });
  it("sends live partials and final words, keeps listening after a pause, and stops on tap", () => {
    win.webkitSpeechRecognition = FakeRec;
    const finals: string[] = [];
    const partials: string[] = [];
    const stop = browserListen(
      (t) => finals.push(t),
      (t) => partials.push(t),
    );
    const rec = FakeRec.last!;
    expect([rec.lang, rec.continuous, rec.interimResults]).toEqual(["en-US", true, true]);
    rec.say([["remind me", false]]);
    rec.say([["remind me to call the bank", true]]);
    expect(partials).toEqual(["remind me"]);
    expect(finals).toEqual(["remind me to call the bank"]);
    rec.onend?.(); // the browser stopped after silence
    expect(FakeRec.starts).toBe(2);
    stop();
    expect(FakeRec.last!.stopped).toBe(true);
    FakeRec.last!.onend?.();
    expect(FakeRec.starts).toBe(2); // not restarted after the owner stopped
  });
  it("names a blocked microphone and a lost service; silence is not an error", () => {
    win.SpeechRecognition = FakeRec;
    const errors: Array<{ name?: string }> = [];
    browserListen(
      () => undefined,
      undefined,
      (e) => errors.push(e as { name?: string }),
    );
    FakeRec.last!.onerror?.({ error: "no-speech" });
    expect(errors).toEqual([]);
    FakeRec.last!.onerror?.({ error: "not-allowed" });
    expect(errors[0]?.name).toBe("NotAllowedError");
    browserListen(
      () => undefined,
      undefined,
      (e) => errors.push(e as { name?: string }),
    );
    FakeRec.last!.onerror?.({ error: "network" });
    expect(errors[1]?.name).toBe("BrowserSpeechNetwork");
  });
  it("a browser without it says so plainly", () => {
    expect(() => browserListen(() => undefined)).toThrow(/no speech recognition/);
  });
});
