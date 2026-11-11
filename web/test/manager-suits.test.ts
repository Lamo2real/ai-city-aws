// The owner (2026-11-11): every Department Manager wears a dark suit (jacket, white shirt, tie) and sunglasses,
// in the City and inside the towers; workers keep their own look.
import { describe, expect, it } from "vitest";
import { SUIT, paintFigure } from "../src/city/scene.js";
import { paintFront } from "../src/lib/officeArt";

// A fake 2D context that keeps the colour of every art pixel painted, so the sprite can be read back.
function pixels(paint: (g: never) => void) {
  const px = new Map<string, string>();
  const g = {
    fillStyle: "" as unknown,
    fillRect(x: number, y: number, w: number, h: number) {
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) px.set(`${i},${j}`, String(this.fillStyle));
    },
    translate() {},
  };
  paint(g as never);
  return { at: (x: number, y: number) => px.get(`${x},${y}`), all: new Set(px.values()) };
}
const manager = { id: "mgr-research", kind: "manager", department: "Research" };
const worker = { id: "wkr-research-1", kind: "worker", department: "Research" };

describe("managers wear a suit and sunglasses", () => {
  it("in the City: dark jacket and trousers, white collar, a tie, sunglasses over both eyes", () => {
    for (const pose of ["rest", "wave", "slump"]) {
      const p = pixels((g) => paintFigure(g, manager, pose, 0));
      const top = 2;
      expect(p.at(3, top + 12), pose).toBe(SUIT.jacket); // jacket
      expect(p.at(4, top + 14), pose).toBe(SUIT.jacket); // suit trousers
      if (pose !== "slump") expect(p.at(6, top + 8), pose).toBe(SUIT.shirt); // white collar (a slumped head hides it)
      const tie = p.at(6, top + 11);
      expect(tie, pose).not.toBe(SUIT.jacket);
      expect(tie, pose).not.toBe(SUIT.shirt);
      const hy = top + (pose === "slump" ? 2 : 0);
      expect(p.at(5, hy + 5), pose).toBe(SUIT.shades); // left lens over the left eye
      expect(p.at(8, hy + 5), pose).toBe(SUIT.shades); // right lens over the right eye
      expect(p.at(4, hy + 4), pose).toBe(SUIT.glint);
    }
  });

  it("keeps the manager's own skin and hair (no hat over it)", () => {
    const p = pixels((g) => paintFigure(g, manager, "rest", 0));
    expect(p.at(4, 2 + 1)).not.toBe(SUIT.shades);
    expect(p.at(3, 2 + 6)).not.toBe(SUIT.jacket); // the cheek is skin
  });

  it("workers keep their own look: no suit, no sunglasses", () => {
    const p = pixels((g) => paintFigure(g, worker, "rest", 0));
    expect(p.all.has(SUIT.shades)).toBe(false);
    expect(p.at(3, 2 + 12)).not.toBe(SUIT.jacket);
  });

  it("inside a tower: the seated manager facing you wears sunglasses, a worker does not", () => {
    const m = pixels((g) => paintFront(g, manager));
    const w = pixels((g) => paintFront(g, worker));
    expect(m.all.has("#101018")).toBe(true);
    expect(m.all.has("#eef0f4")).toBe(true); // the white shirt under the jacket
    expect(w.all.has("#101018")).toBe(false);
  });
});
