// On a phone: AIC is the default, the mic is in reach, the City fits and the money is visible.
import { expect, test } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

test("phone: AIC and the City work at 412px wide", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message to AIC" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Today:/ })).toBeVisible();
  const mic = page.getByRole("button", { name: "Talk to AIC", exact: true });
  const box = (await mic.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".voice")).toBeInViewport(); // the eye's voice strip and the composer both fit
  await expect(page.getByRole("button", { name: "Send to AIC" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-ace.png` });
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("what's going on in the city today?");
  await page.getByRole("button", { name: "Send to AIC" }).click();
  m.send({
    type: "ace.reply",
    conversation: "main",
    text: "## Today\n- **Research**: 3 workers on the market scan\n- Engineering: idle\n\n| Department | Workers | Spend |\n|---|---|---|\n| Research | 3 | $0.30 |\n| Engineering | 0 | $0.00 |",
    done: true,
  });
  await expect(page.getByRole("cell", { name: "$0.30" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".talk").screenshot({ path: `${SHOTS}/phone-ace-chat.png` });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  m.send(hired("wkr-research-x1", "Research"));
  await expect(page.locator(".feed")).toContainText("Department Research created");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/phone-city.png` });
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
  await expect(page.getByRole("link", { name: "City" })).toBeInViewport();
});
