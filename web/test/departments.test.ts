// Departments on demand, taxis and the mailman (decision 134): the pure parts of the City.
import { describe, expect, it } from "vitest";
import {
  ANIM_MS,
  BIKE_LEG_MS,
  BIKE_PX_S,
  MAIL_QUEUE_MAX,
  RISE_STAGGER_MS,
  CAB_FADE_PX,
  MAP_MARGIN,
  WORLD_MARGIN,
  TILE,
  animProgress,
  avenueLanes,
  bikeSpeed,
  commuteRoute,
  doorOf,
  edgeAlpha,
  enqueueMail,
  entranceAnims,
  homeSpot,
  initialState,
  layout,
  mailFor,
  reduce,
  rideLegs,
  standFraction,
  standingDepartments,
  streetLanes,
  createTraffic,
  stepTraffic,
  trafficCars,
  walkRoute,
  type CityMail,
  type CityState,
} from "../src/city/city-state.js";
import { departmentKey } from "../src/components/Departments.tsx";

const created = (name: string, extra: Record<string, unknown> = {}) => ({
  type: "department.created",
  name,
  mission: `${name} work.`,
  manager_id: `mgr-${name.toLowerCase()}`,
  ...extra,
});
const city = (...names: string[]): CityState =>
  names.reduce((s, n, i) => reduce(s, created(n), 1000 + i), initialState(0));
const ticket = (over: Record<string, unknown>) => ({
  id: "t-1",
  goal: "Plan the launch",
  from: "orchestrator",
  to: "mgr-research",
  status: "open",
  department: "Research",
  ...over,
});

describe("building and demolishing", () => {
  it("a demolished tower leaves an empty lot in its place; its neighbours never move", () => {
    const s = city("Research", "Sales", "Legal");
    const before = layout(s);
    const gone = reduce(s, { type: "department.demolished", name: "Sales", workers: 0, parts: 0 }, 5000);
    expect(gone.departments.Sales?.state).toBe("demolished");
    expect(standingDepartments(gone)).toEqual(["Research", "Legal"]);
    const after = layout(gone);
    expect(after.buildings.map((b) => b.dept)).toEqual(["Research", "Legal"]);
    const lot = after.lots.find((l) => l.demolished === "Sales")!;
    const was = before.buildings.find((b) => b.dept === "Sales")!;
    expect([lot.x, lot.y]).toEqual([was.x, was.y]);
    for (const n of ["Research", "Legal"]) {
      const a = before.buildings.find((b) => b.dept === n)!,
        b = after.buildings.find((x) => x.dept === n)!;
      expect([b.x, b.y]).toEqual([a.x, a.y]);
    }
    // Twice is once; built again, it goes back up on its own lot.
    expect(reduce(gone, { type: "department.demolished", name: "Sales" }, 6000)).toBe(gone);
    const again = reduce(gone, created("Sales", { worker_model: "fable-5-1" }), 7000);
    expect(again.departments.Sales).toMatchObject({ state: "active", worker_model: "fable-5-1" });
    expect(layout(again).buildings.find((b) => b.dept === "Sales")).toMatchObject({ x: was.x, y: was.y });
    expect(standingDepartments(again)).toEqual(["Research", "Sales", "Legal"]);
  });

  it("the page-load entrance raises every tower in turn; each animation runs to 1 and stands the tower up", () => {
    const w = layout(city("A", "B", "C"));
    const anims = entranceAnims(w.buildings, 100);
    expect(anims.map((a) => [a.dept, a.start])).toEqual([
      ["A", 100],
      ["B", 100 + RISE_STAGGER_MS],
      ["C", 100 + 2 * RISE_STAGGER_MS],
    ]);
    const first = anims[0]!;
    expect(animProgress(first, 0)).toBe(0);
    expect(animProgress(first, 100 + ANIM_MS.rise / 2)).toBeCloseTo(0.5);
    expect(animProgress(first, 1e9)).toBe(1);
    for (const kind of ["rise", "build"]) {
      expect(standFraction(kind, 0)).toBe(0);
      expect(standFraction(kind, 1)).toBeCloseTo(1, 2);
    }
    expect(Math.max(...[0.6, 0.7, 0.8, 0.85].map((k) => standFraction("rise", k)))).toBeGreaterThan(1); // a little bounce
    expect(standFraction("demolish", 0)).toBe(1); // the wrecking ball first
    expect(standFraction("demolish", 0.25)).toBe(1);
    expect(standFraction("demolish", 0.6)).toBeLessThan(1);
    expect(standFraction("demolish", 1)).toBe(0);
  });

  it("the HUD's key for a department matches the ledger's", () => {
    expect(departmentKey("Customer Success")).toBe("customer-success");
    expect(departmentKey("Data & AI")).toBe("data-ai");
    expect(departmentKey("  IT  Infrastructure ")).toBe("it-infrastructure");
  });
});

