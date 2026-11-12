// The Knowledge tab sorted by place, year and topic (docs/KNOWLEDGE.md §15): drop several laws at once, see them
// grouped as "Sweden · 2026 · Tax", find them by name, see the older year kept but marked, correct a place by hand,
// and the same at phone width. The country, year and topic menus gave way to a name search (decision 270).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7 ${name}`) });
const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("knowledge: laws are grouped by country, year and topic, filterable, and the newer year wins", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();

  // Monday: Swedish tax law, two years. Wednesday: Swiss tax law. Plus the GDPR and a plain note. All at once.
  await page
    .locator(".drop input[type=file]")
    .setInputFiles([
      pdf("Sweden tax 2026.pdf"),
      pdf("Sweden tax 2025.pdf"),
      pdf("Switzerland tax 2025.pdf"),
      pdf("GDPR privacy 2018.pdf"),
      pdf("meeting notes.pdf"),
    ]);
  await expect(page.getByRole("region", { name: "Who can use it" })).toContainText("5 files");
  await page.getByRole("button", { name: "Add for every department" }).click();
  await expect.poll(() => m.knowledge.puts.length).toBe(5);

  await expect(group(page, "Sweden · 2026 · Tax")).toBeVisible({ timeout: 10_000 });
  await expect(group(page, "Sweden · 2025 · Tax")).toBeVisible();
  await expect(group(page, "Switzerland · 2025 · Tax")).toBeVisible();
  await expect(group(page, "EU · 2018 · Privacy")).toBeVisible();
  await expect(group(page, "Not tied to a country")).toContainText("meeting notes.pdf");

  // Newer above older for the same country and topic; the older is kept and says what replaces it.
  const titles = await page.locator(".kgroup-title").allInnerTexts();
  const at = (t: string) => titles.findIndex((x) => x.startsWith(t));
  expect(at("Sweden · 2026 · Tax")).toBeLessThan(at("Sweden · 2025 · Tax"));
  await expect(group(page, "Sweden · 2025 · Tax")).toContainText("Older: 2026 replaces it");
  await expect(group(page, "Sweden · 2026 · Tax")).not.toContainText("Older:");
  await expect(group(page, "Switzerland · 2025 · Tax")).not.toContainText("Older:"); // another country
  await expect(group(page, "Sweden · 2026 · Tax")).toContainText("found automatically");

  // Find by name: only Sweden's.
  await page.getByRole("searchbox", { name: "Search" }).fill("swed");
  // Marketing's built-in knowledge has an entry about Sweden ("Sweden: advertising must be recognisable").
  await expect(page.locator(".kgroup-title")).toHaveText(["Built in", /Sweden · 2026 · Tax/, /Sweden · 2025 · Tax/]);
  await expect(page.getByRole("region", { name: "Marketing knowledge base" })).toContainText("1 match “swed”");
  await page.getByRole("button", { name: "Show everything" }).click();
  // Five place groups, plus "Built in" (the department knowledge bases, docs/KNOWLEDGE.md §17).
  await expect(page.locator(".kgroup-title")).toHaveCount(6);
  await noSeriousA11y(page, "Knowledge by place");
  await page.screenshot({ path: `${SHOTS}/knowledge-places.png`, fullPage: true });

  // The note was not about a country; the owner says it is Swiss tax 2026.
  const note = page.getByRole("listitem").filter({ hasText: "meeting notes.pdf" });
  await note.getByRole("button", { name: "Change country, year or topic of “meeting notes.pdf”" }).click();
  const form = page.getByRole("form", { name: "Where and when “meeting notes.pdf” holds" });
  await form.getByLabel("Countries or regions").fill("Switzerland");
  await form.getByLabel("Year").fill("2026");
  await form.getByRole("combobox", { name: "Topic" }).click();
  await page.getByRole("option", { name: /^Tax/ }).click();
  await noSeriousA11y(page, "Knowledge place editor");
  await form.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.method === "PUT" && c.path.startsWith("/knowledge/"))?.body)
    .toEqual({ jurisdictions: ["CH"], year: 2026, topic: "tax", doc_type: null });
  await expect(group(page, "Switzerland · 2026 · Tax")).toContainText("meeting notes.pdf");
  await expect(group(page, "Switzerland · 2025 · Tax")).toContainText("Older: 2026 replaces it");

});

test("knowledge by place fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([pdf("Sweden tax 2026.pdf"), pdf("USA privacy 2024.pdf")]);
  await page.getByRole("button", { name: "Add for every department" }).click();
  await expect.poll(() => m.knowledge.puts.length).toBe(2);
  await expect(group(page, "Sweden · 2026 · Tax")).toBeVisible({ timeout: 10_000 });
  await expect(group(page, "United States · 2024 · Privacy")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const change = page.getByRole("button", { name: "Change country, year or topic of “Sweden tax 2026.pdf”" });
  expect((await change.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await change.click();
  await expect(page.getByRole("form", { name: "Where and when “Sweden tax 2026.pdf” holds" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await noSeriousA11y(page, "Knowledge by place at 412px");
  await page.screenshot({ path: `${SHOTS}/phone-knowledge-places.png`, fullPage: true });
});
