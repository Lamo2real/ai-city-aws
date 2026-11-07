import { describe, expect, it, vi } from "vitest";

const { calls, sets } = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; init: unknown }>,
  sets: [] as unknown[],
}));
vi.mock("../src/lib/api.ts", () => ({
  api: async (path: string, init: unknown) => {
    calls.push({ path, init });
    return { gone: { AGENT: 3, TICKET: 4 }, records: 7 };
  },
}));
vi.mock("../src/lib/store.ts", () => ({ store: { set: (patch: unknown) => sets.push(patch) } }));

import { startOver } from "../src/lib/reset.ts";

describe("start over", () => {
  it("asks the server with a clear confirm, forgets this device's conversation and reloads", async () => {
    let reloaded = 0;
    const r = await startOver(() => reloaded++);
    expect(calls).toEqual([{ path: "/city/reset", init: { method: "POST", body: { confirm: true } } }]);
    expect(sets).toEqual([{ chat: [] }]);
    expect(reloaded).toBe(1);
    expect(r.records).toBe(7);
  });
});
