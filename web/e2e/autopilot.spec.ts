// Autopilot, against the mocked backend: there is no Needs you tab and nothing nags; VAIC's screen opens with
// "While you were away" after more than 12 hours away (and from the clock any time) with one button per thing only
// the owner can do; the Chief of Staff's decisions are under Work → "Decided for you"; Settings → While I'm away
// holds the Autopilot switch, the standing orders and the open items from before. A backend without these routes
// (404) shows none of it. Screenshots go to docs/screenshots/.
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
/** The owner was last here `hours` ago on this device. */
const awayFor = (page: Page, hours: number) =>
  page.addInitScript((h) => localStorage.setItem("aic.lastSeen", String(Date.now() - h * 3600_000)), hours);

async function setup(page: Page): Promise<Mock> {
  const m = await mockBackend(page, {
    snapshot: {
      questions: [
        question("q-open", "Which database should the demo use?"),
        // Decided already but still in the snapshot: never counted as open.
        question("q-old", "Use tabs or spaces?", { decided_by: "chief_of_staff", decision: "Spaces" }),
      ],
    },
  });
  m.settings.autopilot = true;
  m.chief = {
    enabled: true,
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
    ],
    needs_owner: [{ id: "q-open", title: "Which database", why: "Only you know which one you pay for." }],
  };
  m.away = {
    since: ago(60),
    jobs_finished: [{ id: "j1", name: "Build the landing page" }, { id: "j2", name: "Fix the login bug" }],
    jobs_running: [{ id: "j3", name: "Write the launch post" }],
    decided: 14,
    handled_by_standing_orders: [
      { source: "jira", item: "SUP-12", summary: "Customer Support answered 6 new Jira tickets", at: ago(3) },
    ],
    when_youre_back: [
      { id: "wb-1", title: "Slack sign-in expired", why: "Slack needs you to sign in again.", service: "slack" },
      { id: "wb-2", title: "HeyGen key", why: "HeyGen needs a new API key.", service: "heygen" },
    ],
  };
  m.orders = [
    {
      id: "so-1",
      source: "jira",
      what: "new Jira tickets",
      department: "Customer Support",
      every_minutes: 15,
      enabled: true,
    },
    {
      id: "so-2",
      source: "slack",
      instructions: "Answer questions in #help; hand bugs to Engineering",
      department: "Engineering",
      every_minutes: 60,
      enabled: false,
    },
  ];
  return m;
}

