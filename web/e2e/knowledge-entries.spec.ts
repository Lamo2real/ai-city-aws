// The built-in Marketing knowledge base on the Knowledge tab (docs/KNOWLEDGE.md §17): it sits under "Built in" with
// a Marketing label, opens into its entries by domain, and the owner can read, edit, delete, reset to default, see
// a newer default and add an entry; the same at phone width, with no serious accessibility problem.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("knowledge: the built-in Marketing knowledge base can be read, edited, deleted, reset and added to", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  const card = page.getByRole("region", { name: "Marketing knowledge base" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Built in");
  await expect(card).toContainText("4 entries");
  await card.getByRole("button", { name: "Show the Marketing entries" }).click();
  await expect(card.getByRole("list", { name: "Meta ads entries" })).toBeVisible();
  await expect(card.getByText("Newer default")).toBeVisible();
  await noSeriousA11y(page, "entries");

  // Read one, then edit it: it is marked Edited (a deploy will leave it alone).
  await card.getByRole("button", { name: /^Build positioning bottom-up/ }).click();
  await expect(card.getByText("The guidance itself.")).toBeVisible();
  await card.getByRole("button", { name: /^Edit “Build positioning/ }).click();
  await card.getByLabel("Title").fill("Our positioning method");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("button", { name: /^Our positioning method/ })).toContainText("Edited");
  expect(m.entries.find((e) => e.entry_id === "marketing.strategy.positioning")?.user_modified).toBe(true);

  // Reset it to the default.
  await card.getByRole("button", { name: "Reset to default" }).click();
  await expect(card.getByRole("button", { name: /^Build positioning bottom-up/ })).not.toContainText("Edited");

  // The newer default can be viewed.
  await card.getByRole("button", { name: /^Size Meta budgets/ }).click();
  await card.getByRole("button", { name: "View newer default" }).click();
  await expect(card.getByText("The newer default text.")).toBeVisible();

  // Delete one: it stays listed as Deleted, with Reset to default to bring it back.
  await card.getByRole("button", { name: /^Performance Max: inputs/ }).click();
  await card.getByRole("button", { name: /^Delete “Performance Max/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(card.getByRole("button", { name: /^Performance Max: inputs/ })).toContainText("Deleted");
  expect(m.entries.find((e) => e.entry_id === "marketing.google-ads.performance-max-and-feeds")?.deleted).toBe(true);

  // Add an entry of the owner's own.
  await card.getByRole("button", { name: "Add an entry" }).click();
  const form = card.getByRole("form", { name: "A new entry" });
  await form.getByLabel("Title").fill("Our Black Week rules");
  await form.getByLabel("Summary (one or two sentences)").fill("How we run Black Week offers.");
  await form.getByLabel(/^The entry/).fill("## Rules\n\nShow the lowest price of the last 30 days.");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("button", { name: /^Our Black Week rules/ })).toContainText("Yours");
  // Scan once the confirmation toasts have finished fading in (half-transparent text fails contrast mid-fade).
  for (const t of await page.locator(".toast").all()) await expect(t).toHaveCSS("opacity", "1");
  await noSeriousA11y(page, "after changes");

  // Phone width: the card and its entries still fit.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("knowledge: the shared cross-department documents sit under Built in with a Shared label and the same actions", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  const cards = page.locator("section.kdept");
  await expect(cards.last()).toHaveAttribute("aria-label", "Shared knowledge base"); // after the departments
  const card = page.getByRole("region", { name: "Shared knowledge base" });
  await expect(card).toContainText("Built in");
  await expect(card.locator(".tag-dept")).toHaveText(/^\d+ departments$/); // every department, counted (decision 270)
  await expect(card).toContainText("2 entries");
  await expect(card).toContainText("Every department's agents use it.");
  await card.getByRole("button", { name: "Show the Shared entries" }).click();
  await card.getByRole("button", { name: /^Shared: Routing rule/ }).click();
  await card.getByRole("button", { name: /^Edit “Shared: Routing rule/ }).click();
  await card.getByLabel("Title").fill("Our routing rule");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("button", { name: /^Our routing rule/ })).toContainText("Edited");
  expect(m.entries.find((e) => e.entry_id === "shared.routing.routing-rule-and-message-template")?.user_modified).toBe(
    true,
  );
  await card.getByRole("button", { name: "Reset to default" }).click();
  await expect(card.getByRole("button", { name: /^Shared: Routing rule/ })).not.toContainText("Edited");
  await card.getByRole("button", { name: /^Delete “Shared: Routing rule/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(card.getByRole("button", { name: /^Shared: Routing rule/ })).toContainText("Deleted");
  // The Marketing card still counts only its own entries.
  await expect(page.getByRole("region", { name: "Marketing knowledge base" })).toContainText("4 entries");
  await noSeriousA11y(page, "shared");
});
