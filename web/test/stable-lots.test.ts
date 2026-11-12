// Every tower keeps its lot for good (the owner, 2026-11-12, decision 248): adding a department never moves an
// existing tower, road, home or HQ (it takes the first free lot, else the city grows at the edge); demolishing one
// leaves its lot empty and changes nothing else; the same records always draw the same city.
import { describe, expect, it } from "vitest";
import { applySnapshot, initialState, layout, reduce, type CityState } from "../src/city/city-state.js";

type World = ReturnType<typeof layout>;
const PRESETS = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research", "Media"];
const NOW = Date.UTC(2026, 10, 12);
const record = (name: string, i: number, slot?: number) => ({
  key: name.toLowerCase(),
  name,
  mission: "x",
  manager_id: `mgr-${i}`,
  state: "active",
  created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(),
  ...(slot === undefined ? {} : { slot }),
});
// The owner's city as a server with lots sends it: the presets on lots 0-11, each lot sized by its tower.
const served = (names = PRESETS) =>
  applySnapshot(initialState(0), { departments: names.map((n, i) => record(n, i, i)), lots: names.map((n, i) => ({ slot: i, size: n })), agents: [] }, NOW);
// The same city from a server before lots: the City numbers them itself, in the order it always drew them.
const unnumbered = (names = PRESETS) => applySnapshot(initialState(0), { departments: names.map((n, i) => record(n, i)), agents: [] }, NOW);

const towers = (w: World) => Object.fromEntries(w.buildings.map((b) => [b.dept, [b.x, b.y, b.w, b.h]]));
const fixed = (w: World) => ({ hq: w.hq, avenue: w.avenue, homes: [w.homes.x, w.homes.y, w.homes.apartments], streets: w.streets.map((s) => [s.y, s.x0]) });
// Everything that stood before still stands exactly where it was; the roads only ever gain.
function unmoved(before: World, after: World, gone: string[] = []) {
  const was = towers(before), now = towers(after);
  for (const [d, box] of Object.entries(was)) if (!gone.includes(d)) expect(now[d], d).toEqual(box);
  const f = fixed(before), g = fixed(after);
  expect(g.hq).toEqual(f.hq);
  expect(g.avenue).toBe(f.avenue);
  expect(g.homes).toEqual(f.homes);
  expect(g.streets.slice(0, f.streets.length)).toEqual(f.streets);
  for (const l of before.lanes) expect(after.lanes.some((m) => m.x === l.x && m.y0 === l.y0 && (m.y1 === l.y1 || l.y0 === -48))).toBe(true);
  const same = (a: { x: number; y: number; w: number; h: number }) => (m: typeof a) => m.x === a.x && m.y === a.y && m.w === a.w && m.h === a.h;
  for (const l of before.lots) expect(after.lots.some(same(l)) || after.buildings.some(same(l))).toBe(true); // a free lot stays, or a tower stands on it at its size
  expect(after.width).toBeGreaterThanOrEqual(before.width);
  expect(after.height).toBeGreaterThanOrEqual(before.height);
}
const created = (s: CityState, name: string, at: number, slot?: number, lot = "") =>
  reduce(s, { type: "department.created", name, mission: "x", manager_id: `mgr-${name}`, ...(slot === undefined ? {} : { slot, lot }) }, at);
const demolished = (s: CityState, name: string, at: number) => reduce(s, { type: "department.demolished", name }, at);

// The layout the owner's twelve towers had before decision 248 (computed with the code of that day).
const TODAY = {
  towers: { Application: [42, 3, 8, 11], "IT Infrastructure": [14, 3, 10, 11], "Data & AI": [53, 1, 10, 13], Marketing: [1, 2, 10, 12], Sales: [42, 19, 10, 12], "Customer Support": [15, 19, 9, 12], Finance: [55, 17, 8, 14], Legal: [2, 19, 11, 12], Product: [42, 34, 9, 15], Operations: [16, 37, 8, 12], Research: [54, 37, 11, 12], Media: [3, 34, 10, 15] },
  hq: [27, 1, 12, 13],
  streets: [14, 31, 49],
  avenue: 39,
  homes: [27, 17],
  width: 66,
  height: 52,
};

