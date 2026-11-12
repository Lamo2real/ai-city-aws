// Commuters' cabs keep to the traffic rules (decision 177): a cab carrying an agent stops at a red light, gives way
// and goes round a roundabout; only the owner's car runs the lights. The commute takes longer for it.
import { describe, expect, it } from "vitest";
import {
  RING_R,
  STOP_AT,
  commuteRoute,
  createTraffic,
  doorOf,
  homeSpot,
  initialState,
  layout,
  reduce,
  rideLegs,
  rideStep,
  ringOf,
  roundaboutDetours,
  signalAt,
  stepTraffic,
  taxiCall,
  CALL_PX,
  RIDE_PX_S,
  TO_WORK_BOOST,
  homeOf,
  type CityGuest,
  type CityRider,
  type CityRoutePoint,
  type CityTraffic,
} from "../src/city/city-state.js";

const city = (n: number) =>
  layout(
    Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).reduce(
      (st, name, i) => reduce(st, { type: "department.created", name, mission: "x", manager_id: `m${i}` }, i),
      initialState(0),
    ),
    { homes: 16 },
  );

// One frame of a ride, the way the scene does it: move by rideStep, register as a guest, step the traffic.
function frame(sim: CityTraffic, r: CityRider & { route: CityRoutePoint[] }, dt = 0.05) {
  const to = r.route[0]!;
  r.to = to;
  const s = rideStep(sim, r, dt), dx = to.x - r.x, dy = to.y - r.y, d = Math.hypot(dx, dy);
  if (d <= s) {
    r.x = to.x;
    r.y = to.y;
    r.route.shift();
    if (to.ring && !r.route[0]?.ring) r.commit = null;
  } else {
    r.x += (dx / d) * s;
    r.y += (dy / d) * s;
  }
  const next = r.route[0];
  const j = next ? ringOf(sim, { x: r.x, y: r.y, to: next }) : null;
  const g: CityGuest = { x: r.x, y: r.y, vertical: !!next && Math.abs(next.y - r.y) > Math.abs(next.x - r.x), commit: r.commit ?? null, ring: j ? { j, ang: Math.atan2(r.y - j.cy, r.x - j.cx) } : null };
  r.guest = g;
  sim.guests = next ? [g] : [];
  stepTraffic(sim, dt * 1000);
}

describe("a commuter's cab", () => {
  it("goes round a roundabout, anticlockwise on the ring, never over the island", () => {
    const w = city(12);
    const sim = createTraffic(w);
    const j = sim.junctions.find((k) => k.kind === "roundabout")!;
    const from = { x: j.cx - 200, y: j.cy }, route = [{ x: j.cx + 200, y: j.cy }];
    const out = roundaboutDetours(sim.junctions, route, [true], from);
    const arc = out.route.filter((p) => p.ring === j.id);
    expect(arc.length).toBeGreaterThan(3);
    for (const p of arc) expect(Math.hypot(p.x - j.cx, p.y - j.cy)).toBeCloseTo(RING_R, 5);
    const angs = arc.map((p) => Math.atan2(p.y - j.cy, p.x - j.cx));
    // Eastbound and straight on: in from the west, round by the south (screen y down), out to the east.
    expect(arc[0]!.x).toBeLessThan(j.cx);
    expect(arc.at(-1)!.x).toBeGreaterThan(j.cx);
    expect(Math.max(...arc.map((p) => p.y))).toBeGreaterThan(j.cy + RING_R - 1);
    for (let i = 1; i < angs.length; i++) expect(((angs[i - 1]! - angs[i]! + 2 * Math.PI) % (2 * Math.PI))).toBeLessThan(1); // angle falls: anticlockwise
    expect(out.route.at(-1)).toEqual(route[0]);
    expect(out.ride.every(Boolean)).toBe(true);
  });

  it("stops at the line on red and drives on at green; the owner's car does not stop", () => {
    for (const rare of [false, true]) {
      const sim = createTraffic(city(4));
      sim.cars = [];
      const j = sim.junctions.find((k) => k.kind === "light")!;
      const r = { x: j.cx - 140, y: j.cy, route: [{ x: j.cx + 200, y: j.cy }] as CityRoutePoint[], rv: 0, rare };
      while (signalAt(j, sim.t).x !== "red" || signalAt(j, sim.t - 50).x === "red") sim.t += 50;
      const line = j.cx - STOP_AT - 12;
      let waited = 0;
      while (signalAt(j, sim.t).x === "red") {
        frame(sim, r);
        if (!rare) expect(r.x).toBeLessThanOrEqual(line + 0.01);
        if ((r.rv ?? 0) === 0) waited += 50;
      }
      if (rare) expect(r.x).toBeGreaterThan(j.cx); // through on red
      else {
        expect(r.x).toBeGreaterThan(line - 2);
        expect(waited).toBeGreaterThan(1500);
        for (let i = 0; i < 80; i++) frame(sim, r);
        expect(r.x).toBeGreaterThan(j.cx + 30);
      }
    }
  });

  it("gets to work and home in the traffic: slower than before, never stuck, never in a junction with crossing cabs", () => {
    const w = city(4);
    const sim = createTraffic(w);
    for (let i = 0; i < 400; i++) stepTraffic(sim, 50); // let the traffic settle
    let entries = 0;
    for (const b of w.buildings) for (const slot of [0, 5]) {
      const house = homeSpot(w, slot)!, from = { ...house };
      const desk = { ...doorOf(b), y: doorOf(b).y - 2 };
      const base = commuteRoute(w, house, desk, { entering: b });
      const legs = roundaboutDetours(sim.junctions, base, rideLegs(w, base, from), from);
      // Ride only the cab legs, from the kerb where it is hailed.
      const firstRide = legs.ride.indexOf(true), lastRide = legs.ride.lastIndexOf(true);
      const start = legs.route[firstRide - 1] ?? from;
      const r = { x: start.x, y: start.y, route: legs.route.slice(firstRide, lastRide + 1), rv: 0 };
      let t = 0, prev = { x: r.x, y: r.y };
      const wasIn = new Set<string>();
      while (r.route.length) {
        prev = { x: r.x, y: r.y };
        frame(sim, r);
        t += 50;
        expect(t).toBeLessThan(120_000);
        for (const j of sim.junctions.filter((k) => k.kind !== "roundabout")) {
          const inside = Math.abs(r.x - j.cx) < 24 && Math.abs(r.y - j.cy) < 24;
          if (inside && !wasIn.has(j.id)) {
            // Entering the junction: never on red, never while a crossing cab is in it.
            const axis = Math.abs(r.x - prev.x) >= Math.abs(r.y - prev.y) ? "x" : "y";
            if (j.kind === "light") expect(signalAt(j, sim.t)[axis]).not.toBe("red");
            const crossing = sim.cars.some((c) => c.lane && c.lane.axis !== axis && c.lane.controls.some((k) => k.j === j && Math.abs(c.d - k.dc) < 24 + c.lane!.len / 2));
            expect(crossing).toBe(false);
            entries++;
          }
          if (inside) wasIn.add(j.id);
          else wasIn.delete(j.id);
        }
      }
      expect(t).toBeGreaterThan(2500); // longer than the old two and a half seconds
    }
    expect(entries).toBeGreaterThan(3);
  });
});

