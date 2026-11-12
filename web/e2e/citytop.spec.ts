// The City's top bar: opening the (i) line never moves the City | Features switch or the (i) itself, so a fast
// double click opens and closes it in place (the owner, 2026-11-12).
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

for (const size of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`${size.name}: the (i) opens its line without moving the switch or itself`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await mockBackend(page);
    await page.goto("/#/city");
    await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
    const info = page.getByRole("button", { name: "Is everything running normally?" });
    const tabs = page.locator(".citytop .citytabs");
    await expect(info).toBeVisible();
    const before = { info: await info.boundingBox(), tabs: await tabs.boundingBox() };
    await info.click();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".citytop .healthline")).toBeVisible();
    expect(await info.boundingBox()).toEqual(before.info);
    expect(await tabs.boundingBox()).toEqual(before.tabs);
    await info.click();
    await expect(info).toHaveAttribute("aria-expanded", "false");
    expect(await info.boundingBox()).toEqual(before.info);
  });
}
