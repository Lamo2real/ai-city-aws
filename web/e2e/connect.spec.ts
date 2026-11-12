// Connectors, mail accounts and skills, the way the owner meets them: cards under VAIC's chat, Settings →
// Connectors, the Skills screen. Every backend is mocked (mock.ts); provider sign-in pages are faked too.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

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
  await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yours", exact: true }).click();
  await expect(page.getByText("No skills yet.")).toBeVisible();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Upload a skill/ }).click();
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
  expect(post.roles).toEqual(["vaic", "orchestrator", "manager"]);
  expect(post.files.map((f) => f.path)).toEqual(["SKILL.md"]);
  expect(Buffer.from(post.files[0]!.content_base64, "base64").toString()).toBe(SKILL);
  const card = page.getByRole("article", { name: "Skill pdf-report" });
  await expect(card).toBeVisible();
  await card.getByLabel("Planner").uncheck();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/skills/pdf-report" && c.method === "PUT")?.body)
    .toEqual({ roles: ["vaic", "manager"] });
  await card.getByRole("button", { name: "Remove…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove skill" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/skills/pdf-report" && c.method === "DELETE")).toBe(true);
  await expect(page.getByText("No skills yet.")).toBeVisible();
});

test("adding an MCP server by asking VAIC: approve the card, sign in, come back connected", async ({
  page,
  context,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  m.send({
    type: "approval.requested",
    id: "ap-9",
    agent: "vaic",
    kind: "connector.add",
    connector_id: "higgsfield",
    action:
      "Connect Higgsfield? You sign in on Higgsfield's own page; your password never comes to AI City. (https://mcp.higgsfield.test/mcp, from the MCP Registry. Used by: VAIC, Managers, Workers.)",
    reason: "Your agents can then use it for you. You can remove it any time in Settings, Connectors.",
  });
  const approve = page.getByRole("group", { name: "Connect a service?" });
  await expect(approve).toContainText("Connect Higgsfield?");
  await approve.getByRole("button", { name: "Connect" }).click();
  await expect.poll(() => m.calls.find((c) => c.path === "/approvals/ap-9")?.body).toEqual({ approved: true });
  m.send({ type: "approval.decided", id: "ap-9", approved: true });
  await expect(approve).toHaveCount(0);
  m.send({ type: "connector.updated", id: "higgsfield", label: "Higgsfield", status: "needs_login", auth: "oauth" });
  const tab = context.waitForEvent("page");
  await page.getByRole("button", { name: "Sign in to Higgsfield" }).click();
  const popup = await tab;
  await expect.poll(() => popup.url()).toContain("auth.provider.test");
  expect(m.calls.some((c) => c.path === "/connectors/higgsfield/login")).toBe(true);
  expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem("vaic.connect")))!)).toEqual({
    kind: "connector",
    id: "higgsfield",
    state: "st-1",
    completePath: "/connectors/higgsfield/login/complete",
  });
  await popup.close();
  // AgentCore Identity sends the owner back to the HUD.
  await page.goto("/?connect=return&session_uri=urn%3Asess%3A1#/vaic");
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/higgsfield/login/complete")?.body)
    .toEqual({ state: "st-1", session_uri: "urn:sess:1" });
  await expect(page.getByText("Signed in. It's connected.")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("a plain request offers the service it needs, and VAIC carries on once it is connected", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByLabel("Message to VAIC").fill("find designer jobs in Stockholm on Indeed");
  await page.keyboard.press("Enter");
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  // VAIC offers Indeed: a card in plain words, no jargon.
  m.send({
    type: "approval.requested",
    id: "ap-3",
    agent: "vaic",
    kind: "connector.add",
    connector_id: "indeed",
    action:
      "Connect Indeed so I can look for jobs? You sign in on Indeed's own page; your password never comes to AI City. (https://mcp.indeed.com/claude/mcp, checked by AI City. Used by: VAIC, Managers, Workers.)",
    reason: "Your agents can then use it for you. You can remove it any time in Settings, Connectors.",
  });
  const card = page.getByRole("group", { name: "Connect a service?" });
  await expect(card).toContainText("Connect Indeed so I can look for jobs?");
  await expect(card).not.toContainText(/connector|MCP/);
  await card.getByRole("button", { name: "Connect" }).click();
  m.send({ type: "approval.decided", id: "ap-3", approved: true });
  m.send({ type: "connector.updated", id: "indeed", label: "Indeed", status: "needs_login", auth: "oauth" });
  await expect(page.getByRole("button", { name: "Sign in to Indeed" })).toBeVisible();
  // Signed in elsewhere; once it is ready VAIC picks the request up again, by itself, once.
  m.send({ type: "connector.updated", id: "indeed", label: "Indeed", status: "ready", auth: "oauth" });
  m.send({ type: "connector.updated", id: "indeed", label: "Indeed", status: "ready", auth: "oauth" });
  await expect
    .poll(() => m.calls.filter((c) => c.path === "/messages").map((c) => (c.body as { text: string }).text))
    .toEqual([
      "find designer jobs in Stockholm on Indeed",
      "Indeed is connected now. Please carry on with: find designer jobs in Stockholm on Indeed",
    ]);
});

