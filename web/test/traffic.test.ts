// Traffic (decision 173): lights at some junctions, a couple of roundabouts, the street giving way at the rest, and
// the open road outside the town driven at highway speed. Cars wait at red, never get green both ways, keep their
// distance, and the owner's car alone runs the lights.
import { describe, expect, it } from "vitest";
import {
  CAB_GAP_PX,
  HIGHWAY_PX_S,
  TILE,
  JUNCTION_HALF,
  RED_MS,
  SIGNAL_CYCLE_MS,
  STOP_AT,
  TOWN_PX_S,
  createTraffic,
  initialState,
  junctions,
  layout,
  reduce,
  signalAt,
  stepTraffic,
  trafficCars,
  type CityCar,
  type CityTraffic,
} from "../src/city/city-state.js";

const city = (n: number, portrait = false) =>
  layout(
    Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).reduce(
      (st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i),
      initialState(0),
    ),
    { homes: 16, portrait },
  );

// Puts a lone car on the lane through a lit junction, `ahead` px before its stop line, everything else removed.
function lone(sim: CityTraffic, ahead: number, rare = false) {
  const j = sim.junctions.find((k) => k.kind === "light")!;
  const lane = sim.lanes.find((l) => l.axis === "x" && l.controls.some((c) => c.j === j))!;
  const ctl = lane.controls.find((c) => c.j === j)!;
  const stopD = ctl.dc - STOP_AT - lane.len / 2;
  const car: CityCar = { id: "test", lane, d: stopD - ahead, v: TOWN_PX_S, f: 1, lap: 0, rare, commit: null, stopFor: null, ring: null, braking: false };
  sim.cars = [car];
  return { j, car, stopD, ctl };
}

describe("traffic lights", () => {
  it("cycle green, amber, red with five seconds of red, and never let both ways go at once", () => {
    expect(RED_MS).toBe(5000);
    const j = { offset: 1234 };
    const seen = new Set<string>();
    let redRun = 0,
      longest = 0;
    for (let t = 0; t < SIGNAL_CYCLE_MS * 4; t += 10) {
      const s = signalAt(j, t);
      seen.add(s.x);
      expect(s.x === "red" || s.y === "red").toBe(true); // one way is always held
      redRun = s.x === "red" ? redRun + 10 : 0;
      longest = Math.max(longest, redRun);
    }
    expect([...seen].sort()).toEqual(["amber", "green", "red"]);
    expect(longest).toBe(RED_MS);
  });

  it("lights around HQ, more roundabouts as the town grows, and a crossing never changes once it is there (decision 252)", () => {
    let before: ReturnType<typeof junctions> = [];
    let rounds = 0;
    for (const n of [4, 8, 12, 20, 40, 70]) {
      const js = junctions(city(n));
      const kinds = js.map((j) => j.kind);
      expect(kinds.filter((k) => k === "light").length).toBe(6); // the six around HQ and the homes
      const now = kinds.filter((k) => k === "roundabout").length;
      expect(now).toBeGreaterThanOrEqual(rounds); // never fewer
      expect(now).toBeLessThan(js.length / 3); // the street gives way at most crossings
      for (const j of before) {
        const k = js.find((x) => x.id === j.id)!;
        expect([k.kind, k.cx, k.cy, k.offset ?? null]).toEqual([j.kind, j.cx, j.cy, j.offset ?? null]);
      }
      // Never two roundabouts side by side.
      for (const a of js) for (const b of js) if (a !== b && a.kind === "roundabout" && b.kind === "roundabout") expect(Math.abs(a.v - b.v) + Math.abs(a.h - b.h)).toBeGreaterThanOrEqual(3);
      before = js;
      rounds = now;
    }
    expect(rounds).toBeGreaterThan(4); // a big town has many
  });

  it("a cab stops at the line on red, waits, and drives on when it turns green", () => {
    const sim = createTraffic(city(4));
    const { j, car, stopD } = lone(sim, 40);
    // Wait for the moment the street's light turns red.
    while (signalAt(j, sim.t).x !== "red" || signalAt(j, sim.t - 50).x === "red") sim.t += 50;
    let waited = 0;
    while (signalAt(j, sim.t).x === "red") {
      stepTraffic(sim, 50);
      expect(car.d).toBeLessThanOrEqual(stopD + 0.01); // never over the line on red
      if (car.v === 0) waited += 50;
    }
    expect(car.d).toBeGreaterThan(stopD - 2); // it pulled right up to the line
    expect(waited).toBeGreaterThan(2000);
    for (let i = 0; i < 60; i++) stepTraffic(sim, 50);
    expect(car.d).toBeGreaterThan(stopD + 20); // green: off it goes
  });

  it("stops on amber when it can, and the owner's car runs a red", () => {
    const sim = createTraffic(city(4));
    const { j, car, stopD } = lone(sim, 120);
    while (signalAt(j, sim.t).x !== "amber") sim.t += 50;
    for (let i = 0; i < 40; i++) stepTraffic(sim, 50);
    expect(car.d).toBeLessThanOrEqual(stopD + 0.01);
    const s2 = createTraffic(city(4));
    const p = lone(s2, 60, true);
    while (signalAt(p.j, s2.t).x !== "red") s2.t += 50;
    for (let i = 0; i < 120; i++) stepTraffic(s2, 50);
    expect(p.car.d).toBeGreaterThan(p.ctl.dc + JUNCTION_HALF); // straight through
  });
});

