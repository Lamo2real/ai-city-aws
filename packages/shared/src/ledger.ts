// The ledger: tickets, turns, costs, departments, agents, hires, specialists, questions, approvals,
// notes, reminders and events, in one DynamoDB table. Every unit of work is a ticket with a status
// history, so work resumes after any crash. Days are UTC calendar days.
import type { AgentRecord, CityEvent, QuestionRecord, TicketRecord, TicketStatus } from "./events.ts";
import { departmentKey, newId } from "./ids.ts";
import type { Item, Table } from "./table.ts";

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
// Orders items written in the same millisecond by this process; ids keep different processes apart.
let counter = 0;
const seq = (): string => `${String(++counter % 1_000_000).padStart(6, "0")}#${newId("x").slice(2)}`;
export const monthKey = (d: Date): string => d.toISOString().slice(0, 7);
const strip = <T>(it: Item | undefined): T | undefined => {
  if (!it) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, ttl, ...rest } = it;
  return rest as T;
};

export interface Department {
  key: string;
  name: string;
  mission: string;
  manager_id: string;
  state: "active" | "archived";
  created_at: string;
}
export interface Specialist {
  id: string;
  department: string;
  specialty: string;
  instructions: string;
  tools: string[];
  created_at: string;
}
export interface Approval {
  id: string;
  agent: string;
  ticket_id: string | null;
  tool: string;
  action: string;
  hash: string;
  reason: string;
  status: "pending" | "approved" | "denied" | "used";
  task_token?: string;
  created_at: string;
}
export interface TurnRecord {
  id: string;
  agent: string;
  role: string;
  department: string | null;
  ticket_id: string | null;
  kind: TurnKind;
  model: string;
  fallback: boolean;
  input: number;
  output: number;
  cache_read: number;
  cache_write_5m: number;
  cache_write_1h: number;
  usd: number;
  cache_savings_usd: number;
  outcome: "ok" | "refused" | "no_verdict" | "error" | "timeout";
  at: string;
}
export type TurnKind = "ace" | "orchestrator" | "manager" | "worker" | "utility" | "compaction" | "eval";
export const TURN_KINDS: readonly TurnKind[] = [
  "ace",
  "orchestrator",
  "manager",
  "worker",
  "utility",
  "compaction",
  "eval",
];

export interface Spend {
  usd: number;
  turns: number;
  tokens: number;
}
export interface CitySettings {
  paused: boolean;
  pause_reason: string | null;
  monthly_budget_usd: number;
  daily_global_usd: number;
  daily_department_usd: number;
  department_caps: Record<string, number>;
  max_concurrent_workers_per_department: number;
  max_concurrent_workers_global: number;
  max_new_sessions_per_second: number;
  profile_prefix: "global" | "eu" | "us";
  notify_email: boolean;
  integrations: Record<string, boolean>;
  first_run_done: boolean;
}

export class Ledger {
  constructor(
    readonly table: Table,
    private clock: () => Date = () => new Date(),
  ) {}
  now(): Date {
    return this.clock();
  }
  private iso() {
    return this.clock().toISOString();
  }

