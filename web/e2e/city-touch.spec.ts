// Touch on the City (the owner, 2026-11-12, decision 260): two fingers pinch to zoom around the point between them
// and pan as they move together; one finger drags and the map glides on after a flick; a double tap zooms in a step;
// the page itself never scrolls or zooms. Pointer events are dispatched as a finger would send them.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

type View = { x: number; y: number; zoom: number };
const view = (page: Page) => page.evaluate(() => (document.querySelector("section.city") as unknown as { _view: () => View })._view());
// A finger: pointer `id` at (x, y) in the map's own pixels.
const finger = (page: Page, type: "pointerdown" | "pointermove" | "pointerup", id: number, x: number, y: number) =>
  page.evaluate(([type, id, x, y]) => {
    const c = document.querySelector("section.city > canvas")!, r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent(type as string, { pointerId: id as number, pointerType: "touch", isPrimary: id === 1, clientX: r.left + (x as number), clientY: r.top + (y as number), bubbles: true, cancelable: true }));
  }, [type, id, x, y] as const);
const mapPoint = (v: View, x: number, y: number) => ({ x: v.x + x / v.zoom, y: v.y + y / v.zoom });

async function openCity(page: Page) {
  const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support"];
  const departments = NAMES.map((name, i) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await page.waitForTimeout(2500);
}

test("two fingers pinch to zoom around the point between them, and pan as they move together", async ({ page }) => {
  await openCity(page);
  const before = await view(page);
  const under = mapPoint(before, 200, 450);
  await finger(page, "pointerdown", 1, 160, 450);
  await finger(page, "pointerdown", 2, 240, 450);
  for (let k = 1; k <= 8; k++) { await finger(page, "pointermove", 1, 160 - k * 5, 450); await finger(page, "pointermove", 2, 240 + k * 5, 450); }
  const pinched = await view(page);
  expect(pinched.zoom / before.zoom).toBeCloseTo(2, 1); // the fingers spread from 80 to 160 px
  const still = mapPoint(pinched, 200, 450);
  expect(Math.abs(still.x - under.x)).toBeLessThan(1); // the same spot of the map stays between the fingers
  expect(Math.abs(still.y - under.y)).toBeLessThan(1);
  // Both fingers move 60 px right together: the map follows them.
  for (let k = 1; k <= 6; k++) { await finger(page, "pointermove", 1, 120 + k * 10, 450); await finger(page, "pointermove", 2, 280 + k * 10, 450); }
  const panned = await view(page);
  expect(panned.x).toBeCloseTo(pinched.x - 60 / pinched.zoom, 0);
  expect(panned.zoom).toBeCloseTo(pinched.zoom, 3);
  // One finger lifts: the other carries on as a drag, and nothing gets picked.
  await finger(page, "pointerup", 2, 340, 450);
  await finger(page, "pointermove", 1, 180, 500);
  await finger(page, "pointermove", 1, 180, 540);
  expect((await view(page)).y).toBeLessThan(panned.y);
  await finger(page, "pointerup", 1, 180, 540);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("one finger drags the map, and it glides on after a flick", async ({ page }) => {
  await openCity(page);
  await page.getByRole("button", { name: "Zoom in" }).tap(); // the glass buttons still take a tap
  await page.waitForTimeout(600);
  const before = await view(page);
  await finger(page, "pointerdown", 1, 200, 400);
  for (let k = 1; k <= 6; k++) { await finger(page, "pointermove", 1, 200 - k * 15, 400); await page.waitForTimeout(8); }
  const dragged = await view(page);
  expect(dragged.x).toBeGreaterThan(before.x); // finger left, map right of where it was
  await finger(page, "pointerup", 1, 110, 400);
  await page.waitForTimeout(400);
  expect((await view(page)).x).toBeGreaterThan(dragged.x + 2); // still gliding after the finger lifted
  // The page itself never scrolled, and the map is the one taking the gestures.
  expect(await page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement?.scrollTop ?? 0])).toEqual([0, 0, 0]);
  expect(await page.locator("section.city > canvas").evaluate((c) => getComputedStyle(c).touchAction)).toBe("none");
});

test("a double tap zooms in a step at that point", async ({ page }) => {
  await openCity(page);
  const before = await view(page);
  const under = mapPoint(before, 120, 600);
  for (const t of ["pointerdown", "pointerup", "pointerdown", "pointerup"] as const) { await finger(page, t, 1, 120, 600); await page.waitForTimeout(40); }
  await page.waitForTimeout(900);
  const after = await view(page);
  expect(after.zoom / before.zoom).toBeCloseTo(1.5, 1);
  const still = mapPoint(after, 120, 600);
  expect(Math.abs(still.x - under.x)).toBeLessThan(2);
  expect(Math.abs(still.y - under.y)).toBeLessThan(2);
});
