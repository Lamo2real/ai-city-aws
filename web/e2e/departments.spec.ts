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

test("the map runs on: zoomed out and panned to a corner, the roads go on and fade into the border", async ({
  page,
}) => {
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  const departments = ["Research", "Sales", "Legal", "Media"].map((name) => ({
    key: name.toLowerCase(),
    name,
    mission: "x",
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  await openCity(page, { departments });
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? 0), { timeout: 6000 }).toBe(0);
  const canvas = page.locator("section.city > canvas").first();
  await canvas.hover();
  // Drag far to the bottom-left: the camera stops before the faded border, never on an empty edge.
  await page.mouse.down();
  await page.mouse.move(1100, -400, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/city-edges.png` });
  const view = await page.evaluate(() => {
    const el = document.querySelector("section.city") as unknown as { dataset: DOMStringMap };
    return Number(el.dataset.cabs ?? 0);
  });
  expect(view).toBeGreaterThan(8); // cabs on every street and the avenue, both ways
  await page.getByRole("button", { name: "Fit" }).click(); // Fit brings the whole town back
  await page.waitForTimeout(400);
  await expect.poll(() => towers(page)).toEqual(["Research", "Sales", "Legal", "Media"]);
});

test("the rare cars: forced for a look, the Porsche and the Lamborghini drive the same lanes as every cab", async ({
  page,
}) => {
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  const departments = ["Research", "Sales"].map((name) => ({
    key: name.toLowerCase(),
    name,
    mission: "x",
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  await openCity(page, { departments });
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? 0), { timeout: 6000 }).toBe(0);
  const before = Number(await hooks(page, (h) => h.dataset.cabs));
  await page.evaluate(() => ((document.querySelector("section.city") as HTMLElement).dataset.rareCabs = "all"));
  await expect.poll(() => hooks(page, (h) => Number(h.dataset.rareShown ?? 0))).toBeGreaterThan(0);
  expect(Number(await hooks(page, (h) => h.dataset.cabs))).toBe(before); // the same traffic, only the car differs
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/city-rare-cab.png` }); // "all": half Porsches, half Lamborghinis
  // The Lamborghini alone: every car is the matte black supercar, same lanes, same count.
  await page.getByRole("button", { name: "Fit the whole map" }).click();
  await page.evaluate(() => ((document.querySelector("section.city") as HTMLElement).dataset.rareCabs = "lambo"));
  await expect.poll(() => hooks(page, (h) => Number(h.dataset.lamboShown ?? 0)), { timeout: 15_000 }).toBeGreaterThan(0);
  expect(Number(await hooks(page, (h) => h.dataset.cabs))).toBe(before);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => hooks(page, (h) => Number(h.dataset.lamboShown ?? 0)), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/city-lambo.png` });
  // A close-up of the three cars, eight times their size: the cab, the Porsche and the Lamborghini, side, front, rear.
  await page.evaluate(() => {
    const root = document.querySelector("section.city") as unknown as { _carSprite: (r: unknown, v: string) => HTMLCanvasElement };
    const c = document.createElement("canvas"), k = 8, cell = 28 * k;
    c.width = cell * 3; c.height = cell * 3; c.id = "car-sheet";
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "99", background: "#3b3d5c", imageRendering: "pixelated" });
    const g = c.getContext("2d")!; g.imageSmoothingEnabled = false;
    [false, "porsche", "lambo"].forEach((r, row) => ["side", "front", "rear"].forEach((v, col) => {
      const im = root._carSprite(r, v); g.drawImage(im, col * cell + 8, row * cell + 8, im.width * k, im.height * k);
    }));
    document.body.append(c);
  });
  await page.locator("#car-sheet").screenshot({ path: `${SHOTS}/city-rare-cars-close.png` });
});

test("zoom is smooth from far out to close up", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const created_at = new Date(Date.now() - 86_400_000).toISOString();
  const names = ["Application", "IT Infrastructure", "Customer Support", "Research", "Sales", "Legal"];
  const departments = names.map((name) => ({
    key: name.toLowerCase().replace(/ /g, "-"),
    name,
    mission: "x",
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at,
  }));
  await openCity(page, { departments });
  await expect.poll(() => hooks(page, (h) => h._anims?.size ?? 0), { timeout: 6000 }).toBe(0);
  const city = page.locator("section.city");
  const zoom = async () => Number(await city.getAttribute("data-zoom"));
  // The names are the painted signs only (the owner took the screen-text plates back out, 2026-11-10).
  await expect(page.locator(".city-plates")).toHaveCount(0);
  // The wheel zooms in proportion and eases there: values between the start and the end are passed through.
  const before = await zoom();
  const canvas = page.locator("section.city > canvas").first();
  await canvas.hover({ position: { x: 600, y: 400 } });
  const seen = new Set<string>();
  await page.mouse.wheel(0, -300);
  for (let i = 0; i < 12; i++) {
    seen.add(String(await zoom()));
    await page.waitForTimeout(25);
  }
  await expect.poll(zoom).toBeGreaterThan(before * 1.6);
  expect(seen.size).toBeGreaterThan(2); // not one jump
  // Far out: the whole countryside.
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
  await expect.poll(zoom).toBeLessThan(before * 0.6); // well past Fit: the whole countryside
  // Far out the canvas never grows past the screen's own pixels (Safari shows an oversized canvas black, decision
  // 174), and the map stays painted: no blank or black frame while zooming.
  const canvasState = () =>
    canvas.evaluate((c: HTMLCanvasElement) => {
      const px = c.getContext("2d")!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
      return { w: c.width, max: Math.ceil(c.parentElement!.clientWidth * devicePixelRatio) + 1, alpha: px[3] };
    });
  const far = await canvasState();
  expect(far.w).toBeLessThanOrEqual(far.max);
  expect(far.alpha).toBe(255);
  await page.mouse.wheel(0, -200);
  for (let i = 0; i < 8; i++) {
    expect((await canvasState()).alpha).toBe(255);
    await page.waitForTimeout(20);
  }
  // Close up: beyond the old largest step.
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -400);
  await expect.poll(zoom).toBeGreaterThan(6);
  // Fit brings the whole town back.
  await page.getByRole("button", { name: "Fit" }).click();
  await expect.poll(zoom).toBeCloseTo(before, 1);
});

test("Activity folds away and stays folded after a reload", async ({ page }) => {
  await openCity(page);
  const toggle = page.getByRole("button", { name: "Activity" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Quiet.")).toBeVisible();
  const before = (await page.locator(".cityui.feed").boundingBox())!.height;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Quiet.")).toBeHidden();
  expect((await page.locator(".cityui.feed").boundingBox())!.height).toBeLessThan(Math.min(before, 70));
  await page.reload();
  await expect(page.getByRole("button", { name: "Activity" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByText("Quiet.")).toBeVisible();
});