  // ---------- tickets ----------
  async createTicket(
    t: Omit<TicketRecord, "id" | "created_at" | "updated_at" | "status" | "review_rounds"> & {
      id?: string;
      status?: TicketStatus;
    },
  ): Promise<TicketRecord> {
    const at = this.iso();
    const ticket: TicketRecord = {
      review_rounds: 0,
      status: "open",
      ...t,
      id: t.id ?? newId("t"),
      created_at: at,
      updated_at: at,
    };
    const created = await this.table.put(this.ticketItem(ticket), { ifNotExists: true });
    if (!created) return (await this.getTicket(ticket.id))!; // idempotent: same id, same ticket
    await this.history(ticket.id, null, ticket.status, "created");
    return ticket;
  }
  private ticketItem(t: TicketRecord): Item {
    return {
      pk: `TICKET#${t.id}`,
      sk: "META",
      gsi1pk: `TICKET#${t.status}`,
      gsi1sk: t.updated_at,
      ...(t.department ? { gsi2pk: `DEPT#${departmentKey(t.department)}`, gsi2sk: `TICKET#${t.id}` } : {}),
      ...t,
    };
  }
  async getTicket(id: string): Promise<TicketRecord | undefined> {
    return strip<TicketRecord>(await this.table.get(`TICKET#${id}`, "META"));
  }
  /** Moves a ticket, keeping its history. Returns the previous status, or null if the ticket was already there. */
  async setTicketStatus(
    id: string,
    status: TicketStatus,
    note = "",
    patch: Partial<TicketRecord> = {},
  ): Promise<{ ticket: TicketRecord; previous: TicketStatus } | null> {
    const cur = await this.getTicket(id);
    if (!cur) throw new Error(`no ticket ${id}`);
    if (cur.status === status && !Object.keys(patch).length) return null;
    const at = this.iso();
    const next = { ...cur, ...patch, status, updated_at: at };
    const ok = await this.table.update(`TICKET#${id}`, "META", {
      set: { ...patch, status, updated_at: at, gsi1pk: `TICKET#${status}`, gsi1sk: at },
      expect: { status: cur.status }, // two writers racing: one wins, the other re-reads
    });
    if (!ok) return this.setTicketStatus(id, status, note, patch);
    await this.history(id, cur.status, status, note);
    return { ticket: next, previous: cur.status };
  }
  private async history(id: string, from: TicketStatus | null, to: TicketStatus, note: string) {
    const at = this.iso();
    await this.table.put({ pk: `TICKET#${id}`, sk: `HIST#${at}#${seq()}`, from, to, note, at });
  }
  async ticketHistory(
    id: string,
  ): Promise<Array<{ from: TicketStatus | null; to: TicketStatus; note: string; at: string }>> {
    return (await this.table.query(`TICKET#${id}`, "HIST#")).map((i) => strip(i)!);
  }
  async listTickets(statuses: readonly TicketStatus[]): Promise<TicketRecord[]> {
    const all = await Promise.all(statuses.map((s) => this.table.queryIndex("gsi1", `TICKET#${s}`)));
    return all.flat().map((i) => strip<TicketRecord>(i)!);
  }
  async ticketsOf(agentId: string, statuses: readonly TicketStatus[]): Promise<TicketRecord[]> {
    return (await this.listTickets(statuses)).filter((t) => t.to === agentId);
  }
  async childTickets(parentId: string): Promise<TicketRecord[]> {
    const all = await this.listTickets([
      "open",
      "in_progress",
      "in_review",
      "waiting_on_owner",
      "parked",
      "done",
      "failed",
      "cancelled",
    ]);
    return all.filter((t) => t.parent_id === parentId);
  }

  // ---------- departments ----------
  async createDepartment(
    name: string,
    mission: string,
    managerId: string,
  ): Promise<{ department: Department; created: boolean }> {
    const key = departmentKey(name);
    const department: Department = {
      key,
      name: name.trim(),
      mission,
      manager_id: managerId,
      state: "active",
      created_at: this.iso(),
    };
    const created = await this.table.put(
      { pk: `DEPT#${key}`, sk: "META", gsi1pk: "DEPT", gsi1sk: department.created_at, ...department },
      { ifNotExists: true },
    );
    return { department: created ? department : (await this.getDepartment(name))!, created };
  }
  async getDepartment(name: string): Promise<Department | undefined> {
    return strip<Department>(await this.table.get(`DEPT#${departmentKey(name)}`, "META"));
  }
  async listDepartments(): Promise<Department[]> {
    return (await this.table.queryIndex("gsi1", "DEPT")).map((i) => strip<Department>(i)!);
  }

