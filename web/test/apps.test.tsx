// Apps (docs/APPS.md): the reducers, the hash routes and the one way an app is framed.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { applySnapshot, initialState, reduce } from "../src/city/city-state.js";
import { AppFrame } from "../src/components/Apps.tsx";
import { ProjectPage, ProjectsScreen } from "../src/components/Projects.tsx";
import { Inbox } from "../src/components/Inbox.tsx";
import { capped, onAppsOrigin, route } from "../src/lib/apps.ts";
import { loadConfig } from "../src/lib/config.ts";
import { store } from "../src/lib/store.ts";

const APPS = "https://apps.aic.test";
const app = (n: number, extra: Record<string, unknown> = {}) => ({
  app_id: `app-00000000000${n}`,
  slug: `game-${n}`,
  title: `Game ${n}`,
  description: `A game number ${n}`,
  icon_url: null,
  url: `${APPS}/live/app-00000000000${n}/index.html`,
  task_id: "t-1",
  published_at: `2026-11-0${n}T10:00:00Z`,
  ...extra,
});
const publish = {
  type: "approval.requested",
  id: "apr-1",
  agent: "orchestrator",
  kind: "app.publish",
  draft_id: "drf-000000000001",
  preview_url: `${APPS}/drafts/drf-000000000001/index.html`,
  title: "Star Sweeper",
  description: "Sweep the falling stars into the basket.",
};

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ apiUrl: "https://api.aic.test", appsUrl: APPS }))),
  );
  await loadConfig();
  vi.unstubAllGlobals();
});
afterEach(cleanup);

describe("apps in the city state", () => {
  it("come from the snapshot and follow app.published / app.removed", () => {
    let s = applySnapshot(initialState(), { agents: [], apps: [app(1)] });
    expect(Object.keys(s.apps)).toEqual(["app-000000000001"]);
    s = reduce(s, { type: "app.published", at: "x", ...app(2) });
    expect(s.apps["app-000000000002"]?.slug).toBe("game-2");
    expect(s.apps["app-000000000002"]).not.toHaveProperty("type");
    expect(s.feed[0]?.text).toBe("New app under Apps: Game 2");
    s = reduce(s, { type: "app.removed", app_id: "app-000000000001", slug: "game-1" });
    expect(Object.keys(s.apps)).toEqual(["app-000000000002"]);
    expect(s.feed[0]?.text).toBe("App removed: Game 1");
    // The HUD removes an app at once; the event that follows changes nothing.
    expect(reduce(s, { type: "app.removed", app_id: "app-000000000001" })).toBe(s);
  });
  it("a publish approval (no `action`) is held like any approval and gets its own feed line", () => {
    const s = reduce(initialState(), publish);
    expect(s.approvals["apr-1"]?.kind).toBe("app.publish");
    expect(s.feed[0]?.text).toBe("A new app is ready for you to try: Star Sweeper");
    expect(reduce(s, { type: "approval.decided", id: "apr-1", approved: true }).approvals).toEqual({});
  });
  it("a rejected draft says why", () => {
    const s = reduce(initialState(), {
      type: "app.draft",
      title: "X",
      status: "rejected",
      reason: "index.html missing",
    });
    expect(s.feed[0]).toMatchObject({ kind: "fail", text: "App X sent back: index.html missing" });
  });
  it("store.setApps replaces the list (GET /apps)", () => {
    act(() => store.setApps([app(1), app(3)]));
    expect(Object.keys(store.get().city.apps).sort()).toEqual(["app-000000000001", "app-000000000003"]);
  });
});

describe("routes", () => {
  const V = ["ace", "city", "inbox", "tickets", "apps", "costs", "settings"] as const;
  it.each([
    ["#/apps", "apps", null],
    ["#/apps/", "apps", null],
    ["#/apps/star-sweeper", "apps", "star-sweeper"],
    ["#/apps/a%20b", "apps", "a b"],
    ["#/apps/%E0%A4%A", "apps", "%E0%A4%A"],
    ["#/tickets", "tickets", null],
    ["#/tickets/decided", "tickets", "decided"],
    ["#/nope", "ace", null],
    ["", "ace", null],
  ])("%s → %s %s", (hash, view, slug) => {
    expect(route(hash, V)).toEqual({ view, slug });
  });
});

