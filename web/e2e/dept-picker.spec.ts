// Which departments a skill or a knowledge document is for (decision 266): VAIC's card and the skill side panel show
// every department with its recommended ones picked; Add says the pick in words; the owner's spoken pick updates the
// chips; a knowledge card says when the document is ready; the Knowledge and Skills pages change the departments.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = process.env.DEPT_SHOTS;
const PRESETS = [
  ["application", "Application"],
  ["infrastructure", "IT Infrastructure"],
  ["data", "Data & AI"],
  ["marketing", "Marketing"],
  ["sales", "Sales"],
  ["support", "Customer Support"],
  ["finance", "Finance"],
  ["legal", "Legal"],
  ["product", "Product"],
  ["operations", "Operations"],
  ["research", "Research"],
  ["media", "Media"],
].map(([key, name]) => ({ key: key!, name: name! }));

function picker(recommended: { key: string; why: string }[]) {
  return { choices: PRESETS, recommended, selected: recommended.map((r) => r.key) };
}
const PYTHON = {
  type: "vaic.question",
  conversation: "main",
  question: "Add this skill?",
  options: ["Add", "Not now"],
  id: "chg-1",
  title: "Add the skill python",
  lines: ["Write, test and run Python scripts."],
  detail: "For every role.",
  skill: {
    name: "python",
    description: "Write, test and run Python scripts.",
    markdown:
      '---\nname: "python"\ndescription: "Write, test and run Python scripts."\n---\n\n# Python\n\n1. Test it.\n',
    files: [],
    replacing: false,
  },
  departments: picker([
    { key: "application", why: "writes code" },
    { key: "infrastructure", why: "runs scripts" },
    { key: "data", why: "analysis" },
  ]),
};
const DOC = {
  type: "vaic.question",
  conversation: "main",
  question: "Add it as knowledge for these departments?",
  options: ["Add", "No"],
  id: "chg-9",
  title: "Add “Q3 revenue dashboard.pdf” as knowledge",
  lines: [],
  detail: "",
  departments: picker([
    { key: "data", why: "charts and KPIs" },
    { key: "finance", why: "revenue numbers" },
  ]),
  knowledge: { id: "k-q3dashboard01", title: "Q3 revenue dashboard.pdf", status: "processing" },
};

async function say(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: /message/i });
  await box.fill(text);
  await box.press("Enter");
}
const sent = (m: Awaited<ReturnType<typeof mockBackend>>) =>
  m.calls.filter((c) => c.method === "POST" && c.path === "/messages").map((c) => (c.body as { text: string }).text);
const chip = (scope: ReturnType<Page["locator"]>, name: string) =>
  scope.getByRole("button", { name: new RegExp(`^${name}\\s*(Recommended)?$`) });

test("desktop: the skill panel shows the departments with Vice's picked; Add says the pick", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "make me a python skill");
  m.send(PYTHON);
  const side = page.getByRole("complementary", { name: "python" });
  // The panel keeps the room for the skill: one line, and Change opens the chips.
  await expect(side.locator(".dept-line")).toHaveText(/For Application, IT Infrastructure and Data & AI\s*Change/);
  await side.getByRole("button", { name: "Change" }).click();
  const dp = side.locator(".dept-pick");
  await expect(dp).toBeVisible();
  for (const n of ["Application", "IT Infrastructure", "Data & AI"]) {
    await expect(chip(dp, n)).toHaveAttribute("aria-pressed", "true");
    await expect(chip(dp, n)).toContainText("Recommended");
  }
  await expect(chip(dp, "Finance")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(dp, "Marketing")).not.toContainText("Recommended");
  await expect(dp).toContainText("IT Infrastructure (runs scripts)");
  // The chat card shows the same pick.
  await expect(chip(page.locator(".ask-card .dept-pick"), "Application")).toHaveAttribute("aria-pressed", "true");
  const r = await new AxeBuilder({ page }).include(".skill-side").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  // All, then Clear: Add waits for at least one department.
  await dp.getByRole("button", { name: "All departments" }).click();
  await expect(dp.locator('[aria-pressed="true"]')).toHaveCount(12);
  await dp.getByRole("button", { name: "Clear" }).click();
  await expect(dp.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(dp).toContainText("Pick at least one department.");
  await expect(side.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

  // Said in words: the city sends the new pick and the chips follow.
  m.send({
    type: "vaic.departments",
    conversation: "main",
    id: "chg-1",
    selected: PRESETS.map((p) => p.key).filter((k) => k !== "sales" && k !== "legal"),
  });
  await expect(dp.locator('[aria-pressed="true"]')).toHaveCount(10);
  await expect(chip(dp, "Sales")).toHaveAttribute("aria-pressed", "false");

  // A tap: just Finance and Data & AI, then Add says exactly that.
  await dp.getByRole("button", { name: "Clear" }).click();
  await chip(dp, "Finance").click();
  await chip(dp, "Data & AI").click();
  await side.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add for Data & AI and Finance");
  m.send({ type: "vaic.change", conversation: "main", id: "chg-1", saved: true });
  await expect(side.getByRole("status").first()).toContainText("Added for Data & AI and Finance");
});

test("all departments: Add says so", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "make me a python skill");
  m.send(PYTHON);
  const dp = page.locator(".ask-card .dept-pick"); // the chat card's chips: the panel shares the pick
  await dp.getByRole("button", { name: "All departments" }).click();
  await expect(page.locator(".skill-side .dept-line")).toContainText("For every department");
  await page.getByRole("complementary", { name: "python" }).getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add for all departments");
});

