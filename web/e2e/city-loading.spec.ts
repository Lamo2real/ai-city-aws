// Loading the City (the owner, 2026-11-12, decision 249): HQ, the roads and the homes are drawn at once, before the
// server answers; every tower remembered from the last visit stands as a blurred placeholder on its own lot; when the
// snapshot arrives each tower comes into focus where it stands. Nothing waits on the network for the first paint.
// Read-only hooks on section.city: _world, _anims, data-city-loading.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
type Hooks = {
  _world?: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }>; hq: { x: number; y: number } };
  _anims?: Map<string, { kind: string }>;
};
const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research", "Media"];
const departments = NAMES.map((name, i) => ({
  key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  mission: `${name} work.`,
  manager_id: `mgr-${i}`,
  state: "active",
  created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(),
}));
const read = (page: Page) =>
  page.evaluate(() => {
    const h = document.querySelector("section.city") as unknown as Hooks | null;
    const w = h?._world?.();
    return {
      towers: Object.fromEntries((w?.buildings ?? []).map((b) => [b.dept, [b.x, b.y, b.w, b.h]])),
      kinds: [...(h?._anims?.values() ?? [])].map((a) => a.kind),
      hq: w ? [w.hq.x, w.hq.y] : null,
    };
  });

// The /city answer is held back until `release()`: the page has to draw without it.
async function slowCity(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/city$/, async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

test("the city draws at once from what it remembers; the towers come into focus when the data arrives", async ({ page }) => {
  test.slow();
  await mockBackend(page, { snapshot: { departments } });
  // A first visit: the towers go up as always, and the City remembers where they stand.
  await page.goto("/#/city");
  await expect.poll(async () => Object.keys((await read(page)).towers).length).toBe(12);
  await expect.poll(async () => (await read(page)).kinds.length, { timeout: 10_000 }).toBe(0);
  const real = await read(page);

  // The next visit, with the server slow to answer.
  const release = await slowCity(page);
  await page.reload();
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-loading", "1");
  await expect(page.getByRole("status").filter({ hasText: "Loading the city…" })).toBeVisible();
  const loading = await read(page);
  expect(loading.hq).toEqual(real.hq);
  expect(loading.towers).toEqual(real.towers); // every placeholder on the lot its tower stands on
  expect(new Set(loading.kinds)).toEqual(new Set(["ghost"]));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/city-loading.png` });

  release();
  await expect(city).toHaveAttribute("data-city-loading", "0");
  await expect(page.getByText("Loading the city…")).toHaveCount(0);
  expect((await read(page)).kinds.every((k) => k === "focus")).toBe(true); // sharpening where they stand, not rising
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/city-loading-focus.png` });
  await expect.poll(async () => (await read(page)).kinds.length, { timeout: 10_000 }).toBe(0);
  expect((await read(page)).towers).toEqual(real.towers);
});

test("a first visit draws HQ and the homes before the server answers; with reduced motion the towers just appear", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockBackend(page, { snapshot: { departments } });
  const release = await slowCity(page);
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-loading", "1");
  const before = await read(page);
  expect(before.hq).not.toBeNull(); // HQ and the neighbourhood are on screen already
  expect(before.towers).toEqual({}); // nothing remembered: no placeholders
  release();
  await expect.poll(async () => Object.keys((await read(page)).towers).length).toBe(12);
  expect((await read(page)).kinds).toEqual([]); // reduced motion: no rise, no focus

  // Reduced motion with something remembered: still placeholders while loading (they don't breathe), then a swap.
  const again = await slowCity(page);
  await page.reload();
  await expect(city).toHaveAttribute("data-city-loading", "1");
  expect(new Set((await read(page)).kinds)).toEqual(new Set(["ghost"]));
  again();
  await expect(city).toHaveAttribute("data-city-loading", "0");
  expect((await read(page)).kinds).toEqual([]);
});
