// The Chief of Staff on Needs you, against the mocked backend: the calm card with its switch and weekly count,
// "Decided for you" (newest first, expandable), the item it left to the owner with its reason on top, the badge that
// counts only what still waits for the owner, the live `steward.decided` event, the phone layout, and a backend
// without a Chief of Staff (404: nothing about it shows). Screenshots go to docs/screenshots/.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { at, mockBackend, type Mock } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const question = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id,
  asked_by: "wkr-engineering-a1",
  path: "mgr-engineering › wkr-engineering-a1",
  text,
  options: ["Postgres", "SQLite"],
  default_answer: "SQLite",
  status: "open",
  created_at: at(),
  ...extra,
});
const badge = (page: Page) => page.getByRole("link", { name: /Needs you/ }).first();

async function setup(page: Page, enabled = true): Promise<Mock> {
  const m = await mockBackend(page, {
    snapshot: {
      questions: [
        question("q-open", "Which database should the demo use?"),
        question("q-key", "Paste the Stripe key so I can take payments?", { needs_owner_reason: "" }),
        // Decided already but still in the snapshot: never counted.
        question("q-old", "Use tabs or spaces?", { decided_by: "chief_of_staff", decision: "Spaces" }),
      ],
    },
  });
  m.chief = {
    enabled,
    decided: [
      {
        id: "q-old",
        kind: "question",
        title: "Use tabs or spaces?",
        choice: "Spaces",
        reason: "The project's style guide already uses spaces.",
        at: ago(30),
        department: "Engineering",
      },
      {
        id: "a-9",
        kind: "approval",
        title: "Run the test suite on its work computer",
        choice: "Approved",
        reason: "Running tests changes nothing and costs almost nothing.",
        at: ago(2),
        department: "Engineering",
      },
      {
        id: "q-ancient",
        kind: "question",
        title: "Name the repo",
        choice: "ai-city",
        reason: "Short and matches the product.",
        at: ago(24 * 10),
        department: "Engineering",
      },
    ],
    needs_owner: [{ id: "q-key", title: "Paste the Stripe key", why: "Only you can paste a payment key." }],
  };
  return m;
}

test("Needs you shows the Chief of Staff, what it decided, and what still needs the owner", async ({ page }) => {
  await setup(page);
  await page.goto("/#/inbox");
  const card = page.getByRole("region", { name: "Chief of Staff is handling these" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Decided 2 things in the last 7 days."); // the 10-day-old one is not counted
  await expect(card.getByRole("switch", { name: "Chief of Staff on or off" })).toBeChecked();

  // The open list: only what waits for the owner; the badge agrees.
  await expect(page.getByText("2 things need you")).toBeVisible();
  await expect(badge(page)).toContainText("2");
  const key = page.getByRole("article").filter({ hasText: "Paste the Stripe key" });
  await expect(key.locator(".cos-why")).toHaveText("Chief of Staff: Only you can paste a payment key.");

  // Decided for you: newest first, each expandable.
  const decided = page.getByRole("region", { name: "Decided for you" });
  const rows = decided.locator("details");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Run the test suite on its work computer");
  await expect(rows.nth(0)).toContainText("It said: Approved");
  await expect(rows.nth(0)).toContainText("2 h ago · Engineering");
  await expect(rows.nth(1)).toContainText("It chose: Spaces");
  await expect(page.locator(".card.need").filter({ hasText: "Use tabs or spaces?" })).toHaveCount(0);
  await rows.nth(1).locator("summary").click();
  await expect(rows.nth(1).getByText("Why: The project's style guide already uses spaces.")).toBeVisible();
  await expect(rows.nth(1)).toContainText("tell AIC what to do instead");

  await card.getByRole("link", { name: "See what it decided" }).click();
  await expect(decided.getByRole("heading", { name: "Decided for you" })).toBeFocused();
  await noSeriousA11y(page, "Needs you with the Chief of Staff");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "needs-you-chief");
});

test("the switch turns the Chief of Staff off and on through settings", async ({ page }) => {
  const m = await setup(page);
  await page.goto("/#/inbox");
  const sw = page.getByRole("switch", { name: "Chief of Staff on or off" });
  await sw.uncheck({ force: true });
  await expect(page.getByRole("heading", { name: "Chief of Staff is off" })).toBeVisible();
  await expect(page.getByText("Everything waits here for you.", { exact: false }).first()).toBeVisible();
  await expect
    .poll(() => m.calls.filter((c) => c.method === "PUT" && c.path === "/settings").map((c) => c.body))
    .toEqual([{ chief_of_staff_enabled: false }]);
  expect(m.chief?.enabled).toBe(false);
  await sw.check({ force: true });
  await expect(page.getByRole("heading", { name: "Chief of Staff is handling these" })).toBeVisible();
  await expect.poll(() => m.chief?.enabled).toBe(true);
});

test("a decision arriving live moves the item into Decided for you and the badge drops", async ({ page }) => {
  const m = await setup(page);
  await page.goto("/#/inbox");
  await expect(badge(page)).toContainText("2");
  // The backend's order: it answers through the same code as the owner's buttons, then says what it decided.
  m.send({ type: "question.answered", id: "q-open", answered_by: "chief_of_staff", answer: "SQLite" });
  m.send({ type: "steward.decided", id: "q-open", kind: "question", choice: "SQLite", reason: "Simplest for a demo." });
  await expect(page.locator(".card.need").filter({ hasText: "Which database should the demo use?" })).toHaveCount(0);
  const first = page.getByRole("region", { name: "Decided for you" }).locator("details").first();
  await expect(first).toContainText("Which database should the demo use?"); // the title came from the open item
  await expect(first).toContainText("It chose: SQLite");
  await expect(first).toContainText("Simplest for a demo.");
  await expect(page.getByText("1 thing needs you")).toBeVisible();
  await expect(badge(page)).toContainText("1");
  await expect(page.getByRole("region", { name: "Chief of Staff is handling these" })).toContainText(
    "Decided 3 things in the last 7 days.",
  );
});

test("on a phone the card and the decided list fit the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/#/inbox");
  await expect(page.getByRole("heading", { name: "Chief of Staff is handling these" })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(wide).toBe(false);
  await noSeriousA11y(page, "Needs you on a phone");
  await shot(page, "phone-needs-you-chief");
});

test("light appearance reads well", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aic.theme", "light"));
  await setup(page);
  await page.goto("/#/inbox");
  await expect(page.getByRole("heading", { name: "Chief of Staff is handling these" })).toBeVisible();
  await noSeriousA11y(page, "Needs you in light appearance");
  await shot(page, "needs-you-chief-light");
});

test("without a Chief of Staff on the backend (404) Needs you looks as before", async ({ page }) => {
  await mockBackend(page, { snapshot: { questions: [question("q-open", "Which database should the demo use?")] } });
  await page.goto("/#/inbox");
  await expect(page.getByText("1 thing needs you")).toBeVisible();
  await expect(page.getByText(/Chief of Staff/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Decided for you" })).toHaveCount(0);
});