test("a connect card waiting in the chat doesn't stop the conversation: later turns go below it, and it still works", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const box = page.getByLabel("Message to VAIC");
  const say = async (text: string) => {
    await box.fill(text);
    await page.keyboard.press("Enter");
    await expect
      .poll(() => m.calls.filter((c) => c.path === "/messages").map((c) => (c.body as { text: string }).text))
      .toContain(text);
  };
  await say("add the Tavily MCP");
  m.send({ type: "connector.updated", id: "tavily", label: "Tavily", status: "needs_key", auth: "api_key" });
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "Tavily needs its key, Sir: the safe field is in the chat.",
    done: true,
  });
  const card = page.getByRole("form", { name: "Add the key for Tavily" });
  await expect(card).toBeVisible();
  // The owner carries on talking while the card waits: the box still sends, and VAIC still answers.
  await expect(box).toBeEnabled();
  await say("what's on today?");
  m.send({ type: "vaic.reply", conversation: "main", text: "Two meetings today, Sir.", done: true });
  const later = page.getByText("Two meetings today, Sir.");
  await expect(later).toBeVisible();
  // In order: the first reply, then the card, then the new message and its reply, below the card.
  const y = async (l: ReturnType<Page["getByText"]>) => (await l.boundingBox())!.y;
  const first = page.getByText("Tavily needs its key, Sir");
  const asked = page.locator(".msg-owner").getByText("what's on today?");
  expect(await y(first)).toBeLessThan(await y(card));
  expect(await y(card)).toBeLessThan(await y(asked));
  expect(await y(asked)).toBeLessThan(await y(later));
  // A reload (or a sign-in tab that came back) keeps the card where it was (the owner, 2026-11-10).
  await page.reload();
  await expect(card).toBeVisible();
  expect(await y(page.getByText("Tavily needs its key, Sir"))).toBeLessThan(await y(card));
  // And the card still works afterwards.
  await card.getByLabel(/key/i).first().fill("tvly-LATER-KEY-123456");
  await card.getByRole("button", { name: "Save securely" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/tavily/key")?.body)
    .toEqual({ api_key: "tvly-LATER-KEY-123456" });
});

test("Higgsfield end to end: no account yet, sign up on its own site, come back, and it's live", async ({
  page,
  context,
}) => {
  const m = await mockBackend(page);
  await context.route("https://higgsfield.ai/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<title>Create your Higgsfield account</title>" }),
  );
  await page.goto("/#/vaic");
  m.send({ type: "connector.updated", id: "higgsfield", label: "Higgsfield", status: "needs_login", auth: "oauth" });
  const card = page.getByRole("group", { name: "Sign in to Higgsfield" });
  // No account: the service's own, checked sign-up page, in a new tab.
  const signup = card.getByRole("link", { name: "Create one on Higgsfield's site" });
  await expect(signup).toHaveAttribute("href", "https://higgsfield.ai/auth/sign-up");
  await expect(signup).toHaveAttribute("target", "_blank");
  const tab = context.waitForEvent("page");
  await signup.click();
  const site = await tab;
  await expect.poll(() => site.title()).toBe("Create your Higgsfield account");
  // The owner signs up and signs in over there; meanwhile the city's event was missed (a sleeping tab).
  m.connectors = [
    {
      id: "higgsfield",
      label: "Higgsfield",
      url: "https://mcp.higgsfield.ai/mcp",
      status: "ready",
      tools: [{ name: "generate_video" }],
    },
  ];
  await site.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const live = page.getByRole("status", { name: "Higgsfield is connected" });
  await expect(live).toBeVisible();
  await expect(live.locator(".live-dot")).toHaveCSS("animation-name", "live-pulse");
  await expect(page.getByText("Higgsfield is connected, you're all set.")).toBeVisible();
  await expect(page.getByText("Higgsfield is connected, you're all set.")).toHaveCount(1);
  // Settings shows the same, with the live dot; it stands still for an owner who prefers less motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/settings/connectors");
  const row = page.getByRole("table", { name: "Connected tools" }).getByRole("row", { name: /Higgsfield.*Connected/ });
  await expect(row.locator(".live-dot")).toHaveCSS("animation-name", "none");
  await noSeriousA11y(page, "connected live");
});

