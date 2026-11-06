import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, Ledger, MemoryBus, MemoryQueue, MemoryTable, wakeMatch, type TurnOutput } from "@aic/shared";
import { ROUTES, handleHttp, isOwner, type ApiDeps, type HttpEvent } from "../src/api.ts";
import { onApprovalStep } from "../src/approvals.ts";
import { noticeFor, staleQuestions } from "../src/notifier.ts";
import { authorize, broadcast, onConnection, type TokenVerifier } from "../src/ws.ts";

let now = new Date("2026-11-06T12:00:00Z");
function deps(extra: Partial<ApiDeps> = {}): ApiDeps & { bus: MemoryBus; queue: MemoryQueue } {
  const ledger = new Ledger(new MemoryTable(), () => now);
  return {
    ledger,
    bus: new MemoryBus(),
    queue: new MemoryQueue(),
    settings: () => ledger.settings(DEFAULT_SETTINGS),
    ...extra,
  } as never;
}
const ev = (method: string, path: string, body?: unknown, groups: unknown = "[owner]"): HttpEvent => {
  const [p, qs] = path.split("?");
  return {
    rawPath: p!,
    requestContext: {
      http: { method },
      authorizer: { jwt: { claims: groups === null ? {} : { "cognito:groups": groups } } },
    },
    queryStringParameters: qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
};
const json = (r: { body: string }) => JSON.parse(r.body) as Record<string, unknown>;

describe("every route requires the owner group", () => {
  it.each(ROUTES)("%s %s rejects a token without the owner group", async (method, path) => {
    for (const groups of [null, "[]", "[friends]", ["admins"], "ownerish"]) {
      const r = await handleHttp(ev(method, path, {}, groups), deps());
      expect(r.statusCode, String(groups)).toBe(403);
      expect(json(r).error).toMatch(/Only the owner/);
    }
  });
  it("accepts the group in each shape API Gateway can send", () => {
    for (const g of ["[owner]", "owner", "[admins owner]", ["owner"]])
      expect(isOwner(ev("GET", "/city", undefined, g))).toBe(true);
  });
});

describe("HTTP routes", () => {
  it("POST /messages queues the owner's message for Ace, idempotently keyed by the client id", async () => {
    const d = deps();
    const r = await handleHttp(
      ev("POST", "/messages", { text: "yo Ace, what's 9 + 9?", conversation: "c1", client_id: "abcd1234" }),
      d,
    );
    expect(r.statusCode).toBe(202);
    expect(d.queue.sent[0]).toMatchObject({ id: "owner-abcd1234", role: "ace", conversation: "c1", from: "owner" });
    expect((await handleHttp(ev("POST", "/messages", { text: "" }), d)).statusCode).toBe(400);
    expect((await handleHttp({ ...ev("POST", "/messages"), body: "{" }, d)).statusCode).toBe(400);
  });
  it("GET /city returns the snapshot the City view starts from", async () => {
    const d = deps();
    await d.ledger.createDepartment("Engineering", "Build software.", "mgr-engineering");
    const r = json(await handleHttp(ev("GET", "/city"), d));
    expect(r).toMatchObject({
      departments: [expect.objectContaining({ name: "Engineering" })],
      usage: { usd: 0, turns: 0, tokens: 0 },
      city: { paused: false },
    });
    expect(r.caps).toEqual({ daily_global_usd: null, monthly_budget_usd: null, daily_department_usd: null });
  });
  it("answers a question with the default in one tap, once", async () => {
    const d = deps();
    const q = await d.ledger.askQuestion({
      asked_by: "w1",
      path: "mgr › w1",
      ticket_id: null,
      text: "Which DB?",
      options: ["Postgres", "SQLite"],
      default_answer: "SQLite",
    });
    const r = await handleHttp(ev("POST", `/questions/${q.id}/default`, {}), d);
    expect(json(r)).toEqual({ answered: true, answer: "SQLite" });
    expect(d.bus.ofType("question.answered")[0]).toMatchObject({ answer: "SQLite", answered_by: "owner" });
    expect((await handleHttp(ev("POST", `/questions/${q.id}/default`, {}), d)).statusCode).toBe(409);
  });
  it("decides an approval and sends the Step Functions task result", async () => {
    const sent: unknown[] = [];
    const d = deps({
      sfn: {
        send: async (c: unknown) => {
          sent.push(c);
          return {};
        },
      } as never,
    });
    const a = await d.ledger.requestApproval({
      agent: "w1",
      ticket_id: "t1",
      tool: "Bash",
      action: "npm publish",
      hash: "h",
      reason: "publishing",
    });
    await d.ledger.table.update(`APPROVAL#${a.id}`, "META", { set: { task_token: "tok" } });
    const r = await handleHttp(ev("POST", `/approvals/${a.id}`, { approved: true }), d);
    expect(r.statusCode).toBe(200);
    expect(sent).toHaveLength(1);
    expect(await d.ledger.consumeApproval("h")).toBe(true);
    expect((await handleHttp(ev("POST", `/approvals/${a.id}`, { approved: false }), d)).statusCode).toBe(409);
  });
  it("PUT /settings: caps are optional; impossible values are refused and null clears a cap", async () => {
    const d = deps();
    expect(json(await handleHttp(ev("PUT", "/settings", { daily_global_usd: -5 }), d)).error).toMatch(/zero or more/);
    // No daily cap: a department cap of any size is fine.
    expect((await handleHttp(ev("PUT", "/settings", { department_caps: { Eng: 9999 } }), d)).statusCode).toBe(200);
    expect((await handleHttp(ev("PUT", "/settings", { daily_global_usd: 500 }), d)).statusCode).toBe(200);
    expect((await d.settings()).daily_global_usd).toBe(500);
    // With a daily cap, a department cap above it is refused.
    expect((await handleHttp(ev("PUT", "/settings", { department_caps: { Eng: 9999 } }), d)).statusCode).toBe(400);
    expect((await handleHttp(ev("PUT", "/settings", { max_new_sessions_per_second: 40 }), d)).statusCode).toBe(400);
    expect((await handleHttp(ev("PUT", "/settings", { daily_global_usd: null }), d)).statusCode).toBe(200);
    expect((await d.settings()).daily_global_usd).toBeNull();
  });
  it("pauses and resumes the city", async () => {
    const d = deps();
    await handleHttp(ev("POST", "/city/pause"), d);
    expect(await d.ledger.isPaused()).toBe(true);
    await handleHttp(ev("POST", "/city/resume"), d);
    expect(await d.ledger.isPaused()).toBe(false);
    expect(d.bus.ofType("city.state").map((e) => e.paused)).toEqual([true, false]);
  });
  it("costs are labelled as estimates, split by department, role and model", async () => {
    const d = deps();
    await d.ledger.recordTurn({
      agent: "w1",
      role: "worker",
      department: "Eng",
      ticket_id: null,
      kind: "worker",
      model: "opus-5-5",
      fallback: false,
      input: 1,
      output: 1,
      cache_read: 0,
      cache_write_5m: 0,
      cache_write_1h: 0,
      usd: 1.5,
      cache_savings_usd: 0.3,
      outcome: "ok",
    });
    const c = json(await handleHttp(ev("GET", "/costs"), d));
    expect(c.estimate).toBe(true);
    expect(c.by_department).toMatchObject({ eng: { usd: 1.5 } });
    expect(c.by_role).toMatchObject({ worker: { usd: 1.5 } });
    expect(c.by_model).toMatchObject({ "Claude Opus 5.5": { usd: 1.5 } });
  });
  it("hides internal errors behind plain words", async () => {
    const d = deps();
    d.ledger.listAgents = async () => {
      throw new Error("DynamoDB exploded: arn:aws:...");
    };
    const r = await handleHttp(ev("GET", "/city"), d);
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toMatch(/arn:|DynamoDB/);
    expect(json(r).error).toMatch(/Nothing was lost/);
  });
  it("wake check: plain matching first, Haiku only for unclear transcripts", async () => {
    let calls = 0;
    const runner = async (): Promise<TurnOutput> => {
      calls++;
      return {
        text: "YES",
        stopReason: "end_turn",
        usage: { input: 50, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
      };
    };
    const d = deps({ utilityRunner: runner });
    expect(json(await handleHttp(ev("POST", "/wake-check", { transcript: "yo Ace, status?" }), d)).addressed).toBe(
      true,
    );
    expect(json(await handleHttp(ev("POST", "/wake-check", { transcript: "pass the salt" }), d)).addressed).toBe(false);
    expect(calls).toBe(0);
    expect(
      json(await handleHttp(ev("POST", "/wake-check", { transcript: "so I told ace about it" }), d)).addressed,
    ).toBe(true);
    expect(calls).toBe(1);
    expect((await d.ledger.spend("day", "ROLE#utility")).turns).toBe(1); // utility turns are costed and capped
  });
});

describe("wake word", () => {
  it.each([
    ["yo Ace", "yes"],
    ["hi Ace, how are things", "yes"],
    ["hey ace", "yes"],
    ["what's up Ace", "yes"],
    ["how's it going Ace", "yes"],
    ["Ace, pause everything", "yes"],
    ["what's the status of the product, Ace?", "yes"],
    ["AIC what time is it", "yes"],
    ["the race was fun", "no"],
    ["I placed an ace in the deck", "unclear"],
    ["", "no"],
  ])("%s → %s", (t, want) => {
    expect(wakeMatch(t)).toBe(want);
  });
});

describe("WebSocket", () => {
  const verifier = (groups: string[] | null): TokenVerifier => ({
    verify: async (t) => {
      if (t === "bad.bad.bad") throw new Error("invalid");
      return { sub: "u1", ...(groups ? { "cognito:groups": groups } : {}) };
    },
  });
  it("the $connect authorizer allows only a valid owner token", async () => {
    const e = { methodArn: "arn:ws", queryStringParameters: { token: "a.b.c" } };
    expect((await authorize(e, verifier(["owner"]))).policyDocument.Statement[0]!.Effect).toBe("Allow");
    expect((await authorize(e, verifier(["guest"]))).policyDocument.Statement[0]!.Effect).toBe("Deny");
    expect((await authorize(e, verifier(null))).policyDocument.Statement[0]!.Effect).toBe("Deny");
    expect(
      (await authorize({ methodArn: "arn:ws", queryStringParameters: { token: "bad.bad.bad" } }, verifier(["owner"])))
        .policyDocument.Statement[0]!.Effect,
    ).toBe("Deny");
    expect((await authorize({ methodArn: "arn:ws" }, verifier(["owner"]))).policyDocument.Statement[0]!.Effect).toBe(
      "Deny",
    );
    expect(
      (
        await authorize(
          { methodArn: "arn:ws", headers: { "Sec-WebSocket-Protocol": "aic, a.b.c" } },
          verifier(["owner"]),
        )
      ).policyDocument.Statement[0]!.Effect,
    ).toBe("Allow");
  });
  it("stores connections with a TTL, broadcasts events and drops gone connections", async () => {
    const table = new MemoryTable();
    await onConnection({ requestContext: { routeKey: "$connect", connectionId: "c1" } }, table, 0);
    await onConnection({ requestContext: { routeKey: "$connect", connectionId: "c2" } }, table, 0);
    expect((await table.get("CONN#c1", "META"))?.ttl).toBe(7200);
    const posted: string[] = [];
    const r = await broadcast({ type: "agent.retired", id: "w1", at: now.toISOString() }, table, {
      post: async (id) => {
        posted.push(id);
        return id === "c2" ? "gone" : "ok";
      },
    });
    expect(r).toEqual({ sent: 1, gone: 1 });
    expect(await table.get("CONN#c2", "META")).toBeUndefined();
    expect((await broadcast({ type: "nope" }, table, { post: async () => "ok" })).sent).toBe(0);
    await onConnection({ requestContext: { routeKey: "$disconnect", connectionId: "c1" } }, table);
    expect(await table.queryIndex("gsi1", "CONN")).toHaveLength(0);
  });
});

describe("notifications and approval steps", () => {
  it("emails results and cap alerts, and nudges questions waiting over 15 minutes once", async () => {
    expect(noticeFor({ type: "result", ticket_id: "t", summary: "done", at: now.toISOString() })?.subject).toMatch(
      /done/,
    );
    expect(
      noticeFor({
        type: "spend.cap_reached",
        cap: "daily_global",
        department: null,
        spent: 10.2,
        limit: 10,
        at: now.toISOString(),
      })?.message,
    ).toMatch(/\$10/);
    const d = deps();
    await d.ledger.askQuestion({
      asked_by: "w1",
      path: "mgr › w1",
      ticket_id: null,
      text: "Which DB?",
      options: [],
      default_answer: "SQLite",
    });
    expect(await staleQuestions(d.ledger)).toHaveLength(0);
    now = new Date(now.getTime() + 16 * 60_000);
    expect(await staleQuestions(d.ledger)).toHaveLength(1);
    expect(await staleQuestions(d.ledger)).toHaveLength(0);
  });
  it("stores the task token and wakes the agent with the owner's decision", async () => {
    const d = deps();
    await d.ledger.putAgent({
      id: "w1",
      kind: "worker",
      role: "Dev",
      department: "Eng",
      model: "opus-5-5",
      parent: "mgr-eng",
      state: "active",
      total_cost_usd: 0,
    });
    const a = await d.ledger.requestApproval({
      agent: "w1",
      ticket_id: "t1",
      tool: "Bash",
      action: "npm publish",
      hash: "h",
      reason: "publishing",
    });
    await onApprovalStep({ step: "store_token", approvalId: a.id, taskToken: "tok" }, d);
    expect((await d.ledger.getApproval(a.id))?.task_token).toBe("tok");
    await onApprovalStep({ step: "resume", approvalId: a.id, approved: false }, d);
    expect(d.queue.sent[0]).toMatchObject({ role: "worker", agentId: "w1", kind: "answer" });
    expect(d.queue.sent[0]!.body).toMatch(/refused/);
  });
});
