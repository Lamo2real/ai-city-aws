// An in-process city for tests: memory ledger, memory bus, memory queue, the real Factory, the real
// Dispatcher and the real AgentHost, with a scripted fake engine instead of a model. No AWS, no Bedrock.
import {
  DEFAULT_SETTINGS,
  Dispatcher,
  Factory,
  Ledger,
  MemoryBus,
  MemoryQueue,
  MemoryTable,
  sessionIds,
  type CitySettings,
  type Invocation,
  type WorkMessage,
} from "@aic/shared";
import type { AgentEngine, EngineRequest } from "../../services/agent-runtime/src/engine.ts";
import { AgentHost } from "../../services/agent-runtime/src/host.ts";
import type { CityDeps } from "../../services/agent-runtime/src/tools.ts";

export const USAGE = { input: 400, output: 200, cacheRead: 3000, cacheWrite5m: 100, cacheWrite1h: 0 };

/** A fake engine: each role's script decides which tools to call, like a model would. */
export type Script = (
  req: EngineRequest,
  call: (tool: string, args: Record<string, unknown>) => Promise<string>,
) => Promise<string>;

export function scriptedEngine(scripts: Partial<Record<Invocation["role"], Script>>): AgentEngine {
  return async (req) => {
    const script = scripts[req.ctx.role];
    if (!script) return { text: "", stopReason: "end_turn", usage: USAGE };
    const call = async (tool: string, args: Record<string, unknown>) => {
      const t = req.tools.find((x) => x.name === tool);
      if (!t) throw new Error(`${req.ctx.role} has no tool ${tool}`);
      return t.handler(args);
    };
    const text = await script(req, call);
    return { text, stopReason: "end_turn", usage: USAGE };
  };
}

export function sessionIdFor(m: WorkMessage): string {
  switch (m.role) {
    case "ace":
      return sessionIds.ace("owner", m.conversation ?? "default");
    case "orchestrator":
      return sessionIds.orchestrator(m.taskId);
    case "manager":
      return sessionIds.manager(m.department ?? "x", m.taskId);
    case "worker":
      return sessionIds.worker(m.department ?? "x", m.agentId);
  }
}

export function makeCity(engine: AgentEngine, settings: Partial<CitySettings> = {}) {
  let t = new Date("2026-11-06T09:00:00Z").getTime();
  const clock = () => new Date(t);
  const table = new MemoryTable();
  const ledger = new Ledger(table, clock);
  const bus = new MemoryBus(clock);
  const queue = new MemoryQueue(() => t);
  const s: CitySettings = { ...DEFAULT_SETTINGS, ...settings };
  const getSettings = () => ledger.settings(s);
  const factory = new Factory(ledger, bus, getSettings);
  const deps: CityDeps = { ledger, bus, queue, factory, settings: getSettings, maxReviewRounds: 3 };
  const host = new AgentHost(deps, { engine, backoff: { sleep: async () => {}, random: () => 0 } });
  const invocations: Invocation[] = [];
  const dispatcher = new Dispatcher({
    ledger,
    bus,
    queue,
    settings: getSettings,
    sessionIdFor,
    invoker: {
      invoke: async (inv) => {
        invocations.push(inv);
        await host.runTurn(inv);
      },
    },
  });

  /** Delivers queued messages like SQS + the dispatcher Lambda would, until the city is quiet. */
  async function run(maxSteps = 500) {
    for (let i = 0; i < maxSteps; i++) {
      const ready = queue.takeReady();
      if (!ready.length) {
        const next = queue.nextAvailableAt();
        if (next === null) return;
        t = Math.max(t + 1, next);
        continue;
      }
      for (const m of ready) {
        try {
          await dispatcher.handle(m);
        } catch {
          // SQS would deliver it again after the visibility timeout.
          await queue.send(m, 60);
        }
      }
      t += 1000;
    }
    throw new Error("the city did not settle");
  }

  async function ownerSays(text: string, conversation = "c1") {
    await host.ensureCore();
    await queue.send({
      id: `owner-${text.length}-${conversation}`,
      role: "ace",
      agentId: "ace",
      department: null,
      ticketId: `conv-${conversation}`,
      taskId: `conv-${conversation}`,
      kind: "task",
      from: "owner",
      body: text,
      conversation,
    });
  }

  return {
    ledger,
    bus,
    queue,
    host,
    dispatcher,
    factory,
    deps,
    run,
    ownerSays,
    invocations,
    advance: (ms: number) => (t += ms),
    table,
  };
}
