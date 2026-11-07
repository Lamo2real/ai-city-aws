import { describe, expect, it } from "vitest";
import {
  BLOCK_MAX_FLOORS,
  BLOCK_PER_FLOOR,
  TILE,
  blockWindow,
  doorOf,
  homeSpot,
  initialState,
  layout,
  managerSpot,
  reduce,
  seatSpot,
  seatRows,
} from "../src/city/city-state.js";

const base = () => {
  let s = initialState();
  s = reduce(s, { type: "department.created", name: "Research", mission: "x", manager_id: "m" });
  return s;
};
const world = (residents: number, seats = 10) => layout(base(), { seats: { Research: seats }, houses: 8, residents });

describe("housing that scales", () => {
  it("the first sixteen residents keep the small houses; no block goes up for them", () => {
    const w = world(16);
    expect(w.homes.houses).toHaveLength(8);
    expect(w.homes.blocks).toHaveLength(0);
  });
  it("beyond the houses, apartment blocks go up: a window per resident, two to four floors", () => {
    const w = world(17); // one over
    expect(w.homes.blocks).toHaveLength(1);
    expect(w.homes.blocks[0]!.floors).toBe(2); // never a one-floor block
    const w2 = world(8 * 2 + 16); // a full block
    expect(w2.homes.blocks).toHaveLength(1);
    expect(w2.homes.blocks[0]!.floors).toBe(BLOCK_MAX_FLOORS);
    const w3 = world(8 * 2 + 17); // spills into a second block
    expect(w3.homes.blocks).toHaveLength(2);
  });
  it("blocks never move between reloads: the same town twice is the same town", () => {
    expect(world(40)).toEqual(world(40));
    // and more residents only ADD blocks; the existing ones stay put
    const a = world(20),
      b = world(40);
    const first = a.homes.blocks[0]!;
    expect(b.homes.blocks[0]).toMatchObject({ x: first.x, y: first.y, from: first.from });
  });
  it("a block resident stands in front of its block and owns one window inside it", () => {
    const w = world(30);
    const blk = w.homes.blocks[0]!;
    const spot = homeSpot(w, 17)!;
    expect(spot.y).toBe((blk.y + blk.h) * TILE - 4);
    expect(spot.x).toBeGreaterThan(blk.x * TILE);
    expect(spot.x).toBeLessThan((blk.x + blk.w) * TILE);
    const win = blockWindow(w, 17)!;
    expect(win.x).toBeGreaterThan(blk.x * TILE);
    expect(win.y).toBeLessThan((blk.y + blk.h) * TILE - 12);
    expect(blockWindow(w, 3)).toBeNull(); // a house resident has the house's window
    // sixteen distinct windows in a full block
    const keys = new Set(Array.from({ length: 16 }, (_, i) => JSON.stringify(blockWindow(w, 16 + i))));
    expect(keys.size).toBe(16);
    expect(Math.floor((17 - blk.from) / BLOCK_PER_FLOOR)).toBe(0); // ground floor first
  });
});

describe("the modern office building", () => {
  it("stations are windows up the face: four a floor, higher floors higher up, all inside the walls", () => {
    const w = world(4);
    const b = w.buildings.find((x) => x.dept === "Research")!;
    expect(seatRows(b)).toBeGreaterThanOrEqual(3); // ten stations: three floors
    const ground = seatSpot(b, 0),
      above = seatSpot(b, 4),
      top = seatSpot(b, 8);
    expect(above.y).toBeLessThan(ground.y); // floor two sits above floor one
    expect(top.y).toBeLessThan(above.y);
    for (const p of [ground, above, top]) {
      expect(p.x).toBeGreaterThan(b.x * TILE);
      expect(p.x).toBeLessThan((b.x + b.w) * TILE);
      expect(p.y).toBeGreaterThan(b.y * TILE + 16); // below the parapet
    }
  });
  it("the door is at street level, under every window, and the manager's window sits beside it", () => {
    const w = world(4);
    const b = w.buildings.find((x) => x.dept === "Research")!;
    const d = doorOf(b);
    expect(d.y).toBe((b.y + b.h) * TILE - 10);
    expect(d.y).toBeGreaterThan(seatSpot(b, 0).y);
    const m = managerSpot(b);
    expect(Math.abs(m.y - d.y)).toBeLessThanOrEqual(8);
    expect(m.x).toBeLessThan(d.x);
  });
});
