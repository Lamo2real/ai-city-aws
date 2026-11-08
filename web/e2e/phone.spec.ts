// On a phone: AIC is the default, the mic is in reach, the City fits and the money is visible.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
/** WCAG 2 A/AA at phone width: contrast, names, focus order (the map's canvas is described separately). */
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("phone: AIC and the City work at 412px wide", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message to AIC" })).toBeVisible();
  await expect(page.getByText(/Today: \$/)).toHaveCount(0); // costs live on the Costs screen only
  const mic = page.getByRole("button", { name: "Talk to AIC", exact: true });
  const box = (await mic.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".ace-stage")).toHaveCount(0); // only the chat, no voice column
  await expect(page.getByRole("button", { name: "Send to AIC" })).toBeInViewport({ ratio: 1 }); // wholly on screen
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-ace.png` });
  await noSeriousA11y(page, "AIC at 412px");
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("what's going on in the city today?");
  await page.getByRole("button", { name: "Send to AIC" }).click();
  m.send({
    type: "ace.reply",
    conversation: "main",
    text: "## Today\n- **Research**: 3 workers on the market scan\n- Engineering: idle\n\n| Department | Workers | Spend |\n|---|---|---|\n| Research | 3 | $0.30 |\n| Engineering | 0 | $0.00 |",
    done: true,
  });
  await expect(page.getByRole("cell", { name: "$0.30" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const talk = document.querySelector(".talk")!.getBoundingClientRect();
      // Nothing below the chat to scroll to, and the chat reaches the bottom edge (only the page gutter).
      return main.scrollHeight <= main.clientHeight + 1 && window.innerHeight - talk.bottom <= 20;
    }),
  ).toBe(true);
  await page.locator(".talk").screenshot({ path: `${SHOTS}/phone-ace-chat.png` });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  m.send(hired("wkr-research-x1", "Research"));
  await expect(page.locator(".feed")).toContainText("New department: Research");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/phone-city.png` });
  await noSeriousA11y(page, "City at 412px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  // Every toolbar button is fully on screen and big enough to tap.
  const width = page.viewportSize()!.width;
  for (const b of await page.locator(".citybottom button").all()) {
    const r = (await b.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(width);
    expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("link", { name: "City" })).toBeInViewport();
});

test("phone: Apps, an app page and a publish preview fit at 412px wide", async ({ page }) => {
  await mockBackend(page, {
    apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")],
    snapshot: {
      approvals: [
        {
          id: "apr-1",
          agent: "orchestrator",
          kind: "app.publish",
          draft_id: "drf-0000000000bb",
          preview_url: "https://apps.aic.test/drafts/drf-0000000000bb/index.html",
          title: "Pixel Pond",
          description: "Feed the pixel fish.",
        },
      ],
    },
  });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.goto("/#/apps");
  await expect(page.getByRole("link", { name: /Star Sweeper/ })).toBeVisible();
  expect(await fits()).toBe(true);
  await page.getByRole("link", { name: /Star Sweeper/ }).click();
  await expect(page.getByRole("link", { name: "← Apps" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Remove" })).toBeInViewport();
  const frame = (await page.locator("iframe.appframe").boundingBox())!;
  expect(frame.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  expect(frame.height).toBeGreaterThan(400);
  expect(await fits()).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-app-page.png` });
  await page.goto("/#/inbox");
  await expect(page.locator('iframe[title="Preview of Pixel Pond"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  expect(await fits()).toBe(true);
});

test("phone: pinned apps move into the nav row", async ({ page }) => {
  await mockBackend(page, {
    apps: [appRecord("app-cal000000001", "star-calendar", "Star Calendar", { pinned: true, grants: [] })],
  });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Pinned apps" })).toBeHidden();
  const pin = page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: "Star Calendar" });
  await pin.scrollIntoViewIfNeeded();
  await expect(pin).toBeVisible();
  const box = (await pin.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await pin.click();
  await expect(page).toHaveURL(/#\/apps\/star-calendar$/);
  await expect(page.getByRole("link", { name: "← Apps" })).toBeInViewport();
});

test("phone: Needs you and Work read well at 412px, with big answer buttons", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/inbox");
  m.send({
    type: "question.asked",
    question: {
      id: "q1",
      asked_by: "orchestrator",
      path: "orchestrator",
      text: "Should the city keep the old design while the new one is tested?",
      options: ["Yes", "No"],
      default_answer: "Yes",
      status: "open",
      created_at: new Date().toISOString(),
    },
  });
  const yes = page.getByRole("button", { name: "Yes", exact: true });
  await expect(yes).toBeVisible();
  expect((await yes.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await noSeriousA11y(page, "Needs you at 412px");
  await page.goto("/#/tickets");
  await expect(page.getByText("2 of 3 parts done")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await noSeriousA11y(page, "Work at 412px");
});

test("phone: the + menu opens upwards inside the screen and its rows are easy to tap", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  const plus = page.getByRole("button", { name: "Add to your message" });
  await plus.click();
  const menu = page.getByRole("menu", { name: "Add to your message" });
  await expect(menu).toBeInViewport({ ratio: 1 });
  const menuBox = (await menu.boundingBox())!;
  const plusBox = (await plus.boundingBox())!;
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(plusBox.y + 1);
  for (const item of await menu.getByRole("menuitem").all())
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${SHOTS}/phone-plus-menu.png` });
  await noSeriousA11y(page, "AIC at 412px with the + menu open");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(plus).toBeFocused();
});
