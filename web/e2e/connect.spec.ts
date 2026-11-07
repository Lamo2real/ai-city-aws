// Connectors, mail accounts and skills, the way the owner meets them: cards under AIC's chat, Settings →
// Connectors, the Skills screen. Every backend is mocked (mock.ts); provider sign-in pages are faked too.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
const primaries = (page: Page) => page.locator(".btn-primary:visible").count();
const SKILL =
  "---\nname: pdf-report\ndescription: Makes a PDF report\nallowed-tools: Bash\n---\n# Steps\nDo the thing.";

test.beforeEach(async ({ context }) => {
  // The provider's sign-in page, opened in a new tab.
  await context.route("https://*.provider.test/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<title>Sign in</title>" }),
  );
});

test("adding a skill: pick a SKILL.md, see what's dropped, choose who may use it, then edit and delete", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/skills");
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  await expect(page.getByText("No skills yet.")).toBeVisible();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Add skill" }).click();
  await page
    .getByLabel("Choose a SKILL.md")
    .setInputFiles({ name: "SKILL.md", mimeType: "text/markdown", buffer: Buffer.from(SKILL) });
  await expect(page.getByText(/These settings in SKILL.md will be removed: allowed-tools/)).toBeVisible();
  await page.getByRole("group", { name: "Who may use it" }).getByLabel("Workers").uncheck();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await noSeriousA11y(page, "add skill");
  await page.getByRole("button", { name: "Save skill" }).click();
  const post = m.calls.find((c) => c.path === "/skills" && c.method === "POST")!.body as {
    roles: string[];
    files: Array<{ path: string; content_base64: string }>;
  };
  expect(post.roles).toEqual(["ace", "orchestrator", "manager"]);
  expect(post.files.map((f) => f.path)).toEqual(["SKILL.md"]);
  expect(Buffer.from(post.files[0]!.content_base64, "base64").toString()).toBe(SKILL);
  const card = page.getByRole("article", { name: "Skill pdf-report" });
  await expect(card).toBeVisible();
  await card.getByLabel("Orchestrator").uncheck();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/skills/pdf-report" && c.method === "PUT")?.body)
    .toEqual({ roles: ["ace", "manager"] });
  await card.getByRole("button", { name: "Delete…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete skill" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/skills/pdf-report" && c.method === "DELETE")).toBe(true);
  await expect(page.getByText("No skills yet.")).toBeVisible();
});

test("adding an MCP server by asking AIC: approve the card, sign in, come back connected", async ({
  page,
  context,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/ace");
  m.send({
    type: "approval.requested",
    id: "ap-9",
    agent: "ace",
    kind: "connector.add",
    connector_id: "higgsfield",
    action:
      "Add the Higgsfield MCP server at https://mcp.higgsfield.test/mcp (found in the MCP Registry). Used by: AIC, Managers, Workers. Approve?",
    reason: "Adding a connector needs the owner.",
  });
  const approve = page.getByRole("group", { name: "Add a connector?" });
  await expect(approve).toContainText("Higgsfield MCP server");
  await approve.getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => m.calls.find((c) => c.path === "/approvals/ap-9")?.body).toEqual({ approved: true });
  m.send({ type: "approval.decided", id: "ap-9", approved: true });
  await expect(approve).toHaveCount(0);
  m.send({ type: "connector.updated", id: "higgsfield", label: "Higgsfield", status: "needs_login", auth: "oauth" });
  const tab = context.waitForEvent("page");
  await page.getByRole("button", { name: "Sign in to Higgsfield" }).click();
  const popup = await tab;
  await expect.poll(() => popup.url()).toContain("auth.provider.test");
  expect(m.calls.some((c) => c.path === "/connectors/higgsfield/login")).toBe(true);
  expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem("aic.connect")))!)).toEqual({
    kind: "connector",
    id: "higgsfield",
    state: "st-1",
    completePath: "/connectors/higgsfield/login/complete",
  });
  await popup.close();
  // AgentCore Identity sends the owner back to the HUD.
  await page.goto("/?connect=return&session_uri=urn%3Asess%3A1#/ace");
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/higgsfield/login/complete")?.body)
    .toEqual({ state: "st-1", session_uri: "urn:sess:1" });
  await expect(page.getByText("Signed in. It's connected.")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("an API key goes into a secure field, never the chat", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/ace");
  await page.getByLabel("Message to AIC").fill("my tavily key is tvly-AbCdEf1234567890");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/looks like a key or password, so it wasn't sent/)).toBeVisible();
  expect(m.calls.some((c) => c.path === "/messages")).toBe(false);
  m.send({ type: "connector.updated", id: "tavily", label: "Tavily", status: "needs_key", auth: "api_key" });
  const form = page.getByRole("form", { name: "Add the key for Tavily" });
  const key = form.getByLabel("Key");
  await expect(key).toHaveAttribute("type", "password");
  await key.fill("tvly-REAL-KEY-123456");
  await form.getByRole("button", { name: "Save securely" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/tavily/key")?.body)
    .toEqual({ api_key: "tvly-REAL-KEY-123456" });
  await expect(key).toHaveValue("");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain("tvly-REAL-KEY");
});

test("connecting an IMAP mailbox: the app password is checked, then forgotten by the page", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/ace");
  m.send({ type: "connect.signin", account_id: "ma-1", provider: "imap", label: "Fastmail" });
  const form = page.getByRole("form", { name: "Add the app password for Fastmail" });
  await form.getByLabel("Fill in the servers for").selectOption("Fastmail");
  await form.getByLabel("Email address").fill("me@fastmail.com");
  await form.getByLabel("App password").fill("wrong-one");
  await form.getByRole("button", { name: "Connect securely" }).click();
  await expect(form.getByRole("alert")).toContainText("refused the app password");
  await expect(form.getByLabel("App password")).toHaveValue("");
  await form.getByLabel("App password").fill("good-app-password");
  await form.getByRole("button", { name: "Connect securely" }).click();
  const sent = m.calls.filter((c) => c.path === "/mail/accounts/ma-1/imap").at(-1)!.body as Record<string, unknown>;
  expect(sent).toMatchObject({
    address: "me@fastmail.com",
    imap_host: "imap.fastmail.com",
    smtp_host: "smtp.fastmail.com",
  });
  m.send({ type: "mail.account", account: { id: "ma-1", status: "connected" } });
  await expect(page.getByText("Fastmail: connected ✓")).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain("good-app-password");
  expect(await page.content()).not.toContain("good-app-password");
});

test("Settings lists connectors and mail accounts; roles can be changed", async ({ page }) => {
  const m = await mockBackend(page);
  m.connectors = [
    {
      id: "github",
      label: "GitHub",
      url: "https://api.githubcopilot.com/mcp/",
      status: "ready",
      auth: "oauth",
      roles: { ace: "read", worker: "all" },
      approval: "destructive",
      tools: [{ name: "list_issues" }],
    },
  ];
  m.mail = [
    {
      id: "ma-1",
      provider: "google",
      label: "Personal",
      address: "me@gmail.test",
      status: "connected",
      calendars: [{ id: "c1", name: "Me" }],
    },
  ];
  await page.goto("/#/settings");
  const gh = page.getByRole("article", { name: "Connector GitHub" });
  await expect(gh).toContainText("On · 1 tools");
  await gh.getByLabel("Managers").selectOption("read");
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/github" && c.method === "PUT")?.body)
    .toEqual({ roles: { ace: "read", worker: "all", manager: "read" } });
  await expect(page.getByRole("article", { name: "Personal account" })).toContainText("me@gmail.test");
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await noSeriousA11y(page, "settings connectors");
});

test("an email waiting for approval is shown in full before it's sent", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/inbox");
  m.send({
    type: "approval.requested",
    id: "ap-2",
    agent: "ace",
    action: "mcp__city__mail_send account_id, to, subject, body",
    reason: "Sending an email speaks for the owner.",
    preview: {
      kind: "email",
      account: "Work me@work.test",
      to: ["bo@x.test"],
      cc: [],
      bcc: [],
      subject: "Lunch?",
      body: "Hi Bo,\nlunch at 12?",
    },
  });
  const email = page.getByLabel("The email", { exact: true });
  await expect(email).toContainText("bo@x.test");
  await expect(email).toContainText("Lunch?");
  await expect(page.getByLabel("The email's text")).toContainText("lunch at 12?");
  await noSeriousA11y(page, "email preview");
});