test("a failed connection shows its reason in full, in the chat and in Settings", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  m.send({ type: "connector.updated", id: "acme", label: "Acme", status: "needs_login", auth: "oauth" });
  const why = "Acme's sign-in page answered 400: redirect_uri is not registered for this client.";
  m.send({ type: "connector.updated", id: "acme", label: "Acme", status: "error", error: why });
  await expect(page.getByRole("alert", { name: "Acme didn't connect" })).toContainText(`Acme didn't connect: ${why}`);
  m.connectors = [{ id: "acme", label: "Acme", url: "https://mcp.acme.test/mcp", status: "error", error: why }];
  await page.goto("/#/settings/connectors");
  await expect(page.getByRole("table", { name: "Connected tools" }).getByRole("row", { name: /Acme/ })).toContainText(
    `Problem: ${why}`,
  );
});

test("an API key goes into a secure field, never the chat", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByLabel("Message to VAIC").fill("my tavily key is tvly-AbCdEf1234567890");
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
  await page.goto("/#/vaic");
  m.send({ type: "connect.signin", account_id: "ma-1", provider: "imap", label: "Fastmail" });
  const form = page.getByRole("form", { name: "Add the app password for Fastmail" });
  await form.getByRole("combobox", { name: "Fill in the servers for" }).click();
  await page.getByRole("option", { name: "Fastmail" }).click();
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
  await expect(page.getByRole("status", { name: "Fastmail is connected" }).locator(".live-dot")).toBeVisible();
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
      roles: { vaic: "read", worker: "all" },
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
  await page.goto("/#/settings/connectors");
  const table = page.getByRole("table", { name: "Connected tools" });
  await expect(table.getByRole("row", { name: /GitHub.*MCP.*Application.*Connected/ }).first()).toBeVisible();
  await table
    .getByRole("button", { name: /^GitHub/ })
    .first()
    .click();
  const gh = page.getByRole("article", { name: "Connector GitHub" });
  await expect(gh).toContainText("On · 1 tools");
  await gh.getByRole("combobox", { name: "Managers" }).click();
  await page.getByRole("option", { name: "Read only" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/github" && c.method === "PUT")?.body)
    .toEqual({ roles: { vaic: "read", worker: "all", manager: "read" } });
  await table.getByRole("button", { name: /^Personal/ }).click();
  await expect(page.getByRole("article", { name: "Personal account" })).toContainText("me@gmail.test");
  await expect(page.getByRole("heading", { name: "Who may use mail" })).toBeVisible();
  expect(await primaries(page)).toBeLessThanOrEqual(1);
  await noSeriousA11y(page, "settings connectors");
  await page.screenshot({ path: `${SHOTS}/connectors-connected.png`, fullPage: true });
});

test("Settings → Connectors: browse a department's tools, connect in one click, sign in, and it shows as connected", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/connectors");
  await expect(page.getByText(/No tools connected yet/)).toBeVisible();
  await page.getByRole("button", { name: "Browse tools" }).click();
  await expect(page.getByRole("button", { name: "Browse", pressed: true })).toBeVisible();
  // Every department has its own section, with its tools.
  const support = page.getByRole("region", { name: "Customer Support tools" });
  await expect(support.getByRole("heading", { name: "Customer Support" })).toBeVisible();
  await expect(support.getByRole("listitem", { name: "Freshdesk" })).toBeVisible();
  const src = await page
    .getByRole("region", { name: "Every department tools" })
    .getByRole("listitem", { name: "Stripe" })
    .locator("img")
    .getAttribute("src");
  expect(src).toBe("/logos/stripe.svg"); // logos come from the HUD's own origin
  expect((await page.request.get(src!)).ok()).toBe(true);
  await noSeriousA11y(page, "connectors browse");
  await page.screenshot({ path: `${SHOTS}/connectors-browse.png` });

  // One department: its tools, its essentials, what it knows how to do.
  await page.getByRole("group", { name: "Department" }).getByRole("button", { name: "Sales" }).click();
  await expect(page.getByRole("region", { name: "Customer Support tools" })).toHaveCount(0);
  const sales = page.getByRole("region", { name: "Sales tools" });
  await expect(sales.getByRole("listitem", { name: "HubSpot" })).toContainText("Essential");
  await sales.getByText(/What Sales knows how to do/).click();
  await expect(sales.getByText("lead-research")).toBeVisible();

  const hubspot = sales.getByRole("listitem", { name: "HubSpot" });
  await hubspot.getByRole("button", { name: "Connect HubSpot" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors" && c.method === "POST")?.body)
    .toMatchObject({ label: "HubSpot" });
  await expect(hubspot.getByRole("button", { name: /Sign in to HubSpot/ })).toBeVisible();
  await page.getByRole("button", { name: "Connected", exact: true }).click();
  const row = page.getByRole("table", { name: "Connected tools" }).getByRole("row", { name: /HubSpot/ });
  await expect(row).toContainText("Sales");
  await row.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("article", { name: "Connector HubSpot" })).toBeVisible();
  m.connectors[0]!.status = "ready";
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Connected tools" }).getByRole("row", { name: /HubSpot.*Connected/ }),
  ).toBeVisible();
  // Sales still needs its other essentials; each connects from here.
  await page.getByRole("group", { name: "Department" }).getByRole("button", { name: "Sales" }).click();
  await expect(page.getByRole("list", { name: "Sales essentials not connected" }).getByRole("listitem")).toHaveCount(3);
});

