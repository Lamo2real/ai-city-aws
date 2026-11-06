// Work moves between agents as queue messages, one SQS queue per role level. A turn issues work and
// ends; the next turn starts when a message arrives. Nobody pays for session time while waiting.
import type { Role } from "../models.ts";

export type AgentRole = Exclude<Role, "utility">;
export type MessageKind = "task" | "report" | "answer" | "question" | "instruction" | "fix" | "review_result";

export interface WorkMessage {
  /** Idempotency key: the same message delivered twice runs once. */
  id: string;
  role: AgentRole;
  agentId: string;
  department: string | null;
  /** The ticket this message is about. */
  ticketId: string;
  /** The owner's original task: sessions are keyed by it. */
  taskId: string;
  kind: MessageKind;
  from: string;
  /** Plain text for the agent. Reports and answers from other agents are untrusted data. */
  body: string;
  /** Conversation id, for Ace's messages. */
  conversation?: string;
  /** How many times the dispatcher deferred it (pause, caps, ceilings). */
  deferrals?: number;
}

export interface Queue {
  send(message: WorkMessage, delaySeconds?: number): Promise<void>;
}

/** In-memory queue with simulated delays, for tests and local runs. */
export class MemoryQueue implements Queue {
  readonly pending: Array<{ message: WorkMessage; availableAt: number }> = [];
  readonly sent: WorkMessage[] = [];
  constructor(private now: () => number = Date.now) {}
  async send(message: WorkMessage, delaySeconds = 0): Promise<void> {
    this.sent.push(message);
    this.pending.push({ message, availableAt: this.now() + delaySeconds * 1000 });
  }
  /** Takes every message available now, oldest first. */
  takeReady(): WorkMessage[] {
    const t = this.now();
    const ready = this.pending.filter((p) => p.availableAt <= t);
    for (const r of ready) this.pending.splice(this.pending.indexOf(r), 1);
    return ready.map((r) => r.message);
  }
  nextAvailableAt(): number | null {
    return this.pending.length ? Math.min(...this.pending.map((p) => p.availableAt)) : null;
  }
}
