// Inside a building (decision 166): click a tower on the map → its floors as a cutaway → pick a project →
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
async function clickTower(page: Page, dept: string) {
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

test("click a tower → its floors → pick a project → that floor in focus, the rest faded → an agent turns to you → out", async ({
  page,
}) => {
  await mockBackend(page, { snapshot: visitSnapshot() });
  await page.goto("/");
  // The City is where the HUD opens.
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByRole("link", { name: "VAIC — the City" })).toHaveAttribute("aria-current", "page");

  await clickTower(page, "Application");
  const visit = page.getByRole("region", { name: "Application building" });
  await expect(visit).toHaveAttribute("data-phase", "building");
  await expect(page).toHaveURL(/#\/city\/visit\/Application$/);
  const picker = page.getByRole("navigation", { name: "Projects in Application" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await axe(page);
  await page.screenshot({ path: `${SHOTS}/city-visit-building.png` });

  // Picking a project flies up the tower (the camera moves) and ends on that floor.
  await picker.getByRole("button", { name: /booking page/ }).click();
  await expect(visit).toHaveAttribute("data-phase", "floor");
  // The floor in focus is whole; the other project's floor and the tower's shell (lobby, storeys above) are
  // barely visible.
  await expect(visit.locator(".floor-focus")).toHaveCount(1);
  await expect(visit.locator(".floor-faded")).toHaveCount(4);
  await expect
    .poll(() =>
      visit.locator(".floor-faded").evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity).join()),
    )
    .toBe("0.07,0.07,0.07,0.07");
  await expect.poll(() => visit.locator(".floor-focus").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
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
  // Esc closes the card first (the chair turns back), then goes one step out: to all the floors.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Designer" })).toHaveCount(0);
  await expect(designer).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(visit).toHaveAttribute("data-phase", "building");
  // Back goes to the map; Forward comes in again; "City map" goes all the way out.
  await page.goBack();
  await expect(visit).toHaveCount(0);
  await expect(page).toHaveURL(/:\d+\/(#\/city)?$/); // back where it started: `/` or `#/city`
  await page.goForward();
  await expect(visit).toHaveAttribute("data-phase", "building");
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
  await expect(visit).toHaveAttribute("data-phase", "building");
  await expect(visit.getByText(/Nobody in Sales is working on a project right now/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(visit).toHaveCount(0);
});

test("a floor seats eight: a bigger project goes on up as 1a, 1b; arrows, scroll and the buttons go floor to floor", async ({
  page,
}) => {
  const snap = visitSnapshot();
  // Seven more on the booking page: eleven people, so two floors (8 and 3). The login bug moves up to floor 4.
  for (let i = 0; i < 7; i++)
    snap.agents.push({
      id: `wkr-app-x${i}`,
      kind: "worker",
      role: `Developer ${i + 1}`,
      department: "Application",
      model: "opus-5-5",
      parent: "mgr-application",
      state: "active",
      worker_state: "working",
      ticket_id: "t-1",
    });
  await mockBackend(page, { snapshot: snap });
  await page.goto("/#/city/visit/Application");
  const visit = page.getByRole("region", { name: "Application building" });
  const title = visit.getByRole("heading", { level: 2 });
  const desks = visit.getByRole("list", { name: /Who works on/ }).getByRole("button");
  // Outside, the choices are projects; picking one goes to its top floor.
  const picker = page.getByRole("navigation", { name: "Projects in Application" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await expect(picker.getByRole("button", { name: /booking page/ })).toContainText("11 agents · 2 floors");
  await picker.getByRole("button", { name: /booking page/ }).click();
  await expect(title).toContainText("Floor 3 · Build the booking page for the dentist · 1b");
  await expect(desks).toHaveCount(3);
  // Down a floor with the arrow key: the same project's first floor, full.
  await page.keyboard.press("ArrowDown");
  await expect(title).toContainText("Floor 2 · Build the booking page for the dentist · 1a");
  await expect(desks).toHaveCount(8);
  await expect(visit.getByRole("button", { name: "Floor below" })).toBeDisabled();
  await page.waitForTimeout(900); // the move has settled
  await page.screenshot({ path: `${SHOTS}/city-visit-floors.png` });
  // Up with the wheel, twice: 1b, then the other project's own floor.
  const box = (await visit.locator(".visitstage").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6);
  await page.mouse.wheel(0, -120);
  await expect(title).toContainText("· 1b");
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -120);
  await expect(title).toContainText("Floor 4 · Fix the login bug in the customer portal");
  await expect(desks).toHaveCount(2);
  await expect(visit.getByRole("button", { name: "Floor above" })).toBeDisabled();
  await visit.getByRole("button", { name: "Floor below" }).click();
  await expect(title).toContainText("· 1b");
  // Going from floor to floor is not a step for Back: one Back is out of the floors.
  await page.goBack();
  await expect(visit).toHaveAttribute("data-phase", "building");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no animation: picking a project cuts straight to its floor", async ({ page }) => {
    await mockBackend(page, { snapshot: visitSnapshot() });
    await page.goto("/#/city/visit/Application");
    const visit = page.getByRole("region", { name: "Application building" });
    await expect(visit).toHaveAttribute("data-phase", "building"); // on the page before the observer looks for it
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
    const moving = await visit.evaluate((el) =>
      [el, el.querySelector(".visitstage")!, el.querySelector(".floorstack")!, el.querySelector(".floor")!].map((x) => {
        const s = getComputedStyle(x);
        return `${s.animationName} ${s.transitionDuration}`;
      }),
    );
    expect(moving).toEqual(["none 0s", "none 0s", "none 0s", "none 0s"]);
  });
});
