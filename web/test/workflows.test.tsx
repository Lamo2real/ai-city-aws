// AI workflows (docs/PRODUCT.md "AI workflows"): the walkthrough card under VAIC's chat pages one step at a
// time, switches modes, points to Settings to connect, and "Yes, create it" is a chat message, not a spend call.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_WORDS, WorkflowCard } from "../src/components/WorkflowCard.tsx";
import { loadConfig } from "../src/lib/config.ts";
import { store } from "../src/lib/store.ts";
import { currentRun, workflows, type WorkflowRun } from "../src/lib/workflows.ts";

const run = (extra: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: "wf-1",
  workflow_id: "meta-ads-campaign",
  name: "Meta Ads campaign",
  summary: "A Meta Ads campaign for your page.",
  connector: {
    id: "meta-ads",
    label: "Meta Ads",
    connected: true,
    where: "Settings → Departments & tools → Marketing",
  },
  mode: "guide",
  status: "active",
  inputs: [
    { key: "budget", label: "Daily budget", question: "How much per day, Sir?", value: "300 per day" },
    { key: "audience", label: "Audience", question: "Who should see it, Sir?", value: null },
  ],
  next: { kind: "step" },
  step: 0,
  steps: [
    { id: "s1", title: "Open Ads Manager", guide: "Go to Ads Manager and press Create.", inputs: [], done: false },
    { id: "s2", title: "Set the budget", guide: "Type 300 as the daily budget.", inputs: ["budget"], done: false },
    { id: "s3", title: "Pick the audience", guide: "Choose who sees it.", inputs: ["audience"], done: false },
  ],
  spend: null,
  task_id: null,
  conversation: "main",
  created_at: "2026-11-09T10:00:00Z",
  updated_at: "2026-11-09T10:00:00Z",
  ...extra,
});

const calls: Array<{ url: string; method: string; body: unknown }> = [];
let listAnswer: Response | null = null;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test" }));
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method: init?.method ?? "GET", body });
  const now = workflows.get().runs["wf-1"] ?? run();
  const later = { updated_at: `2099-01-01T00:00:${String(calls.length).padStart(2, "0")}Z` };
  if (url.endsWith("/workflows"))
    return listAnswer ?? new Response(JSON.stringify({ error: "There is nothing here." }), { status: 404 });
  if (url.endsWith("/step")) {
    const step = body.to === "back" ? now.step - 1 : now.step + 1;
    return new Response(JSON.stringify({ run: { ...now, ...later, step } }));
  }
  if (url.endsWith("/mode")) return new Response(JSON.stringify({ run: { ...now, ...later, mode: body.mode } }));
  if (url.includes("/workflows/taste/")) return new Response(JSON.stringify({ result: "Sent to the team" }));
  if (url.endsWith("/cancel")) return new Response(JSON.stringify({ run: { ...now, ...later, status: "cancelled" } }));
  return new Response(JSON.stringify({ accepted: true }), { status: 202 });
});

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await loadConfig();
  (window as unknown as { __vaicAuth: unknown }).__vaicAuth = { idToken: async () => "header.payload.sig" };
});
beforeEach(() => {
  localStorage.clear();
  workflows.state = { runs: {}, missing: false };
  act(() => store.set({ chat: [] }));
});
afterEach(() => {
  cleanup();
  calls.length = 0;
  listAnswer = null;
});

const show = (r: WorkflowRun) => act(() => workflows.event({ type: "workflow.updated", run: r }));

