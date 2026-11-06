// The HTTP API (API Gateway HTTP API + Cognito JWT authorizer). API Gateway validates the token;
// this handler checks again that the caller is in the `owner` group, on every route.
// Replies are plain data for the HUD; errors are plain words, never stack traces.
import { SFNClient, SendTaskFailureCommand, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import {
  CAPS_CONFIG,
  answerQuestion,
  awsCity,
  bedrockConverseRunner,
  departmentKey,
  isAddressedToAce,
  log,
  modelLabel,
  newId,
  validateCaps,
  type CitySettings,
  type EventBus,
  type Ledger,
  type ModelRunner,
  type Queue,
  type TicketStatus,
} from "@aic/shared";

export interface HttpEvent {
  rawPath: string;
  requestContext: { http: { method: string }; authorizer?: { jwt?: { claims?: Record<string, unknown> } } };
  queryStringParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}
export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
export interface ApiDeps {
  ledger: Ledger;
  bus: EventBus;
  queue: Queue;
  settings: () => Promise<CitySettings>;
  sfn?: Pick<SFNClient, "send">;
  utilityRunner?: ModelRunner;
  ownerId?: string;
}

/** The actions need the factory only for hiring, which the API never does. */
const actionDeps = (d: ApiDeps) => ({
  ledger: d.ledger,
  bus: d.bus,
  queue: d.queue,
  settings: d.settings,
  maxReviewRounds: CAPS_CONFIG.max_review_rounds,
  factory: {
    hire: () => Promise.reject(new Error("the API does not hire")),
    release: () => Promise.reject(new Error("the API does not release")),
  },
});

const LIVE: TicketStatus[] = ["open", "in_progress", "in_review", "waiting_on_owner"];
const ALL: TicketStatus[] = [...LIVE, "parked", "done", "failed", "cancelled"];

const reply = (statusCode: number, body: unknown): HttpResult => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});
const problem = (statusCode: number, message: string, fix?: string) =>
  reply(statusCode, { error: message, fix: fix ?? null });

/** Cognito puts groups in `cognito:groups`; through API Gateway it can arrive as "[owner other]" or "owner". */
export function isOwner(event: HttpEvent): boolean {
  const raw = event.requestContext.authorizer?.jwt?.claims?.["cognito:groups"];
  const groups = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "")
        .replace(/^\[|\]$/g, "")
        .split(/[\s,]+/);
  return groups.includes("owner");
}

function body(event: HttpEvent): Record<string, unknown> {
  if (!event.body) return {};
  const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (text.length > 64_000) throw new BadRequest("That message is too long.");
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new BadRequest("The request could not be read.");
  }
}
class BadRequest extends Error {}
const str = (v: unknown, name: string, max = 4000): string => {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${name} is missing.`);
  if (v.length > max) throw new BadRequest(`${name} is too long.`);
  return v.trim();
};

export async function citySnapshot(d: ApiDeps) {
  const s = await d.settings();
  const [agents, departments, tickets, parked, questions, approvals, today, month, dayBreakdown] = await Promise.all([
    d.ledger.listAgents(),
    d.ledger.listDepartments(),
    d.ledger.listTickets(LIVE),
    d.ledger.listTickets(["parked"]),
    d.ledger.openQuestions(),
    d.ledger.pendingApprovals(),
    d.ledger.spend("day", "GLOBAL"),
    d.ledger.spend("month", "GLOBAL"),
    d.ledger.spendBreakdown("day"),
  ]);
  const spend: Record<string, number> = {};
  for (const dep of departments) spend[dep.name] = dayBreakdown[`DEPT#${dep.key}`]?.usd ?? 0;
  const running = tickets.filter((t) => t.status === "in_progress").length;
  return {
    agents: agents.map((a) => ({ ...a, model_label: modelLabel(a.model) })),
    departments,
    tickets,
    parked,
    questions,
    approvals,
    usage: { usd: today.usd, turns: today.turns, tokens: today.tokens },
    month: { usd: month.usd },
    spend,
    caps: {
      daily_global_usd: s.daily_global_usd,
      monthly_budget_usd: s.monthly_budget_usd,
      daily_department_usd: s.daily_department_usd,
    },
    city: {
      paused: s.paused,
      reason: s.pause_reason,
      running,
      waiting: tickets.filter((t) => t.status === "open").length,
    },
    region: process.env.AWS_REGION ?? "eu-north-1",
  };
}

