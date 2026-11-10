// Skills → Discover (decision 188): every catalog entry has its SKILL.md with the same name, the catalog covers the
// departments the owner asked for, and the API Gateway has the three catalog routes behind the owner's JWT.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const DIR = join(ROOT, "agents", "skill-catalog");
const index = JSON.parse(readFileSync(join(DIR, "catalog.json"), "utf8")) as {
  featured: string;
  skills: Array<{ name: string; title: string; departments: string[] }>;
};
const departments = (
  JSON.parse(readFileSync(join(ROOT, "config", "departments.json"), "utf8")) as { departments: Array<{ name: string }> }
).departments.map((d) => d.name);

describe("the skill catalog", () => {
  it("has at least 20 skills, each a SKILL.md whose name matches, for the City's own departments", () => {
    expect(index.skills.length).toBeGreaterThanOrEqual(20);
    for (const s of index.skills) {
      const md = join(DIR, s.name, "SKILL.md");
      expect(existsSync(md), s.name).toBe(true);
      const text = readFileSync(md, "utf8");
      expect(text.startsWith(`---\nname: ${s.name}\ndescription: "`), s.name).toBe(true);
      expect(
        s.departments.every((d) => departments.includes(d)),
        s.name,
      ).toBe(true);
      expect(existsSync(join(ROOT, "agents", "skills", s.name)), `${s.name} clashes with a built-in`).toBe(false);
    }
    expect(index.skills.some((s) => s.name === index.featured)).toBe(true);
  });
  it("covers finance, product, operations, marketing, sales, research, legal, data, design and engineering", () => {
    const covered = new Set(index.skills.flatMap((s) => s.departments));
    for (const d of [
      "Finance",
      "Product",
      "Operations",
      "Marketing",
      "Sales",
      "Research",
      "Legal",
      "Data & AI",
      "Media",
      "Application",
    ])
      expect(covered.has(d), d).toBe(true);
  });
  it("the HTTP API routes the catalog", () => {
    const api = readFileSync(join(ROOT, "infra", "modules", "api", "main.tf"), "utf8");
    for (const r of ["GET /skills/catalog", "GET /skills/catalog/{name}", "POST /skills/catalog/{name}"])
      expect(api).toContain(`"${r}"`);
  });
});
