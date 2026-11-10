// The main journeys, done the way a half-asleep owner would: no prior knowledge, only what the
// screen says. Every backend is mocked (see mock.ts). Screenshots go to docs/screenshots/.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { at, hired, mockBackend } from "./mock.ts";

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

test("first sign-in on our own screens: temporary password, own password, authenticator app, in", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to AI City" })).toBeVisible();
  await expect(page.getByText(/register|sign up|create account/i)).toHaveCount(0); // only the owner exists
  await noSeriousA11y(page, "Sign in");
  expect(await primaries(page)).toBe(1);
  await shot(page, "signin");

  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Temp-Password-1!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  await expect(page.getByText("First sign-in · step 2 of 3")).toBeVisible();
  const save = page.getByRole("button", { name: "Save my password" });
  await page.getByLabel("New password").fill("short");
  await expect(save).toBeDisabled();
  await page.getByLabel("New password").fill("My-Own-Password-1!");
  await page.getByLabel("Type it again").fill("My-Own-Password-1?");
  await expect(page.getByText("The two passwords are not the same.")).toBeVisible();
  await page.getByLabel("Type it again").fill("My-Own-Password-1!");
  await expect(page.getByRole("list", { name: "Password rules" }).locator("li.ok")).toHaveCount(5);
  await noSeriousA11y(page, "New password");
  await shot(page, "signin-new-password");
  await save.click();

  await expect(page.getByRole("heading", { name: "Connect an authenticator app" })).toBeVisible();
  await expect(page.getByText("First sign-in · step 3 of 3")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await expect(page.getByLabel("Setup key")).toHaveText(/^JBSW Y3DP/);
  await noSeriousA11y(page, "Authenticator setup");
  await shot(page, "signin-authenticator");
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Confirm and sign in" }).click();
  await expect(page.getByText(/That code is not right/)).toBeVisible();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Confirm and sign in" }).click();

  await expect(page.getByRole("link", { name: "VAIC — the City" })).toBeVisible();
  await expect(page.getByRole("region", { name: "City view" })).toBeVisible(); // signed in, the City opens first
});

test("later sign-ins: a wrong password says so plainly; then password and code", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/#/vaic");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText(/That email or password is not right/);
  await page.getByLabel("Password", { exact: true }).fill("Own-Password-12!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Enter your 6-digit code" })).toBeVisible();
  await page.getByLabel("6-digit code", { exact: true }).fill("12a3456"); // only digits are kept
  await expect(page.getByLabel("6-digit code", { exact: true })).toHaveValue("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "VAIC — the City" })).toBeVisible();
});

test("sign in once: closing the tab and coming back later opens AI City already signed in", async ({
  page,
  context,
}) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/#/vaic");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Own-Password-12!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("6-digit code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "VAIC — the City" })).toBeVisible();
  await page.close(); // the tab is gone (sessionStorage with it)

  const later = await context.newPage();
  await mockBackend(later, { signedIn: false });
  await later.goto("/#/vaic");
  await expect(later.getByRole("textbox", { name: "Message to VAIC" })).toBeVisible();
  await expect(later.getByRole("heading", { name: /Sign in/ })).toHaveCount(0);
  await later.reload();
  await expect(later.getByRole("textbox", { name: "Message to VAIC" })).toBeVisible();
});

test("a sign-in that expired or was revoked lands on sign-in with a plain message", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("probed")) {
      sessionStorage.setItem("probed", "1");
      localStorage.setItem("vaic.fake.signedIn", "revoked");
    }
  });
  await page.goto("/#/vaic");
  await expect(page.getByRole("status").filter({ hasText: "Your sign-in on this device has ended" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.reload(); // nothing stored any more: the plain sign-in screen, no message
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByText("Your sign-in on this device has ended")).toHaveCount(0);
});

test("signing out clears the sign-in and this device's conversation", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/#/vaic");
  await page.evaluate(() => {
    localStorage.setItem("vaic.fake.signedIn", "1");
    localStorage.setItem("vaic.draft", "half a thought");
  });
  await page.reload();
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("remember me?");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vaic.chat") ?? "")).toContain("remember me?");
  await page.goto("/#/settings/general");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => [
      localStorage.getItem("vaic.fake.signedIn"),
      localStorage.getItem("vaic.chat"),
      localStorage.getItem("vaic.draft"),
    ]),
  ).toEqual([null, null, null]);
});

test("forgot password and a new first-login email, without leaving AI City", async ({ page }) => {
  const m = await mockBackend(page, { signedIn: false });
  await page.goto("/#/vaic");
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("Code from the email", { exact: true }).fill("654321");
  await page.getByLabel("New password", { exact: true }).fill("Brand-New-Pass-1!");
  await page.getByLabel("Type it again", { exact: true }).fill("Brand-New-Pass-1!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your new password is saved. Sign in with it.")).toBeVisible();

  await page.getByRole("button", { name: "First time here, or the temporary password expired?" }).click();
  await page.getByLabel("Email", { exact: true }).fill("Owner@Example.com");
  await page.getByRole("button", { name: "Send me a new email" }).click();
  await expect(page.getByText(/a new first-login email is on its way/)).toBeVisible();
  const sent = m.calls.find((c) => c.path === "/auth/first-login-email");
  expect(sent?.body).toEqual({ email: "owner@example.com" });
});

test("first login shows a three-step guide that can be skipped", async ({ page }) => {
  await mockBackend(page, { firstRunDone: false });
  await page.goto("/#/vaic");
  await expect(page.getByRole("dialog", { name: "Meet VAIC" })).toBeVisible();
  await shot(page, "first-run-guide");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "See the City" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lands on VAIC with the input focused; asking something shows VAIC's streamed reply", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await expect(box).toBeFocused();
  await expect(page.getByRole("button", { name: "Talk to VAIC", exact: true })).toBeVisible();
  await expect(page.getByText(/Today: \$/)).toHaveCount(0); // costs live on the Costs screen only
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await box.fill("yo VAIC, what's 9 + 9?");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "yo VAIC, what's 9 + 9?", conversation: "main" });
  await expect(page.locator(".msg-pending")).toBeVisible(); // VAIC's status row while it works
  m.send({ type: "vaic.reply", conversation: "main", text: "Eigh", done: false });
  m.send({ type: "vaic.reply", conversation: "main", text: "Eighteen.", done: true });
  await expect(page.getByLabel("Conversation with VAIC").getByText("Eighteen.")).toBeVisible();
  // The owner on the right in a bubble, VAIC on the left as plain text with Markdown rendered.
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "## Today\n- **Research**: 3 workers\n- Engineering: idle\n\n| Dept | Spend |\n|---|---|\n| Research | $0.30 |",
    done: true,
  });
  const log = page.getByLabel("Conversation with VAIC");
  await expect(log.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(log.getByRole("cell", { name: "$0.30" })).toBeVisible();
  const mine = (await log.locator(".msg-owner .msg-body").first().boundingBox())!;
  const theirs = (await log.locator(".msg-vaic .msg-body").first().boundingBox())!;
  const panel = (await log.boundingBox())!;
  expect(mine.x + mine.width).toBeGreaterThan(panel.x + panel.width - 40); // hugs the right edge
  expect(theirs.x).toBeLessThan(panel.x + 40); // starts at the left edge
  expect(mine.x).toBeGreaterThan(theirs.x + 100);
  await expect(page.getByText(/Not sent yet/)).toHaveCount(0); // delivered, so nothing waits in the outbox
  // The chat panel runs up behind the top bar (no "Chat with VAIC" header); the first message starts below the
  // bar; the brand is the owner's eye logo and "VAIC" (decision 169), not the animated VAIC-screen eye.
  const bar = (await page.locator("header.top").boundingBox())!;
  const talkBox = (await page.locator(".talk").boundingBox())!;
  expect(talkBox.y).toBeLessThanOrEqual(bar.y + 1);
  expect((await log.locator(".msg").first().boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  await expect(page.locator(".talk-head")).toHaveCount(0);
  await expect(page.locator(".brand .eyes")).toHaveCount(0);
  await expect(page.locator(".brand .wm-eye")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear conversation on this device" })).toBeVisible();
  await shot(page, "vaic");
  await noSeriousA11y(page, "VAIC");
});

test("push-to-talk sends what the owner said to VAIC", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(
    () => ((window as unknown as { __heard: string }).__heard = "hey VAIC, what's the status of the product?"),
  );
  await page.goto("/#/vaic");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "hey VAIC, what's the status of the product?" });
});

