// The larger map with no dead ends (the owner, 2026-11-09): every street runs edge to edge and on off the map,
// houses sit in blocks between the streets (never on a road), and the avenue runs on past the houses on a phone.
import { describe, expect, it } from "vitest";
import { TILE, homeSpot, initialState, layout, reduce, walkRoute, type CityState } from "../src/city/city-state.js";

const city = (n: number): CityState =>
  Array.from({ length: n }, (_, i) => `Dept ${i}`).reduce(
    (s, name, i) => reduce(s, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, 1000 + i),
    initialState(0),
  );
const STREET = 3,
  HOUSE_W = 3,
  HOUSE_H = 3; // a house with its yard is about three tiles deep
const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the map", () => {
  for (const portrait of [false, true])
    for (const [depts, houses] of [
      [3, 8],
      [12, 8],
      [12, 40],
    ] as const)
      it(`${portrait ? "phone" : "wide"}, ${depts} departments, ${houses} houses: no dead ends, no house on a road`, () => {
        const w = layout(city(depts), { portrait, houses });
        expect(w.streets.length).toBeGreaterThanOrEqual(2);
        for (const s of w.streets) expect([s.x0, s.x1]).toEqual([0, w.width]); // edge to edge, then on off the map
        const roads = [
          ...w.streets.map((s) => ({ x: s.x0, y: s.y, w: s.x1 - s.x0, h: STREET })),
          { x: w.avenue, y: portrait ? w.hqStreet : 0, w: STREET, h: w.height },
        ];
        expect(w.homes.houses.length).toBe(houses);
        for (const h of w.homes.houses)
          for (const r of roads) expect(overlaps({ ...h, w: HOUSE_W, h: HOUSE_H }, r)).toBe(false);
        for (const t of [...w.buildings, w.hq])
          for (const s of w.streets) expect(overlaps(t, { x: s.x0, y: s.y, w: s.x1 - s.x0, h: STREET })).toBe(false);
        expect(w.height).toBeGreaterThanOrEqual(Math.max(...w.homes.houses.map((h) => h.y + HOUSE_H)));
      });

  it("on the wide map HQ's street and the first row of towers' street are one road", () => {
    const w = layout(city(6), { houses: 8 });
    expect(w.streets[0]!.y).toBe(w.hq.y + w.hq.h);
    expect(w.streets[0]!.y).toBe(w.buildings[0]!.y + w.buildings[0]!.h);
  });

  it("a walk from any house reaches a street", () => {
    const w = layout(city(6), { houses: 30 });
    const lanes = new Set(w.streets.map((s) => (s.y + STREET / 2) * TILE));
    for (let i = 0; i < 30; i++) {
      const from = homeSpot(w, i * 2)!;
      const route = walkRoute(w, from, { x: (w.avenue + 1.5) * TILE, y: (w.streets[0]!.y + 1.5) * TILE });
      expect(route.some((p) => lanes.has(p.y))).toBe(true);
    }
  });
});
