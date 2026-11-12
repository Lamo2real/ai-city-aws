// A pasted website link becomes a brand and site profile in Knowledge (docs/KNOWLEDGE.md §16): the owner pastes
// the link, it is read, and the item shows the logo, colour swatches, fonts and what the site is. Also at phone width.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

async function addAcme(page: Page) {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.getByLabel("Paste a link or text").fill("https://acme.example/");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Add .* for every department$/ }).click();
  await expect
    .poll(() => m.calls.find((c) => c.method === "POST" && c.path === "/knowledge/links")?.body)
    .toEqual({ url: "https://acme.example/", departments: "all" });
  const profile = page.getByText(/Brand and site profile: Acme Rockets/);
  await expect(profile).toBeVisible({ timeout: 10_000 });
  await profile.click();
  return m;
}

test("knowledge: a pasted link shows its brand colours, fonts, logo and what the site is", async ({ page }) => {
  await addAcme(page);
  const item = page.getByRole("listitem").filter({ hasText: "Acme Rockets | Launch anything" });
  await expect(item.getByRole("img", { name: "Acme Rockets logo" })).toBeVisible();
  const colours = item.getByRole("list", { name: "Brand colours" });
  await expect(colours.getByRole("listitem")).toHaveCount(4);
  await expect(colours).toContainText("#ff5a1f");
  await expect(colours.locator(".sp-swatch").first()).toHaveCSS("background-color", "rgb(255, 90, 31)");
  await expect(item).toContainText("Headings: Space Grotesk");
  await expect(item).toContainText("Body: Inter");
  await expect(item).toContainText("Acme builds small reusable rockets for research teams.");
  await expect(item).toContainText("Confident, short sentences, second person.");
  await expect(item).toContainText("Read from acme.example");
  await expect(item).toContainText("H1 · Launch anything");
  await expect(item).toContainText("Book a launch");
  await noSeriousA11y(page, "Knowledge brand profile");
  await item.screenshot({ path: `${SHOTS}/knowledge-brand.png` });
});

test("knowledge: the brand profile fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await addAcme(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("list", { name: "Brand colours" })).toBeVisible();
  await noSeriousA11y(page, "Knowledge brand profile, phone");
});