  // ---------- agents (hires) ----------
  async putAgent(a: AgentRecord): Promise<void> {
    await this.table.put({
      pk: `AGENT#${a.id}`,
      sk: "META",
      gsi1pk: `AGENT#${a.state}`,
      gsi1sk: a.id,
      ...(a.department ? { gsi2pk: `DEPT#${departmentKey(a.department)}`, gsi2sk: `AGENT#${a.id}` } : {}),
      ...a,
    });
  }
  async getAgent(id: string): Promise<AgentRecord | undefined> {
    return strip<AgentRecord>(await this.table.get(`AGENT#${id}`, "META"));
  }
  async updateAgent(id: string, patch: Partial<AgentRecord>): Promise<AgentRecord> {
    const set: Record<string, unknown> = { ...patch, last_active_at: this.iso() };
    if (patch.state) Object.assign(set, { gsi1pk: `AGENT#${patch.state}` });
    const it = await this.table.update(`AGENT#${id}`, "META", { set, mustExist: true });
    if (!it) throw new Error(`no agent ${id}`);
    return strip<AgentRecord>(it)!;
  }
  async listAgents(state?: AgentRecord["state"]): Promise<AgentRecord[]> {
    const states: AgentRecord["state"][] = state ? [state] : ["active", "dormant", "retired"];
    const all = await Promise.all(states.map((s) => this.table.queryIndex("gsi1", `AGENT#${s}`)));
    return all.flat().map((i) => strip<AgentRecord>(i)!);
  }
  async departmentAgents(department: string): Promise<AgentRecord[]> {
    return (await this.table.queryIndex("gsi2", `DEPT#${departmentKey(department)}`, "AGENT#")).map((i) =>
      strip<AgentRecord>(i)!,
    );
  }

  // ---------- specialists (saved worker specs) ----------
  async saveSpecialist(s: Omit<Specialist, "id" | "created_at"> & { id?: string }): Promise<Specialist> {
    const sp: Specialist = { ...s, id: s.id ?? newId("spec"), created_at: this.iso() };
    await this.table.put({
      pk: `SPEC#${sp.id}`,
      sk: "META",
      gsi1pk: "SPEC",
      gsi1sk: sp.id,
      gsi2pk: `DEPT#${departmentKey(sp.department)}`,
      gsi2sk: `SPEC#${sp.id}`,
      ...sp,
    });
    return sp;
  }
  async getSpecialist(id: string): Promise<Specialist | undefined> {
    return strip<Specialist>(await this.table.get(`SPEC#${id}`, "META"));
  }
  async listSpecialists(): Promise<Specialist[]> {
    return (await this.table.queryIndex("gsi1", "SPEC")).map((i) => strip<Specialist>(i)!);
  }

  // ---------- questions ----------
  async askQuestion(
    q: Omit<QuestionRecord, "id" | "status" | "created_at"> & { id?: string },
  ): Promise<QuestionRecord> {
    const rec: QuestionRecord = { ...q, id: q.id ?? newId("q"), status: "open", created_at: this.iso() };
    await this.table.put({ pk: `Q#${rec.id}`, sk: "META", gsi1pk: "Q#open", gsi1sk: rec.created_at, ...rec });
    return rec;
  }
  async answerQuestion(id: string, answer: string, answeredBy: string): Promise<QuestionRecord | undefined> {
    const it = await this.table.update(`Q#${id}`, "META", {
      set: { status: "answered", answer, answered_by: answeredBy, gsi1pk: "Q#answered" },
      expect: { status: "open" }, // answered once; a second answer is refused
    });
    return strip<QuestionRecord>(it);
  }
  async getQuestion(id: string): Promise<QuestionRecord | undefined> {
    return strip<QuestionRecord>(await this.table.get(`Q#${id}`, "META"));
  }
  async openQuestions(): Promise<QuestionRecord[]> {
    return (await this.table.queryIndex("gsi1", "Q#open")).map((i) => strip<QuestionRecord>(i)!);
  }

