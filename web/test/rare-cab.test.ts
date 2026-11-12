// The owner's two rare cars (2026-11-12): every car that enters the road rolls once, on its own. 1 in 50 it is the
// Porsche-style coupé, 1 in 50 the Lamborghini-style supercar, never both, otherwise a cab. The roll is seedable.
import { describe, expect, it } from "vitest";
import {
  RARE_CAB_ODDS,
  RARE_CARS,
  arrive,
  createTraffic,
  initialState,
  layout,
  rareCar,
  reduce,
  stepTraffic,
  trafficCars,
} from "../src/city/city-state.js";

const town = () =>
  layout(
    ["A", "B", "C", "D"].reduce(
      (st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i),
      initialState(0),
    ),
    { homes: 8 },
  );

describe("the owner's rare cars", () => {
  it("maps one draw to a car: the first 1/50 the Porsche, the next 1/50 the Lamborghini, the rest a cab", () => {
    expect(RARE_CAB_ODDS).toBe(50);
    expect(RARE_CARS).toEqual(["porsche", "lambo"]);
    expect(rareCar(0)).toBe("porsche");
    expect(rareCar(0.0199)).toBe("porsche");
    expect(rareCar(0.02)).toBe("lambo");
    expect(rareCar(0.0399)).toBe("lambo");
    expect(rareCar(0.04)).toBe(false);
    expect(rareCar(0.5)).toBe(false);
    expect(rareCar(0.9999)).toBe(false);
  });

  it("is forced by the draw: a fixed random gives the Porsche, the Lamborghini or a cab", () => {
    const sim = createTraffic(town(), "traffic", 1);
    for (const [u, want] of [[0.01, "porsche"], [0.03, "lambo"], [0.7, false]] as const) {
      sim.rareRand = () => u;
      expect(arrive(sim)).toBe(want);
    }
  });

  it("is seedable: the same seed rolls the same cars, another seed others", () => {
    const roll = (seed: number) => {
      const sim = createTraffic(town(), "traffic", seed);
      return [...sim.cars.map((c) => c.rare), ...Array.from({ length: 300 }, () => arrive(sim))];
    };
    expect(roll(7)).toEqual(roll(7));
    expect(roll(7)).not.toEqual(roll(8));
  });

  it("over many draws each rare car is about 2 %, independently (no fixed spacing)", () => {
    const sim = createTraffic(town(), "traffic", 42);
    const n = 100_000;
    const draws = Array.from({ length: n }, () => arrive(sim));
    const porsche = draws.filter((r) => r === "porsche").length / n;
    const lambo = draws.filter((r) => r === "lambo").length / n;
    expect(porsche).toBeGreaterThan(0.017);
    expect(porsche).toBeLessThan(0.023);
    expect(lambo).toBeGreaterThan(0.017);
    expect(lambo).toBeLessThan(0.023);
    const at = draws.flatMap((r, i) => (r ? [i] : []));
    const gaps = new Set(at.slice(1).map((x, i) => x - at[i]!));
    expect(gaps.size).toBeGreaterThan(20); // a roll, not every 50th
  });

  it("in real traffic, cruising and hailed cars together, both rare cars show up about 2 % each", () => {
    const sim = createTraffic(town(), "traffic", 3);
    let entered = sim.cars.length,
      seenP = 0,
      seenL = 0,
      onRoad = 0;
    const laps = new Map(sim.cars.map((c) => [c.id, c.lap]));
    for (let t = 0; t < 3 * 3_600_000; t += 1000) {
      stepTraffic(sim, 1000);
      for (const c of sim.cars) if (c.lap !== laps.get(c.id)) { laps.set(c.id, c.lap); entered++; }
      if (t % 60_000 === 0) for (let k = 0; k < 2; k++) { entered++; arrive(sim); }
      for (const c of trafficCars(sim)) { onRoad++; if (c.rare === "porsche") seenP++; if (c.rare === "lambo") seenL++; }
    }
    expect(entered).toBe(sim.arrivals); // every car that entered rolled once, and only those
    for (const seen of [seenP, seenL]) {
      expect(seen / onRoad).toBeGreaterThan(0.008);
      expect(seen / onRoad).toBeLessThan(0.04);
    }
  });
});
