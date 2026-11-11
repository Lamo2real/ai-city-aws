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
        { x: number; y: number; key: string; route?: unknown; waitUntil?: number; visual?: string; call?: { here: boolean } | null }
      >;
    };
    const p = el?._people?.get(pid);
    return p
      ? { x: p.x, y: p.y, key: p.key, walking: !!p.route, waiting: !!p.waitUntil || !!(p.call && !p.call.here), visual: p.visual ?? null } // waiting at home for the taxi too (decision 207)
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
  await expect.poll(() => person(page, "wkr-research-a1").then((p) => p!.walking && !p!.waiting), { timeout: 20_000 }).toBe(true); // after the taxi pulls up
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

// Decision 207: the taxi to work. Hiring calls a taxi to the kerb outside the worker's apartment building; it pulls
// up and waits, the worker steps in, it drives highlighted to the department's tower, stops at the door, the worker
// walks in and the highlight is gone. Two hires at once get a taxi each.
type Ride = {
  x: number;
  y: number;
  key: string;
  inside?: boolean;
  toWork?: boolean;
  route?: unknown;
  ride?: boolean[] | null;
  waitUntil?: number | null;
  call?: { x: number; y: number; here: boolean; route: Array<{ x: number; y: number }> } | null;
};
const rideOf = (page: Page, id: string) =>
  page.evaluate((pid) => {
    const el = document.querySelector("section.city") as unknown as HTMLElement & { _people?: Map<string, Ride> };
    const p = el._people?.get(pid);
    if (!p) return null;
    return {
      x: p.x,
      y: p.y,
      inside: !!p.inside,
      toWork: !!p.toWork,
      riding: !!(p.route && !p.waitUntil && p.ride?.[0]),
      walking: !!p.route,
      call: p.call ? { x: p.call.x, y: p.call.y, here: p.call.here, kerb: p.call.route.at(-1) ?? { x: p.call.x, y: p.call.y } } : null,
      calls: Number(el.dataset.taxiCalls ?? 0),
      glowing: Number(el.dataset.glowingCabs ?? 0),
    };
  }, id);

