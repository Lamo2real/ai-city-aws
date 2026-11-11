// Decision 212: every tower, built-in or built on demand, has its Department Manager outside at the door at all
// times, even before the runtime has hired him.
import { expect, test, type Page } from "@playwright/test";
import { mockBackend } from "./mock.ts";

type Person = { x: number; y: number; key: string; inside?: boolean };
type Hooks = {
  _people?: Map<string, Person>;
  _world?: () => { buildings: Array<{ dept: string; x: number; y: number; w: number; h: number }> };
};
const TILE = 16;
// Every manager in the scene, with how far he stands from his tower's street door.
const managers = (page: Page) =>
  page.evaluate((tile) => {
    const h = document.querySelector("section.city") as unknown as Hooks;
    const out: Record<string, { key: string; inside: boolean; fromDoor: number }> = {};
    for (const [id, p] of h._people ?? []) {
      if (!id.startsWith("mgr-")) continue;
      const dept = p.key.startsWith("door:") ? p.key.slice(5) : "";
      const b = h._world?.().buildings.find((x) => x.dept === dept);
      const door = b ? { x: (b.x + b.w / 2) * tile, y: (b.y + b.h) * tile - 6 } : null;
      out[id] = { key: p.key, inside: !!p.inside, fromDoor: door ? Math.hypot(p.x - door.x, p.y - door.y) : Infinity };
    }
    return out;
  }, TILE);

const dept = (name: string) => ({
  name,
  mission: `${name} things.`,
  manager_id: `mgr-${name.toLowerCase()}`,
  state: "active",
  created_at: "2026-11-01T00:00:00Z",
});

test("every tower has its manager at the door, with no manager agents; a department built live gets one too", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await mockBackend(page, { snapshot: { departments: [dept("Research"), dept("Media"), dept("Legal")], agents: [] } });
  await page.goto("/#/city");
  await expect(page.locator("section.city")).toHaveAttribute("data-city-ready", "1");

  await expect.poll(async () => Object.keys(await managers(page)).sort()).toEqual(["mgr-legal", "mgr-media", "mgr-research"]);
  for (const [id, p] of Object.entries(await managers(page))) {
    expect(p.key, id).toBe(`door:${id.charAt(4).toUpperCase()}${id.slice(5)}`);
    expect(p.inside, id).toBe(false);
    expect(p.fromDoor, id).toBeLessThan(40); // right beside the door, out on the street
  }

  m.send({ type: "department.created", name: "Growth", mission: "Grow.", manager_id: "mgr-growth" });
  await expect.poll(async () => (await managers(page))["mgr-growth"]?.key).toBe("door:Growth");
  const g = (await managers(page))["mgr-growth"]!;
  expect(g.inside).toBe(false);
  expect(g.fromDoor).toBeLessThan(40);
  expect(Object.keys(await managers(page))).toHaveLength(4); // one per tower
});
