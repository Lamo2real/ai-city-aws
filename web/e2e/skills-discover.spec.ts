// Skills → Yours | Discover (decision 188): browse the catalog, search, filter by department, open a skill to see
// its SKILL.md, add it in one tap, see Added, undo, and remove it from Yours. Desktop and phone. Backend mocked.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const catalogGrid = (page: Page) => page.getByRole("list", { name: "AI City catalog" });
const posted = (m: { calls: Array<{ path: string; method: string }> }, name: string) =>
  m.calls.filter((c) => c.path === `/skills/catalog/${name}` && c.method === "POST").length;
const deleted = (m: { calls: Array<{ path: string; method: string }> }, name: string) =>
  m.calls.filter((c) => c.path === `/skills/${name}` && c.method === "DELETE").length;

test("Discover: featured, search, open a skill, add it, see Added, then remove it from Yours and undo", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/skills");
  // Nothing installed yet: the page opens on Discover.
  await expect(page.getByRole("button", { name: "Discover", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article", { name: "Featured: Weekly status report" })).toBeVisible();
  expect(await catalogGrid(page).getByRole("listitem").count()).toBeGreaterThanOrEqual(20);
  await expect(page.getByRole("list", { name: "Built-in skills" }).getByRole("listitem").first()).toBeVisible();
  await noSeriousA11y(page, "discover");
  await page.screenshot({ path: `${SHOTS}/skills-discover.png`, fullPage: false });

  await page.getByRole("searchbox", { name: "Search skills" }).fill("nda");
  await expect(catalogGrid(page).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^Featured/ })).toHaveCount(0);
  await page.getByRole("button", { name: "About NDA triage" }).click();
  const dlg = page.getByRole("dialog", { name: "NDA triage" });
  await expect(dlg.getByText("AI City catalog · for Legal")).toBeVisible();
  await expect(dlg.getByLabel("SKILL.md")).toContainText("Not legal advice");
  await expect(dlg.getByLabel("SKILL.md")).not.toContainText("description:"); // the body, without frontmatter
  await noSeriousA11y(page, "skill detail");
  await page.screenshot({ path: `${SHOTS}/skills-detail.png` });
  await dlg.getByRole("button", { name: "Add NDA triage" }).click();
  await expect(dlg.getByText("Added", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Added NDA triage" })).toBeVisible();
  expect(posted(m, "nda-triage")).toBe(1);
  await dlg.getByRole("button", { name: "Close" }).click();
  await expect(catalogGrid(page).getByRole("listitem", { name: "NDA triage" }).getByText("Added")).toBeVisible();

  // Yours: it's there, marked as from Discover; remove it, then Undo brings it back with the same roles.
  await page.getByRole("searchbox", { name: "Search skills" }).fill("");
  await page.getByRole("button", { name: "Yours", exact: true }).click();
  const card = page.getByRole("article", { name: "Skill nda-triage" });
  await expect(card.getByText("From Discover")).toBeVisible();
  await expect(card.getByRole("heading", { name: /NDA triage/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/skills-yours.png` });
  await card.getByRole("button", { name: "Remove…" }).click();
  await expect(page.getByRole("dialog").getByText(/add it again from Discover/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Remove skill" }).click();
  await expect.poll(() => deleted(m, "nda-triage")).toBe(1);
  await expect(page.getByText("No skills yet.")).toBeVisible();
  await page
    .getByRole("status")
    .filter({ hasText: "Removed NDA triage" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect.poll(() => posted(m, "nda-triage")).toBe(2);
  await expect(page.getByRole("article", { name: "Skill nda-triage" })).toBeVisible();
});

test("Discover: one tap on a card adds it, Undo takes it back; departments and empty search", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/skills/discover");
  const card = catalogGrid(page).getByRole("listitem", { name: "Unit economics" });
  await card.getByRole("button", { name: "Add Unit economics" }).click();
  await expect(card.getByText("Added")).toBeVisible();
  expect(m.calls.find((c) => c.path === "/skills/catalog/unit-economics")?.body).toEqual({});
  await page
    .getByRole("status")
    .filter({ hasText: "Added Unit economics" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect.poll(() => deleted(m, "unit-economics")).toBe(1);
  await expect(card.getByRole("button", { name: "Add Unit economics" })).toBeVisible();

  // Finance: the catalog's finance skills and the built-in Bookkeeping; not Legal's.
  await page.getByRole("group", { name: "Department" }).getByRole("button", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "For Finance" })).toBeVisible();
  await expect(catalogGrid(page).getByRole("listitem", { name: "Cash flow and runway" })).toBeVisible();
  await expect(catalogGrid(page).getByRole("listitem", { name: "NDA triage" })).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Built-in skills" }).getByRole("listitem", { name: "Bookkeeping" }),
  ).toBeVisible();
  // A built-in says who already uses it.
  await expect(
    page.getByRole("listitem", { name: "Bookkeeping" }).getByText("Built into Finance", { exact: true }),
  ).toBeVisible();

  await page.getByRole("searchbox", { name: "Search skills" }).fill("zzzz");
  await expect(page.getByText('No skill matches "zzzz" in Finance.')).toBeVisible();
  await page.getByRole("button", { name: "Show all skills" }).click();
  await expect(page.getByRole("article", { name: "Featured: Weekly status report" })).toBeVisible();
});

test("Discover on a phone: the cards fit, nothing scrolls sideways, add works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const m = await mockBackend(page);
  await page.goto("/#/skills/discover");
  await expect(page.getByRole("article", { name: "Featured: Weekly status report" })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  const card = catalogGrid(page).getByRole("listitem", { name: "Cash flow and runway" });
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Add Weekly status report" }).click();
  await expect(page.getByRole("article", { name: /^Featured/ }).getByText("Added")).toBeVisible();
  expect(posted(m, "weekly-status-report")).toBe(1);
  await noSeriousA11y(page, "discover phone");
  await page.screenshot({ path: `${SHOTS}/skills-discover-phone.png` });
  await page.getByRole("button", { name: "About Cash flow and runway" }).click();
  const dlg = page.getByRole("dialog", { name: "Cash flow and runway" });
  await expect(dlg.getByLabel("SKILL.md")).toContainText("13 weeks");
  const d = (await dlg.boundingBox())!;
  expect(d.x + d.width).toBeLessThanOrEqual(390);
});