  // ---------- approvals, bound to one exact action ----------
  async requestApproval(a: Omit<Approval, "id" | "status" | "created_at">): Promise<Approval> {
    const rec: Approval = { ...a, id: newId("ap"), status: "pending", created_at: this.iso() };
    await this.table.put({
      pk: `APPROVAL#${rec.id}`,
      sk: "META",
      gsi1pk: "APPROVAL#pending",
      gsi1sk: `${rec.hash}#${rec.id}`,
      ...rec,
    });
    return rec;
  }
  async getApproval(id: string): Promise<Approval | undefined> {
    return strip<Approval>(await this.table.get(`APPROVAL#${id}`, "META"));
  }
  async decideApproval(id: string, approved: boolean): Promise<Approval | undefined> {
    const cur = await this.getApproval(id);
    if (!cur) return undefined;
    const status = approved ? "approved" : "denied";
    return strip<Approval>(
      await this.table.update(`APPROVAL#${id}`, "META", {
        set: { status, gsi1pk: `APPROVAL#${status}` },
        expect: { status: "pending" },
      }),
    );
  }
  async pendingApprovals(): Promise<Approval[]> {
    return (await this.table.queryIndex("gsi1", "APPROVAL#pending")).map((i) => strip<Approval>(i)!);
  }
  /** Uses an owner approval for this exact action once. */
  async consumeApproval(hash: string): Promise<boolean> {
    for (const it of await this.table.queryIndex("gsi1", "APPROVAL#approved", `${hash}#`)) {
      const used = await this.table.update(it.pk, "META", {
        set: { status: "used", gsi1pk: "APPROVAL#used" },
        expect: { status: "approved" },
      });
      if (used) return true;
    }
    return false;
  }

  // ---------- turns, costs and spend counters ----------
  async recordTurn(t: Omit<TurnRecord, "id" | "at"> & { id?: string }): Promise<{ turn: TurnRecord; today: Spend }> {
    const turn: TurnRecord = { ...t, id: t.id ?? newId("turn"), at: this.iso() };
    // Idempotent per turn id: a retried Lambda never counts a turn twice.
    const fresh = await this.claim(`turn:${turn.id}`, 7 * 86_400);
    if (fresh)
      await this.table.put({
        pk: `TURN#${turn.agent}`,
        sk: `${turn.at}#${seq()}#${turn.id}`,
        gsi1pk: `TURNDAY#${dayKey(this.now())}`,
        gsi1sk: `${turn.at}#${turn.id}`,
        ...turn,
      });
    const tokens = turn.input + turn.output + turn.cache_read + turn.cache_write_5m + turn.cache_write_1h;
    let today: Spend = { usd: 0, turns: 0, tokens: 0 };
    if (fresh) {
      const d = dayKey(this.now()),
        m = monthKey(this.now());
      const add = { usd: turn.usd, turns: 1, tokens, cache_savings_usd: turn.cache_savings_usd };
      const dept = turn.department ? departmentKey(turn.department) : null;
      const keys: Array<[string, string]> = [
        [`SPEND#DAY#${d}`, "GLOBAL"],
        [`SPEND#MONTH#${m}`, "GLOBAL"],
        [`SPEND#DAY#${d}`, `ROLE#${turn.role}`],
        [`SPEND#MONTH#${m}`, `ROLE#${turn.role}`],
        [`SPEND#DAY#${d}`, `MODEL#${turn.model}`],
        [`SPEND#MONTH#${m}`, `MODEL#${turn.model}`],
        ...(dept
          ? ([
              [`SPEND#DAY#${d}`, `DEPT#${dept}`],
              [`SPEND#MONTH#${m}`, `DEPT#${dept}`],
            ] as Array<[string, string]>)
          : []),
      ];
      for (const [pk, sk] of keys) {
        const it = await this.table.update(pk, sk, { add });
        if (pk.startsWith("SPEND#DAY#") && sk === "GLOBAL")
          today = { usd: Number(it?.usd ?? 0), turns: Number(it?.turns ?? 0), tokens: Number(it?.tokens ?? 0) };
      }
      const agent = await this.getAgent(turn.agent);
      if (agent) await this.table.update(`AGENT#${turn.agent}`, "META", { add: { total_cost_usd: turn.usd } });
    }
    return { turn, today };
  }
  async spend(
    scope: "day" | "month",
    sk: string,
    at: Date = this.now(),
  ): Promise<Spend & { cache_savings_usd: number }> {
    const pk = scope === "day" ? `SPEND#DAY#${dayKey(at)}` : `SPEND#MONTH#${monthKey(at)}`;
    const it = await this.table.get(pk, sk);
    return {
      usd: Number(it?.usd ?? 0),
      turns: Number(it?.turns ?? 0),
      tokens: Number(it?.tokens ?? 0),
      cache_savings_usd: Number(it?.cache_savings_usd ?? 0),
    };
  }
  async spendBreakdown(
    scope: "day" | "month",
    at: Date = this.now(),
  ): Promise<Record<string, Spend & { cache_savings_usd: number }>> {
    const pk = scope === "day" ? `SPEND#DAY#${dayKey(at)}` : `SPEND#MONTH#${monthKey(at)}`;
    const out: Record<string, Spend & { cache_savings_usd: number }> = {};
    for (const it of await this.table.query(pk))
      out[it.sk] = {
        usd: Number(it.usd ?? 0),
        turns: Number(it.turns ?? 0),
        tokens: Number(it.tokens ?? 0),
        cache_savings_usd: Number(it.cache_savings_usd ?? 0),
      };
    return out;
  }
  async turnsOf(agentId: string): Promise<TurnRecord[]> {
    return (await this.table.query(`TURN#${agentId}`)).map((i) => strip<TurnRecord>(i)!);
  }

