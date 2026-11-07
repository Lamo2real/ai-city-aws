import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySnapshot, initialState, placement, reduce, topBar, visualState, CORE } from "../src/city/city-state.js";
import { Confirm } from "../src/components/ui.tsx";
import { SpendPill } from "../src/components/SpendPill.tsx";
import { Eyes } from "../src/components/Eyes.tsx";
import { spendLevel, money } from "../src/lib/format.ts";
import { store } from "../src/lib/store.ts";
import { wakeMatch } from "../src/voice/wake.ts";
import wakeCases from "../../tests/fixtures/wake-cases.json" with { type: "json" };

afterEach(cleanup);
const at = new Date().toISOString();

describe("money", () => {
  it("is amber at 80% of the cap and red at 100%", () => {
    expect(spendLevel(7.9, 10)).toBe("ok");
    expect(spendLevel(8, 10)).toBe("amber");
    expect(spendLevel(10, 10)).toBe("red");
    expect(money(3.2)).toBe("$3.20");
    expect(money(10000)).toBe("$10,000");
  });
  it("the spend pill says 'Today: $x', names a limit only from half of it, changes level and opens Costs", () => {
    const open = vi.fn();
    act(() =>
      store.snapshot({
        usage: { usd: 3.2, turns: 4, tokens: 1000 },
        caps: { daily_global_usd: 10, monthly_budget_usd: 150, daily_department_usd: 5 },
      }),
    );
    render(<SpendPill onOpen={open} />);
    const pill = screen.getByRole("button", { name: /^Today: \$3.20, estimate/ }); // far from the limit: no "of"
    expect(pill.dataset.level).toBe("ok");
    act(() => store.snapshot({ usage: { usd: 6.1, turns: 5, tokens: 1500 }, caps: { daily_global_usd: 10 } }));
    expect(screen.getByRole("button", { name: /Today: \$6.10 of \$10, estimate/ })).toBeTruthy();
    act(() => store.snapshot({ usage: { usd: 2.07, turns: 5, tokens: 1500 }, caps: { daily_global_usd: 10000 } }));
    expect(screen.getByRole("button", { name: /^Today: \$2.07, estimate/ })).toBeTruthy(); // never "of $10000"
    act(() =>
      store.snapshot({
        usage: { usd: 10, turns: 9, tokens: 2000 },
        caps: { daily_global_usd: 10, monthly_budget_usd: 150, daily_department_usd: 5 },
      }),
    );
    expect(screen.getByRole("button", { name: /limit reached/ }).dataset.level).toBe("red");
    fireEvent.click(screen.getByRole("button", { name: /Open costs/ }));
    expect(open).toHaveBeenCalled();
  });
});