test("back after two days: VAIC opens with While you were away, calm, with one button per thing only you can do", async ({
  page,
}) => {
  const m = await setup(page);
  await awayFor(page, 48);
  await page.goto("/");
  const panel = page.getByRole("region", { name: "While you were away" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Build the landing page");
  await expect(panel).toContainText("Write the launch post");
  await expect(panel).toContainText("The Chief of Staff made 14 decisions for you.");
  await expect(panel).toContainText("Customer Support answered 6 new Jira tickets");
  await expect(panel.getByText("Slack needs you to sign in again.")).toBeVisible();
  // No tab, no badge, no counts that nag.
  await expect(page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: /Needs you/ })).toHaveCount(0);
  await expect(page.locator(".badge")).toHaveCount(0);
  await expect(page.getByText(/things? needs? you/)).toHaveCount(0);
  await noSeriousA11y(page, "While you were away");
  await shot(page, "away-panel");
  expect(m.calls.find((c) => c.path.startsWith("/away-summary"))?.path).toMatch(/since=/);

  // One button does it: Slack's sign-in starts; the key goes to Connectors.
  const popup = page.waitForEvent("popup");
  await panel.getByRole("button", { name: "Sign in to Slack" }).click();
  await (await popup).close();
  await expect.poll(() => m.calls.some((c) => c.method === "POST" && c.path === "/connectors/slack/login")).toBe(true);
  await expect(panel.getByRole("link", { name: "Add the key for Heygen" })).toHaveAttribute("href", "#/settings/connectors");

  // The decisions are under Work.
  await panel.getByRole("link", { name: "See what it decided" }).click();
  await expect(page).toHaveURL(/#\/tickets\/decided$/);
  await expect(page.getByRole("tab", { name: "Decided for you" })).toHaveAttribute("aria-selected", "true");
});

test("here an hour ago: no panel by itself, but the clock opens it; Close hides it", async ({ page }) => {
  await setup(page);
  await awayFor(page, 1);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Talk to VAIC" })).toBeAttached();
  await expect(page.getByRole("region", { name: "While you were away" })).toHaveCount(0);
  await page.getByRole("button", { name: "While you were away" }).click();
  const panel = page.getByRole("region", { name: "While you were away" });
  await expect(panel).toContainText("Fix the login bug");
  await panel.getByRole("button", { name: "Close While you were away" }).click();
  await expect(panel).toHaveCount(0);
});

test("Work → Decided for you: newest first, expandable, and a live decision lands on top", async ({ page }) => {
  const m = await setup(page);
  await page.goto("/#/tickets/decided");
  const rows = page.getByRole("region", { name: "Decided for you" }).locator("details");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Run the test suite on its work computer");
  await expect(rows.nth(0)).toContainText("It said: Approved");
  await expect(rows.nth(0)).toContainText("2 h ago · Engineering");
  await rows.nth(1).locator("summary").click();
  await expect(rows.nth(1).getByText("Why: The project's style guide already uses spaces.")).toBeVisible();
  // The backend's order: it answers through the same code as the owner's buttons, then says what it decided.
  m.send({ type: "question.answered", id: "q-open", answered_by: "chief_of_staff", answer: "SQLite" });
  m.send({ type: "steward.decided", id: "q-open", kind: "question", choice: "SQLite", reason: "Simplest for a demo." });
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Which database should the demo use?");
  await expect(rows.first()).toContainText("It chose: SQLite");
  await noSeriousA11y(page, "Work: Decided for you");
});

test("Settings → While I'm away: Autopilot, standing orders in plain words, and the open items from before", async ({
  page,
}) => {
  const m = await setup(page);
  await page.goto("/#/settings/away");
  await expect(page.getByRole("heading", { name: "While I'm away", level: 1 })).toBeVisible();
  const sw = page.getByRole("switch", { name: "Autopilot on or off" });
  await expect(sw).toBeChecked();
  const cards = page.locator(".card.order");
  await expect(cards.nth(0)).toContainText("Every 15 minutes, Customer Support handles new Jira tickets.");
  await expect(cards.nth(1)).toContainText("Every hour, Engineering handles new Slack messages.");
  await noSeriousA11y(page, "While I'm away");
  await shot(page, "settings-away");

  await sw.uncheck({ force: true });
  await expect.poll(() => m.settings.autopilot).toBe(false);
  await expect(page.getByText("Off: your team's questions and approvals wait for you.")).toBeVisible();
  await sw.check({ force: true });
  await expect.poll(() => m.settings.autopilot).toBe(true);

  await page.getByRole("switch", { name: /Engineering handles new Slack messages\. On or off/ }).check({ force: true });
  await expect.poll(() => m.orders?.find((o) => o.id === "so-2")?.enabled).toBe(true);
  await page.getByRole("button", { name: /^Delete: Every 15 minutes/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(cards).toHaveCount(1);
  expect(m.orders?.map((o) => o.id)).toEqual(["so-2"]);

  // The open item from before is still reachable, with the Chief of Staff's reason on top.
  await page.getByRole("link", { name: /Open items/ }).click();
  await expect(page).toHaveURL(/#\/settings\/open-items$/);
  const item = page.getByRole("article").filter({ hasText: "Which database should the demo use?" });
  await expect(item.locator(".cos-why")).toHaveText("Chief of Staff: Only you know which one you pay for.");
  await expect(page.getByText("Use tabs or spaces?")).toHaveCount(0); // already decided
  await page.getByRole("link", { name: "‹ While I'm away" }).click();
  await expect(page).toHaveURL(/#\/settings\/away$/);

  // Add opens VAIC's chat with the words started.
  await page.getByRole("button", { name: "Add a standing order" }).click();
  await expect(page.getByRole("textbox", { name: /message/i })).toHaveValue("While I'm away, ");
});

test("on a phone the panel and the standing orders fit the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await awayFor(page, 48);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "While you were away" })).toBeVisible();
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await wide()).toBe(false);
  await noSeriousA11y(page, "While you were away on a phone");
  await shot(page, "phone-away-panel");
  await page.goto("/#/settings/away");
  await expect(page.locator(".card.order").first()).toBeVisible();
  expect(await wide()).toBe(false);
});

test("light appearance reads well", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aic.theme", "light"));
  await setup(page);
  await awayFor(page, 48);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "While you were away" })).toBeVisible();
  await noSeriousA11y(page, "While you were away in light appearance");
  await shot(page, "away-panel-light");
});

test("without these routes on the backend (404) nothing about them shows and nothing breaks", async ({ page }) => {
  await mockBackend(page);
  await awayFor(page, 48);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Talk to VAIC" })).toBeAttached();
  await expect(page.getByRole("button", { name: "While you were away" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "While you were away" })).toHaveCount(0);
  await page.goto("/#/tickets/decided");
  await expect(page.getByText(/Nothing decided yet/)).toBeVisible();
  await page.goto("/#/settings/away");
  await expect(page.getByText(/No standing orders yet/)).toBeVisible();
  await expect(page.getByRole("switch", { name: "Autopilot on or off" })).toBeChecked(); // default on
});
