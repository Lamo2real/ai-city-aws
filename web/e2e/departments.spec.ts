// Departments on demand (decision 134): build one from the City and watch it go up; demolish it and watch it come
// down; the towers rise on page load; workers ride yellow cabs; the mailman cycles the Orchestrator's letters to
// a manager and the reply back. Read-only hooks on section.city: _world, _anims, _people, _mail, data-*.
import { expect, test, type Page } from "@playwright/test";
import { at, hired, mockBackend } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
type Hooks = {
  _world?: () => { buildings: Array<{ dept: string }>; lots: Array<{ demolished?: string }> };
  _anims?: Map<string, { kind: string }>;
  _people?: Map<string, { x: number; y: number; route?: unknown; ride?: boolean[] | null; waitUntil?: number | null }>;
  _mail?: {
    rider: { x: number; y: number; job: unknown; carrying: boolean } | null;
    queue: unknown[];
    out: number;
    back: number;
  };
  dataset: DOMStringMap;
};
const hooks = <T>(page: Page, f: (h: Hooks) => T) =>
  page.evaluate((src) => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    return new Function("h", `return (${src})(h)`)(h);
  }, f.toString()) as Promise<T>;
const towers = (page: Page) => hooks(page, (h) => h._world?.().buildings.map((b) => b.dept) ?? []);
const anim = (page: Page, dept: string) =>
  page.evaluate((d) => (document.querySelector("section.city") as unknown as Hooks)._anims?.get(d)?.kind ?? null, dept);

async function openCity(page: Page, snapshot?: Record<string, unknown>) {
  const m = await mockBackend(page, snapshot ? { snapshot } : {});
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  return m;
}

test("build a department from the City: the tower goes up; demolish it: it comes down and the lot stands empty", async ({
  page,
}) => {
  test.slow();
  const m = await openCity(page);
  await expect(page.getByText(/No departments yet/)).toBeVisible();
  await page.waitForTimeout(250);

  await page.getByRole("button", { name: "+ Build a department" }).click();
  const form = page.getByRole("form", { name: "Build a department" });
  await form.getByLabel("Name").fill("Customer Success");
  await form.getByLabel(/What it does/).fill("Keeps customers happy and renewing");
  await expect(form.getByText("Its manager runs on Fable 5.1")).toBeVisible();
  await form.getByRole("button", { name: "Build it" }).click();
  expect(m.calls.find((c) => c.method === "POST" && c.path === "/departments")?.body).toEqual({
    name: "Customer Success",
    mission: "Keeps customers happy and renewing",
  }); // no worker_model: Opus 5.5 unless the owner ticks Fable

  // The tower is on the map at once, under construction (scaffolding and a crane), then it stands.
  await expect.poll(() => towers(page)).toContain("Customer Success");
  expect(await anim(page, "Customer Success")).toBe("build");
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${SHOTS}/city-construction.png` });
  await expect.poll(() => anim(page, "Customer Success"), { timeout: 8000 }).toBeNull();
  const panel = page.getByRole("dialog", { name: "Customer Success department" });
  await expect(panel.getByText("Opus 5.5")).toBeVisible();

  // Demolish: one plain question, then the wrecking ball.
  await panel.getByRole("button", { name: "Demolish this department" }).click();
  await expect(
    panel.getByText(/Demolish Customer Success\? Nobody is working there\. Its history stays/),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Yes, demolish" }).click();
  expect(m.calls.some((c) => c.method === "DELETE" && c.path === "/departments/customer-success")).toBe(true);
  await expect.poll(() => towers(page)).not.toContain("Customer Success");
  expect(await anim(page, "Customer Success")).toBe("demolish");
  expect(await hooks(page, (h) => h._world?.().lots.some((l) => l.demolished === "Customer Success"))).toBe(true);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SHOTS}/city-demolition.png` });
  await expect.poll(() => anim(page, "Customer Success"), { timeout: 8000 }).toBeNull();
  expect(await hooks(page, (h) => h.dataset.demolished)).toBe("1");
  await expect(page.locator("nav.depts").getByRole("button", { name: "Customer Success" })).toHaveCount(0);
});

