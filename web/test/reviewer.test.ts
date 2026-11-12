// Decision 295: a department's manager is its reviewer. It is called that, and it works inside its tower while it
// reviews (today: its "reviewing" activity until the review's result; the board's review.started / review.finished too).
import { describe, expect, it } from "vitest";
import * as cityState from "../src/city/city-state.js";
import { initialState, isReviewing, placement, reduce, roleOf, type CityState } from "../src/city/city-state.js";

const town = (): CityState => {
  let s = initialState(0);
  s = reduce(s, { type: "department.created", name: "Research", mission: "x", manager_id: "mgr-research" }, 1);
  s = reduce(s, { type: "agent.hired", agent: { id: "mgr-research", kind: "manager", role: "Research Manager", department: "Research", model: "fable-5-1", parent: "orchestrator", state: "active", worker_state: null } }, 2);
  s = reduce(s, { type: "agent.hired", agent: { id: "w1", kind: "worker", role: "Analyst", department: "Research", model: "opus-5-5", parent: "mgr-research", state: "active", worker_state: "working" } }, 3);
  return s;
};

describe("the reviewer", () => {
  it("is called the Reviewer", () => {
    const s = town();
    expect(roleOf(s.agents["mgr-research"])).toBe("Research Reviewer");
    const panel = (cityState as unknown as { agentPanel: (st: CityState, id: string) => { role: string } }).agentPanel;
    expect(panel(s, "mgr-research").role).toBe("Research Reviewer"); // its card
  });
  it("goes inside while a review runs and back out when it ends; two at once is still one reviewer", () => {
    let s = town();
    expect(placement(s, "mgr-research")!.why).not.toBe("reviewing"); // at its door
    s = reduce(s, { type: "activity", id: "mgr-research", activity: "reviewing", at: 10 }, 10);
    expect(isReviewing(s, "mgr-research", 11)).toBe(true);
    expect(placement({ ...s, now: 11 }, "mgr-research")!.why).toBe("reviewing");
    s = reduce(s, { type: "review.started", ticket_id: "t1", round: 1, department: "Research" }, 12);
    s = reduce(s, { type: "review.started", ticket_id: "t2", round: 1, department: "Research" }, 13); // a second, in parallel
    expect(isReviewing(s, "mgr-research", 14)).toBe(true);
    s = reduce(s, { type: "review.result", ticket_id: "t1", agent: "w1", reviewer: "mgr-research", verdict: "PASS", summary: "ok", round: 1 }, 15);
    expect(isReviewing(s, "mgr-research", 16)).toBe(true); // t2 still open
    s = reduce(s, { type: "review.finished", ticket_id: "t2", department: "Research" }, 17);
    expect(isReviewing(s, "mgr-research", 18)).toBe(false); // all done: back out to its door
    expect(placement({ ...s, now: 18 }, "mgr-research")!.why).not.toBe("reviewing");
  });
  it("lets a review left open go after a while", () => {
    let s = town();
    s = reduce(s, { type: "review.started", ticket_id: "t1", round: 1, department: "Research" }, 0);
    expect(isReviewing(s, "mgr-research", 1000)).toBe(true);
    expect(isReviewing(s, "mgr-research", 16 * 60_000)).toBe(false);
  });
});

describe("the reviewer on the project board (decision 294)", () => {
  it("goes in when the board marks a part's review starting and out when the part is reviewed or sent back", () => {
    let s = town();
    s = reduce(s, { type: "ticket.status", previous: null, ticket: { id: "p1", to: "w1", from: "mgr-research", goal: "a part", status: "in_progress", department: "Research" } }, 5);
    s = reduce(s, { type: "build.stage", task_id: "job1", stage: "review", edge: "start", key: "p1" }, 6);
    expect(isReviewing(s, "mgr-research", 7)).toBe(true);
    s = reduce(s, { type: "ticket.status", previous: "in_progress", ticket: { id: "p1", to: "w1", from: "mgr-research", goal: "a part", status: "in_review", department: "Research" } }, 8);
    expect(isReviewing(s, "mgr-research", 9)).toBe(true); // still reviewing
    s = reduce(s, { type: "ticket.status", previous: "in_review", ticket: { id: "p1", to: "w1", from: "mgr-research", goal: "a part", status: "in_progress", department: "Research" } }, 10);
    expect(isReviewing(s, "mgr-research", 11)).toBe(false); // sent back to work: out again
  });
});
