// The upload as a numbered flow (decision 280): dropped files sit as tiles inside the drop zone (✕ removes one,
// "+ Add more" adds more), the department step is right under it with big chips, and one big button says exactly
// what will happen; the new rows then glow and settle into the list.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const md = (name: string) => ({ name, mimeType: "text/markdown", buffer: Buffer.from(`# ${name}\n\nCampaign notes.`) });
const tiles = (page: Page) => page.getByRole("list", { name: "Files to add" }).locator(".ktile:not(.ktile-more)");

test("knowledge: files sit in the drop zone, more can be added or removed, then one button adds them", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([md("Brand voice.md"), md("Launch plan.md")]);
  await expect(tiles(page)).toHaveCount(2);
  await expect(page.getByText("2 files ready")).toBeVisible();
  await expect(tiles(page).first()).toContainText("📝");
  await expect(tiles(page).first()).toContainText(/\d+ B/);

  // A third through "+ Add more" (still inside the drop zone), then one removed with ✕.
  await page
    .locator(".drop .ktile-more input[type=file]")
    .setInputFiles([md("phed-make-real-money-gta-6-2026-10-31.md")]);
  await expect(tiles(page)).toHaveCount(3);
  await expect(tiles(page).nth(2)).toContainText("…"); // a long name is shortened…
  await expect(tiles(page).nth(2).locator(".ktile-name")).toHaveAttribute(
    "title",
    "phed-make-real-money-gta-6-2026-10-31.md",
  );
  await page.getByRole("button", { name: "Remove Launch plan.md" }).click();
  await expect(tiles(page)).toHaveCount(2);

  // ② right under the drop zone, attached to it; nothing stored yet.
  const pick = page.locator(".kadd-flow").getByRole("region", { name: "Who can use it" });
  await expect(pick).toBeVisible();
  await expect(pick.getByText("None picked: every department can use them.")).toBeVisible();
  const box = await page.locator(".kadd-flow .drop").boundingBox();
  const step2 = await pick.boundingBox();
  expect(Math.abs(step2!.y - (box!.y + box!.height))).toBeLessThan(4);
  const paste = await page.getByLabel("Paste a link or text").boundingBox();
  expect(step2!.y).toBeLessThan(paste!.y); // above the paste box
  expect(m.calls.filter((c) => c.path === "/knowledge/uploads")).toHaveLength(0);
  const chip = pick.getByRole("button", { name: /^Marketing/ });
  await expect(chip).toContainText("Recommended");
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const a11y = await new AxeBuilder({ page }).include(".kadd-flow").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  // ③ says exactly what will happen.
  await expect(pick.getByRole("button", { name: "Add 2 files for every department" })).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await pick.getByRole("button", { name: /^Media/ }).click();
  const go = pick.getByRole("button", { name: "Add 2 files for Marketing and Media" });
  expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await go.click();

  await expect(tiles(page)).toHaveCount(0);
  await expect(page.getByText("Drop files here, or choose files")).toBeVisible();
  await expect.poll(() => m.calls.filter((c) => c.path === "/knowledge/uploads").length).toBe(2);
  for (const c of m.calls.filter((c) => c.path === "/knowledge/uploads"))
    expect((c.body as { departments: string[] }).departments).toEqual(["marketing", "media"]);
  // The new rows glow and settle into the list.
  for (const t of ["Brand voice.md", "phed-make-real-money-gta-6-2026-10-31.md"])
    await expect(page.locator("li.kitem", { hasText: t })).toHaveClass(/kitem-new/);
  await expect(page.locator("li.kitem-new")).toHaveCount(0, { timeout: 8_000 }); // then calm down
});

test("knowledge: the upload flow fits a phone with big targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([md("a.md"), md("b.md"), md("c.md")]);
  await expect(tiles(page)).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const x = page.getByRole("button", { name: "Remove a.md" });
  const bx = (await x.boundingBox())!;
  expect(bx.width).toBeGreaterThanOrEqual(44);
  expect(bx.height).toBeGreaterThanOrEqual(44);
  const go = page.getByRole("button", { name: "Add 3 files for every department" });
  expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: `${import.meta.dirname}/../../docs/screenshots/phone-knowledge-tray.png`,
    fullPage: true,
  });
});