describe("the app frame", () => {
  it("has exactly sandbox=allow-scripts, no referrer and no features", () => {
    render(<AppFrame src={`${APPS}/live/app-1/index.html`} title="Game" />);
    const f = screen.getByTitle("Game");
    expect(f.tagName).toBe("IFRAME");
    expect(f.getAttribute("sandbox")).toBe("allow-scripts");
    expect(f.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(f.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(f.getAttribute("allow")).toBe("");
    expect(f.getAttribute("src")).toBe(`${APPS}/live/app-1/index.html`);
  });
  it("never frames anything off the apps origin", () => {
    for (const src of [
      "https://evil.test/x.html",
      "http://apps.aic.test/x",
      "javascript:alert(1)",
      "/live/x",
      "",
      null,
    ])
      expect(onAppsOrigin(src, APPS)).toBe(false);
    expect(onAppsOrigin(`${APPS}/live/a/index.html`, "")).toBe(false);
    render(<AppFrame src="https://evil.test/x.html" title="Bad" />);
    expect(screen.queryByTitle("Bad")).toBeNull();
    expect(screen.getByText(/can't be shown here/)).toBeTruthy();
  });
  it("agent text is capped plain text", () => {
    expect(capped("x".repeat(50), 40)).toHaveLength(40);
    expect(capped("  a \n b  ", 40)).toBe("a b");
  });
});

describe("screens", () => {
  it("Projects shows a card per app, newest first, and an empty state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ apps: [] }))),
    );
    act(() => store.setApps([app(1), app(2)]));
    render(<ProjectsScreen />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#/apps/game-2", "#/apps/game-1"]);
    cleanup();
    act(() => store.setApps([]));
    render(<ProjectsScreen />);
    expect(screen.getByText(/No apps yet. Describe one in a sentence/)).toBeTruthy();
    vi.unstubAllGlobals();
  });
  it("an app page frames the app and never listens for messages", () => {
    act(() => store.setApps([app(1)]));
    const spy = vi.spyOn(window, "addEventListener");
    render(<ProjectPage slug="game-1" go={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Game 1" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Projects" }).getAttribute("href")).toBe("#/apps");
    expect(screen.getByTitle(/Game 1/).getAttribute("sandbox")).toBe("allow-scripts");
    expect(spy.mock.calls.some(([t]) => t === "message")).toBe(false);
    spy.mockRestore();
  });
  it("an unknown slug says the app is gone", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ apps: [] }))),
    );
    act(() => store.snapshot({ agents: [], apps: [] }));
    render(<ProjectPage slug="nope" go={() => undefined} />);
    expect(screen.getByRole("heading", { name: "This app is gone" })).toBeTruthy();
    vi.unstubAllGlobals();
  });
  it("Needs you shows a publish with its preview and one primary Approve, even next to a question", () => {
    act(() =>
      store.snapshot({
        agents: [],
        approvals: [publish],
        questions: [
          {
            id: "q-1",
            asked_by: "mgr",
            path: "Apps",
            text: "Blue or red?",
            options: ["Blue", "Red"],
            default_answer: "Blue",
            created_at: "2026-11-07T10:00:00Z",
          },
        ],
      }),
    );
    const { container } = render(<Inbox />);
    expect(screen.getByRole("heading", { name: "Star Sweeper" })).toBeTruthy();
    expect(screen.getByText("Sweep the falling stars into the basket.")).toBeTruthy();
    const f = screen.getByTitle("Preview of Star Sweeper");
    expect(f.getAttribute("sandbox")).toBe("allow-scripts");
    expect(f.getAttribute("src")).toBe(publish.preview_url);
    expect(container.querySelectorAll(".btn-primary")).toHaveLength(1);
    expect(container.querySelector(".btn-primary")?.textContent).toBe("Approve");
    expect(screen.getByRole("button", { name: "Refuse" })).toBeTruthy();
  });
});
