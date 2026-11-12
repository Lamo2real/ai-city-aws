// The larger map with no dead ends (the owner, 2026-11-09): every street runs edge to edge and on off the map,
// homes sit in blocks between the streets (never on a road), and the avenue runs on past them on a phone.
// The homes are three New York apartment buildings a block since decision 188.
import { describe, expect, it } from "vitest";
import {
  TILE,
  commuteRoute,
  doorOf,
  homeOf,
  homeSpot,
  initialState,
  layout,
  reduce,
  walkRoute,
  type CityState,
} from "../src/city/city-state.js";

const city = (n: number): CityState =>
  Array.from({ length: n }, (_, i) => `Dept ${i}`).reduce(
    (s, name, i) => reduce(s, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, 1000 + i),
    initialState(0),
  );
const STREET = 3;
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the map", () => {
  for (const portrait of [false, true])
    for (const [depts, homes] of [
      [3, 16],
      [12, 16],
      [12, 80],
    ] as const)
      it(`${portrait ? "phone" : "wide"}, ${depts} departments, ${homes} homes: no dead ends, no building on a road`, () => {
        const w = layout(city(depts), { portrait, homes });
        expect(w.streets.length).toBeGreaterThanOrEqual(2);
        // The street between HQ and the homes runs edge to edge, then on off the map; every street reaches the avenue.
        expect(w.streets.some((s) => s.x0 === w.left && s.x1 === w.width)).toBe(true);
        for (const s of w.streets) expect(s.x0 <= w.avenue && s.x1 >= w.avenue + STREET).toBe(true);
        const roads = [
          ...w.streets.map((s) => ({ x: s.x0, y: s.y, w: s.x1 - s.x0, h: STREET })),
          { x: w.avenue, y: w.top, w: STREET, h: w.height - w.top },
          ...((w.lanes ?? []) as Array<{ x: number; y0: number; y1: number }>).map((l) => ({ x: l.x, y: l.y0, w: STREET, h: l.y1 - l.y0 })),
        ];
        expect(w.homes.blocks.length).toBe(1); // one block of homes, however many live there (decision 213)
        expect(w.homes.apartments.length).toBe(3);
        // Room for every resident, each by a door, and nobody stands on a road.
        for (let slot = 0; slot < homes; slot++) {
          const spot = homeSpot(w, slot)!;
          expect(spot).not.toBeNull();
          for (const r of roads) expect(overlaps({ x: spot.x / TILE, y: spot.y / TILE, w: 0.01, h: 0.01 }, r)).toBe(false);
        }
        for (const a of w.homes.apartments) {
          for (const r of roads) expect(overlaps(a, r)).toBe(false);
          for (const b of w.homes.apartments) if (a !== b) expect(overlaps(a, b)).toBe(false);
          for (const t of [...w.buildings, w.hq]) expect(overlaps(a, t)).toBe(false);
        }
        for (const t of [...w.buildings, w.hq])
          for (const s of w.streets) expect(overlaps(t, { x: s.x0, y: s.y, w: s.x1 - s.x0, h: STREET })).toBe(false);
        expect(w.height).toBeGreaterThanOrEqual(Math.max(...w.homes.apartments.map((a) => a.y + a.h)));
      });

  it("HQ, the homes and every tower stand on a street, the towers beside HQ on HQ's own street", () => {
    const w = layout(city(7), { homes: 16 });
    const streets = new Set(w.streets.map((s) => s.y));
    expect(streets.has(w.hq.y + w.hq.h)).toBe(true);
    for (const b of w.buildings) expect(streets.has(b.y + b.h)).toBe(true);
    expect(streets.has(w.homes.y + w.homes.h)).toBe(true);
    const beside = w.buildings.filter((b) => b.y + b.h === w.hq.y + w.hq.h);
    expect(beside.length).toBeGreaterThanOrEqual(1); // the town grows out from HQ
  });

  it("a walk from any home reaches a street", () => {
    const w = layout(city(6), { homes: 60 });
    const lanes = new Set(w.streets.map((s) => (s.y + STREET / 2) * TILE));
    for (let i = 0; i < 60; i++) {
      const from = homeSpot(w, i)!;
      const route = walkRoute(w, from, { x: (w.avenue + 1.5) * TILE, y: (w.streets[0]!.y + 1.5) * TILE });
      expect(route.some((p) => lanes.has(p.y))).toBe(true);
    }
  });
});

describe("the apartment buildings (decision 188)", () => {
  for (const portrait of [false, true])
    it(`${portrait ? "phone" : "wide"}: three of different sizes, placed unevenly, with a courtyard between`, () => {
      const w = layout(city(4), { portrait, homes: 16 });
      const apts = w.homes.apartments;
      expect(apts.map((a) => a.kind)).toEqual(["slim", "mid", "wide"]);
      const [slim, mid, wide] = apts as unknown as [Box, Box, Box];
      expect(slim.h).toBeGreaterThan(mid.h); // the tall slim one
      expect(mid.h).toBeGreaterThan(wide.h); // the wide shorter one
      expect(wide.w).toBeGreaterThan(mid.w);
      expect(mid.w).toBeGreaterThan(slim.w);
      expect(new Set(apts.map((a) => a.y + a.h)).size).toBe(3); // no tidy row: each stands at its own depth
      const block = w.homes.blocks[0]!;
      const built = apts.reduce((n, a) => n + a.w * a.h, 0);
      expect(built).toBeLessThan(block.w * block.h * 0.75); // some green left over
    });

  it("residents stand by their own building's door, sharing the one block's three buildings", () => {
    const w = layout(city(6), { homes: 48 });
    expect(w.homes.blocks.map((b) => b.mirror)).toEqual([false]); // one block (decision 213): its residents share it
    const per = new Map<object, number>();
    for (let slot = 0; slot < 48; slot++) {
      const a = homeOf(w, slot)!, spot = homeSpot(w, slot)!, d = doorOf(a);
      per.set(a, (per.get(a) ?? 0) + 1);
      expect(Math.abs(spot.x - d.x)).toBeLessThanOrEqual(20);
      expect(spot.y).toBeGreaterThan((a.y + a.h) * TILE); // on the pavement in front
      expect(spot.y - d.y).toBeLessThan(24);
    }
    expect([...per.values()]).toEqual(Array(3).fill(16));
  });

  it("nothing stands between a door and the street below it, so a walk never cuts through a building", () => {
    for (const portrait of [false, true]) {
      const w = layout(city(6), { portrait, homes: 48 });
      for (const a of w.homes.apartments) {
        const d = doorOf(a);
        for (const b of w.homes.apartments)
          if (b !== a && b.block === a.block && b.y >= a.y + a.h) expect(d.x <= b.x * TILE || d.x >= (b.x + b.w) * TILE).toBe(true);
      }
    }
  });

  it("a commute from home goes out through the building's door, and the walk home ends at it", () => {
    const w = layout(city(4), { homes: 16 });
    const tower = w.buildings[0]!;
    for (let slot = 0; slot < 16; slot++) {
      const home = homeSpot(w, slot)!, apt = homeOf(w, slot)!;
      const out = commuteRoute(w, home, doorOf(tower), { leaving: apt, entering: tower });
      expect(out[0]).toEqual(doorOf(apt));
      const back = commuteRoute(w, doorOf(tower), home, { leaving: tower, entering: apt });
      expect(back.at(-2)).toEqual(doorOf(apt));
      expect(back.at(-1)).toEqual(home);
    }
  });
});
