// A building's panel (the owner, 2026-11-12): clear hierarchy, the count as a badge, a friendly empty state, and the
// actions in their own footer row that never overlaps the list. Glass, in both themes, on a phone and a desk.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";
import { visitSnapshot } from "./visit-data.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

async function open(page: Page, dept: string, theme?: "light") {
  if (theme) await page.addInitScript((t) => localStorage.setItem("vaic.theme", t), theme);
  await mockBackend(page, { snapshot: visitSnapshot() });
  await page.goto("/#/city");
  await page
    .getByRole("navigation", { name: "Departments" })
    .getByRole("button", { name: dept === "HQ" ? "HQ" : new RegExp(`^${dept}`) })
    .click();
  const panel = page.getByRole("dialog", { name: dept === "HQ" ? "Headquarters" : `${dept} department` });
  await expect(panel).toBeVisible();
  return panel;
}

// The footer is always in reach (in view at the top of the panel's scroll), and scrolled to the end it sits below
// the work list without overlapping it, its buttons inside it, nothing in the panel spilling sideways.
async function laidOut(page: Page) {
  const r = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".citypanel")!,
      body = panel.querySelector<HTMLElement>(".bp-body")!;
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    body.scrollTop = 0;
    const p0 = panel.getBoundingClientRect(),
      f0 = box(".citypanel .bp-foot");
    const reach = f0.top >= p0.top && f0.bottom <= p0.bottom + 0.5 && box(".citypanel .bp-body").bottom <= f0.top + 0.5;
    body.scrollTop = body.scrollHeight;
    const work = box(".citypanel .bp-work"),
      foot = box(".citypanel .bp-foot");
    const buttons = [...document.querySelectorAll(".citypanel .bp-foot .btn")].map((b) => b.getBoundingClientRect());
    const out = {
      reach,
      gap: foot.top - work.bottom,
      inside: buttons.every(
        (b) =>
          b.top >= foot.top - 0.5 &&
          b.bottom <= foot.bottom + 0.5 &&
          b.left >= foot.left - 0.5 &&
          b.right <= foot.right + 0.5,
      ),
      spill: Math.max(panel.scrollWidth - panel.clientWidth, body.scrollWidth - body.clientWidth),
      n: buttons.length,
    };
    body.scrollTop = 0;
    return out;
  });
  expect(r.reach).toBe(true);
  expect(r.gap).toBeGreaterThanOrEqual(8); // never overlapping, with room to breathe
  expect(r.inside).toBe(true);
  expect(r.spill).toBeLessThanOrEqual(0);
  return r;
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).include(".citypanel").analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("HQ with nothing in progress: a 0 badge, a friendly empty state, Zoom in in the footer", async ({ page }) => {
  const panel = await open(page, "HQ");
  await expect(panel.getByRole("heading", { name: /Work in progress/ })).toBeVisible();
  await expect(panel.locator(".bp-count")).toHaveText("0");
  await expect(panel.getByText("All quiet")).toBeVisible();
  await expect(panel.getByText("None right now.")).toHaveCount(0);
  await expect(panel.locator(".bp-foot").getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(panel.locator(".bp-facts")).toContainText("Team");
  await laidOut(page);
  await axe(page);
  await page.waitForTimeout(300);
  await panel.screenshot({ path: `${SHOTS}/city-panel-hq.png` });
});

test("a department at work: the count, each piece with its status, Go inside and Zoom in in the footer; keyboard", async ({
  page,
}) => {
  const panel = await open(page, "Application");
  await expect(panel.locator(".bp-count")).toHaveText("6");
  await expect(panel.locator(".bp-list > li")).toHaveCount(6);
  await expect(panel.locator(".bp-facts")).toContainText("Manager");
  await expect(panel.locator(".bp-facts")).toContainText("Workers");
  const r = await laidOut(page);
  expect(r.n).toBe(2);
  await expect(panel.locator(".bp-foot").getByRole("button", { name: "Go inside" })).toBeVisible();
  await axe(page);
  await panel.screenshot({ path: `${SHOTS}/city-panel-dept.png` });
  // Keyboard: the panel opens on Close, Tab walks on to the footer's buttons, Escape closes it.
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    if (await panel.getByRole("button", { name: "Go inside" }).evaluate((b) => b === document.activeElement)) break;
  }
  await expect(panel.getByRole("button", { name: "Go inside" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("light theme and a phone: the same panel, still glass, nothing overlapping", async ({ page }) => {
  const panel = await open(page, "HQ", "light");
  await page.setViewportSize({ width: 390, height: 844 }); // a phone (its own layout puts the panel above the dock)
  await page.waitForTimeout(400);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await laidOut(page);
  const glass = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      blur: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter,
    };
  });
  expect(glass.bg).toMatch(/rgba\(.*0\.\d+\)/); // see-through
  expect(glass.blur).toContain("blur");
  await axe(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/city-panel-phone-light.png` });
  await page.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .getByRole("navigation", { name: "Departments" })
    .getByRole("button", { name: /^Application/ })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await laidOut(page);
  await page.screenshot({ path: `${SHOTS}/city-panel-phone-dept-light.png` });
});
