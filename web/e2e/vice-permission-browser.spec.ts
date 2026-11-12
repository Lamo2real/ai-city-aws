// VAIC asks before it uses a connector, and shows its browser live (decision 265). The card: "Vice wants to use …
// from …" with the service list, the inputs, the description, and Decline / Allow once / Always allow (and their
// keys). The browser: "Using the browser (N actions)", a live view with the pointer, then "Used the browser" with
// thumbnails and the step list; a larger view. Settings lists what VAIC uses without asking.
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
const lastLine = async (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("vaic.chat") ?? "[]") as { id: string; who: string }[]).at(-1));

const PERMISSION = {
  title: "Transcribe Audio or Video",
  tool: "transcribe_audio_video",
  connector: "descript",
  label: "Descript",
  inputs: [
    ["Url", "https://www.youtube.com/watch?v=-jFLIQSVA1c"],
    ["Format", "txt"],
    ["Timecodes on paragraphs", "true"],
  ],
  description:
    "Transcribe one audio or video recording from a URL or conversation attachment into text, with optional speaker " +
    "labels and timestamps. Use for requests such as transcribing a meeting, lecture, interview, podcast, or video. " +
    "Accepts direct media URLs, YouTube links and files you uploaded to Descript.",
  params: ["format", "include_speaker_labels", "timecodes", "url", "language", "attachment"],
  schema: JSON.stringify({ type: "object", properties: { url: { type: "string" }, format: { type: "string" } } }),
  choices: [
    { id: "descript", label: "Descript", tool: "transcribe_audio_video" },
    { id: "riverside", label: "Riverside", tool: "transcribe_media" },
  ],
};

async function ask(page: Page, m: Awaited<ReturnType<typeof mockBackend>>, id = "perm-1") {
  await say(page, "transcribe this https://www.youtube.com/watch?v=-jFLIQSVA1c");
  m.send({
    type: "vaic.question",
    conversation: "main",
    question: "Vice wants to use Transcribe Audio or Video from Descript",
    options: ["Allow once", "Always allow", "Decline"],
    id,
    title: PERMISSION.title,
    permission: PERMISSION,
  });
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "Bet, I'll grab the transcript with Descript.",
    done: true,
  });
  return page.getByRole("group", { name: "Vice wants to use Transcribe Audio or Video" });
}

test("the permission card shows the call and Allow once sends the answer", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const card = await ask(page, m);
  await expect(card).toContainText("Vice wants to use");
  await expect(card).toContainText("https://www.youtube.com/watch?v=-jFLIQSVA1c");
  await expect(card).toContainText("Timecodes on paragraphs");
  await expect(card.getByRole("button", { name: "Show more" })).toBeVisible();
  await card.getByRole("button", { name: /Takes 6 inputs/ }).click();
  await card.getByRole("button", { name: /The whole schema/ }).click();
  await expect(card.locator(".perm-schema")).toContainText('"properties"');
  const r = await new AxeBuilder({ page }).include(".perm-card").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.screenshot({ path: "test-results/vice-permission-card.png" });

  await card.getByRole("button", { name: /Allow once/ }).click();
  await expect.poll(() => sent(m).at(-1)).toBe("Allow once");
  m.send({ type: "vaic.change", conversation: "main", id: "perm-1", saved: true });
  await expect(card.getByRole("status")).toHaveText("Allowed (Allow once).");
  await expect(card.getByRole("button", { name: /Allow once/ })).toHaveCount(0);
});

test("picking another service and Always allow with the keyboard", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const card = await ask(page, m);
  await card.getByRole("combobox", { name: "Which service" }).click();
  await page.getByRole("option", { name: "Riverside" }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } }); // focus out of the empty message box is fine too
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+Enter" : "Control+Shift+Enter");
  await expect.poll(() => sent(m).at(-1)).toBe("Always allow (use Riverside)");
});

test("Esc declines, and the card says VAIC does it another way", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const card = await ask(page, m, "perm-3");
  await page.getByRole("textbox", { name: /message/i }).focus();
  await page.keyboard.press("Escape");
  await expect.poll(() => sent(m).at(-1)).toBe("Decline");
  m.send({ type: "vaic.change", conversation: "main", id: "perm-3", saved: false });
  await expect(card.getByRole("status")).toHaveText("Declined: Vice does it another way.");
});