describe("workflow runs", () => {
  it("a 404 on /workflows means nothing to show", async () => {
    const { container } = render(<WorkflowCard />);
    await act(() => workflows.load());
    expect(workflows.get().missing).toBe(true);
    expect(container.innerHTML).toBe("");
  });

  it("loads runs and picks the newest open one in this conversation", async () => {
    listAnswer = new Response(
      JSON.stringify({
        workflows: [],
        runs: [
          run({ id: "wf-new", created_at: "2026-11-09T12:00:00Z", status: "done" }),
          run({ id: "wf-app", created_at: "2026-11-09T11:00:00Z", conversation: "app-x" }),
          run({ id: "wf-1" }),
        ],
      }),
    );
    await workflows.load();
    expect(currentRun(workflows.get().runs, "main")?.id).toBe("wf-1");
  });

  it("the event shows the card and updates it", () => {
    render(<WorkflowCard />);
    show(run());
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("Go to Ads Manager and press Create.")).toBeTruthy();
    show(run({ step: 1, updated_at: "2026-11-09T10:01:00Z" }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("Daily budget")).toBeTruthy();
    expect(screen.getByText("300 per day")).toBeTruthy();
    // An older copy arriving late does not move the card back.
    show(run({ step: 0, updated_at: "2026-11-09T09:00:00Z" }));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    // Done or cancelled: the card goes.
    show(run({ status: "done", updated_at: "2026-11-09T10:02:00Z" }));
    expect(screen.queryByText(/Step \d of 3/)).toBeNull();
  });

  it("Next and Back page through the step route; the last page says Done", async () => {
    render(<WorkflowCard />);
    show(run());
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Step 2 of 3")).toBeTruthy());
    expect(calls.at(-1)).toMatchObject({
      url: "https://api.vaic.test/workflows/runs/wf-1/step",
      method: "POST",
      body: { to: "next" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByText("Step 1 of 3")).toBeTruthy());
    expect(calls.at(-1)?.body).toEqual({ to: "back" });
    show(run({ step: 2, updated_at: "2100-01-01T00:00:00Z" }));
    expect(screen.getByText("VAIC will ask")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ to: "done" }));
  });

  it("mode buttons post the mode", async () => {
    render(<WorkflowCard />);
    show(run({ mode: null, next: { kind: "mode" } }));
    fireEvent.click(screen.getByRole("button", { name: "Do it for me" }));
    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({
        url: "https://api.vaic.test/workflows/runs/wf-1/mode",
        body: { mode: "do" },
      }),
    );
    show(run({ mode: null, next: { kind: "mode" }, updated_at: "2100-01-01T00:00:00Z" }));
    fireEvent.click(screen.getByRole("button", { name: "Walk me through it" }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ mode: "guide" }));
  });

  it("Stop cancels the run", async () => {
    render(<WorkflowCard />);
    show(run());
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe("https://api.vaic.test/workflows/runs/wf-1/cancel"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).toBeNull());
  });

  it("connect: a plain line with a link to Settings", () => {
    render(<WorkflowCard />);
    show(run({ next: { kind: "connect" }, connector: { ...run().connector, connected: false } }));
    expect(screen.getByText(/Connect Meta Ads first: Settings → Departments & tools → Marketing\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Departments & tools" }).getAttribute("href")).toBe(
      "#/settings/departments",
    );
  });

  it("confirm: shows the spend and 'Yes, create it' is a chat message, not a spend call", async () => {
    render(<WorkflowCard />);
    show(
      run({
        mode: "do",
        next: { kind: "confirm" },
        spend: {
          daily: 300,
          currency: "AED",
          start: "2026-11-10",
          end: "2026-11-16",
          days: 7,
          total: 2100,
          text: "AED 300 a day, AED 2,100 in total, 10 to 16 November",
        },
      }),
    );
    expect(screen.getByText("AED 300 a day, AED 2,100 in total, 10 to 16 November")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_WORDS }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/messages"))).toBe(true));
    const sent = calls.filter((c) => c.method === "POST");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      url: "https://api.vaic.test/messages",
      body: { text: "Yes, create it", conversation: "main" },
    });
    expect(store.get().chat.at(-1)).toMatchObject({ who: "owner", text: "Yes, create it" });
  });

  it("running: the team is on it, with the task id", () => {
    render(<WorkflowCard />);
    show(run({ mode: "do", status: "running", task_id: "t-42", next: { kind: "none" } }));
    expect(screen.getByRole("status").textContent).toContain("The team is on it");
    expect(screen.getByText(/t-42/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("the header collapses the card", () => {
    render(<WorkflowCard />);
    show(run());
    const head = screen.getByRole("button", { name: /Meta Ads campaign/ });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("taste questions: the work isn't waiting, my pick is marked, a tap answers through the taste route", async () => {
    render(<WorkflowCard />);
    show(
      run({
        workflow_id: "app-build",
        name: "App build",
        mode: "do",
        status: "running",
        present: false,
        task_id: "t-7",
        next: { kind: "none" },
        inputs: [
          { key: "look", label: "Look", question: "How should it look?", value: "Clean and light", assumed: true },
        ],
        taste: [
          {
            id: "tq-1",
            question: "How should it look?",
            options: ["Clean and light", "Dark and sleek"],
            default: "Clean and light",
            status: "open",
            answer: null,
            asked_by: "vaic",
          },
          {
            id: "tq-2",
            question: "Old one",
            options: ["A", "B"],
            default: "A",
            status: "answered",
            answer: "B",
            asked_by: "wkr-1",
          },
        ],
      }),
    );
    expect(screen.getByText("Your say (the work isn't waiting)")).toBeTruthy();
    expect(screen.getByText(/finishing it on its own/)).toBeTruthy();
    expect(screen.getByText(/my pick; change it below/)).toBeTruthy();
    expect(screen.queryByText("Old one")).toBeNull();
    expect(screen.getByText("Going with: Clean and light")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dark and sleek" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/workflows/taste/tq-1"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/workflows/taste/tq-1"))).toMatchObject({
      method: "POST",
      body: { answer: "Dark and sleek" },
    });
    expect(calls.some((c) => c.url.endsWith("/messages"))).toBe(false);
  });
});
