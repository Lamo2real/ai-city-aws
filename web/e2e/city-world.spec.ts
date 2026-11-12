// Decision 279: the world runs far past the town (drag and zoom much further), only departments' towers and HQ stand
// as big buildings, and a department's windows light only for the agents working in it.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

type Hooks = {
  _world?: () => { left: number; top: number; width: number; height: number; neighbours: unknown[]; buildings: Array<{ dept: string }> };
  _view?: () => { x: number; y: number; zoom: number };
};
const world = (page: Page) => page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._world!());
const view = (page: Page) => page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._view!());

test("a much bigger world to drag around, only departments' towers, dark windows when nobody works", async ({ page }) => {
  const departments = ["Media", "Marketing", "Finance", "Sales"].map((name, i) => ({ key: name.toLowerCase(), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  await expect.poll(async () => (await world(page)).buildings.map((b) => b.dept).sort()).toEqual(["Finance", "Marketing", "Media", "Sales"]);
  const w = await world(page);
  expect(w.neighbours).toEqual([]);
  // Green round every tower, pavement only in front of its door (decision 282).
  const ground = await page.evaluate(() => {
    const h = document.querySelector("section.city") as unknown as { _world: () => { buildings: Array<{ x: number; y: number; w: number; h: number }> }; _groundAt: (x: number, y: number) => number[] | null };
    return h._world().buildings.map((b) => ({ side: h._groundAt(b.x * 16 - 5, (b.y + b.h) * 16 - 70), front: h._groundAt((b.x + b.w / 2) * 16 + 30, (b.y + b.h) * 16 - 4) }));
  });
  const green = (c: number[] | null) => !!c && c[1]! > c[0]! + 10 && c[1]! > c[2]!;
  for (const g of ground) { expect(green(g.side), `beside a tower ${g.side}`).toBe(true); expect(green(g.front), `in front of its door ${g.front}`).toBe(false); }
  // Nobody working: every department dark.
  await expect.poll(() => city.getAttribute("data-lit")).toBe("");
  // Drag far west and north: the camera goes well past where the old map ended (48 tiles of countryside).
  const box = (await city.boundingBox())!;
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  const v = await view(page);
  expect(v.x).toBeLessThan((w.left - 48) * 16);
  expect(v.y).toBeLessThan((w.top - 48) * 16);
  await page.screenshot({ path: test.info().outputPath("city-far-countryside.png") });
});
