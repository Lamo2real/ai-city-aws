// Settings → Executives (decision 140): the four on or off, their advice with sources, and the reviews (off by
// default). A 404 before the backend is deployed shows a quiet note.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { askedBy, everyDays, Executives, sourceWords } from "../src/components/Executives.tsx";
import { SETTINGS_PAGES } from "../src/components/Screens.tsx";
import { loadConfig } from "../src/lib/config.ts";

const EXECS = [
  { id: "ceo", title: "CEO", name: "Chief Executive Officer", about: "Strategy and direction.", enabled: true },
  { id: "coo", title: "COO", name: "Chief Operating Officer", about: "How well the city delivers.", enabled: true },
  { id: "cfo", title: "CFO", name: "Chief Financial Officer", about: "The money. Never spends.", enabled: true },
  { id: "cto", title: "CTO", name: "Chief Technology Officer", about: "Technology.", enabled: false },
];
const REC = {
  id: "rec-1-cfo",
  executive: "cfo",
  title: "CFO",
  question: "Does hiring a video team pay off?",
  recommendation: "Go ahead, but cap the pilot at one month.",
  reasons: ["Costs this month are about $12"],
  risks: ["Spend grows if the pilot isn't capped"],
  facts: ["month_usd 12.4 (source: costs)"],
  assumptions: ["The deals close at their listed value"],
  confidence: "medium",
  sources: ["company_brief", "costs", "deals"],
  to: "vaic",
  at: "2026-11-09T10:00:00Z",
};
const REVIEWS = [
  { id: "cfo-cost-review", executive: "cfo", title: "Cost review", enabled: false, every_days: 7, last_run_at: null },
  { id: "coo-bottleneck-review", executive: "coo", title: "Bottleneck review", enabled: false, every_days: 7 },
];
const STATE = { executives: EXECS, recommendations: [REC], reviews: REVIEWS };