// Decision 264: the owner's car decided to run a red while a commuter's cab, on green on the crossing road, was past
// its stop line but not yet in the box, and both were in the junction (about 1 in 5 runs, by the rare-car roll).
describe("the owner's car at a red light", () => {
  it("does not run it while a commuter's cab is coming into the junction across", () => {
    for (const guestThere of [false, true]) {
      const sim = createTraffic(city(4), "traffic", 1);
      const j = sim.junctions.find((k) => k.kind === "light")!;
      const car = sim.cars.find((c) => c.lane && c.lane.axis === "y" && c.lane.controls.some((k) => k.j === j))!;
      const ctl = car.lane!.controls.find((k) => k.j === j)!;
      sim.cars = [car];
      Object.assign(car, { rare: "porsche", d: ctl.dc - STOP_AT - car.lane!.len / 2 - 1, v: 30, commit: null });
      while (signalAt(j, sim.t).y !== "red" || signalAt(j, sim.t).x !== "green") sim.t += 50;
      // A commuter's cab on the street, past its line on green, just short of the box.
      sim.guests = guestThere ? [{ x: j.cx - 40, y: j.cy, vertical: false, commit: null, ring: null }] : [];
      stepTraffic(sim, 50);
      expect(car.commit === j.id).toBe(!guestThere);
    }
  });
});

// Decision 207: a new hire's taxi is called to the kerb outside its apartment building before the worker comes out.
describe("a taxi called for a new hire", () => {
  it("waits at the kerb where the ride starts, having come along that same street the way it will set off", () => {
    const w = city(4);
    for (const b of w.buildings) for (const slot of [0, 3, 7]) {
      const from = homeSpot(w, slot)!, desk = { ...doorOf(b), y: doorOf(b).y - 2 };
      const route = commuteRoute(w, from, desk, { leaving: homeOf(w, slot), entering: b });
      const ride = rideLegs(w, route, from);
      const call = taxiCall(w, route, ride, from)!;
      expect(call).not.toBeNull();
      const i = ride.indexOf(true);
      expect(call.leg).toBe(i);
      expect(call.at).toEqual({ x: route[i - 1]!.x, y: route[i - 1]!.y }); // where the worker steps in
      const next = route[i]!, dist = Math.hypot(call.at.x - call.start.x, call.at.y - call.start.y);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThanOrEqual(CALL_PX + 0.01);
      // On the same road, behind the kerb: driving on from it continues the way the ride goes.
      if (Math.abs(next.x - call.at.x) >= Math.abs(next.y - call.at.y)) {
        expect(call.start.y).toBe(call.at.y);
        expect(Math.sign(call.at.x - call.start.x)).toBe(Math.sign(next.x - call.at.x));
        expect(call.start.x).toBeGreaterThanOrEqual(w.left * 16);
        expect(call.start.x).toBeLessThanOrEqual(w.width * 16);
      } else {
        expect(call.start.x).toBe(call.at.x);
        expect(Math.sign(call.at.y - call.start.y)).toBe(Math.sign(next.y - call.at.y));
      }
    }
  });

  it("is not called when nothing is ridden", () => {
    const w = city(2);
    expect(taxiCall(w, [{ x: 1, y: 1 }], [false], { x: 0, y: 0 })).toBeNull();
  });
});

describe("a cab taking a new hire to work (decision 211)", () => {
  it("drives 2.5x the pace of an ordinary ride on an open road", () => {
    const sim = { ...createTraffic(city(2)), junctions: [], cars: [], guests: [] } as CityTraffic;
    const drive = (boost?: number) => {
      const r: CityRider & { boost?: number } = { x: 0, y: 0, to: { x: 10_000, y: 0 }, boost };
      let x = 0;
      for (let i = 0; i < 200; i++) x += rideStep(sim, r, 0.05);
      return { x, top: r.rv! };
    };
    const plain = drive(), fast = drive(TO_WORK_BOOST);
    expect(TO_WORK_BOOST).toBe(2.5);
    expect(plain.top).toBeCloseTo(RIDE_PX_S, 5);
    expect(fast.top).toBeCloseTo(RIDE_PX_S * 2.5, 5);
    expect(fast.x / plain.x).toBeCloseTo(2.5, 5);
  });
});
