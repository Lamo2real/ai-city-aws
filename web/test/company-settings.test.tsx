// Settings → Company (decisions 135–137, 136/138): the brief, where customers write, the running switch, one Save, and what
// runs on its own; Remove calls DELETE; a 404 before the backend is deployed shows an empty form quietly.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CompanySettings, everyWords } from "../src/components/CompanySettings.tsx";
import { loadConfig } from "../src/lib/config.ts";

const ORDERS = [
  {
    id: "so-company-support",
    department: "Customer Support",
    source: "Slack #support",
    instructions: "…",
    every_minutes: 15,
    enabled: true,
  },
  {
    id: "so-company-sales",
    department: "Sales",
    source: "the sales pipeline",
    instructions: "…",
    every_minutes: 1440,
    enabled: false,
  },
];
const BRIEF = {
  text: "We sell shoes online.",
  running: true,
  support_source: "Slack #support",
  set_at: "2026-11-09T10:00:00Z",
  running_since: "2026-11-09T10:00:00Z",
};

const calls: Array<{ url: string; method: string; body: unknown }> = [];
let get: () => Response = () => new Response(JSON.stringify({ brief: null, orders: [] }));
let put: (body: Record<string, unknown>) => Response = (b) =>
  new Response(JSON.stringify({ brief: { ...BRIEF, ...b }, orders: ORDERS }));
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.aic.test" }));
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method, body });
  if (url.endsWith("/company")) {
    if (method === "PUT") return put(body);
    if (method === "DELETE") return new Response(JSON.stringify({ brief: null, orders: ORDERS }));
    return get();
  }
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
  get = () => new Response(JSON.stringify({ brief: null, orders: [] }));
});

describe("Settings → Company", () => {
  it("says how often in words", () => {
    expect(everyWords(15)).toBe("every 15 minutes");
    expect(everyWords(60)).toBe("every hour");
    expect(everyWords(1440)).toBe("every day");
    expect(everyWords(2880)).toBe("every 2 days");
  });

  it("a 404 shows the empty form quietly, with nothing running yet", async () => {
    get = () => new Response(JSON.stringify({ error: "There is nothing here." }), { status: 404 });
    render(<CompanySettings />);
    expect(await screen.findByRole("heading", { name: "Your company" })).toBeTruthy();
    expect(screen.getByText(/Nothing runs on its own yet/)).toBeTruthy();
    expect(screen.queryByText(/didn't load/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove the brief" })).toBeNull();
    // Off by default (decision 138): nothing starts unless the owner says so.
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/^Off: nothing runs on its own\. Switch it on/)).toBeTruthy();
  });

  it("shows the brief and what runs on its own, with no jargon", async () => {
    get = () => new Response(JSON.stringify({ brief: BRIEF, orders: ORDERS }));
    const { container } = render(<CompanySettings />);
    expect(await screen.findByDisplayValue("We sell shoes online.")).toBeTruthy();
    expect(screen.getByDisplayValue("Slack #support")).toBeTruthy();
    const since = new Date(BRIEF.running_since).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
    expect(screen.getByText(`Running on its own since ${since}.`)).toBeTruthy();
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("heading", { name: "What runs on its own" })).toBeTruthy();
    const rows = [...container.querySelectorAll(".order")].map((r) => r.textContent);
    expect(rows).toEqual([
      "Customer Support watches Slack #support, every 15 minutesOn",
      "Sales watches the sales pipeline, every dayOff",
    ]);
    expect(container.textContent).not.toMatch(/standing order/i);
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
  });

  it("saving the text alone sends running false: it does not switch it on", async () => {
    render(<CompanySettings />);
    fireEvent.change(await screen.findByPlaceholderText(/online fashion store like Zalando/), {
      target: { value: "We sell shoes online." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      text: "We sell shoes online.",
      running: false,
      support_source: "",
    });
  });

  it("Save sends the brief, the source and the switch", async () => {
    render(<CompanySettings />);
    const text = await screen.findByPlaceholderText(/online fashion store like Zalando/);
    fireEvent.change(text, { target: { value: "We sell shoes online." } });
    fireEvent.change(screen.getByPlaceholderText("Slack #support or support@yourshop.com"), {
      target: { value: "support@shoes.test" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({
      url: "https://api.aic.test/company",
      body: { text: "We sell shoes online.", running: true, support_source: "support@shoes.test" },
    });
    await waitFor(() => expect(document.querySelector(".order")?.textContent).toMatch(/^Customer Support watches/));
  });

  it("an empty brief shows the backend's words", async () => {
    put = () =>
      new Response(JSON.stringify({ error: "Say what the business is and what it sells, in a sentence or two." }), {
        status: 400,
      });
    render(<CompanySettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Say what the business is and what it sells, in a sentence or two.")).toBeTruthy();
  });

  it("Remove the brief calls DELETE and empties the form", async () => {
    get = () => new Response(JSON.stringify({ brief: BRIEF, orders: ORDERS }));
    render(<CompanySettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove the brief" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    await waitFor(() => expect(screen.queryByDisplayValue("We sell shoes online.")).toBeNull());
    expect(screen.queryByRole("button", { name: "Remove the brief" })).toBeNull();
  });
});
