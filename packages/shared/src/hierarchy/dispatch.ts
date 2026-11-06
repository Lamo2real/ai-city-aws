// The dispatcher's decisions, without AWS: before any turn starts it checks the pause flag, the spend
// caps, the concurrency ceilings and the new-session rate. Work above a ceiling waits in the queue
// and starts when a slot frees. Nothing is dropped.
import { checkCaps } from "../caps.ts";
import type { EventBus } from "../events.ts";
import { dayKey, type CitySettings, type Ledger } from "../ledger.ts";
import type { Queue, WorkMessage } from "./queue.ts";

export interface Invocation extends WorkMessage {
  sessionId: string;
  /** Workers run as AgentCore async jobs: the invoke returns once the job is accepted. */
  async: boolean;
}
export interface AgentInvoker {
  invoke(inv: Invocation): Promise<void>;
}

export type DispatchOutcome =
  "started" | "duplicate" | "deferred:paused" | "deferred:cap" | "deferred:ceiling" | "deferred:rate";

export interface DispatcherDeps {
  ledger: Ledger;
  bus: EventBus;
  queue: Queue;
  invoker: AgentInvoker;
  settings: () => Promise<CitySettings>;
  sessionIdFor: (m: WorkMessage) => string;
  /** Lease on a message while its turn runs: the turn timeout plus a minute. */
  leaseMs?: number;
}

export const DEFER_SECONDS = { paused: 60, cap: 900, ceiling: 15, rate: 1 } as const;

export class Dispatcher {
  constructor(private d: DispatcherDeps) {}

  private async defer(m: WorkMessage, seconds: number): Promise<void> {
    await this.d.queue.send({ ...m, deferrals: (m.deferrals ?? 0) + 1 }, seconds);
  }

  async handle(m: WorkMessage): Promise<DispatchOutcome> {
    const { ledger } = this.d;
    if (await ledger.isWorkDone(m.id)) return "duplicate";
    const s = await this.d.settings();
    if (await ledger.isPaused()) {
      await this.defer(m, DEFER_SECONDS.paused);
      return "deferred:paused";
    }
    const cap = await checkCaps(ledger, s, m.role, m.department);
    if (!cap.ok) {
      await this.d.bus.put({
        type: "spend.cap_reached",
        cap: cap.cap,
        department: cap.department,
        spent: cap.spent,
        limit: cap.limit,
      });
      // Ace asks the owner once per cap per day whether to raise it; the work waits meanwhile.
      if (await ledger.claim(`cap-question:${cap.cap}:${cap.department ?? "all"}:${dayKey(ledger.now())}`)) {
        const q = await ledger.askQuestion({
          asked_by: "ace",
          path: "Ace",
          ticket_id: null,
          text: `${cap.message} Raise the cap so waiting work can continue?`,
          options: ["Keep the cap (work waits)", "Raise the cap in Settings"],
          default_answer: "Keep the cap (work waits)",
        });
        await this.d.bus.put({ type: "question.asked", question: q });
      }
      await this.defer(m, DEFER_SECONDS.cap);
      return "deferred:cap";
    }
    const isWorker = m.role === "worker";
    if (isWorker && m.department) {
      if (
        !(await ledger.acquireWorkerSlot(
          m.department,
          s.max_concurrent_workers_per_department,
          s.max_concurrent_workers_global,
        ))
      ) {
        await this.defer(m, DEFER_SECONDS.ceiling);
        return "deferred:ceiling";
      }
    }
    const release = async () => {
      if (isWorker && m.department) await ledger.releaseWorkerSlot(m.department);
    };
    if (!(await ledger.takeSessionToken(s.max_new_sessions_per_second))) {
      await release();
      await this.defer(m, DEFER_SECONDS.rate);
      return "deferred:rate";
    }
    if (!(await ledger.beginWork(m.id, this.d.leaseMs ?? 16 * 60_000, m))) {
      await release();
      return "duplicate";
    }
    try {
      await this.d.invoker.invoke({ ...m, sessionId: this.d.sessionIdFor(m), async: isWorker });
    } catch (e) {
      // The runtime never started the turn: give the slot back and let SQS deliver it again.
      await release();
      await ledger.abandonWork(m.id);
      throw e;
    }
    return "started";
  }
}

/**
 * The crash sweep (run on a schedule): a message whose lease ran out without finishing is sent
 * again. Its agent's next turn reads the ledger and carries on from there.
 */
export async function resumeStale(ledger: Ledger, queue: Queue): Promise<number> {
  let n = 0;
  for (const w of await ledger.staleWork()) {
    if (!w.message) continue;
    const m = w.message as WorkMessage;
    await ledger.abandonWork(w.key);
    // A dead worker turn never gave its slot back.
    if (m.role === "worker" && m.department) await ledger.releaseWorkerSlot(m.department);
    await queue.send({ ...m, deferrals: (m.deferrals ?? 0) + 1 });
    n++;
  }
  return n;
}