const calls: Array<{ url: string; method: string; body: unknown }> = [];
let get: () => Response = () => new Response(JSON.stringify(STATE));
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test" }));
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method, body });
  if (url.endsWith("/executives")) {
    if (method === "PUT") {
      const b = body as { enabled?: Record<string, boolean>; reviews?: Record<string, Record<string, unknown>> };
      return new Response(
        JSON.stringify({
          ...STATE,
          executives: EXECS.map((x) => ({ ...x, enabled: b.enabled?.[x.id] ?? x.enabled })),
          reviews: REVIEWS.map((r) => ({ ...r, ...(b.reviews?.[r.id] ?? {}) })),
        }),
      );
    }
    return get();
  }
  return new Response("{}", { status: 404 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
afterEach(() => {
  cleanup();
  calls.length = 0;
  get = () => new Response(JSON.stringify(STATE));
});

describe("Settings → Executives", () => {
  it("is a page in Settings", () => {
    expect(SETTINGS_PAGES.find((p) => p.id === "executives")?.title).toBe("Executives");
  });

  it("says things in plain words", () => {
    expect(everyDays(1)).toBe("every day");
    expect(everyDays(7)).toBe("every week");
    expect(everyDays(14)).toBe("every 2 weeks");
    expect(everyDays(30)).toBe("every 30 days");
    expect(sourceWords(["costs", "department_reports", "knowledge"])).toBe("costs, department reports, knowledge base");
    expect(askedBy({ ...REC, to: "orchestrator" })).toBe("Asked by the planner");
    expect(askedBy({ ...REC, review: "cfo-cost-review" })).toBe("Scheduled review");
    expect(askedBy(REC)).toBe("Asked by you");
  });

  it("shows the four, their switches, the advice with its sources, and reviews off", async () => {
    const { container } = render(<Executives />);
    expect(await screen.findByRole("heading", { name: "Executives" })).toBeTruthy();
    expect(screen.getByText(/never start, assign or run work/)).toBeTruthy();
    const sw = (name: string) => screen.getByRole("switch", { name }) as HTMLInputElement;
    expect(["CEO", "COO", "CFO"].every((t) => sw(`${t} on or off`).checked)).toBe(true);
    expect(sw("CTO on or off").checked).toBe(false);
    expect(container.querySelector('[data-exec="cto"]')?.className).toMatch(/\boff\b/);
    // The advice: the recommendation, why, the risk, and what it was based on.
    expect(screen.getByText("Go ahead, but cap the pilot at one month.")).toBeTruthy();
    expect(screen.getByText("“Does hiring a video team pay off?”")).toBeTruthy();
    expect(screen.getByText("Costs this month are about $12")).toBeTruthy();
    expect(screen.getByText("Risk: Spend grows if the pilot isn't capped")).toBeTruthy();
    expect(screen.getByText("Based on: company brief, costs, deals · medium confidence")).toBeTruthy();
    expect(screen.getByText("Assumed: The deals close at their listed value")).toBeTruthy();
    // Reviews are off by default.
    expect(sw("CFO Cost review on or off").checked).toBe(false);
    expect(sw("COO Bottleneck review on or off").checked).toBe(false);
    expect(container.querySelector('[data-review="cfo-cost-review"] .order-words')?.textContent).toBe(
      "CFO cost review, every week",
    );
  });

  it("switching an executive off sends only that switch", async () => {
    render(<Executives />);
    fireEvent.click(await screen.findByRole("switch", { name: "CFO on or off" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({
      url: "https://api.vaic.test/executives",
      body: { enabled: { cfo: false } },
    });
    await waitFor(() =>
      expect((screen.getByRole("switch", { name: "CFO on or off" }) as HTMLInputElement).checked).toBe(false),
    );
  });

  it("a review is turned on and its schedule changed only by the owner's click", async () => {
    render(<Executives />);
    fireEvent.click(await screen.findByRole("switch", { name: "CFO Cost review on or off" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT").length).toBe(1));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ reviews: { "cfo-cost-review": { enabled: true } } });
    fireEvent.click(screen.getAllByRole("combobox")[1]!);
    fireEvent.click(await screen.findByRole("option", { name: "every 2 weeks" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT").length).toBe(2));
    expect(calls.filter((c) => c.method === "PUT")[1]?.body).toEqual({
      reviews: { "coo-bottleneck-review": { every_days: 14 } },
    });
  });

  it("no advice yet says how to ask", async () => {
    get = () => new Response(JSON.stringify({ ...STATE, recommendations: [] }));
    render(<Executives />);
    expect(await screen.findByText(/No advice yet\. Ask VAIC/)).toBeTruthy();
  });

  it("a 404 before the backend is deployed is a quiet note", async () => {
    get = () => new Response(JSON.stringify({ error: "There is nothing here." }), { status: 404 });
    render(<Executives />);
    expect(await screen.findByText(/arrive with the next update/)).toBeTruthy();
    expect(screen.queryByText(/didn't load/)).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("the executives in the City (permanent, home until called in)", () => {
  const exec = (state: "active" | "dormant") => ({
    id: "exec-cfo",
    kind: "executive",
    role: "CFO",
    department: null,
    model: "fable-5-1",
    parent: null,
    state,
    worker_state: null,
  });
  it("live at home, come to HQ while advising, go home after, and never count as working", async () => {
    const { initialState, reduce, placement, topBar, deptOf, plainWho, residents } =
      await import("../src/city/city-state.js");
    let s = reduce(initialState(), { type: "executive.office", id: "exec-cfo", at_hq: false, agent: exec("dormant") });
    expect(placement(s, "exec-cfo")).toMatchObject({ place: "home", dept: "HQ" });
    expect(residents(s).ids).toContain("exec-cfo"); // it has a house of its own
    s = reduce(s, { type: "executive.office", id: "exec-cfo", at_hq: true, agent: exec("dormant") });
    expect(placement(s, "exec-cfo")).toMatchObject({ place: "hq", dept: "HQ", why: "called in" });
    expect(topBar(s).agentsActive).toBe(0); // "Agents working now" counts workers only
    expect(deptOf(s.agents["exec-cfo"]!)).toBe("HQ");
    expect(plainWho(s, "exec-cfo")).toBe("The CFO");
    s = reduce(s, { type: "executive.office", id: "exec-cfo", at_hq: false, agent: exec("active") });
    expect(placement(s, "exec-cfo")).toMatchObject({ place: "home" });
  });
});
