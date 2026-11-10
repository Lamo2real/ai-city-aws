// The commute: a hired worker walks from its house into the office and sits; the manager visibly recruits;
// a finished worker checks out and walks home. Positions come from the scene's read-only test hook
// (section.city._people); screenshots go to docs/screenshots for the docs.
import { expect, test, type Page } from "@playwright/test";
import { hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;

const person = (page: Page, id: string) =>
  page.evaluate((pid) => {
    const el = document.querySelector("section.city") as unknown as {
      _people?: Map<
        string,
        { x: number; y: number; key: string; route?: unknown; waitUntil?: number; visual?: string }
      >;
    };
    const p = el?._people?.get(pid);
    return p
      ? { x: p.x, y: p.y, key: p.key, walking: !!p.route, waiting: !!p.waitUntil, visual: p.visual ?? null }
      : null;
  }, id);

test("hired workers commute in from their houses, and finished workers walk home", async ({ page }) => {
  test.slow(); // real walks take a few seconds each
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible(); // the snapshot landed: live events now stick
  await page.waitForTimeout(250);

  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  m.send({ type: "activity", id: "mgr-research", activity: "hiring" }); // recruiting at the door
  await expect.poll(() => person(page, "mgr-research")).toMatchObject({ key: "door:Research", visual: "hiring" }); // out at the door, megaphone bubble up
  m.send(hired("wkr-research-a1", "Research"));
  m.send(hired("wkr-research-b2", "Research"));

  // Both new hires first wait at home (their house lights up), then walk the streets, one after the other.
  await expect.poll(() => person(page, "wkr-research-a1")).toMatchObject({ key: /^desk:Research/ });
  const w1 = (await person(page, "wkr-research-a1"))!;
  expect(w1.waiting || w1.walking).toBe(true); // scheduled, not teleported
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/city-recruiting.png` }); // manager's hiring bubble, lit house
  await expect.poll(() => person(page, "wkr-research-a1").then((p) => p!.walking && !p!.waiting)).toBe(true);
  const mid1 = (await person(page, "wkr-research-a1"))!;
  await page.waitForTimeout(350);
  const mid2 = (await person(page, "wkr-research-a1"))!;
  expect(Math.hypot(mid2.x - mid1.x, mid2.y - mid1.y)).toBeGreaterThan(4); // really on the move
  await page.screenshot({ path: `${SHOTS}/city-commute.png` });
  // Both arrive and sit; the cab ride keeps to the traffic (lights, roundabouts), so it takes a while (decision 177).
  await expect
    .poll(() => person(page, "wkr-research-b2").then((p) => !p!.walking && !p!.waiting), { timeout: 60_000 })
    .toBe(true);
  await expect.poll(() => person(page, "wkr-research-a1").then((p) => !p!.walking && !p!.waiting), { timeout: 60_000 }).toBe(true);
  const atWork = (await person(page, "wkr-research-a1"))!;
  m.send({ type: "activity", id: "wkr-research-a1", activity: "coding" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/city-working.png` });

  // Done: they check out and walk home together, one after the other at the door.
  m.send({ type: "agent.retired", id: "wkr-research-a1" });
  m.send({ type: "agent.retired", id: "wkr-research-b2" });
  await expect.poll(() => person(page, "wkr-research-a1")).toMatchObject({ key: "home" });
  const h1 = (await person(page, "wkr-research-a1"))!;
  expect(h1.walking || h1.waiting).toBe(true); // walks home, no teleport
  await expect.poll(() => person(page, "wkr-research-a1").then((p) => p!.walking && !p!.waiting)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/city-going-home.png` }); // mid-walk, "CHECKED OUT" above them
  await expect
    .poll(() => person(page, "wkr-research-a1").then((p) => !p!.walking && !p!.waiting), { timeout: 60_000 })
    .toBe(true);
  const home = (await person(page, "wkr-research-a1"))!;
  expect(home.key).toBe("home");
  expect(Math.hypot(home.x - atWork.x, home.y - atWork.y)).toBeGreaterThan(30); // actually travelled
});

test("with reduced motion, placement is instant: hired sits at once, retired is simply at home", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  m.send(hired("wkr-research-a1", "Research"));
  await expect.poll(() => person(page, "wkr-research-a1")).toMatchObject({ walking: false, waiting: false });
  m.send({ type: "agent.retired", id: "wkr-research-a1" });
  await expect.poll(() => person(page, "wkr-research-a1")).toMatchObject({ key: "home", walking: false });
});

test("an executive lives at home, rides to HQ when called in, and goes home after advising", async ({ page }) => {
  test.slow();
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  const cfo = (state: "active" | "dormant") => ({
    id: "exec-cfo",
    kind: "executive",
    role: "CFO",
    department: null,
    model: "fable-5-1",
    parent: null,
    state,
    worker_state: null,
  });
  m.send({ type: "executive.office", id: "exec-cfo", at_hq: false, agent: cfo("dormant") });
  await expect.poll(() => person(page, "exec-cfo")).toMatchObject({ key: "home" });
  const home = (await person(page, "exec-cfo"))!;
  m.send({ type: "executive.office", id: "exec-cfo", at_hq: true, agent: cfo("active") });
  await expect.poll(() => person(page, "exec-cfo")).toMatchObject({ key: "hq:exec-cfo" });
  const going = (await person(page, "exec-cfo"))!;
  expect(going.walking || going.waiting).toBe(true); // a commute, not a teleport
  await expect
    .poll(() => person(page, "exec-cfo").then((p) => !p!.walking && !p!.waiting), { timeout: 60_000 })
    .toBe(true);
  const office = (await person(page, "exec-cfo"))!;
  expect(Math.hypot(office.x - home.x, office.y - home.y)).toBeGreaterThan(30);
  await page.screenshot({ path: `${SHOTS}/city-boardroom.png` });
  await expect(page.locator("section.city")).not.toHaveAttribute("data-taxi-rides", "0");
  m.send({ type: "executive.office", id: "exec-cfo", at_hq: false, agent: cfo("dormant") });
  await expect.poll(() => person(page, "exec-cfo")).toMatchObject({ key: "home" });
  await expect
    .poll(() => person(page, "exec-cfo").then((p) => !p!.walking && !p!.waiting), { timeout: 60_000 })
    .toBe(true);
});
