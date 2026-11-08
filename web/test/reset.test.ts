import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, sets, answers } = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; init: unknown }>,
  sets: [] as unknown[],
  answers: [] as unknown[],
}));
vi.mock("../src/lib/api.ts", () => ({
  api: async (path: string, init: unknown) => {
    calls.push({ path, init });
    return answers.shift() ?? { gone: { AGENT: 3, TICKET: 4 }, records: 7 };
  },
}));
vi.mock("../src/lib/store.ts", () => ({ store: { set: (patch: unknown) => sets.push(patch) } }));

import { startOver } from "../src/lib/reset.ts";

beforeEach(() => {
  calls.length = 0;
  sets.length = 0;
  answers.length = 0;
});

describe("start over", () => {
  it("asks the server with a clear confirm, forgets this device's conversation and reloads", async () => {
    let reloaded = 0;
    const r = await startOver(() => reloaded++);
    expect(calls).toEqual([{ path: "/city/reset", init: { method: "POST", body: { confirm: true } } }]);
    expect(sets).toEqual([{ chat: [] }]);
    expect(reloaded).toBe(1);
    expect(r.records).toBe(7);
  });
  it("keeps asking while the server says it is not done, reporting progress, and reloads only at the end", async () => {
    answers.push(
      { gone: { TURN: 5000 }, records: 5000, done: false },
      { gone: { TURN: 1200, DEPT: 3 }, records: 1203, done: false },
      { gone: { AGENT: 1 }, records: 1, done: true },
    );
    let reloaded = 0;
    const seen: number[] = [];
    const r = await startOver(
      () => reloaded++,
      (n) => seen.push(n),
    );
    expect(calls).toHaveLength(3);
    expect(seen).toEqual([5000, 6203, 6204]);
    expect(sets).toEqual([{ chat: [] }]);
    expect(reloaded).toBe(1);
    expect(r).toEqual({ gone: { TURN: 6200, DEPT: 3, AGENT: 1 }, records: 6204, done: true });
  });
});