describe("the mailman", () => {
  const s = city("Research");
  it("carries the Orchestrator's instructions out and the managers' replies back, nothing else", () => {
    expect(mailFor({ type: "ticket.status", ticket: ticket({}), previous: null }, s)).toEqual({
      dept: "Research",
      dir: "out",
      ticket: "t-1",
    });
    expect(
      mailFor({ type: "ticket.status", ticket: ticket({ status: "done" }), previous: "in_review" }, s),
    ).toMatchObject({ dir: "back" });
    expect(
      mailFor({ type: "ticket.status", ticket: ticket({ status: "failed" }), previous: "in_progress" }, s),
    ).toMatchObject({ dir: "back" });
    // A manager's part for a worker, a status change in between, an unknown department, another event: no letter.
    expect(
      mailFor({ type: "ticket.status", ticket: ticket({ from: "mgr-research", to: "wkr-1" }), previous: null }, s),
    ).toBeNull();
    expect(
      mailFor({ type: "ticket.status", ticket: ticket({ status: "in_progress" }), previous: "open" }, s),
    ).toBeNull();
    expect(mailFor({ type: "ticket.status", ticket: ticket({ department: "Nowhere" }), previous: null }, s)).toBeNull();
    expect(mailFor({ type: "agent.hired", agent: {} }, s)).toBeNull();
  });

  it("bundles letters to the same tower, and the queue never grows without end", () => {
    let q: CityMail[] = [];
    q = enqueueMail(q, { dept: "Research", dir: "out", ticket: "a" });
    q = enqueueMail(q, { dept: "Research", dir: "out", ticket: "b" });
    q = enqueueMail(q, { dept: "Research", dir: "back", ticket: "c" });
    expect(q.map((m) => [m.dept, m.dir, m.letters])).toEqual([
      ["Research", "out", 2],
      ["Research", "back", 1],
    ]);
    for (let i = 0; i < 20; i++) q = enqueueMail(q, { dept: `D${i}`, dir: "out", ticket: `${i}` });
    expect(q.length).toBe(MAIL_QUEUE_MAX);
  });

  it("rides quicker than a walk and never longer than about four seconds a leg", () => {
    const from = { x: 0, y: 0 };
    expect(bikeSpeed([{ x: 10, y: 0 }], from)).toBe(BIKE_PX_S);
    const far = [{ x: 3000, y: 0 }];
    expect(3000 / bikeSpeed(far, from)).toBeCloseTo(BIKE_LEG_MS / 1000);
  });
});

