import { describe, expect, it } from "vitest";
import { nextShown, revealable } from "../src/components/StreamedText.tsx";

describe("AIC's reply is revealed at a steady pace", () => {
  it("moves a little each frame, never past what has arrived", () => {
    expect(nextShown(0, 200, 16)).toBeGreaterThan(0);
    expect(nextShown(0, 200, 16)).toBeLessThan(200);
    expect(nextShown(195, 200, 100)).toBe(200);
    expect(nextShown(200, 200, 16)).toBe(200);
  });
  it("catches up faster when a big batch arrives, so it never lags far behind", () => {
    const calm = nextShown(0, 20, 100) - 0;
    const behind = nextShown(0, 2000, 100) - 0;
    expect(behind).toBeGreaterThan(calm * 5);
    let s = 0;
    for (let t = 0; t < 2000; t += 16) s = nextShown(s, 2000, 16); // 2 s of frames
    expect(s).toBe(2000);
  });
});

describe("half-arrived Markdown is held back so nothing flickers", () => {
  it("an unclosed **bold** or `code` waits from its opening marker", () => {
    expect(revealable("All **quiet** today", 8)).toBe("All ");
    expect(revealable("All **quiet** today", 13)).toBe("All **quiet**");
    expect(revealable("run `npm test` now", 9)).toBe("run ");
  });
  it("a table row waits until it is whole, and a header waits for its rule line", () => {
    const t = "Here:\n| Dept | Spend |\n|---|---|\n| Research | $0.30 |";
    expect(revealable(t, 12)).toBe("Here:");
    expect(revealable(t, "Here:\n| Dept | Spend |".length)).toBe("Here:");
    expect(revealable(t, "Here:\n| Dept | Spend |\n|---|---|\n| Rese".length)).toBe(
      "Here:\n| Dept | Spend |\n|---|---|",
    );
    expect(revealable(t, t.length)).toBe(t);
  });
  it("plain text is shown as it arrives", () => {
    expect(revealable("Hello there", 5)).toBe("Hello");
  });
});
