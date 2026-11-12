// Traffic (decision 173): lights at some junctions, a couple of roundabouts, highway pace out of town. The page's
// own simulation is read through the read-only hooks on section.city (_traffic, _signals, _view).
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

type Junction = { id: string; kind: string; cx: number; cy: number };
type Lane = { id: string; axis: "x" | "y"; len: number; townFrom: number; townTo: number; controls: Array<{ j: Junction; dc: number }> };
type Car = { id: string; lane: Lane | null; d: number; v: number; rare: boolean };
type Hooks = {
  _traffic?: { junctions: Junction[]; cars: Car[]; t: number; guests: Array<{ id?: string; x: number; y: number }> };
  _people?: Map<string, { x: number; y: number; inside?: boolean; route?: unknown; rv?: number }>;
  _signals?: () => Array<{ id: string; x: string; y: string }>;
  _view?: () => { x: number; y: number; zoom: number };
  dataset: DOMStringMap;
};
const hooks = <T>(page: Page, f: (h: Hooks) => T) =>
  page.evaluate((src) => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    return new Function("h", `return (${src})(h)`)(h);
  }, f.toString()) as Promise<T>;

async function openCity(page: Page) {
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  // Sixteen, so the compact town (decision 282) has four-way crossings for its roundabouts.
  const departments = ["Research", "Sales", "Legal", "Media", "Finance", "Product", "Marketing", "Operations", "Design", "Data", "Support", "People", "Security", "Growth", "Partners", "Studio"].map((name) => ({
    key: name.toLowerCase(),
    name,
    mission: "x",
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
}

// Zooms the map in on a junction of the given kind, with the mouse wheel at its spot on screen.
async function zoomTo(page: Page, kind: string) {
  const canvas = page.locator("section.city > canvas").first();
  const box = (await canvas.boundingBox())!;
  for (let i = 0; i < 6; i++) {
    const q = await page.evaluate((k) => {
      const h = document.querySelector("section.city") as unknown as Hooks;
      const j = h._traffic!.junctions.find((x) => x.kind === k)!;
      const v = h._view!();
      return { x: (j.cx - v.x) * v.zoom, y: (j.cy - v.y) * v.zoom, zoom: v.zoom };
    }, kind);
    if (q.zoom >= 4) break;
    await page.mouse.move(box.x + Math.max(10, Math.min(box.width - 10, q.x)), box.y + Math.max(10, Math.min(box.height - 10, q.y)));
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(350);
  }
}

test("lights at some junctions never go green both ways, and a cab waits at the red", async ({ page }, info) => {
  test.slow();
  await openCity(page);
  // (A roundabout needs a crossing with four roads out, decision 267: wait for the town's towers to be in.)
  await expect.poll(() => hooks(page, (h) => Number(h.dataset.roundabouts)), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  const signals = Number(await hooks(page, (h) => h.dataset.signals));
  const rounds = Number(await hooks(page, (h) => h.dataset.roundabouts));
  const total = await hooks(page, (h) => h._traffic!.junctions.length);
  expect(signals).toBe(6); // the crossings around HQ and the homes (decision 252)
  expect(signals).toBeLessThan(total); // some junctions, not all
  expect(rounds).toBeGreaterThanOrEqual(1); // scattered by the town's seed, more as the town grows (decision 259)
  expect(rounds).toBeLessThan(total / 3);
  // A few footbridges, none at a junction (decision 262): the cabs drive under them, the lights don't care.
  const bridges = await hooks(page, (h) => (h as unknown as { _bridges?: Array<{ x: number; y: number }> })._bridges ?? []);
  const js = await hooks(page, (h) => h._traffic!.junctions.map((j) => [j.cx, j.cy]));
  expect(bridges.length).toBeGreaterThan(0);
  for (const b of bridges) for (const [x, y] of js) expect(Math.hypot(b.x - x!, b.y - y!)).toBeGreaterThan(80);

  // Sample the lights for a full cycle and more: one way is always red; every colour shows.
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    for (const s of await hooks(page, (h) => h._signals!())) {
      expect(s.x === "red" || s.y === "red").toBe(true);
      seen.add(s.x).add(s.y);
    }
    await page.waitForTimeout(200);
  }
  expect([...seen].sort()).toEqual(["amber", "green", "red"]);

  // Some cab stands at a stop line while its light is red.
  await expect
    .poll(
      () =>
        hooks(page, (h) => {
          const sig = new Map(h._signals!().map((s) => [s.id, s]));
          return h._traffic!.cars.some((c) => {
            if (!c.lane || c.rare || c.v > 0.5) return false;
            const ctl = c.lane.controls.find((k) => k.j.kind === "light" && k.dc > c.d && k.dc - c.d < 80);
            if (!ctl) return false;
            const stopD = ctl.dc - 36 - c.lane.len / 2;
            return Math.abs(c.d - stopD) < 1.5 && sig.get(ctl.j.id)?.[c.lane.axis] === "red";
          });
        }),
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true);
  await zoomTo(page, "light");
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath("city-traffic-light.png") });
});

test("cabs circle the roundabouts and run at highway pace out in the countryside", async ({ page }, info) => {
  test.slow();
  await openCity(page);
  await expect
    .poll(() => hooks(page, (h) => h._traffic!.cars.some((c) => !c.lane)), { timeout: 30_000, intervals: [100] })
    .toBe(true); // someone on a roundabout
  const pace = () => hooks(page, (h) => {
    const town = h._traffic!.cars.filter((c) => c.lane && c.d > c.lane.townFrom + 40 && c.d < c.lane.townTo - 40).map((c) => c.v);
    const road = h._traffic!.cars.filter((c) => c.lane && (c.d < c.lane.townFrom - 200 || c.d > c.lane.townTo + 200)).map((c) => c.v);
    return { town: Math.max(0, ...town), road: Math.max(0, ...road) };
  });
  expect((await pace()).town).toBeLessThan(45);
  // (Fewer cabs since decision 269: wait for one out on the open road.)
  await expect.poll(async () => (await pace()).road, { timeout: 30_000, intervals: [200] }).toBeGreaterThan(80);
  await zoomTo(page, "roundabout");
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath("city-roundabout.png") });
});

test("a commuter's cab drives in the traffic: the lights and the other cabs see it, at 2.5x cab pace on the way to work", async ({ page }) => {
  test.slow();
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  m.send({ type: "department.created", name: "Research", mission: "x", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  m.send(hired("wkr-research-a1", "Research"));
  // While it rides, it is one of the traffic's guests and never faster than a cab.
  const seen: number[] = [];
  const started = Date.now();
  await expect
    .poll(
      async () => {
        const s = await hooks(page, (h) => ({
          guest: (h._traffic?.guests ?? []).some((g) => g.id === "wkr-research-a1"),
          rv: h._people?.get("wkr-research-a1")?.rv ?? 0,
          inside: !!h._people?.get("wkr-research-a1")?.inside,
        }));
        if (s.guest) seen.push(s.rv);
        return s.inside && seen.length > 0;
      },
      { timeout: 60_000, intervals: [100] },
    )
    .toBe(true);
  expect(seen.length).toBeGreaterThan(5); // a real ride, not a jump
  expect(Math.max(...seen)).toBeLessThanOrEqual(56 * 2.5 + 0.01); // a hire on the way to work: 2.5x cab pace (decision 211)
  expect(Math.max(...seen)).toBeGreaterThan(56.01);
  expect(Date.now() - started).toBeGreaterThan(2500); // longer than the old 2.5 s commute
});
