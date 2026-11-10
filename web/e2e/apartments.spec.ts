// The neighbourhood (decision 188): three New York style apartment buildings on the block south of HQ instead of
// rows of houses. Saved specialists stand by the doors, and a hired one walks out of its building's door to work.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
type Box = { x: number; y: number; w: number; h: number };
type Hooks = HTMLElement & {
  _world?: () => { homes: Box & { apartments?: Array<Box & { kind: string }> } };
  _view?: () => { x: number; y: number; zoom: number };
  _people?: Map<string, { x: number; y: number; key: string; route?: Array<{ x: number; y: number }> | null; waitUntil?: number }>;
};

// The first block of homes, on the screen, zoomed in on.
async function zoomToHomes(page: Page) {
  const at = await page.evaluate(() => {
    const root = document.querySelector("section.city") as unknown as Hooks;
    const h = root._world!().homes, v = root._view!(), r = root.getBoundingClientRect();
    const cy = (h.y + Math.min(h.h, 12) / 2) * 16;
    return { x: r.left + ((h.x + h.w / 2) * 16 - v.x) * v.zoom, y: r.top + (cy - v.y) * v.zoom };
  });
  await page.mouse.move(at.x, at.y);
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const root = document.querySelector("section.city") as unknown as Hooks;
    const h = root._world!().homes, v = root._view!(), r = root.getBoundingClientRect();
    const hh = Math.min(h.h, 12);
    const x = r.left + (h.x * 16 - 24 - v.x) * v.zoom, y = r.top + (h.y * 16 - 40 - v.y) * v.zoom;
    const w = (h.w * 16 + 48) * v.zoom, ht = (hh * 16 + 88) * v.zoom;
    const cx = Math.max(0, x), cy = Math.max(0, y);
    return { x: cx, y: cy, width: Math.min(innerWidth - cx, w), height: Math.min(innerHeight - cy, ht) };
  });
}

test("the neighbourhood: three apartment buildings, and workers walk out of their doors", async ({ page }) => {
  test.slow();
  const m = await mockBackend(page);
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  // Four saved specialists at home.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["wkr-research-a1", "wkr-research-b2", "wkr-research-c3", "wkr-research-d4"]) {
    m.send(hired(id, "Research"));
    m.send({ type: "agent.retired", id });
  }
  await expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._people?.get("wkr-research-d4")?.key)).toBe("home");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const clip = await zoomToHomes(page);
  await page.screenshot({ path: `${SHOTS}/${process.env.APT_SHOT ?? "city-apartments"}.png`, clip });

  const apartments = await page.evaluate(() => (document.querySelector("section.city") as unknown as Hooks)._world!().homes.apartments ?? []);
  expect(apartments.map((a) => a.kind)).toEqual(["slim", "mid", "wide"]);
  // Different sizes, and not in a tidy row.
  expect(new Set(apartments.map((a) => a.w)).size).toBe(3);
  expect(new Set(apartments.map((a) => a.h)).size).toBe(3);
  expect(new Set(apartments.map((a) => a.y + a.h)).size).toBeGreaterThan(1);

  // Hired again: the worker leaves through the door of its own building.
  m.send(hired("wkr-research-a1", "Research"));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = (document.querySelector("section.city") as unknown as Hooks)._people?.get("wkr-research-a1");
        return p?.route ? p.route[0] : null;
      }),
    )
    .not.toBeNull();
  const start = await page.evaluate(() => {
    const root = document.querySelector("section.city") as unknown as Hooks;
    const p = root._people!.get("wkr-research-a1")!;
    return { first: p.route![0]!, from: { x: p.x, y: p.y } };
  });
  const doors = apartments.map((a) => ({ x: (a.x + a.w / 2) * 16, y: (a.y + a.h) * 16 - 6 }));
  expect(doors).toContainEqual(start.first); // the first step is to its building's door
  expect(Math.hypot(start.from.x - start.first.x, start.from.y - start.first.y)).toBeLessThan(40); // it stood by that door
});
