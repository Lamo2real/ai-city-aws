// Decision 295: a department's manager is its reviewer. While it reviews it walks into its tower (one lit window, one
// more in "Agents working now"), however many reviews; when they end it walks back out to its door. A reload during
// a review places it inside at once.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

type P = { key: string; inside?: boolean; insideOf?: string | null; move?: unknown; route?: unknown };
const reviewer = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector("section.city") as unknown as HTMLElement & { _people?: Map<string, P> };
    const p = el._people?.get("mgr-research");
    return { key: p?.key ?? null, insideOf: p?.insideOf ?? null, moving: !!(p?.move || p?.route), atWork: Number(el.dataset.atWork ?? -1) };
  });
const department = { key: "research", name: "Research", mission: "x", manager_id: "mgr-research", state: "active", created_at: new Date(Date.UTC(2026, 10, 1)).toISOString() };

test("the reviewer walks in while it reviews and back out after, one of it however many reviews", async ({ page }) => {
  const m = await mockBackend(page, { snapshot: { departments: [department] } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  m.send(hired("mgr-research", "Research", "manager"));
  await expect.poll(() => reviewer(page)).toMatchObject({ key: "door:Research", atWork: 0 });
  // Its card says Reviewer.
  m.send({ type: "activity", id: "mgr-research", activity: "reviewing" });
  await expect.poll(() => reviewer(page), { timeout: 5000 }).toMatchObject({ insideOf: "Research", atWork: 1 }); // in through its doors
  m.send({ type: "review.started", ticket_id: "t1", round: 1, department: "Research" });
  m.send({ type: "review.started", ticket_id: "t2", round: 1, department: "Research" });
  await page.waitForTimeout(400);
  expect((await reviewer(page)).atWork).toBe(1); // still one reviewer inside
  m.send({ type: "review.result", ticket_id: "t1", agent: "w1", reviewer: "mgr-research", verdict: "PASS", summary: "ok", round: 1 });
  await page.waitForTimeout(400);
  expect((await reviewer(page)).atWork).toBe(1); // t2 still open
  m.send({ type: "review.finished", ticket_id: "t2", department: "Research" });
  await expect.poll(() => reviewer(page), { timeout: 5000 }).toMatchObject({ key: "door:Research", atWork: 0, insideOf: null }); // back out to its door
});

test("a reload while reviewing places the reviewer inside at once", async ({ page }) => {
  const manager = hired("mgr-research", "Research", "manager").agent;
  await mockBackend(page, { snapshot: { departments: [department], agents: [manager], activities: { "mgr-research": { activity: "reviewing", at: Date.now() } } } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => reviewer(page)).toMatchObject({ insideOf: "Research", atWork: 1, moving: false });
});
