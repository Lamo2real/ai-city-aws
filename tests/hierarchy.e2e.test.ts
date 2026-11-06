// Phase 4 gate: one prompt walks the whole chain with a fake model runner.
// owner → Ace → Orchestrator → creates a department → Manager hires three workers → workers report →
// manager rejects one (FAIL) → the worker fixes it → manager PASS → Orchestrator sign-off → Ace reports.
import { describe, expect, it } from "vitest";

import { Dispatcher, instructAgent, resumeStale, type WorkMessage } from "@aic/shared";
import { makeCity, scriptedEngine, sessionIdFor, type Script } from "./support/city.ts";

const GOAL = "Add a power(a, b) function to add.js with a matching test";

const ace: Script = async (req, call) => {
  if (req.turn.prompt.includes("(task) from owner")) {
    await call("delegate_to_orchestrator", { goal: GOAL, owner_words: GOAL });
    return "On it — the team is starting.";
  }
  return "Done: power(a, b) is in add.js with a test, reviewed and signed off. About a cent of model time.";
};

const orchestrator: Script = async (req, call) => {
  if (req.turn.prompt.includes("(task) from ace")) {
    await call("create_department", { name: "Engineering", mission: "Build and test the owner's software." });
    await call("assign_to_department", {
      department: "Engineering",
      goal: GOAL,
      acceptance: "power works for integers and has a passing test",
    });
    return "Sent to Engineering.";
  }
  const reports = JSON.parse(await call("get_reports", {})) as Array<{ status: string }>;
  if (reports.every((r) => r.status === "in_review")) {
    await call("sign_off", { verdict: "PASS", reasons: "All acceptance criteria met, tests pass." });
    await call("report_to_ace", {
      summary: "power(a, b) added to add.js with a test; three parts reviewed, one fixed after review.",
    });
    return "PASS";
  }
  return "Waiting for reports.";
};

const PARTS = ["implement power", "write the test", "update the docs"];
const failedOnce = new Set<string>();
const manager: Script = async (req, call) => {
  const { ledger, ctx } = req;
  const mine = (await ledger.childTickets(ctx.ticketId)).filter((k) => k.kind === "assignment");
  if (req.turn.prompt.includes("(task) from orchestrator")) {
    for (const part of PARTS.slice(mine.length)) {
      const hired = await call("hire_worker", {
        specialty: "JavaScript developer",
        instructions: `You ${part} for add.js.`,
        tools: ["Bash", "Read", "Edit", "git"],
        budget_hint_usd: 1,
      });
      const id = /Hired (\S+)/.exec(hired)![1]!;
      await call("assign", { worker_id: id, goal: part, acceptance: `${part} is done and checked` });
    }
    return "Team hired and assigned.";
  }
  for (const t of mine.filter((k) => k.status === "in_review")) {
    if (t.goal === "write the test" && !failedOnce.has(t.id)) {
      failedOnce.add(t.id);
      await call("review", {
        ticket_id: t.id,
        verdict: "FAIL",
        reasons: "The test does not cover negative exponents.",
      });
      continue;
    }
    await call("review", { ticket_id: t.id, verdict: "PASS", reasons: "Meets the acceptance criteria." });
    await call("release_worker", { worker_id: t.to });
  }
  const now = (await ledger.childTickets(ctx.ticketId)).filter((k) => k.kind === "assignment");
  if (now.length === PARTS.length && now.every((k) => k.status === "done")) {
    await call("report_to_orchestrator", {
      summary: "power(a, b) implemented, tested (incl. negative exponents) and documented on branch aic/power.",
    });
  }
  return "Reviewed.";
};

const worker: Script = async (req, call) => {
  const fixing = req.turn.prompt.includes("(fix)");
  await call("report_to_manager", {
    summary: fixing ? "Added negative exponent cases; all tests pass." : "Done.",
    artifacts: ["branch aic/power"],
    checks: "npm test: pass",
  });
  return "Reported.";
};

