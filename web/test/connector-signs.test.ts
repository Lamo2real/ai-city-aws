// Decision 173: a connected tool hangs its sign by the doors of the departments that use it, from the snapshot or
// a live connector.updated event, tidy in one row on each side of the door however many tools there are.
import { describe, expect, it } from "vitest";
import { PLAQUE, applySnapshot, initialState, plaqueSlots, reduce, signsFor } from "../src/city/city-state.js";

const sign = { size: 12, colors: ["#d8392b"], px: "a".repeat(144) };
const snap = {
  departments: [{ name: "Media" }, { name: "Marketing" }, { name: "Finance" }],
  connectors: [
    {
      id: "youtube",
      label: "YouTube",
      status: "ready",
      departments: ["Media", "Marketing"],
      every_department: false,
      sign,
    },
    { id: "jira", label: "Jira", status: "ready", departments: [], every_department: true },
    { id: "later", label: "Later", status: "needs_login", departments: ["Finance"] },
  ],
};

describe("connector signs", () => {
  it("hang on the towers of the departments that use them, every-department tools everywhere", () => {
    const s = applySnapshot(initialState(0), snap, 1000);
    expect(signsFor(s, "media").map((c) => c.id)).toEqual(["youtube", "jira"]); // any case; a logo first
    expect(signsFor(s, "Finance").map((c) => c.id)).toEqual(["jira"]); // not connected yet: no sign
  });

  it("go up when a tool connects, stay up through a refresh, come down when it is removed", () => {
    let s = applySnapshot(initialState(0), snap, 1000);
    s = reduce(
      s,
      {
        type: "connector.updated",
        id: "stripe",
        label: "Stripe",
        status: "ready",
        auth: "oauth",
        departments: ["Finance"],
        every_department: false,
        sign,
      },
      2000,
    );
    s = reduce(
      s,
      {
        type: "connector.updated",
        id: "airtable",
        label: "Airtable",
        status: "ready",
        auth: "none",
        departments: ["Finance"],
        every_department: false,
      },
      2500,
    );
    expect(signsFor(s, "Finance").map((c) => c.id)).toEqual(["stripe", "airtable", "jira"]); // logos first, then by name
    expect(s.connectors?.stripe?.sign).toEqual(sign);
    s = reduce(s, { type: "connector.updated", id: "stripe", label: "Stripe", status: "syncing", auth: "oauth" }, 3000);
    expect(signsFor(s, "Finance").map((c) => c.id)).toContain("stripe");
    s = reduce(s, { type: "connector.updated", id: "stripe", label: "Stripe", status: "removed", auth: "oauth" }, 4000);
    expect(signsFor(s, "Finance").map((c) => c.id)).toEqual(["airtable", "jira"]);
  });

  const geo = (baseW: number) => ({ baseX: 100, baseW, cx: 100 + baseW / 2, foot: 300 });
  const tools = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `T${i}`, status: "ready" }));

  it("sit in one row by the door, never on it, alternating left and right", () => {
    const g = geo(144),
      slots = plaqueSlots(tools(4), g);
    expect(slots).toHaveLength(4);
    for (const p of slots) {
      expect(p.y).toBe(g.foot - 21);
      expect(p.x + PLAQUE <= g.cx - 15 || p.x >= g.cx + 15).toBe(true); // clear of the doors and canopy
      expect(p.x >= g.baseX && p.x + PLAQUE <= g.baseX + g.baseW).toBe(true); // on the lobby wall
    }
    expect(slots[0]!.x).toBeLessThan(g.cx);
    expect(slots[1]!.x).toBeGreaterThan(g.cx);
    const xs = slots.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(PLAQUE); // never overlapping
  });

  it("show '+N' in the last place when there are more tools than places", () => {
    const narrow = plaqueSlots(tools(5), geo(96));
    expect(narrow).toHaveLength(2);
    expect(narrow[0]?.sign?.id).toBe("t0");
    expect(narrow[1]).toMatchObject({ sign: null, more: 4 });
    expect(plaqueSlots(tools(6), geo(144)).every((p) => p.sign)).toBe(true); // a wide tower takes six
    expect(plaqueSlots([], geo(144))).toEqual([]);
  });
});
