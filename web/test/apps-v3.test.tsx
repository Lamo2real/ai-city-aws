// Apps v3 in the HUD: the `state` grant, new versions and going back (docs/APPS.md "v3").
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { initialState, reduce } from "../src/city/city-state.js";
import { ProjectPage } from "../src/components/Projects.tsx";
import { Inbox } from "../src/components/Inbox.tsx";
import { capLabel } from "../src/lib/apps.ts";
import { granted } from "../src/lib/bridge.ts";
import { loadConfig } from "../src/lib/config.ts";
import { store } from "../src/lib/store.ts";

const APPS = "https://apps.vaic.test";
const snake = (extra: Record<string, unknown> = {}) => ({
  app_id: "app-snake",
  slug: "snake",
  title: "Snake",
  url: `${APPS}/live/app-snake/drf-2/index.html`,
  published_at: "2026-11-07T10:00:00Z",
  ...extra,
});
const calls: Array<{ url: string; method: string }> = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test", appsUrl: APPS }));
  calls.push({ url, method: init?.method ?? "GET" });
  if (url.endsWith("/rollback"))
    return new Response(
      JSON.stringify({ app: snake({ version: 1, history: [], url: `${APPS}/live/app-snake/index.html` }) }),
    );
  return new Response(JSON.stringify({}));
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe("the state grant", () => {
  it("covers state.get and state.set only, and has plain words", () => {
    const app = { grants: [{ id: "state" }] };
    expect(granted(app, "state.get", { key: "best" })).toBe(true);
    expect(granted(app, "state.set", { key: "best", value: 1 })).toBe(true);
    expect(granted(app, "state", {})).toBe(false);
    expect(granted({ grants: [] }, "state.get", { key: "best" })).toBe(false);
    expect(granted({ grants: [{ id: "calendar.read" }] }, "state.set", { key: "k" })).toBe(false);
    expect(capLabel({ id: "state" })).toBe("Remember its own data, such as high scores and settings (up to 64 KB)");
  });
});

describe("new versions", () => {
  it("app.updated with a new version says so in the City feed", () => {
    let s = reduce(initialState(), { type: "app.published", ...snake({ url: `${APPS}/live/app-snake/index.html` }) });
    s = reduce(s, { type: "app.updated", app: snake({ version: 2 }) });
    expect(s.apps["app-snake"]?.version).toBe(2);
    expect(s.feed.some((f) => f.text === "Snake is now version 2")).toBe(true);
  });

  it("the publish card says it is an update and offers no pin box", () => {
    act(() =>
      store.snapshot({
        agents: [],
        approvals: [
          {
            id: "apr-2",
            agent: "orchestrator",
            kind: "app.publish",
            title: "Snake",
            preview_url: `${APPS}/drafts/drf-2/index.html`,
            capabilities: [{ id: "state" }],
            replaces: "app-snake",
            version: 2,
          },
        ],
      }),
    );
    render(<Inbox />);
    expect(screen.getByRole("article", { name: "Update of Snake" })).toBeTruthy();
    expect(screen.getByText(/A new version \(version 2\) of one of your apps/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /top bar/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Remember its own data/ })).toBeTruthy();
  });

  it("the app page shows the version and goes back after a confirm", async () => {
    act(() => store.setApps([snake({ version: 2, history: [{ version: 1, title: "Snake" }] })]));
    render(<ProjectPage slug="snake" go={() => undefined} />);
    expect(screen.getByText("Version 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Versions" }));
    fireEvent.click(screen.getByRole("button", { name: "Go back to version 1" }));
    expect(screen.getByText(/Version 2 is deleted and Snake opens as it was before/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() =>
      expect(calls).toEqual([{ url: "https://api.vaic.test/apps/app-snake/rollback", method: "POST" }]),
    );
    await waitFor(() => expect(store.get().city.apps["app-snake"]?.version).toBe(1));
    expect(screen.queryByRole("button", { name: /Go back to version/ })).toBeNull();
  });

  it("an app with one version has no version label and no way back", () => {
    act(() => store.setApps([snake()]));
    render(<ProjectPage slug="snake" go={() => undefined} />);
    expect(screen.queryByText(/^Version \d/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Versions" }));
    expect(screen.queryByRole("button", { name: /Go back to version/ })).toBeNull();
  });
});
