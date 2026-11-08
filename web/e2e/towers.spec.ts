// The towers (decision 117): one Manhattan-style tower per department, the same size whatever the headcount;
// workers go in through automatic doors and out again, and a counter on the roof follows who is inside.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
type Hooks = {
  _people?: Map<string, { key: string; inside?: boolean; route?: unknown; waitUntil?: number }>;
  _counts?: Map<string, { n: number; delta: number }>;
  _doors?: Map<string, number>;
  _world?: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }> };
};
const hooks = <T>(page: Page, f: (h: Hooks) => T) =>
  page.evaluate((src) => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    return new Function("h", `return (${src})(h)`)(h);
  }, f.toString()) as Promise<T>;
const count = (page: Page) => hooks(page, (h) => h._counts?.get("Research")?.n ?? 0);
const door = (page: Page) => hooks(page, (h) => h._doors?.get("Research") ?? 0);
const inside = (page: Page, id: string) =>
  page.evaluate((pid) => !!(document.querySelector("section.city") as unknown as Hooks)._people?.get(pid)?.inside, id);
const tower = (page: Page) =>
  hooks(page, (h) => {
    const b = h._world?.().buildings.find((x) => x.dept === "Research");
    return b ? { w: b.w, h: b.h } : null;
  });

test("workers walk in through automatic doors, the roof counts them, and they come out again; the tower never grows", async ({
  page,
}) => {
  test.slow();
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  await expect.poll(() => tower(page)).not.toBeNull();
  const size = (await tower(page))!;
  expect(await count(page)).toBe(0);

  m.send(hired("wkr-research-a1", "Research"));
  // The doors open as the worker reaches them, the worker disappears inside, the doors shut, the roof says 1.
  await expect.poll(() => door(page), { timeout: 10_000, intervals: [50] }).toBeGreaterThan(0.5);
  await expect.poll(() => inside(page, "wkr-research-a1"), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => count(page)).toBe(1);
  await expect.poll(() => door(page), { timeout: 5000 }).toBe(0);

  // Ten more: the counter climbs, the tower keeps its size.
  for (let i = 0; i < 10; i++) m.send(hired(`wkr-research-b${i}`, "Research"));
  await expect.poll(() => count(page), { timeout: 30_000 }).toBe(11);
  expect(await tower(page)).toEqual(size);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/city-towers.png` });

  // One finishes: the doors open, the worker steps out and walks home, the roof says 10.
  m.send({ type: "agent.retired", id: "wkr-research-a1" });
  await expect.poll(() => inside(page, "wkr-research-a1"), { timeout: 10_000 }).toBe(false);
  await expect.poll(() => count(page)).toBe(10);
  expect(await hooks(page, (h) => h._counts?.get("Research")?.delta)).toBe(-1);
});
