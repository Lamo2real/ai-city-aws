// Projects (docs/PRODUCT.md "Projects"): every app is a project. A row of cards you swipe through, "New
// project" first; a project opens as a studio with its own chat with VAIC, choice chips for VAIC's questions,
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

test("a new project: one sentence, VAIC asks with choice chips, the answer goes to that project only", async ({
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
  await expect(page.getByLabel("VAIC is thinking")).toBeVisible();
  await expect(page.getByText("Your app appears here as soon as its first version is ready.")).toBeVisible();

  // VAIC asks before it builds: words in the chat, and the choices as chips.
  m.send({ type: "vaic.reply", conversation: conv, text: "Happy to. How many people", done: false });
  m.send({
    type: "vaic.reply",
    conversation: conv,
    text: "Happy to. How many people split the bill, usually?",
    done: true,
  });
  m.send({
    type: "vaic.question",
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

  // None of it reached VAIC's main chat.
  await page.goto("/#/vaic");
  await expect(page.getByText("split the bill, usually?")).toHaveCount(0);
  // The project is on the list, being planned, and comes back after a reload with its chat.
  await page.goto("/#/apps");
  await expect(
    page.getByRole("link", { name: /Tip calculator that splits, (VAIC is on it|Being planned)/ }),
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
  await page.getByRole("textbox", { name: "Message VAIC about Bill Splitter" }).fill("Add a tip slider");
  await page.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(() => messages(m).at(-1))
    .toMatchObject({ text: "Add a tip slider", conversation: "app-app-tip000000001" });
  await page.getByRole("link", { name: "← Projects" }).click();
  await expect(page.getByRole("list", { name: "Your projects" }).getByRole("link")).toHaveCount(1);
});

test("the new-project dialog scrolls when the description box is dragged taller than the window", async ({ page }) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/#/apps");
  await page.getByRole("button", { name: /New project/ }).click();
  const dialog = page.getByRole("dialog", { name: "What should your app do?" });
  await dialog.locator("textarea").evaluate((t) => ((t as HTMLTextAreaElement).style.height = "1200px"));
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(600);
  await dialog.evaluate((d) => (d.scrollTop = d.scrollHeight));
  await expect(dialog.getByRole("button", { name: "Start building" })).toBeInViewport();
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
  const box = page.getByRole("textbox", { name: "Message VAIC about Star Sweeper" });
  await box.fill("Make the stars fall slower");
  await box.press("Enter");
  await expect
    .poll(() => messages(m).at(-1))
    .toMatchObject({
      text: "Make the stars fall slower",
      conversation: "app-app-0000000000aa",
    });
  m.send({
    type: "vaic.reply",
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
  await page.getByRole("combobox", { name: "Zoom" }).click();
  await page.getByRole("option", { name: "50%" }).click();
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
  await page.addInitScript(() => localStorage.setItem("vaic.theme", "light"));
  await mockBackend(page, { apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")] });
  await page.goto("/#/apps/star-sweeper");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "Star Sweeper" })).toBeVisible();
  await noSeriousA11y(page, "Studio in light");
  await page.goto("/#/apps");
  await expect(page.getByRole("button", { name: /New project/ })).toBeVisible();
  await noSeriousA11y(page, "Projects in light");
});

test("while the builders work, the project chat shows their steps like Claude: grouped, openable, with a turning ring", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/apps");
  await page.getByRole("button", { name: /New project/ }).click();
  const dialog = page.getByRole("dialog", { name: "What should your app do?" });
  await dialog.getByPlaceholder("Describe your app in one sentence").fill("A memory game with animal cards");
  await dialog.getByRole("button", { name: "Start building" }).click();
  await expect(page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
  const conv = `app-${page.url().split("/apps/")[1]}`;
  // The job comes from this project's conversation; a worker gets a part of it.
  const root = {
    id: "t-mem",
    from: "vaic",
    to: "orchestrator",
    goal: "Memory game",
    kind: "task",
    department: null,
    conversation: conv,
  };
  const part = {
    id: "t-mem-1",
    parent_id: "t-mem",
    from: "mgr-apps",
    to: "wkr-dev",
    goal: "Build it",
    kind: "task",
    department: "Apps",
  };
  m.send({ type: "ticket.status", previous: null, ticket: { ...root, status: "open" } });
  m.send({ type: "ticket.status", previous: null, ticket: { ...part, status: "in_progress" } });
  const say = (activity: string, detail: string) => m.send({ type: "activity", id: "wkr-dev", activity, detail });
  say("researching", "Searched your knowledge: animal pictures");
  say("running", "Ran npm create vite@latest memory");
  say("running", "Ran npm install");
  say("coding", "Created an SVG image: memory/src/cards/lion.svg");
  say("coding", "Edited memory/src/App.tsx");
  say("running", "Pushed the code to GitHub: git push origin main");
  // A step from another project's worker never shows here.
  m.send({ type: "activity", id: "someone-else", activity: "running", detail: "Ran rm -rf nothing" });

  const log = page.locator(".pj-log");
  await expect(log.getByText("Searched your knowledge: animal pictures")).toBeVisible();
  const cmds = log.locator("details").filter({ hasText: "Ran 2 commands" });
  await expect(cmds).toBeVisible();
  await expect(log.getByText("Ran npm install")).toBeHidden(); // folded, like Claude
  await cmds.locator("summary").click();
  await expect(log.getByText("Ran npm install")).toBeVisible();
  await expect(log.getByText("Created an SVG image: memory/src/cards/lion.svg")).toBeVisible();
  await expect(log.getByText("Pushed the code to GitHub: git push origin main")).toBeVisible();
  await expect(log.getByText("rm -rf")).toHaveCount(0);
  const ring = log.getByRole("status");
  await expect(ring).toHaveText("The builders are working");
  await expect(ring.locator(".bl-ring i").first()).toHaveCSS("animation-name", "bl-dot");
  await page.screenshot({ path: `${SHOTS}/project-build-steps.png` });

  // Finished: the ring goes, the steps stay, and a reload keeps them.
  m.send({ type: "ticket.status", previous: "in_progress", ticket: { ...part, status: "done" } });
  m.send({ type: "ticket.status", previous: "open", ticket: { ...root, status: "done" } });
  await expect(ring).toHaveCount(0);
  await page.reload();
  await expect(log.getByText("Searched your knowledge: animal pictures")).toBeVisible();
});

test("while the builders work, the right side shows the app live, with who is editing what, then the finished version", async ({
  page,
}) => {
  const m = await mockBackend(page);
  // The live copy on the apps origin, with the city's real live helper (pointers inside the frame).
  const helper = await import("node:fs").then((fs) =>
    fs.readFileSync(`${import.meta.dirname}/../../backend/src/vaic/assets/vaic-live.js`, "utf8"),
  );
  const pid = "prv-0123456789abcdef0123456789abcdef";
  const loads: string[] = [];
  let version = 1;
  await page.route(`https://apps.vaic.test/drafts/${pid}/**`, (r) => {
    const url = r.request().url();
    if (url.includes("vaic-live.js"))
      return r.fulfill({
        contentType: "text/javascript",
        body: helper,
        headers: { "access-control-allow-origin": "*" },
      });
    loads.push(url);
    return r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="height:2000px;margin:0;font:16px sans-serif"><h1 id="title">Memory Zoo v${version}</h1><div id="board" style="margin-top:40px;width:200px;height:120px;background:#ddd"></div><script src="vaic-live.js"></script></body></html>`,
    });
  });
  await page.goto("/#/apps");
  await page.getByRole("button", { name: /New project/ }).click();
  const dialog = page.getByRole("dialog", { name: "What should your app do?" });
  await dialog.getByPlaceholder("Describe your app in one sentence").fill("A memory game with animal cards");
  await dialog.getByRole("button", { name: "Start building" }).click();
  await expect(page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
  const conv = `app-${page.url().split("/apps/")[1]}`;
  const preview = page.locator(".studio-preview");
  await expect(preview.getByText("Your app appears here as soon as its first version is ready.")).toBeVisible();

  const root = {
    id: "t-zoo",
    from: "vaic",
    to: "orchestrator",
    goal: "Memory game",
    kind: "task",
    department: null,
    conversation: conv,
  };
  const part = {
    id: "t-zoo-1",
    parent_id: "t-zoo",
    from: "mgr-apps",
    to: "wkr-front",
    goal: "Build it",
    kind: "task",
    department: "Application",
  };
  m.send({
    type: "agent.hired",
    agent: { id: "wkr-front", kind: "worker", role: "frontend-dev", department: "Application", size: 1 },
  });
  m.send({ type: "ticket.status", previous: null, ticket: { ...root, status: "open" } });
  m.send({ type: "ticket.status", previous: null, ticket: { ...part, status: "in_progress" } });
  m.send({ type: "activity", id: "wkr-front", activity: "coding", detail: "Created app/game.js" });
  const url = `https://apps.vaic.test/drafts/${pid}/index.html`;
  // The first edit with an index.html: the frame appears, live.
  m.send({
    type: "app.preview",
    task_id: "t-zoo",
    hire_id: "wkr-front",
    preview_url: url,
    seq: 1,
    paths: ["index.html", "game.js"],
    hints: [{ path: "game.js", selector: null }],
  });
  await expect(preview.getByRole("status").filter({ hasText: "Building… live" })).toBeVisible();
  const frame = page.frameLocator(".studio-preview iframe");
  await expect(frame.getByRole("heading", { name: "Memory Zoo v1" })).toBeVisible();
  const iframe = preview.locator("iframe");
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  const editors = page.getByRole("list", { name: "Who is changing the app" });
  await expect(editors).toContainText("Frontend dev");
  await expect(editors).toContainText("now editing app/game.js");
  await expect(preview.locator(".lv-badge")).toHaveText("Frontend dev · game.js"); // no element to point at: a corner badge

  // A later edit reloads the frame (keeping its scroll) and points at the element it changed.
  await frame.locator("body").evaluate(() => window.scrollTo(0, 60));
  await page.waitForTimeout(200);
  version = 2;
  m.send({
    type: "app.preview",
    task_id: "t-zoo",
    hire_id: "wkr-front",
    preview_url: url,
    seq: 2,
    paths: ["index.html"],
    hints: [{ path: "index.html", selector: "#board" }],
  });
  await expect(frame.getByRole("heading", { name: "Memory Zoo v2" })).toBeAttached();
  await expect(iframe).toHaveAttribute("src", /live=2/);
  await expect(editors).toContainText("now editing app/index.html");
  await expect(frame.locator("[data-vaic-live] >> text=Frontend dev")).toBeVisible();
  expect(await frame.locator("body").evaluate(() => window.scrollY)).toBe(60);
  expect(loads.length).toBe(2);
  await page.screenshot({ path: `${SHOTS}/project-live-preview.png` });

  // "In the log" goes to the build log.
  await editors.getByRole("button", { name: "Frontend dev: show in the build log" }).click();
  await expect(page.locator("#buildlog")).toBeInViewport();

  // The version is done and published: the studio shows that version, the live copy is put away.
  m.send({ type: "ticket.status", previous: "in_progress", ticket: { ...part, status: "done" } });
  m.send({ type: "ticket.status", previous: "open", ticket: { ...root, status: "done" } });
  await expect(preview.getByText("Latest build, not published yet")).toBeVisible();
  const zoo = appRecord("app-zoo000000001", "memory-zoo", "Memory Zoo", { conversation: conv });
  m.apps.unshift(zoo);
  m.send({ type: "app.published", ...zoo });
  await expect(page).toHaveURL(/#\/apps\/memory-zoo$/);
  await expect(page.getByRole("list", { name: "Who is changing the app" })).toHaveCount(0);
  await expect(page.locator(".studio-preview iframe")).toHaveAttribute("src", zoo.url);
});

test("the project chat is one timeline, oldest first, and stays on its newest line unless the owner reads above", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/apps");
  await page.getByRole("button", { name: /New project/ }).click();
  const dialog = page.getByRole("dialog", { name: "What should your app do?" });
  await dialog.getByPlaceholder("Describe your app in one sentence").fill("A memory game with animal cards");
  await dialog.getByRole("button", { name: "Start building" }).click();
  await expect(page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
  const conv = `app-${page.url().split("/apps/")[1]}`;
  m.send({ type: "vaic.reply", conversation: conv, text: "On it. The builders are starting.", done: true });
  const root = {
    id: "t-mz",
    from: "vaic",
    to: "orchestrator",
    goal: "Memory game",
    kind: "task",
    department: null,
    conversation: conv,
  };
  const part = {
    id: "t-mz-1",
    parent_id: "t-mz",
    from: "mgr-apps",
    to: "wkr-dev",
    goal: "Build it",
    kind: "task",
    department: "Application",
  };
  m.send({ type: "ticket.status", previous: null, ticket: { ...root, status: "open" } });
  m.send({ type: "ticket.status", previous: null, ticket: { ...part, status: "in_progress" } });
  for (let i = 0; i < 14; i++)
    m.send({
      type: "activity",
      id: "wkr-dev",
      activity: "researching",
      detail: `Searched your knowledge: animals ${i}`,
    });
  m.send({ type: "activity", id: "wkr-dev", activity: "hiring", detail: "Hired a worker" });
  const log = page.locator(".pj-log");
  await expect(log.getByText("Hired a worker")).toBeVisible();
  const gap = () => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

  // He scrolls up to read, then writes: the chat goes down to his message at once.
  await log.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.getByRole("textbox", { name: /Message VAIC about/ }).fill("whats the status");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(gap).toBeLessThanOrEqual(2);
  await expect(log.locator(".pj-owner").last()).toBeInViewport();

  // The reply streams in word by word, below the builders' steps; the view ticks down with every new line.
  const long = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}: the memory game is coming along.`);
  for (let n = 1; n <= long.length; n += 3) {
    m.send({ type: "vaic.reply", conversation: conv, text: long.slice(0, n).join("\n\n"), done: false });
    await expect.poll(gap).toBeLessThanOrEqual(2);
  }
  m.send({ type: "vaic.reply", conversation: conv, text: long.join("\n\n"), done: true });
  await expect(log.getByText("Line 24: the memory game is coming along.")).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);
  const reply = log.locator(".pj-vaic").last();
  const steps = log.getByText("Hired a worker");
  expect((await reply.boundingBox())!.y).toBeGreaterThan((await steps.boundingBox())!.y);
  const order = await log.evaluate((el) =>
    [...el.querySelectorAll(".pj-msg, .buildlog")].map((x) =>
      x.classList.contains("buildlog") ? "steps" : x.classList.contains("pj-owner") ? "owner" : "vaic",
    ),
  );
  expect(order).toEqual(["owner", "vaic", "steps", "owner", "vaic"]);

  // Scrolled up to read, a new reply and new steps don't pull him down; "New messages" takes him there.
  await log.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.waitForTimeout(150);
  m.send({ type: "activity", id: "wkr-dev", activity: "running", detail: "Ran node --test tests/" });
  m.send({ type: "vaic.reply", conversation: conv, text: "Tests pass.\n\nThe cards flip now.", done: false });
  const button = page.getByRole("button", { name: "New messages" });
  await expect(button).toBeVisible();
  expect(await log.evaluate((el) => el.scrollTop)).toBe(0);
  await page.screenshot({ path: `${SHOTS}/project-chat-new-below.png` });
  await button.click();
  await expect.poll(gap).toBeLessThanOrEqual(2);
  await expect(button).toHaveCount(0);
});
