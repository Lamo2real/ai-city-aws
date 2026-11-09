// Settings → Connectors (decision 129): the catalog is built from the presets file; Connected lists the tools in
// use with a logo, type, departments and status; departments filter both views; Browse connects in one click; search
// narrows it; + Add opens the right form.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
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
import {
  builtInSkills,
  catalogFor,
  catalogOf,
  kitProgress,
  kitsOf,
  logoSrc,
  matches,
  rowStatus,
  skillMarkdown,
} from "../src/lib/catalog.ts";
import { readFrontmatter, type Connector, type Presets } from "../src/lib/connect.ts";
import { ConnectorsHub } from "../src/components/ConnectorsHub.tsx";
import logos from "../src/lib/logos.json";

// The real presets file, shaped as GET /departments/presets answers it (skills reduced to names here).
const FILE = JSON.parse(readFileSync(`${import.meta.dirname}/../../config/departments.json`, "utf8")) as {
  shared: { mission: string; skills: string[]; connectors: string[]; essential: string[] };
  departments: Array<{
    key: string;
    name: string;
    mission: string;
    skills: string[];
    connectors: string[];
    essential: string[];
  }>;
  connectors: Record<string, { label: string; url: string; what: string; signup?: string }>;
};
const group = (g: { skills: string[]; connectors: string[]; essential: string[] }) => ({
  skills: g.skills.map((name) => ({ name, description: `About ${name}` })),
  connectors: g.connectors.map((id) => ({ id, ...FILE.connectors[id]!, essential: g.essential.includes(id) })),
});
const PRESETS = {
  shared: { name: "Shared", mission: FILE.shared.mission, ...group(FILE.shared) },
  departments: FILE.departments.map((d) => ({ key: d.key, name: d.name, mission: d.mission, teams: [], ...group(d) })),
} as unknown as Presets;

const ready = (id: string, url: string): Connector => ({ id, label: id, url, status: "ready", tools: [] });

afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

describe("the catalog", () => {
  it("lists every service once, with every department that uses it", () => {
    const cat = catalogOf(PRESETS);
    expect(cat).toHaveLength(Object.keys(FILE.connectors).length);
    expect(new Set(cat.map((c) => c.id)).size).toBe(cat.length);
    const github = cat.find((c) => c.id === "github")!;
    expect(github.groups).toEqual(expect.arrayContaining(["Application", "IT Infrastructure"]));
    expect(cat[0]!.groups[0]).toBe("Every department");
  });
  it("every service has a logo file or a lettered tile, and the files are ours", () => {
    for (const id of Object.keys(FILE.connectors)) {
      const src = logoSrc(id);
      if (src) {
        expect(src).toMatch(/^\/logos\/[a-z0-9-]+\.(svg|png)$/);
        expect(() => readFileSync(`${import.meta.dirname}/../public${src}`)).not.toThrow();
      }
    }
    expect(Object.keys(logos).length).toBeGreaterThan(90);
    expect(logoSrc("not-a-service")).toBeNull();
    expect(logoSrc(undefined)).toBeNull();
  });
  it("finds the catalog service for a connector by its link, its id or its host", () => {
    const cat = catalogOf(PRESETS);
    expect(catalogFor(ready("x", "https://mcp.stripe.com/"), cat)?.id).toBe("stripe");
    expect(catalogFor(ready("notion", "https://other.test/mcp"), cat)?.id).toBe("notion");
    expect(catalogFor(ready("y", "https://mcp.slack.com/other"), cat)?.id).toBe("slack");
    expect(catalogFor(ready("shop", "https://my-store.myshopify.com/api/mcp"), cat)?.id).toBe("shopify-store");
    expect(catalogFor(ready("acme", "https://mcp.acme.test/mcp"), cat)).toBeUndefined();
  });
  it("kits count their essential tools that are connected; built-in skills come once each", () => {
    const fin = kitsOf(PRESETS).find((k) => k.key === "finance")!;
    expect(kitProgress(fin, [])).toEqual({ done: 0, total: 3, any: false });
    expect(kitProgress(fin, [ready("xero", "https://mcp.xero.com/mcp")])).toEqual({ done: 1, total: 3, any: true });
    const skills = builtInSkills(PRESETS);
    expect(new Set(skills.map((s) => s.name)).size).toBe(skills.length);
  });
});

describe("words and search", () => {
  it("says what a row needs in two or three words", () => {
    expect(rowStatus({ id: "a", status: "ready" })).toMatchObject({ text: "Connected", ok: true });
    expect(rowStatus({ id: "a", status: "needs_login" }).text).toBe("Sign in");
    expect(rowStatus({ id: "a", status: "needs_key", needs: "oauth_client" }).text).toBe("Add its app's id");
    expect(rowStatus({ id: "a", status: "provisioning" }).text).toBe("Setting up…");
  });
  it("matches every word, ignoring case and accents", () => {
    expect(matches("", "anything")).toBe(true);
    expect(matches("CAFE pay", "Café", "payments")).toBe(true);
    expect(matches("cafe tea", "Café")).toBe(false);
  });
  it("writes a SKILL.md the city's checks accept", () => {
    const md = skillMarkdown(" weekly-report ", "Use when\n writing:  the report", "  Do it.  ");
    expect(md).toBe("---\nname: weekly-report\ndescription: Use when writing: the report\n---\n\nDo it.\n");
    expect(readFrontmatter(md)).toMatchObject({ name: "weekly-report", description: "Use when writing: the report" });
  });
});

