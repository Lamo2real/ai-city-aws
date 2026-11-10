// Settings → Connectors, Browse: every card state fits inside its card at every width (decision 179).
// The owner's bug: Jira's key form spilled past the card's right edge and stretched its row.
import { expect, test, type Page } from "@playwright/test";
import { cardsFit, everyCardState, keyFormInside } from "./connector-fit.ts";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
async function openBrowse(page: Page) {
  await page.goto("/#/settings/connectors");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("region", { name: "Every department tools" })).toBeVisible();
  await page.waitForTimeout(400); // the switch eases between its two states
}

for (const width of [1440, 1280, 1100, 1000, 900, 768]) {
  test(`Settings → Connectors at ${width}px: every card state fits inside its card`, async ({ page }) => {
    const m = await mockBackend(page);
    everyCardState(m);
    await page.setViewportSize({ width, height: 900 });
    await openBrowse(page);
    await keyFormInside(page);
    await cardsFit(page);
    // A card with a form open takes the whole row, so its neighbours keep their own height.
    const every = page.getByRole("region", { name: "Every department tools" });
    const jira = (await every.getByRole("listitem", { name: "Jira & Confluence" }).boundingBox())!;
    const grid = (await every.getByRole("list", { name: "Every department catalog" }).boundingBox())!;
    expect(jira.width).toBeGreaterThan(grid.width - 2);
    if (width === 1000) await page.screenshot({ path: `${SHOTS}/connectors-card-states.png`, fullPage: false });
  });
}

test("Settings → Connectors: the secure forms still save from a full-row card, and the card settles back", async ({
  page,
}) => {
  const m = await mockBackend(page);
  everyCardState(m);
  await page.setViewportSize({ width: 1000, height: 900 });
  await openBrowse(page);
  const every = page.getByRole("region", { name: "Every department tools" });
  const jira = every.getByRole("listitem", { name: "Jira & Confluence" });
  await jira.getByLabel("Key", { exact: true }).fill("atl-secret-123");
  // The connector turns ready once its key is stored.
  m.connectors[0]!.status = "ready";
  await jira.getByRole("button", { name: "Save securely" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/connectors/atlassian/key")).toBe(true);
  await expect(jira.getByText("Connected")).toBeVisible();
  await expect(jira.getByLabel("Key", { exact: true })).toHaveCount(0);
  const grid = (await every.getByRole("list", { name: "Every department catalog" }).boundingBox())!;
  expect((await jira.boundingBox())!.width).toBeLessThan(grid.width / 2); // back to one column
  // The app id and secret flow, and its access-token switch, fit too.
  const slack = every.getByRole("listitem", { name: "Slack" });
  await slack.getByRole("button", { name: "I have an access token instead" }).click();
  await expect(slack.getByLabel("Access token")).toBeVisible();
  await cardsFit(page);
});