describe("the whole chain with a fake model runner", () => {
  it("walks one prompt from the owner to Ace's report", async () => {
    const city = makeCity(scriptedEngine({ ace, orchestrator, manager, worker }));
    await city.ownerSays(GOAL);
    await city.run();

    // Ledger tickets
    const all = await city.ledger.listTickets([
      "open",
      "in_progress",
      "in_review",
      "waiting_on_owner",
      "parked",
      "done",
      "failed",
      "cancelled",
    ]);
    const task = all.find((t) => t.from === "ace")!;
    expect(task.status).toBe("done");
    expect(task.result).toMatch(/power/);
    const dept = all.find((t) => t.from === "orchestrator")!;
    expect(dept).toMatchObject({ status: "done", department: "Engineering", to: "mgr-engineering" });
    const assignments = all.filter((t) => t.from === "mgr-engineering");
    expect(assignments).toHaveLength(3);
    expect(assignments.every((t) => t.status === "done")).toBe(true);
    expect(assignments.find((t) => t.goal === "write the test")!.review_rounds).toBe(2);
    expect(
      (await city.ledger.ticketHistory(assignments.find((t) => t.goal === "write the test")!.id)).map((h) => h.to),
    ).toEqual(["open", "in_progress", "in_review", "in_progress", "in_review", "done"]);

    // Events
    const types = city.bus.events.map((e) => e.type);
    expect(city.bus.ofType("department.created").map((e) => e.name)).toEqual(["Engineering"]);
    expect(city.bus.ofType("agent.hired")).toHaveLength(4); // manager + 3 workers
    const reviews = city.bus.ofType("review.result");
    expect(reviews.filter((r) => r.verdict === "FAIL")).toHaveLength(1);
    expect(reviews.filter((r) => r.verdict === "PASS")).toHaveLength(3);
    expect(city.bus.ofType("signoff.result")).toEqual([
      expect.objectContaining({ verdict: "PASS", ticket_id: task.id }),
    ]);
    expect(city.bus.ofType("result")).toHaveLength(1);
    expect(types.indexOf("signoff.result")).toBeLessThan(types.indexOf("result"));
    const replies = city.bus.ofType("ace.reply").filter((r) => r.done);
    expect(replies.at(-1)!.text).toMatch(/^Done: power/);

    // Costs recorded for every agent that took a turn
    const workers = (await city.ledger.listAgents()).filter((a) => a.kind === "worker");
    for (const id of ["ace", "orchestrator", "mgr-engineering", ...workers.map((w) => w.id)]) {
      const turns = await city.ledger.turnsOf(id);
      expect(turns.length, id).toBeGreaterThan(0);
      expect(turns.every((t) => t.usd > 0 && t.input === 400 && t.cache_read === 3000)).toBe(true);
    }
    expect((await city.ledger.turnsOf("orchestrator"))[0]).toMatchObject({ model: "fable-5-1", role: "orchestrator" });
    expect((await city.ledger.turnsOf(workers[0]!.id))[0]).toMatchObject({
      model: "opus-5-5",
      department: "Engineering",
    });
    const today = await city.ledger.spend("day", "GLOBAL");
    expect(today.turns).toBe(city.bus.ofType("cost.update").length);
    expect(city.bus.ofType("cost.update").length).toBeGreaterThanOrEqual(10);

    // Agents released, slots returned, manager dormant-capable
    expect(workers).toHaveLength(3);
    expect(workers.every((w) => w.state === "retired" && w.worker_state === "released")).toBe(true);
    expect(city.bus.ofType("agent.retired")).toHaveLength(3);
    expect(await city.ledger.activeWorkers()).toBe(0);

    // Sessions follow the agreed shapes
    const sessions = city.invocations.map((i) => i.sessionId);
    expect(sessions.some((s) => s.startsWith("ace-owner-c1"))).toBe(true);
    expect(sessions.some((s) => s.startsWith(`orch-${task.id}`))).toBe(true);
    expect(sessions.some((s) => s.startsWith(`mgr-engineering-${task.id}`))).toBe(true);
    expect(sessions.some((s) => s.startsWith("wkr-engineering-wkr-engineering-"))).toBe(true);
    expect(city.invocations.filter((i) => i.role === "worker").every((i) => i.async)).toBe(true);
  });

  it("a crash mid-turn resumes from the ledger without duplicate hires", async () => {
    let crashed = false;
    const crashing: typeof manager = async (req, call) => {
      if (!crashed && req.turn.prompt.includes("(task) from orchestrator")) {
        const hired = await call("hire_worker", {
          specialty: "JavaScript developer",
          instructions: "You implement power for add.js.",
          tools: ["Bash"],
        });
        await call("assign", { worker_id: /Hired (\S+)/.exec(hired)![1]!, goal: PARTS[0]!, acceptance: "done" });
        crashed = true;
        throw new Error("microVM lost mid-turn");
      }
      return manager(req, call);
    };
    failedOnce.clear();
    const city = makeCity(scriptedEngine({ ace, orchestrator, manager: crashing, worker }));
    await city.ownerSays(GOAL);
    await city.run();
    expect(crashed).toBe(true);
    const workers = (await city.ledger.listAgents()).filter((a) => a.kind === "worker");
    expect(workers).toHaveLength(3); // the re-run saw one hire in the ledger and added two
    const task = (await city.ledger.listTickets(["done"])).find((t) => t.from === "ace");
    expect(task?.result).toMatch(/power/);
  });

  it("a worker turn whose microVM died is re-sent by the stale-lease sweep", async () => {
    const city = makeCity(scriptedEngine({ worker }));
    await city.ledger.createDepartment("Engineering", "Build software.", "mgr-engineering");
    await city.ledger.putAgent({
      id: "mgr-engineering",
      kind: "manager",
      role: "Engineering Manager",
      department: "Engineering",
      model: "fable-5-1",
      parent: "orchestrator",
      state: "active",
      total_cost_usd: 0,
    });
    const w = await city.factory.hire(
      { specialty: "Dev", instructions: "Write the code please.", tools: ["Bash"] },
      "mgr-engineering",
      "Engineering",
    );
    const parent = await city.ledger.createTicket({
      id: "t-mgr",
      goal: "g",
      from: "orchestrator",
      to: "mgr-engineering",
      department: "Engineering",
      parent_id: "t-task",
      kind: "assignment",
    });
    const t = await city.ledger.createTicket({
      goal: "write it",
      from: "mgr-engineering",
      to: w.id,
      department: "Engineering",
      parent_id: parent.id,
      kind: "assignment",
    });
    const msg: WorkMessage = {
      id: "m-lost",
      role: "worker",
      agentId: w.id,
      department: "Engineering",
      ticketId: t.id,
      taskId: "t-task",
      kind: "task",
      from: "mgr-engineering",
      body: "Assignment: write it",
    };
    // The dispatcher started it, then the microVM died: the lease is taken, the turn never finished.
    await city.ledger.acquireWorkerSlot("Engineering", 100, 100);
    await city.ledger.beginWork(msg.id, 60_000, msg);
    expect(await resumeStale(city.ledger, city.queue)).toBe(0); // lease still live
    city.advance(61_000);
    expect(await resumeStale(city.ledger, city.queue)).toBe(1);
    await city.run();
    expect((await city.ledger.getTicket(t.id))?.status).toBe("in_review");
    expect(await city.ledger.activeWorkers()).toBe(0); // the dead turn's slot was given back
    expect(await city.ledger.isWorkDone("m-lost")).toBe(true);
  });
});

