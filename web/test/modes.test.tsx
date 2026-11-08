import { afterEach, describe, expect, it } from "vitest";
import { appendDictation, readSpeakMode, shouldSpeak } from "../src/voice/modes.ts";

afterEach(() => localStorage.clear());

describe("when AIC speaks its reply", () => {
  it("by default only when the owner's message came in by voice", () => {
    expect(readSpeakMode()).toBe("auto");
    expect(shouldSpeak("auto", true)).toBe(true);
    expect(shouldSpeak("auto", false)).toBe(false);
    expect(shouldSpeak("auto", undefined)).toBe(false);
  });
  it("always and never override that", () => {
    expect(shouldSpeak("always", false)).toBe(true);
    expect(shouldSpeak("never", true)).toBe(false);
  });
  it("an owner who had muted replies before stays muted; the old 'on' becomes the new default", () => {
    localStorage.setItem("aic.sound", "off");
    expect(readSpeakMode()).toBe("never");
    localStorage.setItem("aic.sound", "on");
    expect(readSpeakMode()).toBe("auto");
    localStorage.setItem("aic.speak", "always");
    expect(readSpeakMode()).toBe("auto"); // "always" is gone with the voice button (decision 112): typed is text
  });
});

describe("dictation", () => {
  it("dictation appends to what is in the box with one space", () => {
    expect(appendDictation("", "hello")).toBe("hello");
    expect(appendDictation("note: ", " buy milk ")).toBe("note: buy milk");
    expect(appendDictation("first part", "second")).toBe("first part second");
    expect(appendDictation("unchanged", "  ")).toBe("unchanged");
  });
});
