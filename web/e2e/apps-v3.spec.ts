// Apps v3 (docs/APPS.md "v3"): a game keeps its best score through the `state` grant, and a new version can
// be taken back to the previous one.
import { expect, test } from "@playwright/test";
import { appRecord, mockBackend } from "./mock.ts";

test("a game keeps its best score with the state grant, across a reload", async ({ page }) => {
  const m = await mockBackend(page, {
    apps: [appRecord("app-score0000001", "pebble-hop", "Pebble Hop", { grants: [{ id: "state" }] })],
  });
  await page.goto("/#/apps/pebble-hop");
  const game = page.frameLocator('iframe[title^="Pebble Hop"]');
  await expect(game.locator("#best")).toHaveText("Best: 0");
  for (let i = 0; i < 3; i++) await game.getByRole("button", { name: "Hop" }).click();
  await expect(game.locator("#best")).toHaveText("Best: 3");
  await expect.poll(() => m.state["app-score0000001/best"]).toBe(3);
  await page.reload();
  await expect(page.frameLocator('iframe[title^="Pebble Hop"]').locator("#best")).toHaveText("Best: 3");
  const sets = m.calls.filter((c) => c.path === "/apps/app-score0000001/bridge");
  expect(sets.every((c) => ["state.get", "state.set"].includes(String((c.body as { cap: string }).cap)))).toBe(true);
});

test("without the state grant the game still plays and saves nothing", async ({ page }) => {
  const m = await mockBackend(page, { apps: [appRecord("app-score0000002", "pebble-hop", "Pebble Hop")] });
  await page.goto("/#/apps/pebble-hop");
  const game = page.frameLocator('iframe[title^="Pebble Hop"]');
  await expect(game.locator("#best")).toHaveText("Best: 0");
  await game.getByRole("button", { name: "Hop" }).click();
  await expect(game.locator("#n")).toHaveText("1 hops");
  expect(m.calls.filter((c) => c.path.endsWith("/bridge"))).toEqual([]); // refused in the HUD
  expect(m.state).toEqual({});
});

test("a new version shows its number and can go back to the previous one", async ({ page }) => {
  const v1 = appRecord("app-snake0000001", "snake", "Snake", { version: 1 });
  const m = await mockBackend(page, {
    apps: [
      appRecord("app-snake0000001", "snake", "Snake Turbo", {
        version: 2,
        url: `${String(v1.url).replace("index.html", "drf-2/index.html")}`,
        history: [{ ...v1, history: undefined }],
      }),
    ],
  });
  await page.goto("/#/apps/snake");
  await expect(page.getByRole("heading", { name: "Snake Turbo" })).toBeVisible();
  await expect(page.getByText("Version 2")).toBeVisible();
  await page.getByRole("button", { name: "Back to version 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Go back to version 1?" });
  await expect(dialog).toContainText("Its saved data (such as scores) stays.");
  await dialog.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByRole("heading", { name: "Snake", exact: true })).toBeVisible();
  await expect(page.getByText("Version 2")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Back to version/ })).toHaveCount(0);
  expect(m.calls.some((c) => c.method === "POST" && c.path === "/apps/app-snake0000001/rollback")).toBe(true);
});