describe("the ported City state", () => {
  it("has AIC and the Orchestrator as the core, and no Secretary or Reviewer", () => {
    expect([...CORE]).toEqual(["ace", "orchestrator"]);
  });
  it("puts a hired worker at a desk in its department and sends a released one home", () => {
    let s = applySnapshot(initialState(), {
      agents: [{ id: "ace", kind: "core", role: "AIC", department: null, model: "sonnet-5-5", state: "active" }],
      departments: [],
    });
    s = reduce(s, {
      type: "department.created",
      name: "Engineering",
      mission: "Build",
      manager_id: "mgr-engineering",
      at,
    });
    s = reduce(s, {
      type: "agent.hired",
      agent: {
        id: "mgr-engineering",
        kind: "manager",
        role: "Engineering Manager",
        department: "Engineering",
        model: "fable-5-1",
        parent: "orchestrator",
        state: "dormant",
      },
      at,
    });
    s = reduce(s, {
      type: "agent.hired",
      agent: {
        id: "wkr-1",
        kind: "worker",
        role: "Dev",
        department: "Engineering",
        model: "opus-5-5",
        parent: "mgr-engineering",
        state: "active",
        worker_state: "hired",
      },
      at,
    });
    expect(placement(s, "wkr-1")).toMatchObject({ place: "station", dept: "Engineering" });
    expect(placement(s, "ace")).toMatchObject({ place: "hq" });
    expect(topBar(s)).toMatchObject({ agentsTotal: 2 });
    s = reduce(s, { type: "agent.retired", id: "wkr-1", at });
    s = reduce(s, { type: "worker.state", id: "wkr-1", state: "released", at });
    expect(placement(s, "wkr-1")?.place).toBe("home");
    expect(s.feed.some((f) => /Department Engineering created/.test(f.text))).toBe(true);
  });
  it("shows 'needs you' for an agent with an open question or approval", () => {
    let s = applySnapshot(initialState(), {
      agents: [
        {
          id: "w1",
          kind: "worker",
          role: "Dev",
          department: "Eng",
          model: "opus-5-5",
          state: "active",
          worker_state: "working",
        },
      ],
      tickets: [{ id: "t1", to: "w1", from: "m", status: "in_progress", goal: "g" }],
    });
    s = reduce(s, {
      type: "question.asked",
      question: {
        id: "q1",
        asked_by: "w1",
        path: "m › w1",
        ticket_id: null,
        text: "Which DB?",
        options: [],
        default_answer: "SQLite",
        status: "open",
        created_at: at,
      },
      at,
    });
    expect(visualState(s, "w1")).toBe("waiting_owner");
    expect(topBar(s).questionsWaiting).toBe(1);
  });
  it("saved specialists live in the houses", () => {
    const s = applySnapshot(initialState(), {
      agents: [],
      specialists: [{ id: "sp1", specialty: "Tester", department: "Eng", created_at: at }],
    });
    expect(placement(s, "spec-sp1")).toMatchObject({ place: "home" });
    expect(topBar(s).agentsTotal).toBe(0);
  });
});

describe("AIC's chat streaming", () => {
  it("joins streamed chunks into one reply and marks it done", () => {
    store.set({ chat: [] });
    store.event({ type: "ace.reply", conversation: "main", text: "Eigh", done: false });
    store.event({ type: "ace.reply", conversation: "main", text: "teen", done: false });
    expect(store.get().chat.at(-1)).toMatchObject({ who: "ace", text: "Eighteen", state: "streaming" });
    store.event({ type: "ace.reply", conversation: "main", text: "Eighteen.", done: true });
    expect(store.get().chat).toHaveLength(1);
    expect(store.get().chat[0]).toMatchObject({ text: "Eighteen.", state: "done" });
  });
});

describe("dangerous actions need a clear confirmation", () => {
  it("a typed word must match before the confirm button works", () => {
    const ok = vi.fn();
    render(
      <Confirm
        title="Raise?"
        what="More spend"
        cost="Up to $50 more"
        confirmLabel="Raise the cap"
        confirmWord="raise"
        onConfirm={ok}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "Raise the cap" });
    expect(btn).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText(/Type raise/), { target: { value: "RAISE" } });
    expect(btn).toHaveProperty("disabled", false);
    fireEvent.click(btn);
    expect(ok).toHaveBeenCalled();
    expect(screen.getByText(/Up to \$50 more/)).toBeTruthy();
  });
  it("a hold button does nothing on a plain click", () => {
    const ok = vi.fn();
    render(
      <Confirm
        title="Approve?"
        what="npm publish"
        cost="May cost money"
        confirmLabel="Approve"
        hold
        onConfirm={ok}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Hold to approve/ }));
    expect(ok).not.toHaveBeenCalled();
  });
});

describe("AIC's eyes", () => {
  it.each(["idle", "listening", "thinking", "speaking", "waiting"] as const)("say the %s state in words", (p) => {
    render(<Eyes presence={p} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/AIC is/);
  });
});

describe("wake word", () => {
  it("the browser gives the answers the server gives (shared fixture, checked by the Python tests too)", () => {
    for (const { text, want } of wakeCases.cases) expect(wakeMatch(text), text).toBe(want);
  });
});
