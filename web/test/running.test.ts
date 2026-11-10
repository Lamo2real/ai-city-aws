import { afterEach, describe, expect, it } from "vitest";
import { stepsRunning } from "../src/lib/steps.ts";
import { store } from "../src/lib/store.ts";

afterEach(() => store.set({ chat: [], turn: null, presence: "idle" }));
const ticket = (id: string, status: string, previous: string | null, from = "vaic") =>
  store.event({ type: "ticket.status", previous, ticket: { id, from, to: "orchestrator", status, goal: "build it" } });
const delegatedReply = () => {
  store.beginTurn();
  store.event({ type: "activity", id: "vaic", activity: "delegating", detail: "delegate_to_orchestrator" });
  ticket("t-1", "open", null); // VAIC hands the work on before its reply starts
  store.event({ type: "vaic.reply", conversation: "main", text: "On it.", done: true });
  return () => store.get().chat.at(-1)!;
};

describe("the steps under VAIC's reply: running vs settled", () => {
  it("the rule: running while any handed-on ticket has not settled", () => {
    expect(stepsRunning({})).toBe(false);
    expect(stepsRunning({ tasks: [{ done: true }] })).toBe(false);
    expect(stepsRunning({ tasks: [{ done: true }, { done: false }] })).toBe(true);
  });
  it("a ticket VAIC opens is linked to its reply; it keeps running through progress, settles when done", () => {
    const reply = delegatedReply();
    expect(reply().tasks).toEqual([{ id: "t-1", done: false }]);
    expect(stepsRunning(reply())).toBe(true);
    ticket("t-1", "in_progress", "open");
    ticket("t-2", "open", null, "orchestrator"); // the Orchestrator's own tickets are not VAIC's
    expect(reply().tasks).toEqual([{ id: "t-1", done: false }]);
    ticket("t-1", "done", "in_progress");
    expect(stepsRunning(reply())).toBe(false);
  });
  it("a ticket opened after the reply is written attaches to that reply", () => {
    store.beginTurn();
    store.event({ type: "vaic.reply", conversation: "main", text: "Handing it on.", done: true });
    ticket("t-9", "open", null);
    expect(store.get().chat.at(-1)!.tasks).toEqual([{ id: "t-9", done: false }]);
  });
  it("the result coming back settles it", () => {
    const reply = delegatedReply();
    store.event({ type: "result", ticket_id: "t-1", summary: "Built." });
    expect(stepsRunning(reply())).toBe(false);
  });
  it("work that finished while the page was closed settles on the next snapshot", () => {
    const reply = delegatedReply();
    store.snapshot({ agents: [], departments: [], tickets: [], parked: [], questions: [], approvals: [] });
    expect(stepsRunning(reply())).toBe(false);
  });
});
