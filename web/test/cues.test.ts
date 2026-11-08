import { describe, expect, it } from "vitest";
import { nextCue } from "../src/voice/cues.ts";

describe("thinking cues", () => {
  it("are short, varied and never the same twice in a row", () => {
    const said = Array.from({ length: 30 }, (_, i) => nextCue(i % 3));
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    expect(new Set(said).size).toBeGreaterThan(4);
    for (const c of said) expect(c.split(" ").length).toBeLessThanOrEqual(8);
  });
  it("start with a thinking line, later ones say AIC is still at it", () => {
    expect(nextCue(0, () => 0)).toMatch(/think|sec|check|moment|look|see|pull/i);
    expect(nextCue(1, () => 0)).toMatch(/still|almost|bear|pulling|nearly/i);
  });
});