  // ---------- concurrency slots and the session rate limit ----------
  /** Takes a worker slot in the department and globally, or returns false when a ceiling is reached. */
  async acquireWorkerSlot(department: string, perDept: number, global: number): Promise<boolean> {
    const g = await this.table.update("SLOTS", "GLOBAL", {
      add: { active: 1 },
      addLimit: { attr: "active", max: global },
    });
    if (!g) return false;
    const d = await this.table.update("SLOTS", `DEPT#${departmentKey(department)}`, {
      add: { active: 1 },
      addLimit: { attr: "active", max: perDept },
    });
    if (!d) {
      await this.table.update("SLOTS", "GLOBAL", { add: { active: -1 } });
      return false;
    }
    return true;
  }
  async releaseWorkerSlot(department: string): Promise<void> {
    await this.table.update("SLOTS", "GLOBAL", { add: { active: -1 } });
    await this.table.update("SLOTS", `DEPT#${departmentKey(department)}`, { add: { active: -1 } });
  }
  async activeWorkers(department?: string): Promise<number> {
    const it = await this.table.get("SLOTS", department ? `DEPT#${departmentKey(department)}` : "GLOBAL");
    return Number(it?.active ?? 0);
  }
  /** At most `perSecond` new sessions in any one second. */
  async takeSessionToken(perSecond: number): Promise<boolean> {
    const sec = Math.floor(this.now().getTime() / 1000);
    const it = await this.table.update("RATE", String(sec), {
      add: { n: 1 },
      addLimit: { attr: "n", max: perSecond },
      set: { ttl: sec + 120 },
    });
    return Boolean(it);
  }

  // ---------- city settings and the pause flag ----------
  async settings(defaults: CitySettings): Promise<CitySettings> {
    const it = strip<Partial<CitySettings>>(await this.table.get("CONFIG", "city"));
    return { ...defaults, ...(it ?? {}) };
  }
  async updateSettings(patch: Partial<CitySettings>): Promise<void> {
    await this.table.update("CONFIG", "city", { set: patch });
  }
  async isPaused(): Promise<boolean> {
    return Boolean((await this.table.get("CONFIG", "city"))?.paused);
  }

