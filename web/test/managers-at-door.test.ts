// Decision 212: every standing tower has its Department Manager outside at the door at all times.
import { describe, expect, it } from "vitest";
import { applySnapshot, initialState, managerIdOf, placement, reduce, topBar } from "../src/city/city-state.js";

const dept = (name: string, manager_id?: string) => ({ name, mission: "x", state: "active", created_at: "2026-11-01T00:00:00Z", ...(manager_id ? { manager_id } : {}) });

describe("managers stand at their tower's door", () => {
  it("a dormant manager with no tickets stays at the door, not at home", () => {
    const s = applySnapshot(initialState(), {
      departments: [dept("Research", "mgr-research")],
      agents: [{ id: "mgr-research", kind: "manager", role: "Research Manager", department: "Research", model: "fable-5-1", parent: "orchestrator", state: "dormant", worker_state: null }],
    });
    expect(placement(s, "mgr-research")).toMatchObject({ place: "station", dept: "Research" });
    expect(s.agents["mgr-research"]?.standin).toBeUndefined(); // the real record is kept
  });

  it("an idle manager (worker_state released or not) also stays", () => {
    let s = applySnapshot(initialState(), { departments: [dept("Media", "mgr-media")], agents: [] });
    s = reduce(s, { type: "agent.hired", agent: { id: "mgr-media", kind: "manager", role: "Media Manager", department: "Media", model: "fable-5-1", parent: "orchestrator", state: "idle", worker_state: "released" } });
    expect(placement(s, "mgr-media")?.place).toBe("station");
  });

  it("a department with a manager_id but no agent record gets a stand-in manager at its door", () => {
    const s = applySnapshot(initialState(), { departments: [dept("Legal", "mgr-legal"), dept("Sales")], agents: [] });
    expect(s.agents["mgr-legal"]).toMatchObject({ kind: "manager", department: "Legal", standin: true });
    expect(placement(s, "mgr-legal")).toMatchObject({ place: "station", dept: "Legal" });
    // No manager_id on the record: the runtime's id for it.
    expect(managerIdOf("Sales")).toBe("mgr-sales");
    expect(placement(s, "mgr-sales")).toMatchObject({ place: "station", dept: "Sales" });
    expect(topBar(s).agentsTotal).toBe(0); // drawn, not hired
  });

  it("a department built live gets its manager at once; the real one replaces the stand-in", () => {
    let s = reduce(applySnapshot(initialState(), { departments: [], agents: [] }), { type: "department.created", name: "Growth Lab", mission: "Grow", manager_id: "mgr-growth-lab" });
    expect(placement(s, "mgr-growth-lab")).toMatchObject({ place: "station", dept: "Growth Lab" });
    s = reduce(s, { type: "agent.hired", agent: { id: "mgr-growth-lab", kind: "manager", role: "Growth Lab Manager", department: "Growth Lab", model: "fable-5-1", parent: "orchestrator", state: "dormant", worker_state: null } });
    expect(s.agents["mgr-growth-lab"]?.standin).toBeUndefined();
    expect(Object.values(s.agents).filter((a) => a.kind === "manager")).toHaveLength(1);
  });

  it("a real manager under another id replaces the stand-in; demolition removes it", () => {
    let s = applySnapshot(initialState(), { departments: [dept("Ops")], agents: [] });
    expect(s.agents["mgr-ops"]?.standin).toBe(true);
    s = reduce(s, { type: "agent.hired", agent: { id: "boss-ops", kind: "manager", role: "Ops Manager", department: "Ops", model: "fable-5-1", parent: "orchestrator", state: "active", worker_state: null } });
    expect(s.agents["mgr-ops"]).toBeUndefined();
    let t = applySnapshot(initialState(), { departments: [dept("Ops")], agents: [] });
    t = reduce(t, { type: "department.demolished", name: "Ops" });
    expect(t.agents["mgr-ops"]).toBeUndefined();
  });

  it("a retired manager has left; workers still go home when idle", () => {
    let s = applySnapshot(initialState(), {
      departments: [dept("Research", "mgr-research")],
      agents: [{ id: "w1", kind: "worker", role: "Builder", department: "Research", model: "opus-5-5", parent: "mgr-research", state: "retired", worker_state: "released" }],
    });
    expect(placement(s, "w1")?.place).toBe("home");
    s = reduce(s, { type: "agent.retired", id: "mgr-research" }); // the stand-in cannot be retired away while the tower stands
    expect(placement(s, "mgr-research")?.place).toBe("station");
  });
});
