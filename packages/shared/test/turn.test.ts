import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SpendCapReached, CityPaused, checkCaps, validateCaps } from "../src/caps.ts";
import { estimateUsd, cacheSavingsUsd } from "../src/cost.ts";
import { MemoryBus } from "../src/events.ts";
import { Ledger, TURN_KINDS, type CitySettings, type TurnKind } from "../src/ledger.ts";
import { resolveRole, type Role } from "../src/models.ts";
import { MemoryTable } from "../src/table.ts";
import {
  ModelUnavailable,
  parseVerdict,
  runGatedTurn,
  withBackoff,
  type ModelRunner,
  type TurnOutput,
} from "../src/turn.ts";

const usage = { input: 1000, output: 500, cacheRead: 2000, cacheWrite5m: 0, cacheWrite1h: 100 };
const reply = (text: string, stopReason: TurnOutput["stopReason"] = "end_turn"): TurnOutput => ({
  text,
  stopReason,
  usage,
});
const noSleep = { sleep: async () => {}, random: () => 0.5 };

// Caps are off by default; these tests set them explicitly to check the brake when the owner wants one.
const CAPPED = { ...DEFAULT_SETTINGS, daily_global_usd: 10, monthly_budget_usd: 150, daily_department_usd: 5 };
function setup(runner: ModelRunner, settings: CitySettings = CAPPED) {
  const ledger = new Ledger(new MemoryTable(), () => new Date("2026-11-06T10:00:00Z"));
  const bus = new MemoryBus();
  return { ledger, bus, deps: { ledger, bus, runner, settings, backoff: noSleep } };
}
const turn = (role: Role, kind: TurnKind = role as TurnKind, extra = {}) => ({
  kind,
  role,
  agentId: `${role}-1`,
  sessionId: "s".repeat(33),
  department: role === "worker" || role === "manager" ? "Engineering" : null,
  ticketId: "t-1",
  models: resolveRole(role),
  prompt: "do it",
  ...extra,
});

describe("cost math", () => {
  it("prices each token class, with 5-minute and 1-hour cache writes", () => {
    const u = {
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000,
      cacheWrite5m: 1_000_000,
      cacheWrite1h: 1_000_000,
    };
    // opus: 4 + 20 + 0.2 + 4*1.25 + 4*2 = 37.2
    expect(estimateUsd("opus-5-5", u)).toBeCloseTo(37.2);
    expect(estimateUsd("fable-5-1", { ...u, cacheWrite5m: 0, cacheWrite1h: 0 })).toBeCloseTo(60.25);
  });
  it("geo profiles cost 10% more; Haiku over 100k prompt tokens costs 5x", () => {
    const u = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
    expect(estimateUsd("sonnet-5-5", u, "eu")).toBeCloseTo(2.2);
    expect(estimateUsd("haiku-5-5", { ...u, input: 90_000 })).toBeCloseTo(0.009);
    expect(estimateUsd("haiku-5-5", { ...u, input: 110_000 })).toBeCloseTo(0.055);
  });
  it("cache savings compare against paying full input for cached tokens", () => {
    expect(
      cacheSavingsUsd("opus-5-5", { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite5m: 0, cacheWrite1h: 0 }),
    ).toBeCloseTo(3.8);
  });
});

describe("no spend limit by default", () => {
  it("the defaults have no caps, and a turn runs however much was spent", async () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      daily_global_usd: null,
      monthly_budget_usd: null,
      daily_department_usd: null,
    });
    const runner = vi.fn<ModelRunner>(async () => reply("ok"));
    const { ledger, bus, deps } = setup(runner, DEFAULT_SETTINGS);
    await ledger.table.update("SPEND#DAY#2026-11-06", "GLOBAL", { add: { usd: 100_000 } });
    await ledger.table.update("SPEND#MONTH#2026-11", "GLOBAL", { add: { usd: 1_000_000 } });
    await ledger.table.update("SPEND#DAY#2026-11-06", "DEPT#engineering", { add: { usd: 50_000 } });
    await runGatedTurn(turn("worker"), deps);
    expect(runner).toHaveBeenCalledOnce();
    expect(bus.ofType("spend.cap_reached")).toHaveLength(0);
    expect(await checkCaps(ledger, DEFAULT_SETTINGS, "worker", "Engineering")).toEqual({ ok: true });
  });
});

describe("spend caps, when the owner sets one, block every turn kind", () => {
  it.each(TURN_KINDS)("%s turns stop at the daily global cap", async (kind) => {
    const runner = vi.fn<ModelRunner>(async () => reply("ok"));
    const { ledger, bus, deps } = setup(runner);
    await ledger.table.update("SPEND#DAY#2026-11-06", "GLOBAL", { add: { usd: 10 } });
    const role: Role = kind === "compaction" || kind === "eval" ? "utility" : (kind as Role);
    await expect(runGatedTurn(turn(role, kind), deps)).rejects.toBeInstanceOf(SpendCapReached);
    expect(runner).not.toHaveBeenCalled();
    expect(bus.ofType("spend.cap_reached")[0]?.cap).toBe("daily_global");
  });
  it("the monthly cap and the department cap block too", async () => {
    const { ledger } = setup(async () => reply("ok"));
    await ledger.table.update("SPEND#MONTH#2026-11", "GLOBAL", { add: { usd: 150 } });
    expect(await checkCaps(ledger, CAPPED, "worker", null)).toMatchObject({ ok: false, cap: "monthly" });
    const l2 = setup(async () => reply("ok")).ledger;
    await l2.table.update("SPEND#DAY#2026-11-06", "DEPT#engineering", { add: { usd: 5 } });
    expect(await checkCaps(l2, CAPPED, "worker", "Engineering")).toMatchObject({
      ok: false,
      cap: "daily_department",
    });
    expect(await checkCaps(l2, CAPPED, "worker", "Research")).toEqual({ ok: true });
  });
  it("a paused city starts no turn", async () => {
    const runner = vi.fn<ModelRunner>(async () => reply("ok"));
    const { ledger, deps } = setup(runner);
    await ledger.updateSettings({ paused: true });
    await expect(runGatedTurn(turn("ace"), deps)).rejects.toBeInstanceOf(CityPaused);
    expect(runner).not.toHaveBeenCalled();
  });
  it("accepts any cap of zero or more, or none, and rejects impossible values", () => {
    expect(validateCaps({ daily_global_usd: -1 })).toMatch(/zero or more/);
    expect(validateCaps({ daily_global_usd: Number.NaN })).toMatch(/zero or more/);
    expect(validateCaps({ daily_global_usd: 500_000 })).toBeNull();
    expect(validateCaps({ daily_global_usd: null, monthly_budget_usd: null, daily_department_usd: null })).toBeNull();
  });
});