  // ---------- events (ticket trace), notes, reminders, idempotency ----------
  async appendEvent(ticketId: string, e: CityEvent): Promise<void> {
    await this.table.put({ pk: `EVENT#${ticketId}`, sk: `${e.at}#${seq()}`, ...e });
  }
  async trace(ticketId: string): Promise<CityEvent[]> {
    return (await this.table.query(`EVENT#${ticketId}`)).map((i) => strip<CityEvent>(i)!);
  }
  async addNote(text: string, kind: "note" | "reminder", dueAt?: string): Promise<{ id: string }> {
    const id = newId(kind === "note" ? "n" : "r");
    await this.table.put({
      pk: `${kind.toUpperCase()}#${id}`,
      sk: "META",
      gsi1pk: kind === "note" ? "NOTE" : "REMINDER#pending",
      gsi1sk: dueAt ?? this.iso(),
      id,
      text,
      due_at: dueAt ?? null,
      created_at: this.iso(),
    });
    return { id };
  }
  async listNotes(kind: "note" | "reminder"): Promise<Array<{ id: string; text: string; due_at: string | null }>> {
    return (await this.table.queryIndex("gsi1", kind === "note" ? "NOTE" : "REMINDER#pending")).map((i) => strip(i)!);
  }
  /** Takes a lease on one unit of work (a queue message). False when it is done, or running under a live lease. */
  async beginWork(key: string, leaseMs: number, message?: unknown): Promise<boolean> {
    const cur = await this.table.get(`WORK#${key}`, "META");
    const now = this.now().getTime();
    if (cur?.state === "done") return false;
    if (cur?.state === "started" && Number(cur.lease_until) > now) return false;
    const ok = await this.table.update(`WORK#${key}`, "META", {
      set: {
        state: "started",
        lease_until: now + leaseMs,
        ttl: Math.floor(now / 1000) + 7 * 86_400,
        gsi1pk: "WORK#started",
        gsi1sk: String(now + leaseMs),
        ...(message ? { message } : {}),
      },
      expect: { state: cur?.state, lease_until: cur?.lease_until },
    });
    return Boolean(ok);
  }
  async finishWork(key: string): Promise<void> {
    await this.table.update(`WORK#${key}`, "META", { set: { state: "done", gsi1pk: "WORK#done" } });
  }
  /** Lets a failed unit of work be picked up again at once instead of after its lease. */
  async abandonWork(key: string): Promise<void> {
    await this.table.update(`WORK#${key}`, "META", {
      set: { state: "abandoned", lease_until: 0, gsi1pk: "WORK#abandoned" },
    });
  }
  /** Units of work whose lease ran out without finishing: the turn crashed or its microVM died. */
  async staleWork(): Promise<Array<{ key: string; message: unknown }>> {
    const now = this.now().getTime();
    return (await this.table.queryIndex("gsi1", "WORK#started"))
      .filter((i) => Number(i.lease_until) <= now)
      .map((i) => ({ key: i.pk.slice(5), message: i.message }));
  }
  async isWorkDone(key: string): Promise<boolean> {
    return (await this.table.get(`WORK#${key}`, "META"))?.state === "done";
  }
  /** Every tool call, with the gate's decision. Tool input itself is not stored (it can hold outside content). */
  async auditTool(agentId: string, tool: string, decision: "allow" | "deny", reason: string): Promise<void> {
    const at = this.iso();
    await this.table.put({
      pk: `TOOL#${agentId}`,
      sk: `${at}#${seq()}`,
      agent: agentId,
      tool,
      decision,
      reason: reason.slice(0, 300),
      at,
      ttl: Math.floor(this.now().getTime() / 1000) + 90 * 86_400,
    });
  }
  async toolCalls(agentId: string): Promise<Array<{ tool: string; decision: string; reason: string; at: string }>> {
    return (await this.table.query(`TOOL#${agentId}`)).map((i) => strip(i)!);
  }

  /** True the first time a key is seen (within its TTL), false for a duplicate delivery. */
  async claim(key: string, ttlSeconds = 86_400): Promise<boolean> {
    return this.table.put(
      { pk: `IDEMP#${key}`, sk: "META", ttl: Math.floor(this.now().getTime() / 1000) + ttlSeconds },
      { ifNotExists: true },
    );
  }
}
