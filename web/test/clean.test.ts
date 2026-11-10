import { describe, expect, it } from "vitest";
import { cleanSpeech } from "../src/voice/clean.ts";

describe("the owner's words without the stumbles", () => {
  it("drops fillers and stammers", () => {
    expect(cleanSpeech("Um, so, uh, what's the status?")).toBe("So what's the status?");
    expect(cleanSpeech("I I think we should, um, ship it")).toBe("I think we should ship it");
    expect(cleanSpeech("the the the report is done")).toBe("the report is done");
    expect(cleanSpeech("w- well, let's go")).toBe("well, let's go");
    expect(cleanSpeech("Hmm, uhm, can you check the costs, er, today?")).toBe("Can you check the costs today?");
  });
  it("an utterance of only fillers is nothing at all", () => {
    expect(cleanSpeech("Um, um, um, well, um, maybe, um.")).toBe("");
    expect(cleanSpeech("Um")).toBe("");
    expect(cleanSpeech("uh huh, hmm.")).toBe("");
  });
  it("keeps short real answers", () => {
    expect(cleanSpeech("Yes.")).toBe("Yes.");
    expect(cleanSpeech("um, no")).toBe("no");
    expect(cleanSpeech("Stop")).toBe("Stop");
  });
  it("keeps words inside quotation marks exactly as said", () => {
    expect(cleanSpeech('Remove the words "um" and "uh" from the app')).toBe(
      'Remove the words "um" and "uh" from the app',
    );
    expect(cleanSpeech("Um, add a button that says “the the end”")).toBe("Add a button that says “the the end”");
  });
  it("leaves ordinary words that only look like fillers", () => {
    expect(cleanSpeech("Ahmed and Erik have a meeting with Humana")).toBe("Ahmed and Erik have a meeting with Humana");
    expect(cleanSpeech("That that is fine")).toBe("That is fine");
  });
  it("Vice, heard or spelled, is always written VAIC; ordinary uses of the word stay (the rebrand, 2026-11-09)", () => {
    expect(cleanSpeech("Hey Vice, what's the status?")).toBe("Hey VAIC, what's the status?");
    expect(cleanSpeech("yo vice can you check V A I C's tasks")).toBe("yo VAIC can you check VAIC's tasks");
    expect(cleanSpeech("the vice president said it's vice versa")).toBe("the vice president said it's vice versa");
    expect(cleanSpeech("like Vice City in GTA")).toBe("like Vice City in GTA");
    expect(cleanSpeech("VAIC, ship it")).toBe("VAIC, ship it");
    expect(cleanSpeech('Name the button "Vice"')).toBe('Name the button "Vice"');
    expect(cleanSpeech("advice and device stay")).toBe("advice and device stay");
  });
  it("Vaic, heard or spelled, is always written VAIC; quoted words stay", () => {
    expect(cleanSpeech("Hey Vaic, what's the status?")).toBe("Hey VAIC, what's the status?");
    expect(cleanSpeech("vaic can you check A C E's tasks")).toBe("VAIC can you check VAIC's tasks");
    expect(cleanSpeech("A-C-E, ship it")).toBe("VAIC, ship it");
    expect(cleanSpeech('Name the button "Ace"')).toBe('Name the button "Ace"');
    expect(cleanSpeech("Grace and Candace are here")).toBe("Grace and Candace are here");
  });
});
