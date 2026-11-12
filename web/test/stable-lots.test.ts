// Every tower keeps its lot for good (decision 248) on one map of New York blocks, the same on a phone and on a Mac or
// PC (decisions 250, 252): HQ in the middle block, the town growing a column or a row at a time, 3 × 3 → 4 × 3 → 4 × 4
// → 5 × 4 → 5 × 5…; adding a department never moves
// an existing tower, road, home or HQ (it takes the first free lot, else the town grows a column or row); demolishing one
// leaves its lot empty and changes nothing else; the same records always draw the same city.
import { describe, expect, it } from "vitest";
import { PITCH_X, PITCH_Y, applySnapshot, blockOf, gridBounds, initialState, layout, lotsIn, reduce, stepFor, type CityState } from "../src/city/city-state.js";

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
// The owner's city as the server sends it: the presets on lots 0-11, each lot sized by its tower.
const served = (names = PRESETS) =>
  applySnapshot(initialState(0), { departments: names.map((n, i) => record(n, i, i)), lots: names.map((n, i) => ({ slot: i, size: n })), agents: [] }, NOW);
// The same city from a server before lots: the City numbers them itself, in the order it always drew them.
const unnumbered = (names = PRESETS) => applySnapshot(initialState(0), { departments: names.map((n, i) => record(n, i)), agents: [] }, NOW);

const towers = (w: World) => Object.fromEntries(w.buildings.map((b) => [b.dept, [b.x, b.y, b.w, b.h]]));
// Everything that stood before still stands exactly where it was; the roads only ever gain.
function unmoved(before: World, after: World, gone: string[] = []) {
  const was = towers(before), now = towers(after);
  for (const [d, box] of Object.entries(was)) if (!gone.includes(d)) expect(now[d], d).toEqual(box);
  expect(after.hq).toEqual(before.hq);
  expect(after.avenue).toBe(before.avenue);
  expect([after.homes.x, after.homes.y, after.homes.apartments]).toEqual([before.homes.x, before.homes.y, before.homes.apartments]);
  const streets = new Set(after.streets.map((s) => s.y)), lanes = new Set(after.lanes.map((l) => l.x));
  for (const s of before.streets) expect(streets.has(s.y), `street ${s.y}`).toBe(true);
  for (const l of before.lanes) expect(lanes.has(l.x), `avenue ${l.x}`).toBe(true);
  const same = (a: { x: number; y: number; w: number; h: number }) => (m: typeof a) => m.x === a.x && m.y === a.y && m.w === a.w && m.h === a.h;
  for (const l of before.lots) expect(after.lots.some(same(l)) || after.buildings.some(same(l))).toBe(true); // a free lot stays, or a tower stands on it at its size
  expect(after.left).toBeLessThanOrEqual(before.left);
  expect(after.top).toBeLessThanOrEqual(before.top);
  expect(after.width).toBeGreaterThanOrEqual(before.width);
  expect(after.height).toBeGreaterThanOrEqual(before.height);
}
const created = (s: CityState, name: string, at: number, slot?: number, lot = "") =>
  reduce(s, { type: "department.created", name, mission: "x", manager_id: `mgr-${name}`, ...(slot === undefined ? {} : { slot, lot }) }, at);
const demolished = (s: CityState, name: string, at: number) => reduce(s, { type: "department.demolished", name }, at);

