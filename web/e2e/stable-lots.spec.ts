// Every tower keeps its lot (the owner, 2026-11-12, decision 248): build a department and it goes up on a free lot,
// demolish one and its lot stands empty; no other tower moves on screen, and building again takes that empty lot.
// Read-only hooks on section.city: _world, _view, _anims.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

type Box = { dept: string; x: number; y: number; w: number; h: number; slot: number };
type Hooks = {
  _world?: () => { buildings: Box[]; lots: Array<Omit<Box, "dept"> & { demolished?: string }>; width: number; height: number };
  _view?: () => { x: number; y: number; zoom: number };
  _anims?: Map<string, unknown>;
};
const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research"];

// The whole map fitted on screen (the Fit button), then where every tower is on the screen, in CSS pixels.
const onScreen = async (page: Page) => {
  await page.getByRole("button", { name: "Fit the whole map" }).click();
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    const v = h._view!(), out: Record<string, [number, number, number, number]> = {};
    for (const b of h._world!().buildings) out[b.dept] = [b.x * 16, b.y * 16, b.w * 16, b.h * 16].map((n, i) => Math.round(i < 2 ? (n - (i ? v.y : v.x)) * v.zoom : n * v.zoom)) as [number, number, number, number];
    return out;
  });
};
const world = (page: Page) => page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._world!());
const settled = (page: Page) => expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._anims?.size ?? 0), { timeout: 10_000 }).toBe(0);

async function build(page: Page, name: string) {
  await page.getByRole("button", { name: "+ Build a department" }).click();
  const form = page.getByRole("form", { name: "Build a department" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel(/What it does/).fill(`${name} work`);
  await form.getByRole("button", { name: "Build it" }).click();
  await expect.poll(async () => (await world(page)).buildings.some((b) => b.dept === name)).toBe(true);
  await settled(page);
  await page.keyboard.press("Escape");
}

test("adding and demolishing departments never moves another tower on screen", async ({ page }) => {
  test.slow();
  const departments = NAMES.map((name, i) => ({
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    mission: `${name} work.`,
    manager_id: `mgr-${i}`,
    state: "active",
    created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(),
  }));
  const m = await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(async () => (await world(page)).buildings.length).toBe(11);
  await settled(page);
  const start = await onScreen(page), size = await world(page);
  expect(Object.keys(start)).toHaveLength(11);
  expect(size.lots.map((l) => l.slot)).toEqual([11, 12, 13]); // a 4 × 4 square: fourteen lots, three free
  // Each lot is as big as the tower that stood on it when the lots were numbered (the server's sizes reach the scene).
  const dims = Object.fromEntries(size.buildings.map((b) => [b.dept, [b.w, b.h]]));
  expect([dims.Application, dims["IT Infrastructure"], dims["Data & AI"], dims.Marketing]).toEqual([[8, 11], [10, 11], [10, 13], [10, 12]]);

  // Build: it takes the free lot; every other tower stays exactly where it was on screen.
  await build(page, "Partnerships");
  const added = await onScreen(page);
  for (const name of NAMES) expect(added[name], name).toEqual(start[name]);
  expect((await world(page)).buildings.find((b) => b.dept === "Partnerships")?.slot).toBe(11);
  await page.screenshot({ path: test.info().outputPath("city-added.png") });

  // Demolish Sales: its lot stands empty; nothing else moves, the map keeps its size.
  await page.locator("nav.depts").getByRole("button", { name: "Sales" }).click();
  const panel = page.getByRole("dialog", { name: "Sales department" });
  await panel.getByRole("button", { name: "Demolish this department" }).click();
  await panel.getByRole("button", { name: "Yes, demolish" }).click();
  await expect.poll(() => m.calls.some((c) => c.method === "DELETE" && c.path === "/departments/sales")).toBe(true);
  await expect.poll(async () => (await world(page)).buildings.some((b) => b.dept === "Sales")).toBe(false);
  await settled(page);
  const down = await onScreen(page);
  for (const name of [...NAMES.filter((n) => n !== "Sales"), "Partnerships"]) expect(down[name], name).toEqual(added[name]);
  const after = await world(page);
  expect([after.width, after.height]).toEqual([size.width, size.height]);
  expect(after.lots.map((l) => l.slot)).toEqual([4, 12, 13]);
  await page.screenshot({ path: test.info().outputPath("city-demolished.png") });

  // Build again: it goes up on Sales's old lot, at that lot's size, in the same place on screen.
  await build(page, "Events");
  const again = await onScreen(page);
  expect(again.Events).toEqual(start.Sales);
  for (const name of [...NAMES.filter((n) => n !== "Sales"), "Partnerships"]) expect(again[name], name).toEqual(added[name]);

  // A reload with the same records draws the same city.
  await page.reload();
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(async () => (await world(page)).buildings.length).toBe(12);
  await settled(page);
  expect(await onScreen(page)).toEqual(again);
  await page.screenshot({ path: test.info().outputPath("city-reloaded.png") });
});
