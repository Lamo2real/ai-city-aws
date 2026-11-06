import { describe, expect, it } from "vitest";

describe("web test setup", () => {
  it("runs in jsdom", () => {
    expect(typeof document.createElement).toBe("function");
  });
});
