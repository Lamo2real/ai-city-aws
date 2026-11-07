import { afterEach, describe, expect, it } from "vitest";
import { stepWords } from "../src/lib/steps.ts";
import { store } from "../src/lib/store.ts";

afterEach(() => store.set({ chat: [], turn: null, presence: "idle" }));
const ev = (activity: string, detail?: string) => store.event({ type: "activity", id: "ace", activity, detail });

describe("AIC's steps in plain words", () => {
  it("names the tool AIC used, else the activity, and skips idle", () => {
    expect(stepWords("working", "get_status")).toBe("Checking how things are going");
    expect(stepWords("delegating", "delegate_to_orchestrator")).toBe("Passing this to my team");
    expect(stepWords("working", "mcp__city__list_notes")).toBe("Reading your notes");
    expect(stepWords("working", "search_knowledge")).toBe("Searching your knowledge base");
    expect(stepWords("working", "mcp__city__add_to_knowledge")).toBe("Saving to your knowledge base");
    expect(stepWords("understanding")).toBe("Understanding your message");
    expect(stepWords("something_new")).toBe("Working on it");
    expect(stepWords("idle")).toBeNull();
  });
  it("collects the turn's steps without repeats and puts them on AIC's reply", () => {
    store.beginTurn();
    ev("understanding");
    ev("working", "get_status");
    ev("working", "get_status");
    store.event({ type: "activity", id: "orchestrator", activity: "delegating" }); // not AIC's step
    ev("idle");
    expect(store.get().turn?.steps).toEqual(["Understanding your message", "Checking how things are going"]);
    store.event({ type: "ace.reply", conversation: "main", text: "All quiet.", done: true });
    const reply = store.get().chat.at(-1)!;
    expect(reply.steps).toEqual(["Understanding your message", "Checking how things are going"]);
    expect(reply.tookMs).toBeGreaterThanOrEqual(0);
    expect(store.get().turn).toBeNull();
  });
});
