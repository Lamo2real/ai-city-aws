// The project chat is one list, oldest first (decision 281): messages and builders' steps by when they happened.
import { describe, expect, it } from "vitest";
import { timeline, type Step } from "../src/lib/buildSteps.ts";

const step = (at: number, text: string): Step => ({ at, agent: "wkr-1", activity: "running", text });
describe("timeline", () => {
  it("puts new messages after older steps, and keeps steps in a row together", () => {
    const lines = [
      { id: "a", at: 1 },
      { id: "b", at: 50 },
      { id: "c", at: 51 },
    ];
    const out = timeline(lines, [
      step(10, "Searched"),
      step(20, "Hired a worker"),
      step(60, "Ran tests"),
      step(50, "same ms"),
    ]);
    expect(out.map((e) => (e.kind === "line" ? e.line.id : e.steps.map((s) => s.text).join("+")))).toEqual([
      "a",
      "Searched+Hired a worker",
      "b",
      "same ms",
      "c",
      "Ran tests",
    ]);
  });
  it("is empty for nothing", () => {
    expect(timeline([], [])).toEqual([]);
  });
});