describe("the square", () => {
  it("grows a column or a row at a time, east, south, west, north in turn, so it stays near a square around HQ", () => {
    const dims = Array.from({ length: 9 }, (_, k) => { const g = gridBounds(k); return `${g.c1 - g.c0 + 1}x${g.r1 - g.r0 + 1}`; });
    expect(dims).toEqual(["3x3", "4x3", "4x4", "5x4", "5x5", "6x5", "6x6", "7x6", "7x7"]);
    expect(gridBounds(4)).toEqual({ c0: -2, c1: 2, r0: -2, r1: 2 }); // HQ back in the very middle at every odd square
    expect([0, 1, 2, 3, 4].map(lotsIn)).toEqual([7, 10, 14, 18, 23]); // every block but HQ's and the homes'
    expect([0, 7, 8, 10, 11, 14, 15].map(stepFor)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    // Every lot has its own block, never HQ's (0,0) or the homes' (0,1); the first 7 fill the 3 × 3 blocks.
    const blocks = Array.from({ length: lotsIn(12) }, (_, s) => blockOf(s).join(","));
    expect(new Set(blocks).size).toBe(blocks.length);
    expect(blocks).not.toContain("0,0");
    expect(blocks).not.toContain("0,1");
    for (let s = 0; s < 7; s++) for (const v of blockOf(s)) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it("a phone and a Mac or PC draw the very same map", () => {
    for (const s of [served(), unnumbered(["Research"]), served([...PRESETS, "A", "B", "C"])]) {
      const wide = layout(s, { homes: 16 }), phone = layout(s, { portrait: true, homes: 16 });
      expect({ ...phone, portrait: false }).toEqual({ ...wide, portrait: false });
    }
  });

  it("numbering the lots the first time keeps the order the towers had: the twelve stand in a 4 × 4 town", () => {
    const w = layout(served(), { homes: 16 }), u = layout(unnumbered(), { homes: 16 });
    expect(towers(u)).toEqual(towers(w));
    expect([w.cols, w.rows]).toEqual([4, 4]);
    expect(w.buildings.map((b) => b.slot as number).sort((a, b) => a - b)).toEqual(PRESETS.map((_, i) => i));
    expect(w.lots.map((l) => l.slot)).toEqual([12, 13]); // two free lots left
    for (const b of w.buildings) {
      const [c, r] = blockOf(b.slot as number);
      expect(b.x).toBeGreaterThanOrEqual(c * PITCH_X);
      expect(b.y + b.h).toBe(r * PITCH_Y + 16); // standing on its block's street
    }
  });

  for (const portrait of [false, true])
    it(`${portrait ? "phone" : "wide"}: add one, demolish one, add again: nothing else ever moves`, () => {
      const opts = { portrait, homes: 16 };
      let s = served();
      const start = layout(s, opts);
      // A thirteenth department takes the first free lot of the square.
      s = created(s, "Partnerships", NOW + 1000, 12);
      const added = layout(s, opts);
      unmoved(start, added);
      expect(added.buildings.find((b) => b.dept === "Partnerships")?.slot).toBe(12);
      expect([added.cols, added.rows, added.lots.map((l) => l.slot)]).toEqual([4, 4, [13]]);
      // Demolish Sales: its lot stands empty, nothing else changes, and the map never shrinks.
      s = demolished(s, "Sales", NOW + 2000);
      const down = layout(s, opts);
      unmoved(added, down, ["Sales"]);
      const sales = added.buildings.find((b) => b.dept === "Sales")!;
      expect(down.lots).toContainEqual({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4, demolished: "Sales" });
      expect([down.left, down.top, down.width, down.height]).toEqual([added.left, added.top, added.width, added.height]);
      // The next snapshot: Sales is gone from the records; its lot is still there, free, the same size.
      const standing = [...PRESETS.filter((n) => n !== "Sales"), "Partnerships"];
      const after = applySnapshot(s, { departments: standing.map((n) => { const i = PRESETS.indexOf(n) < 0 ? 12 : PRESETS.indexOf(n); return record(n, i, i); }), lots: [...PRESETS.map((n, i) => ({ slot: i, size: n })), { slot: 12, size: "" }], agents: [] }, NOW + 3000);
      const reloaded = layout(after, opts);
      expect(towers(reloaded)).toEqual(towers(down));
      expect(reloaded.lots).toContainEqual({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4 });
      // A new department takes that free lot, at the lot's size: still nothing else moves.
      const again = layout(created(after, "Events", NOW + 4000, 4, "Sales"), opts);
      unmoved(reloaded, again);
      expect(again.buildings.find((b) => b.dept === "Events")).toMatchObject({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4 });
    });

  it("growing a column or row at a time, from 3 × 3 to 8 × 8, never moves a tower, a road, the homes or HQ", () => {
    let s = unnumbered(["Research"]);
    let before = layout(s, { homes: 16 });
    const sizes = [`${before.cols}x${before.rows}`];
    for (let i = 0; i < lotsIn(10) - 1; i++) {
      s = created(s, `Dept ${i}`, NOW + 1000 * (i + 1));
      const after = layout(s, { homes: 16 });
      unmoved(before, after);
      expect(after.buildings.find((b) => b.dept === `Dept ${i}`)?.slot).toBe(1 + i);
      // Always a square or one block off one, around HQ, whose block stays within a block of the middle.
      const cols = (after.width - after.left - 3) / PITCH_X, rows = (after.height - after.top - 3) / PITCH_Y;
      expect([cols, rows]).toEqual([after.cols, after.rows]);
      expect(cols - rows === 0 || cols - rows === 1).toBe(true);
      const mid = (after.left + after.width) / 2 - (after.hq.x + after.hq.w / 2);
      expect(Math.abs(mid)).toBeLessThanOrEqual(PITCH_X / 2 + 2);
      if (`${after.cols}x${after.rows}` !== sizes.at(-1)) sizes.push(`${after.cols}x${after.rows}`);
      before = after;
    }
    expect(sizes).toEqual(["3x3", "4x3", "4x4", "5x4", "5x5", "6x5", "6x6", "7x6", "7x7", "8x7", "8x8"]);
    // Nothing stands on anything else: every tower, free lot, HQ and the homes in a block of its own.
    const boxes = [...before.buildings, ...before.lots, before.hq, before.homes];
    for (const a of boxes) for (const b of boxes) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    // Demolish one in the middle, then build: the new one goes up on that lot.
    s = demolished(s, "Dept 5", NOW + 500_000);
    const down = layout(s, { homes: 16 });
    unmoved(before, down, ["Dept 5"]);
    s = created(s, "Late", NOW + 600_000);
    const late = layout(s, { homes: 16 });
    unmoved(down, late);
    expect(late.buildings.find((b) => b.dept === "Late")?.slot).toBe(6);
  });

  it("the same records draw the same city, on every load and every device", () => {
    const a = served([...PRESETS, "Partnerships"]), b = served([...PRESETS, "Partnerships"]);
    for (const portrait of [false, true]) expect(layout(a, { portrait, homes: 30 })).toEqual(layout(b, { portrait, homes: 30 }));
    const reversed = { departments: [...PRESETS].reverse().map((n) => record(n, PRESETS.indexOf(n), PRESETS.indexOf(n))), lots: PRESETS.map((n, i) => ({ slot: i, size: n })), agents: [] };
    const twice = applySnapshot(applySnapshot(initialState(0), reversed, NOW), reversed, NOW);
    expect(layout(twice, { homes: 16 })).toEqual(layout(served(), { homes: 16 }));
  });
});
