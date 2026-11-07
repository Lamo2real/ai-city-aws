// Modern buildings: stations are windows up the office's face, the manager has a window by the door and
// steps out to recruit, and overflow residents live in apartment blocks with a window each.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

const person = (page: Page, id: string) =>
  page.evaluate((pid) => {
    const el = document.querySelector("section.city") as unknown as {
      _people?: Map<string, { x: number; y: number; key: string; route?: unknown; ride?: unknown; waitUntil?: number }>;
    };
    const p = el?._people?.get(pid);
    return p ? { x: p.x, y: p.y, key: p.key, busy: !!(p.route || p.ride || p.waitUntil) } : null;
  }, id);

test("two full departments: everyone gets a window, late residents an apartment block", async ({ page }) => {
  test.slow(); // twenty commutes, then ten walks home
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);

  for (const dept of ["Research", "Engineering"]) {
    m.send({
      type: "department.created",
      name: dept,
      mission: "Build and test.",
      manager_id: `mgr-${dept.toLowerCase()}`,
    });
    m.send(hired(`mgr-${dept.toLowerCase()}`, dept, "manager"));
    for (let i = 0; i < 10; i++) m.send(hired(`wkr-${dept.toLowerCase()}-${i}`, dept));
  }
  // The manager sits in its own window by the door, and steps out when recruiting.
  await expect.poll(() => person(page, "mgr-research")).toMatchObject({ key: "mgrwin:Research" });
  m.send({ type: "activity", id: "mgr-research", activity: "hiring" });
  await expect.poll(() => person(page, "mgr-research")).toMatchObject({ key: "door:Research" });
  m.send({ type: "activity", id: "mgr-research", activity: "idle" });
  await expect.poll(() => person(page, "mgr-research")).toMatchObject({ key: "mgrwin:Research" });

  // Every worker ends up seated at its window, each at a distinct spot up the building's face.
  await expect
    .poll(() => person(page, "wkr-engineering-9").then((p) => p!.key.startsWith("desk:Engineering") && !p!.busy), {
      timeout: 20_000,
    })
    .toBe(true);
  const a = (await person(page, "wkr-engineering-0"))!;
  const b = (await person(page, "wkr-engineering-9"))!;
  expect(b.y).toBeLessThan(a.y); // a later hire sits on a higher floor
  await page.screenshot({ path: `${SHOTS}/city-building-windows.png` });

  // Research finishes: ten walks home; block residents light their own windows when they arrive.
  for (let i = 0; i < 10; i++) m.send({ type: "agent.retired", id: `wkr-research-${i}` });
  await expect
    .poll(() => person(page, "wkr-research-9").then((p) => p!.key === "home" && !p!.busy), { timeout: 25_000 })
    .toBe(true);
  await page.screenshot({ path: `${SHOTS}/city-apartments.png` });
  await expect(page.locator("section.city")).toHaveAttribute("data-people", String(2 + 2 + 20));
});
