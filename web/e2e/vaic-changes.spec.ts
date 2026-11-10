// The owner changes anything from VAIC's chat (decision 206): VAIC stages the change and shows what will change with
// Yes / No; a tap (or typed words) answers; the card says Saved and Settings shows the new value. A skill: several
// matches as choices, then its card with Add.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

async function say(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: /message/i });
  await box.fill(text);
  await box.press("Enter");
}
const sent = (m: Awaited<ReturnType<typeof mockBackend>>) =>
  m.calls.filter((c) => c.method === "POST" && c.path === "/messages").map((c) => (c.body as { text: string }).text);

test("a limit changed from the chat is saved only after Yes and shows in Settings", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "set workers per manager's team to 65 and new workers per second to 2");
  m.send({
    type: "vaic.question",
    conversation: "main",
    question: "Do you want to save these changes?",
    options: ["Yes", "No"],
    id: "chg-1",
    title: "Settings → Limits & spending",
    lines: ["Workers per goal (one manager's team): 3 → 65", "New workers per second: 1 → 2"],
  });
  m.send({ type: "vaic.reply", conversation: "main", text: "Workers per goal to 65 and 2 a second, Sir.", done: true });
  const card = page.getByRole("group", { name: "Settings → Limits & spending" });
  await expect(card).toContainText("3 → 65");
  await expect(card).toContainText("Do you want to save these changes?");
  const r = await new AxeBuilder({ page }).include(".ask-card").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await card.getByRole("button", { name: "Yes" }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Yes");
  await expect(card.getByRole("button", { name: "Yes" })).toHaveCount(0);
  // VAIC's save_change: the city saves it and says so.
  Object.assign(m.settings, { max_workers_per_goal: 65, max_new_sessions_per_second: 2 });
  m.send({ type: "vaic.change", conversation: "main", id: "chg-1", saved: true });
  await expect(card.getByRole("status")).toHaveText("Saved.");

  await page.goto("/#/settings/limits");
  await expect(page.getByLabel("Per goal (one manager's team)")).toHaveValue("65");
  await expect(page.getByLabel("New workers per second (max 25)")).toHaveValue("2");
});

test("No leaves everything as it was", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "turn autopilot off");
  m.send({
    type: "vaic.question",
    conversation: "main",
    question: "Do you want to save these changes?",
    options: ["Yes", "No"],
    id: "chg-2",
    title: "Settings → General",
    lines: ["Autopilot: on → off"],
  });
  const card = page.getByRole("group", { name: "Settings → General" });
  await card.getByRole("button", { name: "No" }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("No");
  m.send({ type: "vaic.change", conversation: "main", id: "chg-2", saved: false });
  await expect(card.getByRole("status")).toHaveText("Not saved: nothing changed.");
});

test("add a skill: several fit, pick one, its card with Add", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "add a skill for release");
  m.send({
    type: "vaic.question",
    conversation: "main",
    question: "Which skill do you mean?",
    options: ["Release notes", "Press release"],
  });
  const pick = page.getByRole("group", { name: "Which skill do you mean?" });
  await pick.getByRole("button", { name: "Release notes" }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Release notes");
  await expect(pick).toHaveCount(0);

  m.send({
    type: "vaic.question",
    conversation: "main",
    question: "Add this skill?",
    options: ["Add", "Not now"],
    id: "chg-3",
    title: "Add the skill Release notes",
    lines: ["Writes release notes from merged changes."],
    detail: "AI City catalog (Product, Application) For every role.",
  });
  const card = page.getByRole("group", { name: "Add the skill Release notes" });
  await expect(card).toContainText("Writes release notes");
  await expect(card.getByRole("button", { name: "Not now" })).toBeVisible();
  await card.getByRole("button", { name: "Add" }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add");
  m.send({ type: "vaic.change", conversation: "main", id: "chg-3", saved: true });
  await expect(card.getByRole("status")).toHaveText("Saved.");
});
