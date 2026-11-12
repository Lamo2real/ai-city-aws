import { describe, expect, it } from "vitest";
import { initialState, reduce, stories, type CityState } from "../src/city/city-state.js";
import { byJob, needs, needsCount, needsWords } from "../src/lib/needs.ts";

const T0 = 1_000_000;
const ticket = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  goal: `goal ${id}`,
  from: "mgr-research",
  to: "wkr-1",
  status: "in_progress",
  department: "Research",
  kind: "assignment",
  ...extra,
});
const run = (events: Array<Record<string, unknown>>, start: CityState = initialState(T0)) =>
  events.reduce((s, e, i) => reduce(s, e, T0 + i * 1000), start);

describe("the Activity panel speaks plainly", () => {
  it("groups a burst into one line, drops bookkeeping, and never shows ids or arrows", () => {
    const hire = (id: string) => ({
      type: "agent.hired",
      agent: {
        id,
        kind: "worker",
        role: "JavaScript developer",
        department: "Research",
        model: "opus-5-5",
        parent: "mgr-research",
        state: "active",
      },
    });
    const s = run([
      { type: "department.created", name: "Research", mission: "m", manager_id: "mgr-research" },
      hire("wkr-research-a1"),
      hire("wkr-research-b2"),
      hire("wkr-research-c3"),
      { type: "ticket.status", ticket: ticket("t-2"), previous: null },
      { type: "ticket.status", ticket: ticket("t-2", { status: "in_review" }), previous: "in_progress" },
      { type: "ticket.status", ticket: ticket("t-2", { status: "done" }), previous: "in_review" },
      { type: "ticket.status", ticket: ticket("t-3", { status: "done" }), previous: "in_review" },
    ]);
    const lines = stories(s.feed).map((l) => l.text);
    expect(lines).toEqual([
      "Research finished 2 parts",
      "Research started a part",
      "Research hired 3 workers",
      "New department: Research",
    ]);
    expect(lines.join(" ")).not.toMatch(/wkr-|t-\d|→/);
  });
  it("is quiet when nothing worth telling happened", () => {
    const s = run([{ type: "ticket.status", ticket: ticket("t-2", { status: "in_review" }), previous: "in_progress" }]);
    expect(stories(s.feed)).toEqual([]);
  });
});

describe("Needs you counts only what can still be answered", () => {
  const q = (id: string, ticket_id?: string) => ({
    type: "question.asked",
    question: {
      id,
      asked_by: "mgr-research",
      path: "mgr-research",
      text: "Which one?",
      options: ["A", "B"],
      default_answer: "A",
      created_at: `2026-11-07T10:0${id.slice(-1)}:00Z`,
      ...(ticket_id ? { ticket_id } : {}),
    },
  });
  it("hides items of closed or unknown parts, groups the rest by job, and drops withdrawn ones", () => {
    let s = run([
      {
        type: "agent.hired",
        agent: {
          id: "mgr-research",
          kind: "manager",
          role: "Research Manager",
          department: "Research",
          model: "fable-5-1",
          parent: "orchestrator",
          state: "active",
        },
      },
      {
        type: "ticket.status",
        ticket: ticket("t-job", {
          kind: "task",
          parent_id: null,
          owner_words: "porsche sentences",
          from: "vaic",
          to: "orchestrator",
        }),
        previous: null,
      },
      { type: "ticket.status", ticket: ticket("t-part", { parent_id: "t-job" }), previous: null },
      q("q1", "t-part"),
      q("q2", "t-gone"), // its part already finished: not counted
      q("q3"), // belongs to no job
      {
        type: "approval.requested",
        id: "ap1",
        agent: "app",
        kind: "app.publish",
        title: "Snake",
        action: "publish",
        reason: "r",
      },
    ]);
    expect(needsCount(s)).toBe(3);
    expect(needsWords(needsCount(s))).toBe("3 things need you");
    const groups = byJob(needs(s));
    expect(groups.map((g) => g.job?.name ?? "Other")).toEqual(["Porsche sentences", "Other"]);
    expect(needs(s).find((n) => n.id === "q1")?.who).toBe("The Research reviewer") // a manager is its department's reviewer (decision 295);
    s = reduce(s, { type: "question.withdrawn", id: "q1" });
    s = reduce(s, {
      type: "ticket.status",
      ticket: ticket("t-part", { parent_id: "t-job", status: "cancelled" }),
      previous: "in_progress",
    });
    expect(needsCount(s)).toBe(2);
  });
});
