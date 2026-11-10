// Shared by connector-cards.spec.ts (desktop) and phone.spec.ts: one tool in every card state, and the checks
// that everything stays inside its card (decision 179).
import { expect, type Page } from "@playwright/test";
import type { Mock } from "./mock.ts";

const LONG_ERROR =
  "The server answered 403 Forbidden for https://mcp.notion.com/mcp/v1/workspaces/0f3c9a7e-1b2d-4c5e-8f9a-aaaaaaaaaaaaaaaaaaaaaaaaaaaa/tools?include=everything";

/** One tool in each state: key form, app id and secret, sign-in, connected, a long error, and a very long name. */
export function everyCardState(m: Mock) {
  m.connectors = [
    {
      id: "atlassian",
      label: "Jira & Confluence (Acme Corporation International Holdings Production Workspace)",
      url: "https://mcp.atlassian.com/v1/mcp",
      status: "needs_key",
      auth: "api_key",
    },
    {
      id: "slack",
      label: "Slack",
      url: "https://mcp.slack.com/mcp",
      status: "needs_key",
      auth: "oauth",
      needs: "oauth_client",
    },
    { id: "zapier", label: "Zapier", url: "https://mcp.zapier.com/api/v1/connect", status: "needs_login" },
    { id: "notion", label: "Notion", url: "https://mcp.notion.com/mcp", status: "error", error: LONG_ERROR },
    { id: "stripe", label: "Stripe", url: "https://mcp.stripe.com", status: "ready", tools: [] },
  ];
}

/** Every element of every catalog card lies inside its card, and nothing on the page scrolls sideways. */
export async function cardsFit(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const card of document.querySelectorAll<HTMLElement>(".hub-card")) {
      const c = card.getBoundingClientRect();
      for (const el of card.querySelectorAll<HTMLElement>("*")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.left < c.left - 0.5 || r.right > c.right + 0.5)
          out.push(
            `${card.getAttribute("aria-label")}: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.left)}–${Math.round(r.right)} outside ${Math.round(c.left)}–${Math.round(c.right)}`,
          );
      }
      for (const el of [card, ...card.querySelectorAll<HTMLElement>("*")])
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
          out.push(
            `${card.getAttribute("aria-label")}: <${el.tagName.toLowerCase()} class="${el.className}"> scrolls sideways`,
          );
    }
    if (document.documentElement.scrollWidth > window.innerWidth) out.push("the page scrolls sideways");
    const main = document.querySelector("main");
    if (main && main.scrollWidth > main.clientWidth + 1) out.push("main scrolls sideways");
    return out;
  });
  expect(bad).toEqual([]);
}

/** The key form's input and Save button stay inside the Jira card. */
export async function keyFormInside(page: Page) {
  const card = page
    .getByRole("region", { name: "Every department tools" })
    .getByRole("listitem", { name: "Jira & Confluence" });
  const input = card.getByLabel("Key", { exact: true });
  const save = card.getByRole("button", { name: "Save securely" });
  await expect(input).toBeVisible();
  const c = (await card.boundingBox())!;
  for (const b of [(await input.boundingBox())!, (await save.boundingBox())!]) {
    expect(b.x).toBeGreaterThanOrEqual(c.x);
    expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width + 0.5);
  }
}