test("one voice button: the conversation stays on, the voice bar shows who is talking, a second tap ends it", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    (window as unknown as { __micHold: boolean }).__micHold = true;
    (window as unknown as { __micLoud: boolean }).__micLoud = true; // the owner keeps talking
    (window as unknown as { __speakMs: number }).__speakMs = 4000;
  });
  await page.goto("/#/vaic");
  // Only the chat: no left column, no hands-free switch, no Speak replies choices, no voice bar until it is on.
  await expect(page.locator(".vaic-stage")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.locator(".voice")).toHaveCount(0);
  const button = page.getByRole("button", { name: "Talk to VAIC", exact: true });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  const strip = page.locator(".voice");
  await expect(strip).toHaveAttribute("data-speaker", "you");
  await expect(strip.getByRole("status")).toHaveText("Listening to you");
  await expect(strip.getByText("You’re talking")).toBeVisible(); // the fake mic is loud
  const end = page.getByRole("button", { name: "End the voice conversation" });
  await expect(end).toHaveAttribute("aria-pressed", "true");
  await shot(page, "vaic-you-talking");
  await noSeriousA11y(page, "VAIC in a voice conversation");

  // VAIC's answer in the conversation is spoken, and the bar says so.
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.some((c) => c.path === "/messages")).toBe(true);
  m.send({ type: "vaic.reply", conversation: "main", text: "All quiet. Nothing needs you.", done: true });
  await expect(strip).toHaveAttribute("data-speaker", "vaic");
  await expect(strip.getByRole("status")).toHaveText("VAIC is talking");
  await shot(page, "vaic-vaic-talking");

  // A second tap ends it: VAIC stops, the mic closes, the bar goes.
  await end.click();
  await expect(strip).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("a microphone failure names the real cause and logs it to the console", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => ((window as unknown as { __micError: string }).__micError = "NotAllowedError"));
  const logged: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && logged.push(msg.text()));
  await page.goto("/#/vaic");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Microphone access is blocked for this site");
  // The conversation ends with the failure: the button is off again and the voice bar is gone.
  await expect(page.getByRole("button", { name: "Talk to VAIC", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator(".voice")).toHaveCount(0);
  expect(
    logged.some((t) => t.includes("[VAIC voice] the microphone could not start:") && t.includes("NotAllowedError")),
  ).toBe(true);
});

test("VAIC's reply: its steps with a shimmering status first, then words flowing in, then the steps folded", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const log = page.getByLabel("Conversation with VAIC");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("tell me about the city");
  await page.keyboard.press("Enter");
  const status = log.getByRole("status", { name: /^VAIC: / });
  await expect(status).toHaveAccessibleName("VAIC: Understanding your message"); // before any event arrives
  await expect(status.locator(".shimmer")).toHaveCSS("animation-name", "shimmer-sweep");
  m.send({ type: "activity", id: "vaic", activity: "understanding" });
  m.send({ type: "activity", id: "vaic", activity: "working", detail: "get_status" });
  await expect(status).toHaveAccessibleName("VAIC: Checking how things are going");
  await expect(status).toContainText(/\ds$/);
  await shot(page, "vaic-working");
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  m.send({ type: "vaic.reply", conversation: "main", text: `**City**: ${words}`, done: false });
  await expect(status).toHaveCount(0); // the status row goes once words arrive
  const reply = log.locator(".msg-vaic").last();
  await expect(reply).toHaveAttribute("aria-busy", "true");
  // Revealed bit by bit, not in one jump.
  const lengths: number[] = [];
  for (let i = 0; i < 6; i++) {
    lengths.push(((await reply.textContent()) ?? "").length);
    await page.waitForTimeout(60);
  }
  expect(lengths[0]).toBeLessThan(words.length);
  expect(new Set(lengths).size).toBeGreaterThan(2);
  await expect(reply.locator("strong")).toHaveText("City"); // bold renders as bold, never as **City
  await shot(page, "vaic-reply-streaming");
  m.send({ type: "vaic.reply", conversation: "main", text: "**City**: all quiet. Final answer.", done: true });
  await expect(reply).toContainText("all quiet. Final answer.");
  await expect(reply).not.toHaveAttribute("aria-busy", "true");
  await expect(reply).not.toContainText("word59");
  const steps = reply.locator("details.vaic-steps");
  await expect(steps.locator("summary")).toHaveText(/^What I did/);
  await expect(steps.getByText("Checking how things are going")).toBeHidden(); // folded until opened
  await steps.locator("summary").click();
  await expect(steps.getByText("Checking how things are going")).toBeVisible();
});

test("with reduced motion the reply appears directly, without the typing effect", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".shimmer")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".vaic-status-eye")).toHaveCSS("animation-name", "none");
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  m.send({ type: "vaic.reply", conversation: "main", text, done: false });
  await expect(page.getByLabel("Conversation with VAIC").locator(".msg-vaic .msg-body").last()).toHaveText(text, {
    timeout: 150,
  });
});

test("typed and dictated messages get text; the voice conversation gets speech", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => ((window as unknown as { __heard: string }).__heard = "hey VAIC, status?"));
  await page.goto("/#/vaic");
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);

  // Typed: a text-only answer.
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "vaic.reply", conversation: "main", text: "Typed answer.", done: true });
  await expect(page.getByLabel("Conversation with VAIC").getByText("Typed answer.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await spoken()).toEqual([]);

  // The voice conversation: spoken back.
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  expect(m.calls.filter((c) => c.path === "/messages")[1]?.body).toMatchObject({ voice: true });
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  m.send({ type: "vaic.reply", conversation: "main", text: "Spoken answer.", done: true });
  await expect.poll(spoken).toEqual(["Spoken answer."]);
});