test("Settings → Connectors: search narrows connected tools, the catalog and skills", async ({ page }) => {
  const m = await mockBackend(page);
  m.connectors = [
    { id: "stripe", label: "Stripe", url: "https://mcp.stripe.com", status: "ready", tools: [] },
    { id: "acme", label: "Acme", url: "https://mcp.acme.test/mcp", status: "needs_key", auth: "api_key" },
  ];
  await page.goto("/#/settings/connectors");
  const table = page.getByRole("table", { name: "Connected tools" });
  await expect(table.getByRole("row", { name: /Acme.*Your own.*Add its key/ })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search tools and skills" });
  await search.fill("strip");
  await expect(table.getByRole("row", { name: /Stripe/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Acme/ })).toHaveCount(0);
  await search.fill("zzz-nothing");
  await expect(page.getByText('Nothing connected matches "zzz-nothing".')).toBeVisible();
  await page.getByRole("button", { name: "Search the catalog instead" }).click();
  await search.fill("video");
  await expect(
    page.getByRole("region", { name: "Media tools" }).getByRole("listitem", { name: "Vimeo" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Finance tools" })).toHaveCount(0);
  await search.fill("jira"); // other names count too
  await expect(page.getByRole("listitem", { name: "Jira & Confluence" }).first()).toBeVisible();
});

test("Settings → Connectors: + Add a tool by link, write a skill", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/connectors");
  const add = page.getByRole("button", { name: "Add", exact: true });
  await add.click();
  const menu = page.getByRole("menu", { name: "Add" });
  await expect(menu.getByRole("menuitem")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await add.click();
  await menu.getByRole("menuitem", { name: /Tool by link/ }).click();
  const form = page.getByRole("group", { name: "Add a tool by its link" });
  await form.getByLabel(/https link/).fill("http://not-secure.test");
  await expect(form.getByRole("button", { name: "Add tool" })).toBeDisabled();
  await form.getByLabel(/https link/).fill("https://mcp.acme.test/mcp");
  await form.getByRole("button", { name: "Add tool" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors" && c.method === "POST")?.body)
    .toEqual({ url: "https://mcp.acme.test/mcp" });
  await expect(
    page.getByRole("table", { name: "Connected tools" }).getByRole("row", { name: /Your own/ }),
  ).toBeVisible();

  await add.click();
  await menu.getByRole("menuitem", { name: /Write a skill/ }).click();
  await page.getByLabel("Name (lowercase, dashes)").fill("weekly-report");
  await page.getByLabel("When to use it (one sentence)").fill("Use when writing the Friday report");
  await page.getByLabel("Instructions").fill("1. List what shipped.\n2. Keep it short.");
  await noSeriousA11y(page, "write a skill");
  await page.getByRole("button", { name: "Save skill" }).click();
  await expect.poll(() => m.calls.some((c) => c.path === "/skills" && c.method === "POST")).toBe(true);
  const post = m.calls.find((c) => c.path === "/skills" && c.method === "POST")!.body as {
    roles: string[];
    files: Array<{ path: string; content_base64: string }>;
  };
  expect(post.roles).toEqual(["vaic", "orchestrator", "manager", "worker"]);
  expect(Buffer.from(post.files[0]!.content_base64, "base64").toString()).toBe(
    "---\nname: weekly-report\ndescription: Use when writing the Friday report\n---\n\n1. List what shipped.\n2. Keep it short.\n",
  );
  await expect(
    page.getByRole("table", { name: "Your skills" }).getByRole("row", { name: /pdf-report.*Your own.*On/ }),
  ).toBeVisible();
});

test("Settings → Connectors at phone width: switch, search, + Add and departments fit; rows stack", async ({
  page,
}) => {
  const m = await mockBackend(page);
  m.connectors = [{ id: "stripe", label: "Stripe", url: "https://mcp.stripe.com", status: "ready", tools: [] }];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/settings/connectors");
  await expect(page.getByRole("table", { name: "Connected tools" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sales tools" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.waitForTimeout(400); // the switch eases between its two states
  await page.screenshot({ path: `${SHOTS}/connectors-phone.png` });
});

test("an email waiting for approval is shown in full before it's sent", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/inbox");
  m.send({
    type: "approval.requested",
    id: "ap-2",
    agent: "vaic",
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
