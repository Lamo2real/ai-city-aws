import { describe, expect, it } from "vitest";
import { speechDetector, speechThreshold } from "../src/voice/bargeIn.ts";

describe("talking over AIC in the standard voice", () => {
  it("sets the bar above the room's noise, never absurdly low or high", () => {
    expect(speechThreshold(0)).toBe(0.1);
    expect(speechThreshold(0.05)).toBeCloseTo(0.2);
    expect(speechThreshold(0.4)).toBe(0.5);
  });
  it("fires only when speech lasts, not on a short noise", () => {
    const heard = speechDetector(200, 100);
    let t = 0;
    for (; t < 100; t += 30) expect(heard(0.02, t)).toBe(false); // the room
    expect(heard(0.4, t)).toBe(false); // a cough…
    t += 30;
    expect(heard(0.02, t)).toBe(false); // …is over
    const from = (t += 30);
    let fired = false;
    for (; t <= from + 300 && !fired; t += 30) fired = heard(0.4, t);
    expect(fired).toBe(true);
    expect(t - from).toBeGreaterThanOrEqual(200);
  });
});