test("Dictate: words land in the box live, nothing is sent until Send, and the answer is text", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __partials: string[]; __heard: string; __micHold: boolean };
    w.__partials = ["remind me", "remind me to call"];
    w.__heard = "remind me to call the bank";
  });
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await page.getByRole("button", { name: "Dictate into the box" }).click(); // the icon beside Send
  await expect(box).toHaveValue("remind me to call"); // a live partial
  await expect(box).toHaveValue("remind me to call the bank");
  // Like Claude's composer: under the words, cancel, the live wave of your voice, stop and send.
  const bar = page.getByRole("group", { name: "Dictation" });
  await expect(bar.getByRole("button", { name: "Cancel dictation" })).toBeVisible();
  await expect(bar.locator("canvas.mic-wave")).toBeVisible();
  await expect(bar.getByRole("button", { name: "Send to VAIC" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Add to your message" })).toHaveCount(0); // the row is the bar now
  await shot(page, "vaic-dictating");
  await noSeriousA11y(page, "VAIC while dictating");
  await page.getByRole("button", { name: "Stop dictating" }).click();
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(0); // nothing sent by itself
  await box.press("End");
  await box.pressSequentially(" tomorrow"); // the owner can fix the words before sending
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "remind me to call the bank tomorrow" });
  expect(m.calls.find((c) => c.path === "/messages")?.body).not.toHaveProperty("voice");
  m.send({ type: "vaic.reply", conversation: "main", text: "Tomorrow it is.", done: true });
  await expect(page.getByLabel("Conversation with VAIC").getByText("Tomorrow it is.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])).toEqual([]);
});

test("a spoken reply starts with its first sentence while the rest still streams, without Markdown or emoji", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click(); // asked by voice
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "vaic.reply", conversation: "main", text: "All **quiet** in the city 🎉. Research", done: false });
  await expect.poll(spoken).toEqual(["All quiet in the city."]); // talking before the reply is complete
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "vaic");
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: " has three workers.\n```\nnpm test\n```\nSee [the plan](https://x.y).",
    done: false,
  });
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "All **quiet** in the city 🎉. Research has three workers.\n```\nnpm test\n```\nSee [the plan](https://x.y).",
    done: true,
  });
  await expect.poll(spoken).toEqual(["All quiet in the city.", "Research has three workers.", "See the plan."]); // no code read out
  // The mic stayed open the whole time; saying "stop listening" ends the conversation.
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  await expect(page.locator(".voice")).toHaveCount(0);
});

test("a three-sentence streamed reply plays three clips, in order, once each; Send cuts VAIC off", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => ((window as unknown as { __speakMs: number }).__speakMs = 250));
  await page.goto("/#/vaic");
  const w = () =>
    page.evaluate(() => {
      const x = window as unknown as { __spoken?: string[]; __overlaps?: number };
      return { spoken: x.__spoken ?? [], overlaps: x.__overlaps ?? 0 };
    });
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click(); // asked by voice
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  expect(m.calls.find((c) => c.path === "/messages")?.body).toMatchObject({ voice: true }); // VAIC keeps it short
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  const pieces = ["Hi there", ". The city is qu", "iet. Research", " has two work", "ers."];
  for (const text of pieces) m.send({ type: "vaic.reply", conversation: "main", text, done: false });
  m.send({ type: "vaic.reply", conversation: "main", text: pieces.join(""), done: true });
  m.send({ type: "vaic.reply", conversation: "main", text: pieces.join(""), done: true }); // the bus's copy
  const all = ["Hi there.", "The city is quiet.", "Research has two workers."];
  await expect.poll(async () => (await w()).spoken).toEqual(all);
  await page.waitForTimeout(700); // nothing more comes later
  expect(await w()).toEqual({ spoken: all, overlaps: 0 });

  // A long reply in a new conversation: the owner types and sends while VAIC talks, and VAIC stops.
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "status?"));
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(3); // the typed one too
  m.send({ type: "vaic.reply", conversation: "main", text: "One. Two. Three. Four. Five. Six.", done: true });
  await expect.poll(async () => (await w()).spoken.length).toBeGreaterThan(3);
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("stop");
  await page.keyboard.press("Enter");
  const cut = (await w()).spoken.length;
  await page.waitForTimeout(1200);
  expect((await w()).spoken.length).toBeLessThanOrEqual(cut + 1); // at most the clip already starting
  expect((await w()).spoken).not.toContain("Six.");
});

test("Settings: an OpenAI key switches VAIC to OpenAI's voice; the key is never shown back", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/voice");
  await expect(page.getByRole("combobox", { name: "VAIC's voice" })).toHaveAttribute("data-value", "Ruth"); // Polly until a key is in
  await page.getByRole("button", { name: "Add an OpenAI key" }).click();
  const field = page.getByLabel("OpenAI key", { exact: true });
  await expect(field).toHaveAttribute("type", "password");
  await field.fill("not-a-key");
  await page.getByRole("button", { name: "Save the OpenAI key" }).click();
  await expect(page.getByText("That doesn't look like an OpenAI key (it starts with sk-).")).toBeVisible();
  await field.fill("sk-test-123");
  await page.getByRole("button", { name: "Save the OpenAI key" }).click();
  await expect(page.getByText(/^Saved .*never shown again\.$/)).toBeVisible();
  await expect(page.getByLabel("OpenAI key", { exact: true })).toHaveCount(0); // the field closes
  expect(await page.content()).not.toContain("sk-test-123");
  expect(m.calls.filter((c) => c.path === "/voice/openai-key").at(-1)?.body).toEqual({ key: "sk-test-123" });
  const voice = page.getByRole("combobox", { name: "VAIC's voice" });
  await expect(voice).toHaveAttribute("data-value", "alloy"); // OpenAI's default
  await voice.click();
  await page.getByRole("option", { name: /^Nova/ }).click();
  await page.getByRole("button", { name: "Test voice" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []))
    .toEqual(["openai:nova:Hi, I'm VAIC. This is how I'll sound when I answer you."]);
  await expect(page.getByText(/^Played\./)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "VAIC's voice" })).toHaveAttribute("data-value", "nova");
  await expect(page.getByRole("button", { name: "Replace the OpenAI key" })).toBeVisible();
});

test("with an OpenAI key, a spoken reply plays through OpenAI, sentence by sentence; a failure falls back to Polly once, said once", async ({
  page,
}) => {
  const m = await mockBackend(page);
  m.openai.key = "sk-test";
  await page.goto("/#/vaic");
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  for (const text of ["Hi there. The ci", "ty is quiet. Research", " has two workers."])
    m.send({ type: "vaic.reply", conversation: "main", text, done: false });
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "Hi there. The city is quiet. Research has two workers.",
    done: true,
  });
  await expect
    .poll(spoken)
    .toEqual(["openai:alloy:Hi there.", "openai:alloy:The city is quiet.", "openai:alloy:Research has two workers."]);
  expect(m.calls.filter((c) => c.path === "/speech")).toHaveLength(3); // one request per sentence, once each

  // OpenAI refuses: this reply and the rest of the visit speak with Polly, and the voice line says so once.
  m.openai.error = { code: "rate_limited", message: "OpenAI is busy right now" };
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "status?"));
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  m.send({ type: "vaic.reply", conversation: "main", text: "Still quiet. All good.", done: true });
  await expect.poll(async () => (await spoken()).slice(3)).toEqual(["Still quiet.", "All good."]);
  await expect(
    page.getByText("OpenAI's voice failed (OpenAI is busy right now). Using the Polly voice for now."),
  ).toBeVisible();
  expect(m.calls.filter((c) => c.path === "/speech")).toHaveLength(4); // tried once, then Polly
});

