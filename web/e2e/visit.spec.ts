// Inside a building (decision 166): click a tower on the map → stand in front of it → pick a project → fly up
// into its floor → click an agent, who turns to you → out again with one button, Esc or Back.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";
import { visitSnapshot } from "./visit-data.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

type Hooks = {
  _world?: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }> };
  _view?: () => { x: number; y: number; zoom: number };
};
// Where a tower's lobby is on the screen (its sign, above the door: never a person).
export async function towerOnScreen(page: Page, dept: string) {
  return page.evaluate((d) => {
    const root = document.querySelector("section.city") as unknown as Hooks & HTMLElement;
    const b = root._world?.().buildings.find((x) => x.dept === d);
    const v = root._view?.();
    if (!b || !v) return null;
    const r = root.getBoundingClientRect();
    return { x: r.left + ((b.x + b.w / 2) * 16 - v.x) * v.zoom, y: r.top + ((b.y + b.h) * 16 - 44 - v.y) * v.zoom };
  }, dept);
}
export async function clickTower(page: Page, dept: string) {
  // Zoom to it first (from its card), so it is clear of the panels, then click the tower itself on the map.
  await page.getByRole("navigation", { name: "Departments" }).getByRole("button", { name: dept }).click();
  const card = page.getByRole("dialog", { name: `${dept} department` });
  await card.getByRole("button", { name: "Zoom in" }).click();
  await card.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(700);
  const at = (await towerOnScreen(page, dept))!;
  await page.mouse.click(at.x, at.y);
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).include(".visit").analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("click a tower → its street → pick a project → fly up into its floor → an agent turns to you → out", async ({
  page,
}) => {
  await mockBackend(page, { snapshot: visitSnapshot() });
  await page.goto("/");
  // The City is where the HUD opens.
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByRole("link", { name: "VAIC — the City" })).toHaveAttribute("aria-current", "page");

  await clickTower(page, "Application");
  const visit = page.getByRole("region", { name: "Application building" });
  await expect(visit).toHaveAttribute("data-phase", "street");
  await expect(page).toHaveURL(/#\/city\/visit\/Application$/);
  const picker = page.getByRole("navigation", { name: "Projects in Application" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await axe(page);
  await page.screenshot({ path: `${SHOTS}/city-visit-street.png` });

  // Picking a project flies up the tower (the camera moves) and ends on that floor.
  await picker.getByRole("button", { name: /booking page/ }).click();
  await expect(visit).toHaveAttribute("data-phase", "rise");
  await expect(visit).toHaveAttribute("data-phase", "floor", { timeout: 5000 });
  await expect(visit.getByRole("heading", { level: 2 })).toContainText("Floor 2");
  const desks = visit.getByRole("list", { name: /Who works on/ }).getByRole("button");
  await expect(desks).toHaveCount(4); // the manager and three workers
  await axe(page);
  await page.screenshot({ path: `${SHOTS}/city-visit-floor.png` });

  // An agent turns their chair to you, and their card opens.
  const designer = desks.filter({ hasText: "Designer" });
  await designer.click();
  await expect(designer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog", { name: "Designer" })).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/city-visit-agent.png` });
  // Esc closes the card first (the chair turns back), then goes one step out: to the street.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Designer" })).toHaveCount(0);
  await expect(designer).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(visit).toHaveAttribute("data-phase", "street");
  // Back goes to the map; Forward comes in again; "City map" goes all the way out.
  await page.goBack();
  await expect(visit).toHaveCount(0);
  await expect(page).toHaveURL(/:\d+\/(#\/city)?$/); // back where it started: `/` or `#/city`
  await page.goForward();
  await expect(visit).toHaveAttribute("data-phase", "street");
  await picker.getByRole("button", { name: /login bug/ }).click();
  await expect(visit).toHaveAttribute("data-phase", "floor", { timeout: 5000 });
  await page.getByRole("button", { name: "City map" }).click();
  await expect(visit).toHaveCount(0);
  await expect(page).toHaveURL(/:\d+\/(#\/city)?$/); // back where it started: `/` or `#/city`
  await expect(page.locator("section.city > canvas")).toBeVisible();
});

test("a department with no projects says so; Go inside works from the keyboard", async ({ page }) => {
  await mockBackend(page, { snapshot: visitSnapshot() });
  await page.goto("/#/city");
  await page.getByRole("navigation", { name: "Departments" }).getByRole("button", { name: "Sales" }).click();
  await page.getByRole("button", { name: "Go inside" }).focus();
  await page.keyboard.press("Enter");
  const visit = page.getByRole("region", { name: "Sales building" });
  await expect(visit).toHaveAttribute("data-phase", "street");
  await expect(visit.getByText(/Nobody in Sales is working on a project right now/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(visit).toHaveCount(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no fly: picking a project cuts straight to its floor", async ({ page }) => {
    await mockBackend(page, { snapshot: visitSnapshot() });
    await page.goto("/#/city/visit/Application");
    const visit = page.getByRole("region", { name: "Application building" });
    await expect(visit).toHaveAttribute("data-phase", "street"); // on the page before the observer looks for it
    const phases: string[] = [];
    await page.exposeFunction("seen", (p: string) => phases.push(p));
    await page.evaluate(() => {
      const el = document.querySelector(".visit")!;
      new MutationObserver(() =>
        (window as unknown as { seen: (p: string) => void }).seen(el.getAttribute("data-phase")!),
      ).observe(el, {
        attributes: true,
        attributeFilter: ["data-phase"],
      });
    });
    await visit.getByRole("button", { name: /booking page/ }).click();
    await expect(visit).toHaveAttribute("data-phase", "floor");
    expect(phases).toEqual(["floor"]);
  });
});
