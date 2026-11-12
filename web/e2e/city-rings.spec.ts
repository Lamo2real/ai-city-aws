// Decision 290: a roundabout and its curved pavement never run under a tower. The pixels all round the ring, by
// Customer Support in the owner's town, are road, kerb or pavement, never a building.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research", "Media", "Design"];

test("the roundabout by Customer Support is clear of every tower", async ({ page }) => {
  const departments = NAMES.map((name, i) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as { _world: () => { buildings: unknown[] } })._world().buildings.length)).toBe(13);
  const ring = await page.evaluate(() => {
    type B = { dept: string; x: number; y: number; w: number; h: number };
    const h = document.querySelector("section.city") as unknown as { _world: () => { buildings: B[] }; _traffic: { junctions: Array<{ kind: string; cx: number; cy: number }> }; _groundAt: (x: number, y: number) => number[] | null };
    const cs = h._world().buildings.find((b) => b.dept === "Customer Support")!;
    const mid = { x: (cs.x + cs.w / 2) * 16, y: (cs.y + cs.h) * 16 };
    const rings = h._traffic.junctions.filter((j) => j.kind === "roundabout").sort((a, b) => Math.hypot(a.cx - mid.x, a.cy - mid.y) - Math.hypot(b.cx - mid.x, b.cy - mid.y));
    const j = rings[0];
    if (!j) return null;
    return { d: Math.hypot(j.cx - mid.x, j.cy - mid.y), px: Array.from({ length: 48 }, (_, k) => { const t = (k / 48) * Math.PI * 2; return h._groundAt(j.cx + Math.cos(t) * 35, j.cy + Math.sin(t) * 35); }) };
  });
  expect(ring).not.toBeNull();
  expect(ring!.d).toBeLessThan(400); // the roundabout next to it
  // The facades: glass, brick and stone walls (through the dusk wash). None of them on the ring's pavement.
  const walls = [[59, 108, 152], [183, 99, 74], [217, 205, 180]].map((c) => c.map((v, i) => v * 0.86 + [38, 30, 78][i]! * 0.14));
  for (const p of ring!.px) {
    expect(p).not.toBeNull();
    for (const w of walls) expect(Math.hypot(p![0]! - w[0]!, p![1]! - w[1]!, p![2]! - w[2]!), `pixel ${p}`).toBeGreaterThan(30);
  }
});

// Decision 290: a building beside a footbridge stands in front of the bridge's ends. Every frame, the part of a tower or
// a home over a bridge is drawn again on top of it; in the owner's town two bridges reach the buildings beside them.
test("buildings stand in front of a footbridge's ends", async ({ page }) => {
  const departments = NAMES.map((name, i) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await page.getByRole("button", { name: "Fit the whole map" }).click();
  await expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as { _bridgeCovers?: number })._bridgeCovers ?? 0)).toBeGreaterThan(0);
});

// Decision 291: every lamppost stands in front of the buildings: its lamp's bright core is on top wherever it stands.
test("every lamppost's lamp is in front of the buildings", async ({ page }) => {
  const departments = NAMES.map((name, i) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, mission: "x", manager_id: `mgr-${i}`, state: "active", created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString() }));
  await mockBackend(page, { snapshot: { departments } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");
  await expect.poll(() => page.evaluate(() => (document.querySelector("section.city") as unknown as { _world: () => { buildings: unknown[] } })._world().buildings.length)).toBe(13);
  await page.waitForTimeout(500);
  const heads = await page.evaluate(() => {
    const h = document.querySelector("section.city") as unknown as { _lamps: () => number[][]; _groundAt: (x: number, y: number) => number[] | null };
    return h._lamps().flatMap(([x, y]) => [h._groundAt(x! - 1, y! - 23), h._groundAt(x! + 1, y! - 23)]); // both sides of the lamp's bright head, where a wall's edge would fall
  });
  expect(heads.length).toBeGreaterThan(20);
  for (const c of heads) expect(c![0]! > 200 && c![1]! > 180, `lamp head ${c}`).toBe(true); // lit, never hidden behind a wall
});
