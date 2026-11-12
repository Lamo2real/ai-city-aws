// Loading the City (decision 249): what it remembers between visits is only where the towers stand, and drawn from
// that memory the placeholders stand exactly where the towers will; when the data arrives they come into focus.
import { describe, expect, it } from "vitest";
import { applySnapshot, entranceAnims, initialState, layout, lotsMemory, readLotsMemory, reduce } from "../src/city/city-state.js";

const NAMES = ["Application", "IT Infrastructure", "Data & AI", "Marketing", "Sales", "Customer Support", "Finance", "Legal", "Product", "Operations", "Research", "Media"];
const snap = {
  departments: NAMES.map((name, i) => ({ key: name.toLowerCase(), name, mission: "secret plans", manager_id: `m${i}`, state: "active", slot: i, created_at: "2026-11-01T00:00:00Z" })),
  lots: [...NAMES.map((n, i) => ({ slot: i, size: n })), { slot: 12, size: "" }],
  agents: [{ id: "m1", kind: "manager", department: "Sales", state: "active" }],
  tickets: [],
};

describe("the city's memory", () => {
  it("keeps only names, lots and sizes, and draws the same towers in the same places", () => {
    let s = applySnapshot(initialState(0), snap, Date.UTC(2026, 10, 12));
    s = reduce(s, { type: "department.demolished", name: "Sales" }, Date.UTC(2026, 10, 12, 1));
    const mem = lotsMemory(s);
    expect(JSON.stringify(mem)).not.toMatch(/secret|m1|manager/); // no missions, no agents
    expect(mem.departments.map((d) => d.name)).not.toContain("Sales"); // a demolished tower is not remembered
    const back = readLotsMemory(JSON.stringify(mem))!;
    const remembered = applySnapshot(initialState(0), { agents: [], tickets: [], ...back }, Date.UTC(2026, 10, 13));
    const real = applySnapshot(initialState(0), { ...snap, departments: snap.departments.filter((d) => d.name !== "Sales") }, Date.UTC(2026, 10, 13));
    for (const portrait of [false, true]) {
      const a = layout(remembered, { portrait, homes: 1 }), b = layout(real, { portrait, homes: 1 });
      expect(a.buildings.map(({ dept, x, y, w, h }) => [dept, x, y, w, h])).toEqual(b.buildings.map(({ dept, x, y, w, h }) => [dept, x, y, w, h]));
      expect([a.hq, a.streets, a.homes.apartments]).toEqual([b.hq, b.streets, b.homes.apartments]);
    }
  });

  it("ignores anything that isn't a memory it wrote", () => {
    for (const raw of [null, "", "not json", "{}", '{"departments":5,"lots":[]}']) expect(readLotsMemory(raw)).toBeNull();
    expect(readLotsMemory('{"departments":[{"name":"A","slot":"x"},{"name":"B","slot":1,"state":"weird"}],"lots":[{"slot":1,"size":3},{"slot":1,"size":"B"}]}')).toEqual({
      departments: [{ name: "B", slot: 1, state: "active" }],
      lots: [{ slot: 1, size: "B" }],
    });
  });
});

describe("the entrance", () => {
  const buildings = [
    { dept: "A", slot: 1, archived: false },
    { dept: "B", slot: 0, archived: false },
    { dept: "C", slot: 2, archived: true },
  ] as never[];
  it("a remembered placeholder comes into focus; a tower nobody remembered rises; in lot order", () => {
    const anims = entranceAnims(buildings, 1000, new Set(["B"]));
    expect(anims.map((a) => [a.dept, a.kind, a.start])).toEqual([
      ["B", "focus", 1000],
      ["A", "rise", 1110],
    ]);
    expect(entranceAnims(buildings, 0).every((a) => a.kind === "rise")).toBe(true);
  });
});