describe("the traffic as a whole", () => {
  it("has a quarter of the original cabs: halved twice, at least one per lane (decisions 180 and 191)", () => {
    expect(CAB_GAP_PX).toBe(44 * TILE);
    for (const [n, portrait] of [[2, false], [4, false], [8, false], [12, false], [6, true]] as const) {
      const sim = createTraffic(city(n, portrait));
      const before = sim.lanes.map((l) => Math.max(1, Math.round(l.span / CAB_GAP_PX))); // after decision 180
      const total = before.reduce((a, b) => a + b, 0);
      expect(sim.cars.length).toBe(Math.max(sim.lanes.length, Math.round(total / 2))); // half again
      for (const l of sim.lanes) expect(sim.cars.filter((c) => c.lane === l).length).toBeGreaterThanOrEqual(1);
      const first = sim.lanes.reduce((k, l) => k + Math.max(1, Math.round(l.span / (22 * TILE))), 0); // before any halving
      expect(sim.cars.length / first).toBeLessThan(0.4);
    }
  });

  for (const [n, portrait] of [[2, false], [4, false], [8, false], [6, true]] as const) {
    it(`flows without crashes or gridlock (${n} towers${portrait ? ", phone" : ""})`, () => {
      const w = city(n, portrait);
      const sim = createTraffic(w);
      const still = new Map<string, number>();
      let ringRides = 0,
        townTop = 0,
        roadTop = 0;
      const entered = new Set<string>();
      for (let t = 0; t < 300_000; t += 50) {
        stepTraffic(sim, 50);
        for (const c of sim.cars) {
          const k = c.v < 0.5 ? (still.get(c.id) ?? 0) + 50 : 0;
          still.set(c.id, k);
          expect(k).toBeLessThan(45_000); // nobody waits for ever
          if (c.ring && !entered.has(`${c.id}:${c.lap}:${c.ring.j.id}`)) {
            entered.add(`${c.id}:${c.lap}:${c.ring.j.id}`);
            ringRides++;
          }
          if (c.lane && t % 500 === 0) {
            const inTown = c.d >= c.lane.townFrom && c.d <= c.lane.townTo;
            if (inTown) townTop = Math.max(townTop, c.v);
            else roadTop = Math.max(roadTop, c.v);
          }
        }
        if (t % 1000 === 0) {
          // Two cabs in one lane, or two on a roundabout, never overlap.
          for (const lane of sim.lanes) {
            const list = sim.cars.filter((c) => c.lane === lane).sort((a, b) => a.d - b.d);
            for (let i = 1; i < list.length; i++) expect(list[i]!.d - list[i - 1]!.d).toBeGreaterThanOrEqual(lane.len - 0.5);
          }
          // A crossing car is never in a lit junction's box while the other way is in it too.
          const cars = trafficCars(sim);
          for (const j of sim.junctions.filter((k) => k.kind !== "roundabout")) {
            const box = cars.filter((c) => !c.ring && Math.abs(c.x - j.cx) < JUNCTION_HALF && Math.abs(c.y - j.cy) < JUNCTION_HALF);
            expect(box.some((c) => c.vertical) && box.some((c) => !c.vertical)).toBe(false);
          }
        }
      }
      if (sim.junctions.some((j) => j.kind === "roundabout")) expect(ringRides).toBeGreaterThan(20);
      expect(townTop).toBeLessThan(TOWN_PX_S * 1.25); // town pace in town
      expect(roadTop).toBeGreaterThan(HIGHWAY_PX_S * 0.85); // highway pace out in the countryside
    });
  }
});
