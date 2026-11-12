// Every document and every file can be downloaded, and who can use a document is a count (decision 270): one
// department by name, more as "3 departments" (digits), every department counted; the names on hover and when shown.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const ALL = (
  JSON.parse(readFileSync(`${import.meta.dirname}/../../config/departments.json`, "utf8")) as { departments: unknown[] }
).departments.length;
const md = (name: string) => ({ name, mimeType: "text/markdown", buffer: Buffer.from(`# ${name}`) });
const card = (page: Page, title: string) => page.locator("li.kitem", { hasText: title });

async function addFor(page: Page, name: string, depts: string[]) {
  await page.locator(".drop input[type=file]").setInputFiles([md(name)]);
  const pick = page.getByRole("region", { name: "Who can use it" });
  for (const d of depts) await pick.getByRole("button", { name: new RegExp(`^\\S*\\s*${d}`) }).click();
  await pick.getByRole("button", { name: /^Add (1 file|the) / }).click();
  await expect(card(page, name)).toBeVisible();
}

test("knowledge: department badges count; Show which and an opened card name them", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/knowledge");
  await addFor(page, "One.md", ["Finance"]);
  await addFor(page, "Three.md", ["Finance", "Legal", "Sales"]);
  await addFor(page, "Every.md", []);

  await expect(card(page, "One.md").locator(".tag-dept")).toHaveText("Finance");
  const three = card(page, "Three.md");
  await expect(three.locator(".tag-dept")).toHaveText("3 departments");
  await expect(three.locator(".tag-dept")).toHaveAttribute("title", /Sales.*Legal.*Finance|Finance|Legal|Sales/);
  await expect(three.locator(".tag-dept")).toHaveAttribute("aria-label", /^For .*Finance/);
  await expect(card(page, "Every.md").locator(".tag-dept")).toHaveText(`${ALL} departments`);
  await expect(three).toContainText("For 3 departments");
  await three.getByRole("button", { name: "Show which departments use “Three.md”" }).click();
  await expect(three.getByText(/^Used by .*Finance.*Legal|^Used by .*Sales/)).toBeVisible();
  for (const d of ["Finance", "Legal", "Sales"]) await expect(three).toContainText(d);

  // The built-in cards: a department card says its name; Shared counts every department and names them when opened.
  const marketing = page.getByRole("region", { name: "Marketing knowledge base" });
  await marketing.getByRole("button", { name: "Show the Marketing entries" }).click();
  await expect(marketing.locator(".kdept-used")).toHaveText("Used by Marketing.");
  const shared = page.getByRole("region", { name: "Shared knowledge base" });
  await expect(shared.locator(".tag-dept")).toHaveText(`${ALL} departments`);
  await shared.getByRole("button", { name: "Show the Shared entries" }).click();
  await expect(shared.locator(".kdept-used")).toContainText("Finance");
});

test("knowledge: an upload downloads as soon as it has arrived, and a link opens or downloads its page", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await addFor(page, "Plan.md", []);
  const plan = card(page, "Plan.md");
  const dl = plan.getByRole("button", { name: "Download “Plan.md”" });
  await expect(dl).toBeVisible(); // while it is being read as well as after
  const [file] = await Promise.all([page.waitForEvent("download"), dl.click()]);
  expect(file.suggestedFilename()).toBe("Plan.md");

  await page.getByLabel("Paste a link or text").fill("https://example.com/pricing");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Add .* for every department$/ }).click();
  const link = card(page, "example.com");
  await expect(link.getByRole("link", { name: "Open link" })).toHaveAttribute("href", "https://example.com/pricing");
  await expect(link.getByRole("status")).toHaveText("Ready", { timeout: 10_000 });
  const [page2] = await Promise.all([
    page.waitForEvent("download"),
    link.getByRole("button", { name: /^Download/ }).click(),
  ]);
  expect(page2.suggestedFilename()).toMatch(/\.md$/);
  expect(m.knowledge.downloads.at(-1)).toMatch(/^\/downloads\/items\/k-[\w-]+\//);
});

test("files: every file in the grid and the list has Download, and it saves the same bytes", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/files");
  const files = [
    { name: "Acme invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 acme invoice") },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("remember the milk") },
  ];
  await page.locator(".files-drop input[type=file]").setInputFiles(files);
  await expect.poll(() => m.files.puts.length).toBe(2);
  const grid = page.getByRole("list", { name: "Your files" });
  for (const f of files) {
    const b = grid.getByRole("button", { name: `Download ${f.name}` });
    await expect(b).toBeVisible();
    const [d] = await Promise.all([page.waitForEvent("download"), b.click()]);
    expect(d.suggestedFilename()).toBe(f.name);
    expect(readFileSync((await d.path())!)).toEqual(f.buffer);
  }
  await page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "List" }).click();
  await expect(page.locator(".files-list")).toBeVisible();
  for (const f of files)
    await expect(page.locator(".files-list").getByRole("button", { name: `Download ${f.name}` })).toBeVisible();
});