describe("@agent instructions", () => {
  it("reach the right worker with its manager copied", async () => {
    const quietWorker: Script = async () => "working on it";
    const city = makeCity(scriptedEngine({ ace, orchestrator, manager, worker: quietWorker }));
    await city.ownerSays(GOAL);
    await city.run();
    const workers = (await city.ledger.listAgents("active")).filter((a) => a.kind === "worker");
    expect(workers).toHaveLength(3);
    const target = workers[1]!;
    const before = city.queue.sent.length;
    const r = await instructAgent(city.deps, target.id, "use BigInt for large exponents");
    expect(r).toMatch(/mgr-engineering copied/);
    const sent = city.queue.sent.slice(before);
    expect(sent).toHaveLength(1); // the worker is woken; the manager is copied without a turn
    expect(sent[0]).toMatchObject({ role: "worker", agentId: target.id, kind: "instruction" });
    expect(sent[0]!.body).toMatch(/BigInt/);
    const ev = city.bus.ofType("instruction").at(-1)!;
    expect(ev).toMatchObject({ to: target.id, cc: ["mgr-engineering"] });
    expect(await instructAgent(city.deps, "nobody", "x")).toMatch(/no working agent/);
  });
});

describe("500 concurrent hires", () => {
  it("respect the ceilings and queue the rest; nothing is dropped", async () => {
    const city = makeCity(scriptedEngine({}), {
      max_concurrent_workers_per_department: 100,
      max_concurrent_workers_global: 150,
      max_new_sessions_per_second: 20,
    });
    for (const [name, n] of [
      ["Engineering", 300],
      ["Research", 200],
    ] as const) {
      const mgr = `mgr-${name.toLowerCase()}`;
      await city.ledger.createDepartment(name, `${name} work.`, mgr);
      await city.ledger.putAgent({
        id: mgr,
        kind: "manager",
        role: `${name} Manager`,
        department: name,
        model: "fable-5-1",
        parent: "orchestrator",
        state: "active",
        total_cost_usd: 0,
      });
      const hires = await Promise.all(
        Array.from({ length: n }, () =>
          city.factory.hire(
            { specialty: "Analyst", instructions: "Analyse one item please.", tools: ["Read"] },
            mgr,
            name,
          ),
        ),
      );
      for (const w of hires)
        await city.queue.send({
          id: `m-${w.id}`,
          role: "worker",
          agentId: w.id,
          department: name,
          ticketId: `t-${w.id}`,
          taskId: "t",
          kind: "task",
          from: mgr,
          body: "go",
        });
    }
    expect((await city.ledger.listAgents()).filter((a) => a.kind === "worker")).toHaveLength(500); // hiring itself is unlimited

    // Turns that stay open until we end them, so concurrency is real.
    const running = new Map<string, string>(); // message id -> department
    const started = new Set<string>();
    let peak = 0,
      peakEng = 0,
      peakRes = 0,
      perSecondMax = 0;
    const s = await city.deps.settings();
    const dispatcher = new Dispatcher({
      ledger: city.ledger,
      bus: city.bus,
      queue: city.queue,
      settings: async () => s,
      sessionIdFor,
      invoker: {
        invoke: async (inv) => {
          expect(started.has(inv.id)).toBe(false); // each starts exactly once
          started.add(inv.id);
          running.set(inv.id, inv.department!);
        },
      },
    });
    const finish = async (k: number) => {
      for (const [id, dept] of [...running].slice(0, k)) {
        running.delete(id);
        await city.ledger.releaseWorkerSlot(dept);
        await city.ledger.finishWork(id);
      }
    };
    let deferred = 0;
    for (let second = 0; started.size < 500 && second < 400; second++) {
      let thisSecond = 0;
      for (const m of city.queue.takeReady()) {
        const out = await dispatcher.handle(m);
        if (out === "started") thisSecond++;
        else deferred++;
        const eng = [...running.values()].filter((d) => d === "Engineering").length;
        peak = Math.max(peak, running.size);
        peakEng = Math.max(peakEng, eng);
        peakRes = Math.max(peakRes, running.size - eng);
      }
      perSecondMax = Math.max(perSecondMax, thisSecond);
      await finish(5); // a few turns end every second
      city.advance(1000);
    }
    expect(started.size).toBe(500);
    expect(peak).toBeLessThanOrEqual(150);
    expect(peakEng).toBeLessThanOrEqual(100);
    expect(peakRes).toBeLessThanOrEqual(100);
    expect(perSecondMax).toBeLessThanOrEqual(20);
    expect(peak).toBe(150); // the ceilings were actually reached
    expect(deferred).toBeGreaterThan(0); // the rest waited in the queue
  });
});
