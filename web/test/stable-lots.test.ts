// Every tower keeps its lot for good (decision 248) on one map, the same on a phone and on a Mac or PC (decision 250),
// in an organic town (decision 259): HQ in the middle, the towers filling outward compact and roughly round with a
// ragged edge, empty lots forest. Adding a department never moves an existing tower, road, roundabout, home or HQ (it
// takes the free lot nearest HQ, else the next one); demolishing one leaves its lot to the trees and changes nothing
// else; the same records always draw the same city.
import { describe, expect, it } from "vitest";
import { PITCH_X, PITCH_Y, applySnapshot, blockOf, initialState, junctions, layout, reduce, type CityState } from "../src/city/city-state.js";

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

describe("the town", () => {
  it("fills outward from HQ, compact and roughly round, with a ragged edge, never a rectangle", () => {
    const blocks = Array.from({ length: 400 }, (_, s) => blockOf(s));
    expect(new Set(blocks.map((b) => b.join(","))).size).toBe(400); // a block of its own for every lot
    for (const b of blocks) expect(b.join(",")).not.toMatch(/^0,0$|^0,1$/); // never HQ's or the homes'
    for (const n of [7, 12, 20, 40, 100, 400]) {
      const set = blocks.slice(0, n);
      // Compact: every lot within a radius that grows like the square root of the count.
      const far = Math.max(...set.map(([c, r]) => Math.hypot(c, r - 0.5)));
      expect(far).toBeLessThan(Math.sqrt((n + 2) / Math.PI) + 2.2);
      // Not a rectangle: the town's bounding box has empty blocks (forest) in it.
      const cs = set.map((b) => b[0]), rs = set.map((b) => b[1]);
      const box = (Math.max(...cs, 1) - Math.min(...cs, -1) + 1) * (Math.max(...rs, 1) - Math.min(...rs, -1) + 1);
      expect(box).toBeGreaterThan(n + 2);
    }
    // Not just rings by distance: some later lot is nearer HQ than an earlier one (the seeded jitter).
    const d = blocks.slice(0, 40).map(([c, r]) => Math.hypot(c, r - 0.5));
    expect(d.some((x, i) => i > 0 && x < d[i - 1]! - 0.5)).toBe(true);
  });

  it("a phone and a Mac or PC draw the very same map", () => {
    for (const s of [served(), unnumbered(["Research"]), served([...PRESETS, "A", "B", "C"])]) {
      const wide = layout(s, { homes: 16 }), phone = layout(s, { portrait: true, homes: 16 });
      expect({ ...phone, portrait: false }).toEqual({ ...wide, portrait: false });
    }
  });

  it("numbering the lots the first time keeps the order the towers had", () => {
    const w = layout(served(), { homes: 16 }), u = layout(unnumbered(), { homes: 16 });
    expect(towers(u)).toEqual(towers(w));
    expect(w.buildings.map((b) => b.slot as number).sort((a, b) => a - b)).toEqual(PRESETS.map((_, i) => i));
    expect(w.lots).toEqual([]); // no empty lot: forest only where no tower ever stood
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
      // A thirteenth department: no lot is free, so the next one.
      s = created(s, "Partnerships", NOW + 1000, 12);
      const added = layout(s, opts);
      unmoved(start, added);
      expect(added.buildings.find((b) => b.dept === "Partnerships")?.slot).toBe(12);
      expect(added.lots).toEqual([]);
      // Demolish Sales: its lot stands empty, nothing else changes, and the map never shrinks.
      s = demolished(s, "Sales", NOW + 2000);
      const down = layout(s, opts);
      unmoved(added, down, ["Sales"]);
      const sales = added.buildings.find((b) => b.dept === "Sales")!;
      expect(down.lots).toContainEqual(expect.objectContaining({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4, demolished: "Sales", freedAt: NOW + 2000 }));
      expect([down.left, down.top, down.width, down.height]).toEqual([added.left, added.top, added.width, added.height]);
      // The next snapshot: Sales is gone from the records; its lot is still there, free, the same size.
      const standing = [...PRESETS.filter((n) => n !== "Sales"), "Partnerships"];
      const after = applySnapshot(s, { departments: standing.map((n) => { const i = PRESETS.indexOf(n) < 0 ? 12 : PRESETS.indexOf(n); return record(n, i, i); }), lots: [...PRESETS.map((n, i) => ({ slot: i, size: n, ...(n === "Sales" ? { freed_at: new Date(NOW + 2000).toISOString() } : {}) })), { slot: 12, size: "" }], agents: [] }, NOW + 3000);
      const reloaded = layout(after, opts);
      expect(towers(reloaded)).toEqual(towers(down));
      expect(reloaded.lots).toContainEqual(expect.objectContaining({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4, freedAt: NOW + 2000 })); // saplings still growing after a reload
      // A new department takes that free lot, at the lot's size: still nothing else moves.
      const again = layout(created(after, "Events", NOW + 4000, 4, "Sales"), opts);
      unmoved(reloaded, again);
      expect(again.buildings.find((b) => b.dept === "Events")).toMatchObject({ x: sales.x, y: sales.y, w: sales.w, h: sales.h, slot: 4 });
    });

  it("growing to 80 towers one at a time never moves a tower, a road, a roundabout, the homes or HQ", () => {
    let s = unnumbered(["Research"]);
    let before = layout(s, { homes: 16 });
    let rounds = junctions(before).filter((j) => j.kind === "roundabout");
    for (let i = 0; i < 80; i++) {
      s = created(s, `Dept ${i}`, NOW + 1000 * (i + 1));
      const after = layout(s, { homes: 16 });
      unmoved(before, after);
      expect(after.buildings.find((b) => b.dept === `Dept ${i}`)?.slot).toBe(1 + i);
      // Every roundabout stays a roundabout, where it was; a bigger town may have more.
      const now = junctions(after).filter((j) => j.kind === "roundabout");
      for (const j of rounds) expect(now.some((k) => k.id === j.id && k.cx === j.cx && k.cy === j.cy)).toBe(true);
      rounds = now;
      before = after;
    }
    expect(rounds.length).toBeGreaterThan(6);
    // Nothing stands on anything else: every tower, empty lot, HQ and the homes in a block of its own.
    const boxes = [...before.buildings, ...before.lots, before.hq, before.homes];
    for (const a of boxes) for (const b of boxes) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    // Demolish one: the roads and roundabouts stay; build again: it takes that lot, the nearest free one.
    s = demolished(s, "Dept 5", NOW + 500_000);
    const down = layout(s, { homes: 16 });
    unmoved(before, down, ["Dept 5"]);
    expect(junctions(down)).toEqual(junctions(before));
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
