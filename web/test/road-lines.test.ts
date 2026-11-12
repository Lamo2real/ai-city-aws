// The yellow centre lines (decision 269): they end at a junction's edge, run on through a T on the road that carries
// on, and bend round every corner, joining the two roads' lines with no gap.
import { describe, expect, it } from "vitest";
import { BEND_R, RING_FOOT, WORLD_MARGIN, TILE, centreLines, initialState, junctions, layout, reduce } from "../src/city/city-state.js";

const city = (n: number) =>
  layout(
    Array.from({ length: n }, (_, i) => `D${i}`).reduce((st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i), initialState(0)),
    { homes: 16 },
  );
const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

describe("centre lines", () => {
  for (const n of [4, 12, 30, 60]) {
    it(`meet at every turn and stop at every junction (${n} towers)`, () => {
      const w = city(n), js = junctions(w), { runs, bends } = centreLines(w);
      const arms = (j: (typeof js)[number]) => [j.arms.w, j.arms.e, j.arms.n, j.arms.s].filter(Boolean).length;
      const corners = js.filter((j) => arms(j) === 2 && !(j.arms.w && j.arms.e) && !(j.arms.n && j.arms.s));
      expect(corners.length).toBeGreaterThan(0);
      expect(bends.length).toBe(corners.length);
      for (const j of corners) {
        const b = bends.find((k) => k.j === j.id)!;
        expect(b).toBeDefined();
        // The bend starts where the street's line ends and finishes where the avenue's line ends: no gap.
        const street = runs.find((r) => r.axis === "x" && near(r.at, j.cy) && (near(r.from, b.from.x) || near(r.to, b.from.x)));
        const avenue = runs.find((r) => r.axis === "y" && near(r.at, j.cx) && (near(r.from, b.to.y) || near(r.to, b.to.y)));
        expect(street, `street line into ${j.id}`).toBeDefined();
        expect(avenue, `avenue line into ${j.id}`).toBeDefined();
        expect(near(b.from.y, j.cy) && near(b.to.x, j.cx)).toBe(true); // on each road's centre
        expect(near(Math.hypot(b.from.x - b.cx, b.from.y - b.cy), BEND_R) && near(Math.hypot(b.to.x - b.cx, b.to.y - b.cy), BEND_R)).toBe(true); // a true quarter circle
      }
      for (const j of js) {
        const throughX = j.arms.w && j.arms.e && !(j.arms.n && j.arms.s) && j.kind !== "roundabout";
        const throughY = j.arms.n && j.arms.s && !(j.arms.w && j.arms.e) && j.kind !== "roundabout";
        for (const r of runs) {
          const on = r.axis === "x" ? near(r.at, j.cy) && r.from < j.cx && r.to > j.cx : near(r.at, j.cx) && r.from < j.cy && r.to > j.cy;
          if (on) expect(r.axis === "x" ? throughX : throughY, `line through ${j.id}`).toBe(true); // only the road running on through a T
        }
      }
      // Every end of a line is at a junction's edge (or a roundabout's ring), at a bend, or off the map.
      const M = WORLD_MARGIN * TILE;
      for (const r of runs) for (const [end, cap] of [[r.from, r.cap0], [r.to, r.cap1]] as const) {
        const offMap = r.axis === "x" ? near(end, w.left * TILE - M) || near(end, w.width * TILE + M) : near(end, w.top * TILE - M) || near(end, w.height * TILE + M);
        const atJunction = js.some((j) => (r.axis === "x" ? near(r.at, j.cy) && [BEND_R, RING_FOOT].some((h) => near(Math.abs(end - j.cx), h)) : near(r.at, j.cx) && [BEND_R, RING_FOOT].some((h) => near(Math.abs(end - j.cy), h))));
        expect(offMap ? !cap : atJunction && !!cap, `${r.axis} line at ${r.at} ending at ${end}`).toBe(true);
      }
    });
  }
});