test("on page load every tower rises in turn; workers ride a yellow cab; the mailman carries letters both ways", async ({
  page,
}) => {
  test.slow();
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  const departments = ["Research", "Sales", "Legal"].map((name) => ({
    key: name.toLowerCase(),
    name,
    mission: `${name} work.`,
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  const m = await openCity(page, { departments });
  // The entrance: all three towers rise, then settle; cabs cruise the streets.
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? 0)).toBe(3);
  expect(await anim(page, "Research")).toBe("rise");
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/city-entrance.png` });
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? 0), { timeout: 6000 }).toBe(0);
  expect(Number(await hooks(page, (h) => h.dataset.cabs))).toBeGreaterThan(0);

  // A hire rides to work by cab: the street legs of the commute are ridden.
  m.send(hired("mgr-research", "Research", "manager"));
  m.send(hired("wkr-research-a1", "Research"));
  await expect
    .poll(() => hooks(page, (h) => h._people?.get("wkr-research-a1")?.ride?.some(Boolean) ?? false))
    .toBe(true);
  await expect.poll(() => hooks(page, (h) => Number(h.dataset.taxiRides ?? 0)), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/city-taxi.png` });

  // The Orchestrator's instruction to Research's manager: a letter, cycled over.
  const goal = {
    id: "g-1",
    goal: "Find three papers",
    from: "orchestrator",
    to: "mgr-research",
    department: "Research",
    kind: "assignment",
    parent_id: "t-1",
    created_at: at(),
    updated_at: at(),
  };
  m.send({ type: "ticket.status", ticket: { ...goal, status: "open" }, previous: null });
  await expect.poll(() => hooks(page, (h) => !!h._mail?.rider?.job)).toBe(true);
  const start = (await hooks(page, (h) => ({ x: h._mail!.rider!.x, y: h._mail!.rider!.y })))!;
  await page.waitForTimeout(1500);
  const mid = (await hooks(page, (h) => ({
    x: h._mail!.rider!.x,
    y: h._mail!.rider!.y,
    carrying: h._mail!.rider!.carrying,
  })))!;
  expect(Math.hypot(mid.x - start.x, mid.y - start.y)).toBeGreaterThan(20); // he really rides
  expect(mid.carrying).toBe(true);
  await page.screenshot({ path: `${SHOTS}/city-mailman.png` });
  await expect.poll(() => hooks(page, (h) => h.dataset.mailOut), { timeout: 15_000 }).toBe("1");

  // The manager's reply rides back to the Orchestrator the same way.
  m.send({ type: "ticket.status", ticket: { ...goal, status: "done" }, previous: "in_review" });
  await expect.poll(() => hooks(page, (h) => h.dataset.mailBack), { timeout: 25_000 }).toBe("1");
  await expect.poll(() => hooks(page, (h) => h.dataset.mailBusy), { timeout: 10_000 }).toBe("0");
});

test("with reduced motion nothing rides or rises: towers stand, letters arrive at once, cabs stay parked", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await openCity(page, {
    departments: [
      {
        key: "research",
        name: "Research",
        mission: "x",
        manager_id: "mgr-research",
        state: "active",
        created_at: at(),
      },
    ],
  });
  await page.waitForTimeout(300);
  expect(await hooks(page, (h) => h._anims?.size ?? 0)).toBe(0);
  m.send({ type: "department.created", name: "Sales", mission: "y", manager_id: "mgr-sales" });
  await expect.poll(() => towers(page)).toContain("Sales");
  expect(await anim(page, "Sales")).toBeNull();
  m.send({
    type: "ticket.status",
    ticket: { id: "g-2", goal: "x", from: "orchestrator", to: "mgr-sales", department: "Sales", status: "open" },
    previous: null,
  });
  await expect.poll(() => hooks(page, (h) => h.dataset.mailOut)).toBe("1");
  expect(await hooks(page, (h) => h._mail?.rider ?? null)).toBeNull();
  m.send({ type: "department.demolished", name: "Sales", workers: 0, parts: 0 });
  await expect.poll(() => towers(page)).not.toContain("Sales");
  expect(await anim(page, "Sales")).toBeNull();
});
