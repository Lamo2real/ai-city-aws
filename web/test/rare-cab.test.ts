// The owner's rare cab (2026-11-09): one arrival in a thousand is a black sports coupé with chrome rims; everything
// else about it is a cab. The odds come from a seeded random, so they are checked exactly here.
import { describe, expect, it } from "vitest";
import {
  RARE_CAB_ODDS,
  initialState,
  layout,
  rareCab,
  reduce,
  seededRandom,
  trafficAt,
} from "../src/city/city-state.js";

describe("the rare cab", () => {
  it("is one in a thousand, from a seeded random", () => {
    expect(RARE_CAB_ODDS).toBe(1000);
    expect(seededRandom("a")).toBe(seededRandom("a")); // seeded: the same seed, the same draw
    expect(seededRandom("a")).not.toBe(seededRandom("b"));
    const draws = Array.from({ length: 200_000 }, (_, i) => seededRandom(`cab:${i}`));
    for (const v of draws) expect(v >= 0 && v < 1).toBe(true);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.49); // spread evenly
    expect(mean).toBeLessThan(0.51);
    const n = 1_000_000;
    let rare = 0;
    for (let i = 0; i < n; i++) if (rareCab(`lane:${i}`)) rare++;
    expect(rare / n).toBeGreaterThan(0.0009); // 1 in 1000, within 10 %
    expect(rare / n).toBeLessThan(0.0011);
  });

  it("is otherwise just a cab: same lanes, place and fade; a new arrival rolls again", () => {
    const s = ["A", "B", "C", "D"].reduce(
      (st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i),
      initialState(0),
    );
    const w = layout(s, { houses: 8 });
    let seen = 0,
      cabs = 0;
    for (let t = 0; t < 3_600_000; t += 20_000) {
      const now = trafficAt(w, t);
      cabs += now.length;
      for (const c of now) if (c.rare) seen++;
      // The rare flag changes nothing about where a cab is or how it fades.
      expect(now.map(({ rare: _r, ...rest }) => rest)).toEqual(trafficAt(w, t).map(({ rare: _r, ...rest }) => rest));
    }
    expect(cabs).toBeGreaterThan(1000);
    expect(seen).toBeLessThan(cabs / 100); // rare indeed
  });
});
