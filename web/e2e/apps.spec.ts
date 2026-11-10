// Apps the city builds (docs/APPS.md), the way the owner meets them: try one in Needs you, approve it,
// open it from Apps and come back, remove it, and watch the city build it. The apps origin is faked by
// the mock (https://apps.aic.test) and serves a tiny original game.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, at, CONFIG, hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
const primaries = (page: Page) => page.locator(".btn-primary:visible").count();
async function noSeriousA11y(page: Page, label: string) {
  // The app inside the frame is agent-written content, not the HUD: axe checks the HUD around it.
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("canvas")
    .exclude("iframe")
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const expectSandboxed = async (page: Page, title: string | RegExp) => {
  const f = page.getByTitle(title);
  await expect(f).toHaveAttribute("sandbox", "allow-scripts");
  await expect(f).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(f).toHaveAttribute("allow", "");
  expect(await f.getAttribute("src")).toMatch(new RegExp(`^${CONFIG.appsUrl}/`));
};
const PUBLISH = {
  id: "apr-app-1",
  agent: "orchestrator",
  kind: "app.publish",
  draft_id: "drf-0000000000aa",
  preview_url: `${CONFIG.appsUrl}/drafts/drf-0000000000aa/index.html`,
  title: "Star Sweeper",
  description: "Sweep the falling stars into the basket before they hit the ground.",
  action: "Publish the app Star Sweeper",
  reason: "Publishing an app needs the owner.",
  department: "Apps",
};

test("Projects is in the nav after Work, with an empty state that says how to get one", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/ace");
  await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible(); // the menu has rendered
  const names = await page.getByRole("navigation", { name: "Screens" }).getByRole("link").allTextContents();
  expect(names.indexOf("Projects")).toBe(names.indexOf("Work") + 1);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/#\/apps$/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByText(/No apps yet. Describe one in a sentence/)).toBeVisible();
  await expect(page.getByRole("button", { name: /New project/ })).toBeVisible();
  await noSeriousA11y(page, "Apps empty");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("approve a publish from Needs you: the preview runs sandboxed, then it is under Projects", async ({ page }) => {
  const m = await mockBackend(page, { snapshot: { approvals: [PUBLISH] } });
  await page.goto("/#/inbox");
  const card = page.getByRole("article", { name: "New app: Star Sweeper" });
  await expect(card.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
  await expect(card).toContainText("Sweep the falling stars");
  await expectSandboxed(page, "Preview of Star Sweeper");
  // The preview is live: its script runs, and it has no storage and no way into the HUD.
  const preview = page.frameLocator('iframe[title="Preview of Star Sweeper"]');
  await preview.getByRole("button", { name: "Sweep" }).click();
  await expect(preview.locator("#n")).toHaveText("1 stars");
  await expect(preview.locator("#iso")).toHaveText("no storage, no HUD access");
  await noSeriousA11y(page, "Needs you: publish");
  expect(await primaries(page)).toBe(1);
  await page.screenshot({ path: `${SHOTS}/needs-you-app.png` });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(() => m.calls.find((c) => c.path === "/approvals/apr-app-1")?.body).toEqual({ approved: true });
  await expect(page.getByText("Approved. Star Sweeper is under Projects now.")).toBeVisible();
  m.send({ type: "approval.decided", id: "apr-app-1", approved: true });
  await expect(page.getByText(/Nothing is open/)).toBeVisible();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("link", { name: /Star Sweeper/ })).toBeVisible();
});

test("refusing a publish publishes nothing", async ({ page }) => {
  const m = await mockBackend(page, { snapshot: { approvals: [PUBLISH] } });
  await page.goto("/#/inbox");
  await page.getByRole("button", { name: "Refuse" }).click();
  await expect.poll(() => m.calls.find((c) => c.path === "/approvals/apr-app-1")?.body).toEqual({ approved: false });
  await expect(page.getByText("Refused. Star Sweeper won't be published.")).toBeVisible();
  expect(m.apps).toEqual([]);
});

test("open an app from Projects, play it, and come back", async ({ page }) => {
  await mockBackend(page, {
    apps: [
      appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper"),
      appRecord("app-0000000000bb", "pixel-pond", "Pixel Pond"),
    ],
  });
  await page.goto("/#/apps");
  await expect(page.getByRole("link", { name: /Pixel Pond/ })).toBeVisible();
  await noSeriousA11y(page, "Apps");
  await page.screenshot({ path: `${SHOTS}/apps.png` });
  await page.getByRole("link", { name: /Star Sweeper/ }).click();
  await expect(page).toHaveURL(/#\/apps\/star-sweeper$/);
  await expect(page.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
  await expectSandboxed(page, /Star Sweeper/);
  const game = page.frameLocator("iframe.appframe");
  await game.getByRole("button", { name: "Sweep" }).click();
  await game.getByRole("button", { name: "Sweep" }).click();
  await expect(game.locator("#n")).toHaveText("2 stars");
  // The frame fills the page under the top row.
  const frame = (await page.locator("iframe.appframe").boundingBox())!;
  expect(frame.height).toBeGreaterThan(500);
  await expect(page.getByRole("button", { name: "Talk to VAIC", exact: true })).toHaveCount(0); // nothing floats over the game
  await noSeriousA11y(page, "App page");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/app-page.png` });
  await page.getByRole("link", { name: "← Projects" }).click();
  await expect(page).toHaveURL(/#\/apps$/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  // A slug that is gone says so and offers the way back.
  await page.goto("/#/apps/not-here");
  await expect(page.getByRole("heading", { name: "This app is gone" })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Projects" })).toBeVisible();
});

test("remove an app: it asks first, deletes it and goes back to Apps", async ({ page }) => {
  const m = await mockBackend(page, { apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")] });
  await page.goto("/#/apps/star-sweeper");
  await page.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Star Sweeper?" });
  await expect(dialog).toContainText("can't be undone");
  await noSeriousA11y(page, "Remove app");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(m.calls.some((c) => c.method === "DELETE")).toBe(false);
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => m.calls.find((c) => c.method === "DELETE")?.path).toBe("/apps/app-0000000000aa");
  await expect(page).toHaveURL(/#\/apps$/);
  await expect(page.getByText("Star Sweeper was removed.")).toBeVisible();
  await expect(page.getByText(/No apps yet/)).toBeVisible();
  m.send({ type: "app.removed", app_id: "app-0000000000aa", slug: "star-sweeper" }); // the event that follows is harmless
  await expect(page.getByText(/No apps yet/)).toBeVisible();
});

test("the City shows the build: the Apps building, the waiting sign, a cabinet per app", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  m.send({
    type: "department.created",
    name: "Apps",
    mission: "Small games and tools for AI City.",
    manager_id: "mgr-apps",
  });
  m.send(hired("mgr-apps", "Apps", "manager"));
  m.send(hired("wkr-apps-g1", "Apps"));
  m.send({ type: "activity", id: "wkr-apps-g1", activity: "editing", detail: "app/index.html", at: at() });
  await expect(page.locator(".feed")).toContainText("New department: Apps");
  await expect(page.locator(".feed")).toContainText("Apps hired a JavaScript developer");
  m.send({ type: "app.draft", draft_id: "drf-0000000000aa", title: "Star Sweeper", status: "ready" });
  m.send({ type: "approval.requested", ...PUBLISH });
  await expect(city).toHaveAttribute("data-apps-waiting", "1");
  await expect(page.locator(".feed")).toContainText("A new app is ready to try");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/city-app-waiting.png` });
  m.send({ type: "approval.decided", id: PUBLISH.id, approved: true });
  const { app_id, slug, title, url } = appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper");
  m.send({ type: "app.published", app_id, slug, title, url, task_id: "t-apps", department: "Apps" });
  await expect(city).toHaveAttribute("data-apps", "1");
  await expect(city).toHaveAttribute("data-apps-waiting", "0");
  await expect(page.locator(".feed")).toContainText("New app: Star Sweeper");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/city-app-published.png` });
  // The building's panel lists the app too (the cabinet's keyboard twin) and opens it.
  await page.getByRole("navigation", { name: "Departments" }).getByRole("button", { name: "Apps" }).click();
  const panel = page.getByRole("dialog", { name: "Apps department" });
  await expect(panel).toContainText("Apps built here (1)");
  await noSeriousA11y(page, "City with an app");
  await panel.getByRole("link", { name: "Star Sweeper" }).click();
  await expect(page).toHaveURL(/#\/apps\/star-sweeper$/);
  await page.goBack();
  await expect(city).toHaveAttribute("data-city-ready", "1");
  // After a reload the cabinet comes back from the snapshot; app.removed takes it away.
  m.apps.push(appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper", { department: "Apps" }));
  (m.snapshot.departments as unknown[]).push({
    name: "Apps",
    mission: "Games",
    manager_id: "mgr-apps",
    state: "active",
    created_at: at(),
  });
  await page.reload();
  await expect(page.locator("section.city")).toHaveAttribute("data-apps", "1");
  m.send({ type: "app.removed", app_id, slug });
  await expect(page.locator("section.city")).toHaveAttribute("data-apps", "0");
});

test("clicking a cabinet on the map opens its app", async ({ page }) => {
  await mockBackend(page, {
    snapshot: {
      departments: [{ name: "Apps", mission: "Games", manager_id: "mgr-apps", state: "active", created_at: at() }],
    },
    apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper", { department: "Apps" })],
  });
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-apps", "1");
  await expect(city).not.toHaveAttribute("data-app-spot", "");
  const [x, y] = (await city.getAttribute("data-app-spot"))!.split(",").map(Number);
  const box = (await city.boundingBox())!;
  await page.mouse.click(box.x + x!, box.y + y!);
  await expect(page).toHaveURL(/#\/apps\/star-sweeper$/);
});
