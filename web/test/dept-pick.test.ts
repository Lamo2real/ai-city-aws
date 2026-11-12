// The department picker's words (decision 266): Add says the pick so the city reads exactly what is on the card.
import { describe, expect, it } from "vitest";
import {
  addLabel,
  addWords,
  allNames,
  countWords,
  forWhom,
  namesOf,
  readPicker,
  shortName,
  toggle,
} from "../src/lib/deptPick.ts";

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

describe("the department badge (decision 270)", () => {
  it("names one department, counts more in digits, and counts every department when none is listed", () => {
    expect(countWords(choices, ["finance"])).toBe("Finance");
    expect(countWords(choices, ["finance", "data", "application"])).toBe("3 departments");
    expect(countWords(choices, ["finance", "data"])).toBe("2 departments");
    expect(countWords(choices, undefined)).toBe("3 departments");
    expect(countWords(choices, [])).toBe("3 departments");
    expect(countWords([], undefined)).toBe("every department");
  });
  it("lists the names for the tooltip and Show which, in the departments' order", () => {
    expect(allNames(choices, ["finance", "application"])).toBe("Application and Finance");
    expect(allNames(choices, undefined)).toBe("Application, Data & AI and Finance");
    expect(allNames(choices, ["finance"])).toBe("Finance");
  });
});

describe("the Add button's words (decision 280)", () => {
  const none = { choices, recommended: [], selected: [] as string[] };
  it("says how many files and for whom", () => {
    expect(addLabel({ files: 1 }, none)).toBe("Add 1 file for every department");
    expect(addLabel({ files: 3 }, { ...none, selected: ["finance"] })).toBe("Add 3 files for Finance");
    expect(addLabel({ files: 2 }, { ...none, selected: ["data", "finance"] })).toBe(
      "Add 2 files for Data & AI and Finance",
    );
    expect(addLabel({ files: 2 }, { ...none, selected: ["application", "data", "finance"] })).toBe(
      "Add 2 files for every department",
    );
  });
  it("names a link or text", () => {
    expect(addLabel({ link: true }, none)).toBe("Add the link for every department");
    expect(addLabel({ link: false }, { ...none, selected: ["application"] })).toBe("Add the text for Application");
  });
  it("shortens long names in the middle and keeps the extension", () => {
    expect(shortName("short.md")).toBe("short.md");
    const s = shortName("phed-make-real-money-gta-6-2026-10-31.md");
    expect(s.length).toBeLessThanOrEqual(28);
    expect(s).toMatch(/^phed-make.*….*\.md$/);
  });
});
