// Tickets (decisions 131 and 135): the support desk's board in Work, customers' and between teams. Rows, the five steps, the detail, the empty
// state, a 404 before the backend is deployed, and live `support.ticket` events.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportBoard, fromWords, support, type SupportTicket } from "../src/components/SupportBoard.tsx";
import { loadConfig } from "../src/lib/config.ts";

const ticket = (extra: Partial<SupportTicket> = {}): SupportTicket => ({
  id: "st-0001",
  number: 1,
  title: "Customer can't log in (error 500)",
  details: "Since this morning every login gives error 500.",
  customer: "Acme",
  channel: "slack",
  where: "#support",
  thread: "1731150000.0001",
  department: "IT Infrastructure",
  status: "with_team",
  words: "Being fixed",
  tracker: "AI City tickets",
  tracker_key: "#1",
  resolution: "",
  history: [{ at: "2026-11-09T10:00:00Z", who: "Customer Support", text: "Sent to IT Infrastructure." }],
  team_job: "t-1",
  reply_job: "",
  created_at: "2026-11-09T10:00:00Z",
  updated_at: "2026-11-09T10:00:00Z",
  ...extra,
});

let answer: () => Response = () => new Response(JSON.stringify({ board: "AI City tickets", tickets: [] }));
const fetchMock = vi.fn(async (url: string) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test" }));
  if (url.endsWith("/support-tickets")) return answer();
  return new Response("{}", { status: 404 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
beforeEach(() => {
  support.state = { tickets: {}, loaded: false, error: false };
});
afterEach(() => cleanup());

const list = (tickets: SupportTicket[]) => () => new Response(JSON.stringify({ board: "AI City tickets", tickets }));
const EMPTY = /No tickets yet\. Customer messages from Slack or your support inbox, and work one department hands/;

describe("customer tickets", () => {
  it("says where a ticket came from in plain words", () => {
    expect(fromWords(ticket())).toBe("Acme, on Slack #support");
    expect(fromWords(ticket({ customer: "bo@example.com", channel: "email", where: "support@me.com" }))).toBe(
      "bo@example.com, by email",
    );
  });

  it("shows the empty state", async () => {
    answer = list([]);
    render(<SupportBoard />);
    expect(await screen.findByText(EMPTY)).toBeTruthy();
  });

  it("a 404 before the backend is deployed shows the empty state quietly", async () => {
    answer = () => new Response(JSON.stringify({ error: "There is nothing here." }), { status: 404 });
    render(<SupportBoard />);
    expect(await screen.findByText(EMPTY)).toBeTruthy();
    expect(screen.queryByText(/did not load/)).toBeNull();
  });

  it("lists open tickets first, newest first, with the steps", async () => {
    answer = list([
      ticket({ id: "a", title: "Old open", created_at: "2026-11-08T10:00:00Z" }),
      ticket({
        id: "b",
        title: "Closed one",
        status: "closed",
        words: "Customer told",
        created_at: "2026-11-09T12:00:00Z",
      }),
      ticket({ id: "c", title: "New open", status: "new", words: "Received", created_at: "2026-11-09T11:00:00Z" }),
      ticket({ id: "d", title: "Stuck one", status: "stuck", words: "Stuck", created_at: "2026-11-07T11:00:00Z" }),
    ]);
    const { container } = render(<SupportBoard />);
    await screen.findByText("New open");
    const names = [...container.querySelectorAll(".job-name")].map((n) => n.textContent);
    expect(names).toEqual(["New open", "Old open", "Stuck one", "Closed one"]);
    expect(screen.getAllByText("Acme, on Slack #support · IT Infrastructure").length).toBe(4);
    expect(screen.getAllByText("With IT Infrastructure").length).toBe(4);
    expect(screen.getAllByText("Telling the customer").length).toBe(4);
    // The row for "Old open" (with the team): two steps reached, the second is current.
    const row = screen.getByText("Old open").closest("button")!;
    expect(row.querySelectorAll("li.sd-on").length).toBe(2);
    expect(row.querySelector('[aria-current="step"]')?.textContent).toBe("With IT Infrastructure");
    // Closed: all five reached. Stuck: a red note.
    expect(screen.getByText("Closed one").closest("button")!.querySelectorAll("li.sd-on").length).toBe(5);
    expect(screen.getByText("Stuck one").closest("button")!.querySelector(".sd-stuck")?.textContent).toBe("Stuck");
  });

  it("tapping a row opens its detail, and Back returns", async () => {
    answer = list([
      ticket({
        status: "fixed",
        words: "Fixed",
        resolution: "Restarted the login service.",
        tracker: "Jira",
        tracker_key: "SUP-7",
        history: [
          { at: "2026-11-09T10:00:00Z", who: "Customer Support", text: "Sent to IT Infrastructure." },
          { at: "2026-11-09T10:30:00Z", who: "IT Infrastructure", text: "Fixed." },
        ],
      }),
    ]);
    render(<SupportBoard />);
    fireEvent.click(await screen.findByText("Customer can't log in (error 500)"));
    expect(screen.getByRole("heading", { name: "Customer can't log in (error 500)" })).toBeTruthy();
    expect(screen.getByText("Since this morning every login gives error 500.")).toBeTruthy();
    expect(screen.getByText("Restarted the login service.")).toBeTruthy();
    expect(screen.getByText("On Slack #support, in the customer's thread.")).toBeTruthy();
    expect(screen.getByText("Also in Jira as SUP-7")).toBeTruthy();
    expect(screen.getByText(/IT Infrastructure: Fixed\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /All tickets/ }));
    expect(screen.queryByText("What the customer said")).toBeNull();
    expect(screen.getByText("Customer can't log in (error 500)")).toBeTruthy();
  });

  it("does not mention the tracker when it is AI City's own", async () => {
    answer = list([ticket()]);
    render(<SupportBoard />);
    fireEvent.click(await screen.findByText("Customer can't log in (error 500)"));
    expect(screen.queryByText(/Also in/)).toBeNull();
  });

  it("live events replace a row by id and add new ones", async () => {
    answer = list([ticket()]);
    render(<SupportBoard />);
    await screen.findByText("Being fixed");
    act(() =>
      support.event({
        type: "support.ticket",
        ticket: ticket({ status: "replying", words: "Telling the customer", updated_at: "2026-11-09T11:00:00Z" }),
      }),
    );
    expect(screen.queryByText("Being fixed")).toBeNull();
    expect(screen.getAllByText("Telling the customer").length).toBeGreaterThan(0);
    act(() =>
      support.event({
        type: "support.ticket",
        ticket: ticket({ id: "st-0002", title: "Invoice is wrong", customer: "bo@example.com", channel: "email" }),
      }),
    );
    expect(screen.getByText("Invoice is wrong")).toBeTruthy();
    expect(screen.getByText("bo@example.com, by email · IT Infrastructure")).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll(".job-name").length).toBe(2));
    // Other event types are ignored.
    act(() => support.event({ type: "workflow.updated", ticket: ticket({ id: "x", title: "Nope" }) }));
    expect(screen.queryByText("Nope")).toBeNull();
  });

  const handoff = (extra: Partial<SupportTicket> = {}) =>
    ticket({
      id: "st-0009",
      kind: "handoff",
      title: "Call back the qualified lead",
      details: "Lead asked for a price.",
      customer: "",
      channel: "handoff",
      where: "",
      thread: "",
      department: "Sales",
      from_department: "Marketing",
      chain: ["Marketing", "Sales"],
      priority: "high",
      ref: "deal-12",
      status: "new",
      words: "Filed",
      tracker: "Jira",
      tracker_key: "",
      jira: true,
      created_at: "2026-11-09T12:00:00Z",
      ...extra,
    });

  it("shows tickets between teams with their own steps, priority and filter", async () => {
    answer = list([
      ticket(),
      handoff(),
      handoff({
        id: "st-0010",
        title: "Loop",
        chain: ["Marketing", "Sales", "Marketing"],
        department: "Marketing",
        from_department: "Sales",
        priority: "low",
      }),
    ]);
    const { container } = render(<SupportBoard />);
    await screen.findByText("Call back the qualified lead");
    const row = screen.getByText("Call back the qualified lead").closest("button")!;
    expect(row.textContent).toContain("Marketing → Sales");
    expect(row.textContent).toContain("High priority");
    expect([...row.querySelectorAll("li")].map((l) => l.textContent)).toEqual([
      "Filed",
      "With Sales",
      "Done",
      "Back with Marketing",
      "Closed",
    ]);
    const loop = screen.getByText("Loop").closest("button")!;
    expect(loop.textContent).toContain("Marketing → Sales → Marketing");
    expect(loop.textContent).not.toContain("priority");
    // An old ticket without kind is a customer's.
    expect(screen.getByText("Customer can't log in (error 500)").closest("button")!.textContent).toContain("Received");

    fireEvent.click(screen.getByRole("button", { name: "Between teams" }));
    expect([...container.querySelectorAll(".job-name")].map((n) => n.textContent)).toEqual([
      "Call back the qualified lead",
      "Loop",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "From customers" }));
    expect([...container.querySelectorAll(".job-name")].map((n) => n.textContent)).toEqual([
      "Customer can't log in (error 500)",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(container.querySelectorAll(".job-name").length).toBe(3);
  });

  it("a handoff's detail shows who asked, the chain, the ref and the Jira issue", async () => {
    answer = list([handoff()]);
    render(<SupportBoard />);
    fireEvent.click(await screen.findByText("Call back the qualified lead"));
    expect(screen.getByText("What Marketing asked for")).toBeTruthy();
    expect(screen.getByText("Passed through: Marketing → Sales")).toBeTruthy();
    expect(screen.getByText("About: deal-12")).toBeTruthy();
    expect(screen.getByText("Jira issue being created")).toBeTruthy();
    expect(screen.queryByText("Where the reply goes")).toBeNull();
    act(() =>
      support.event({
        type: "support.ticket",
        ticket: handoff({ tracker_key: "SHOP-1", updated_at: "2026-11-09T13:00:00Z" }),
      }),
    );
    expect(screen.getByText("Also in Jira as SHOP-1")).toBeTruthy();
  });
});
