import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { calls } = vi.hoisted(() => ({ calls: [] as Array<{ path: string; init: unknown }> }));
vi.mock("../src/lib/api.ts", () => ({
  api: async (path: string, init: unknown) => {
    calls.push({ path, init });
    if (path.startsWith("/city/agent")) return { cost_usd: 0, recent: [] };
    return { workers: 1, parts: 1, failed: 0 };
  },
  ApiError: class extends Error {},
}));

import { sendWorkerHome } from "../src/lib/actions.ts";
import { applySnapshot, initialState } from "../src/city/city-state.js";
import { CityPanel } from "../src/components/CityView.tsx";

afterEach(cleanup);

describe("send one worker home", () => {
  it("posts to the worker's home route", async () => {
    await sendWorkerHome("wkr-1");
    expect(calls.at(-1)).toEqual({ path: "/agents/wkr-1/home", init: { method: "POST" } });
  });
  it("the agent panel asks once, then sends the clicked worker home", async () => {
    const city = applySnapshot(initialState(), {
      agents: [
        {
          id: "wkr-1",
          kind: "worker",
          role: "Writer",
          department: "Writing",
          model: "opus-5-5",
          parent: "mgr-writing",
          state: "active",
          worker_state: "working",
        },
      ],
      departments: [],
    });
    render(<CityPanel open={{ agent: "wkr-1" }} city={city} onClose={() => undefined} onZoom={() => undefined} />);
    fireEvent.click(screen.getByText("Send home"));
    expect(screen.getByText(/Send this worker home\?/)).toBeTruthy();
    fireEvent.click(screen.getByText("Yes, send home"));
    await waitFor(() => expect(screen.getByText(/Walking home/)).toBeTruthy());
    expect(calls.some((c) => c.path === "/agents/wkr-1/home")).toBe(true);
  });
});