test("Settings: pick VAIC's voice; it is remembered on this device and can be heard", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/settings/voice");
  const voice = page.getByRole("combobox", { name: "VAIC's voice" });
  await expect(voice).toHaveAttribute("data-value", "Ruth"); // the deploy's default
  await voice.click();
  await page.getByRole("option", { name: /^Danielle/ }).click();
  await page.getByRole("button", { name: "Test voice" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []))
    .toEqual(["Hi, I'm VAIC. This is how I'll sound when I answer you."]);
  await expect(page.getByText(/^Played\./)).toBeVisible(); // the button says it worked
  await page.reload();
  await expect(page.getByRole("combobox", { name: "VAIC's voice" })).toHaveAttribute("data-value", "Danielle");
  expect(await page.evaluate(() => localStorage.getItem("vaic.voice"))).toBe("Danielle");
});

test("while the work VAIC handed on runs, its steps shimmer with a live clock; they settle when the result is back", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("build me a budget app");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "activity", id: "vaic", activity: "understanding" });
  m.send({ type: "activity", id: "vaic", activity: "delegating", detail: "delegate_to_orchestrator" });
  const t = { id: "t-budget", from: "vaic", to: "orchestrator", goal: "Budget app", kind: "task", department: null };
  m.send({ type: "ticket.status", previous: null, ticket: { ...t, status: "open" } });
  m.send({ type: "vaic.reply", conversation: "main", text: "On it. The Orchestrator has it.", done: true });

  const steps = page.getByLabel("Conversation with VAIC").locator("details.vaic-steps").last();
  await expect(steps).toHaveClass(/is-running/);
  await expect(steps.locator(".shimmer")).toHaveText("Working on it: Passing this to my team…");
  await expect(steps.locator(".shimmer")).toHaveCSS("animation-name", "shimmer-sweep");
  const clock = steps.locator(".vaic-status-time");
  const first = Number((await clock.textContent())?.replace("s", ""));
  await expect
    .poll(async () => Number((await clock.textContent())?.replace("s", "")), { timeout: 3000 })
    .toBeGreaterThan(first);
  await steps.locator("summary").click();
  await expect(steps.locator("li.current")).toHaveText("Passing this to my team");
  await shot(page, "vaic-work-running");

  m.send({ type: "ticket.status", previous: "open", ticket: { ...t, status: "in_progress" } });
  await expect(steps).toHaveClass(/is-running/); // progress is not the end
  m.send({ type: "result", ticket_id: "t-budget", summary: "Budget app published." });
  await expect(steps).not.toHaveClass(/is-running/);
  await expect(steps.locator(".shimmer")).toHaveCount(0);
  await expect(steps.locator("summary")).toHaveText(/^What I did · \d+ s$/);
});

test("after a long conversation the VAIC screen still fits the window: only the chat scrolls, inside its panel", async ({
  page,
}) => {
  const m = await mockBackend(page);
  const sizes: Array<[number, number]> = [
    [1440, 900],
    [1280, 800],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/#/vaic");
    for (let i = 0; i < 12; i++) {
      await page.getByRole("textbox", { name: "Message to VAIC" }).fill(`question ${i}`);
      await page.keyboard.press("Enter");
      m.send({ type: "vaic.reply", conversation: "main", text: `Answer ${i}. `.repeat(20), done: true });
    }
    await expect(
      page
        .getByLabel("Conversation with VAIC")
        .getByText(/Answer 11\./)
        .first(),
    ).toBeVisible();
    const fit = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const chat = document.querySelector(".chat")!;
      const composer = document.querySelector(".composer")!.getBoundingClientRect();
      const talk = document.querySelector(".talk")!.getBoundingClientRect();
      const area = main.getBoundingClientRect();
      return {
        page: document.documentElement.scrollHeight <= window.innerHeight + 1,
        main: main.scrollHeight <= main.clientHeight + 1, // the page area never scrolls into empty space
        chatScrolls: chat.scrollHeight > chat.clientHeight,
        composerOnScreen: composer.bottom <= window.innerHeight,
        // The chat panel runs from just under the top bar to the bottom edge (only the page gutter around it).
        chatFromTop: talk.top - area.top <= 32,
        chatToBottom: window.innerHeight - talk.bottom <= 32,
        composerAtBottom: talk.bottom - composer.bottom <= 4,
      };
    });
    expect(fit).toEqual({
      page: true,
      main: true,
      chatScrolls: true,
      composerOnScreen: true,
      chatFromTop: true,
      chatToBottom: true,
      composerAtBottom: true,
    });
  }
});

test("a plain chat: nothing is suggested under VAIC's replies, even after a question", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("check the GT3 sentences");
  await page.keyboard.press("Enter");
  m.send({ type: "vaic.reply", conversation: "main", text: "On it. Want me to tell you when it's done?", done: true });
  await expect(
    page.getByLabel("Conversation with VAIC").getByText("Want me to tell you when it's done?"),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Quick replies" })).toHaveCount(0);
  for (const label of ["Yes", "No", "How's it going?", "Stop it"])
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
});

test("plain words: Work in the menu, What I did under replies, today's spend without a far-away limit", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const nav = page.getByRole("navigation", { name: "Screens" });
  await expect(nav.getByRole("link", { name: "Work" })).toBeVisible();
  await expect(nav.getByText("Tickets")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("status?");
  await page.keyboard.press("Enter");
  m.send({ type: "activity", id: "vaic", activity: "working", detail: "get_status" });
  m.send({ type: "vaic.reply", conversation: "main", text: "All quiet.", done: true });
  const steps = page.locator("details.vaic-steps").last();
  await expect(steps.locator("summary")).toHaveText(/^What I did · \d+ s$/);
  await steps.locator("summary").click();
  await expect(steps).toContainText("Checking how things are going");
  for (const word of ["ledger", "Orchestrator", "ticket"])
    await expect(page.locator("section.vaic")).not.toContainText(word);
});

test("the message box starts one line tall, grows with more lines up to a limit, and shrinks back", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  const height = () => box.evaluate((e) => e.getBoundingClientRect().height);
  const oneLine = await height();
  expect(oneLine).toBeLessThan(60); // one line plus padding, level with the send button

  await box.click();
  await box.pressSequentially("first line");
  await box.press("Shift+Enter");
  await box.pressSequentially("second line");
  await box.press("Shift+Enter");
  await box.pressSequentially("third line");
  const threeLines = await height();
  expect(threeLines).toBeGreaterThan(oneLine + 40); // grew by two lines

  await box.fill(Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n"));
  const capped = await height();
  expect(capped).toBeLessThan(260); // about eight lines, then it scrolls inside
  expect(await box.evaluate((e) => getComputedStyle(e).overflowY)).toBe("auto");

  await box.fill("");
  expect(await height()).toBe(oneLine); // back to one line

  await box.pressSequentially("hello");
  await box.press("Enter"); // Enter still sends
  await expect.poll(() => m.calls.find((c) => c.path === "/messages")?.body).toMatchObject({ text: "hello" });
  expect(await height()).toBe(oneLine);
});

