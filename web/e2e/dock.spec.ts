// The City dock (the owner's wish, 2026-11-09): one slim bar of icons, and a flat voice line that opens beside the
// mic while anyone talks, saying who (you in blue, AIC in brown).
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

test("the City dock opens a flat voice line beside the mic and says who is talking", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/city");
  const dock = page.locator(".dockbar");
  await expect(dock).toBeVisible();
  await expect(dock).not.toHaveClass(/live/);
  await expect(dock.locator(".docklive")).toHaveCSS("opacity", "0");
  await dock.screenshot({ path: `${SHOTS}/city-dock.png` });

  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(dock).toHaveClass(/live/);
  await expect(dock).toHaveAttribute("data-speaker", "you");
  await expect(dock.locator(".dockwho")).toHaveText("You");
  await expect(dock.locator(".docklive")).toHaveCSS("opacity", "1");
  await page.waitForTimeout(400);
  await dock.screenshot({ path: `${SHOTS}/city-dock-listening.png` });

});
