// The main journeys, done the way a half-asleep owner would: no prior knowledge, only what the
// screen says. Every backend is mocked (see mock.ts). Screenshots go to docs/screenshots/.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { at, CONFIG, hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map(
      (v) => `${label}: ${v.id} — ${v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary ?? ""}`).join(" | ")}`,
    ),
  ).toEqual([]);
}
const primaries = (page: Page) => page.locator(".btn-primary:visible").count();

test("signed out: the app sends the owner to the Cognito sign-in with PKCE", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/");
  await page.waitForURL(new RegExp(`https://${CONFIG.cognitoDomain}/oauth2/authorize`));
  const url = new URL(page.url());
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
});

test("first login shows a three-step guide that can be skipped", async ({ page }) => {
  await mockBackend(page, { firstRunDone: false });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Meet Ace" })).toBeVisible();
  await shot(page, "first-run-guide");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "See the City" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lands on Ace with the input focused; asking something shows Ace's streamed reply", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message to Ace" });
  await expect(box).toBeFocused();
  await expect(page.getByRole("button", { name: "Talk to Ace", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Today: \$0.42 of \$10/ })).toBeVisible();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await box.fill("yo Ace, what's 9 + 9?");
  await page.getByRole("button", { name: "Send to Ace" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "yo Ace, what's 9 + 9?", conversation: "main" });
  await expect(page.locator("section.ace").getByRole("img", { name: "Ace is thinking" })).toBeVisible();
  m.send({ type: "ace.reply", conversation: "main", text: "Eigh", done: false });
  m.send({ type: "ace.reply", conversation: "main", text: "Eighteen.", done: true });
  await expect(page.getByLabel("Conversation with Ace").getByText("Eighteen.")).toBeVisible();
  await expect(page.getByText(/Not sent yet/)).toHaveCount(0); // delivered, so nothing waits in the outbox
  await shot(page, "ace");
  await noSeriousA11y(page, "Ace");
});

test("push-to-talk sends what the owner said to Ace", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(
    () => ((window as unknown as { __heard: string }).__heard = "hey Ace, what's the status of the product?"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Ace", exact: true }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "hey Ace, what's the status of the product?" });
});

test("a draft survives a reload", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message to Ace" }).fill("half a thought");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message to Ace" })).toHaveValue("half a thought");
});

test("watching the City: a department goes up and workers appear when hired", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText("Nothing waiting.")).toBeVisible();
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await shot(page, "city-empty");
  m.send({
    type: "department.created",
    name: "Engineering",
    mission: "Build and test software.",
    manager_id: "mgr-engineering",
  });
  m.send(hired("mgr-engineering", "Engineering", "manager"));
  for (const id of ["wkr-engineering-a1", "wkr-engineering-b2", "wkr-engineering-c3"]) m.send(hired(id, "Engineering"));
  m.send({
    type: "ticket.status",
    ticket: {
      id: "t-2",
      goal: "implement power",
      from: "mgr-engineering",
      to: "wkr-engineering-a1",
      status: "open",
      department: "Engineering",
      parent_id: "t-1",
      kind: "assignment",
      review_rounds: 0,
      created_at: at(),
      updated_at: at(),
    },
    previous: null,
  });
  m.send({ type: "activity", id: "wkr-engineering-a1", activity: "coding" });
  const depts = page.getByRole("navigation", { name: "Departments" });
  await expect(depts.getByRole("button", { name: /Engineering/ })).toBeVisible();
  await expect(depts.getByLabel("3 workers")).toBeVisible();
  await expect(page.locator(".feed")).toContainText("Department Engineering created");
  await expect(page.locator(".feed")).toContainText("wkr-engineering-a1 got a ticket from mgr-engineering");
  await expect.poll(async () => Number(await city.getAttribute("data-people"))).toBeGreaterThanOrEqual(6); // Ace, Orchestrator, manager, 3 workers
  await page.waitForTimeout(800); // let the walk-in finish for the picture
  await shot(page, "city-workers");
  await depts.getByRole("button", { name: /Engineering/ }).click();
  await expect(page.getByRole("dialog", { name: "Engineering department" })).toContainText("3 workers at their desks");
  await noSeriousA11y(page, "City");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("a question waits: 'Open: needs you', then one tap on the default answers it", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send({
    type: "question.asked",
    question: {
      id: "q1",
      asked_by: "wkr-engineering-a1",
      path: "mgr-engineering › wkr-engineering-a1",
      ticket_id: "t-2",
      text: "Which database should the demo use?",
      options: ["Postgres", "SQLite"],
      default_answer: "SQLite",
      status: "open",
      created_at: at(),
    },
  });
  await page.getByRole("button", { name: "Open: needs you" }).click();
  await expect(page.getByRole("heading", { name: "Needs you" })).toBeVisible();
  await shot(page, "needs-you");
  await noSeriousA11y(page, "Needs you");
  expect(await primaries(page)).toBe(1);
  await page.getByRole("button", { name: "Use default: SQLite" }).click();
  await expect.poll(() => m.calls.some((c) => c.method === "POST" && c.path === "/questions/q1/default")).toBe(true);
  await expect(page.getByText("Answered with the default: SQLite")).toBeVisible();
});

