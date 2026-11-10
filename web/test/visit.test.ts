// Inside a building (decision 166): which projects a department has, who sits on each floor, the routes, and
// the towers' own sizes.
import { describe, expect, it } from "vitest";
import { applySnapshot, initialState, layout, towerSize } from "../src/city/city-state.js";
import { route } from "../src/lib/apps.ts";
import { deptProjects, visitHash, visitOf } from "../src/lib/visit.ts";

const agent = (id: string, kind: string, department: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  role: id,
  department,
  model: "opus-5-5",
  parent: null,
  state: "active",
  ...extra,
});
const ticket = (id: string, to: string, parent: string | null, department = "App", at = "2026-11-10T08:00:00Z") => ({
  id,
  goal: `Goal ${id}`,
  kind: "task",
  from: "orchestrator",
  to,
  status: "in_progress",
  department,
  parent_id: parent,
  created_at: at,
});

describe("a department's projects", () => {
  const city = applySnapshot(initialState(0), {
    departments: [
      { name: "App", manager_id: "mgr-app", state: "active" },
      { name: "Sales", state: "active" },
    ],
    agents: [
      agent("mgr-app", "manager", "App"),
      agent("w1", "worker", "App"),
      agent("w2", "worker", "App", { ticket_id: "t1b" }),
      agent("w3", "worker", "App", { state: "retired" }),
      agent("w4", "worker", "App"),
    ],
    tickets: [
      ticket("t2", "mgr-app", null, "App", "2026-11-10T09:00:00Z"),
      ticket("t1", "mgr-app", null),
      ticket("t1a", "w1", "t1"),
      ticket("t1b", "mgr-app", "t1"),
      ticket("t1c", "w3", "t1"),
      ticket("t2a", "w4", "t2"),
      ticket("s1", "someone", null, "Sales"),
    ],
  });
  it("lists open jobs at the top of the tree, oldest lowest, with the manager and the workers on each", () => {
    const p = deptProjects(city, "App");
    expect(p.map((x) => [x.id, x.floor])).toEqual([
      ["t1", 2],
      ["t2", 3],
    ]);
    expect(p[0]!.agents).toEqual(["mgr-app", "w1", "w2"]); // the retired worker is gone
    expect(p[1]!.agents).toEqual(["mgr-app", "w4"]);
  });
  it("is empty for a department with nothing open", () => {
    expect(deptProjects(city, "Legal")).toEqual([]);
  });
});

describe("routes", () => {
  it("opens the City by default and reads a visit", () => {
    expect(route("", ["ace", "city"], "city")).toEqual({ view: "city", slug: null });
    expect(route("#/nowhere", ["ace", "city"], "city").view).toBe("city");
    const r = route(`#${visitHash("Data & AI", "t-123")}`, ["ace", "city"], "city");
    expect(visitOf(r.slug)).toEqual({ dept: "Data & AI", project: "t-123" });
    expect(visitOf("features/calendar")).toBeNull();
  });
});

describe("the towers' sizes", () => {
  it("come from the name alone, so a tower never changes size", () => {
    expect(towerSize("Research")).toEqual(towerSize("Research"));
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const sizes = new Set(names.map((n) => JSON.stringify(towerSize(n))));
    expect(sizes.size).toBeGreaterThan(2); // not one size for all
    for (const n of names) {
      const s = towerSize(n);
      expect(s.w).toBeGreaterThanOrEqual(8);
      expect(s.w).toBeLessThanOrEqual(11);
      expect(s.h).toBeGreaterThanOrEqual(11);
      expect(s.h).toBeLessThanOrEqual(15);
    }
  });
  it("HQ stands between the towers on the wide map", () => {
    const s = applySnapshot(initialState(0), {
      departments: ["A", "B", "C", "D", "E", "F"].map((name) => ({ name, state: "active" })),
    });
    const w = layout(s);
    expect(w.buildings.some((b) => b.x + b.w <= w.hq.x)).toBe(true);
    expect(w.buildings.some((b) => b.x >= w.hq.x + w.hq.w)).toBe(true);
  });
});
