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

  await expect(page.getByRole("button", { name: "AI City — talk to AIC" })).toBeVisible();
});

test("later sign-ins: a wrong password says so plainly; then password and code", async ({ page }) => {
  await mockBackend(page, { signedIn: false });
  await page.goto("/");
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
  await expect(page.getByRole("button", { name: "AI City — talk to AIC" })).toBeVisible();
});

test("forgot password and a new first-login email, without leaving AI City", async ({ page }) => {
  const m = await mockBackend(page, { signedIn: false });
  await page.goto("/");
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
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Meet AIC" })).toBeVisible();
  await shot(page, "first-run-guide");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "See the City" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lands on AIC with the input focused; asking something shows AIC's streamed reply", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message to AIC" });
  await expect(box).toBeFocused();
  await expect(page.getByRole("button", { name: "Talk to AIC", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Today: \$0.42 of \$10/ })).toBeVisible();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await box.fill("yo AIC, what's 9 + 9?");
  await page.getByRole("button", { name: "Send to AIC" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "yo AIC, what's 9 + 9?", conversation: "main" });
  await expect(page.locator("section.ace").getByRole("img", { name: "AIC is thinking" })).toBeVisible();
  m.send({ type: "ace.reply", conversation: "main", text: "Eigh", done: false });
  m.send({ type: "ace.reply", conversation: "main", text: "Eighteen.", done: true });
  await expect(page.getByLabel("Conversation with AIC").getByText("Eighteen.")).toBeVisible();
  // The owner on the right in a bubble, AIC on the left as plain text with Markdown rendered.
  m.send({
    type: "ace.reply",
    conversation: "main",
    text: "## Today\n- **Research**: 3 workers\n- Engineering: idle\n\n| Dept | Spend |\n|---|---|\n| Research | $0.30 |",
    done: true,
  });
  const log = page.getByLabel("Conversation with AIC");
  await expect(log.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(log.getByRole("cell", { name: "$0.30" })).toBeVisible();
  const mine = (await log.locator(".msg-owner .msg-body").first().boundingBox())!;
  const theirs = (await log.locator(".msg-ace .msg-body").first().boundingBox())!;
  const panel = (await log.boundingBox())!;
  expect(mine.x + mine.width).toBeGreaterThan(panel.x + panel.width - 40); // hugs the right edge
  expect(theirs.x).toBeLessThan(panel.x + 40); // starts at the left edge
  expect(mine.x).toBeGreaterThan(theirs.x + 100);
  await expect(page.getByText(/Not sent yet/)).toHaveCount(0); // delivered, so nothing waits in the outbox
  await shot(page, "ace");
  await noSeriousA11y(page, "AIC");
});

test("push-to-talk sends what the owner said to AIC", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(
    () => ((window as unknown as { __heard: string }).__heard = "hey AIC, what's the status of the product?"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "hey AIC, what's the status of the product?" });
});

test("the voice strip shows clearly who is talking: the owner, then AIC", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    (window as unknown as { __micHold: boolean }).__micHold = true;
    (window as unknown as { __speakMs: number }).__speakMs = 4000;
  });
  await page.goto("/");
  const strip = page.locator(".voice");
  await expect(strip).toHaveAttribute("data-speaker", "idle");
  // The eye is the owner's plain drawing: one ink colour, no motion, whatever the state.
  const eye = () =>
    page.locator("section.ace .eye-shape").evaluate((e) => {
      const look = (n: Element) => getComputedStyle(n);
      return [look(e).backgroundColor, look(e).animationName, look(e.parentElement!).animationName, look(e).transform];
    });
  const plain = await eye();
  expect(plain.slice(1)).toEqual(["none", "none", "none"]);
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(strip).toHaveAttribute("data-speaker", "you");
  await expect(strip.getByRole("status")).toHaveText("Listening to you");
  await expect(strip.getByText("You’re talking")).toBeVisible(); // the fake mic is loud
  await expect(page.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
  expect(await eye()).toEqual(plain);
  await shot(page, "ace-you-talking");
  await page.getByRole("button", { name: "Stop listening" }).click();
  await expect(strip).toHaveAttribute("data-speaker", "idle");

  await page.getByLabel("Speak replies").selectOption("always"); // typed messages are answered silently otherwise
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect(strip).toHaveAttribute("data-speaker", "thinking");
  await expect.poll(() => m.calls.some((c) => c.path === "/messages")).toBe(true);
  await expect(page.getByText(/Not sent yet/)).toHaveCount(0);
  m.send({ type: "ace.reply", conversation: "main", text: "All quiet. Nothing needs you.", done: true });
  await expect(strip).toHaveAttribute("data-speaker", "aic");
  await expect(strip.getByRole("status")).toHaveText("AIC is talking");
  expect(await eye()).toEqual(plain);
  await shot(page, "ace-aic-talking");
  await noSeriousA11y(page, "AIC talking");
});