describe("throttling backs off and retries", () => {
  it("retries a throttled call with jittered back-off and succeeds", async () => {
    let calls = 0;
    const delays: number[] = [];
    const runner: ModelRunner = async () => {
      if (++calls < 3) throw Object.assign(new Error("Rate exceeded"), { name: "ThrottlingException" });
      return reply("done");
    };
    const { ledger, deps } = setup(runner);
    const r = await runGatedTurn(turn("worker"), {
      ...deps,
      backoff: { ...noSleep, onRetry: (_a, d) => delays.push(d) },
    });
    expect(r.output.text).toBe("done");
    expect(calls).toBe(3);
    expect(delays).toEqual([500, 1000]); // random 0.5 × 1s, 0.5 × 2s
    expect(await ledger.isPaused()).toBe(false); // throttling never pauses
  });
  it("gives up after the retry budget and does not pause the city", async () => {
    const err = Object.assign(new Error("Too many"), { name: "ThrottlingException" });
    await expect(
      withBackoff(
        async () => {
          throw err;
        },
        { ...noSleep, retries: 2 },
      ),
    ).rejects.toBe(err);
  });
  it("does not retry other errors", async () => {
    let calls = 0;
    await expect(
      withBackoff(async () => {
        calls++;
        throw new Error("bad input");
      }, noSleep),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe("Fable → Opus fallback", () => {
  it("a refusal triggers exactly one fallback turn on Opus, marked in the ledger", async () => {
    const seen: string[] = [];
    const runner: ModelRunner = async (i) => {
      seen.push(i.model.name);
      return i.model.name === "fable-5-1" ? reply("I can't help with that.", "refusal") : reply("Plan ready.");
    };
    const { ledger, deps } = setup(runner);
    const r = await runGatedTurn(turn("orchestrator"), deps);
    expect(seen).toEqual(["fable-5-1", "opus-5-5"]);
    expect(r.fallback).toBe(true);
    const turns = await ledger.turnsOf("orchestrator-1");
    expect(turns.map((t) => [t.model, t.fallback, t.outcome])).toEqual([
      ["fable-5-1", false, "refused"],
      ["opus-5-5", true, "ok"],
    ]);
  });
  it("a refusal on the fallback is final: no loop", async () => {
    const runner = vi.fn<ModelRunner>(async () => reply("no", "refusal"));
    const { deps } = setup(runner);
    const r = await runGatedTurn(turn("manager"), deps);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(r.output.stopReason).toBe("refusal");
  });
  it("a review with no verdict falls back once", async () => {
    const runner: ModelRunner = async (i) =>
      i.model.name === "fable-5-1" ? reply("Looks interesting.") : reply('{"verdict":"FAIL","reasons":["no tests"]}');
    const { deps } = setup(runner);
    const r = await runGatedTurn(turn("manager", "manager", { needsVerdict: true }), deps);
    expect(r.verdict).toBe("FAIL");
    expect(r.fallback).toBe(true);
  });
  it("Fable unavailable falls back to Opus", async () => {
    const runner: ModelRunner = async (i) => {
      if (i.model.name === "fable-5-1") throw new ModelUnavailable("model not available");
      return reply("ok");
    };
    const { deps } = setup(runner);
    expect((await runGatedTurn(turn("orchestrator"), deps)).model.name).toBe("opus-5-5");
  });
  it("roles without a fallback never retry on another model", async () => {
    const runner = vi.fn<ModelRunner>(async () => reply("no", "refusal"));
    const { deps } = setup(runner);
    await runGatedTurn(turn("worker"), deps);
    expect(runner).toHaveBeenCalledTimes(1);
  });
  it("records cost rows with role, department, ticket, model, tokens and USD", async () => {
    const { ledger, bus, deps } = setup(async () => reply("ok"));
    await runGatedTurn(turn("worker"), deps);
    const [t] = await ledger.turnsOf("worker-1");
    expect(t).toMatchObject({
      role: "worker",
      department: "Engineering",
      ticket_id: "t-1",
      model: "opus-5-5",
      input: 1000,
      output: 500,
      cache_read: 2000,
      cache_write_1h: 100,
    });
    expect(t!.usd).toBeCloseTo(estimateUsd("opus-5-5", usage));
    expect((await ledger.spend("day", "DEPT#engineering")).turns).toBe(1);
    expect(bus.ofType("cost.update")).toHaveLength(1);
  });
  it("parses verdicts only when the reply states one", () => {
    expect(parseVerdict('{"verdict":"PASS"}')).toBe("PASS");
    expect(parseVerdict("FAIL: tests missing")).toBe("FAIL");
    expect(parseVerdict("Verdict: PASS\nGood work")).toBe("PASS");
    expect(parseVerdict("The worker said PASS somewhere")).toBeNull();
  });
});
