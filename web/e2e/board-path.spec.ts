// Decision 289: the project board. These replay the exact events the backend sends (recorded from the in-process
// city by backend/tests/test_board_fixtures.py) for a small app change on the new board path, the same change on the
// old chain, and a medium build, and check that the City, the project page and its chat read them as before: the
// hire rides into the right tower, "Agents working now" is who is inside, the live preview names who edits what, the
// steps and replies form one timeline, and no id ever reaches the chat.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, mockBackend, type Mock } from "./mock.ts";

type Ev = Record<string, unknown> & { type: string };
const fixture = (name: string): Ev[] =>
  JSON.parse(readFileSync(`${import.meta.dirname}/fixtures/${name}.json`, "utf8")) as Ev[];
const SHOTS = process.env.BOARD_SHOTS ?? `${import.meta.dirname}/../test-results/board-shots`;
const NAMES = [
  "Application",
  "IT Infrastructure",
  "Data & AI",
  "Marketing",
  "Sales",
  "Customer Support",
  "Finance",
  "Legal",
  "Product",
  "Operations",
  "Research",
  "Media",
];
const departments = NAMES.map((name, i) => ({
  key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  mission: "x",
  manager_id: `mgr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  state: "active",
  created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(),
}));
const APP = "app-0000000000aa";

/** Sends the stream as the bus would, a few ms apart; a project chat's conversation can be swapped for the page's. */
async function replay(page: Page, m: Mock, events: Ev[], conv?: { from: string; to: string }) {
  for (const e of events) {
    const text = JSON.stringify(e);
    m.send(JSON.parse(conv ? text.split(conv.from).join(conv.to) : text) as Ev);
    await page.waitForTimeout(40);
  }
}
const workerIds = (events: Ev[]) =>
  events
    .filter((e) => e.type === "agent.hired" && (e.agent as { kind: string }).kind === "worker")
    .map((e) => (e.agent as { id: string }).id);
const inside = (page: Page, ids: string[], dept: string) =>
  page.evaluate(
    ([list, d]) => {
      const el = document.querySelector("section.city") as unknown as HTMLElement & {
        _people?: Map<string, { insideOf?: string | null }>;
      };
      return {
        inside: list.filter((id) => el._people?.get(id)?.insideOf === d).length,
        everyone: [...(el._people?.values() ?? [])].filter((p) => p.insideOf).length,
        atWork: Number(el.dataset.atWork ?? -1),
        shown: document.querySelector(".city")?.textContent?.match(/Agents working now\s*(\d+)/)?.[1] ?? null,
      };
    },
    [ids, dept] as const,
  );

for (const [name, label] of [
  ["board-small", "a small change on the board"],
  ["chain-small", "the same change on the old chain (before)"],
  ["board-medium", "a medium build on the board"],
  ["chain-medium", "the same build on the old chain (before)"],
] as const) {
  test(`City: ${label}: hires ride into the Application tower and the count is who is inside`, async ({ page }) => {
    test.setTimeout(90_000);
    const events = fixture(name);
    const m = await mockBackend(page, {
      snapshot: { departments },
      apps: [appRecord(APP, "star-sweeper", "Star Sweeper")],
    });
    await page.goto("/#/city");
    const city = page.locator("section.city");
    await expect(city).toHaveAttribute("data-city-ready", "1");
    await expect(city).toHaveAttribute("data-at-work", "0");
    const ids = workerIds(events);
    // Up to the last worker being put to work, then they ride in.
    const lastStart = events.findLastIndex(
      (e) => e.type === "worker.state" && e.state === "working" && ids.includes(String(e.id)),
    );
    const firstHome = events.findIndex((e) => e.type === "agent.retired");
    const cut = firstHome >= 0 && firstHome < lastStart ? firstHome : lastStart + 1;
    await replay(page, m, events.slice(0, cut));
    const sent = events.slice(0, cut);
    const riding = workerIds(sent).filter((id) => !sent.some((e) => e.type === "agent.retired" && e.id === id));
    await expect
      .poll(() => inside(page, riding, "Application").then((c) => c.inside), { timeout: 20_000 })
      .toBe(riding.length);
    const c = await inside(page, riding, "Application");
    expect(c.atWork).toBe(c.everyone); // everyone inside a tower, the department's reviewer too when it is reviewing
    expect(c.atWork).toBeGreaterThanOrEqual(riding.length);
    await expect.poll(() => inside(page, riding, "Application").then((x) => x.shown)).toBe(String(c.atWork));
    await page.screenshot({ path: `${SHOTS}/city-${name}.png` });
    await replay(page, m, events.slice(cut));
    await expect.poll(() => inside(page, ids, "Application").then((x) => x.atWork), { timeout: 20_000 }).toBe(0);
  });
}

for (const [name, label] of [
  ["board-small", "a small change on the board"],
  ["chain-small", "the same change on the old chain (before)"],
] as const) {
  test(`Projects: ${label}: live preview with who edits what, one timeline, no ids`, async ({ page }) => {
    test.setTimeout(60_000);
    const events = fixture(name);
    const m = await mockBackend(page, {
      snapshot: { departments },
      apps: [appRecord(APP, "star-sweeper", "Star Sweeper")],
    });
    await page.route("https://apps.vaic.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Star Sweeper</title><h1>Star Sweeper</h1>",
      }),
    );
    await page.goto(`/#/apps/star-sweeper`);
    await expect(page.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
    const box = page.getByRole("textbox", { name: "Message VAIC about Star Sweeper" });
    await box.fill("change the memory game to 4 pairs");
    await box.press("Enter");
    const preview = events.findIndex((e) => e.type === "app.preview");
    await replay(page, m, events.slice(0, preview + 1));
    // While it builds: the preview is live and names who is changing what.
    const editors = page.getByRole("list", { name: "Who is changing the app" });
    await expect(editors).toContainText("now editing app/game.js");
    const log = page.locator(".pj-log");
    await expect(log.getByText("Edited app/game.js").first()).toBeAttached();
    await page.screenshot({ path: `${SHOTS}/project-${name}-building.png` });
    await replay(page, m, events.slice(preview + 1));
    // Done: VAIC's last reply sits below the builders' steps, and the ring is gone.
    const last = String([...events].reverse().find((e) => e.type === "vaic.reply" && e.done)?.text ?? "");
    await expect(log.locator(".pj-vaic").last()).toContainText(last.slice(0, 30));
    await expect(log.getByRole("status")).toHaveCount(0);
    const order = await log.evaluate((el) =>
      [...el.querySelectorAll(".pj-msg, .buildlog")].map((x) =>
        x.classList.contains("buildlog") ? "steps" : x.classList.contains("pj-owner") ? "owner" : "vaic",
      ),
    );
    expect(order[0]).toBe("owner");
    expect(order.at(-1)).toBe("vaic");
    expect(order).toContain("steps");
    expect(await log.textContent()).not.toMatch(/\b(wkr|mgr)-[a-z-]+-[0-9a-f]{6,}/);
    await page.screenshot({ path: `${SHOTS}/project-${name}-done.png` });
  });
}

for (const name of ["board-medium", "chain-medium"] as const)
  test(`Projects: ${name}: a medium build from a new project: steps, preview and the final reply in its chat only`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const events = fixture(name);
    const m = await mockBackend(page, { snapshot: { departments } });
    await page.route("https://apps.vaic.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Memory</title><h1>Memory</h1>",
      }),
    );
    await page.goto("/#/apps");
    await page.getByRole("button", { name: /New project/ }).click();
    const dialog = page.getByRole("dialog", { name: "What should your app do?" });
    await dialog.getByPlaceholder("Describe your app in one sentence").fill("build me a memory game with animals");
    await dialog.getByRole("button", { name: "Start building" }).click();
    await expect(page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
    const conv = `app-${page.url().split("/apps/")[1]}`;
    await replay(page, m, events, { from: "app-new-mem0001", to: conv });
    const log = page.locator(".pj-log");
    await expect(log.getByText("Edited app/game.js").first()).toBeAttached();
    const last = String([...events].reverse().find((e) => e.type === "vaic.reply" && e.done)?.text ?? "");
    await expect(log.locator(".pj-vaic").last()).toContainText(last.slice(0, 30));
    expect(await log.textContent()).not.toMatch(/\b(wkr|mgr)-[a-z-]+-[0-9a-f]{6,}/);
    await expect(log.getByRole("status")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/project-${name}-done.png` });
  });
