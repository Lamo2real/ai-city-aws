import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, reduce } from "../src/city/city-state.js";
import { chief, decidedThisWeek, toDecided } from "../src/lib/chief.ts";
import { needsCount } from "../src/lib/needs.ts";
import { store } from "../src/lib/store.ts";

const q = (id: string, extra: Record<string, unknown> = {}) => ({
  type: "question.asked",
  question: {
    id,
    asked_by: "wkr-x",
    path: "p",
    text: `Question ${id}?`,
    options: ["A", "B"],
    default_answer: "A",
    created_at: "2026-11-08T10:00:00Z",
    ...extra,
  },
});

describe("Chief of Staff", () => {
  beforeEach(() => {
    store.set({ city: initialState() });
    chief.state = { status: "ready", enabled: true, saving: false, decided: [], needsOwner: {} };
  });

  it("does not count items it already decided", () => {
    let c = reduce(initialState(), q("q1"));
    c = reduce(c, q("q2", { decided_by: "chief_of_staff", decision: "B" }));
    expect(needsCount(c)).toBe(1);
  });

  it("fills missing fields and counts only the last 7 days", () => {
    const d = toDecided({ id: "x", kind: "approval" });
    expect(d.title).toBe("An action to approve");
    expect(d.choice).toBe("");
    const now = Date.parse("2026-11-08T12:00:00Z");
    const s = {
      ...chief.state,
      decided: [
        toDecided({ id: "a", at: "2026-11-08T11:00:00Z" }),
        toDecided({ id: "b", at: "2026-10-20T11:00:00Z" }),
      ],
    };
    expect(decidedThisWeek(s, now)).toBe(1);
  });

  it("a live decision moves the open item out, keeping its words, newest first", () => {
    store.event(q("q1"));
    chief.state.decided = [toDecided({ id: "old", at: "2026-01-01T00:00:00Z" })];
    chief.event({ type: "steward.decided", id: "q1", kind: "question", choice: "A", reason: "Because." });
    expect(store.get().city.questions.q1).toBeUndefined();
    expect(chief.get().decided[0]).toMatchObject({ id: "q1", title: "Question q1?", choice: "A", reason: "Because." });
    expect(chief.get().decided.map((d) => d.id)).toEqual(["q1", "old"]);
  });

  it("keeps the words when the answer arrives before the decision (the backend's order)", () => {
    store.event(q("q2"));
    const answered = { type: "question.answered", id: "q2", answered_by: "chief_of_staff", answer: "B" };
    chief.event(answered);
    store.event(answered);
    chief.event({ type: "steward.decided", id: "q2", kind: "question", choice: "B", reason: "r" });
    expect(chief.get().decided[0]).toMatchObject({ id: "q2", title: "Question q2?", choice: "B" });
  });

  it("an item it could not do stays open with the reason", () => {
    store.event(q("q1"));
    chief.event({ type: "steward.decided", id: "q1", choice: null, needs_owner_reason: "Only you can sign in." });
    expect(store.get().city.questions.q1).toBeDefined();
    expect(chief.get().needsOwner.q1).toBe("Only you can sign in.");
  });

  it("flips the switch back when the server refuses", async () => {
    const actions = await import("../src/lib/actions.ts");
    const spy = vi.spyOn(actions, "saveSettings").mockRejectedValueOnce(new Error("no"));
    await expect(chief.setEnabled(false)).rejects.toThrow();
    expect(chief.get().enabled).toBe(true);
    spy.mockRestore();
  });
});
