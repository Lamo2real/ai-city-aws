// The owner's car (2026-11-10, decision 191): exactly one in every 50 cars that enter the road is the black sports
// coupé with chrome rims; everything else about it is a cab. Counted per car that enters (a cruising cab each time it
// comes round, a commuter's cab when it is hailed), not rolled, so the share is exact.
import { describe, expect, it } from "vitest";
import { RARE_CAB_ODDS, arrive, createTraffic, initialState, layout, reduce, stepTraffic, trafficCars } from "../src/city/city-state.js";

const town = () =>
  layout(
    ["A", "B", "C", "D"].reduce(
      (st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i),
      initialState(0),
    ),
    { homes: 8 },
  );

describe("the owner's car", () => {
  it("is every 50th car to enter, never two in 50", () => {
    expect(RARE_CAB_ODDS).toBe(50);
    const sim = createTraffic(town());
    const flags = Array.from({ length: 5000 }, () => arrive(sim));
    const at = flags.flatMap((r, i) => (r ? [i] : []));
    expect(at.length).toBeGreaterThanOrEqual(99);
    expect(at.length).toBeLessThanOrEqual(101);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBe(50); // a steady one in 50
  });

  it("over a long run of real traffic, cruising cabs and hailed commuter cabs together, 1 in 50 of the cars that enter", () => {
    const sim = createTraffic(town());
    let entered = sim.cars.length,
      rare = sim.cars.filter((c) => c.rare).length,
      seen = 0,
      onRoad = 0;
    const laps = new Map(sim.cars.map((c) => [c.id, c.lap]));
    for (let t = 0; t < 3 * 3_600_000; t += 1000) {
      stepTraffic(sim, 1000);
      for (const c of sim.cars) if (c.lap !== laps.get(c.id)) { laps.set(c.id, c.lap); entered++; if (c.rare) rare++; }
      if (t % 60_000 === 0) for (let k = 0; k < 2; k++) { entered++; if (arrive(sim)) rare++; } // two commuters hail a cab a minute
      for (const c of trafficCars(sim)) { onRoad++; if (c.rare) seen++; }
    }
    expect(entered).toBe(sim.arrivals); // every car that entered took a number, and only those
    expect(entered).toBeGreaterThan(2000);
    expect(Math.abs(rare - entered / RARE_CAB_ODDS)).toBeLessThanOrEqual(1); // exactly one in 50
    expect(seen / onRoad).toBeGreaterThan(0.01); // and on the road, about 2 % of the time
    expect(seen / onRoad).toBeLessThan(0.035);
  });
});