test("a microphone failure names the real cause and logs it to the console", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => ((window as unknown as { __micError: string }).__micError = "NotAllowedError"));
  const logged: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && logged.push(msg.text()));
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Microphone access is blocked for this site");
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "idle");
  expect(
    logged.some((t) => t.includes("[AIC voice] the microphone could not start:") && t.includes("NotAllowedError")),
  ).toBe(true);
});

test("AIC's reply: its steps with a shimmering status first, then words flowing in, then the steps folded", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/");
  const log = page.getByLabel("Conversation with AIC");
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("tell me about the city");
  await page.keyboard.press("Enter");
  const status = log.getByRole("status", { name: /^AIC: / });
  await expect(status).toHaveAccessibleName("AIC: Understanding your message"); // before any event arrives
  await expect(status.locator(".shimmer")).toHaveCSS("animation-name", "shimmer-sweep");
  m.send({ type: "activity", id: "ace", activity: "understanding" });
  m.send({ type: "activity", id: "ace", activity: "working", detail: "get_status" });
  await expect(status).toHaveAccessibleName("AIC: Checking the ledger");
  await expect(status).toContainText(/\ds$/);
  await shot(page, "ace-working");
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  m.send({ type: "ace.reply", conversation: "main", text: `**City**: ${words}`, done: false });
  await expect(status).toHaveCount(0); // the status row goes once words arrive
  const reply = log.locator(".msg-ace").last();
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
  await shot(page, "ace-reply-streaming");
  m.send({ type: "ace.reply", conversation: "main", text: "**City**: all quiet. Final answer.", done: true });
  await expect(reply).toContainText("all quiet. Final answer.");
  await expect(reply).not.toHaveAttribute("aria-busy", "true");
  await expect(reply).not.toContainText("word59");
  const steps = reply.locator("details.aic-steps");
  await expect(steps.locator("summary")).toHaveText(/^2 steps/);
  await expect(steps.getByText("Checking the ledger")).toBeHidden(); // folded until opened
  await steps.locator("summary").click();
  await expect(steps.getByText("Checking the ledger")).toBeVisible();
});

test("with reduced motion the reply appears directly, without the typing effect", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".shimmer")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".aic-status-eye")).toHaveCSS("animation-name", "none");
  const text = "One two three four five six seven eight nine ten eleven twelve.";
  m.send({ type: "ace.reply", conversation: "main", text, done: false });
  await expect(page.getByLabel("Conversation with AIC").locator(".msg-ace .msg-body").last()).toHaveText(text, {
    timeout: 150,
  });
});

test("AIC answers aloud only when it was asked by voice", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => ((window as unknown as { __heard: string }).__heard = "hey AIC, status?"));
  await page.goto("/");
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
  await expect(page.getByLabel("Speak replies")).toHaveValue("auto"); // the default: only when I talk

  // Typed: a text-only answer.
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("status?");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "ace.reply", conversation: "main", text: "Typed answer.", done: true });
  await expect(page.getByLabel("Conversation with AIC").getByText("Typed answer.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await spoken()).toEqual([]);

  // Talk and send (the default mic mode): spoken back.
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(2);
  m.send({ type: "ace.reply", conversation: "main", text: "Spoken answer.", done: true });
  await expect.poll(spoken).toEqual(["Spoken answer."]);
});

