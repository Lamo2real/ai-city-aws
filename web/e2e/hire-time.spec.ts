// Decision 283: a hire, from the lit window at home through the taxi into the tower, takes about 10 seconds and never
// more than 15, however far the home and however many are hired at once; "Agents working now" is exactly who is
// inside the towers, rising as each one walks in and falling as they leave.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research", "Media"];
type P = { key: string; inside?: boolean; insideOf?: string | null; route?: unknown };
const census = (page: Page, ids: string[], dept = "Media") =>
  page.evaluate(([list, d]) => {
    const el = document.querySelector("section.city") as unknown as HTMLElement & { _people?: Map<string, P> };
    const inside = list.filter((id) => el._people?.get(id)?.insideOf === d).length; // in the tower (not still in at home)
    const riding = list.filter((id) => { const p = el._people?.get(id); return !!p && !p.inside; }).length;
    return { inside, riding, atWork: Number(el.dataset.atWork ?? -1), shown: document.querySelector(".city")?.textContent?.match(/Agents working now\s*(\d+)/)?.[1] ?? null };
  }, [ids, dept] as const);

test("ten hires into the furthest tower are all inside within 15 seconds, and the count follows who is inside", async ({ page }) => {
  test.setTimeout(60_000);
  const departments = NAMES.map((name, i) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  const m = await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as { _world: () => { buildings: unknown[] } })._world().buildings.length)).toBe(12);
  await expect(city).toHaveAttribute("data-at-work", "0");
  const far = "Media"; // the last lot, furthest from the homes
  const ids = Array.from({ length: 10 }, (_, i) => `wkr-media-${i}`);
  const t0 = Date.now();
  for (const id of ids) m.send(hired(id, far));
  let last = 0;
  for (;;) {
    const c = await census(page, ids);
    expect(c.atWork).toBe(c.inside); // never counted while at home or in the cab
    expect(c.atWork).toBeGreaterThanOrEqual(last); // only ever up while they arrive
    last = c.atWork;
    if (c.inside === ids.length) break;
    expect(Date.now() - t0).toBeLessThan(15_000);
    await page.waitForTimeout(100);
  }
  expect(Date.now() - t0).toBeLessThan(15_000);
  await expect.poll(() => census(page, ids).then((c) => c.shown)).toBe("10"); // the top bar says the same
  // The job ends: they walk out, and the count falls with them.
  for (const id of ids) m.send({ type: "agent.retired", id });
  await expect.poll(() => census(page, ids).then((c) => c.atWork), { timeout: 20_000 }).toBe(0);
});