describe("the page", () => {
  const backend = (connectors: Connector[]) => {
    const posts: unknown[] = [];
    vi.mocked(api).mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      if (path === "/connectors" && init?.method === "POST") {
        posts.push(init.body);
        const b = init.body as { url: string; label: string };
        connectors.push({ id: b.label.toLowerCase(), label: b.label, url: b.url, status: "needs_login" });
        return { connector: connectors.at(-1) };
      }
      if (path === "/connectors") return { connectors: [...connectors] };
      if (path === "/mail/accounts") return { accounts: [] };
      if (path === "/mail/rules") return { rules: [] };
      if (path === "/skills") return { skills: [] };
      if (path === "/departments/presets") return PRESETS;
      if (path === "/github") return { configured: false, login: null, saved_at: null, error: null };
      throw new Error(`unexpected ${path}`);
    });
    return posts;
  };

  it("Connected shows a table with logo, type, departments and status; departments and search narrow it", async () => {
    backend([
      ready("stripe", "https://mcp.stripe.com"),
      ready("xero", "https://mcp.xero.com/mcp"),
      { id: "acme", label: "Acme", url: "https://mcp.acme.test", status: "needs_key" },
    ]);
    render(<ConnectorsHub mailAccess={{}} onMailAccess={() => undefined} />);
    const table = await screen.findByRole("table", { name: "Connected tools" });
    await waitFor(() => expect(within(table).getByText(/One account for everything you sell/)).toBeTruthy());
    const stripe = within(table)
      .getByRole("button", { name: /^stripe/ })
      .closest("tr")!;
    expect(stripe.textContent).toMatch(/MCP.*Every department.*Connected/);
    expect(stripe.querySelector("img")?.getAttribute("src")).toBe("/logos/stripe.svg");
    const acme = within(table).getByRole("button", { name: /^Acme/ }).closest("tr")!;
    expect(acme.textContent).toMatch(/Your own.*Add its key/);
    expect(within(table).getByText("GitHub").closest("tr")!.textContent).toMatch(/Built-in.*Add a token/);
    // Finance: Xero (its own), Stripe (every department); not GitHub.
    fireEvent.click(within(screen.getByRole("group", { name: "Department" })).getByRole("button", { name: "Finance" }));
    const fin = screen.getByRole("table", { name: "Connected tools" });
    expect(within(fin).getByRole("button", { name: /^xero/ })).toBeTruthy();
    expect(within(fin).getByRole("button", { name: /^stripe/ })).toBeTruthy();
    expect(within(fin).queryByText("GitHub")).toBeNull();
    expect(screen.getByRole("heading", { name: "What Finance knows how to do" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What Finance still needs" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tools and skills" }), { target: { value: "xer" } });
    expect(within(fin).queryByRole("button", { name: /^stripe/ })).toBeNull();
  });

  it("Browse connects in one click with the catalog's link, then shows its sign-in", async () => {
    const posts = backend([]);
    render(<ConnectorsHub mailAccess={{}} onMailAccess={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Browse tools" }));
    const shared = await screen.findByRole("list", { name: "Every department catalog" });
    const slack = within(shared).getByRole("listitem", { name: "Slack" });
    fireEvent.click(within(slack).getByRole("button", { name: "Connect Slack" }));
    await waitFor(() => expect(posts).toEqual([{ url: "https://mcp.slack.com/mcp", label: "Slack" }]));
    await waitFor(() => expect(within(slack).getByText("Sign in")).toBeTruthy());
  });

  it("asks for the store's or desk's name before it can connect", async () => {
    backend([]);
    render(<ConnectorsHub mailAccess={{}} onMailAccess={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    const support = await screen.findByRole("list", { name: "Customer Support catalog" });
    const card = within(support).getByRole("listitem", { name: "Freshdesk" });
    const button = within(card).getByRole("button", { name: /^Connect/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(within(card).getByRole("textbox"), { target: { value: "acme" } });
    expect(button.disabled).toBe(false);
  });

  it("+ Add opens a menu whose items open the right form", async () => {
    backend([]);
    render(<ConnectorsHub mailAccess={{}} onMailAccess={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const menu = screen.getByRole("menu", { name: "Add" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((m) => m.querySelector("b")!.textContent),
    ).toEqual(["Tool by link", "Mailbox or calendar", "Write a skill", "Upload a skill"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Mailbox or calendar/ }));
    expect(screen.getByRole("group", { name: "Add a mailbox or calendar" })).toBeTruthy();
  });
});