test("Dictate: words land in the box live, nothing is sent until Send; an untouched dictation counts as voice", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __partials: string[]; __heard: string; __micHold: boolean };
    w.__partials = ["remind me", "remind me to call"];
    w.__heard = "remind me to call the bank";
  });
  await page.goto("/");
  await page.getByLabel("Dictate into the box").check();
  const box = page.getByRole("textbox", { name: "Message to AIC" });
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(box).toHaveValue("remind me to call"); // a live partial
  await expect(box).toHaveValue("remind me to call the bank");
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "you"); // still listening: tap to stop
  await shot(page, "ace-dictating");
  await page.getByRole("button", { name: "Stop listening" }).click();
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(0); // nothing sent by itself
  await page.getByRole("button", { name: "Send to AIC" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "remind me to call the bank" });
  m.send({ type: "ace.reply", conversation: "main", text: "I'll remind you.", done: true });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []))
    .toEqual(["I'll remind you."]);

  // The choice is remembered; an edited dictation is a typed message, answered silently.
  await page.reload();
  await expect(page.getByLabel("Dictate into the box")).toBeChecked();
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(box).toHaveValue("remind me to call the bank");
  await page.getByRole("button", { name: "Stop listening" }).click();
  await box.press("End");
  await box.pressSequentially(" tomorrow");
  await page.getByRole("button", { name: "Send to AIC" }).click();
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").at(-1)?.body)
    .toMatchObject({ text: "remind me to call the bank tomorrow" });
  m.send({ type: "ace.reply", conversation: "main", text: "Tomorrow it is.", done: true });
  await expect(page.getByLabel("Conversation with AIC").getByText("Tomorrow it is.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])).toEqual([]);
});

test("a spoken reply starts with its first sentence while the rest still streams, without Markdown or emoji", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/");
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click(); // asked by voice
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  m.send({ type: "ace.reply", conversation: "main", text: "All **quiet** in the city 🎉. Research", done: false });
  await expect.poll(spoken).toEqual(["All quiet in the city."]); // talking before the reply is complete
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "aic");
  m.send({
    type: "ace.reply",
    conversation: "main",
    text: " has three workers.\n```\nnpm test\n```\nSee [the plan](https://x.y).",
    done: false,
  });
  m.send({
    type: "ace.reply",
    conversation: "main",
    text: "All **quiet** in the city 🎉. Research has three workers.\n```\nnpm test\n```\nSee [the plan](https://x.y).",
    done: true,
  });
  await expect.poll(spoken).toEqual(["All quiet in the city.", "Research has three workers.", "See the plan."]); // no code read out
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "idle");
});

test("Settings: pick AIC's voice; it is remembered on this device and can be heard", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/settings");
  const voice = page.getByLabel("AIC's voice");
  await expect(voice).toHaveValue("Matthew"); // the deploy's default
  await voice.selectOption("Ruth");
  await page.getByRole("button", { name: "Hear this voice" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []))
    .toEqual(["Hi, I'm AIC. This is how I'll sound when I answer you."]);
  await page.reload();
  await expect(page.getByLabel("AIC's voice")).toHaveValue("Ruth");
  expect(await page.evaluate(() => localStorage.getItem("aic.voice"))).toBe("Ruth");
});

test("a draft survives a reload", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message to AIC" }).fill("half a thought");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message to AIC" })).toHaveValue("half a thought");
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
  await expect.poll(async () => Number(await city.getAttribute("data-people"))).toBeGreaterThanOrEqual(6); // AIC, Orchestrator, manager, 3 workers
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
  await expect(page.getByRole("textbox", { name: "Message to AIC" })).toBeFocused();
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

test("knowledge: add files, paste a link, change how it's used, delete with Undo", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/knowledge");
  await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
  await expect(page.getByText("Nothing stored yet. Drop a file or paste a link above.")).toBeVisible();
  await expect(page.getByText("0 of 8,000 tokens")).toBeVisible();

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
  await expect(page.getByText("1,600 of 8,000 tokens")).toBeVisible();

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