describe("yellow cabs", () => {
  const s = city("Research", "Sales", "Legal", "Media");
  const w = layout(s, { homes: 16 });
  it("cruise every street and the through roads both ways, and stay on their lanes", () => {
    const lanes = streetLanes(w),
      aves = avenueLanes(w);
    const sim = createTraffic(w);
    const a = trafficCars(sim);
    stepTraffic(sim, 1000);
    const b = trafficCars(sim);
    expect(a.length).toBe(b.length);
    expect(a.some((c, i) => c.x !== b[i]?.x || c.y !== b[i]?.y)).toBe(true); // they move
    for (let t = 0; t < 120_000; t += 1000) {
      stepTraffic(sim, 1000);
      for (const c of trafficCars(sim)) {
        if (c.ring || c.turning || c.alpha === 0) continue; // circling a roundabout (traffic.test.ts), rounding a corner, or still beyond the edge
        const on = c.vertical
          ? aves.some((l) => c.x === (c.east ? l.x1 : l.x0) && c.y >= l.y0 && c.y <= l.y1)
          : lanes.some((l) => c.y === (c.east ? l.y1 : l.y0) && c.x >= l.x0 && c.x <= l.x1);
        expect(on).toBe(true);
      }
    }
    expect(b.some((c) => c.vertical)).toBe(true);
  });

  it("come in only from beyond the map's edge and leave only past it: never appearing, fading or vanishing mid-road (decision 267)", () => {
    const M = WORLD_MARGIN * TILE; // the world runs on past the town (decision 279)
    void MAP_MARGIN;
    // The street between HQ and the homes runs right through the countryside to the map's border (decision 259);
    // every other street ends at a crossing.
    expect(streetLanes(w).some((l) => l.x0 === w.left * TILE - M && l.x1 === w.width * TILE + M)).toBe(true);
    for (const l of streetLanes(w)) expect(l.x0).toBeLessThan(l.x1);
    expect(edgeAlpha(0, 0, 1000)).toBe(0);
    expect(edgeAlpha(CAB_FADE_PX / 2, 0, 1000)).toBeCloseTo(0.5);
    expect(edgeAlpha(500, 0, 1000)).toBe(1);
    for (const n of [4, 12, 30]) {
      const ww = layout(city(...Array.from({ length: n }, (_, i) => `D${i}`)), { homes: 16 });
      const sim = createTraffic(ww, "traffic", 7);
      // Every lane either runs off the map at an end, or ends at a crossing there.
      for (const l of sim.lanes) {
        expect(l.endOff || !!l.endJ).toBe(true);
        expect(l.startOff || l.controls.some((c) => Math.abs(c.dc) < 1)).toBe(true);
      }
      // Out in the faded border: further from the town than the stretch a cab fades over.
      const out = (c: { x: number; y: number }) => c.x < ww.left * TILE - M + CAB_FADE_PX + 1 || c.x > ww.width * TILE + M - CAB_FADE_PX - 1 || c.y < ww.top * TILE - M + CAB_FADE_PX + 1 || c.y > ww.height * TILE + M - CAB_FADE_PX - 1;
      let prev = new Map(trafficCars(sim).map((c) => [c.id, c]));
      let appeared = 0;
      for (let t = 0; t < 180_000; t += 50) {
        stepTraffic(sim, 50);
        for (const c of trafficCars(sim)) {
          const p = prev.get(c.id)!;
          if (c.alpha < 1) expect(out(c)).toBe(true); // faded only out by the border
          if (p.alpha === 0 && c.alpha > 0) { appeared++; expect(out(c)).toBe(true); } // comes in from beyond the edge
          if (p.alpha > 0 && c.alpha === 0) expect(out(p)).toBe(true); // and leaves past it
          if (p.alpha > 0 && c.alpha > 0 && !c.ring && !p.ring) expect(Math.hypot(c.x - p.x, c.y - p.y)).toBeLessThan(16); // never jumps (the far road runs at FAR_PX_S, decision 279)
        }
        prev = new Map(trafficCars(sim).map((c) => [c.id, c]));
      }
      expect(appeared).toBeGreaterThan(sim.cars.length); // they keep coming in
    }
  });

  it("take workers to work and home: the street part of a commute is ridden, the walk to the doors is not", () => {
    const tower = w.buildings.find((x) => x.dept === "Sales")!;
    const house = homeSpot(w, 0)!;
    const desk = { ...doorOf(tower), y: doorOf(tower).y - 2 };
    const toWork = commuteRoute(w, house, desk, { entering: tower });
    const ride = rideLegs(w, toWork, house);
    expect(ride.length).toBe(toWork.length);
    expect(ride[0]).toBe(false); // out of the yard to the kerb on foot
    expect(ride.some(Boolean)).toBe(true); // then the cab
    expect(ride.slice(-2)).toEqual([false, false]); // and on foot through the doors
    const home = commuteRoute(w, desk, house, { leaving: tower });
    const back = rideLegs(w, home, desk);
    expect(back[0]).toBe(false);
    expect(back.some(Boolean)).toBe(true);
    expect(back.at(-1)).toBe(false); // the last few steps into the yard on foot
    // An evening stroll in the plaza along one lane is a ride only where it runs along the road.
    const lane = (w.streets[0]!.y + 1.5) * TILE;
    expect(rideLegs(w, walkRoute(w, { x: 10, y: lane }, { x: 200, y: lane }), { x: 10, y: lane }).some(Boolean)).toBe(
      true,
    );
  });
});