async function costs(d: ApiDeps) {
  const s = await d.settings();
  const [day, month] = await Promise.all([d.ledger.spendBreakdown("day"), d.ledger.spendBreakdown("month")]);
  const group = (b: typeof day, prefix: string) =>
    Object.fromEntries(
      Object.entries(b)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [k.slice(prefix.length), v]),
    );
  return {
    estimate: true,
    note: "Estimates from token counts at list prices. The AWS bill is the truth.",
    today: day.GLOBAL ?? { usd: 0, turns: 0, tokens: 0, cache_savings_usd: 0 },
    month: month.GLOBAL ?? { usd: 0, turns: 0, tokens: 0, cache_savings_usd: 0 },
    by_department: group(month, "DEPT#"),
    by_role: group(month, "ROLE#"),
    by_model: Object.fromEntries(Object.entries(group(month, "MODEL#")).map(([k, v]) => [modelLabel(k), v])),
    caps: {
      daily_global_usd: s.daily_global_usd,
      monthly_budget_usd: s.monthly_budget_usd,
      daily_department_usd: s.daily_department_usd,
      department_caps: s.department_caps,
    },
    cost_explorer_url: "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
  };
}

async function route(event: HttpEvent, d: ApiDeps): Promise<HttpResult> {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath.replace(/\/+$/, "") || "/";
  const q = event.queryStringParameters ?? {};
  const seg = path.split("/").filter(Boolean);
  const is = (m: string, p: RegExp) => method === m && p.test(path);

  if (is("GET", /^\/city$/)) return reply(200, await citySnapshot(d));
  if (is("GET", /^\/city\/agent$/)) {
    const id = str(q.id, "Agent");
    const a = await d.ledger.getAgent(id);
    if (!a) return problem(404, "That agent does not exist.");
    const [turns, tools, tickets] = await Promise.all([
      d.ledger.turnsOf(id),
      d.ledger.toolCalls(id),
      d.ledger.ticketsOf(id, LIVE),
    ]);
    return reply(200, {
      agent: { ...a, model_label: modelLabel(a.model) },
      ticket: tickets[0] ?? null,
      recent: tools.slice(-10),
      turns: turns.length,
      cost_usd: turns.reduce((n, t) => n + t.usd, 0),
    });
  }
  if (is("POST", /^\/city\/instruct$/)) {
    const b = body(event);
    const agentId = str(b.agent_id, "Agent");
    const text = str(b.text, "Instruction");
    // The instruction goes through Ace like every owner message, so the same gate applies.
    const conversation = typeof b.conversation === "string" ? b.conversation : "hud";
    await d.queue.send({
      id: newId("m"),
      role: "ace",
      agentId: "ace",
      department: null,
      ticketId: `conv-${conversation}`,
      taskId: `conv-${conversation}`,
      kind: "instruction",
      from: "owner",
      body: `@${agentId} ${text}`,
      conversation,
    });
    return reply(202, { accepted: true });
  }
  if (is("POST", /^\/messages$/)) {
    const b = body(event);
    const text = str(b.text, "Message", 8000);
    const conversation =
      typeof b.conversation === "string" && /^[\w-]{1,64}$/.test(b.conversation) ? b.conversation : "main";
    const id =
      typeof b.client_id === "string" && /^[\w-]{8,64}$/.test(b.client_id) ? `owner-${b.client_id}` : newId("owner");
    await d.queue.send({
      id,
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
    return reply(202, { accepted: true, conversation });
  }
  if (is("POST", /^\/wake-check$/)) {
    const transcript = str(body(event).transcript, "Transcript", 2000);
    if (!d.utilityRunner) return reply(200, { addressed: /^\s*\S*\s*ace\b/i.test(transcript) });
    const addressed = await isAddressedToAce(transcript, {
      ledger: d.ledger,
      bus: d.bus,
      settings: await d.settings(),
      runner: d.utilityRunner,
    });
    return reply(200, { addressed });
  }
  if (is("GET", /^\/tickets$/)) {
    const which =
      q.status === "all" ? ALL : q.status === "done" ? (["done", "failed", "cancelled"] as TicketStatus[]) : LIVE;
    const list = (await d.ledger.listTickets(which)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return reply(200, { tickets: list.slice(0, 200) });
  }
  if (is("GET", /^\/tickets\/[\w-]+$/)) {
    const t = await d.ledger.getTicket(seg[1]!);
    if (!t) return problem(404, "That ticket does not exist.");
    const [history, trace, children] = await Promise.all([
      d.ledger.ticketHistory(t.id),
      d.ledger.trace(t.id),
      d.ledger.childTickets(t.id),
    ]);
    return reply(200, { ticket: t, history, trace, children });
  }
  if (is("GET", /^\/departments$/)) return reply(200, { departments: await d.ledger.listDepartments() });
  if (is("GET", /^\/agents$/)) return reply(200, { agents: await d.ledger.listAgents() });
  if (is("GET", /^\/workforce$/)) {
    const agents = (await d.ledger.listAgents()).filter((a) => a.kind === "worker");
    return reply(200, { workers: agents, specialists: await d.ledger.listSpecialists() });
  }
  if (is("GET", /^\/costs$/)) return reply(200, await costs(d));
  if (is("GET", /^\/health$/)) {
    const s = await d.settings();
    return reply(200, {
      paused: s.paused,
      workers_busy: await d.ledger.activeWorkers(),
      worker_ceiling: s.max_concurrent_workers_global,
      stale_turns: (await d.ledger.staleWork()).length,
    });
  }
  if (is("GET", /^\/questions$/))
    return reply(200, { questions: await d.ledger.openQuestions(), approvals: await d.ledger.pendingApprovals() });
  if (is("POST", /^\/questions\/[\w-]+\/(answer|default)$/)) {
    const qn = await d.ledger.getQuestion(seg[1]!);
    if (!qn || qn.status !== "open") return problem(409, "That question was already answered.", "Refresh the list.");
    const answer = seg[2] === "default" ? qn.default_answer : str(body(event).answer, "Answer");
    await answerQuestion(actionDeps(d), qn.id, answer, "owner");
    return reply(200, { answered: true, answer });
  }
  if (is("POST", /^\/approvals\/[\w-]+$/)) {
    const b = body(event);
    if (typeof b.approved !== "boolean") throw new BadRequest("Say approve or refuse.");
    const cur = await d.ledger.getApproval(seg[1]!);
    if (!cur) return problem(404, "That approval does not exist.");
    if (cur.status !== "pending") return problem(409, "That approval was already decided.");
    const a = (await d.ledger.decideApproval(cur.id, b.approved))!;
    if (cur.task_token && d.sfn) {
      if (b.approved)
        await d.sfn.send(
          new SendTaskSuccessCommand({
            taskToken: cur.task_token,
            output: JSON.stringify({ approved: true, id: cur.id }),
          }),
        );
      else
        await d.sfn.send(
          new SendTaskFailureCommand({ taskToken: cur.task_token, error: "Refused", cause: "The owner refused." }),
        );
    }
    await d.bus.put({ type: "approval.decided", id: a.id, approved: b.approved });
    return reply(200, { approval: a });
  }
  if (is("GET", /^\/settings$/))
    return reply(200, {
      settings: await d.settings(),
      limits: {
        sanity_daily_cap_usd: CAPS_CONFIG.sanity_daily_cap_usd,
        sanity_monthly_cap_usd: CAPS_CONFIG.sanity_monthly_cap_usd,
      },
    });
  if (is("PUT", /^\/settings$/)) {
    const b = body(event);
    const patch: Partial<CitySettings> = {};
    for (const k of [
      "monthly_budget_usd",
      "daily_global_usd",
      "daily_department_usd",
      "max_concurrent_workers_per_department",
      "max_concurrent_workers_global",
      "max_new_sessions_per_second",
    ] as const)
      if (b[k] !== undefined) (patch as Record<string, unknown>)[k] = b[k];
    if (b.profile_prefix !== undefined) {
      if (!["global", "eu", "us"].includes(String(b.profile_prefix))) throw new BadRequest("Pick global, eu or us.");
      patch.profile_prefix = b.profile_prefix as CitySettings["profile_prefix"];
    }
    if (typeof b.notify_email === "boolean") patch.notify_email = b.notify_email;
    if (typeof b.first_run_done === "boolean") patch.first_run_done = b.first_run_done;
    if (b.integrations && typeof b.integrations === "object")
      patch.integrations = Object.fromEntries(
        Object.entries(b.integrations as object).map(([k, v]) => [k, Boolean(v)]),
      );
    if (b.department_caps && typeof b.department_caps === "object")
      patch.department_caps = Object.fromEntries(
        Object.entries(b.department_caps as Record<string, unknown>).map(([k, v]) => [departmentKey(k), Number(v)]),
      );
    const capPatch = Object.fromEntries(
      (["daily_global_usd", "monthly_budget_usd", "daily_department_usd"] as const)
        .filter((k) => patch[k] !== undefined)
        .map((k) => [k, patch[k]]),
    );
    const bad = validateCaps(capPatch, b.confirm_high === true);
    if (bad) return problem(400, bad);
    for (const k of [
      "max_concurrent_workers_per_department",
      "max_concurrent_workers_global",
      "max_new_sessions_per_second",
    ] as const) {
      const v = patch[k];
      if (v !== undefined && (!Number.isInteger(v) || v < 1))
        return problem(400, `${k.replace(/_/g, " ")} must be a whole number of at least 1.`);
    }
    if ((patch.max_new_sessions_per_second ?? 0) > 25)
      return problem(400, "New sessions per second can't go above AgentCore's limit of 25.");
    const cur = await d.settings();
    if (
      Object.values(patch.department_caps ?? {}).some(
        (v) => !Number.isFinite(v) || v < 0 || v > (patch.daily_global_usd ?? cur.daily_global_usd),
      )
    )
      return problem(400, "A department cap must be between $0 and the daily cap.");
    await d.ledger.updateSettings(patch);
    return reply(200, { settings: await d.settings() });
  }
  if (is("POST", /^\/city\/(pause|resume)$/)) {
    const paused = seg[1] === "pause";
    await d.ledger.updateSettings({ paused, pause_reason: paused ? "Paused by the owner" : null });
    await d.bus.put({ type: "city.state", paused, reason: paused ? "Paused by the owner" : null });
    return reply(200, { paused });
  }
  if (is("GET", /^\/memory$/))
    return reply(200, { notes: await d.ledger.listNotes("note"), reminders: await d.ledger.listNotes("reminder") });
  if (is("POST", /^\/notes$/)) {
    const b = body(event);
    const kind = b.kind === "reminder" ? "reminder" : "note";
    const due = kind === "reminder" ? str(b.due_at, "Due time", 40) : undefined;
    if (due && Number.isNaN(Date.parse(due))) throw new BadRequest("That due time is not a date.");
    return reply(201, await d.ledger.addNote(str(b.text, "Note"), kind, due));
  }
  return problem(404, "There is nothing here.");
}

export const ROUTES: Array<[string, string]> = [
  ["GET", "/city"],
  ["GET", "/city/agent?id=x"],
  ["POST", "/city/instruct"],
  ["POST", "/messages"],
  ["POST", "/wake-check"],
  ["GET", "/tickets"],
  ["GET", "/tickets/t-1"],
  ["GET", "/departments"],
  ["GET", "/agents"],
  ["GET", "/workforce"],
  ["GET", "/costs"],
  ["GET", "/health"],
  ["GET", "/questions"],
  ["POST", "/questions/q-1/answer"],
  ["POST", "/questions/q-1/default"],
  ["POST", "/approvals/a-1"],
  ["GET", "/settings"],
  ["PUT", "/settings"],
  ["POST", "/city/pause"],
  ["POST", "/city/resume"],
  ["GET", "/memory"],
  ["POST", "/notes"],
];

export async function handleHttp(event: HttpEvent, d: ApiDeps): Promise<HttpResult> {
  if (!isOwner(event)) return problem(403, "Only the owner can use AI City.", "Sign in again with the owner account.");
  try {
    return await route(event, d);
  } catch (e) {
    if (e instanceof BadRequest) return problem(400, e.message);
    log("error", "api.failed", { path: event.rawPath, error: (e as Error).name });
    return problem(500, "Something went wrong on our side. Nothing was lost.", "Try again in a moment.");
  }
}

let deps: ApiDeps | undefined;
export const handler = (event: HttpEvent) => {
  if (!deps) {
    const city = awsCity();
    deps = {
      ...city,
      sfn: new SFNClient({ region: city.region }),
      utilityRunner: bedrockConverseRunner(new BedrockRuntimeClient({ region: city.region })),
    };
  }
  return handleHttp(event, deps);
};