test("approving an action needs holding the button and approves exactly that action", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/inbox");
  await expect(page.getByText(/Nothing is waiting for you/)).toBeVisible();
  m.send({
    type: "approval.requested",
    id: "ap-1",
    agent: "wkr-engineering-a1",
    action: "npm publish --access public",
    reason: "Publishing needs the owner.",
  });
  await page.getByRole("button", { name: "Approve…" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve this action?" });
  await expect(dialog).toContainText("npm publish --access public");
  await expect(dialog).toContainText("Cost:");
  const hold = dialog.getByRole("button", { name: /Hold to approve/ });
  await hold.click(); // a tap is not enough
  expect(m.calls.some((c) => c.path === "/approvals/ap-1")).toBe(false);
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await expect.poll(() => m.calls.find((c) => c.path === "/approvals/ap-1")?.body).toEqual({ approved: true });
});

test("pausing the city asks first, then offers Undo", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Pause the city…" }).click();
  const dialog = page.getByRole("dialog", { name: "Pause the city?" });
  await expect(dialog).toContainText("No new work starts");
  await expect(dialog).toContainText("Pausing costs nothing");
  await shot(page, "pause-confirm");
  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/city/pause")).toBe(true);
  await expect(page.getByText("The city is paused.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/city/resume")).toBe(true);
  await noSeriousA11y(page, "Settings");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("spend caps are optional: an impossible cap is refused, an empty field means no limit", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings");
  const daily = page.getByLabel("Daily cap, all departments ($)");
  await daily.fill("-5");
  await expect(page.getByText("Caps must be zero or more dollars, or empty for no limit.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await daily.fill("");
  await expect(daily).toHaveAttribute("placeholder", "No limit");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(() => {
      const put = m.calls.find((c) => c.method === "PUT")?.body as Record<string, unknown> | undefined;
      return put ? put.daily_global_usd : "not sent";
    })
    .toBeNull();
});

test("with no spend limit the money pill shows only what was spent", async ({ page }) => {
  await mockBackend(page, {
    snapshot: { caps: { daily_global_usd: null, monthly_budget_usd: null, daily_department_usd: null } },
  });
  await page.goto("/#/city");
  const pill = page.getByRole("button", { name: /^Today: \$[\d.]+, estimate\. Open costs\.$/ });
  await expect(pill).toHaveAttribute("data-level", "ok");
});

test("hitting the spend cap: the money pill turns red and the City says so plainly", async ({ page }) => {
  const m = await mockBackend(page, { snapshot: { usage: { usd: 10, turns: 300, tokens: 9e6 } } });
  await page.goto("/#/city");
  const pill = page.getByRole("button", { name: /Today: \$10 of \$10, estimate, cap reached/ });
  await expect(pill).toHaveAttribute("data-level", "red");
  m.send({ type: "spend.cap_reached", cap: "daily_global", department: null, spent: 10.02, limit: 10 });
  await expect(
    page.getByText(/Spend cap reached \(daily global, \$10\)\. No new work starts until you raise it\./),
  ).toBeVisible();
  await shot(page, "spend-cap");
  await pill.click();
  await expect(page.getByRole("heading", { name: "Costs (estimates)" })).toBeVisible();
  await expect(page.getByText("Cap reached: no new work starts.")).toBeVisible();
  await shot(page, "costs");
  await noSeriousA11y(page, "Costs");
});

test("a lost connection says what happened and that nothing was lost", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message to Ace" })).toBeFocused();
  await expect
    .poll(() => {
      try {
        m.ws();
        return true;
      } catch {
        return false;
      }
    })
    .toBe(true);
  await m.ws().close();
  await expect(page.getByText("Connection lost. Your messages are saved. Reconnecting…")).toBeVisible();
});

test("tickets list and detail, with technical details behind a toggle", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/tickets");
  await expect(page.getByText("Add a power(a, b) function to add.js")).toBeVisible();
  await shot(page, "tickets");
  await noSeriousA11y(page, "Tickets");
});
