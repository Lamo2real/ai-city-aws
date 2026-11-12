// The department picker's words (decision 266): Add says the pick so the city reads exactly what is on the card.
import { describe, expect, it } from "vitest";
import { addWords, forWhom, namesOf, readPicker, toggle } from "../src/lib/deptPick.ts";

const choices = [
  { key: "application", name: "Application" },
  { key: "data", name: "Data & AI" },
  { key: "finance", name: "Finance" },
];
const p = { choices, recommended: [{ key: "data", why: "charts" }], selected: ["data"] };

describe("department picker", () => {
  it("says the pick in words", () => {
    expect(addWords("Add", p)).toBe("Add for Data & AI");
    expect(addWords("Add", { ...p, selected: ["finance", "data"] })).toBe("Add for Data & AI and Finance");
    expect(addWords("Add", { ...p, selected: ["application", "data", "finance"] })).toBe("Add for all departments");
    expect(namesOf({ ...p, selected: [] })).toBe("no department");
  });
  it("toggles in the departments' order", () => {
    expect(toggle(p, "application")).toEqual(["application", "data"]);
    expect(toggle(p, "data")).toEqual([]);
  });
  it("reads a picker and drops unknown keys", () => {
    const r = readPicker({
      choices,
      recommended: [{ key: "nope", why: "x" }, { key: "data" }],
      selected: ["x", "data"],
    });
    expect(r).toEqual({ choices, recommended: [{ key: "data", why: "" }], selected: ["data"] });
    expect(readPicker({ choices: [] })).toBeUndefined();
    expect(readPicker(null)).toBeUndefined();
  });
  it("no departments is every department", () => {
    expect(forWhom(choices, undefined)).toBe("every department");
    expect(forWhom(choices, ["finance"])).toBe("Finance");
  });
});
