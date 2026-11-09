// The design system lives in one place (the owner, 2026-11-09): the accent fill, its ink, edge and shadow, the
// button shape and the motion curves are tokens on :root, and every shared piece uses the token, never a copy.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(`${import.meta.dirname}/../src/styles.css`, "utf8");
const count = (needle: string) => css.split(needle).length - 1;

describe("design tokens", () => {
  it("defines the accent and motion once, on :root", () => {
    for (const t of [
      "--accent-fill:",
      "--accent-ink:",
      "--accent-edge:",
      "--accent-shadow:",
      "--btn-radius:",
      "--ease:",
      "--press:",
    ])
      expect(count(t), t).toBe(1);
  });
  it("never repeats the accent gradient, its glow or the standard curve outside the tokens", () => {
    expect(count("rgba(249, 201, 118, 0.96)")).toBe(1);
    expect(count("0 10px 24px -12px rgba(232, 163, 61")).toBe(0);
    expect(count("cubic-bezier(0.4, 0, 0.2, 1)")).toBe(1);
  });
  it("accent buttons are flat: no glow", () => {
    expect(css).toMatch(/--accent-shadow:\s*none;/);
    expect(css).toMatch(/\.btn-primary \{[^}]*background: var\(--accent-fill\)/);
  });
});
