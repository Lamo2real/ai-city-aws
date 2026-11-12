// Projects and chats on the server (decision 299): the owner's Mac and his PC are two browser contexts sharing
// one server. A project started on one shows on the other, a message sent on one shows on the other (live and after
// a reload), a device's older local projects upload once, and sign-out leaves the server's copy alone.
import { expect, test, type Browser } from "@playwright/test";
import { Cloud, mockBackend } from "./mock.ts";

const BASE = "http://localhost:4173";
async function device(browser: Browser, cloud: Cloud) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const m = await mockBackend(page, { cloud });
  return { context, page, m };
}

test("a project started on the Mac shows on the PC, and messages show on both", async ({ browser }) => {
  const cloud = new Cloud();
  const mac = await device(browser, cloud);
  const pc = await device(browser, cloud);
  await pc.page.goto("/#/apps");
  await mac.page.goto("/#/apps");

  await mac.page.getByRole("button", { name: /New project/ }).click();
  const dialog = mac.page.getByRole("dialog", { name: "What should your app do?" });
  await dialog.getByPlaceholder("Describe your app in one sentence").fill("A quiz about world capitals");
  await dialog.getByRole("button", { name: "Start building" }).click();
  await expect(mac.page).toHaveURL(/#\/apps\/new-[a-z0-9]+$/);
  const slug = mac.page.url().split("/apps/")[1]!;

  // The PC was already open: the project arrives live.
  await expect(pc.page.getByRole("listitem").filter({ hasText: "Quiz about world capitals" })).toBeVisible();
  await pc.page.goto(`/#/apps/${slug}`);
  await expect(pc.page.getByRole("heading", { name: "Quiz about world capitals" })).toBeVisible();
  // His first message is there, from the server.
  await expect(pc.page.locator(".pj-log")).toContainText("A quiz about world capitals");

  // A message on the PC shows on the Mac at once, exactly once.
  await pc.page.getByRole("textbox", { name: /Message VAIC about/ }).fill("Make it about Europe first");
  await pc.page.getByRole("button", { name: "Send" }).click();
  const macLog = mac.page.locator(".pj-log");
  await expect(macLog).toContainText("Make it about Europe first");
  // A reconnect (the Mac comes back to the page) never doubles a line.
  await mac.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await mac.page.waitForTimeout(300);
  await expect(macLog.getByText("Make it about Europe first")).toHaveCount(1);
  await expect(macLog.getByText("A quiz about world capitals")).toHaveCount(1);

  // A fresh device (a reload with nothing cached) gets both from the server.
  const fresh = await device(browser, cloud);
  await fresh.page.goto(`/#/apps/${slug}`);
  const log = fresh.page.locator(".pj-log");
  await expect(log).toContainText("A quiz about world capitals");
  await expect(log).toContainText("Make it about Europe first");
  for (const d of [mac, pc, fresh]) await d.context.close();
});

test("a device's older local projects and chats upload once, and sign-out keeps the cloud copy", async ({
  browser,
}) => {
  const cloud = new Cloud();
  const mac = await device(browser, cloud);
  // The Mac from before projects lived on the server: a draft and its chat only in localStorage.
  await mac.page.addInitScript(() => {
    if (localStorage.getItem("vaic.projects.uploaded")) return;
    localStorage.setItem(
      "vaic.projects.new",
      JSON.stringify([
        { key: "new-mac00001", idea: "a quiz about world capitals", title: "Quiz About World Capitals", at: 1 },
      ]),
    );
    localStorage.setItem(
      "vaic.projects.chats",
      JSON.stringify({
        "app-new-mac00001": [
          { id: "pmac0001", who: "owner", text: "a quiz about world capitals", state: "sent", at: 1 },
          { id: "amac0001", who: "vaic", text: "Happy to, Sir. Multiple choice?", state: "done", at: 2 },
        ],
      }),
    );
  });
  await mac.page.goto("/#/apps");
  await expect.poll(() => Object.keys(cloud.projects)).toEqual(["new-mac00001"]);
  await expect
    .poll(() => cloud.lines["app-new-mac00001"]?.map((l) => l.text))
    .toEqual(["a quiz about world capitals", "Happy to, Sir. Multiple choice?"]);
  await mac.page.reload();
  await expect(mac.page.getByRole("listitem").filter({ hasText: "Quiz About World Capitals" })).toBeVisible();
  expect(mac.m.calls.filter((c) => c.method === "POST" && c.path.startsWith("/conversations/"))).toHaveLength(1);

  const pc = await device(browser, cloud);
  await pc.page.goto("/#/apps/new-mac00001");
  await expect(pc.page.locator(".pj-log")).toContainText("Happy to, Sir. Multiple choice?");

  // Sign-out on the Mac clears its cache only (test/cloudProjects.test.ts checks the cache); the server keeps it all.
  await mac.page.goto("/#/settings/general");
  await mac.page.getByRole("button", { name: "Sign out" }).click();
  await mac.page.waitForLoadState("load");
  expect(mac.m.calls.filter((c) => c.method === "DELETE")).toEqual([]);
  expect(Object.keys(cloud.projects)).toEqual(["new-mac00001"]);
  expect(cloud.lines["app-new-mac00001"]).toHaveLength(2);
  for (const d of [mac, pc]) await d.context.close();
});
