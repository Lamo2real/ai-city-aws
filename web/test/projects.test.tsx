// Projects (docs/PRODUCT.md "Projects"): project chats stay out of VAIC's main chat, choice chips answer, the
// preview sizes, the list, and going back several versions.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPage, ProjectsScreen } from "../src/components/Projects.tsx";
import { loadConfig } from "../src/lib/config.ts";
import { eventWords, fitScale, projectList, projects, clampSize } from "../src/lib/projects.ts";
import { store } from "../src/lib/store.ts";

const APPS = "https://apps.vaic.test";
const snake = (extra: Record<string, unknown> = {}) => ({
  app_id: "app-snake",
  slug: "snake",
  title: "Snake",
  description: "Eat the apples.",
  url: `${APPS}/live/app-snake/index.html`,
  published_at: "2026-11-07T10:00:00Z",
  ...extra,
});
const calls: Array<{ url: string; method: string; body: unknown }> = [];
let activity: Response | null = null;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test", appsUrl: APPS }));
  calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
  if (url.endsWith("/activity")) return activity ?? new Response(JSON.stringify({ error: "nope" }), { status: 404 });
  if (url.endsWith("/rollback")) {
    const app = store.get().city.apps["app-snake"]!;
    const [prev, ...rest] = app.history ?? [];
    return new Response(JSON.stringify({ app: { ...app, ...prev, history: rest } }));
  }
  if (url.endsWith("/apps")) return new Response(JSON.stringify({ apps: Object.values(store.get().city.apps) }));
  return new Response(JSON.stringify({ accepted: true }), { status: 202 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
beforeEach(() => {
  localStorage.clear();
  projects.state = { chats: {}, asks: {}, thinking: {}, feed: {}, drafts: [] };
  act(() => store.set({ chat: [] }));
});
afterEach(() => {
  cleanup();
  calls.length = 0;
  activity = null;
});

describe("project chats", () => {
  it("replies with an app- conversation go to the project, not VAIC's main chat", () => {
    const e = { type: "vaic.reply", conversation: "app-app-snake", text: "Which colour?", done: true };
    store.event(e);
    projects.event(e);
    expect(store.get().chat).toEqual([]);
    expect(projects.get().chats["app-app-snake"]?.map((l) => l.text)).toEqual(["Which colour?"]);
    // The same final reply twice (direct and through the bus) is one line.
    projects.event(e);
    expect(projects.get().chats["app-app-snake"]).toHaveLength(1);
    // The main conversation still reaches the main chat.
    store.event({ type: "vaic.reply", conversation: "main", text: "Hi", done: true });
    expect(store.get().chat.map((l) => l.text)).toEqual(["Hi"]);
  });

  it("a choice chip sends the option to the project's conversation and clears the question", async () => {
    act(() => store.setApps([snake()]));
    render(<ProjectPage slug="snake" go={() => undefined} />);
    act(() =>
      projects.event({
        type: "vaic.question",
        conversation: "app-app-snake",
        question: "How fast should the snake be?",
        options: ["Slow", "Medium", "Fast"],
      }),
    );
    expect(screen.getByRole("group", { name: "How fast should the snake be?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fast" }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/messages"))?.body).toMatchObject({
        text: "Fast",
        conversation: "app-app-snake",
      }),
    );
    expect(screen.queryByRole("group", { name: /How fast/ })).toBeNull();
    expect(screen.getByLabelText("VAIC is thinking")).toBeTruthy();
  });

  it("starting a project sends the idea as the first message of app-new-<id>", async () => {
    const p = await projects.start("Build me a memory game with animal cards");
    expect(p.key).toMatch(/^new-[a-z0-9]+$/);
    expect(p.title).toBe("Memory game with animal cards");
    expect(calls.at(-1)?.body).toMatchObject({
      text: "Build me a memory game with animal cards",
      conversation: `app-${p.key}`,
    });
    const list = projectList({}, projects.get().drafts);
    expect(list[0]).toMatchObject({ slug: p.key, app: null, conversation: `app-${p.key}` });
  });

  it("an app built from a new project's chat takes its lines and leaves the drafts", async () => {
    const p = await projects.start("A quiz about world capitals");
    const from = `app-${p.key}`;
    projects.event({ type: "vaic.reply", conversation: from, text: "Shall I build it?", done: true });
    projects.event({ type: "app.published", app_id: "app-quiz", conversation: from, title: "Capital Quiz" });
    expect(projects.get().drafts).toEqual([]);
    expect(projects.get().chats[from]).toBeUndefined();
    expect(projects.get().chats["app-app-quiz"]?.map((l) => l.text)).toEqual([
      "A quiz about world capitals",
      "Shall I build it?",
    ]);
    // A published app that names its chat never shows twice in the list.
    const app = {
      app_id: "app-quiz",
      slug: "quiz",
      title: "Capital Quiz",
      url: `${APPS}/live/app-quiz/index.html`,
      conversation: from,
    };
    expect(projectList({ "app-quiz": app }, [p]).map((x) => x.slug)).toEqual(["quiz"]);
  });

  it("a key typed into a project chat is never sent", async () => {
    await expect(projects.send("app-app-snake", "AKIAIOSFODNN7EXAMPLE")).rejects.toThrow(/key or password/);
    expect(calls).toEqual([]);
  });
});

describe("timeline", () => {
  it("app events become plain words for their project", () => {
    expect(eventWords({ type: "app.updated", app: { app_id: "a1", version: 3 } })).toEqual({
      conv: "app-a1",
      who: "VAIC",
      text: "Version 3 is live",
    });
    expect(eventWords({ type: "approval.requested", kind: "app.publish", replaces: "a1" })?.text).toMatch(/Open items/);
    expect(eventWords({ type: "ticket.status", ticket: { app_id: "a1", status: "running" } })?.who).toBe("Builder");
    expect(eventWords({ type: "agent.hired" })).toBeNull();
  });

  it("uses the server's activity when there is one, and the city's events when it 404s", async () => {
    act(() => store.setApps([snake()]));
    projects.event({ type: "app.updated", app: { app_id: "app-snake", version: 2 } });
    render(<ProjectPage slug="snake" go={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "What's happening" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/apps/app-snake/activity"))).toBe(true));
    expect(screen.getByText("Version 2 is live")).toBeTruthy();
    cleanup();
    activity = new Response(
      JSON.stringify({ items: [{ at: "2026-11-08T10:00:00Z", who: "Builder", text: "Drawing the board" }] }),
    );
    render(<ProjectPage slug="snake" go={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "What's happening" }));
    expect(await screen.findByText("Drawing the board")).toBeTruthy();
  });
});

describe("the preview", () => {
  it("fits a device into the stage and never upscales; sizes are clamped", () => {
    expect(fitScale(390, 844, 800, 422)).toBe(0.5);
    expect(fitScale(390, 844, 2000, 2000)).toBe(1);
    expect(clampSize(10)).toBe(240);
    expect(clampSize(99999)).toBe(3840);
    expect(clampSize(Number.NaN)).toBe(240);
  });

  it("switches between full size, phone, tablet, laptop and a custom size", () => {
    act(() => store.setApps([snake()]));
    const { container } = render(<ProjectPage slug="snake" go={() => undefined} />);
    expect(container.querySelector(".pv-device")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Phone" }));
    expect(container.querySelector(".pv-device")?.getAttribute("data-width")).toBe("390");
    fireEvent.click(screen.getByRole("radio", { name: "Tablet" }));
    expect(container.querySelector(".pv-device")?.getAttribute("data-height")).toBe("1180");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Width in pixels"), { target: { value: "600" } });
    expect(container.querySelector(".pv-device")?.getAttribute("data-width")).toBe("600");
    expect(screen.getByTitle(/Snake/).getAttribute("sandbox")).toBe("allow-scripts");
  });
});

describe("the list and versions", () => {
  it("New project comes first, then the projects, newest first", () => {
    act(() =>
      store.setApps([
        snake(),
        snake({ app_id: "app-pond", slug: "pond", title: "Pond", published_at: "2026-11-08T10:00:00Z" }),
      ]),
    );
    render(<ProjectsScreen />);
    const list = screen.getByRole("list", { name: "Your projects" });
    expect(list.querySelector("li button")?.textContent).toMatch(/New project/);
    expect([...list.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["#/apps/pond", "#/apps/snake"]);
    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    expect(screen.getByRole("dialog", { name: "What should your app do?" })).toBeTruthy();
  });

  it("going back two versions asks once and steps back twice", async () => {
    act(() =>
      store.setApps([
        snake({
          version: 3,
          history: [
            { version: 2, title: "Snake" },
            { version: 1, title: "Snake" },
          ],
        }),
      ]),
    );
    render(<ProjectPage slug="snake" go={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Versions" }));
    fireEvent.click(screen.getByRole("button", { name: "Go back to version 1" }));
    expect(screen.getByText(/Versions 3, 2 are deleted/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(store.get().city.apps["app-snake"]?.version).toBe(1));
    expect(calls.filter((c) => c.url.endsWith("/rollback"))).toHaveLength(2);
  });
});
