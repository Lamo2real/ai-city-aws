// Decision 173: every connected tool hangs a pixel sign by the doors of the towers whose departments use it, from
// the /city snapshot and live from connector.updated; many tools stay tidy, the rest summed up as "+N".
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

// A 12×12 play-button logo, as the server sends it: "." see-through, "a" red, "b" white.
const row = (s: string) => s.padEnd(12, ".");
const youtube = {
  size: 12,
  colors: ["#d8392b", "#ffffff"],
  px: [
    "............",
    ".aaaaaaaaaa.",
    "aaaaaaaaaaaa",
    "aaaabaaaaaaa",
    "aaaabbaaaaaa",
    "aaaabbbaaaaa",
    "aaaabbbbaaaa",
    "aaaabbbaaaaa",
    "aaaabbaaaaaa",
    "aaaabaaaaaaa",
    ".aaaaaaaaaa.",
    row(""),
  ].join(""),
};
const jira = {
  size: 12,
  colors: ["#3f7fd0", "#4f8fd6"],
  px: Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => (Math.abs(x - 5.5) + Math.abs(y - 5.5) < 6 ? (x < 6 ? "a" : "b") : ".")).join(
      "",
    ),
  ).join(""),
};

type Hooks = {
  _world?: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }> };
  _view?: () => { x: number; y: number; zoom: number };
};
// Where a tower's doors are on the screen.
const doorsOnScreen = (page: Page, dept: string) =>
  page.evaluate((d) => {
    const root = document.querySelector("section.city") as unknown as Hooks & HTMLElement;
    const b = root._world?.().buildings.find((x) => x.dept === d);
    const v = root._view?.();
    if (!b || !v) return null;
    const r = root.getBoundingClientRect();
    return { x: r.left + ((b.x + b.w / 2) * 16 - v.x) * v.zoom, y: r.top + ((b.y + b.h) * 16 - 24 - v.y) * v.zoom };
  }, dept);
const signs = (page: Page) => page.locator("section.city").getAttribute("data-signs");

test("connected tools hang their pixel signs by the doors of the departments that use them", async ({ page }) => {
  const m = await mockBackend(page, {
    snapshot: {
      departments: ["Media", "Marketing", "Finance"].map((name) => ({ name, mission: "x", state: "active" })),
      connectors: [
        {
          id: "youtube",
          label: "YouTube",
          status: "ready",
          departments: ["Media", "Marketing"],
          every_department: false,
          sign: youtube,
        },
        { id: "atlassian", label: "Jira", status: "ready", departments: [], every_department: true, sign: jira },
        { id: "late", label: "Late", status: "needs_login", departments: ["Finance"] },
      ],
    },
  });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => signs(page)).toBe("3"); // Jira everywhere, YouTube on Media and Marketing

  // Live: Stripe connects for Finance with no logo (a lettered plaque); Media takes on many more tools ("+N").
  m.send({
    type: "connector.updated",
    id: "stripe",
    label: "Stripe",
    status: "ready",
    auth: "oauth",
    departments: ["Finance"],
    every_department: false,
  });
  for (const n of ["Canva", "Descript", "Higgsfield", "Kling", "Runway", "Suno"])
    m.send({
      type: "connector.updated",
      id: n.toLowerCase(),
      label: n,
      status: "ready",
      auth: "none",
      departments: ["Media"],
      every_department: false,
    });
  await page.waitForTimeout(400);
  await page.getByRole("navigation", { name: "Departments" }).getByRole("button", { name: "Media" }).click();
  const card = page.getByRole("dialog", { name: "Media department" });
  await card.getByRole("button", { name: "Zoom in" }).click();
  await card.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(800);
  const at = (await doorsOnScreen(page, "Media"))!;
  await page.screenshot({
    path: `${SHOTS}/city-connector-signs.png`,
    clip: { x: Math.max(0, at.x - 240), y: Math.max(0, at.y - 220), width: 480, height: 300 },
  });

  // A tool that is removed takes its sign down everywhere.
  m.send({ type: "connector.updated", id: "atlassian", label: "Jira", status: "removed", auth: "oauth" });
  m.send({ type: "connector.updated", id: "stripe", label: "Stripe", status: "removed", auth: "oauth" });
  await expect.poll(() => signs(page)).toBe("2"); // Media and Marketing, by YouTube and the rest
});