test("phone: a knowledge card picks Vice's departments, adds, then says when it's ready", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "add this to the knowledge base");
  m.send(DOC);
  const card = page.locator(".ask-card");
  await expect(card).toContainText("Add “Q3 revenue dashboard.pdf” as knowledge");
  await expect(card).toContainText("For these departments");
  await expect(chip(card, "Data & AI")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(card, "Finance")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(card, "Legal")).toHaveAttribute("aria-pressed", "false");
  await expect(card).toContainText("Finance (revenue numbers)");
  await expect(card).not.toContainText(/RAG|index|vector|graph|embedding/i);
  const box = await card.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBeTruthy(); // fits the phone
  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add for Data & AI and Finance");
  m.send({ type: "vaic.change", conversation: "main", id: "chg-9", saved: true });
  await expect(card.getByRole("status")).toHaveText(
    "Adding it as knowledge for Data & AI and Finance. It'll be ready in a minute or two.",
  );
  m.send({
    type: "knowledge.updated",
    id: "k-q3dashboard01",
    status: "ready",
    title: "Q3 revenue dashboard.pdf",
    scope: "relevant",
    kind: "document",
  });
  await expect(card.getByRole("status")).toHaveText("Ready. Data & AI and Finance can use it now.");
});

test("the Knowledge page changes which departments use a document", async ({ page }) => {
  const m = await mockBackend(page);
  m.knowledge.items.push({
    id: "k-budgetrules01",
    kind: "document",
    title: "Budget rules.pdf",
    scope: "relevant",
    status: "ready",
    created_at: "2026-11-12T10:00:00Z",
    updated_at: "2026-11-12T10:00:00Z",
  });
  await page.goto("/#/knowledge");
  const row = page.locator(".kitem", { hasText: "Budget rules.pdf" });
  await expect(row).toContainText("For every department");
  await row.getByRole("button", { name: "Change which departments use “Budget rules.pdf”" }).click();
  const dp = row.locator(".dept-pick");
  await expect(dp.locator('[aria-pressed="true"]')).toHaveCount(12); // every department, as now
  await dp.getByRole("button", { name: "Clear" }).click();
  await chip(dp, "Finance").click();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("For Finance");
  const put = m.calls.filter((c) => c.method === "PUT" && c.path === "/knowledge/k-budgetrules01").at(-1);
  expect(put?.body).toEqual({ departments: ["finance"] });
  // And back to every department.
  await row.getByRole("button", { name: "Change which departments use “Budget rules.pdf”" }).click();
  await row.locator(".dept-pick").getByRole("button", { name: "All departments" }).click();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("For every department");
  expect(m.calls.filter((c) => c.method === "PUT").at(-1)?.body).toEqual({ departments: "all" });
});

test("the Skills page changes which departments get a skill", async ({ page }) => {
  const m = await mockBackend(page);
  m.skills.push({
    name: "python",
    description: "Python scripts.",
    roles: ["vaic", "orchestrator", "manager", "worker"],
    enabled: true,
    version: "v1",
    files: [{ path: "SKILL.md", size: 10 }],
    size_bytes: 10,
    source: "upload",
    updated_at: "2026-11-12T10:00:00Z",
    departments: ["application", "infrastructure"],
  });
  await page.goto("/#/skills");
  const card = page.getByRole("article", { name: "Skill python" });
  await expect(card).toContainText("For Application and IT Infrastructure");
  await card.getByRole("button", { name: "Change which departments use “python”" }).click();
  await chip(card, "Data & AI").click();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toContainText("For Application, IT Infrastructure and Data & AI");
  expect(m.calls.filter((c) => c.method === "PUT" && c.path === "/skills/python").at(-1)?.body).toEqual({
    departments: ["application", "infrastructure", "data"],
  });
});

// Screenshots to look at (DEPT_SHOTS=<folder>): the cards and pages, light and dark, phone and desktop.
for (const theme of ["dark", "light"] as const)
  for (const [w, h, size] of [
    [1000, 760, "desktop"],
    [390, 844, "phone"],
  ] as const)
    test(`shots: ${theme} ${size}`, async ({ page }) => {
      test.skip(!SHOTS, "only when DEPT_SHOTS is set");
      await page.addInitScript((t) => localStorage.setItem("vaic.theme", t), theme);
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const m = await mockBackend(page);
      await page.goto("/#/vaic");
      await say(page, "make me a python skill");
      m.send(PYTHON);
      await expect(page.locator(".dept-pick").first()).toBeVisible();
      if (size === "phone") await page.locator(".ask-card").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/skill-${theme}-${size}.png` });
      if (size === "phone") {
        await page.getByRole("button", { name: "View skill" }).click();
        await page.locator(".skill-side").getByRole("button", { name: "Change" }).click();
        await page.locator(".skill-side .dept-pick").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/skill-sheet-${theme}-${size}.png` });
        await page.getByRole("button", { name: "Close the skill" }).click();
      }
      await say(page, "add this to the knowledge base");
      m.send(DOC);
      await page.locator(".ask-card").last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/knowledge-card-${theme}-${size}.png` });
      m.knowledge.items.push({
        id: "k-budgetrules01",
        kind: "document",
        title: "Budget rules.pdf",
        scope: "relevant",
        status: "ready",
        departments: ["finance", "data"],
        created_at: "2026-11-12T10:00:00Z",
        updated_at: "2026-11-12T10:00:00Z",
      });
      await page.goto("/#/knowledge");
      const row = page.locator(".kitem", { hasText: "Budget rules.pdf" });
      await row.getByRole("button", { name: /Change which departments/ }).click();
      await row.locator(".dept-pick").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/knowledge-page-${theme}-${size}.png` });
    });