describe("the lots", () => {
  it("numbering the lots the first time keeps today's city exactly as it was", () => {
    for (const s of [served(), unnumbered()]) {
      const w = layout(s, { homes: 16 });
      expect(towers(w)).toEqual(TODAY.towers);
      expect([w.hq.x, w.hq.y, w.hq.w, w.hq.h]).toEqual(TODAY.hq);
      expect(w.streets.map((t) => t.y)).toEqual(TODAY.streets);
      expect([w.avenue, w.homes.x, w.homes.y, w.width, w.height]).toEqual([TODAY.avenue, ...TODAY.homes, TODAY.width, TODAY.height]);
      expect(w.lots).toEqual([]);
    }
    expect(Object.values(unnumbered().departments).map((d) => d.slot)).toEqual(PRESETS.map((_, i) => i));
  });

  for (const portrait of [false, true])
    it(`${portrait ? "phone" : "wide"}: add one, demolish one, add again: nothing else ever moves`, () => {
      const opts = { portrait, homes: 16 };
      let s = served();
      const start = layout(s, opts);
      // A thirteenth department: the twelve lots are full, so a new row at the edge.
      s = created(s, "Partnerships", NOW + 1000, 12);
      const added = layout(s, opts);
      unmoved(start, added);
      expect(added.buildings.find((b) => b.dept === "Partnerships")?.slot).toBe(12);
      expect(added.lots.map((l) => l.slot)).toEqual([13, 14, 15]); // the rest of the new row: free lots
      // Demolish Sales: its lot stands empty, nothing else changes, and the map never shrinks.
      s = demolished(s, "Sales", NOW + 2000);
      const down = layout(s, opts);
      unmoved(added, down, ["Sales"]);
      const sales = added.buildings.find((b) => b.dept === "Sales")!;
      expect(down.lots).toContainEqual({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4, demolished: "Sales" });
      expect([down.width, down.height]).toEqual([added.width, added.height]);
      // The next snapshot: Sales is gone from the records; its lot is still there, free, the same size.
      const after = applySnapshot(s, { departments: [...PRESETS.filter((n) => n !== "Sales"), "Partnerships"].map((n) => record(n, PRESETS.indexOf(n) < 0 ? 12 : PRESETS.indexOf(n), PRESETS.indexOf(n) < 0 ? 12 : PRESETS.indexOf(n))), lots: [...PRESETS.map((n, i) => ({ slot: i, size: n })), { slot: 12, size: "" }], agents: [] }, NOW + 3000);
      const reloaded = layout(after, opts);
      expect(towers(reloaded)).toEqual(towers(down));
      expect(reloaded.lots).toContainEqual({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4 });
      expect(fixed(reloaded)).toEqual(fixed(down));
      // A new department takes that free lot, at the lot's size: still nothing else moves.
      const again = layout(created(after, "Events", NOW + 4000, 4, "Sales"), opts);
      unmoved(reloaded, again);
      expect(again.buildings.find((b) => b.dept === "Events")).toMatchObject({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4 });
    });

  for (const portrait of [false, true])
    it(`${portrait ? "phone" : "wide"}: from a server before lots the City picks the same lots, and growing row after row moves nothing`, () => {
      const opts = { portrait, homes: 16 };
      let s = unnumbered(["Research", "Sales", "Legal"]);
      let before = layout(s, opts);
      expect(before.lots.map((l) => l.slot)).toEqual([3, 4, 5, 6, 7]); // two rows of four lots from the start
      for (let i = 0; i < 22; i++) {
        s = created(s, `Dept ${i}`, NOW + 1000 * (i + 1));
        const after = layout(s, opts);
        unmoved(before, after);
        expect(after.buildings.find((b) => b.dept === `Dept ${i}`)?.slot).toBe(3 + i);
        before = after;
      }
      // Demolish one in the middle, then build: the new one goes up on that lot.
      s = demolished(s, "Dept 5", NOW + 50_000);
      const down = layout(s, opts);
      unmoved(before, down, ["Dept 5"]);
      s = created(s, "Late", NOW + 60_000);
      const late = layout(s, opts);
      unmoved(down, late);
      expect(late.buildings.find((b) => b.dept === "Late")?.slot).toBe(8);
      // A rebuilt department gets the next free lot (its own is taken now), not its old place back by force.
      s = created(s, "Dept 5", NOW + 70_000);
      expect(layout(s, opts).buildings.find((b) => b.dept === "Dept 5")?.slot).toBe(25);
    });

  it("the same records draw the same city, on every load and every device", () => {
    const a = served([...PRESETS, "Partnerships"]), b = served([...PRESETS, "Partnerships"]);
    for (const portrait of [false, true]) expect(layout(a, { portrait, homes: 30 })).toEqual(layout(b, { portrait, homes: 30 }));
    // A snapshot in a different order, or arriving twice, changes nothing.
    const shuffled = applySnapshot(applySnapshot(initialState(0), { departments: [...PRESETS].reverse().map((n) => record(n, PRESETS.indexOf(n), PRESETS.indexOf(n))), lots: PRESETS.map((n, i) => ({ slot: i, size: n })), agents: [] }, NOW), { departments: [...PRESETS].reverse().map((n) => record(n, PRESETS.indexOf(n), PRESETS.indexOf(n))), lots: PRESETS.map((n, i) => ({ slot: i, size: n })), agents: [] }, NOW);
    expect(layout(shuffled, { homes: 16 })).toEqual(layout(served(), { homes: 16 }));
  });

  it("a later row never pushes HQ east: its west lots are narrowed to fit", () => {
    let s = served();
    const start = layout(s, {});
    for (let i = 0; i < 40; i++) s = created(s, `Dept ${i}`, NOW + i + 1, 12 + i);
    const big = layout(s, {});
    unmoved(start, big);
    for (const b of big.buildings) expect(b.x).toBeGreaterThanOrEqual(1);
  });
});
