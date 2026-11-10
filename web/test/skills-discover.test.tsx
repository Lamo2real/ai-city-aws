// Skills → Yours | Discover (decision 188): the search and department filter, and the screen: it opens on Discover
// when nothing is installed, one tap adds a skill (the catalog route, not an upload), Added shows at once, and Undo
// removes it again.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    constructor(
      message: string,
      readonly status = 400,
      readonly fix: string | null = null,
    ) {
      super(message);
    }
  },
}));
import { api } from "../src/lib/api.ts";
import { filterCatalog, type CatalogSkill } from "../src/lib/connect.ts";
import { SkillsScreen } from "../src/components/SkillsScreen.tsx";
import { Toaster } from "../src/components/ui.tsx";

const entry = (
  name: string,
  title: string,
  departments: string[],
  extra: Partial<CatalogSkill> = {},
): CatalogSkill => ({
  name,
  title,
  description: `About ${title.toLowerCase()}`,
  departments,
  source: "AI City catalog",
  builtin: false,
  featured: false,
  files: 1,
  added: false,
  ...extra,
});
const CATALOG = [
  entry("weekly-status-report", "Weekly status report", ["Operations"], { featured: true }),
  entry("cash-flow-runway", "Cash flow and runway", ["Finance"]),
  entry("nda-triage", "NDA triage", ["Legal"]),
  entry("knowledge-first", "Knowledge first", ["Every department"], {
    builtin: true,
    source: "Built into every department",
  }),
];

afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

describe("filterCatalog", () => {
  it("matches every word, accents and case ignored, across title, description and departments", () => {
    expect(filterCatalog(CATALOG, "CASH runway", null).map((s) => s.name)).toEqual(["cash-flow-runway"]);
    expect(filterCatalog(CATALOG, "légal", null).map((s) => s.name)).toEqual(["nda-triage"]);
    expect(filterCatalog(CATALOG, "", null)).toHaveLength(4);
    expect(filterCatalog(CATALOG, "zzz", null)).toEqual([]);
  });
  it("a department keeps its own skills and the ones every department gets", () => {
    expect(filterCatalog(CATALOG, "", "Finance").map((s) => s.name)).toEqual(["cash-flow-runway", "knowledge-first"]);
  });
});

function backend() {
  const mine: Array<Record<string, unknown>> = [];
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  vi.mocked(api).mockImplementation((async (path: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? "GET";
    calls.push({ path, method, body: init?.body });
    if (path === "/skills") return { skills: mine };
    if (path === "/skills/catalog")
      return {
        skills: CATALOG.map((c) => ({ ...c, added: mine.some((m) => m.name === c.name) })),
        departments: ["Finance", "Legal", "Operations"],
      };
    const name = path.split("/").pop()!;
    if (path.startsWith("/skills/catalog/") && method === "POST") {
      const skill = {
        name,
        description: "x",
        roles: ["vaic"],
        enabled: true,
        version: "v1",
        files: [],
        size_bytes: 1,
        updated_at: "2026-11-10T00:00:00Z",
        source: "catalog",
      };
      mine.push(skill);
      return { skill, removed_frontmatter: [] };
    }
    if (path.startsWith("/skills/catalog/"))
      return { ...CATALOG.find((c) => c.name === name), skill_md: "---\nname: x\n---\n# Steps\nDo it." };
    if (method === "DELETE") {
      mine.splice(
        mine.findIndex((m) => m.name === name),
        1,
      );
      return { ok: true };
    }
    throw new Error(`unexpected ${method} ${path}`);
  }) as typeof api);
  return calls;
}

describe("SkillsScreen", () => {
  it("opens on Discover when nothing is installed, with the featured skill and the department chips", async () => {
    backend();
    render(<SkillsScreen />);
    await screen.findByRole("article", { name: "Featured: Weekly status report" });
    expect(screen.getByRole("button", { name: "Discover" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      within(screen.getByRole("group", { name: "Department" }))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["All", "Finance", "Legal", "Operations"]);
    expect(
      within(screen.getByRole("list", { name: "Built-in skills" })).getByText("Built into every department"),
    ).toBeTruthy();
  });

  it("one tap adds through the catalog route, shows Added, and Undo removes it", async () => {
    const calls = backend();
    render(
      <>
        <SkillsScreen />
        <Toaster />
      </>,
    );
    const card = await screen.findByRole("listitem", { name: "NDA triage" });
    await act(async () => fireEvent.click(within(card).getByRole("button", { name: "Add NDA triage" })));
    await waitFor(() => expect(within(card).getByText("Added")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST")).toEqual({
      path: "/skills/catalog/nda-triage",
      method: "POST",
      body: {},
    });
    const toast = await screen.findByText(/Added NDA triage/);
    await act(async () =>
      fireEvent.click(within(toast.closest("[role=status]") as HTMLElement).getByRole("button", { name: "Undo" })),
    );
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/skills/nda-triage")).toBe(true));
    await waitFor(() => expect(within(card).getByRole("button", { name: "Add NDA triage" })).toBeTruthy());
  });

  it("searching for nothing says so and offers to show everything or write one", async () => {
    backend();
    render(<SkillsScreen />);
    await screen.findByRole("article", { name: /Featured/ });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search skills" }), { target: { value: "zzz" } });
    expect(screen.getByText(/No skill matches "zzz"/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all skills" }));
    expect(screen.getByRole("article", { name: /Featured/ })).toBeTruthy();
  });

  it("Yours, when empty, sends you to Discover", async () => {
    backend();
    render(<SkillsScreen />);
    await screen.findByRole("article", { name: /Featured/ });
    fireEvent.click(screen.getByRole("button", { name: "Yours" }));
    expect(screen.getByText(/No skills yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discover skills" }));
    expect(screen.getByRole("button", { name: "Discover" }).getAttribute("aria-pressed")).toBe("true");
  });
});
