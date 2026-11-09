// Sales pipeline (decisions 133 and 137): open deals by stage, stale ones flagged for a follow-up, won and lost under
// "Closed", the detail, the empty state and a quiet 404 before the backend is deployed.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PipelineBoard, openDeals, valueWords, type Deal } from "../src/components/PipelineBoard.tsx";
import { loadConfig } from "../src/lib/config.ts";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 60_000).toISOString();
const deal = (extra: Partial<Deal> = {}): Deal => ({
  id: "deal-1",
  name: "Acme",
  company: "Acme AB",
  contact: "Bo",
  email: "bo@acme.test",
  stage: "lead",
  words: "New lead",
  value: 5000,
  currency: "USD",
  next_step: "Call Bo about the offer",
  last_contact_at: daysAgo(2),
  history: [{ at: "2026-11-01T10:00:00Z", who: "Sales", text: "Added the deal." }],
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  ...extra,
});

let answer: () => Response = () => new Response(JSON.stringify({ stale_days: 7, deals: [] }));
const calls: string[] = [];
const fetchMock = vi.fn(async (url: string) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.aic.test" }));
  calls.push(url);
  if (url.endsWith("/deals")) return answer();
  return new Response("{}", { status: 404 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __aicAuth: unknown }).__aicAuth = { idToken: async () => "header.payload.sig" };
});
afterEach(() => {
  cleanup();
  calls.length = 0;
});

const list =
  (deals: Deal[], stale_days = 7) =>
  () =>
    new Response(JSON.stringify({ stale_days, deals }));
const EMPTY = /No deals yet\. If you use HubSpot, Pipedrive or another CRM, Sales works there\./;

describe("sales pipeline", () => {
  it("formats values and orders open deals by stage, keeping the server order inside a stage", () => {
    expect(valueWords({ value: 5000, currency: "USD" })).toBe("$5,000");
    expect(valueWords({ value: null, currency: "USD" })).toBeNull();
    const ds = [
      deal({ id: "p", stage: "proposal" }),
      deal({ id: "l1", stage: "lead" }),
      deal({ id: "w", stage: "won" }),
      deal({ id: "l2", stage: "lead" }),
    ];
    expect(openDeals(ds).map((d) => d.id)).toEqual(["l1", "l2", "p"]);
  });

  it("shows the empty state", async () => {
    answer = list([]);
    render(<PipelineBoard />);
    expect(await screen.findByText(EMPTY)).toBeTruthy();
    expect(calls).toEqual(["https://api.aic.test/deals"]);
  });

  it("a 404 before the backend is deployed shows the empty state quietly", async () => {
    answer = () => new Response(JSON.stringify({ error: "There is nothing here." }), { status: 404 });
    render(<PipelineBoard />);
    expect(await screen.findByText(EMPTY)).toBeTruthy();
    expect(screen.queryByText(/did not load/)).toBeNull();
  });

  it("lists open deals by stage, flags stale ones, and puts won and lost under Closed", async () => {
    answer = list([
      deal({ id: "a", name: "Old proposal", stage: "proposal", words: "Proposal sent", last_contact_at: daysAgo(9) }),
      deal({ id: "b", name: "Fresh lead", last_contact_at: daysAgo(2), value: null }),
      deal({ id: "c", name: "Won one", contact: "", stage: "won", words: "Won", last_contact_at: daysAgo(30) }),
      deal({ id: "d", name: "Lost one", stage: "lost", words: "Lost", last_contact_at: daysAgo(20) }),
    ]);
    const { container } = render(<PipelineBoard />);
    await screen.findByText("Fresh lead (Bo)");
    const names = [...container.querySelectorAll(".job-name")].map((n) => n.textContent);
    expect(names).toEqual([
      "Fresh lead (Bo) · Marketing",
      "Old proposal (Bo) · Sales",
      "Won one · Sales",
      "Lost one (Bo) · Sales",
    ]);
    expect(screen.getByRole("heading", { name: "Closed" })).toBeTruthy();
    // Value shown when there is one; next step on every row.
    expect(screen.getByText("Old proposal (Bo)").closest("button")!.textContent).toContain("$5,000");
    expect(screen.getByText("Fresh lead (Bo)").closest("button")!.textContent).not.toContain("$");
    expect(screen.getAllByText("Next: Call Bo about the offer").length).toBe(4);
    // Stale and open: flagged. Fresh, or closed however old: not.
    const late = [...container.querySelectorAll(".pl-late")].map((n) => n.textContent);
    expect(late).toEqual(["Last contact 9 days ago. Needs a follow-up"]);
    expect(screen.getByText("Last contact 2 days ago")).toBeTruthy();
    expect(screen.getByText("Last contact 30 days ago")).toBeTruthy();
  });

  it("uses the stale days from the backend", async () => {
    answer = list([deal({ last_contact_at: daysAgo(3) })], 3);
    const { container } = render(<PipelineBoard />);
    await screen.findByText("Acme (Bo)");
    expect(container.querySelector(".pl-late")?.textContent).toBe("Last contact 3 days ago. Needs a follow-up");
  });

  it("tapping a row opens its detail with the history, and Back returns", async () => {
    answer = list([
      deal({
        history: [
          { at: "2026-11-01T10:00:00Z", who: "Sales", text: "Added the deal." },
          { at: "2026-11-02T10:00:00Z", who: "Sales", text: "Emailed Bo the offer." },
        ],
      }),
    ]);
    render(<PipelineBoard />);
    fireEvent.click(await screen.findByText("Acme (Bo)"));
    expect(screen.getByRole("heading", { name: "Acme (Bo)" })).toBeTruthy();
    expect(screen.getByText("Acme AB · bo@acme.test")).toBeTruthy();
    expect(screen.getByText(/Sales: Emailed Bo the offer\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /All deals/ }));
    expect(screen.queryByText("What happened")).toBeNull();
    expect(screen.getByText("Acme (Bo)")).toBeTruthy();
  });

  it("shows the team on each row and filters Marketing leads from Sales deals", async () => {
    answer = list([
      deal({ id: "m", name: "Nurtured", stage: "nurturing", words: "Being nurtured", team: "Marketing" }),
      deal({ id: "q", name: "Qualified", stage: "qualified", words: "Qualified for Sales", team: "Sales" }),
      deal({ id: "n", name: "Negotiating", stage: "negotiation", words: "Negotiating", team: "Sales" }),
    ]);
    const { container } = render(<PipelineBoard />);
    await screen.findByText("Being nurtured");
    const names = () => [...container.querySelectorAll(".job-name")].map((n) => n.textContent);
    expect(names()).toEqual(["Nurtured (Bo) · Marketing", "Qualified (Bo) · Sales", "Negotiating (Bo) · Sales"]);
    expect(screen.getByText("Qualified for Sales")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marketing leads" }));
    expect(names()).toEqual(["Nurtured (Bo) · Marketing"]);
    fireEvent.click(screen.getByRole("button", { name: "Sales deals" }));
    expect(names()).toEqual(["Qualified (Bo) · Sales", "Negotiating (Bo) · Sales"]);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(names().length).toBe(3);
  });
});
