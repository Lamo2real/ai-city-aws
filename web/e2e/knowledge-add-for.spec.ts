// The Knowledge page (decision 270): before anything is stored the owner picks which departments can use it, the
// recommended ones marked but not ticked, none meaning every department; and the page is filtered by a name search,
// a department and built in or mine, remembered on this device.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const file = (name: string, text = name) => ({ name, mimeType: "text/markdown", buffer: Buffer.from(text) });
const card = (page: Page, title: string) => page.locator("li.kitem", { hasText: title });
const uploads = (m: Awaited<ReturnType<typeof mockBackend>>) =>
  m.calls.filter((c) => c.method === "POST" && c.path === "/knowledge/uploads").map((c) => c.body);

test("knowledge: a dropped file waits for the departments; Finance only, or every department when none is ticked", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([file("Q3 budget.md", "# Budget\n\nInvoices and costs.")]);

  const pick = page.getByRole("region", { name: "Who can use it" });
  await expect(pick).toContainText("Adding “Q3 budget.md”");
  const finance = pick.getByRole("button", { name: /^\S*\s*Finance/ });
  await expect(finance).toContainText("Recommended"); // marked…
  await expect(finance).toHaveAttribute("aria-pressed", "false"); // …but not ticked
  await expect(pick.getByText("No departments chosen: every department can use it.")).toBeVisible();
  expect(uploads(m)).toHaveLength(0); // nothing stored yet
  const a11y = await new AxeBuilder({ page }).include(".kadd").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await pick.getByRole("button", { name: "Use recommended" }).click();
  await expect(finance).toHaveAttribute("aria-pressed", "true");
  await expect(pick.getByRole("status")).toContainText("Only Finance can use it.");
  await pick.getByRole("button", { name: "Add for Finance" }).click();
  await expect(pick).toHaveCount(0);
  await expect.poll(() => uploads(m)[0]).toMatchObject({ file_name: "Q3 budget.md", departments: ["finance"] });
  await expect(card(page, "Q3 budget.md")).toContainText("For Finance");

  // Two more at once share one choice; with nothing ticked they are for every department.
  await page.locator(".drop input[type=file]").setInputFiles([file("a.md"), file("b.md")]);
  await expect(pick).toContainText("2 files");
  await pick.getByRole("button", { name: "Add for every department" }).click();
  await expect.poll(() => uploads(m).length).toBe(3);
  expect(uploads(m).slice(1).map((b) => (b as { departments?: unknown }).departments)).toEqual(["all", "all"]);
  await expect(card(page, "a.md")).toContainText(/For \d+ departments/); // every department, counted

  // Pasted text asks too; Cancel stores nothing.
  await page.getByLabel("Paste a link or text").fill("Contract terms with the supplier");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(pick).toContainText("Adding the text");
  await pick.getByRole("button", { name: "Cancel" }).click();
  expect(m.calls.filter((c) => c.path === "/knowledge/text")).toHaveLength(0);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await pick.getByRole("button", { name: /Legal/ }).click();
  await pick.getByRole("button", { name: "Add for Legal" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/knowledge/text")?.body)
    .toMatchObject({ departments: ["legal"] });
});

test("knowledge: search by name, a department and built in or mine; remembered after a reload", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([file("Q3 budget.md")]);
  const pick = page.getByRole("region", { name: "Who can use it" });
  await pick.getByRole("button", { name: /Finance/ }).click();
  await pick.getByRole("button", { name: "Add for Finance" }).click();
  await page.locator(".drop input[type=file]").setInputFiles([file("Brand voice.md")]);
  await pick.getByRole("button", { name: "Add for every department" }).click();
  await expect(card(page, "Brand voice.md")).toBeVisible();

  // The old country, year and topic menus are gone.
  await expect(page.getByRole("combobox", { name: "Country or region" })).toHaveCount(0);
  await expect(page.getByLabel("Group by country, year and topic")).toHaveCount(0);

  const search = page.getByRole("searchbox", { name: "Search" });
  const marketing = page.getByRole("region", { name: "Marketing knowledge base" });
  const shared = page.getByRole("region", { name: "Shared knowledge base" });

  // From the start of any word, any case: "b" finds both files ("Q3 budget", "Brand voice").
  await search.fill("B");
  await expect(card(page, "Q3 budget.md")).toBeVisible();
  await expect(card(page, "Brand voice.md")).toBeVisible();
  await search.fill("udget");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  // A department card matches by its name, or by its entries' titles.
  await search.fill("mark");
  await expect(marketing).toBeVisible();
  await expect(shared).toHaveCount(0);
  await expect(card(page, "Q3 budget.md")).toHaveCount(0);
  await search.fill("build");
  await expect(marketing).toContainText("1 match “build”");
  await marketing.getByRole("button", { name: "Show the Marketing entries" }).click();
  await expect(marketing.getByLabel("Search")).toHaveValue("build");
  await page.getByRole("button", { name: "Show everything" }).click();

  // A department: what it can use, every-department documents included; Shared is every department's too.
  const dept = page.getByRole("combobox", { name: "Department" });
  await dept.click();
  await page.getByRole("option", { name: "Legal" }).click();
  await expect(card(page, "Q3 budget.md")).toHaveCount(0);
  await expect(card(page, "Brand voice.md")).toBeVisible();
  await expect(marketing).toHaveCount(0);
  await expect(shared).toBeVisible();
  await dept.click();
  await page.getByRole("option", { name: "Finance" }).click();
  await expect(card(page, "Q3 budget.md")).toBeVisible();

  // Built in or mine.
  const show = page.getByRole("combobox", { name: "Built in" });
  await show.click();
  await page.getByRole("option", { name: "Mine" }).click();
  await expect(shared).toHaveCount(0);
  await expect(card(page, "Q3 budget.md")).toBeVisible();
  await show.click();
  await page.getByRole("option", { name: "Built in", exact: true }).click();
  await expect(card(page, "Q3 budget.md")).toHaveCount(0);
  await expect(shared).toBeVisible();

  // Remembered on this device.
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Built in" })).toHaveText(/Built in/);
  await expect(page.getByRole("combobox", { name: "Department" })).toHaveText(/Finance/);
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("");
});

test("knowledge: the department choice and the filters fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/#/knowledge");
  await page.locator(".drop input[type=file]").setInputFiles([file("Q3 budget.md")]);
  await expect(page.getByRole("region", { name: "Who can use it" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const add = page.getByRole("button", { name: "Add for every department" });
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await add.click();
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
