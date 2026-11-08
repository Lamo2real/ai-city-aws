// Apps v2 (docs/APPS.md "v2: data bridge"): a calendar app the owner published reads only what they
// granted, through the HUD; a revoke stops it at once; anything that acts goes to Needs you.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { appRecord, CONFIG, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
const primaries = (page: Page) => page.locator(".btn-primary:visible").count();
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("canvas")
    .exclude("iframe")
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const CAL = () =>
  appRecord("app-cal000000001", "star-calendar", "Star Calendar", {
    grants: [{ id: "calendar.read" }, { id: "propose" }],
    pinned: true,
  });
const bridgeCalls = (m: { calls: Array<{ path: string }> }) => m.calls.filter((c) => c.path.endsWith("/bridge"));

test("a pinned calendar app reads granted events, gets not_granted after a revoke, and a proposal lands in Needs you", async ({
  page,
}) => {
  const m = await mockBackend(page, { apps: [CAL()] });
  await page.goto("/");
  // The pin sits in the top bar after the nav and opens the app.
  const pins = page.getByRole("navigation", { name: "Pinned apps" });
  await expect(pins.getByRole("link", { name: "Star Calendar" })).toBeVisible();
  const box = (await pins.getByRole("link", { name: "Star Calendar" }).boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await pins.getByRole("link", { name: "Star Calendar" }).click();
  await expect(page).toHaveURL(/#\/apps\/star-calendar$/);

  const app = page.frameLocator('iframe[title^="Star Calendar"]');
  await app.getByRole("button", { name: "Load my week" }).click();
  await expect(app.locator("#out")).toHaveText("Events: Dentist, Team sync");
  expect(bridgeCalls(m)).toHaveLength(1);
  expect(bridgeCalls(m)[0]).toMatchObject({
    path: "/apps/app-cal000000001/bridge",
    body: { cap: "calendar.read", params: { from: "2026-11-02T00:00:00Z", to: "2026-11-09T00:00:00Z" } },
  });
  await page.screenshot({ path: `${SHOTS}/app-calendar.png` });

  // Revoke the calendar from the app page.
  await page.getByText("Allowed (2)").click();
  await noSeriousA11y(page, "App permissions");
  await page.getByRole("button", { name: "Stop: Read your calendars (all accounts)" }).click();
  const dialog = page.getByRole("dialog", { name: "Stop Star Calendar from this?" });
  await dialog.getByRole("button", { name: "Stop it" }).click();
  await expect.poll(() => m.calls.find((c) => c.method === "PUT")?.body).toEqual({ grants: [{ id: "propose" }] });
  await expect(page.getByText("Allowed (1)")).toBeVisible();
  await app.getByRole("button", { name: "Load my week" }).click();
  await expect(app.locator("#out")).toHaveText("Error: not_granted");
  expect(bridgeCalls(m)).toHaveLength(1); // refused in the HUD, without the API

  // A proposal: the app only learns it waits; the owner sees it under Open items.
  await app.getByRole("button", { name: "Accept the team sync" }).click();
  await expect(app.locator("#out")).toHaveText("Proposal: waiting_for_you");
  expect(m.calls.find((c) => c.path.endsWith("/proposals"))).toMatchObject({
    path: "/apps/app-cal000000001/proposals",
    body: { kind: "calendar.respond", params: { event_id: "evt-1", response: "accepted" } },
  });
  await page.goto("/#/settings/away");
  await page.getByRole("link", { name: /Open items/ }).click();
  await expect(page.getByText("Star Calendar (an app) wants your OK")).toBeVisible();
  await page.getByText("Exactly what it will do").click();
  await expect(page.getByText("Accept the invitation: Team sync (Mon 10:00)")).toBeVisible();
  await noSeriousA11y(page, "Needs you: app proposal");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("publishing with grants: the preview gets no data, switches decide the grants, the pin box pins it", async ({
  page,
}) => {
  const m = await mockBackend(page, {
    snapshot: {
      approvals: [
        {
          id: "apr-cal",
          agent: "orchestrator",
          kind: "app.publish",
          draft_id: "drf-cal000000001",
          preview_url: `${CONFIG.appsUrl}/drafts/drf-cal000000001/index.html`,
          title: "Star Calendar",
          description: "Your week across every calendar.",
          capabilities: [{ id: "calendar.read" }, { id: "mail.search" }, { id: "propose" }],
          pin: true,
          department: "Apps",
        },
      ],
    },
  });
  await page.goto("/#/inbox");
  const card = page.getByRole("article", { name: "New app: Star Calendar" });
  await expect(card.getByRole("checkbox", { name: "Read your calendars (all accounts)" })).toBeChecked();
  await expect(card.getByRole("checkbox", { name: /Search your mail/ })).toBeChecked();
  await expect(card.getByRole("checkbox", { name: /Put its icon in the top bar/ })).toBeChecked();
  const preview = page.frameLocator('iframe[title="Preview of Star Calendar"]');
  await preview.getByRole("button", { name: "Load my week" }).click();
  await expect(preview.locator("#out")).toHaveText("Error: preview");
  expect(bridgeCalls(m)).toHaveLength(0);
  await noSeriousA11y(page, "Needs you: publish with grants");
  expect(await primaries(page)).toBe(1);
  await page.screenshot({ path: `${SHOTS}/needs-you-app-grants.png` });
  await card.getByRole("checkbox", { name: /Search your mail/ }).uncheck();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/approvals/apr-cal")?.body)
    .toEqual({ approved: true, grants: [{ id: "calendar.read" }, { id: "propose" }] });
  await expect.poll(() => m.calls.find((c) => c.method === "PUT")?.body).toEqual({ pinned: true });
  await expect(
    page.getByRole("navigation", { name: "Pinned apps" }).getByRole("link", { name: "Star Calendar" }),
  ).toBeVisible();
});

test("Settings → Apps: unpin and stop a permission", async ({ page }) => {
  const m = await mockBackend(page, { apps: [CAL()] });
  await page.goto("/#/settings/apps");
  await expect(page.getByRole("heading", { name: "Apps", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Unpin Star Calendar from the top bar" }).click();
  await expect.poll(() => m.calls.find((c) => c.method === "PUT")?.body).toEqual({ pinned: false });
  await expect(page.getByRole("navigation", { name: "Pinned apps" })).toHaveCount(0);
  await page.getByRole("button", { name: "Stop: Ask you to approve actions such as answering invitations" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop it" }).click();
  await expect
    .poll(() => m.calls.filter((c) => c.method === "PUT").at(-1)?.body)
    .toEqual({ grants: [{ id: "calendar.read" }] });
  await noSeriousA11y(page, "Settings with apps");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("a 7th pin is refused in plain words", async ({ page }) => {
  const apps = [1, 2, 3, 4, 5, 6].map((n) =>
    appRecord(`app-00000000000${n}`, `game-${n}`, `Game ${n}`, { pinned: true }),
  );
  const m = await mockBackend(page, { apps: [...apps, appRecord("app-000000000007", "game-7", "Game 7")] });
  await page.goto("/#/apps/game-7");
  await page.getByRole("button", { name: "Pin Game 7 to the top bar" }).click();
  await expect(page.getByText(/Only 6 apps fit in the top bar/)).toBeVisible();
  expect(m.calls.some((c) => c.method === "PUT")).toBe(false);
  await expect(page.getByRole("navigation", { name: "Pinned apps" }).getByRole("link")).toHaveCount(6);
});