test("a hire's taxi is called to the apartment building, waits, and drives highlighted to the tower's door", async ({ page }) => {
  test.slow();
  const m = await mockBackend(page);
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);
  m.send({ type: "department.created", name: "Research", mission: "Find things out.", manager_id: "mgr-research" });
  m.send(hired("mgr-research", "Research", "manager"));
  await page.waitForTimeout(400);
  m.send(hired("wkr-research-a1", "Research"));
  m.send(hired("wkr-research-b2", "Research"));

  // Called: one taxi each, both glowing, on their way along the street to the kerb.
  await expect.poll(() => rideOf(page, "wkr-research-a1").then((r) => r?.calls)).toBe(2);
  const home = (await rideOf(page, "wkr-research-a1"))!;
  expect(home.call).not.toBeNull();
  const d0 = Math.hypot(home.call!.kerb.x - home.call!.x, home.call!.kerb.y - home.call!.y);
  await page.waitForTimeout(600);
  const on = (await rideOf(page, "wkr-research-a1"))!;
  if (on.call && !on.call.here) expect(Math.hypot(on.call.kerb.x - on.call.x, on.call.kerb.y - on.call.y)).toBeLessThan(d0);
  expect(on.glowing).toBeGreaterThanOrEqual(1);
  // Until the taxi has pulled up the worker stays at home.
  if (on.call && !on.call.here) expect(Math.hypot(on.x - home.x, on.y - home.y)).toBeLessThan(1);
  await page.screenshot({ path: `${SHOTS}/city-taxi-called.png` });

  // It stops in front of the building and waits; the worker comes out and gets in.
  await expect.poll(() => rideOf(page, "wkr-research-a1").then((r) => !!r?.call?.here || !!r?.riding), { timeout: 20_000 }).toBe(true);
  const waiting = (await rideOf(page, "wkr-research-a1"))!;
  if (waiting.call?.here) expect(Math.hypot(waiting.call.kerb.x - waiting.call.x, waiting.call.kerb.y - waiting.call.y)).toBeLessThan(1);
  await expect.poll(() => rideOf(page, "wkr-research-a1").then((r) => r?.riding), { timeout: 20_000 }).toBe(true);
  const riding = (await rideOf(page, "wkr-research-a1"))!;
  expect(riding.call).toBeNull(); // the called taxi is now the ride
  expect(riding.toWork).toBe(true);
  expect(riding.glowing).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/city-taxi-to-work.png` });

  // Dropped at the door: the glow goes out and the worker walks in.
  for (const id of ["wkr-research-a1", "wkr-research-b2"])
    await expect.poll(() => rideOf(page, id).then((r) => r?.inside), { timeout: 60_000 }).toBe(true);
  const done = (await rideOf(page, "wkr-research-a1"))!;
  expect(done.toWork).toBe(false);
  expect(done.calls).toBe(0);
  await expect.poll(() => rideOf(page, "wkr-research-a1").then((r) => r?.glowing)).toBe(0);
});

test("reloading the City puts people who are already working in their lit windows, no taxi ride (decision 211)", async ({ page }) => {
  const worker = { ...hired("wkr-research-a1", "Research").agent, worker_state: "working" };
  const m = await mockBackend(page, {
    snapshot: {
      departments: [{ key: "research", name: "Research", mission: "x", manager_id: "mgr-research", state: "active", created_at: "2026-11-11T00:00:00Z" }],
      agents: [hired("mgr-research", "Research", "manager").agent, worker],
      tickets: [{ id: "t1", from: "mgr-research", to: "wkr-research-a1", status: "in_progress", title: "Build it" }],
    },
  });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => person(page, "wkr-research-a1")).toMatchObject({ key: /^desk:Research/, walking: false, waiting: false });
  await page.waitForTimeout(1500);
  expect(await person(page, "wkr-research-a1")).toMatchObject({ walking: false, waiting: false });
  expect(Number((await page.locator("section.city").getAttribute("data-taxi-calls")) ?? 0)).toBe(0);
  // A new hire while the page is open still gets the taxi and the ride.
  m.send(hired("wkr-research-b2", "Research"));
  await expect.poll(() => person(page, "wkr-research-b2").then((p) => !!p && (p.waiting || p.walking))).toBe(true);
});

test("people at home are inside their apartment building: a lit window each, the count on its roof, and the neighbourhood never grows (decision 213)", async ({ page }) => {
  const agents = [
    hired("mgr-research", "Research", "manager").agent,
    ...Array.from({ length: 30 }, (_, i) => ({ ...hired(`wkr-research-h${i}`, "Research").agent, state: "retired", worker_state: "released" })),
  ];
  await mockBackend(page, {
    snapshot: {
      departments: [{ key: "research", name: "Research", mission: "x", manager_id: "mgr-research", state: "active", created_at: "2026-11-11T00:00:00Z" }],
      agents,
    },
  });
  await page.goto("/#/city");
  const city = page.locator("section.city");
  await expect(city).toHaveAttribute("data-city-ready", "1");
  const homeState = () =>
    page.evaluate(() => {
      const el = document.querySelector("section.city") as unknown as {
        _people: Map<string, { inside?: boolean; insideOf?: string | null; key: string }>;
        dataset: DOMStringMap;
      };
      const ps = [...el._people.values()].filter((p) => p.key === "home");
      return { home: ps.length, outside: ps.filter((p) => !p.inside).length, counted: Number(el.dataset.atHome ?? -1) };
    });
  await expect.poll(() => homeState().then((s) => s.home)).toBeGreaterThanOrEqual(24);
  const s = await homeState();
  expect(s.outside).toBe(0); // nobody waits on the pavement
  expect(s.counted).toBe(s.home); // all counted on the roofs
  // One block of three buildings, however many live there.
  const blocks = await page.evaluate(() => (document.querySelector("section.city") as unknown as { _traffic: { world: { homes: { blocks: unknown[] } } } })._traffic.world.homes.blocks.length);
  expect(blocks).toBe(1);
  await page.screenshot({ path: `${SHOTS}/city-homes.png` });
});
