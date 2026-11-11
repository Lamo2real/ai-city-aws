// Download on the Knowledge tab (the owner, 2026-11-11): every document card has it — the owner's uploads and the
// built-in department and shared documents — and it saves the original through a short-lived S3 address; a link
// has nothing to download.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test("knowledge: Download is on each document card and saves the original", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();

  // The owner's own upload: once it has arrived, Download saves it under its own name.
  await page
    .locator(".drop input[type=file]")
    .setInputFiles([{ name: "Q3 report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 Q3") }]);
  const card = page.locator("li.kitem", { hasText: "Q3 report.pdf" });
  const button = card.getByRole("button", { name: "Download “Q3 report.pdf”" });
  await expect(button).toBeVisible({ timeout: 10_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(file.suggestedFilename()).toBe("Q3 report.pdf");
  expect(m.knowledge.downloads.at(-1)).toMatch(/^\/raw\/k-[\w-]+\/Q3%20report\.pdf$/);

  // A link has no file: no Download on its card.
  await page.getByLabel(/paste/i).first().fill("https://example.com/pricing");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const link = page.locator("li.kitem", { hasText: "example.com" });
  await expect(link).toBeVisible();
  await expect(link.getByRole("button", { name: /^Download/ })).toHaveCount(0);

  // A built-in department document: Download in its actions saves the active version.
  const dept = page.getByRole("region", { name: "Marketing knowledge base" });
  await dept.getByRole("button", { name: "Show the Marketing entries" }).click();
  await dept.getByRole("button", { name: /^Build positioning bottom-up/ }).click();
  const [doc] = await Promise.all([
    page.waitForEvent("download"),
    dept.getByRole("button", { name: /^Download “Build positioning/ }).click(),
  ]);
  expect(doc.suggestedFilename()).toMatch(/\.md$/);
  expect(m.knowledge.downloads.at(-1)).toBe("/downloads/entries/marketing.strategy.positioning/abc.md");

  // A shared document too.
  const shared = page.getByRole("region", { name: "Shared knowledge base" });
  await shared.getByRole("button", { name: "Show the Shared entries" }).click();
  await shared.getByRole("button", { name: /^Shared: Routing rule/ }).click();
  await Promise.all([
    page.waitForEvent("download"),
    shared.getByRole("button", { name: /^Download “Shared: Routing rule/ }).click(),
  ]);
  expect(m.knowledge.downloads).toHaveLength(3);
});