/** A believable page for the screenshots: a video page with a transcript panel. */
async function fakeShot(page: Page): Promise<Buffer> {
  const p = await page.context().newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.setContent(`<body style="margin:0;font-family:sans-serif;background:#0f0f0f;color:#fff">
    <div style="display:flex;gap:20px;padding:20px">
      <div style="flex:2"><div style="aspect-ratio:16/9;background:linear-gradient(135deg,#3a5,#246);border-radius:12px;display:grid;place-items:center;font-size:48px">▶</div>
      <h2>Exactly How to Make Money (FULL COURSE)</h2><p style="color:#aaa">17,404 views · Oct 31, 2026</p></div>
      <div style="flex:1;background:#212121;border-radius:12px;padding:16px"><b>Transcript</b>
      <p><span style="color:#3ea6ff">0:46</span> with GTA. And by no means am I promising…</p>
      <p><span style="color:#3ea6ff">1:12</span> hello world everyone, this first way is called clipping</p></div></div></body>`);
  const buf = await p.screenshot({ type: "jpeg", quality: 70 });
  await p.close();
  return buf;
}

test("the browser row: live view with the pointer, then Used the browser with thumbnails and steps", async ({
  page,
}) => {
  const m = await mockBackend(page);
  const jpeg = await fakeShot(page);
  await page.route("https://shots.vaic.test/**", (r) =>
    r.fulfill({ status: 200, contentType: "image/jpeg", body: jpeg }),
  );
  await page.goto("/#/vaic");
  await say(page, "do it without any connectors: find where he says hello world");
  const line = await lastLine(page);
  const mid = `owner-${line!.id}`;
  const step = (n: number, label: string, pointer: { x: number; y: number } | null = null) =>
    m.send({
      type: "vaic.browser",
      conversation: "main",
      message_id: mid,
      actions: n,
      started: new Date(Date.now() - 20_000).toISOString(),
      seconds: 10 * n,
      width: 1280,
      height: 800,
      done: false,
      step: {
        n,
        label,
        url: "https://www.youtube.com/watch?v=-jFLIQSVA1c",
        title: "Exactly How to Make Money",
        shot: `https://shots.vaic.test/browser/main/${n}.jpg`,
        pointer,
      },
    });
  step(1, "Opened youtube.com");
  step(2, "Clicked “Show transcript”", { x: 1000, y: 120 });
  const run = page.getByTestId("browser-run");
  await expect(run).toContainText("Using the browser (2 actions)");
  await expect(run.locator(".blive")).toContainText("youtube.com");
  await expect(run.locator(".blive .bpointer")).toBeVisible();
  await expect(run.locator(".blive img")).toHaveJSProperty("complete", true);
  await page.screenshot({ path: "test-results/vice-browser-live.png" });

  step(3, "Opened the transcript");
  m.send({ type: "vaic.browser", conversation: "main", message_id: mid, actions: 3, seconds: 81, done: true });
  m.send({ type: "vaic.reply", conversation: "main", text: "He says hello world at 1:12, bro.", done: true });
  await expect(run).toContainText("Used the browser (3 actions)");
  await expect(run).toContainText("1m 21s");
  await expect(run.locator(".blive")).toHaveCount(0);
  await expect(run.locator(".bthumb")).toHaveCount(3);
  await run.getByRole("button", { name: /Used the browser/ }).click();
  await expect(run.locator(".bsteps li")).toHaveCount(3);
  await expect(run.locator(".brow-main .bchev")).toHaveCSS("transform", /matrix\(0, 1, -1, 0/);
  await page.screenshot({ path: "test-results/vice-browser-done.png" });
  await run.getByRole("button", { name: /Open step 2 larger/ }).click();
  const viewer = page.getByRole("dialog", { name: "VAIC's browser" });
  await expect(viewer).toContainText("Step 2 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(viewer).toContainText("Step 3 of 3");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
});

test("Settings lists the tools VAIC uses without asking, and one can be taken back", async ({ page }) => {
  const m = await mockBackend(page);
  m.connectors.push({
    id: "descript",
    label: "Descript",
    url: "https://api.descript.com/v2/mcp",
    status: "ready",
    auth: "oauth",
    roles: { vaic: "all", worker: "all" },
    tools: [{ name: "transcribe_audio_video" }, { name: "create_project" }],
    always_allow: ["transcribe_audio_video"],
  });
  await page.goto("/#/settings/connectors");
  await page
    .getByRole("table", { name: "Connected tools" })
    .getByRole("button", { name: /^Descript/ })
    .first()
    .click();
  const d = page.getByRole("article", { name: "Connector Descript" });
  const group = d.getByRole("group", { name: "Vice uses without asking" });
  await expect(group).toContainText("Transcribe audio video");
  await group.getByRole("button", { name: "Ask again before using Transcribe audio video" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/descript" && c.method === "PUT")?.body)
    .toEqual({ always_allow: [] });
});
