// Settings → GitHub and the GitHub connector, the way the owner meets them (docs/GITHUB_ACCESS.md). The backend
// is mocked (mock.ts).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const TOKEN = "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("Settings → GitHub: a token is saved once, says Connected as, is never shown back, and can be removed", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/settings/github");
  await expect(page.getByRole("heading", { name: "GitHub", level: 1 })).toBeVisible();
  await expect(page.getByText(/No token yet/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Integrations" })).toHaveCount(0); // the dead switches are gone
  await page.getByRole("button", { name: "Add a GitHub token" }).click();
  const field = page.getByLabel("GitHub token", { exact: true });
  await expect(field).toHaveAttribute("type", "password");
  await field.fill("not-a-token");
  await page.getByRole("button", { name: "Save the GitHub token" }).click();
  await expect(page.getByText("Paste the whole GitHub token (it starts with ghp_ or github_pat_).")).toBeVisible();
  await field.fill("ghp_rejectedrejectedrejectedrejected");
  await page.getByRole("button", { name: "Save the GitHub token" }).click();
  await expect(page.getByText(/GitHub rejected the token/)).toBeVisible();
  await field.fill(TOKEN);
  await page.getByRole("button", { name: "Save the GitHub token" }).click();
  await expect(page.getByText(/^Connected as lamo2real/)).toBeVisible();
  await expect(page.getByLabel("GitHub token", { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(TOKEN);
  expect(m.calls.filter((c) => c.path === "/github/token" && c.method === "PUT").at(-1)?.body).toEqual({
    token: TOKEN,
  });
  expect(await page.locator(".btn-primary:visible").count()).toBeLessThanOrEqual(1);
  await noSeriousA11y(page, "settings github");
  await page.getByRole("button", { name: "Remove the GitHub token…" }).click();
  await page.getByRole("button", { name: "Remove the token" }).click();
  await expect(page.getByText(/No token yet/)).toBeVisible();
  expect(m.calls.some((c) => c.path === "/github/token" && c.method === "DELETE")).toBe(true);
});

test("a GitHub sign-in card offers a token instead, which goes to the connector's key route", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/");
  m.send({
    type: "connector.updated",
    id: "github",
    label: "GitHub",
    status: "needs_login",
    auth: "oauth",
    oauth_host: "github.com",
  });
  await expect(page.getByRole("button", { name: "Sign in to GitHub" })).toBeVisible();
  await page.getByRole("button", { name: "I have a token instead" }).click();
  const card = page.getByRole("form", { name: "Paste a GitHub token for GitHub" });
  await card.getByLabel("Key").fill(TOKEN);
  await card.getByRole("button", { name: "Save securely" }).click();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/connectors/github/key" && c.method === "PUT")?.body)
    .toEqual({ api_key: TOKEN });
  m.send({ type: "connector.updated", id: "github", label: "GitHub", status: "ready", auth: "api_key" });
  const live = page.getByRole("status", { name: "GitHub is connected" });
  await expect(live).toBeVisible();
  await expect(live.locator(".live-dot")).toBeVisible();
});
