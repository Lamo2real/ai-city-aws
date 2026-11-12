// City ⇄ Features (decision 254): the City stays alive behind Features, so switching back shows the same town,
// camera and people with no second entrance; the two pages crossfade, and swap at once with reduced motion.
// Read-only hooks on section.city: _entrances, _anims, _view, _world.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

type Hooks = {
  _entrances?: () => number;
  _anims?: Map<string, unknown>;
  _view?: () => { x: number; y: number; zoom: number };
  _world?: () => { buildings: unknown[] };
  _mark?: number;
};
const hooks = <T>(page: Page, f: (h: Hooks) => T) =>
  page.evaluate((src) => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    return new Function("h", `return (${src})(h)`)(h);
  }, f.toString()) as Promise<T>;

async function openCity(page: Page) {
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  const departments = ["Research", "Sales", "Legal"].map((name) => ({
    key: name.toLowerCase(),
    name,
    mission: `${name} work.`,
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
}

test("City → Features → City: no second entrance, the same camera, and a crossfade both ways", async ({ page }) => {
  test.slow();
  await openCity(page);
  // The first City: the towers rise once, then settle.
  await expect.poll(() => hooks(page, (h) => h._entrances?.() ?? 0)).toBe(1);
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? -1), { timeout: 8000 }).toBe(0);
  // Move the camera (zoom in on the map) and mark the element, to see it is the same City afterwards.
  const box = (await page.locator("section.city > canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(400);
  const cam = await hooks(page, (h) => h._view!());
  await hooks(page, (h) => (h._mark = 1));

  const tabs = page.getByRole("navigation", { name: "City pages" }).first();
  await tabs.getByRole("link", { name: "Features" }).click();
  // Crossfading: the City fades out over 260ms while Features fades in.
  await expect(page.locator("section.city")).toHaveClass(/is-away/);
  expect(await page.locator("section.city").evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0.26s");
  expect(await page.locator(".citypage").evaluate((e) => getComputedStyle(e).animationName)).toBe("citypage-in");
  await page.waitForTimeout(120);
  await page.screenshot({ path: "test-results/city-swap-mid.png" });
  await expect(page.getByRole("heading", { name: "Features", level: 1 })).toBeVisible();
  // Then the City is hidden (and paused), not gone.
  await expect(page.locator("section.city")).toBeHidden();
  expect(await hooks(page, (h) => h._mark)).toBe(1);
  await page.screenshot({ path: "test-results/city-swap-features.png" });

  await page.getByRole("navigation", { name: "City pages" }).getByRole("link", { name: "City" }).click();
  await expect(page).toHaveURL(/#\/city$/);
  // Straight back: the same element, nothing rising, the same camera.
  await expect(page.locator("section.city")).toBeVisible();
  expect(await hooks(page, (h) => h._mark)).toBe(1);
  expect(await hooks(page, (h) => h._entrances!())).toBe(1);
  expect(await hooks(page, (h) => h._anims!.size)).toBe(0);
  expect(await hooks(page, (h) => h._world!().buildings.length)).toBe(3);
  const back = await hooks(page, (h) => h._view!());
  expect(back.zoom).toBeCloseTo(cam.zoom, 3);
  expect(back.x).toBeCloseTo(cam.x, 0);
  expect(back.y).toBeCloseTo(cam.y, 0);
  // Features fades out on top while the City fades in, then it is gone.
  await expect(page.locator(".citypage")).toHaveClass(/is-leaving/);
  await page.waitForTimeout(120);
  await page.screenshot({ path: "test-results/city-swap-back-mid.png" });
  await expect(page.locator(".citypage")).toHaveCount(0);
  await expect(page.locator("section.city")).not.toHaveClass(/is-away/);
  expect(await hooks(page, (h) => h._anims!.size)).toBe(0);
  await page.screenshot({ path: "test-results/city-swap-back.png" });

  // Away to another screen and back: the City is built again, but the towers don't rise a second time.
  await page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: "Files" }).click();
  await page.getByRole("link", { name: "VAIC — the City" }).click();
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await page.waitForTimeout(300);
  expect(await hooks(page, (h) => h._anims!.size)).toBe(0);
  expect(await hooks(page, (h) => h._entrances!())).toBe(1);
});

test("with reduced motion City and Features swap at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCity(page);
  await page.getByRole("navigation", { name: "City pages" }).getByRole("link", { name: "Features" }).click();
  await expect(page.getByRole("heading", { name: "Features", level: 1 })).toBeVisible();
  expect(await page.locator(".citypage").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await expect(page.locator("section.city")).toBeHidden({ timeout: 200 });
  await page.getByRole("navigation", { name: "City pages" }).getByRole("link", { name: "City" }).click();
  await expect(page.locator(".citypage")).toHaveCount(0, { timeout: 200 });
  await expect(page.locator("section.city")).toBeVisible();
  expect(await page.locator("section.city").evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0s");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("City → Features → City keeps the portrait town as it was, with no second entrance", async ({ page }) => {
    await openCity(page);
    await expect.poll(() => hooks(page, (h) => h._entrances?.() ?? 0)).toBe(1);
    await expect.poll(() => hooks(page, (h) => h._anims?.size ?? -1), { timeout: 8000 }).toBe(0);
    const cam = await hooks(page, (h) => h._view!());
    await hooks(page, (h) => (h._mark = 1));
    await page.getByRole("navigation", { name: "City pages" }).getByRole("link", { name: "Features" }).click();
    await expect(page.locator("section.city")).toBeHidden();
    await page.getByRole("navigation", { name: "City pages" }).getByRole("link", { name: "City" }).click();
    await expect(page.locator(".citypage")).toHaveCount(0);
    expect(await hooks(page, (h) => [h._mark, h._entrances!(), h._anims!.size])).toEqual([1, 1, 0]);
    expect(await hooks(page, (h) => h._view!())).toEqual(cam);
    await page.screenshot({ path: "test-results/city-swap-phone.png" });
  });
});
