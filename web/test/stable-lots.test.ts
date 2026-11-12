// Every tower keeps its lot for good (decision 248) on one map, the same on a phone and on a Mac or PC (decision 250),
// in an organic town (decision 259): HQ in the middle, the towers filling outward compact and roughly round with a
// ragged edge, empty lots forest. Adding a department never moves an existing tower, road, roundabout, home or HQ (it
// takes the free lot nearest HQ, else the next one); demolishing one leaves its lot to the trees and changes nothing
// else; the same records always draw the same city.
import { describe, expect, it } from "vitest";
import { LOT_W, PITCH_Y, applySnapshot, blockOf, colW, colX, lotOf, ringScore, initialState, junctions, layout, reduce, type CityState } from "../src/city/city-state.js";

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
  it("fills in rings from HQ, block by block, each block packed before the next: a compact X × X (decision 282)", () => {
    const lots = Array.from({ length: 600 }, (_, s) => lotOf(s));
    expect(new Set(lots.map((l) => l.join(","))).size).toBe(600); // a lot of its own for every department
    for (const [c, r, li] of lots) expect(li === 0 && ((c === 0 && r === 0) || (c === 0 && r === 1))).toBe(false); // never HQ's or the homes' own lot
    // Ring order: a block's distance from the middle never goes down, and a block is filled before the next starts.
    const seen: string[] = [];
    for (const [c, r] of lots) { const k = `${c},${r}`; if (seen.at(-1) !== k) { expect(seen).not.toContain(k); seen.push(k); } }
    const d = seen.map((k) => ringScore(...(k.split(",").map(Number) as [number, number])));
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThanOrEqual(d[i - 1]! - 1e-9);
    for (const n of [12, 30, 60, 150]) {
      const set = lots.slice(0, n), used = new Set(set.map(([c, r]) => `${c},${r}`));
      // Minimal: no block nearer the middle than the furthest one used is left out (apart from the one being filled).
      const far = Math.max(...[...used].map((k) => ringScore(...(k.split(",").map(Number) as [number, number]))));
      for (let r = -20; r <= 20; r++) for (let c = -12; c <= 12; c++) if (ringScore(c, r) < far - 1e-9 && !(c === 0 && (r === 0 || r === 1))) expect(used.has(`${c},${r}`), `block ${c},${r} at ${n}`).toBe(true);
      // X × X: about as wide as it is tall, in tiles (a ring of whole blocks at a time, so it swings either side of square).
      const xs = set.map(([c, , li]) => colX(c) + li * LOT_W), ys = set.map(([, r]) => r * PITCH_Y);
      const wide = Math.max(...xs, 12) - Math.min(...xs, 0) + LOT_W, tall = Math.max(...ys, PITCH_Y) - Math.min(...ys, 0) + PITCH_Y;
      expect(wide / tall).toBeGreaterThan(0.6);
      expect(wide / tall).toBeLessThan(2.5);
    }
  });

  it("blocks of two or three lots (decision 275) hold only departments' towers, never filler buildings (decision 279), and nothing overlaps", () => {
    type Box = { x: number; y: number; w: number; h: number };
    const ground = (t: Box) => ({ ...t, y: t.y + t.h - Math.min(t.h, 16), h: Math.min(t.h, 16) }); // its footprint on its block
    const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let s = unnumbered(["Research"]), before = layout(s, { homes: 16 });
    for (let i = 0; i < 60; i++) {
      s = created(s, `Dept ${i}`, NOW + 1000 * (i + 1));
      const w = layout(s, { homes: 16 });
      const all = [...w.buildings, ...w.neighbours, w.hq, ...w.homes.apartments].map(ground);
      for (const a of all) for (const b of all) if (a !== b) expect(hit(a, b)).toBe(false);
      const roads = [...w.streets.map((st) => ({ x: st.x0, y: st.y, w: st.x1 - st.x0, h: 3 })), ...w.lanes.map((l) => ({ x: l.x, y: l.y0, w: 3, h: l.y1 - l.y0 })), { x: w.avenue, y: w.top, w: 3, h: w.height - w.top }];
      for (const a of all) for (const r of roads) expect(hit(a, r)).toBe(false);
      for (const n of before.neighbours) expect(w.neighbours).toContainEqual(n); // a neighbour, once there, stays
      before = w;
    }
    // The only large buildings are the departments' and HQ (decision 279).
    expect(before.neighbours).toEqual([]);
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
      expect(b.x).toBeGreaterThanOrEqual(colX(c)); // in its block (decision 275: on its own lot of it)
      expect(b.x + b.w).toBeLessThanOrEqual(colX(c) + colW(c));
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
    expect(rounds.length).toBeGreaterThanOrEqual(3); // a compact town has fewer crossings (decision 282)
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
