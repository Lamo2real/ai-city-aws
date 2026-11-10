import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceVisualizer, speakerOf } from "../src/components/VoiceVisualizer.tsx";
import { logVoiceError, micProblem, voiceCredentials } from "../src/voice/voice.ts";

afterEach(cleanup);
const err = (name: string) => Object.assign(new Error("x"), { name });

describe("microphone errors say what went wrong and what to do", () => {
  it("a blocked permission says how to allow it", () => {
    expect(micProblem(err("NotAllowedError"))).toMatch(/blocked for this site.*Safari.*Microphone/);
  });
  it("no microphone, a busy microphone and an unsupported browser each get their own sentence", () => {
    expect(micProblem(err("NotFoundError"))).toMatch(/No microphone was found/);
    expect(micProblem(err("NotReadableError"))).toMatch(/Another app is using the microphone/);
    expect(micProblem(err("NoMicSupport"))).toMatch(/cannot use the microphone here/);
  });
  it("speech-service failures say the microphone is fine and name the AWS error", () => {
    expect(micProblem(err("NotAuthorizedException"))).toMatch(
      /speech service.*NotAuthorizedException.*microphone itself is fine/,
    );
    expect(micProblem(err("AccessDeniedException"))).toMatch(/AccessDeniedException/);
    expect(micProblem({ $metadata: { websocketSynthetic500Error: true } })).toMatch(/could not be reached/);
    expect(micProblem(err("SignedOut"))).toMatch(/fresh sign-in/);
  });
  it("anything else names what the browser said, never a bare generic sentence", () => {
    expect(micProblem(new Error("boom"))).toBe(
      "The microphone could not start (Error: boom). Try again, or type instead.",
    );
    expect(micProblem(null)).toMatch(/could not start \(Error\)/);
  });
  it("names the Safari and deploy cases", () => {
    expect(micProblem(new TypeError("Importing a module script failed."))).toMatch(/AI City was updated.*Reload/);
    expect(micProblem(new TypeError("Failed to fetch dynamically imported module: x.js"))).toMatch(/Reload the page/);
    expect(micProblem(err("AudioSuspended"))).toMatch(/kept audio paused.*Tap the mic again/);
    expect(micProblem(err("InvalidStateError"))).toMatch(/audio could not start \(InvalidStateError/);
    expect(micProblem(new TypeError("Load failed"))).toMatch(/could not be reached \(the browser blocked or lost/);
    expect(micProblem(err("CredentialsProviderError"))).toMatch(/speech sign-in/);
  });
  it("the real error goes to the console so it can be diagnosed", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logVoiceError("the microphone could not start", err("NotAllowedError"));
    expect(spy.mock.calls[0]?.slice(0, 2)).toEqual(["[VAIC voice] the microphone could not start:", "NotAllowedError"]);
    spy.mockRestore();
  });
});

describe("the voice strip", () => {
  it("maps VAIC's presence to who is talking", () => {
    expect(speakerOf("listening")).toBe("you");
    expect(speakerOf("speaking")).toBe("vaic");
    expect(speakerOf("thinking")).toBe("thinking");
    expect(speakerOf("idle")).toBe("idle");
    expect(speakerOf("waiting")).toBe("idle");
  });
  it.each([
    ["listening", "you", "Listening to you"],
    ["speaking", "vaic", "VAIC is talking"],
    ["thinking", "thinking", "VAIC is thinking…"],
    ["idle", "idle", "Tap the mic or type"],
  ] as const)("says the %s state in words, not only colour", (presence, speaker, words) => {
    const { container } = render(
      <VoiceVisualizer presence={presence} listening={presence === "listening"} onMic={() => undefined} />,
    );
    expect(container.querySelector(".voice")?.getAttribute("data-speaker")).toBe(speaker);
    expect(screen.getByRole("status").textContent).toContain(words);
    expect(
      screen.getByRole("button", { name: presence === "listening" ? "Stop listening" : "Talk to VAIC" }),
    ).toBeTruthy();
  });
});

describe("voice credentials from the identity pool", () => {
  const creds = { accessKeyId: "A", secretAccessKey: "S" };
  const refused = () => Object.assign(new Error("Invalid login token."), { name: "NotAuthorizedException" });

  it("passes the owner's ID token to the identity pool", async () => {
    const seen: string[] = [];
    const get = voiceCredentials(
      async () => "tok-1",
      (t) => async () => (seen.push(t), creds),
    );
    expect(await get()).toEqual(creds);
    expect(seen).toEqual(["tok-1"]);
  });
  it("when the pool refuses the token, it asks Cognito for a fresh token once and tries again", async () => {
    const asked: boolean[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const get = voiceCredentials(
      async (fresh) => (asked.push(fresh), fresh ? "fresh" : "stale"),
      (t) => async () => {
        if (t === "stale") throw refused();
        return creds;
      },
    );
    expect(await get()).toEqual(creds);
    expect(asked).toEqual([false, true]);
    spy.mockRestore();
  });
  it("gives up after one retry and shows the AWS message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const get = voiceCredentials(
      async () => "tok",
      () => async () => {
        throw refused();
      },
    );
    const e = await get().catch((x: unknown) => x);
    expect(micProblem(e)).toMatch(/NotAuthorizedException: Invalid login token\./);
    spy.mockRestore();
  });
  it("a signed-out owner is told to sign in again", async () => {
    const get = voiceCredentials(
      async () => null,
      () => async () => creds,
    );
    expect(micProblem(await get().catch((x: unknown) => x))).toMatch(/fresh sign-in/);
  });
});
