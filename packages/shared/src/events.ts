// Every state change in the city is one of these events on the EventBridge bus `aic-prod`.
// The City view, the ledger writer and notifications all read the same events.
import { z } from "zod";

export const TicketStatus = z.enum([
  "open",
  "in_progress",
  "in_review",
  "waiting_on_owner",
  "parked",
  "done",
  "failed",
  "cancelled",
]);
export type TicketStatus = z.infer<typeof TicketStatus>;
export const TERMINAL: readonly TicketStatus[] = ["done", "failed", "cancelled"];

export const AgentKind = z.enum(["core", "manager", "worker"]);
export const WorkerState = z.enum([
  "hired",
  "working",
  "waiting",
  "reporting",
  "review",
  "completed",
  "released",
  "failed",
]);
export type WorkerState = z.infer<typeof WorkerState>;

export const AgentRecord = z.object({
  id: z.string(),
  kind: AgentKind,
  role: z.string(),
  department: z.string().nullable(),
  model: z.string(),
  parent: z.string().nullable(),
  state: z.enum(["active", "dormant", "retired"]),
  worker_state: WorkerState.nullable().optional(),
  specialty: z.string().optional(),
  session_id: z.string().optional(),
  ticket_id: z.string().nullable().optional(),
  specialist_id: z.string().nullable().optional(),
  total_cost_usd: z.number().default(0),
  hired_at: z.string().optional(),
  last_active_at: z.string().optional(),
});
export type AgentRecord = z.infer<typeof AgentRecord>;

export const TicketRecord = z.object({
  id: z.string(),
  goal: z.string(),
  from: z.string(),
  to: z.string(),
  status: TicketStatus,
  department: z.string().nullable(),
  parent_id: z.string().nullable(),
  kind: z.enum(["task", "assignment", "instruction", "report", "fix"]).default("task"),
  acceptance: z.string().optional(),
  result: z.string().optional(),
  review_rounds: z.number().default(0),
  /** Ace's conversation the task came from, so the result is spoken back there. */
  conversation: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TicketRecord = z.infer<typeof TicketRecord>;

export const QuestionRecord = z.object({
  id: z.string(),
  asked_by: z.string(),
  path: z.string(),
  ticket_id: z.string().nullable(),
  text: z.string(),
  options: z.array(z.string()).default([]),
  default_answer: z.string(),
  status: z.enum(["open", "answered", "expired"]),
  answer: z.string().optional(),
  answered_by: z.string().optional(),
  created_at: z.string(),
});
export type QuestionRecord = z.infer<typeof QuestionRecord>;

const base = { at: z.string() };
export const CityEvent = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("agent.hired"), agent: AgentRecord }),
  z.object({ ...base, type: z.literal("agent.retired"), id: z.string() }),
  z.object({
    ...base,
    type: z.literal("worker.state"),
    id: z.string(),
    state: WorkerState,
    detail: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("activity"),
    id: z.string(),
    activity: z.string(),
    detail: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("ticket.status"), ticket: TicketRecord, previous: TicketStatus.nullable() }),
  z.object({
    ...base,
    type: z.literal("department.created"),
    name: z.string(),
    mission: z.string(),
    manager_id: z.string(),
  }),
  z.object({ ...base, type: z.literal("question.asked"), question: QuestionRecord }),
  z.object({
    ...base,
    type: z.literal("question.answered"),
    id: z.string(),
    answer: z.string(),
    answered_by: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal("review.result"),
    ticket_id: z.string(),
    agent: z.string(),
    reviewer: z.string(),
    verdict: z.enum(["PASS", "FAIL"]),
    summary: z.string(),
    round: z.number(),
  }),
  z.object({
    ...base,
    type: z.literal("signoff.result"),
    ticket_id: z.string(),
    verdict: z.enum(["PASS", "FAIL"]),
    summary: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal("cost.update"),
    agent: z.string(),
    role: z.string(),
    department: z.string().nullable(),
    model: z.string(),
    usd: z.number(),
    tokens: z.number(),
    today: z.object({ usd: z.number(), turns: z.number(), tokens: z.number() }),
  }),
  z.object({ ...base, type: z.literal("result"), ticket_id: z.string(), summary: z.string() }),
  z.object({
    ...base,
    type: z.literal("instruction"),
    to: z.string(),
    cc: z.array(z.string()),
    text: z.string(),
    ticket_id: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal("approval.requested"),
    id: z.string(),
    agent: z.string(),
    action: z.string(),
    reason: z.string(),
    cost_hint: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("approval.decided"), id: z.string(), approved: z.boolean() }),
  z.object({
    ...base,
    type: z.literal("city.state"),
    paused: z.boolean(),
    reason: z.string().nullable(),
  }),
  z.object({
    ...base,
    type: z.literal("spend.cap_reached"),
    cap: z.enum(["daily_global", "daily_department", "monthly"]),
    department: z.string().nullable(),
    spent: z.number(),
    limit: z.number(),
  }),
  z.object({
    ...base,
    type: z.literal("ace.reply"),
    conversation: z.string(),
    text: z.string(),
    done: z.boolean(),
  }),
]);
export type CityEvent = z.infer<typeof CityEvent>;
export type CityEventType = CityEvent["type"];

/** Events without the timestamp; the bus adds it. */
export type CityEventInput = CityEvent extends infer E ? (E extends { at: string } ? Omit<E, "at"> : never) : never;

export interface EventBus {
  put(event: CityEventInput): Promise<void>;
}

/** In-memory bus for tests and local runs. */
export class MemoryBus implements EventBus {
  readonly events: CityEvent[] = [];
  private listeners: Array<(e: CityEvent) => void | Promise<void>> = [];
  constructor(private now: () => Date = () => new Date()) {}
  async put(event: CityEventInput): Promise<void> {
    const e = CityEvent.parse({ ...event, at: this.now().toISOString() });
    this.events.push(e);
    for (const l of this.listeners) await l(e);
  }
  on(listener: (e: CityEvent) => void | Promise<void>): void {
    this.listeners.push(listener);
  }
  ofType<T extends CityEventType>(type: T): Extract<CityEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<CityEvent, { type: T }> => e.type === type);
  }
}