test("speech to speech: VAIC answers aloud while it keeps listening; its own echo is ignored, the owner is not", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    (window as unknown as { __heard: string }).__heard = "what's the status?";
    (window as unknown as { __speakMs: number }).__speakMs = 700;
  });
  await page.goto("/#/vaic");
  const strip = page.locator(".voice");
  const said = (t: string) => page.evaluate((x) => ((window as unknown as { __heard: string }).__heard = x), t);
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  // While voice is on, the screen says so plainly.
  await expect(page.getByText("Voice on")).toBeVisible();
  m.send({ type: "vaic.reply", conversation: "main", text: "All quiet. Nothing needs you.", done: true });
  await expect(strip).toHaveAttribute("data-speaker", "vaic");
  // The mic is open while VAIC talks: VAIC's own words coming back from the speakers are not sent.
  await said("nothing needs you");
  await page.waitForTimeout(300);
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(1);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []), {
      intervals: [50],
    })
    .toEqual(["All quiet.", "Nothing needs you."]); // spoken, sentence by sentence, no typing
  // VAIC finished: still listening, no tap needed for the next question.
  await expect(strip).toHaveAttribute("data-speaker", "you");
  await said("and the costs?");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  expect(m.calls.filter((c) => c.path === "/messages")[1]?.body).toMatchObject({ text: "and the costs?", voice: true });

  // The owner talks in the middle of VAIC's answer: VAIC stops, and what the owner said goes out.
  await page.evaluate(() => ((window as unknown as { __speakMs: number }).__speakMs = 4000));
  m.send({ type: "vaic.reply", conversation: "main", text: "About two dollars today, mostly research.", done: true });
  await expect(strip).toHaveAttribute("data-speaker", "vaic");
  await said("wait, what about yesterday?");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(3);
  await expect(strip).not.toHaveAttribute("data-speaker", "vaic");
  await expect(page.getByRole("button", { name: "End the voice conversation" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // "stop listening" ends it, and is not sent.
  await said("stop listening");
  await expect(strip).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(3);
  await expect(page.getByRole("button", { name: "Talk to VAIC", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Outside the conversation a typed message is answered in text, and the mic stays closed.
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("hello");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(4);
  m.send({ type: "vaic.reply", conversation: "main", text: "Hi.", done: true });
  await expect(page.getByLabel("Conversation with VAIC").getByText("Hi.")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken)).not.toContain("Hi.");
  await expect(strip).toHaveCount(0);
});

test("'speaking' shows only while sound plays, and a voice that fails says why", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    (window as unknown as { __synthMs: number }).__synthMs = 1200; // making the audio takes a while
    (window as unknown as { __speakMs: number }).__speakMs = 1000; // and it plays for a second
  });
  await page.goto("/#/vaic");
  const strip = page.locator(".voice");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click(); // asked by voice
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "vaic.reply", conversation: "main", text: "All quiet.", done: true });
  await expect(page.getByLabel("Conversation with VAIC").getByText("All quiet.")).toBeVisible();
  // The reply is done, but its audio is still being made: not "speaking" yet.
  await page.waitForTimeout(400);
  await expect(strip).not.toHaveAttribute("data-speaker", "vaic");
  // The clip starts playing: now it is.
  await expect(strip).toHaveAttribute("data-speaker", "vaic");
  await expect(strip).toHaveAttribute("data-speaker", "you", { timeout: 8000 }); // it ends; the mic never closed
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  await expect(strip).toHaveCount(0); // "stop listening" ends the conversation

  // Polly refuses: the voice line says so in plain words, and nothing pretends to speak.
  await page.evaluate(() => {
    const w = window as unknown as { __synthMs: number; __synthError: string; __heard: string };
    w.__synthMs = 0;
    w.__synthError = "AccessDeniedException";
    w.__heard = "status?";
  });
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  await page.evaluate(() => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis; // no browser voice to fall back on
  });
  m.send({ type: "vaic.reply", conversation: "main", text: "Still quiet.", done: true });
  await expect(page.getByRole("alert")).toContainText("VAIC's voice could not play (AccessDeniedException");
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "stop listening"));
  await expect(page.locator('.voice[data-speaker="vaic"]')).toHaveCount(0);

  // The Test voice button reports the same failure, exactly.
  await page.goto("/#/settings/voice");
  await page.getByRole("button", { name: "Test voice" }).click();
  await expect(page.getByText(/VAIC's voice could not play \(AccessDeniedException/)).toBeVisible();
});

test("a draft survives a reload", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("half a thought");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message to VAIC" })).toHaveValue("half a thought");
});

test("watching the City: a department goes up and workers appear when hired", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  await expect(page.locator(".inboxbar")).toHaveCount(0); // nothing needs the owner: no box at all
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
  await expect(depts.getByRole("button", { name: "Engineering · 3 working" })).toBeVisible();
  const feed = page.locator(".feed");
  await expect(feed).toContainText("New department: Engineering");
  await expect(feed).toContainText("Engineering hired 3 workers"); // a burst is one line
  await expect(feed).toContainText("Engineering started a part");
  await expect(feed).not.toContainText("wkr-"); // no ids
  await expect(feed).not.toContainText("→");
  await expect.poll(async () => Number(await city.getAttribute("data-people"))).toBeGreaterThanOrEqual(6); // VAIC, Orchestrator, manager, 3 workers
  await page.waitForTimeout(800); // let the walk-in finish for the picture
  await shot(page, "city-workers");
  await depts.getByRole("button", { name: /Engineering/ }).click();
  await expect(page.getByRole("dialog", { name: "Engineering department" })).toContainText("3 workers at their desks");
  await noSeriousA11y(page, "City");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
});

