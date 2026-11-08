// Projects (docs/PRODUCT.md "Projects"): every app is a project. A row of cards you swipe through, "New
// project" first; a project opens as a studio with its own chat with AIC, choice chips for AIC's questions,
// a timeline, versions with "go back", and a live preview at phone, tablet, laptop or a custom size.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("canvas")
    .exclude("iframe")
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const many = () =>
  Array.from({ length: 9 }, (_, i) =>
    appRecord(
      `app-00000000000${i}`,
      `game-${i}`,
      [
        "Star Sweeper",
        "Pixel Pond",
        "Tip Splitter",
        "Habit Streak",
        "Capital Quiz",
        "Memory Zoo",
        "Moon Lander",
        "Word Garden",
        "Pebble Hop",
      ][i]!,
      {
        published_at: `2026-11-0${i + 1}T10:00:00Z`,
      },
    ),
  );
const messages = (m: { calls: Array<{ path: string; body: unknown }> }) =>
  m.calls.filter((c) => c.path === "/messages").map((c) => c.body as { text: string; conversation: string });

test("the projects scroll sideways card by card, New project first", async ({ page }) => {
  await mockBackend(page, { apps: many() });
  await page.goto("/#/apps");
  const rail = page.getByRole("list", { name: "Your projects" });
  await expect(rail.getByRole("link")).toHaveCount(9);
  await expect(rail.getByRole("listitem").first()).toContainText("New project");
  await expect(rail.getByRole("link").first()).toHaveAccessibleName(/^Pebble Hop, Live/); // newest first
  expect(await rail.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x");
  expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // The page itself never scrolls sideways; the row does.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Earlier projects" })).toBeDisabled();
  await page.getByRole("button", { name: "More projects" }).click();
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(page.getByRole("button", { name: "Earlier projects" })).toBeEnabled();
  await noSeriousA11y(page, "Projects");
  await rail.evaluate((el) => el.scrollTo({ left: 0 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/projects.png` });
});

test("a new project: one sentence, AIC asks with choice chips, the answer goes to that project only", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/apps");
  await page.getByRole("button", { name: /New project/ }).click();
  const dialog = page.getByRole("dialog", { name: "What should your app do?" });
  await expect(dialog.getByPlaceholder("Describe your app in one sentence")).toBeFocused();
  await dialog.getByRole("button", { name: "Start building" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Write one sentence about your app first.");
  await dialog.getByRole("button", { name: "A tip calculator that splits the bill" }).click();
  await noSeriousA11y(page, "New project");
  await dialog.getByRole("button", { name: "Start building" }).click();

  await expect(page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
  const conv = `app-${page.url().split("/apps/")[1]}`;
  await expect(page.getByRole("heading", { name: "Tip calculator that splits" })).toBeVisible();
  await expect
    .poll(() => messages(m))
    .toEqual([expect.objectContaining({ text: "A tip calculator that splits the bill", conversation: conv })]);
  await expect(page.getByLabel("AIC is thinking")).toBeVisible();
  await expect(page.getByText("Your app appears here as soon as its first version is ready.")).toBeVisible();

  // AIC asks before it builds: words in the chat, and the choices as chips.
  m.send({ type: "ace.reply", conversation: conv, text: "Happy to. How many people", done: false });
  m.send({
    type: "ace.reply",
    conversation: conv,
    text: "Happy to. How many people split the bill, usually?",
    done: true,
  });
  m.send({
    type: "ace.question",
    conversation: conv,
    question: "How many people?",
    options: ["2 to 4", "Up to 10", "Any number"],
  });
  const ask = page.getByRole("group", { name: "How many people?" });
  await expect(ask).toBeVisible();
  await expect(page.getByText("Happy to. How many people split the bill, usually?")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/project-new-question.png` });
  await ask.getByRole("button", { name: "Any number" }).click();
  await expect(ask).toHaveCount(0);
  await expect.poll(() => messages(m).at(-1)).toMatchObject({ text: "Any number", conversation: conv });

  // None of it reached AIC's main chat.
  await page.goto("/#/ace");
  await expect(page.getByText("split the bill, usually?")).toHaveCount(0);
  // The project is on the list, being planned, and comes back after a reload with its chat.
  await page.goto("/#/apps");
  await expect(
    page.getByRole("link", { name: /Tip calculator that splits, (AIC is on it|Being planned)/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: /Tip calculator/ }).click();
  await expect(page.getByText("Happy to. How many people split the bill, usually?")).toBeVisible();

  // Built and published: the project moves to the app's own page and chat, and the conversation comes along.
  const app = appRecord("app-tip000000001", "bill-splitter", "Bill Splitter", { conversation: conv });
  m.apps.unshift(app);
  m.send({ type: "app.published", ...app });
  await expect(page).toHaveURL(/#\/apps\/bill-splitter$/);
  await expect(page.getByRole("heading", { name: "Bill Splitter" })).toBeVisible();
  await expect(page.getByText("Happy to. How many people split the bill, usually?")).toBeVisible();
  await page.getByRole("textbox", { name: "Message AIC about Bill Splitter" }).fill("Add a tip slider");
  await page.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(() => messages(m).at(-1))
    .toMatchObject({ text: "Add a tip slider", conversation: "app-app-tip000000001" });
  await page.getByRole("link", { name: "← Projects" }).click();
  await expect(page.getByRole("list", { name: "Your projects" }).getByRole("link")).toHaveCount(1);
});

test("open a project, send a change, switch device sizes, see what's happening", async ({ page }) => {
  const m = await mockBackend(page, { apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")] });
  await page.goto("/#/apps");
  await page.getByRole("link", { name: /Star Sweeper/ }).click();
  await expect(page).toHaveURL(/#\/apps\/star-sweeper$/);
  await expect(page.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
  const frame = page.locator("iframe.appframe");
  await expect(page.frameLocator("iframe.appframe").getByRole("button", { name: "Sweep" })).toBeVisible();

  // The chat is about this app only.
  const box = page.getByRole("textbox", { name: "Message AIC about Star Sweeper" });
  await box.fill("Make the stars fall slower");
  await box.press("Enter");
  await expect
    .poll(() => messages(m).at(-1))
    .toMatchObject({
      text: "Make the stars fall slower",
      conversation: "app-app-0000000000aa",
    });
  m.send({
    type: "ace.reply",
    conversation: "app-app-0000000000aa",
    text: "On it. The builders will slow the stars down.",
    done: true,
  });
  await expect(page.getByText("On it. The builders will slow the stars down.")).toBeVisible();

  // Sizes: phone, tablet, laptop (scaled to fit), a custom size, and back to full size.
  const width = async () => (await frame.boundingBox())!.width;
  await page.getByRole("radio", { name: "Phone" }).click();
  await expect(page.locator(".pv-device")).toHaveAttribute("data-width", "390");
  await expect.poll(width).toBeLessThanOrEqual(391);
  expect(
    await page
      .frameLocator("iframe.appframe")
      .locator("body")
      .evaluate(() => window.innerWidth),
  ).toBe(390);
  await page.screenshot({ path: `${SHOTS}/project-studio.png` });
  await page.getByRole("radio", { name: "Laptop" }).click();
  await expect(page.locator(".pv-device")).toHaveAttribute("data-width", "1440");
  expect(
    await page
      .frameLocator("iframe.appframe")
      .locator("body")
      .evaluate(() => window.innerWidth),
  ).toBe(1440);
  await expect.poll(width).toBeLessThan(900); // fitted into the pane
  await page.getByLabel("Zoom").selectOption("0.5");
  await expect.poll(width).toBeCloseTo(720, 0);
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("Width in pixels").fill("500");
  await page.getByLabel("Height in pixels").fill("400");
  await expect(page.locator(".pv-device")).toHaveAttribute("data-width", "500");
  await expect(page.locator(".pv-device")).toHaveAttribute("data-height", "400");
  await page.getByRole("radio", { name: "Full size" }).click();
  await expect(page.locator(".pv-device")).toHaveCount(0);
  expect((await frame.boundingBox())!.height).toBeGreaterThan(400);

  // What's happening: the server has no timeline yet (404), so the HUD tells it from what it saw.
  m.send({
    type: "ticket.status",
    ticket: { id: "t-9", from: "orchestrator", status: "running", app_id: "app-0000000000aa" },
    previous: "open",
  });
  await page.getByRole("tab", { name: "What's happening" }).click();
  await expect(page.getByText("The builders are working on it")).toBeVisible();
  await expect(page.getByText("You asked: Make the stars fall slower")).toBeVisible();
  await noSeriousA11y(page, "Project studio");
  // Open the app: the app alone, and back.
  await page.getByRole("button", { name: "Open the app" }).click();
  await expect(page.getByRole("button", { name: "← Back to the project" })).toBeVisible();
  await expect(page.frameLocator("iframe.appframe").getByRole("button", { name: "Sweep" })).toBeVisible();
  await page.getByRole("button", { name: "← Back to the project" }).click();
  await expect(page.getByRole("tablist")).toBeVisible();
});

test("versions: go back two versions with one confirm", async ({ page }) => {
  const v = (n: number) => ({ ...appRecord("app-snake0000001", "snake", "Snake"), version: n, history: undefined });
  const m = await mockBackend(page, {
    apps: [appRecord("app-snake0000001", "snake", "Snake", { version: 3, history: [v(2), v(1)] })],
  });
  await page.goto("/#/apps/snake");
  await page.getByRole("tab", { name: "Versions" }).click();
  await expect(page.getByText("Live now")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/project-versions.png` });
  await page.getByRole("button", { name: "Go back to version 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Go back to version 1?" });
  await expect(dialog).toContainText("Versions 3, 2 are deleted");
  await dialog.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByText("Snake is back to version 1.")).toBeVisible();
  expect(m.calls.filter((c) => c.path === "/apps/app-snake0000001/rollback")).toHaveLength(2);
  await expect(page.getByRole("button", { name: /Go back to version/ })).toHaveCount(0);
});

test("light appearance: the studio reads well", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aic.theme", "light"));
  await mockBackend(page, { apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")] });
  await page.goto("/#/apps/star-sweeper");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
  await noSeriousA11y(page, "Studio in light");
  await page.goto("/#/apps");
  await expect(page.getByRole("button", { name: /New project/ })).toBeVisible();
  await noSeriousA11y(page, "Projects in light");
});
