// "A new version of VAIC is ready" (lib/version.ts): the built HUD carries its id; /version.json says what is live.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test("the built page and version.json carry the same id", async ({ page, request }) => {
  await mockBackend(page);
  await page.goto("/#/vaic");
  const loaded = await page.locator('meta[name="hud-version"]').getAttribute("content");
  expect(loaded).toMatch(/^[0-9a-f]{16}$/);
  const live = await (await request.get("/version.json")).json();
  expect(live.version).toBe(loaded);
  await page.waitForTimeout(500);
  await expect(page.getByText("A new version of VAIC is ready.")).toHaveCount(0);
});

test("a newer id shows the notice, and Reload loads the new page", async ({ page }) => {
  await mockBackend(page);
  let live = "ffffffffffffffff";
  await page.route("**/version.json*", (r) => r.fulfill({ json: { version: live } }));
  await page.goto("/#/vaic");
  const notice = page.getByText("A new version of VAIC is ready.");
  await expect(notice).toBeVisible();
  // Typing goes on undisturbed: the page waits for the button.
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await box.fill("half a thought");
  await page.waitForTimeout(500);
  await expect(box).toHaveValue("half a thought");

  live = (await page.locator('meta[name="hud-version"]').getAttribute("content"))!;
  const loads = page.waitForEvent("load");
  await page.getByRole("button", { name: "Reload" }).click();
  await loads;
  await expect(page.getByRole("textbox", { name: "Message to VAIC" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(notice).toHaveCount(0);
});