test("Autopilot: no Needs you tab, box or count; an open item from before is under Settings and one tap answers it", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send({
    type: "ticket.status",
    ticket: {
      id: "t-2",
      goal: "Build the demo",
      owner_words: "the demo app",
      from: "vaic",
      to: "orchestrator",
      status: "waiting_on_owner",
      department: null,
      parent_id: null,
      kind: "task",
      created_at: at(),
      updated_at: at(),
    },
    previous: null,
  });
  m.send({
    type: "question.asked",
    question: {
      id: "q-stale",
      asked_by: "wkr-engineering-a1",
      path: "x",
      ticket_id: "t-finished-long-ago",
      text: "A question nobody can answer any more",
      options: [],
      default_answer: "ok",
      status: "open",
      created_at: at(),
    },
  });
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
  await expect(page.getByRole("link", { name: /Needs you/ })).toHaveCount(0); // no tab, no badge, no box
  await expect(page.locator(".inboxbar")).toHaveCount(0);
  await expect(page.locator(".citytop")).not.toContainText("Need you");
  await page.goto("/#/settings/away");
  await page.getByRole("link", { name: /Open items.*1 thing from before/ }).click(); // the stale one is not counted
  await expect(page.getByRole("heading", { name: "Open items" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "the demo app" })).toBeVisible(); // grouped by job
  await expect(page.getByText("A question nobody can answer any more")).toHaveCount(0);
  await shot(page, "needs-you");
  await noSeriousA11y(page, "Open items");
  expect(await primaries(page)).toBe(1);
  await page.getByRole("button", { name: "Write my own answer" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeFocused();
  await page.getByRole("button", { name: "SQLite" }).click(); // the default, first and biggest
  await expect(page.getByText("Which database should the demo use?")).toHaveCount(0); // gone at once
  await expect.poll(() => m.calls.find((c) => c.path === "/questions/q1/answer")?.body).toEqual({ answer: "SQLite" });
  await expect(page.getByText("Answered: SQLite")).toBeVisible();
});

test("approving an action needs holding the button and approves exactly that action", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/inbox"); // an old link: it opens Open items
  await expect(page.getByText(/Nothing is open/)).toBeVisible();
  m.send({
    type: "approval.requested",
    id: "ap-1",
    agent: "wkr-engineering-a1",
    action: "npm publish --access public",
    reason: "Publishing needs the owner.",
  });
  await expect(page.getByText("The worker wants your OK")).toHaveCount(0); // never an id, never vague
  await expect(page.getByText("Run a command on its work computer.")).toBeVisible();
  await page.getByRole("button", { name: "Yes…" }).click();
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

test("spend caps are optional: an impossible cap is refused, an empty field means no limit", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/limits");
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

test("costs show nowhere but the Costs screen", async ({ page }) => {
  await mockBackend(page, { snapshot: { usage: { usd: 3.2, turns: 40, tokens: 900000 } } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/Today: \$/)).toHaveCount(0); // no money pill
  await expect(page.getByText(/est\. \$/)).toHaveCount(0); // no estimates on the map
  await expect(page.getByText(/tokens/)).toHaveCount(0); // no token counts
  await page.getByRole("link", { name: "Costs" }).click();
  await expect(page.getByRole("heading", { name: "Costs (estimates)" })).toBeVisible();
  await expect(page.getByText(/\$3\.20/).first()).toBeVisible(); // the one place money lives
});

test("hitting the spend cap: the City says so plainly and points at Costs", async ({ page }) => {
  const m = await mockBackend(page, { snapshot: { usage: { usd: 10, turns: 300, tokens: 9e6 } } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send({ type: "spend.cap_reached", cap: "daily_global", department: null, spent: 10.02, limit: 10 });
  await expect(
    page.getByText(
      /You reached your daily spending limit \(\$10\)\. No new work starts until you raise it in Settings\./,
    ),
  ).toBeVisible();
  await shot(page, "spend-cap");
  await page.getByRole("button", { name: "See costs" }).click();
  await expect(page.getByRole("heading", { name: "Costs (estimates)" })).toBeVisible();
  await expect(page.getByText("Limit reached: no new work starts.")).toBeVisible();
  // The AWS budget is an alert, named as one, never as a limit.
  await expect(page.getByText("Alert at $10,000 a month: AWS emails you. It never stops anything.")).toBeVisible();
  await shot(page, "costs");
  await noSeriousA11y(page, "Costs");
});

test("a lost connection says what happened and that nothing was lost", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await expect(page.getByRole("textbox", { name: "Message to VAIC" })).toBeFocused();
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

test("Work: one row per job in plain words; details, long notes and technical ids only on request", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/#/tickets");
  const row = page.getByRole("button", { name: /Add a power\(a, b\) function to add\.js/ });
  await expect(row).toContainText("Being checked");
  await expect(row).toContainText("2 of 3 parts done");
  await expect(row).not.toContainText("orchestrator"); // no ids or agent names on the list
  await shot(page, "tickets");
  await noSeriousA11y(page, "Work");
  await row.click();
  await expect(page.getByRole("heading", { name: "Add a power(a, b) function to add.js" })).toBeVisible();
  await expect(
    page.getByText(/The reviewer is reading the new power function.*…/), // one line, cut at a word
  ).toBeVisible();
  await page.getByRole("button", { name: "more" }).click(); // the long note, whole
  await expect(page.getByText(/line by line before it goes back to the owner\./)).toBeVisible();
  await expect(page.getByText('"id": "t-1"')).toHaveCount(0);
  await page.getByRole("button", { name: "Technical details" }).click();
  await expect(page.getByText(/"id": "t-1"/)).toBeVisible();
  await noSeriousA11y(page, "Work detail");
});

test("knowledge: add files, paste a link, change how it's used, delete with Undo", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
  await expect(page.getByText("Nothing stored yet. Drop a file or paste a link above.")).toBeVisible();
  await expect(page.getByText("0% of its space is used")).toBeVisible();

  // Two files at once, through the drop zone's file picker.
  await page.locator(".drop input[type=file]").setInputFiles([
    { name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 hello") },
    { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("png") },
  ]);
  const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
  await expect(row("notes.pdf").getByRole("status")).toHaveText("Ready");
  await expect(row("photo.png").getByRole("status")).toHaveText("Ready");
  expect(m.knowledge.puts).toHaveLength(2);

  // A pasted link.
  await page.getByLabel("Paste a link or text").fill("https://example.com/article");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(row("https://example.com/article").getByRole("status")).toHaveText(/Reading the page|Ready/);
  await expect(row("https://example.com/article").getByRole("status")).toHaveText("Ready");
  expect(m.calls.find((c) => c.path === "/knowledge/links")?.body).toEqual({ url: "https://example.com/article" });
  await expect(page.getByLabel("Paste a link or text")).toHaveValue("");

  // How the agents use it: three choices, saved at once; the budget follows.
  await row("notes.pdf").getByText("Always include").click();
  await expect(row("notes.pdf").getByLabel("Always include")).toBeChecked();
  await expect
    .poll(() => m.calls.find((c) => c.method === "PUT" && c.path.startsWith("/knowledge/"))?.body)
    .toEqual({
      scope: "always",
    });
  await expect(page.getByText("20% of its space is used")).toBeVisible();

  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await noSeriousA11y(page, "Knowledge");
  await shot(page, "knowledge");

  // Delete asks first, then Undo brings it back and nothing is deleted.
  const deletes = () => m.calls.filter((c) => c.method === "DELETE").length;
  await page.getByRole("button", { name: "Delete “photo.png”" }).click();
  await expect(page.getByRole("dialog", { name: "Delete “photo.png”?" })).toBeVisible();
  await noSeriousA11y(page, "Knowledge delete");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(row("photo.png")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row("photo.png")).toHaveCount(1);
  expect(deletes()).toBe(0);

  // Deleted for real once the Undo time is over.
  await page.getByRole("button", { name: "Delete “photo.png”" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(row("photo.png")).toHaveCount(0);
  expect(deletes()).toBe(0);
  await expect.poll(deletes, { timeout: 16_000 }).toBe(1);
  expect(m.calls.find((c) => c.method === "DELETE")?.path).toMatch(/^\/knowledge\/k-/);
  await expect(row("photo.png")).toHaveCount(0);
});

test("the + menu: files ride along with the message, slash commands become plain words, connectors and plugins listed", async ({
  page,
}) => {
  const m = await mockBackend(page);
  m.skills.push({
    name: "pdf-report",
    description: "Makes a PDF report",
    roles: ["vaic"],
    enabled: true,
    version: "v1",
    files: [],
    size_bytes: 10,
    updated_at: at(),
  });
  m.connectors.push({ id: "heygen", label: "HeyGen", status: "ready", tools: [{ name: "make_video" }] });
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  const plus = page.getByRole("button", { name: "Add to your message" });
  await expect(plus).toBeVisible();
  await expect(plus).toHaveAttribute("aria-expanded", "false");

  // The menu opens upwards with the five things Claude's own composer offers.
  await plus.click();
  const menu = page.getByRole("menu", { name: "Add to your message" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    /Add files or photos/,
    /Add folders/,
    /Slash commands/,
    /Connectors1 connected/,
    /Plugins1 skills/,
  ]);
  // It rises out of the button: measure where it lands, once the animation is over.
  await menu.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const menuBox = (await menu.boundingBox())!;
  const plusBox = (await plus.boundingBox())!;
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(plusBox.y + 1); // a drop-up, above the button
  await shot(page, "plus-menu");
  await noSeriousA11y(page, "VAIC with the + menu open");

  // Connectors: each one with its status; "Add a connector…" writes the sentence with the name selected.
  await menu.getByRole("menuitem", { name: /Connectors/ }).click();
  await expect(menu.getByRole("menuitem", { name: /HeyGen/ })).toContainText("On · 1 tools");
  await menu.getByRole("menuitem", { name: /Add a connector/ }).click();
  await expect(box).toHaveValue("Add ___ as a connector");
  await expect(box).toBeFocused();
  expect(await box.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([4, 7]);
  await page.keyboard.type("HeyGen");
  await expect(box).toHaveValue("Add HeyGen as a connector");
  await box.fill("");

  // Plugins are the skills; picking one puts its slash command in front of the message.
  await plus.click();
  await menu.getByRole("menuitem", { name: /Plugins/ }).click();
  await menu.getByRole("menuitem", { name: /pdf-report/ }).click();
  await expect(box).toHaveValue("/pdf-report ");
  await expect(box).toBeFocused();
  await page.keyboard.type("one for Q3");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({ text: "Use the “pdf-report” skill: one for Q3" });

  // Typing "/" lists the commands; one without its words asks for them instead of sending.
  await box.fill("/st");
  const pop = page.getByRole("list", { name: "Slash commands" });
  await expect(pop.getByRole("button")).toHaveText([/\/status/, /\/stop/]);
  await pop.getByRole("button", { name: /\/status/ }).click();
  await expect(box).toHaveValue("/status ");
  await expect(box).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({ text: "What's the status of the city?" });
  await box.fill("/connect");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Add the service after /connect")).toBeVisible();
  await expect(box).toHaveValue("/connect");
  await box.fill("");

  // Files go into the knowledge base; the chips show their status; the message names them for VAIC.
  await plus.click();
  await menu.getByRole("menuitem", { name: /Add files or photos/ }).click();
  await page
    .locator(".plus input[type=file]")
    .first()
    .setInputFiles([
      { name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 brief") },
      { name: "whiteboard.png", mimeType: "image/png", buffer: Buffer.from("png") },
    ]);
  const chips = page.getByRole("list", { name: "Attached to your message" });
  await expect(chips.getByRole("listitem")).toHaveCount(2);
  await expect(chips.getByRole("listitem").filter({ hasText: "brief.pdf" }).getByRole("status")).toHaveText("Ready");
  await expect(chips.getByRole("listitem").filter({ hasText: "whiteboard.png" }).getByRole("status")).toHaveText(
    "Ready",
  );
  expect(m.knowledge.puts).toHaveLength(2);
  await shot(page, "plus-attached");
  // Removing a chip deletes the item it made.
  await chips.getByRole("button", { name: "Remove whiteboard.png" }).click();
  await expect(chips.getByRole("listitem")).toHaveCount(1);
  await expect
    .poll(() => m.calls.filter((c) => c.method === "DELETE" && c.path.startsWith("/knowledge/")).length)
    .toBe(1);
  await box.fill("What does the brief ask for?");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({
      text: "What does the brief ask for?\n\nAttached (now in my knowledge base): “brief.pdf” (document, ready).",
    });
  await expect(chips).toHaveCount(0);
  // The file stays in Knowledge afterwards.
  await page.goto("/#/knowledge");
  await expect(page.getByRole("listitem").filter({ hasText: "brief.pdf" })).toBeVisible();
});

test("Settings → Departments: a setup guide, shared tools, nine departments; a switch connects a tool and asks to sign in", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/departments");
  const section = page.getByRole("region", { name: "Departments" });
  // The guide comes first and counts the essential tools.
  const guide = section.locator(".setup-guide");
  await expect(guide).toHaveAttribute("open", "");
  await expect(guide.getByText(/^0 of \d+ essential tools connected$/)).toBeVisible();
  await expect(guide.getByRole("link", { name: "Knowledge" })).toHaveAttribute("href", "#/knowledge");
  for (const name of [
    "Shared by every department",
    "Application",
    "IT Infrastructure",
    "Data & AI",
    "Marketing",
    "Sales",
    "Customer Support",
    "Finance",
    "Legal",
    "Product",
    "Operations",
    "Research",
    "Media",
  ])
    await expect(section.getByRole("heading", { name, exact: true })).toBeVisible();

  // Marketing: open it; its skills and its essential tools, each with a Create an account link.
  const marketing = section.locator("details.preset", {
    has: page.getByRole("heading", { name: "Marketing", exact: true }),
  });
  await marketing.getByRole("heading", { name: "Marketing" }).click();
  await expect(marketing.getByText(/Design · Video & voice/)).toBeVisible();
  await marketing.getByText(/skills built in/).click();
  await expect(marketing.getByText("canva-design", { exact: true })).toBeVisible();
  const essentials = marketing.getByRole("list", { name: "Marketing essential tools" });
  await expect(essentials.getByRole("checkbox")).toHaveCount(4);
  await expect(essentials.getByRole("link", { name: "Create a Canva account" })).toHaveAttribute(
    "href",
    "https://www.canva.com/signup/",
  );

  // Canva: off → on adds the connector, and its sign-in shows right there.
  const canva = essentials.getByRole("checkbox", { name: "Canva" });
  await essentials.getByText("Canva", { exact: true }).click();
  await expect(canva).toBeChecked();
  expect(m.calls.filter((c) => c.path === "/connectors" && c.method === "POST").at(-1)?.body).toEqual({
    url: "https://mcp.canva.com/mcp",
    label: "Canva",
  });
  await expect(essentials.getByText("Needs you to sign in")).toBeVisible();
  await expect(essentials.getByRole("button", { name: /Sign in/ })).toBeVisible();
  await shot(page, "settings-departments");
  await noSeriousA11y(page, "Settings → Departments");

  // On → off asks first, then removes it.
  await essentials.getByText("Canva", { exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove connector" }).click();
  await expect(canva).not.toBeChecked();
  expect(m.calls.some((c) => c.method === "DELETE" && c.path === "/connectors/canva")).toBe(true);

  // A store-specific tool asks for the store's name first and fills it into the link.
  const support = section.locator("details.preset", {
    has: page.getByRole("heading", { name: "Customer Support", exact: true }),
  });
  await support.getByRole("heading", { name: "Customer Support" }).click();
  const shop = support.getByRole("checkbox", { name: "Shopify (store)" });
  await expect(shop).toBeDisabled();
  await support.getByLabel(/Your store's name/).fill("Lamo-Shop");
  await support.getByText("Shopify (store)", { exact: true }).click();
  expect(m.calls.filter((c) => c.path === "/connectors" && c.method === "POST").at(-1)?.body).toEqual({
    url: "https://lamo-shop.myshopify.com/api/mcp",
    label: "Shopify (store)",
  });
  await expect(shop).toBeChecked();
});

test("Settings is a menu of pages, each with its own address and a way back; Appearance switches to light and back", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  const menu = page.getByRole("navigation", { name: "Settings pages" });
  await expect(menu.getByRole("link")).toHaveText([
    /^Company/,
    /^Executives/,
    /^While I'm away/,
    /^General/,
    /^Departments & tools/,
    /^Connectors/,
    /^GitHub/,
    /^VAIC's voice/,
    /^Apps/,
    /^Limits & spending/,
    /^Start over/,
  ]);
  // Nothing of the pages themselves on the menu: no switches, no fields, no Save.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  await shot(page, "settings-menu");
  await noSeriousA11y(page, "Settings menu");

  // Into a page and back: the address follows, so the browser's Back works too.
  await menu.getByRole("link", { name: /^Departments & tools/ }).click();
  await expect(page).toHaveURL(/#\/settings\/departments$/);
  await expect(page.getByRole("heading", { name: "Departments & tools", level: 1 })).toBeVisible();
  await expect(page.locator(".setup-guide")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("navigation", { name: "Settings pages" })).toBeVisible();
  await menu.getByRole("link", { name: /^Connectors/ }).click();
  await expect(page.getByRole("heading", { name: "Connectors", level: 1 })).toBeVisible();
  await expect(page.locator(".setup-guide")).toHaveCount(0); // the switches live on their own page
  await page.getByRole("link", { name: "‹ Settings" }).click();
  await expect(page).toHaveURL(/#\/settings$/);

  // General → Appearance: Light now, remembered on this device; Dark again.
  await menu.getByRole("link", { name: /^General/ }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked(); // the default look
  await page.getByText("Light", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
  await page.waitForTimeout(400); // the pill finishes its slide
  await shot(page, "settings-general-light");
  await noSeriousA11y(page, "Settings in light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/#/vaic");
  await noSeriousA11y(page, "VAIC in light");
  await shot(page, "vaic-light");
  await page.goto("/#/settings/general");
  await page.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("dictation: × puts the box back as it was, and send goes out at once without stopping first", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __partials: string[]; __heard: string; __micHold: boolean };
    w.__partials = ["book a"];
    w.__heard = "book a table for two";
  });
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await box.fill("Hi,");
  await page.getByRole("button", { name: "Dictate into the box" }).click();
  await expect(box).toHaveValue("Hi, book a table for two");
  await page.getByRole("button", { name: "Cancel dictation" }).click();
  await expect(box).toHaveValue("Hi,"); // exactly what was there before
  await expect(page.getByRole("group", { name: "Dictation" })).toHaveCount(0);
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(0);

  await box.fill("");
  await page.getByRole("button", { name: "Dictate into the box" }).click();
  await expect(box).toHaveValue("book a table for two");
  await page.getByRole("group", { name: "Dictation" }).getByRole("button", { name: "Send to VAIC" }).click();
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({ text: "book a table for two" });
  await expect(page.getByRole("group", { name: "Dictation" })).toHaveCount(0); // listening stopped
  await expect(box).toHaveValue("");
});

test("dictation: stop keeps the words still being heard, to edit, send with Enter or dictate more", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __partials: string[]; __micHold: boolean };
    w.__partials = ["make this into a solution"];
    w.__micHold = true; // the recognizer never finalises: only the live words are on screen
  });
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await page.getByRole("button", { name: "Dictate into the box" }).click();
  await expect(box).toHaveValue("make this into a solution");
  await page.getByRole("button", { name: "Stop dictating" }).click();
  await expect(page.getByRole("group", { name: "Dictation" })).toHaveCount(0);
  await expect(box).toHaveValue("make this into a solution"); // kept, not wiped
  await expect(box).toBeFocused();
  await box.press("End");
  await box.pressSequentially(", please");
  await expect(box).toHaveValue("make this into a solution, please");

  // Dictate again: the new words go after what is there.
  await page.evaluate(() => {
    (window as unknown as { __partials: string[] }).__partials = ["and test it"];
  });
  await page.getByRole("button", { name: "Dictate into the box" }).click();
  await expect(box).toHaveValue("make this into a solution, please and test it");
  await page.getByRole("button", { name: "Stop dictating" }).click();
  await box.press("Enter");
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({ text: "make this into a solution, please and test it" });
});

test("the logo is the owner's eye with no background, in the top bar and the browser tab, in both themes", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/");
  const brand = page.getByRole("link", { name: "VAIC — the City" });
  await expect(brand).toBeVisible();
  await expect(brand.locator(".wm-word")).toHaveText("VAIC");
  const look = () =>
    brand.locator(".wm-eye").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        fill: s.backgroundColor,
        text: getComputedStyle(document.body).color,
        mask: s.maskImage || s.webkitMaskImage,
      };
    });
  const dark = await look();
  expect(dark.mask).toContain("/eye.svg");
  // the eye takes the HUD's text colour: light on the dark theme, dark on the light one
  const lum = (c: string) =>
    c
      .match(/\d+/g)!
      .slice(0, 3)
      .reduce((a, n) => a + Number(n), 0);
  expect(lum(dark.fill)).toBeGreaterThan(600);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  expect(lum((await look()).fill)).toBeLessThan(200);
  // the tab icon: one SVG with no background shape that switches colour with the browser's theme
  // (at new file names, so the old amber icon a browser cached is dropped: decision 173), and the tab says VAIC
  await expect(page).toHaveTitle("VAIC");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", "/vaic-icon.svg");
  for (const png of ["/vaic-icon-dark.png", "/vaic-icon-light.png"])
    expect((await page.request.get(png)).headers()["content-type"]).toContain("image/png");
  expect((await page.request.get("/favicon.svg")).headers()["content-type"] ?? "").not.toContain("svg");
  const svg = await (await page.request.get("/vaic-icon.svg")).text();
  expect(svg).toContain("prefers-color-scheme:dark");
  expect(svg).not.toMatch(/<rect|<circle/);
  expect((await page.request.get("/eye.svg")).ok()).toBe(true);
});
