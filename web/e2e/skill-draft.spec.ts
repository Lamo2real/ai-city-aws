// A skill VAIC wrote (decision 257): on a wide screen the chat narrows to the left and the SKILL.md opens on the
// right with Add; at phone width the card shows an excerpt and "View skill" opens a full-screen sheet. A re-draft
// updates the panel; Add saves and the panel says so.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = process.env.SKILL_SHOTS;
const md = (body: string) =>
  `---\nname: "code-animation"\ndescription: "Silent code-made videos for Media: 1 to 2 second intense scenes."\n---\n\n# Code animation\n\n${body}\n`;
const BODY = [
  "Make silent videos from code, where every scene runs **1 to 2 seconds** and stays intense.",
  "",
  "## Steps",
  "1. Ask *Video production* for the storyboard.",
  "2. Build each scene in code; no voice-over, no music.",
  "3. Cut on motion, never hold a frame longer than 2 seconds.",
  "",
  "## Rules",
  "- Keep it engaging for the viewer from the first frame.",
  "- Export at 1080×1920 for Reels and Shorts.",
].join("\n");
function draft(id: string, body: string) {
  return {
    type: "vaic.question",
    conversation: "main",
    question: "Add this skill?",
    options: ["Add", "Not now"],
    id,
    title: "Add the skill code-animation",
    lines: ["Silent code-made videos for Media: 1 to 2 second intense scenes."],
    detail: "For every role.",
    skill: {
      name: "code-animation",
      description: "Silent code-made videos for Media: 1 to 2 second intense scenes.",
      markdown: md(body),
      files: [],
      replacing: false,
    },
  };
}
async function say(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: /message/i });
  await box.fill(text);
  await box.press("Enter");
}
const sent = (m: Awaited<ReturnType<typeof mockBackend>>) =>
  m.calls.filter((c) => c.method === "POST" && c.path === "/messages").map((c) => (c.body as { text: string }).text);

test("desktop: the skill opens beside the chat, a re-draft updates it, Add saves", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 }); // the owner's Mac window
  await page.emulateMedia({ reducedMotion: "reduce" }); // axe reads the colours after the slide-in, not during it
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "add a code animation skill for Media, 1 to 2 second intense scenes");
  m.send(draft("chg-1", BODY));
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "It's written, Sir: silent 1 to 2 second scenes. Add this skill?",
    done: true,
  });
  const side = page.getByRole("complementary", { name: "code-animation" });
  await expect(side.getByRole("heading", { name: "Code animation" })).toBeVisible();
  await expect(side.getByRole("heading", { name: "Steps" })).toBeVisible();
  await expect(side.locator("strong", { hasText: "1 to 2 seconds" })).toBeVisible();
  // The chat narrowed to the left; the panel is on the right.
  const chat = await page.locator(".talk").boundingBox();
  const panel = await side.boundingBox();
  expect(chat && panel && chat.x + chat.width <= panel.x).toBeTruthy();
  const r = await new AxeBuilder({ page }).include(".skill-side").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/skill-side.png` });

  await side.getByRole("tab", { name: "Markdown" }).click();
  await expect(side.locator(".skill-raw")).toContainText('name: "code-animation"');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/skill-side-raw.png` });
  await side.getByRole("tab", { name: "Preview" }).click();

  // The owner asks for a change: VAIC re-drafts and the panel follows.
  await say(page, "make the scenes 1 second only");
  m.send(draft("chg-2", "Every scene runs exactly **1 second**."));
  await expect(side).toContainText("exactly 1 second");
  await expect(side).not.toContainText("Video production");

  await side.getByRole("button", { name: "Add" }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add");
  m.skills.push({
    name: "code-animation",
    description: "Silent code-made videos.",
    roles: ["vaic", "orchestrator", "manager", "worker"],
    enabled: true,
    version: "v1",
    files: [{ path: "SKILL.md", size: 100 }],
    size_bytes: 100,
    source: "upload",
  });
  m.send({ type: "vaic.change", conversation: "main", id: "chg-2", saved: true });
  await expect(side.getByRole("status")).toContainText("Added. It's on the Skills page");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/skill-side-added.png` });
  await expect(side).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".vaic.has-skill")).toHaveCount(0);
  await page.goto("/#/skills");
  await expect(page.getByText("code-animation").first()).toBeVisible();
});

test("× closes the panel and View skill brings it back", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "write me a skill for code animations");
  m.send(draft("chg-5", BODY));
  const side = page.getByRole("complementary", { name: "code-animation" });
  await side.getByRole("button", { name: "Close the skill" }).click();
  await expect(side).toHaveCount(0);
  await page
    .getByRole("group", { name: "Add the skill code-animation" })
    .getByRole("button", { name: "View skill" })
    .click();
  await expect(side).toBeVisible();
});

test("phone width: an excerpt in the chat, View skill opens a sheet with Add at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await say(page, "add a code animation skill for Media");
  m.send(draft("chg-3", BODY));
  const card = page.getByRole("group", { name: "Add the skill code-animation" });
  await expect(card).toContainText("Code animation · Make silent videos from code, where every scene runs 1 to 2 seconds");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/skill-phone-card.png` });
  await card.getByRole("button", { name: "View skill" }).click();
  const sheet = page.getByRole("dialog", { name: "code-animation" });
  await expect(sheet.getByRole("heading", { name: "Rules" })).toBeVisible();
  const add = sheet.getByRole("button", { name: "Add" });
  await expect(add).toBeInViewport();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/skill-phone-sheet.png` });
  await add.click();
  await expect.poll(() => sent(m).at(-1)).toBe("Add");
  m.send({ type: "vaic.change", conversation: "main", id: "chg-3", saved: true });
  await expect(sheet.getByRole("status")).toContainText("Added.");
});
