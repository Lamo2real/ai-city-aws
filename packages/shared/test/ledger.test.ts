import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.ts";
import { DynamoTable, MemoryTable } from "../src/table.ts";
import { sessionIds } from "../src/ids.ts";
import { MemoryBus, CityEvent } from "../src/events.ts";

let clock = new Date("2026-11-06T10:00:00Z");
const ledger = () => new Ledger(new MemoryTable(), () => clock);

describe("ledger", () => {
  it("keeps every ticket's status history and is idempotent on ticket id", async () => {
    const l = ledger();
    const t = await l.createTicket({
      id: "t-1",
      goal: "add power()",
      from: "ace",
      to: "orchestrator",
      department: null,
      parent_id: null,
      kind: "task",
    });
    await l.setTicketStatus(t.id, "in_progress", "picked up");
    await l.setTicketStatus(t.id, "done", "signed off", { result: "merged" });
    expect((await l.ticketHistory("t-1")).map((h) => h.to)).toEqual(["open", "in_progress", "done"]);
    expect((await l.getTicket("t-1"))?.result).toBe("merged");
    const again = await l.createTicket({
      id: "t-1",
      goal: "other",
      from: "x",
      to: "y",
      department: null,
      parent_id: null,
      kind: "task",
    });
    expect(again.goal).toBe("add power()");
    expect(await l.listTickets(["done"])).toHaveLength(1);
  });
  it("finds a department case- and space-insensitively and refuses duplicates", async () => {
    const l = ledger();
    expect((await l.createDepartment("Engineering", "Build software", "mgr-engineering")).created).toBe(true);
    expect((await l.createDepartment(" engineering ", "dup", "x")).created).toBe(false);
    expect((await l.getDepartment("ENGINEERING"))?.mission).toBe("Build software");
  });
  it("answers a question once", async () => {
    const l = ledger();
    const q = await l.askQuestion({
      asked_by: "w1",
      path: "mgr › w1",
      ticket_id: null,
      text: "Which DB?",
      options: ["a", "b"],
      default_answer: "a",
    });
    expect(await l.answerQuestion(q.id, "b", "owner")).toMatchObject({ status: "answered", answer: "b" });
    expect(await l.answerQuestion(q.id, "a", "owner")).toBeUndefined();
    expect(await l.openQuestions()).toHaveLength(0);
  });
  it("uses an approval once, for the exact action only", async () => {
    const l = ledger();
    const a = await l.requestApproval({
      agent: "w1",
      ticket_id: null,
      tool: "Bash",
      action: "npm publish",
      hash: "h1",
      reason: "publishing",
    });
    expect(await l.consumeApproval("h1")).toBe(false); // still pending
    await l.decideApproval(a.id, true);
    expect(await l.consumeApproval("h2")).toBe(false);
    expect(await l.consumeApproval("h1")).toBe(true);
    expect(await l.consumeApproval("h1")).toBe(false);
  });
  it("counts a turn once even if it is recorded twice", async () => {
    const l = ledger();
    const t = {
      id: "turn-1",
      agent: "a",
      role: "worker",
      department: "Eng",
      ticket_id: null,
      kind: "worker" as const,
      model: "opus-5-5",
      fallback: false,
      input: 1,
      output: 1,
      cache_read: 0,
      cache_write_5m: 0,
      cache_write_1h: 0,
      usd: 0.5,
      cache_savings_usd: 0,
      outcome: "ok" as const,
    };
    await l.recordTurn(t);
    await l.recordTurn(t);
    expect(await l.spend("day", "GLOBAL")).toMatchObject({ usd: 0.5, turns: 1 });
    expect((await l.spendBreakdown("month"))["MODEL#opus-5-5"]?.usd).toBe(0.5);
  });
  it("worker slots respect the department and global ceilings", async () => {
    const l = ledger();
    expect(await l.acquireWorkerSlot("Eng", 2, 3)).toBe(true);
    expect(await l.acquireWorkerSlot("Eng", 2, 3)).toBe(true);
    expect(await l.acquireWorkerSlot("Eng", 2, 3)).toBe(false); // department full
    expect(await l.acquireWorkerSlot("Ops", 2, 3)).toBe(true);
    expect(await l.acquireWorkerSlot("Ops", 2, 3)).toBe(false); // global full, and the dept slot is not leaked
    expect(await l.activeWorkers()).toBe(3);
    await l.releaseWorkerSlot("Eng");
    expect(await l.acquireWorkerSlot("Ops", 2, 3)).toBe(true);
  });
  it("limits new sessions per second", async () => {
    const l = ledger();
    const got = await Promise.all(Array.from({ length: 25 }, () => l.takeSessionToken(20)));
    expect(got.filter(Boolean)).toHaveLength(20);
    clock = new Date(clock.getTime() + 1000);
    expect(await l.takeSessionToken(20)).toBe(true);
  });
  it("claims an idempotency key once", async () => {
    const l = ledger();
    expect(await l.claim("msg-1")).toBe(true);
    expect(await l.claim("msg-1")).toBe(false);
  });
});

