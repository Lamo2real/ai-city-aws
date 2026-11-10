// A link's brand and site profile in Knowledge (docs/KNOWLEDGE.md §16): swatches, fonts, logo, content, and that
// nothing the site sent can become markup, a script or a remote request.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { knowledgeApi, type KnowledgeItem, type SiteProfile } from "../src/lib/api.ts";
import { knowledge } from "../src/lib/knowledge.ts";
import { KnowledgeScreen } from "../src/components/Knowledge.tsx";
import { safeLogo, SiteProfileView, swatches } from "../src/components/SiteProfile.tsx";

const LOGO = "data:image/png;base64,iVBORw0KGgo=";
const profile = (over: Partial<SiteProfile> = {}): SiteProfile => ({
  url: "https://acme.example/",
  brand: "acme.example",
  captured_at: "2026-11-10T09:00:00Z",
  profile: {
    name: "Acme Rockets",
    kind: "company",
    what_it_is: "Acme builds small reusable rockets.",
    audience: "Research teams",
    offerings: ["Rocket S", "Rocket M"],
    palette: [
      { role: "primary", hex: "#ff5a1f", note: "buttons" },
      { role: "text", hex: "#1a1a2e" },
    ],
    typography: { heading: "Space Grotesk", body: "Inter", notes: "bold geometric headings" },
    tone_of_voice: "Confident and short.",
  },
  design: { colors: { primary: "#ff5a1f" }, fonts: { heading: "Space Grotesk", body: "Inter" } },
  pages: [{ url: "https://acme.example/about", title: "About Acme" }],
  logo_data: LOGO,
  content: {
    outline: [
      { level: 1, text: "Launch anything" },
      { level: 2, text: "Pricing" },
    ],
    ctas: ["Book a launch"],
  },
  ...over,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SiteProfileView", () => {
  it("shows the logo, colour swatches, fonts and what the site is", () => {
    render(<SiteProfileView sp={profile()} />);
    fireEvent.click(screen.getByText(/Brand and site profile: Acme Rockets/));
    expect(screen.getByRole("img", { name: "Acme Rockets logo" }).getAttribute("src")).toBe(LOGO);
    const colours = screen.getByRole("list", { name: "Brand colours" });
    expect(within(colours).getByText("#ff5a1f")).toBeTruthy();
    expect(within(colours).getByText("primary")).toBeTruthy();
    expect(screen.getByText("Space Grotesk")).toBeTruthy();
    expect(screen.getByText("Inter")).toBeTruthy();
    expect(screen.getByText("Acme builds small reusable rockets.")).toBeTruthy();
    expect(screen.getByText("Rocket S")).toBeTruthy();
    expect(screen.getByText("About Acme")).toBeTruthy();
    expect(screen.getByText("H1 · Launch anything")).toBeTruthy();
    expect(screen.getByText("H2 · Pricing")).toBeTruthy();
    expect(screen.getByText("Book a launch")).toBeTruthy();
    expect(screen.getByText(/Read from acme.example/).textContent).toContain("Add the link again to refresh it.");
  });

  it("falls back to the colours read from the CSS when the profile has none", () => {
    const sp = profile({
      profile: { name: "Knits", kind: "e-commerce", store: { categories: ["Sweaters"], price_range: "19–89 EUR" } },
      design: { colors: { primary: "#2f6b4f", background: "#f7f3ee", accent: "not-a-colour" }, fonts: {} },
    });
    expect(swatches(sp).map((c) => c.hex)).toEqual(["#2f6b4f", "#f7f3ee"]);
    render(<SiteProfileView sp={sp} />);
    expect(screen.getByText(/Online store/)).toBeTruthy();
    expect(screen.getByText("Prices: 19–89 EUR")).toBeTruthy();
  });

  it("never renders site data as markup, a remote image or a style other than a plain colour", () => {
    const evil = profile({
      logo_data: "https://evil.example/track.png",
      profile: {
        name: '<img src=x onerror="alert(1)">',
        kind: "company",
        palette: [
          { role: "primary", hex: "red; background-image: url(https://evil.example/x)" },
          { role: "accent", hex: "#00ff00" },
        ],
      },
    });
    const { container } = render(<SiteProfileView sp={evil} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
    expect(container.querySelectorAll(".sp-swatch")).toHaveLength(1);
    expect(screen.getByText(/Brand and site profile: <img/)).toBeTruthy(); // shown as text
    expect(safeLogo("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
    expect(safeLogo(LOGO)).toBe(LOGO);
  });
});

describe("Knowledge screen", () => {
  it("shows a link's profile under the item, and an older copy of a re-added link disappears", async () => {
    const link = (id: string, sp?: SiteProfile): KnowledgeItem => ({
      id,
      kind: "link",
      title: "Acme Rockets",
      scope: "relevant",
      status: "ready",
      source: "https://acme.example/",
      brand: "acme.example",
      ...(sp ? { site_profile: sp } : {}),
    });
    vi.spyOn(knowledgeApi, "list").mockResolvedValue({
      items: [link("k-new000000001", profile()), link("k-old000000001")],
      always_tokens: 0,
      always_budget: 8000,
    });
    render(<KnowledgeScreen />);
    expect(await screen.findByText(/Brand and site profile: Acme Rockets/)).toBeTruthy();
    expect(screen.getAllByText("Acme Rockets", { selector: ".ktitle" })).toHaveLength(2);
    knowledge.event({
      type: "knowledge.updated",
      id: "k-old000000001",
      status: "deleted",
      title: "Acme Rockets",
      scope: "relevant",
      kind: "link",
    });
    await waitFor(() => expect(screen.getAllByText("Acme Rockets", { selector: ".ktitle" })).toHaveLength(1));
  });
});
