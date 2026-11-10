// Apps v2 in the HUD: grants on the publish card, pins, app.updated (docs/APPS.md "v2: data bridge").
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { initialState, reduce } from "../src/city/city-state.js";
import { PinnedApps } from "../src/components/Apps.tsx";
import { Inbox } from "../src/components/Inbox.tsx";
import { capLabel, MAX_PINS, pinnedApps, updateApp } from "../src/lib/apps.ts";
import { loadConfig } from "../src/lib/config.ts";
import { store } from "../src/lib/store.ts";

const APPS = "https://apps.vaic.test";
const app = (n: number, extra: Record<string, unknown> = {}) => ({
  app_id: `app-00000000000${n}`,
  slug: `app-${n}`,
  title: `App ${n}`,
  url: `${APPS}/live/app-${n}/index.html`,
  published_at: `2026-11-0${n}T10:00:00Z`,
  ...extra,
});
const calls: Array<{ url: string; body: unknown; method: string }> = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test", appsUrl: APPS }));
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, body, method: init?.method ?? "GET" });
  if (url.includes("/approvals/")) return new Response(JSON.stringify({ approval: {}, app: app(7) }));
  return new Response(JSON.stringify({}));
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  // The API needs a token: the same fake auth hook the e2e mock uses.
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe("app.updated", () => {
  it("merges grants and pin into a known app, ignores an unknown one", () => {
    let s = reduce(initialState(), { type: "app.published", ...app(1), grants: [{ id: "calendar.read" }] });
    s = reduce(s, { type: "app.updated", app: { app_id: "app-000000000001", grants: [], pinned: true } });
    expect(s.apps["app-000000000001"]).toMatchObject({ grants: [], pinned: true, title: "App 1" });
    expect(reduce(s, { type: "app.updated", app: { app_id: "app-x", pinned: true } })).toBe(s);
  });
});

describe("capability words", () => {
  it("are plain, and unknown ones are never offered", () => {
    expect(capLabel({ id: "calendar.read" })).toBe("Read your calendars (all accounts)");
    expect(capLabel({ id: "mail.search" })).toBe("Search your mail (subjects and senders, not bodies)");
    expect(capLabel({ id: "connector.read", connector: "notion", tool: "search", label: "Notion" })).toBe(
      "Read from Notion: search",
    );
    expect(capLabel({ id: "connector.read" })).toBeNull();
    expect(capLabel({ id: "mail.send" })).toBeNull();
  });
});

describe("pins", () => {
  it("the top bar shows at most six pinned apps, each a 44px link named by its title", () => {
    act(() => store.setApps([1, 2, 3, 4, 5, 6, 7, 8].map((n) => app(n, { pinned: n !== 8 }))));
    expect(pinnedApps(store.get().city.apps)).toHaveLength(MAX_PINS);
    render(<PinnedApps />);
    const links = screen.getByRole("navigation", { name: "Pinned apps" }).querySelectorAll("a");
    expect(links).toHaveLength(6);
    expect(links[0]?.getAttribute("aria-label")).toBe("App 7");
    expect(links[0]?.getAttribute("href")).toBe("#/apps/app-7");
  });
  it("a 7th pin is refused with a plain message, before any API call", async () => {
    act(() => store.setApps([1, 2, 3, 4, 5, 6, 7].map((n) => app(n, { pinned: n !== 7 }))));
    await expect(updateApp("app-000000000007", { pinned: true })).rejects.toThrow(/Only 6 apps fit in the top bar/);
    expect(calls).toEqual([]);
  });
  it("unpinning sends PUT /apps/<id> {pinned:false} and moves at once", async () => {
    act(() => store.setApps([app(1, { pinned: true })]));
    await act(() => updateApp("app-000000000001", { pinned: false }));
    expect(calls).toEqual([
      { url: "https://api.vaic.test/apps/app-000000000001", body: { pinned: false }, method: "PUT" },
    ]);
    expect(store.get().city.apps["app-000000000001"]?.pinned).toBe(false);
  });
});

describe("publish card", () => {
  it("lists each known capability with a switch (on by default) and sends only the ones left on", async () => {
    act(() => {
      store.setApps([]);
      store.snapshot({
        agents: [],
        approvals: [
          {
            id: "apr-1",
            agent: "orchestrator",
            kind: "app.publish",
            title: "Star Calendar",
            preview_url: `${APPS}/drafts/d/index.html`,
            capabilities: [{ id: "calendar.read" }, { id: "mail.search" }, { id: "mail.send" }],
            pin: true,
          },
        ],
      });
    });
    render(<Inbox />);
    const cal = screen.getByRole("checkbox", { name: "Read your calendars (all accounts)" }) as HTMLInputElement;
    const mail = screen.getByRole("checkbox", { name: /Search your mail/ }) as HTMLInputElement;
    expect(cal.checked && mail.checked).toBe(true);
    expect(screen.queryByText(/mail.send/)).toBeNull();
    expect(screen.getByText("1 other request AI City doesn't know stay off.")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /top bar/ }) as HTMLInputElement).checked).toBe(true);
    // The preview is a preview: it gets no app id, so the bridge answers it `preview`.
    expect(screen.getByTitle("Preview of Star Calendar").getAttribute("sandbox")).toBe("allow-scripts");
    fireEvent.click(mail);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls[0]).toEqual({
      url: "https://api.vaic.test/approvals/apr-1",
      body: { approved: true, grants: [{ id: "calendar.read" }] },
      method: "POST",
    });
    expect(calls[1]).toMatchObject({ url: "https://api.vaic.test/apps/app-000000000007", body: { pinned: true } });
  });
});
