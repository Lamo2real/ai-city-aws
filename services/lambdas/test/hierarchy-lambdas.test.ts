import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  Factory,
  HireRefused,
  Ledger,
  MemoryBus,
  MemoryQueue,
  MemoryTable,
  type WorkMessage,
} from "@aic/shared";
import { agentCoreInvoker, processBatch, sessionIdFor } from "../src/dispatcher.ts";
import { handleFactory } from "../src/factory.ts";
import { barred, improvementAllowed, reviewChanges } from "../src/improve.ts";
import { writeEvent } from "../src/ledger-writer.ts";
import { runJob } from "../src/scheduler.ts";

const msg = (over: Partial<WorkMessage> = {}): WorkMessage => ({
  id: "m1",
  role: "worker",
  agentId: "w1",
  department: "Eng",
  ticketId: "t1",
  taskId: "t0",
  kind: "task",
  from: "mgr",
  body: "go",
  ...over,
});

describe("dispatcher Lambda", () => {
  it("reports only failed records for retry and skips unparseable ones", async () => {
    const r = await processBatch(
      {
        Records: [
          { messageId: "a", body: JSON.stringify(msg()) },
          { messageId: "b", body: "{" },
          { messageId: "c", body: JSON.stringify(msg({ id: "boom" })) },
        ],
      },
      {
        handle: async (m) => {
          if (m.id === "boom") throw new Error("runtime down");
          return "started";
        },
      },
    );
    expect(r.batchItemFailures).toEqual([{ itemIdentifier: "c" }]);
  });
  it("invokes the role's AgentCore runtime with the session id and the JSON payload", async () => {
    const sent: Array<{ input: { agentRuntimeArn: string; runtimeSessionId: string; payload: Uint8Array } }> = [];
    const inv = agentCoreInvoker(
      {
        send: async (c: never) => {
          sent.push(c);
          return { statusCode: 200 };
        },
      } as never,
      { ace: "arn:ace", orchestrator: "arn:o", manager: "arn:m", worker: "arn:w" },
    );
    await inv.invoke({ ...msg(), sessionId: sessionIdFor(msg()), async: true });
    expect(sent[0]!.input.agentRuntimeArn).toBe("arn:w");
    expect(sent[0]!.input.runtimeSessionId).toMatch(/^wkr-eng-w1/);
    expect(JSON.parse(new TextDecoder().decode(sent[0]!.input.payload))).toMatchObject({ id: "m1", async: true });
  });
  it("session ids per role", () => {
    expect(sessionIdFor(msg({ role: "ace", conversation: "c9" }), "me")).toMatch(/^ace-me-c9/);
    expect(sessionIdFor(msg({ role: "orchestrator", taskId: "t-7" }))).toMatch(/^orch-t-7/);
    expect(sessionIdFor(msg({ role: "manager", department: "Research", taskId: "t-7" }))).toMatch(/^mgr-research-t-7/);
  });
});

describe("Agent Factory", () => {
  const setup = async () => {
    const ledger = new Ledger(new MemoryTable());
    const bus = new MemoryBus();
    await ledger.createDepartment("Engineering", "Build software.", "mgr-engineering");
    return { ledger, bus, factory: new Factory(ledger, bus, async () => DEFAULT_SETTINGS) };
  };
  const spec = { specialty: "Dev", instructions: "Write the code carefully.", tools: ["Bash" as const] };
  it("hires with a valid spec and refuses bad tools, wrong managers, missing departments and big budgets", async () => {
    const { factory, bus } = await setup();
    const w = await factory.hire(spec, "mgr-engineering", "Engineering");
    expect(w).toMatchObject({ kind: "worker", parent: "mgr-engineering", worker_state: "hired", model: "opus-5-5" });
    expect(bus.ofType("agent.hired")).toHaveLength(1);
    await expect(
      factory.hire({ ...spec, tools: ["Bash", "aws_cli" as never] }, "mgr-engineering", "Engineering"),
    ).rejects.toBeInstanceOf(HireRefused);
    await expect(factory.hire(spec, "mgr-research", "Engineering")).rejects.toThrow(/Only Engineering's manager/);
    await expect(factory.hire(spec, "mgr-x", "Nope")).rejects.toThrow(/no active department/);
    await expect(factory.hire({ ...spec, budget_hint_usd: 50 }, "mgr-engineering", "Engineering")).rejects.toThrow(
      /above Engineering's daily cap/,
    );
  });
  it("re-hires a saved specialist with its saved instructions and tools", async () => {
    const { factory, ledger } = await setup();
    const sp = await ledger.saveSpecialist({
      department: "Engineering",
      specialty: "Tester",
      instructions: "Write thorough tests.",
      tools: ["Read", "Bash"],
    });
    const w = await factory.hire({ ...spec, specialist_id: sp.id }, "mgr-engineering", "Engineering");
    expect((await ledger.table.get(`AGENT#${w.id}`, "SPEC"))?.instructions).toBe("Write thorough tests.");
  });
  it("the Lambda returns errors as data, never throws", async () => {
    const { factory } = await setup();
    expect(await handleFactory({ action: "release", workerId: "nobody", managerId: "m" }, factory)).toEqual({
      ok: false,
      error: "No worker nobody.",
    });
  });
});

describe("ledger writer and scheduled jobs", () => {
  it("appends ticket events to the trace and ignores invalid ones", async () => {
    const ledger = new Ledger(new MemoryTable());
    const e = { type: "result", ticket_id: "t1", summary: "done", at: new Date().toISOString() };
    expect(await writeEvent({ "detail-type": "result", detail: e }, ledger)).toBe(true);
    expect(await writeEvent({ "detail-type": "x", detail: { type: "nope" } }, ledger)).toBe(false);
    expect(await ledger.trace("t1")).toHaveLength(1);
  });
  it("retire_idle puts managers without open work to sleep; improve stays off", async () => {
    const ledger = new Ledger(new MemoryTable());
    await ledger.putAgent({
      id: "mgr-a",
      kind: "manager",
      role: "A",
      department: "A",
      model: "fable-5-1",
      parent: "orchestrator",
      state: "active",
      total_cost_usd: 0,
    });
    const d = { ledger, queue: new MemoryQueue(), bus: new MemoryBus(), env: {} };
    expect(await runJob("retire_idle", d)).toEqual({ dormant: 1 });
    expect(await runJob("improve", d)).toEqual({ skipped: "the self-improvement loop is disabled" });
    expect(await runJob("sweep", d)).toEqual({ resent: 0 });
  });
});

describe("self-improvement fence", () => {
  it("is off unless explicitly enabled", () => {
    expect(improvementAllowed({}).ok).toBe(false);
    expect(improvementAllowed({ AIC_SELF_IMPROVE: "on" }).ok).toBe(true);
  });
  it.each([
    "infra/modules/agents/main.tf",
    "infra/envs/prod/main.tf",
    "config/policy.json",
    "config/caps.json",
    "packages/shared/src/policy.ts",
    ".github/workflows/deploy.yml",
    "infra/modules/security/iam.tf",
    "package.json",
  ])("refuses %s", (path) => {
    expect(barred({ status: "M", path })).toBe(true);
  });
  it("allows prompt and code changes, and new tests, but not edits to existing tests", () => {
    expect(
      reviewChanges([
        { status: "M", path: "agents/worker.md" },
        { status: "A", path: "tests/new.test.ts" },
      ]).ok,
    ).toBe(true);
    expect(reviewChanges([{ status: "M", path: "tests/hierarchy.e2e.test.ts" }]).refused).toEqual([
      "tests/hierarchy.e2e.test.ts",
    ]);
  });
});