describe("session ids", () => {
  it("follow the agreed shapes and meet AgentCore's 33-character minimum", () => {
    const ids = [
      sessionIds.ace("owner", "c1"),
      sessionIds.orchestrator("t-1"),
      sessionIds.manager("Engineering", "t-1"),
      sessionIds.worker("Engineering", "h-1"),
    ];
    expect(ids[0]).toMatch(/^ace-owner-c1/);
    expect(ids[1]).toMatch(/^orch-t-1/);
    expect(ids[2]).toMatch(/^mgr-engineering-t-1/);
    expect(ids[3]).toMatch(/^wkr-engineering-h-1/);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(33);
  });
});

describe("event schemas", () => {
  it("the bus validates events and stamps the time", async () => {
    const bus = new MemoryBus();
    await bus.put({ type: "agent.retired", id: "w1" });
    expect(bus.events[0]?.at).toMatch(/^\d{4}-/);
    await expect(bus.put({ type: "agent.retired" } as never)).rejects.toThrow();
    expect(CityEvent.safeParse({ type: "nope", at: "x" }).success).toBe(false);
  });
});

describe("DynamoTable", () => {
  it("builds conditional updates with ADD and a limit, and maps condition failures to undefined", async () => {
    const sent: Array<{ input: Record<string, unknown> }> = [];
    const doc = {
      send: async (cmd: { input: Record<string, unknown> }) => {
        sent.push(cmd);
        if (sent.length === 2) throw Object.assign(new Error("no"), { name: "ConditionalCheckFailedException" });
        return { Attributes: { pk: "SLOTS", sk: "GLOBAL", active: 1 } };
      },
    };
    const t = new DynamoTable(doc as never, "aic-prod-ledger");
    expect(
      await t.update("SLOTS", "GLOBAL", { add: { active: 1 }, addLimit: { attr: "active", max: 10 } }),
    ).toMatchObject({ active: 1 });
    expect(
      await t.update("SLOTS", "GLOBAL", { add: { active: 1 }, addLimit: { attr: "active", max: 10 } }),
    ).toBeUndefined();
    const input = sent[0]!.input;
    expect(input.TableName).toBe("aic-prod-ledger");
    expect(input.UpdateExpression).toMatch(/^ADD #a\d+ :v\d+$/);
    expect(String(input.ConditionExpression)).toMatch(/attribute_not_exists\(#a\d+\) OR #a\d+ <= :v\d+/);
    expect(Object.values(input.ExpressionAttributeValues as object)).toContain(9);
  });
  it("puts with attribute_not_exists when asked and reports duplicates as false", async () => {
    const doc = {
      send: async () => {
        throw Object.assign(new Error("exists"), { name: "ConditionalCheckFailedException" });
      },
    };
    expect(await new DynamoTable(doc as never, "t").put({ pk: "a", sk: "b" }, { ifNotExists: true })).toBe(false);
  });
});
