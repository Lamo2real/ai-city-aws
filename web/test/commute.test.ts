import { describe, expect, it } from "vitest";
import {
  COMMUTE_MS,
  TILE,
  WALK_PX_S,
  commuteRoute,
  doorOf,
  homeSpot,
  initialState,
  layout,
  placement,
  reduce,
  seatSpot,
  staggerMs,
  walkSpeed,
  walksOut,
  type CityPoint,
} from "../src/city/city-state.js";

const hired = (id: string, dept: string, kind: "manager" | "worker" = "worker") => ({
  type: "agent.hired",
  agent: {
    id,
    kind,
    role: kind === "manager" ? `${dept} Manager` : "Builder",
    department: dept,
    model: "opus-5-5",
    parent: kind === "manager" ? "orchestrator" : `mgr-${dept.toLowerCase()}`,
    state: "active",
    worker_state: kind === "worker" ? "working" : null,
  },
});

function town() {
  let s = initialState();
  s = reduce(s, { type: "department.created", name: "Research", mission: "Find out", manager_id: "mgr-research" });
  s = reduce(s, hired("mgr-research", "Research", "manager"));
  s = reduce(s, hired("wkr-1", "Research"));
  s = reduce(s, hired("wkr-2", "Research"));
  const world = layout(s, { seats: { Research: 2 }, homes: 16 });
  return { s, world, b: world.buildings.find((x) => x.dept === "Research")! };
}

const length = (route: CityPoint[], from: CityPoint) => {
  let len = 0;
  let at = from;
  for (const p of route) {
    len += Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
  }
  return len;
};

describe("the commute", () => {
  it("a hired worker walks from its house, in through the department's door, to its desk", () => {
    const { world, b } = town();
    const home = homeSpot(world, 0)!;
    const desk = seatSpot(b, 0);
    const route = commuteRoute(world, home, desk, { entering: b });
    expect(route.at(-1)).toEqual(desk); // ends seated
    expect(route.at(-2)).toEqual(doorOf(b)); // in through the door, never through a wall
    expect(route.length).toBeGreaterThanOrEqual(3); // along the streets, not as the crow flies
    const door = doorOf(b);
    expect(door.x).toBeGreaterThan(b.x * TILE);
    expect(door.x).toBeLessThan((b.x + b.w) * TILE);
  });
  it("checking out walks desk → door → streets → home", () => {
    const { world, b } = town();
    const desk = seatSpot(b, 1);
    const home = homeSpot(world, 3)!;
    const route = commuteRoute(world, desk, home, { leaving: b });
    expect(route[0]).toEqual(doorOf(b)); // stands up and leaves through the door
    expect(route.at(-1)).toEqual(home);
  });
  it("the pace makes any commute take about 2.5 s, never slower than a stroll", () => {
    const { world, b } = town();
    const home = homeSpot(world, 0)!;
    const route = commuteRoute(world, home, seatSpot(b, 0), { entering: b });
    const v = walkSpeed(route, home);
    expect(v).toBeGreaterThanOrEqual(WALK_PX_S);
    const ms = (length(route, home) / v) * 1000;
    expect(ms).toBeLessThanOrEqual(COMMUTE_MS + 1);
    // A short hop is not slowed down to fill the 2.5 s.
    expect(walkSpeed([{ x: 10, y: 0 }], { x: 0, y: 0 })).toBe(WALK_PX_S);
  });
  it("walkers at the same door set off one after another", () => {
    expect(staggerMs(0)).toBe(0);
    expect(staggerMs(2)).toBe(700);
  });
});

describe("the state behind the walks", () => {
  it("hire → at a desk; retire → walks home once, and never again on a replay", () => {
    const { s } = town();
    expect(placement(s, "wkr-1")).toMatchObject({ place: "station", dept: "Research" });
    const retired = reduce(s, { type: "agent.retired", id: "wkr-1" });
    expect(placement(retired, "wkr-1")).toMatchObject({ place: "home" });
    const walked = new Set<string>();
    expect(walksOut(retired, "wkr-1", walked)).toBe(true);
    expect(walksOut(retired, "wkr-1", walked)).toBe(false); // a snapshot or reconnect never replays the walk
  });
  it("a cancelled job sends every one of its workers home", () => {
    let { s } = town();
    s = reduce(s, { type: "agent.retired", id: "wkr-1" });
    s = reduce(s, { type: "agent.retired", id: "wkr-2" });
    const walked = new Set<string>();
    expect(["wkr-1", "wkr-2"].filter((id) => walksOut(s, id, walked))).toEqual(["wkr-1", "wkr-2"]);
  });
  it("out-of-order events converge: a retire before the hire leaves no ghost, a working worker sits", () => {
    let s = initialState();
    s = reduce(s, { type: "agent.retired", id: "wkr-9" }); // arrives first: nothing to retire
    expect(placement(s, "wkr-9")).toBeNull();
    s = reduce(s, { type: "department.created", name: "Research", mission: "x", manager_id: "m" });
    s = reduce(s, hired("wkr-9", "Research"));
    expect(placement(s, "wkr-9")).toMatchObject({ place: "station" }); // working → seated
    expect(walksOut(s, "wkr-9", new Set())).toBe(false); // not retired: no walk home
  });
});
