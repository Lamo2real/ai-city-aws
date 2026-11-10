// On a phone: the City is the default (decision 166), the mic is in reach, the City fits and the money is visible.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, hired, mockBackend } from "./mock.ts";
import { visitSnapshot } from "./visit-data.ts";
import { cardsFit, everyCardState, keyFormInside } from "./connector-fit.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
/** WCAG 2 A/AA at phone width: contrast, names, focus order (the map's canvas is described separately). */
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("phone: VAIC and the City work at 412px wide", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1"); // the City opens first
  await page.goto("/#/vaic");
  await expect(page.getByRole("textbox", { name: "Message to VAIC" })).toBeVisible();
  await expect(page.getByText(/Today: \$/)).toHaveCount(0); // costs live on the Costs screen only
  const mic = page.getByRole("button", { name: "Talk to VAIC", exact: true });
  const box = (await mic.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".vaic-stage")).toHaveCount(0); // only the chat, no voice column
  await expect(page.getByRole("button", { name: "Send to VAIC" })).toBeInViewport({ ratio: 1 }); // wholly on screen
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-vaic.png` });
  await noSeriousA11y(page, "VAIC at 412px");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("what's going on in the city today?");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  m.send({
    type: "vaic.reply",
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
  await expect(page.getByRole("link", { name: "VAIC — the City" })).toBeInViewport();
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
          preview_url: "https://apps.vaic.test/drafts/drf-0000000000bb/index.html",
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
  await expect(page.getByRole("link", { name: "← Projects" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Remove" })).toBeInViewport();
  // On a phone the chat comes first and the preview is the tab beside it.
  await expect(page.getByRole("textbox", { name: "Message VAIC about Star Sweeper" })).toBeInViewport();
  await page.getByRole("tab", { name: "Preview" }).click();
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
  await page.goto("/#/vaic");
  await expect(page.getByRole("navigation", { name: "Pinned apps" })).toBeHidden();
  const pin = page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: "Star Calendar" });
  await pin.scrollIntoViewIfNeeded();
  await expect(pin).toBeVisible();
  const box = (await pin.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await pin.click();
  await expect(page).toHaveURL(/#\/apps\/star-calendar$/);
  await expect(page.getByRole("link", { name: "← Projects" })).toBeInViewport();
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
  await page.goto("/#/vaic");
  const plus = page.getByRole("button", { name: "Add to your message" });
  await plus.click();
  const menu = page.getByRole("menu", { name: "Add to your message" });
  await expect(menu).toBeInViewport({ ratio: 1 });
  // It rises out of the button: measure where it lands, once the animation is over.
  await menu.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const menuBox = (await menu.boundingBox())!;
  const plusBox = (await plus.boundingBox())!;
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(plusBox.y + 1);
  for (const item of await menu.getByRole("menuitem").all())
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${SHOTS}/phone-plus-menu.png` });
  await noSeriousA11y(page, "VAIC at 412px with the + menu open");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(plus).toBeFocused();
});

test("phone: the City | Features highlight stays inside its pill on Features", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/city/features");
  await expect(page.getByRole("heading", { name: "Features", level: 1 })).toBeVisible();
  const pill = (await page.locator(".citytabs").boundingBox())!;
  const thumb = page.locator(".citytabs-thumb");
  await expect(async () => {
    const t = (await thumb.boundingBox())!;
    expect(t.height).toBeLessThanOrEqual(pill.height);
    expect(t.width).toBeLessThanOrEqual(pill.width / 2 + 1);
    expect(t.y).toBeGreaterThanOrEqual(pill.y - 1);
    expect(t.x + t.width).toBeLessThanOrEqual(pill.x + pill.width + 1);
  }).toPass();
});

test("phone: tap a tower, pick a project, go up to its floor, an agent turns, and back out", async ({ page }) => {
  await mockBackend(page, { snapshot: visitSnapshot() });
  await page.goto("/");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await page.waitForTimeout(600);
  // A spot on the Application tower that no panel covers.
  const at = await page.evaluate(() => {
    type H = HTMLElement & {
      _world: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }> };
      _view: () => { x: number; y: number; zoom: number };
    };
    const root = document.querySelector("section.city") as H;
    const b = root._world().buildings.find((x) => x.dept === "Application")!;
    const v = root._view();
    const r = root.getBoundingClientRect();
    for (let dy = 90; dy < b.h * 16; dy += 8) {
      // above the door, where the manager stands
      const x = r.left + ((b.x + b.w / 2) * 16 - v.x) * v.zoom,
        y = r.top + ((b.y + b.h) * 16 - dy - v.y) * v.zoom;
      if (document.elementFromPoint(x, y) === root.querySelector(":scope > canvas")) return { x, y };
    }
    return null;
  });
  expect(at).not.toBeNull();
  // A click, not touchscreen.tap: Playwright's emulated tap never reaches the canvas here (no pointer events at all).
  await page.mouse.click(at!.x, at!.y);
  const visit = page.getByRole("region", { name: "Application building" });
  await expect(visit).toHaveAttribute("data-phase", "building");
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noScroll()).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-visit-building.png` });
  await noSeriousA11y(page, "building at 412px");
  await page.getByRole("button", { name: /booking page/ }).tap();
  await expect(visit).toHaveAttribute("data-phase", "floor", { timeout: 5000 });
  const tester = visit.getByRole("button", { name: /^Tester/ });
  await tester.tap();
  await expect(tester).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog", { name: "Tester" })).toBeVisible();
  expect(await noScroll()).toBe(true);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/phone-visit-floor.png` });
  await noSeriousA11y(page, "floor at 412px");
  await page.getByRole("dialog", { name: "Tester" }).getByRole("button", { name: "Close" }).tap();
  await page.getByRole("button", { name: "City map" }).tap();
  await expect(visit).toHaveCount(0);
  await expect(page.locator("section.city > canvas")).toBeVisible();
});

test("phone: Settings → Connectors cards keep every form inside the card at 375 and 412px (decision 179)", async ({
  page,
}) => {
  const m = await mockBackend(page);
  everyCardState(m);
  for (const width of [375, 412]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/settings/connectors");
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await expect(page.getByRole("region", { name: "Every department tools" })).toBeVisible();
    await page.waitForTimeout(400); // the switch eases between its two states
    await keyFormInside(page);
    await cardsFit(page);
    if (width === 375) {
      await page.getByRole("listitem", { name: "Jira & Confluence" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/phone-connectors-key-form.png` });
    }
  }
});

test("phone: Stop sits where Send was and drops VAIC's answer", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("tell me a long story");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  const stop = page.getByRole("button", { name: "Stop VAIC's answer" });
  await expect(stop).toBeInViewport({ ratio: 1 });
  expect((await stop.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const id = (m.calls.find((c) => c.path === "/messages")!.body as { client_id: string }).client_id;
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "Once upon a time",
    done: false,
    message_id: `owner-${id}`,
  });
  await expect(page.getByText("Once upon a time")).toBeVisible();
  await stop.tap();
  await expect(page.getByText("Once upon a time")).toHaveCount(0);
  await expect(page.getByText("Stopped.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit and send again" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await noSeriousA11y(page, "VAIC after Stop at 412px");
});

test("phone: Activity folds down to its title", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/city");
  const toggle = page.getByRole("button", { name: "Activity" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".cityui.feed")).toHaveClass(/closed/);
  expect((await page.locator(".cityui.feed").boundingBox())!.height).toBeLessThan(70);
});
