import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceVisualizer, speakerOf } from "../src/components/VoiceVisualizer.tsx";
import { logVoiceError, micProblem } from "../src/voice/voice.ts";

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
  it("anything else falls back to a plain sentence", () => {
    expect(micProblem(new Error("boom"))).toBe("The microphone could not start. Try again, or type instead.");
    expect(micProblem(null)).toMatch(/could not start/);
  });
  it("the real error goes to the console so it can be diagnosed", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logVoiceError("the microphone could not start", err("NotAllowedError"));
    expect(spy.mock.calls[0]?.slice(0, 2)).toEqual(["[AIC voice] the microphone could not start:", "NotAllowedError"]);
    spy.mockRestore();
  });
});

describe("the voice strip", () => {
  it("maps AIC's presence to who is talking", () => {
    expect(speakerOf("listening")).toBe("you");
    expect(speakerOf("speaking")).toBe("aic");
    expect(speakerOf("thinking")).toBe("thinking");
    expect(speakerOf("idle")).toBe("idle");
    expect(speakerOf("waiting")).toBe("idle");
  });
  it.each([
    ["listening", "you", "Listening to you"],
    ["speaking", "aic", "AIC is talking"],
    ["thinking", "thinking", "AIC is thinking…"],
    ["idle", "idle", "Tap the mic or type"],
  ] as const)("says the %s state in words, not only colour", (presence, speaker, words) => {
    const { container } = render(
      <VoiceVisualizer presence={presence} listening={presence === "listening"} onMic={() => undefined} />,
    );
    expect(container.querySelector(".voice")?.getAttribute("data-speaker")).toBe(speaker);
    expect(screen.getByRole("status").textContent).toContain(words);
    expect(
      screen.getByRole("button", { name: presence === "listening" ? "Stop listening" : "Talk to AIC" }),
    ).toBeTruthy();
  });
});
