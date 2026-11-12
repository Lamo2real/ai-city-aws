// Decision 279: a department's windows light only for the agents working in it right now, one window each; with
// nobody working every department building is dark.
import { describe, expect, it } from "vitest";
import { initialState, reduce, workingIn, type CityState } from "../src/city/city-state.js";

const base = (): CityState => {
  let s = initialState(0);
  for (const [i, name] of ["Marketing", "Finance"].entries()) s = reduce(s, { type: "department.created", name, mission: "x", manager_id: `mgr-${i}` }, i);
  return s;
};
const worker = (s: CityState, id: string, department: string, worker_state: string): CityState => ({
  ...s,
  agents: { ...s.agents, [id]: { id, kind: "worker", department, state: "active", worker_state } as CityState["agents"][string] },
});

describe("lit windows", () => {
  it("none while nobody works", () => {
    expect(workingIn(base())).toEqual({});
  });
  it("one per agent working, in its own department only, with what it works on", () => {
    let s = base();
    s = worker(s, "w1", "Marketing", "working");
    s = worker(s, "w2", "Marketing", "reporting");
    s = worker(s, "w3", "Marketing", "blocked"); // waiting for an answer: not working
    s = worker(s, "w4", "Finance", "released");
    s = { ...s, tickets: { t1: { id: "t1", to: "w1", from: "mgr-0", title: "Launch post", goal: "Launch post", department: "Marketing", status: "in_progress" } as unknown as CityState["tickets"][string] } };
    const w = workingIn(s);
    expect(Object.keys(w)).toEqual(["Marketing"]);
    expect(w.Marketing!.map((x) => x.id).sort()).toEqual(["w1", "w2"]);
    expect(w.Marketing!.find((x) => x.id === "w1")!.what).toBe("Launch post");
    // The work ends: dark again.
    expect(workingIn(worker(worker(s, "w1", "Marketing", "completed"), "w2", "Marketing", "completed"))).toEqual({});
  });
});
